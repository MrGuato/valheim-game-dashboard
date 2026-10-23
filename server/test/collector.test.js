import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLine } from "../logparse.js";
import { State } from "../state.js";
import { buildSnapshot } from "../snapshot.js";
import { normalizeTs } from "../logsource.js";
import { timeOfDay, clockAt } from "../world.js";

test("parses the log lines Longhouse depends on", () => {
  assert.deepEqual(parseLine("10/21/2026 19:40:01: Got character ZDOID from Astrid : 2084737421:1"), { type: "spawn", name: "Astrid" });
  assert.deepEqual(parseLine("10/21/2026 19:41:12: Got character ZDOID from Leif : 0:0"), { type: "death", name: "Leif" });
  assert.deepEqual(parseLine("10/21/2026 19:39:58: Got connection SteamID 76561198000000001"), { type: "connect", id: "76561198000000001" });
  assert.deepEqual(parseLine("Got handshake from client Steam_76561198000000001"), { type: "connect", id: "76561198000000001" });
  assert.deepEqual(parseLine("10/21/2026 21:02:00: Closing socket 76561198000000001"), { type: "disconnect", id: "76561198000000001" });
  assert.deepEqual(parseLine("10/21/2026 20:00:00: Random event set:foresttrolls"), { type: "raid", raid: "foresttrolls" });
  assert.deepEqual(parseLine("10/21/2026 20:30:00: World saved ( 1052.775ms )"), { type: "saved", ms: 1052.775 });
  assert.deepEqual(parseLine("10/21/2026 19:00:00: Connections 0 ZDOS:126013  sent:0 recv:0"), { type: "connections", count: 0 });
  assert.deepEqual(parseLine("10/21/2026 18:59:00: Valheim version: l-0.220.5 (network version 35)"), { type: "version", version: "0.220.5" });
  assert.deepEqual(parseLine("[valheim] Starting: name='TestRealm' world='Midgard' port=2456 (public, crossplay=false)"),
    { type: "start", name: "TestRealm", world: "Midgard", port: 2456 });
  assert.equal(parseLine("[Info   : Unity Log] 10/21/2026 19:40:01: Got character ZDOID from Bjorn : 55:1").name, "Bjorn");
  assert.equal(parseLine("10/21/2026 19:40:01: Something unrelated"), null);
});

test("supervisord-prefixed lines on Valheim 1.0", () => {
  const pre = "Oct 21 09:08:16 supervisord: valheim-server 10/21/2026 09:08:16: ";
  assert.deepEqual(parseLine(pre + "Got character ZDOID from Big Bjorn : -1234567:1"), { type: "spawn", name: "Big Bjorn" });
  assert.deepEqual(parseLine(pre + "Got connection SteamID 76561198000000001"), { type: "connect", id: "76561198000000001" });
  assert.deepEqual(parseLine(pre + "World save (12/12) done. Total time [212ms]"), { type: "saved" });
  assert.equal(parseLine(pre + "Considering autobackup for World. World time: 180280.5, short time: 1, long time: 2, backup count: 4"), null);
  // after a sleep the clock jumps to the next morning
  assert.deepEqual(parseLine(pre + "Time 180300.25, day:100    nextm:182070.0  skipspeed:18.2"), { type: "clock", time: 182070 });
  assert.deepEqual(parseLine(pre + "ZNet.LoadWorld: Midgard (Midgard), save number 12"), { type: "start", name: null, world: "Midgard" });
  assert.deepEqual(parseLine(pre + "Valheim version: l-0.221.4 (network version 35)"), { type: "version", version: "0.221.4" });
  assert.deepEqual(parseLine(pre + "Console: Valheim l-1.0.20 (network version 41)"), { type: "version", version: "1.0.20" });
});

test("world day matches the day Valheim logs", () => {
  // Valheim logs "day:100" for times from 100.15 to 101.15 day-lengths
  assert.equal(clockAt(1800 * 100.2).day, 100);
  assert.equal(clockAt(1800 * 101.1).day, 100);
  assert.equal(clockAt(1800 * 101.16).timeOfDay, "Dawn"); // morning starts at .15
});

