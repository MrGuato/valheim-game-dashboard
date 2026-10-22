import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLine } from "../logparse.js";
import { State } from "../state.js";
import { buildSnapshot } from "../snapshot.js";
import { appearanceFrom, decodeCompanion } from "../mods.js";

const config = { hiddenPlayers: [], timezone: "UTC", saveInterval: 1800, maxPlayers: 10, bosses: [], serverName: "", hideAddress: true, refreshSeconds: 15 };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64");
const pre = "Oct 22 13:00:00 supervisord: valheim-server 10/22/2026 13:00:00: ";

const playerLine = {
  t: "player", name: "Astrid", biome: "mistlands", hp: [198, 232],
  look: { model: 1, skin: [1, 1, 1], hair: [0.9, 0.7, 0.3], hairItem: "Hair3", beardItem: "BeardNone" },
  gear: { head: { id: "HelmetCarapace", name: "Carapace helmet" }, weapon: { id: "SwordMistwalker", name: "Mistwalker", q: 3 } }
};
const companion = {
  v: 1, mod: "0.2.0",
  vitals: { hp: [198, 232], stamina: [141, 166], eitr: [40, 64] }, rested: true, comfort: 17,
  foods: [{ name: "Seeker aspic", minutesLeft: 31, total: 45, kind: "eitr" }],
  skills: [["Swords", 74], ["Blocking", 68], ["Run", 61], ["Jump", 55], ["Sneak", 20], ["Swim", 10]],
  stats: { kills: 4812, bossKills: 5, deaths: 37, built: 2140, crafted: 611, jumps: 52130, distanceKm: 1180 },
  mobs: [["Greydwarf", 3104], ["Neck", 50], ["Mystery beast", 2]],
  foodsEaten: [["Lox meat pie", 12]],
  materials: [["Wood", 48210]]
};

test("parses LH1 lines from the server plugin, with or without BepInEx prefixes", () => {
  const ev = parseLine(pre + "LH1 " + JSON.stringify({ t: "hello", plugin: "0.2.0" }));
  assert.deepEqual(ev, { type: "longhouse", data: { t: "hello", plugin: "0.2.0" } });
  assert.equal(parseLine("[Info   : Unity Log] 10/22/2026 13:00:00: LH1 {\"t\":\"player\",\"name\":\"A\"}").data.name, "A");
  assert.equal(parseLine(pre + "LH1 {not json"), null);
  assert.equal(parseLine(pre + "LH1 {\"name\":\"no type\"}"), null);
});

test("plugin and companion data reach the player profile", () => {
  const s = new State(null);
  const feed = [
    ["2026-10-22T13:00:00Z", "Got character ZDOID from Astrid : 77:1"],
    ["2026-10-22T13:00:30Z", pre + "LH1 " + JSON.stringify({ t: "hello", plugin: "0.2.0" })],
    ["2026-10-22T13:01:00Z", pre + "LH1 " + JSON.stringify(playerLine)],
    ["2026-10-22T13:01:30Z", pre + "LH1 " + JSON.stringify({ t: "stats", name: "Astrid", b64: b64(companion) })]
  ];
  for (const [ts, line] of feed) s.apply(parseLine(line), ts);
  const snap = buildSnapshot({ state: s, config, world: null, a2s: null, container: null, now: Date.parse("2026-10-22T13:02:00Z") });
  const p = snap.players[0];
  assert.equal(snap.mods.serverPlugin, "0.2.0");
  assert.equal(p.biome, "mistlands");
  assert.deepEqual(p.equipment.weapon, { name: "Mistwalker", q: 3 });
  assert.equal(p.equipment.head.name, "Carapace helmet");
  assert.equal(p.appearance.model, 1);
  assert.equal(p.appearance.beard, "none");
  assert.equal(p.appearance.skin, "#f2c9a8");
  assert.deepEqual(p.vitals.eitr, [40, 64], "companion vitals win over the plugin's health-only reading");
  assert.equal(p.foods[0].name, "Seeker aspic");
  assert.equal(p.skills.length, 5);
  assert.equal(p.stats.kills, 4812);
  assert.equal(p.stats.deaths, 0, "deaths stay the ones this server saw, not the character's lifetime count");
  assert.equal(p.topKill, "Greydwarf");
  assert.equal(p.favoriteFood, "Lox meat pie");
  assert.deepEqual(snap.mobs[0], ["Greydwarf", 3104, "blackforest"]);
  assert.equal(snap.mobs[2][2], undefined, "unknown creatures have no biome");
  assert.deepEqual(snap.materials[0], ["Wood", 48210, "meadows"]);
});

test("live readings go stale and disappear when the player logs off", () => {
  const s = new State(null);
  s.apply(parseLine("Got connection SteamID 1001"), "2026-10-22T13:00:00Z");
  s.apply(parseLine("Got character ZDOID from Astrid : 77:1"), "2026-10-22T13:00:01Z");
  s.apply(parseLine(pre + "LH1 " + JSON.stringify(playerLine)), "2026-10-22T13:01:00Z");
  s.apply(parseLine(pre + "LH1 " + JSON.stringify({ t: "stats", name: "Astrid", b64: b64(companion) })), "2026-10-22T13:01:00Z");
  let p = buildSnapshot({ state: s, config, world: null, a2s: null, container: null, now: Date.parse("2026-10-22T13:30:00Z") }).players[0];
  assert.equal(p.biome, undefined, "a 29-minute-old position isn't shown");
  assert.equal(p.foods, undefined);
  assert.ok(p.equipment, "gear stays");
  s.apply(parseLine("Closing socket 1001"), "2026-10-22T13:31:00Z");
  p = buildSnapshot({ state: s, config, world: null, a2s: null, container: null, now: Date.parse("2026-10-22T13:32:00Z") }).players[0];
  assert.equal(p.online, false);
  assert.equal(p.vitals, undefined);
  assert.equal(p.skills[0][0], "Swords", "skills and lifetime stats stay after logout");
});

test("companion payloads are checked before use", () => {
  assert.equal(decodeCompanion("not base64 json"), null);
  assert.equal(decodeCompanion(b64({ v: 2 })), null);
  const evil = decodeCompanion(b64({
    v: 1, comfort: 1e12, vitals: { hp: ["x", 5] },
    skills: [["<img src=x onerror=alert(1)>", 500], "junk"],
    stats: { kills: -5, built: "lots" },
    foods: [{ name: "Bread", minutesLeft: 99999, total: 30, kind: "poison" }]
  }));
  assert.equal(evil.comfort, 100);
  assert.deepEqual(evil.vitals.hp, [0, 5]);
  assert.deepEqual(evil.skills, [["img src=x onerror=alert(1)", 100]]);
  assert.equal(evil.stats.kills, 0);
  assert.equal(evil.stats.built, 0);
  assert.equal(evil.foods[0].kind, "hp");
  assert.equal(evil.foods[0].minutesLeft, 600);
});

test("appearance falls back sensibly", () => {
  assert.equal(appearanceFrom(null), null);
  const a = appearanceFrom({ model: 0, hairItem: "HairNone", beardItem: null, skin: [0.5, 0.4, 0.3] });
  assert.equal(a.hairStyle, "bald");
  assert.equal(a.beard, "none");
  assert.match(a.skin, /^#[0-9a-f]{6}$/);
});
