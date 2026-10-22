// Turns one Valheim server log line into an event, or null.
// Log formats drift between game versions; every pattern lives here and is covered
// by test/logparse.test.js so a game update breaks loudly in one place.

// "10/21/2026 19:40:01: " is Valheim's own timestamp prefix
const VALHEIM_PREFIX = /^\d{1,2}\/\d{1,2}\/\d{4} \d{1,2}:\d{2}:\d{2}:\s*/;
// "[Info   : Unity Log] " gets added when BepInEx is installed
const BEPINEX_PREFIX = /^\[\w+\s*:\s*[^\]]+\]\s*/;

const PATTERNS = [
  // the MrGuato/Valheim_Game_Server entrypoint announces each (re)start and stop
  ["start", /^\[valheim\] Starting: name='(.*)' world='(.*)' port=(\d+)/, (m) => ({ name: m[1], world: m[2], port: Number(m[3]) })],
  ["stop", /^\[valheim\] (?:Shutdown requested|Server exited|Server stopped)/, () => ({})],
  // every server start loads the world (lloesche/valheim-server restarts the game inside the container)
  ["start", /ZNet\.LoadWorld: (\S+)/, (m) => ({ name: null, world: m[1] })],
  ["version", /Valheim version:\s*(?:[a-z]-)?(\d+\.\d+\.\d+)/, (m) => ({ version: m[1] })],
  ["version", /Console: Valheim [a-z]-(\d+\.\d+\.\d+)/, (m) => ({ version: m[1] })], // 1.0+
  ["ready", /Game server connected/, () => ({})],
  ["connect", /Got connection SteamID (\d+)/, (m) => ({ id: m[1] })],
  ["connect", /Got handshake from client (?:Steam_)?(\d+)/, (m) => ({ id: m[1] })],
  ["disconnect", /Closing socket (?:Steam_)?(\d+)/, (m) => ({ id: m[1] })],
  // "Got character ZDOID from Astrid : 2084737421:1" is a spawn, ": 0:0" means they died
  ["character", /Got character ZDOID from (.+?) : (-?\d+):(-?\d+)\s*$/, (m) => ({ name: m[1].trim(), dead: m[2] === "0" && m[3] === "0" })],
  ["connections", /Connections (\d+) ZDOS:/, (m) => ({ count: Number(m[1]) })],
  ["raid", /Random event set:\s*([\w-]+)/, (m) => ({ raid: m[1] })],
  ["saved", /World saved \(\s*([\d.]+)\s*ms\s*\)/, (m) => ({ ms: Number(m[1]) })],
  ["saved", /World save \(\d+\/\d+\) done/, () => ({})], // 1.0+
  // the in-game clock, logged when everyone sleeps: "Time 439251.2, day:243    nextm:439470.0"
  // (the "World time" in autobackup lines is seconds since the process started, not the game clock)
  ["clock", /\bTime ([\d.]+), day:\d+(?:\s+nextm:([\d.]+))?/, (m) => ({ time: Number(m[2] || m[1]) })]
];

export function parseLine(raw) {
  const line = String(raw).replace(VALHEIM_PREFIX, "").replace(BEPINEX_PREFIX, "").trim();
  if (!line) return null;
  for (const [type, re, build] of PATTERNS) {
    const m = line.match(re);
    if (!m) continue;
    const ev = { type, ...build(m) };
    if (type === "character") return { type: ev.dead ? "death" : "spawn", name: ev.name };
    return ev;
  }
  return null;
}

// Friendly names for the raid ids the server logs
export const RAIDS = {
  army_eikthyr: "Eikthyr rallies the creatures of the forest",
  army_theelder: "The forest is moving",
  army_bonemass: "A foul smell from the swamp",
  army_moder: "A cold wind blows from the mountains",
  army_goblin: "The horde is attacking",
  foresttrolls: "The ground is shaking",
  skeletons: "Skeleton surprise",
  surtlings: "There's a smell of sulfur in the air",
  wolves: "You are being hunted"
};

export const raidName = (id) => RAIDS[id] || id.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
