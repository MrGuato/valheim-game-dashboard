// Turns what the Longhouse server plugin (mods/Longhouse.Server) logs into the shapes the
// dashboard draws. Lines are checked anyway: names and numbers are type-checked and clamped.

const BIOMES = new Set(["meadows", "blackforest", "swamp", "mountain", "plains", "mistlands", "ashlands", "deepnorth", "ocean"]);
const SLOTS = ["head", "chest", "legs", "cape", "weapon", "offhand", "utility"];

const str = (v, max = 60) => (typeof v === "string" ? v.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, max) : null);
const num = (v, max = 1e9) => (typeof v === "number" && Number.isFinite(v) ? Math.min(Math.max(v, 0), max) : 0);

// Valheim tints a light skin texture and a pale hair texture by these vectors
const SKIN_BASE = [242, 201, 168];
const HAIR_BASE = [235, 225, 210];
const hex = (vec, base) => {
  if (!Array.isArray(vec) || vec.length !== 3) return null;
  return "#" + vec.map((c, i) => Math.round(Math.min(1, Math.max(0, num(c, 2))) * base[i]).toString(16).padStart(2, "0")).join("");
};

// The figure only knows a handful of shapes, so Valheim's numbered styles are grouped
export function appearanceFrom(look) {
  if (!look || typeof look !== "object") return null;
  const hairItem = str(look.hairItem) || "";
  const beardItem = str(look.beardItem) || "";
  const n = (s) => Number((s.match(/\d+/) || [0])[0]);
  const hairStyle = !hairItem || /none/i.test(hairItem) ? "bald" : ["short", "long", "braids", "ponytail"][n(hairItem) % 4];
  const beard = !beardItem || /none/i.test(beardItem) ? "none" : ["short", "long", "braided"][n(beardItem) % 3];
  return {
    model: look.model === 1 ? 1 : 0,
    skin: hex(look.skin, SKIN_BASE) || "#d9a989",
    hair: hex(look.hair, HAIR_BASE) || "#5b4636",
    hairStyle,
    beard
  };
}

export function equipmentFrom(gear) {
  if (!gear || typeof gear !== "object") return null;
  const out = {};
  for (const slot of SLOTS) {
    const g = gear[slot];
    const name = g && (str(g.name) || str(g.id));
    if (!name) continue;
    out[slot] = { name, q: g.q ? Math.round(num(g.q, 10)) : undefined };
  }
  return out;
}

export const biomeFrom = (b) => (BIOMES.has(b) ? b : null);

// "kills": [["Greydwarf", 3], ...] from one tally line
export function killsFrom(rows) {
  const out = {};
  if (!Array.isArray(rows)) return out;
  for (const r of rows.slice(0, 200)) {
    if (!Array.isArray(r) || !str(r[0])) continue;
    out[str(r[0])] = (out[str(r[0])] || 0) + Math.round(num(r[1], 10000));
  }
  return out;
}

// Which biome a creature belongs to, for the colored dots and the filter.
// English names as the game shows them; anything unknown just has no dot.
const MOB_BIOME = {
  Boar: "meadows", Deer: "meadows", Neck: "meadows", Greyling: "meadows", Eikthyr: "meadows",
  Greydwarf: "blackforest", "Greydwarf brute": "blackforest", "Greydwarf shaman": "blackforest", Troll: "blackforest",
  Skeleton: "blackforest", Ghost: "blackforest", "Rancid remains": "blackforest", Bear: "blackforest", "The Elder": "blackforest",
  Draugr: "swamp", "Draugr elite": "swamp", Blob: "swamp", Oozer: "swamp", Leech: "swamp", Surtling: "swamp",
  Wraith: "swamp", Abomination: "swamp", Bonemass: "swamp",
  Wolf: "mountain", Drake: "mountain", Fenring: "mountain", Cultist: "mountain", Bat: "mountain",
  "Stone Golem": "mountain", "Stone golem": "mountain", Ulv: "mountain", Moder: "mountain",
  Fuling: "plains", "Fuling berserker": "plains", "Fuling shaman": "plains", Deathsquito: "plains", Lox: "plains",
  Growth: "plains", Vile: "plains", Yagluth: "plains",
  Seeker: "mistlands", "Seeker soldier": "mistlands", "Seeker brood": "mistlands", Gjall: "mistlands", Tick: "mistlands",
  Dvergr: "mistlands", Hare: "mistlands", "The Queen": "mistlands",
  Charred: "ashlands", "Charred warrior": "ashlands", "Charred marksman": "ashlands", "Charred twitcher": "ashlands",
  Morgen: "ashlands", Fallen: "ashlands", Volture: "ashlands", Asksvin: "ashlands", Skugg: "ashlands", Fader: "ashlands",
  Serpent: "ocean", Leviathan: "ocean"
};
export const mobBiome = (name) => MOB_BIOME[name];
