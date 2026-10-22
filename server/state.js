// Everything Longhouse remembers, rebuilt from log events and saved to /data/state.json.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { raidName } from "./logparse.js";
import { appearanceFrom, biomeFrom, equipmentFrom, killsFrom } from "./mods.js";

const KEEP_MS = 35 * 86400 * 1000; // sessions and deaths kept for the heatmap and weekly numbers
const ACTIVITY_MAX = 60;

// Steam ids never reach disk or the browser in the clear
export const hashId = (id) => createHash("sha256").update(String(id)).digest("hex").slice(0, 16);

const emptyState = () => ({
  schema: 1,
  version: null,
  world: null,
  serverName: null,
  serverStartedAt: null,
  lastSaveAt: null,
  lastLogTs: null,
  clock: null,
  players: {},
  sessions: [],
  deaths: [],
  activity: [],
  bossesSeen: {},
  pending: [],
  idToName: {},
  plugin: null // { version, ts } once the Longhouse server plugin has said hello
});

const fmtDuration = (ms) => {
  const m = Math.round(ms / 60000), h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
};

export class State {
  constructor(file) {
    this.file = file;
    this.data = emptyState();
    this.dirty = false;
  }

  load() {
    if (!this.file) return this;
    try {
      this.data = { ...emptyState(), ...JSON.parse(fs.readFileSync(this.file, "utf8")) };
    } catch (e) {
      if (e.code !== "ENOENT") console.warn(`[state] could not read ${this.file}: ${e.message}`);
    }
    return this;
  }

  save() {
    if (!this.file || !this.dirty) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(this.data));
    fs.renameSync(tmp, this.file);
    this.dirty = false;
  }

  player(name) {
    const d = this.data;
    return (d.players[name] ||= {
      name, firstSeen: null, lastSeen: null, online: false, sessionStart: null,
      deaths: 0, sessions: 0, playSeconds: 0, longestSeconds: 0
    });
  }

  onlinePlayers() {
    return Object.values(this.data.players).filter((p) => p.online);
  }

  log(ts, type, text) {
    const a = this.data.activity;
    a.unshift({ ts, type, text });
    if (a.length > ACTIVITY_MAX) a.length = ACTIVITY_MAX;
  }

  endSession(p, ts, quiet = false) {
    if (!p.online) return;
    const start = Date.parse(p.sessionStart), end = Date.parse(ts);
    const dur = Math.max(0, end - start);
    if (dur > 0) {
      p.playSeconds += dur / 1000;
      p.longestSeconds = Math.max(p.longestSeconds, dur / 1000);
      this.data.sessions.push({ name: p.name, start: p.sessionStart, end: ts });
    }
    p.online = false;
    p.sessionStart = null;
    p.lastSeen = ts;
    if (!quiet) this.log(ts, "leave", `**${p.name}** left after ${fmtDuration(dur)}`);
  }

  endAll(ts, quiet = true) {
    for (const p of this.onlinePlayers()) this.endSession(p, ts, quiet);
    this.data.pending = [];
    this.data.idToName = {};
  }

  // Applies one parsed log event that happened at ISO time `ts`.
  apply(ev, ts) {
    const d = this.data;
    this.dirty = true;
    switch (ev.type) {
      case "start":
        this.endAll(ts);
        if (ev.name) d.serverName = ev.name;
        d.world = ev.world;
        d.clock = null; // the clock didn't run while the server was down
        d.serverStartedAt = ts;
        this.log(ts, "server", "Server started");
        break;
      case "stop":
        this.endAll(ts);
        this.log(ts, "server", "Server stopped");
        break;
      case "version":
        d.version = ev.version;
        break;
      case "connect": {
        const id = hashId(ev.id);
        if (!d.pending.includes(id) && !d.idToName[id]) d.pending.push(id);
        break;
      }
      case "spawn": {
        const p = this.player(ev.name);
        p.firstSeen ||= ts;
        p.lastSeen = ts;
        if (!p.online) {
          p.online = true;
          p.sessionStart = ts;
          p.sessions += 1;
          // pair this name with the oldest connection that hasn't named itself yet
          const id = d.pending.shift();
          if (id) d.idToName[id] = ev.name;
          this.log(ts, "join", `**${ev.name}** joined the server`);
        }
        break;
      }
      case "death": {
        const p = this.player(ev.name);
        p.deaths += 1;
        p.lastSeen = ts;
        d.deaths.push({ name: ev.name, ts });
        this.log(ts, "death", `**${ev.name}** died`);
        break;
      }
      case "disconnect": {
        const id = hashId(ev.id);
        const name = d.idToName[id];
        d.pending = d.pending.filter((x) => x !== id);
        delete d.idToName[id];
        if (name && d.players[name]) this.endSession(d.players[name], ts);
        break;
      }
      case "connections":
        if (ev.count === 0 && this.onlinePlayers().length) this.endAll(ts, false);
        break;
      case "raid":
        this.log(ts, "event", `Raid: **${raidName(ev.raid)}**`);
        break;
      case "saved":
        d.lastSaveAt = ts;
        break;
      case "clock":
        d.clock = { time: ev.time, ts };
        break;
      case "longhouse":
        this.applyMod(ev.data, ts);
        break;
      default:
        this.dirty = false;
    }
  }

  // "LH1" lines from the server plugin: what it can see of each connected player, the kills
  // it counted since the last line, and how many building pieces each player has standing.
  applyMod(m, ts) {
    const d = this.data;
    const nameOf = (v) => (typeof v === "string" ? v.trim().slice(0, 40) : "");
    if (m.t === "hello") {
      d.plugin = { version: typeof m.plugin === "string" ? m.plugin.slice(0, 20) : null, ts };
      return;
    }
    if (m.t === "pieces") {
      if (!Array.isArray(m.counts)) { this.dirty = false; return; }
      for (const r of m.counts.slice(0, 200)) {
        const name = Array.isArray(r) ? nameOf(r[0]) : "";
        if (!name || typeof r[1] !== "number") continue;
        this.player(name).pieces = Math.max(0, Math.round(r[1]));
      }
      return;
    }
    const name = nameOf(m.name);
    if (!name) { this.dirty = false; return; }
    const p = this.player(name);
    if (m.t === "player") {
      p.live = {
        ts,
        biome: biomeFrom(m.biome),
        place: m.place === "dungeon" ? "dungeon" : null,
        hp: Array.isArray(m.hp) && m.hp.length === 2 ? m.hp.map((n) => Math.max(0, Math.round(Number(n) || 0))) : null,
        sleeping: m.sleeping === true
      };
      // the look and gear stay after they log off, so the figure isn't blank
      const look = appearanceFrom(m.look);
      if (look) p.appearance = look;
      const gear = equipmentFrom(m.gear);
      if (gear) p.equipment = gear;
    } else if (m.t === "tally") {
      p.kills ||= {};
      for (const [mob, n] of Object.entries(killsFrom(m.kills))) p.kills[mob] = (p.kills[mob] || 0) + n;
      p.bossKills = (p.bossKills || 0) + Math.max(0, Math.round(Number(m.bosses) || 0));
    } else {
      this.dirty = false;
    }
  }

  prune(now = Date.now()) {
    const d = this.data;
    const cutoff = now - KEEP_MS;
    d.sessions = d.sessions.filter((s) => Date.parse(s.end) >= cutoff);
    d.deaths = d.deaths.filter((x) => Date.parse(x.ts) >= cutoff);
  }
}
