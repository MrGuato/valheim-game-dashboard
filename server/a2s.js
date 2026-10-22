// Minimal Steam A2S_INFO query (UDP). Valheim answers on the game port + 1.
import dgram from "node:dgram";

const HEADER = Buffer.from([0xff, 0xff, 0xff, 0xff]);
const INFO_REQUEST = Buffer.concat([HEADER, Buffer.from("TSource Engine Query\0", "latin1")]);

function readInfo(buf) {
  let o = 5; // skip 0xFFFFFFFF + 'I'
  const byte = () => buf[o++];
  const str = () => {
    const end = buf.indexOf(0, o);
    const s = buf.toString("utf8", o, end);
    o = end + 1;
    return s;
  };
  const info = { protocol: byte(), name: str(), map: str(), folder: str(), game: str() };
  info.appId = buf.readUInt16LE(o); o += 2;
  info.players = byte();
  info.maxPlayers = byte();
  info.bots = byte();
  o += 4; // server type, environment, visibility, vac
  info.version = str();
  if (o < buf.length) {
    const edf = byte();
    if (edf & 0x80) o += 2;
    if (edf & 0x10) o += 8;
    if (edf & 0x40) { o += 2; str(); }
    if (edf & 0x20) info.keywords = str();
  }
  return info;
}

export function queryInfo(host, port, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    const sock = dgram.createSocket("udp4");
    const started = Date.now();
    const done = (err, val) => {
      clearTimeout(timer);
      sock.close();
      err ? reject(err) : resolve(val);
    };
    const timer = setTimeout(() => done(new Error("A2S timeout")), timeoutMs);
    sock.on("error", (e) => done(e));
    sock.on("message", (msg) => {
      if (msg.length < 5 || !msg.subarray(0, 4).equals(HEADER)) return;
      const kind = msg[4];
      if (kind === 0x41) {
        // challenge: repeat the request with the 4-byte token appended
        sock.send(Buffer.concat([INFO_REQUEST, msg.subarray(5, 9)]), port, host);
      } else if (kind === 0x49) {
        try {
          done(null, { ...readInfo(msg), rtt: Date.now() - started });
        } catch (e) {
          done(e);
        }
      }
    });
    sock.send(INFO_REQUEST, port, host);
  });
}
