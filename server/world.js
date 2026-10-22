// Reads what it can from the world save without parsing the whole thing:
// the in-game clock (stored at the start of <World>.db) and which bosses have
// fallen (their global keys appear as plain strings inside the file).
import fs from "node:fs";
import path from "node:path";

export const BOSSES = [
  { id: "eikthyr", key: "defeated_eikthyr", name: "Eikthyr", biome: "meadows" },
  { id: "elder", key: "defeated_gdking", name: "The Elder", biome: "blackforest" },
  { id: "bonemass", key: "defeated_bonemass", name: "Bonemass", biome: "swamp" },
  { id: "moder", key: "defeated_dragon", name: "Moder", biome: "mountain" },
  { id: "yagluth", key: "defeated_goblinking", name: "Yagluth", biome: "plains" },
  { id: "queen", key: "defeated_queen", name: "The Queen", biome: "mistlands" },
  { id: "fader", key: "defeated_fader", name: "Fader", biome: "ashlands" }
];

const DAY_SECONDS = 1800;

// Valheim counts days from 15% into each 1800s cycle, which is when morning starts.
// Shifting by that puts dawn around 0.25 for the labels below.
export function clockAt(t) {
  return {
    day: Math.floor((t - DAY_SECONDS * 0.15) / DAY_SECONDS),
    timeOfDay: timeOfDay((((t / DAY_SECONDS + 0.1) % 1) + 1) % 1)
  };
}

export function timeOfDay(fraction) {
  if (fraction < 0.22) return "Night";
  if (fraction < 0.3) return "Dawn";
  if (fraction < 0.45) return "Morning";
  if (fraction < 0.55) return "Midday";
  if (fraction < 0.7) return "Afternoon";
  if (fraction < 0.77) return "Evening";
  return "Night";
}

export function findWorldFile(dir, name) {
  try {
    if (name) {
      const f = path.join(dir, `${name}.db`);
      return fs.existsSync(f) ? f : null;
    }
    const dbs = fs.readdirSync(dir).filter((f) => f.endsWith(".db"))
      .map((f) => ({ f: path.join(dir, f), t: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    return dbs.length ? dbs[0].f : null;
  } catch {
    return null;
  }
}

function readClock(file) {
  const fd = fs.openSync(file, "r");
  try {
    const buf = Buffer.alloc(12);
    fs.readSync(fd, buf, 0, 12, 0);
    const version = buf.readInt32LE(0);
    const netTime = buf.readDoubleLE(4);
    // sanity check, so a format change shows nothing instead of nonsense
    if (version < 4 || version > 1000 || !(netTime >= 0 && netTime < 1e10)) return null;
    return netTime;
  } finally {
    fs.closeSync(fd);
  }
}

function scanKeys(file, keys) {
  const found = new Set();
  const fd = fs.openSync(file, "r");
  const chunk = Buffer.alloc(4 * 1024 * 1024);
  const overlap = 32;
  let pos = 0, carry = Buffer.alloc(0);
  try {
    for (;;) {
      const n = fs.readSync(fd, chunk, 0, chunk.length, pos);
      if (!n) break;
      const buf = Buffer.concat([carry, chunk.subarray(0, n)]);
      for (const k of keys) if (!found.has(k) && buf.includes(k)) found.add(k);
      if (found.size === keys.length) break;
      carry = buf.subarray(Math.max(0, buf.length - overlap));
      pos += n;
    }
  } finally {
    fs.closeSync(fd);
  }
  return found;
}

export class World {
  constructor(dir, name) {
    this.dir = dir;
    this.name = name;
    this.cache = { file: null, mtime: 0, netTime: null, keys: new Set() };
  }

  // Re-reads the save only when Valheim has written a new one.
  read(worldName) {
    const file = findWorldFile(this.dir, this.name || worldName);
    if (!file) return null;
    const mtime = fs.statSync(file).mtimeMs;
    if (file !== this.cache.file || mtime !== this.cache.mtime) {
      let netTime = null, keys = new Set();
      try { netTime = readClock(file); } catch (e) { console.warn(`[world] clock: ${e.message}`); }
      try { keys = scanKeys(file, BOSSES.map((b) => b.key)); } catch (e) { console.warn(`[world] keys: ${e.message}`); }
      this.cache = { file, mtime, netTime, keys };
    }
    return this.cache;
  }

  // The clock keeps running between saves while the server is up.
  clock(serverRunning, now = Date.now()) {
    const { netTime, mtime } = this.cache;
    if (netTime === null) return null;
    return clockAt(netTime + (serverRunning ? Math.max(0, (now - mtime) / 1000) : 0));
  }
}
