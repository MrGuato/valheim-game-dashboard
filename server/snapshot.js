// Builds the JSON document the dashboard renders (schema documented in docs.html#schema).
import { hashId } from "./state.js";
import { BOSSES, clockAt } from "./world.js";
import { materialBiome, mobBiome } from "./mods.js";

const HOUR = 3600 * 1000, DAY = 24 * HOUR, WEEK = 7 * DAY;
const LIVE_MS = 10 * 60 * 1000; // plugin readings older than this are stale
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function localClock(tz) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "numeric", hourCycle: "h23" });
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  return {
    dowHour(ms) {
      const parts = Object.fromEntries(f.formatToParts(ms).map((p) => [p.type, p.value]));
      return [WEEKDAYS.indexOf(parts.weekday), Number(parts.hour) % 24];
    },
    day: (ms) => date.format(ms)
  };
}

const sessionsIn = (sessions, from, to) =>
  sessions.map((s) => [Math.max(Date.parse(s.start), from), Math.min(Date.parse(s.end), to), s.name]).filter(([a, b]) => b > a);

const pctChange = (now, before) => (before > 0 ? Math.round(((now - before) / before) * 100) : undefined);
const round1 = (n) => Math.round(n * 10) / 10;

export function buildSnapshot({ state, config, a2s, a2sEverAnswered = false, container, world, now = Date.now() }) {
  const d = state.data;
  const hidden = new Set(config.hiddenPlayers);
  const visible = (name) => !hidden.has(name.toLowerCase());
  const clock = localClock(config.timezone);

  // include sessions still in progress, ending "now"
  const nowIso = new Date(now).toISOString();
  const open = Object.values(d.players).filter((p) => p.online).map((p) => ({ name: p.name, start: p.sessionStart, end: nowIso }));
  const allSessions = [...d.sessions, ...open].filter((s) => visible(s.name));

  // ---- server
  const running = container ? container.running : true;
  const onlineCount = a2s ? a2s.players : Object.values(d.players).filter((p) => p.online && visible(p.name)).length;
  // the clock from the log (1.0+), else the one in an old-format world save
  // the game clock runs at real speed between sleeps; a restart clears the reading
  const logClock = running && d.clock ? clockAt(d.clock.time + Math.max(0, now - Date.parse(d.clock.ts)) / 1000) : null;
  const worldClock = logClock || (world ? world.clock(running, now) : null);
  const todayKey = clock.day(now);
  const playersToday = new Set(allSessions.filter((s) => clock.day(Date.parse(s.end)) === todayKey).map((s) => s.name)).size;
  let nextSaveMinutes;
  if (d.lastSaveAt && running) {
    const due = Date.parse(d.lastSaveAt) + config.saveInterval * 1000;
    nextSaveMinutes = Math.max(0, Math.round((due - now) / 60000));
  }

  // some images restart the game inside a long-running container; count from whichever is later
  const starts = [container && container.startedAt, d.serverStartedAt].filter(Boolean).map(Date.parse);
  const uptimeSince = starts.length ? Math.max(...starts) : null;

  const server = {
    name: config.serverName || (a2s && a2s.name) || d.serverName || "Valheim server",
    world: d.world || config.worldName || null,
    // if the query port has answered before, silence means the game isn't up yet
    online: running && (a2s ? true : !a2sEverAnswered),
    // the Steam query's "version" is a protocol number, so only the log is trusted here
    version: d.version,
    players: { online: onlineCount, max: (a2s && a2s.maxPlayers) || config.maxPlayers },
    uptimeSeconds: uptimeSince ? Math.round((now - uptimeSince) / 1000) : undefined,
    pingMs: a2s ? a2s.rtt : undefined,
    worldDay: worldClock ? worldClock.day : undefined,
    timeOfDay: worldClock ? worldClock.timeOfDay : undefined,
    nextSaveMinutes,
    playersToday,
    address: config.hideAddress ? null : `${config.host}:${config.queryPort - 1}`
  };

  // ---- bosses: world save keys, plus anything set by hand in LONGHOUSE_BOSSES
  let bosses;
  const keys = world && world.cache.file ? world.cache.keys : null;
  if (keys || config.bosses.length) {
    // the first scan records what's already done without announcing it
    const firstScan = !d.bossScanDone;
    bosses = BOSSES.map((b) => {
      const defeated = (keys && keys.has(b.key)) || config.bosses.includes(b.id);
      if (defeated && !d.bossesSeen[b.id]) {
        d.bossesSeen[b.id] = { ts: nowIso, day: !firstScan && worldClock ? worldClock.day : null };
        state.dirty = true;
        if (!firstScan) state.log(nowIso, "boss", `**${b.name}** has been defeated`);
      }
      const seen = d.bossesSeen[b.id];
      return { id: b.id, name: b.name, biome: b.biome, defeated, day: defeated && seen ? seen.day : null, by: [] };
    });
    if (firstScan) { d.bossScanDone = true; state.dirty = true; }
  }

  // ---- this week vs last week (rolling 7 days)
  const weekStats = (from, to) => {
    const ss = sessionsIn(allSessions, from, to);
    return {
      playtimeHours: round1(ss.reduce((t, [a, b]) => t + (b - a), 0) / HOUR),
      sessions: allSessions.filter((s) => { const t = Date.parse(s.start); return t >= from && t < to; }).length,
      deaths: d.deaths.filter((x) => visible(x.name) && Date.parse(x.ts) >= from && Date.parse(x.ts) < to).length,
      uniquePlayers: new Set(ss.map(([, , n]) => n)).size
    };
  };
  const thisWeek = weekStats(now - WEEK, now), lastWeek = weekStats(now - 2 * WEEK, now - WEEK);
  const week = { ...thisWeek, deltas: {} };
  for (const k of Object.keys(thisWeek)) {
    const pc = pctChange(thisWeek[k], lastWeek[k]);
    if (pc !== undefined) week.deltas[k] = pc;
  }

  // ---- players
  const fresh = (x) => x && now - Date.parse(x.ts) < LIVE_MS;
  const players = Object.values(d.players).filter((p) => visible(p.name)).map((p) => {
    const openMs = p.online && p.sessionStart ? now - Date.parse(p.sessionStart) : 0;
    const live = p.online && fresh(p.live) ? p.live : null;
    const c = p.companion || null;
    const cLive = p.online && fresh(c) ? c : null;
    const out = {
      id: hashId("player:" + p.name).slice(0, 10),
      name: p.name,
      online: p.online,
      sessionMinutes: p.online ? Math.round(openMs / 60000) : undefined,
      lastSeen: p.lastSeen,
      stats: {
        deaths: p.deaths,
        playtimeHours: round1((p.playSeconds * 1000 + openMs) / HOUR),
        sessions: p.sessions,
        longestSessionMinutes: Math.round(Math.max(p.longestSeconds * 1000, openMs) / 60000)
      }
    };
    // Tier 1: server plugin
    if (p.appearance) out.appearance = p.appearance;
    if (p.equipment) out.equipment = p.equipment;
    if (live) {
      if (live.biome) out.biome = live.biome;
      if (live.place === "dungeon") out.location = "In a dungeon";
      else if (live.sleeping) out.location = "Asleep";
      if (live.hp) out.vitals = { hp: live.hp };
    }
    // Tier 2: companion mod. Lifetime stats are the character's own, across every world it has visited.
    if (c) {
      out.skills = c.skills.slice(0, 5);
      const { deaths, ...lifetime } = c.stats;
      Object.assign(out.stats, lifetime);
      if (c.mobs.length) out.topKill = c.mobs[0][0];
      if (c.foodsEaten.length) out.favoriteFood = c.foodsEaten[0][0];
      out.companion = true;
    }
    if (cLive) {
      out.vitals = cLive.vitals;
      out.foods = cLive.foods;
      out.rested = cLive.rested;
      out.comfort = cLive.comfort;
    }
    return out;
  });

  // ---- world stats, added up from everyone running the companion mod
  const sum = (key, biomeOf) => {
    const totals = new Map();
    for (const p of Object.values(d.players)) {
      if (!visible(p.name) || !p.companion) continue;
      for (const [name, n] of p.companion[key]) totals.set(name, (totals.get(name) || 0) + n);
    }
    if (!totals.size) return undefined;
    return [...totals].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([name, n]) => (biomeOf ? [name, n, biomeOf(name)] : [name, n]));
  };
  const foods = sum("foodsEaten"), materials = sum("materials", materialBiome), mobs = sum("mobs", mobBiome);

  // ---- heatmap: average players online per weekday/hour over the last 4 weeks
  const heatmap = WEEKDAYS.map(() => new Array(24).fill(0));
  const from = now - 4 * WEEK;
  const earliest = allSessions.reduce((m, s) => Math.min(m, Date.parse(s.start)), now);
  const weeks = Math.min(4, Math.max(1, Math.ceil((now - Math.max(from, earliest)) / WEEK)));
  for (const [a, b] of sessionsIn(allSessions, from, now)) {
    for (let t = a; t < b;) {
      const next = Math.min(b, Math.floor(t / HOUR) * HOUR + HOUR);
      const [dow, h] = clock.dowHour(t);
      heatmap[dow][h] += (next - t) / HOUR;
      t = next;
    }
  }
  for (const row of heatmap) for (let h = 0; h < 24; h++) row[h] = round1(row[h] / weeks);

  // ---- activity
  const activity = d.activity
    .filter((e) => !/\*\*(.+?)\*\*/.test(e.text) || visible(e.text.match(/\*\*(.+?)\*\*/)[1]))
    .slice(0, 12)
    .map((e) => ({ m: Math.max(0, Math.round((now - Date.parse(e.ts)) / 60000)), type: e.type, text: e.text }));

  return {
    schema: 1,
    generatedAt: nowIso,
    refreshSeconds: config.refreshSeconds,
    server,
    bosses,
    week,
    players,
    heatmap,
    activity,
    foods,
    materials,
    mobs,
    mods: { serverPlugin: d.plugin ? d.plugin.version : null }
  };
}
