// Streams the game server's log lines, either from the Docker Engine API
// (the container writes to stdout) or from a plain log file.
import fs from "node:fs";
import http from "node:http";

// Docker trims trailing zeros from nanoseconds; pad so timestamps sort as strings.
export function normalizeTs(ts) {
  const m = ts.match(/^(.*?T\d{2}:\d{2}:\d{2})(?:\.(\d+))?Z$/);
  return m ? `${m[1]}.${(m[2] || "").padEnd(9, "0").slice(0, 9)}Z` : ts;
}

function dockerOptions(dockerHost, path) {
  if (dockerHost.startsWith("unix://")) return { socketPath: dockerHost.slice(7), path };
  const u = new URL(dockerHost.replace(/^tcp:/, "http:"));
  return { host: u.hostname, port: Number(u.port) || 2375, path };
}

export function dockerJson(dockerHost, path) {
  return new Promise((resolve, reject) => {
    const req = http.get(dockerOptions(dockerHost, path), (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        if (res.statusCode !== 200) return reject(new Error(`docker ${path}: HTTP ${res.statusCode} ${body.trim()}`));
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.setTimeout(5000, () => req.destroy(new Error("docker API timeout")));
    req.on("error", reject);
  });
}

// Follows `docker logs -f --timestamps --tail N` for a container. Calls onLine(ts, text)
// per line and resolves when the stream ends (container stopped or recreated).
// `--tail` reads the log file backwards from the end. `--since` reads it forwards and
// silently stops at the first damaged line (left behind by an unclean shutdown), so
// a resumed stream replays the last N lines and the caller skips what it has seen.
function followOnce(dockerHost, container, tail, onLine) {
  const path = `/containers/${encodeURIComponent(container)}/logs?follow=1&stdout=1&stderr=1&timestamps=1&tail=${tail}`;
  return new Promise((resolve, reject) => {
    const req = http.get(dockerOptions(dockerHost, path), (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`docker logs: HTTP ${res.statusCode}`));
      }
      let pending = Buffer.alloc(0), text = "", multiplexed = null;
      const emit = (s) => {
        text += s;
        let i;
        while ((i = text.indexOf("\n")) >= 0) {
          const line = text.slice(0, i).replace(/\r$/, "");
          text = text.slice(i + 1);
          const sp = line.indexOf(" ");
          if (sp > 0) onLine(normalizeTs(line.slice(0, sp)), line.slice(sp + 1));
        }
      };
      res.on("data", (chunk) => {
        pending = Buffer.concat([pending, chunk]);
        // without a TTY Docker wraps output in 8-byte frame headers
        if (multiplexed === null && pending.length >= 8) multiplexed = pending[0] <= 2 && pending[1] === 0 && pending[2] === 0 && pending[3] === 0;
        if (multiplexed === false) { emit(pending.toString("utf8")); pending = Buffer.alloc(0); return; }
        while (pending.length >= 8) {
          const size = pending.readUInt32BE(4);
          if (pending.length < 8 + size) break;
          emit(pending.toString("utf8", 8, 8 + size));
          pending = pending.subarray(8 + size);
        }
      });
      res.on("end", resolve);
      res.on("error", reject);
    });
    req.on("error", reject);
  });
}

export async function followDocker({ dockerHost, container, tail, onLine, onStatus }) {
  for (;;) {
    try {
      onStatus("following");
      await followOnce(dockerHost, container, tail, onLine);
      onStatus("ended");
    } catch (e) {
      onStatus(`error: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
}

// Tails a log file. Lines carry Valheim's own "MM/dd/yyyy HH:mm:ss:" prefix,
// which is read in the collector's local time.
export function followFile({ file, onLine, onStatus }) {
  let offset = 0, rest = "";
  const stamp = (line) => {
    const m = line.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2})/);
    const d = m ? new Date(+m[3], +m[1] - 1, +m[2], +m[4], +m[5], +m[6]) : new Date();
    return normalizeTs(d.toISOString());
  };
  const tick = () => {
    fs.stat(file, (err, st) => {
      if (err) return onStatus(`error: ${err.message}`);
      if (st.size < offset) offset = 0; // rotated
      if (st.size === offset) return;
      const stream = fs.createReadStream(file, { start: offset, end: st.size - 1, encoding: "utf8" });
      offset = st.size;
      stream.on("data", (c) => {
        rest += c;
        const lines = rest.split(/\r?\n/);
        rest = lines.pop();
        for (const l of lines) onLine(stamp(l), l);
      });
    });
  };
  onStatus("following file");
  tick();
  setInterval(tick, 2000);
}
