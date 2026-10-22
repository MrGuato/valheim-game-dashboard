// Runtime configuration, read once from environment variables (see .env.example).
import path from "node:path";
import { fileURLToPath } from "node:url";

const env = process.env;
const int = (v, d) => (v !== undefined && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : d);
const bool = (v, d) => (v === undefined || v === "" ? d : /^(1|true|yes|on)$/i.test(v));
const list = (v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);

export const config = {
  port: int(env.LONGHOUSE_PORT, 8080),
  serverName: env.LONGHOUSE_SERVER_NAME || "",
  password: env.LONGHOUSE_PASSWORD || "",
  hiddenPlayers: list(env.LONGHOUSE_HIDDEN_PLAYERS).map((n) => n.toLowerCase()),
  hideAddress: bool(env.LONGHOUSE_HIDE_ADDRESS, true),
  refreshSeconds: int(env.LONGHOUSE_REFRESH_SECONDS, 15),
  timezone: env.LONGHOUSE_TIMEZONE || env.TZ || "UTC",
  dataDir: env.LONGHOUSE_DATA_DIR || "/data",
  // manual boss progress for worlds the collector can't read, e.g. "eikthyr,elder"
  bosses: list(env.LONGHOUSE_BOSSES).map((b) => b.toLowerCase()),

  // the game server
  host: env.VALHEIM_HOST || "host.docker.internal",
  queryPort: int(env.VALHEIM_QUERY_PORT, 2457),
  maxPlayers: int(env.VALHEIM_MAX_PLAYERS, 10),
  container: env.VALHEIM_CONTAINER || "valheim",
  dockerHost: env.DOCKER_HOST || "unix:///var/run/docker.sock",
  logPath: env.VALHEIM_LOG_PATH || "", // read a log file instead of the Docker API
  logTail: int(env.LONGHOUSE_LOG_TAIL, 300000), // log lines replayed from the end on each (re)connect
  worldsDir: env.VALHEIM_WORLDS_DIR || "/valheim/worlds_local",
  worldName: env.VALHEIM_WORLD || "",
  saveInterval: int(env.VALHEIM_SAVE_INTERVAL, 1800),

  staticDir: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
};
