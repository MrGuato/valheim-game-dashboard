// Turns what the Longhouse mods report (see mods/) into the shapes the dashboard draws.
// Tier 1 lines come from the server plugin; Tier 2 payloads are written by players' own
// clients, so everything from them is treated as untrusted: type-checked, clamped and capped.

const BIOMES = new Set(["meadows", "blackforest", "swamp", "mountain", "plains", "mistlands", "ashlands", "deepnorth", "ocean"]);
const SLOTS = ["head", "chest", "legs", "cape", "weapon", "offhand", "utility"];
const MAX_LIST = 40;

const str = (v, max = 60) => (typeof v === "string" ? v.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, max) : null);
const num = (v, max = 1e9) => (typeof v === "number" && Number.isFinite(v) ? Math.min(Math.max(v, 0), max) : 0);
const pair = (v, max) => (Array.isArray(v) && v.length === 2 ? [Math.round(num(v[0], max)), Math.round(num(v[1], max))] : null);

// ---- Tier 1: server plugin

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

// ---- Tier 2: companion mod

const pairs = (v, maxCount = 1e9) =>
  Array.isArray(v)
    ? v.filter((r) => Array.isArray(r) && str(r[0]) && typeof r[1] === "number").slice(0, MAX_LIST).map((r) => [str(r[0]), Math.round(num(r[1], maxCount))])
    : [];

export function decodeCompanion(b64) {
  if (typeof b64 !== "string" || b64.length > 70000) return null;
  let raw;
  try {
    raw = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object" || raw.v !== 1) return null;
  const s = raw.stats && typeof raw.stats === "object" ? raw.stats : {};
  const v = raw.vitals && typeof raw.vitals === "object" ? raw.vitals : {};
  return {
    mod: str(raw.mod, 20),
    vitals: { hp: pair(v.hp, 10000), stamina: pair(v.stamina, 10000), eitr: pair(v.eitr, 10000) },
    rested: raw.rested === true,
    comfort: Math.round(num(raw.comfort, 100)),
    foods: Array.isArray(raw.foods)
      ? raw.foods.slice(0, 5).filter((f) => f && str(f.name)).map((f) => ({
          name: str(f.name),
          minutesLeft: Math.round(num(f.minutesLeft, 600)),
          total: Math.round(num(f.total, 600)),
          kind: ["hp", "stamina", "eitr"].includes(f.kind) ? f.kind : "hp"
        }))
      : [],
    skills: pairs(raw.skills, 100),
    stats: Object.fromEntries(
      ["kills", "bossKills", "deaths", "built", "crafted", "jumps", "distanceKm", "treesChopped", "fishCaught"].map((k) => [k, num(s[k])])
    ),
    mobs: pairs(raw.mobs),
    foodsEaten: pairs(raw.foodsEaten),
    materials: pairs(raw.materials)
  };
}

// Which biome a creature or material belongs to, for the colored dots and the filter.
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
const MATERIAL_BIOME = {
  Wood: "meadows", Stone: "meadows", Flint: "meadows", Resin: "meadows", "Leather scraps": "meadows", Feathers: "meadows",
  "Fine wood": "blackforest", "Core wood": "blackforest", Copper: "blackforest", "Copper ore": "blackforest",
  Tin: "blackforest", "Tin ore": "blackforest", "Greydwarf eye": "blackforest",
  Iron: "swamp", "Scrap iron": "swamp", "Ancient bark": "swamp", Guck: "swamp", Chitin: "ocean",
  Silver: "mountain", "Silver ore": "mountain", Obsidian: "mountain", Crystal: "mountain", "Wolf pelt": "mountain",
  "Black metal": "plains", "Black metal scrap": "plains", Flax: "plains", Barley: "plains", Tar: "plains",
  "Yggdrasil wood": "mistlands", "Black marble": "mistlands", Sap: "mistlands", "Black core": "mistlands",
  Flametal: "ashlands", "Flametal ore": "ashlands", Ashwood: "ashlands", Grausten: "ashlands"
};
export const mobBiome = (name) => MOB_BIOME[name];
export const materialBiome = (name) => MATERIAL_BIOME[name];
