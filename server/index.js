// Longhouse collector: follows the Valheim server's logs, polls the Steam query port,
// reads the world save, and serves the dashboard plus /api/snapshot.json.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { timingSafeEqual } from "node:crypto";
import { config } from "./config.js";
import { parseLine } from "./logparse.js";
import { State } from "./state.js";
import { queryInfo } from "./a2s.js";
import { World } from "./world.js";
import { buildSnapshot } from "./snapshot.js";
import { dockerJson, followDocker, followFile } from "./logsource.js";

const state = new State(path.join(config.dataDir, "state.json")).load();
const world = new World(config.worldsDir, config.worldName);
const status = { logs: "starting", a2s: null, a2sAt: 0, a2sEverAnswered: false, container: null };

// ---------- collectors ----------
// A resumed stream replays lines we've already applied. Several lines can share a
// timestamp, so we also remember how many were applied at the last one.
let seenAtLast = 0;
function onLine(ts, text) {
  const d = state.data;
  if (d.lastLogTs) {
    if (ts < d.lastLogTs) return;
    if (ts === d.lastLogTs && seenAtLast < (d.lastLogCount || 0)) { seenAtLast++; return; }
  }
  const ev = parseLine(text);
  if (ev) state.apply(ev, ts);
  if (ts === d.lastLogTs) d.lastLogCount = (d.lastLogCount || 0) + 1;
  else { d.lastLogTs = ts; d.lastLogCount = 1; }
  seenAtLast = d.lastLogCount;
  state.dirty = true;
}
const onStatus = (s) => {
  if (s.startsWith("following")) seenAtLast = 0; // a new stream starts from lastLogTs again
  if (s !== status.logs) console.log(`[logs] ${s}`);
  status.logs = s;
};

if (config.logPath) {
  followFile({ file: config.logPath, onLine, onStatus });
} else {
  followDocker({
    dockerHost: config.dockerHost,
    container: config.container,
    tail: config.logTail,
    onLine,
    onStatus
  });
}

async function poll() {
  if (!config.logPath) {
    try {
      const c = await dockerJson(config.dockerHost, `/containers/${encodeURIComponent(config.container)}/json`);
      status.container = { running: !!c.State.Running, startedAt: c.State.StartedAt };
    } catch (e) {
      status.container = { running: false, startedAt: null, error: e.message };
    }
  }
  try {
    status.a2s = await queryInfo(config.host, config.queryPort);
    status.a2sAt = Date.now();
    status.a2sEverAnswered = true;
    // the query port is the source of truth for "nobody is on"
    if (status.a2s.players === 0 && state.onlinePlayers().length) state.endAll(new Date().toISOString(), false);
  } catch {
    if (Date.now() - status.a2sAt > 60000) status.a2s = null;
  }
  try { world.read(state.data.world); } catch (e) { console.warn(`[world] ${e.message}`); }
}
poll();
setInterval(poll, config.refreshSeconds * 1000);

setInterval(() => {
  state.prune();
  try { state.save(); } catch (e) { console.warn(`[state] save failed: ${e.message}`); }
}, 30000);

// ---------- http ----------
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json"
};
const PUBLIC = new Set(["/index.html", "/docs.html"]);

const HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'"
  ].join("; ")
};

function authorized(req) {
  if (!config.password) return true;
  const m = (req.headers.authorization || "").match(/^Basic (.+)$/);
  if (!m) return false;
  const pass = Buffer.from(m[1], "base64").toString("utf8").split(":").slice(1).join(":");
  const a = Buffer.from(pass), b = Buffer.from(config.password);
  return a.length === b.length && timingSafeEqual(a, b);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/healthz") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("ok");
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, HEADERS);
    return res.end();
  }
  if (!authorized(req)) {
    res.writeHead(401, { ...HEADERS, "WWW-Authenticate": 'Basic realm="Longhouse"' });
    return res.end("Password required");
  }

  if (url.pathname === "/api/snapshot.json") {
    const snap = buildSnapshot({
      state, config, world,
      a2s: status.a2s,
      a2sEverAnswered: status.a2sEverAnswered,
      container: config.logPath ? null : status.container
    });
    res.writeHead(200, { ...HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" });
    return res.end(JSON.stringify(snap));
  }

  let p = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const allowed = PUBLIC.has(p) || /^\/assets\/[\w.-]+$/.test(p);
  const file = path.join(config.staticDir, p);
  if (!allowed || !file.startsWith(config.staticDir + path.sep)) {
    res.writeHead(404, HEADERS);
    return res.end("Not found");
  }
  fs.readFile(file, (err, body) => {
    if (err) {
      res.writeHead(404, HEADERS);
      return res.end("Not found");
    }
    res.writeHead(200, { ...HEADERS, "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(req.method === "HEAD" ? undefined : body);
  });
});

server.listen(config.port, () => {
  console.log(`[longhouse] listening on :${config.port}`);
  console.log(`[longhouse] logs: ${config.logPath || `docker container "${config.container}" via ${config.dockerHost}`}`);
  console.log(`[longhouse] query: ${config.host}:${config.queryPort}  worlds: ${config.worldsDir}`);
});

function shutdown() {
  try { state.dirty = true; state.save(); } catch (e) { console.warn(e.message); }
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