test("names with spaces survive", () => {
  assert.deepEqual(parseLine("Got character ZDOID from Big Bjorn : 12:1"), { type: "spawn", name: "Big Bjorn" });
});

test("sessions, deaths and leaves are tracked from a log sequence", () => {
  const s = new State(null);
  const feed = [
    ["2026-10-21T19:00:00Z", "[valheim] Starting: name='TestRealm' world='Midgard' port=2456"],
    ["2026-10-21T19:10:00Z", "Got connection SteamID 1001"],
    ["2026-10-21T19:10:05Z", "Got character ZDOID from Astrid : 77:1"],
    ["2026-10-21T19:20:00Z", "Got connection SteamID 1002"],
    ["2026-10-21T19:20:05Z", "Got character ZDOID from Leif : 88:1"],
    ["2026-10-21T19:30:00Z", "Got character ZDOID from Leif : 0:0"],
    ["2026-10-21T19:30:20Z", "Got character ZDOID from Leif : 89:1"],
    ["2026-10-21T20:10:05Z", "Closing socket 1001"]
  ];
  for (const [ts, line] of feed) s.apply(parseLine(line), ts);
  const { players, sessions } = s.data;
  assert.equal(players.Astrid.online, false);
  assert.equal(players.Astrid.playSeconds, 3600);
  assert.equal(players.Leif.online, true);
  assert.equal(players.Leif.sessions, 1, "a respawn is not a new session");
  assert.equal(players.Leif.deaths, 1);
  assert.equal(sessions.length, 1);
  assert.equal(s.data.serverName, "TestRealm");
  assert.ok(!JSON.stringify(s.data).includes("1001"), "raw Steam ids are never stored");
});

test("a server restart closes open sessions", () => {
  const s = new State(null);
  s.apply(parseLine("Got character ZDOID from Ulf : 5:1"), "2026-10-21T10:00:00Z");
  s.apply(parseLine("[valheim] Starting: name='X' world='Y' port=2456"), "2026-10-21T11:00:00Z");
  assert.equal(s.data.players.Ulf.online, false);
  assert.equal(s.data.players.Ulf.playSeconds, 3600);
});

test("snapshot hides players listed in LONGHOUSE_HIDDEN_PLAYERS", () => {
  const s = new State(null);
  s.apply(parseLine("Got character ZDOID from Astrid : 1:1"), "2026-10-21T10:00:00Z");
  s.apply(parseLine("Got character ZDOID from Secret : 2:1"), "2026-10-21T10:00:00Z");
  const snap = buildSnapshot({
    state: s, world: null, a2s: null, container: null, now: Date.parse("2026-10-21T12:00:00Z"),
    config: { hiddenPlayers: ["secret"], timezone: "UTC", saveInterval: 1800, maxPlayers: 10, bosses: [], serverName: "", hideAddress: true, refreshSeconds: 15 }
  });
  assert.deepEqual(snap.players.map((p) => p.name), ["Astrid"]);
  assert.ok(!JSON.stringify(snap).includes("Secret"));
  assert.equal(snap.players[0].stats.playtimeHours, 2);
  assert.equal(snap.heatmap[2][10], 1, "Wednesday 10:00 has one player-hour"); // 2026-10-21 is a Wednesday
});

test("docker timestamps sort correctly once normalized", () => {
  assert.ok(normalizeTs("2026-10-21T19:40:01.5Z") > normalizeTs("2026-10-21T19:40:01.123Z"));
  assert.equal(normalizeTs("2026-10-21T19:40:01Z"), "2026-10-21T19:40:01.000000000Z");
});

test("time of day labels", () => {
  assert.equal(timeOfDay(0.1), "Night");
  assert.equal(timeOfDay(0.5), "Midday");
  assert.equal(timeOfDay(0.72), "Evening");
});
