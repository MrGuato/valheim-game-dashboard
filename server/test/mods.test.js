import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLine } from "../logparse.js";
import { State } from "../state.js";
import { buildSnapshot } from "../snapshot.js";
import { appearanceFrom, killsFrom } from "../mods.js";

const config = { hiddenPlayers: [], timezone: "UTC", saveInterval: 1800, maxPlayers: 10, bosses: [], serverName: "", hideAddress: true, refreshSeconds: 15 };
const pre = "Oct 22 13:00:00 supervisord: valheim-server 10/22/2026 13:00:00: ";
const lh = (o) => pre + "LH1 " + JSON.stringify(o);

const playerLine = {
  t: "player", name: "Astrid", biome: "mistlands", hp: [198, 232],
  look: { model: 1, skin: [1, 1, 1], hair: [0.9, 0.7, 0.3], hairItem: "Hair3", beardItem: "BeardNone" },
  gear: { head: { id: "HelmetCarapace", name: "Carapace helmet" }, weapon: { id: "SwordMistwalker", name: "Mistwalker", q: 3 } }
};

test("parses LH1 lines from the server plugin, with or without BepInEx prefixes", () => {
  assert.deepEqual(parseLine(lh({ t: "hello", plugin: "0.3.0" })), { type: "longhouse", data: { t: "hello", plugin: "0.3.0" } });
  assert.equal(parseLine("[Info   : Unity Log] 10/22/2026 13:00:00: LH1 {\"t\":\"player\",\"name\":\"A\"}").data.name, "A");
  assert.equal(parseLine(pre + "LH1 {not json"), null);
  assert.equal(parseLine(pre + "LH1 {\"name\":\"no type\"}"), null);
});

test("plugin data reaches the player profile", () => {
  const s = new State(null);
  const feed = [
    ["2026-10-22T13:00:00Z", "Got character ZDOID from Astrid : 77:1"],
    ["2026-10-22T13:00:30Z", lh({ t: "hello", plugin: "0.3.0" })],
    ["2026-10-22T13:01:00Z", lh(playerLine)],
    ["2026-10-22T13:01:00Z", lh({ t: "tally", name: "Astrid", kills: [["Greydwarf", 3], ["Troll", 1]], bosses: 0 })],
    ["2026-10-22T13:01:30Z", lh({ t: "tally", name: "Astrid", kills: [["Greydwarf", 2], ["Eikthyr", 1]], bosses: 1 })],
    ["2026-10-22T13:01:30Z", lh({ t: "pieces", counts: [["Astrid", 412], ["Bjorn", 0]] })]
  ];
  for (const [ts, line] of feed) s.apply(parseLine(line), ts);
  const snap = buildSnapshot({ state: s, config, world: null, a2s: null, container: null, now: Date.parse("2026-10-22T13:02:00Z") });
  const p = snap.players.find((x) => x.name === "Astrid");
  assert.equal(snap.mods.serverPlugin, "0.3.0");
  assert.equal(p.biome, "mistlands");
  assert.deepEqual(p.vitals, { hp: [198, 232] });
  assert.deepEqual(p.equipment.weapon, { name: "Mistwalker", q: 3 });
  assert.equal(p.appearance.model, 1);
  assert.equal(p.appearance.beard, "none");
  assert.equal(p.appearance.skin, "#f2c9a8");
  assert.equal(p.stats.kills, 7, "tallies add up across lines");
  assert.equal(p.stats.bossKills, 1);
  assert.equal(p.stats.piecesStanding, 412);
  assert.equal(p.topKill, "Greydwarf");
  assert.equal(p.stats.deaths, 0, "deaths still come from the server log");
  assert.deepEqual(snap.mobs[0], ["Greydwarf", 5, "blackforest"]);
  assert.equal(snap.players.find((x) => x.name === "Bjorn").stats.piecesStanding, 0);
});

test("live readings go stale and disappear when the player logs off", () => {
  const s = new State(null);
  s.apply(parseLine("Got connection SteamID 1001"), "2026-10-22T13:00:00Z");
  s.apply(parseLine("Got character ZDOID from Astrid : 77:1"), "2026-10-22T13:00:01Z");
  s.apply(parseLine(lh(playerLine)), "2026-10-22T13:01:00Z");
  let p = buildSnapshot({ state: s, config, world: null, a2s: null, container: null, now: Date.parse("2026-10-22T13:30:00Z") }).players[0];
  assert.equal(p.biome, undefined, "a 29-minute-old position isn't shown");
  assert.ok(p.equipment, "gear stays");
  s.apply(parseLine("Closing socket 1001"), "2026-10-22T13:31:00Z");
  p = buildSnapshot({ state: s, config, world: null, a2s: null, container: null, now: Date.parse("2026-10-22T13:32:00Z") }).players[0];
  assert.equal(p.online, false);
  assert.equal(p.vitals, undefined);
  assert.ok(p.appearance, "the figure keeps its look after logout");
});

test("tally and pieces lines are checked before use", () => {
  assert.deepEqual(killsFrom([["<b>Troll</b>", 2], ["Neck", -4], ["Boar", 1e9], "junk", [5, 1]]), { "bTroll/b": 2, Neck: 0, Boar: 10000 });
  const s = new State(null);
  s.apply(parseLine(lh({ t: "pieces", counts: "nope" })), "2026-10-22T13:00:00Z");
  s.apply(parseLine(lh({ t: "pieces", counts: [["", 5], ["Ulf", "many"], ["Ulf", -3]] })), "2026-10-22T13:00:00Z");
  assert.equal(s.data.players.Ulf.pieces, 0);
  assert.equal(Object.keys(s.data.players).length, 1);
});

test("appearance falls back sensibly", () => {
  assert.equal(appearanceFrom(null), null);
  const a = appearanceFrom({ model: 0, hairItem: "HairNone", beardItem: null, skin: [0.5, 0.4, 0.3] });
  assert.equal(a.hairStyle, "bald");
  assert.equal(a.beard, "none");
  assert.match(a.skin, /^#[0-9a-f]{6}$/);
});
