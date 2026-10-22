/*
 * Mock snapshot for the Longhouse design preview.
 *
 * In a real deployment the collector writes this same shape to
 * /api/snapshot.json and the dashboard fetches it. Every name, number and
 * server below is made up.
 */
window.LONGHOUSE_MOCK = {
  schema: 1,
  generatedAt: new Date(Date.now() - 12 * 1000).toISOString(),

  server: {
    name: "Odin's Rest",
    world: "Midgard",
    online: true,
    version: "0.220.5",
    crossplay: false,
    players: { online: 4, max: 10 },
    uptimeSeconds: 6 * 86400 + 14 * 3600 + 22 * 60,
    pingMs: 38,
    worldDay: 412,
    timeOfDay: "Evening",
    weather: "Mist",
    nextSaveMinutes: 11,
    address: null // hidden: shared privately with the group
  },

  bosses: [
    { id: "eikthyr", name: "Eikthyr", biome: "meadows", defeated: true, day: 9, by: ["Astrid", "Bjorn"] },
    { id: "elder", name: "The Elder", biome: "blackforest", defeated: true, day: 41, by: ["Astrid", "Bjorn", "Leif"] },
    { id: "bonemass", name: "Bonemass", biome: "swamp", defeated: true, day: 118, by: ["Bjorn", "Sigrid", "Leif"] },
    { id: "moder", name: "Moder", biome: "mountain", defeated: true, day: 179, by: ["Astrid", "Sigrid"] },
    { id: "yagluth", name: "Yagluth", biome: "plains", defeated: true, day: 254, by: ["Astrid", "Bjorn", "Sigrid", "Leif"] },
    { id: "queen", name: "The Queen", biome: "mistlands", defeated: false, day: null, by: [] },
    { id: "fader", name: "Fader", biome: "ashlands", defeated: false, day: null, by: [] }
  ],

  week: { playtimeHours: 61.5, kills: 1284, deaths: 23, built: 916, deltas: { playtimeHours: 12, kills: 8, deaths: -31, built: 44 } },

  players: [
    {
      id: "p1", name: "Astrid", online: true, biome: "mistlands", location: "Dvergr outpost, NE of base",
      appearance: { model: 1, skin: "#f0c4a3", hair: "#d9b26a", hairStyle: "braids", beard: "none" },
      sessionMinutes: 132, lastSeen: null, title: "Shield-maiden",
      vitals: { hp: [198, 232], stamina: [141, 166], eitr: [40, 64] },
      rested: true, comfort: 17,
      foods: [
        { name: "Seeker aspic", minutesLeft: 31, total: 45, kind: "eitr" },
        { name: "Misthare supreme", minutesLeft: 18, total: 45, kind: "hp" },
        { name: "Yggdrasil porridge", minutesLeft: 40, total: 45, kind: "eitr" }
      ],
      equipment: {
        head: { name: "Carapace helmet", q: 3 },
        chest: { name: "Carapace breastplate", q: 3 },
        legs: { name: "Carapace greaves", q: 3 },
        cape: { name: "Feather cape", q: 2 },
        weapon: { name: "Mistwalker", q: 3 },
        offhand: { name: "Carapace buckler", q: 2 },
        utility: { name: "Megingjord", q: 1 }
      },
      skills: [["Swords", 74], ["Blocking", 68], ["Run", 61], ["Jump", 55], ["Elemental magic", 22]],
      stats: { kills: 4812, deaths: 37, built: 2140, crafted: 611, distanceKm: 1180, jumps: 52130, playtimeHours: 342, bossKills: 5 },
      topKill: "Greydwarf", favoriteFood: "Lox meat pie"
    },
    {
      id: "p2", name: "Bjorn", online: true, biome: "plains", location: "Lox farm",
      appearance: { model: 0, skin: "#e2a77f", hair: "#8a4b22", hairStyle: "short", beard: "long" },
      sessionMinutes: 87, lastSeen: null, title: "Master builder",
      vitals: { hp: [151, 186], stamina: [118, 152], eitr: [0, 0] },
      rested: true, comfort: 15,
      foods: [
        { name: "Lox meat pie", minutesLeft: 22, total: 40, kind: "hp" },
        { name: "Blood pudding", minutesLeft: 9, total: 40, kind: "stamina" },
        { name: "Bread", minutesLeft: 27, total: 40, kind: "stamina" }
      ],
      equipment: {
        head: { name: "Padded helmet", q: 4 },
        chest: { name: "Padded cuirass", q: 4 },
        legs: { name: "Padded greaves", q: 4 },
        cape: { name: "Lox cape", q: 3 },
        weapon: { name: "Porcupine", q: 3 },
        offhand: { name: "Blackmetal shield", q: 3 },
        utility: { name: "Wishbone", q: 1 }
      },
      skills: [["Clubs", 71], ["Wood cutting", 69], ["Farming", 57], ["Blocking", 52], ["Crafting", 44]],
      stats: { kills: 3355, deaths: 48, built: 9874, crafted: 1288, distanceKm: 860, jumps: 18440, playtimeHours: 311, bossKills: 4 },
      topKill: "Deathsquito", favoriteFood: "Bread"
    },
    {
      id: "p3", name: "Leif", online: true, biome: "ocean", location: "Sailing the longship",
      appearance: { model: 0, skin: "#c98d63", hair: "#2e2a26", hairStyle: "long", beard: "braided" },
      sessionMinutes: 41, lastSeen: null, title: "Wanderer",
      vitals: { hp: [128, 170], stamina: [160, 171], eitr: [0, 0] },
      rested: false, comfort: 0,
      foods: [
        { name: "Fish wraps", minutesLeft: 34, total: 45, kind: "hp" },
        { name: "Serpent stew", minutesLeft: 12, total: 45, kind: "hp" },
        { name: "Cooked lox meat", minutesLeft: 3, total: 40, kind: "hp" }
      ],
      equipment: {
        head: { name: "Wolf fur hood", q: 2 },
        chest: { name: "Wolf armor chest", q: 3 },
        legs: { name: "Wolf armor legs", q: 3 },
        cape: { name: "Wolf fur cape", q: 2 },
        weapon: { name: "Draugr Fang", q: 3 },
        offhand: null,
        utility: null
      },
      skills: [["Bows", 81], ["Swim", 66], ["Fishing", 49], ["Sneak", 45], ["Run", 44]],
      stats: { kills: 2207, deaths: 71, built: 380, crafted: 297, distanceKm: 2415, jumps: 30812, playtimeHours: 267, bossKills: 3 },
      topKill: "Neck", favoriteFood: "Serpent stew"
    },
    {
      id: "p4", name: "Sigrid", online: true, biome: "mountain", location: "Silver mine, east peak",
      appearance: { model: 1, skin: "#f3cfb3", hair: "#b8422a", hairStyle: "ponytail", beard: "none" },
      sessionMinutes: 18, lastSeen: null, title: "Smith",
      vitals: { hp: [176, 204], stamina: [97, 131], eitr: [0, 0] },
      rested: true, comfort: 12,
      foods: [
        { name: "Wolf skewer", minutesLeft: 26, total: 30, kind: "hp" },
        { name: "Onion soup", minutesLeft: 28, total: 30, kind: "hp" },
        { name: "Eyescream", minutesLeft: 25, total: 30, kind: "stamina" }
      ],
      equipment: {
        head: { name: "Drake helmet", q: 3 },
        chest: { name: "Wolf armor chest", q: 4 },
        legs: { name: "Wolf armor legs", q: 4 },
        cape: { name: "Wolf fur cape", q: 3 },
        weapon: { name: "Frostner", q: 4 },
        offhand: { name: "Serpent scale shield", q: 3 },
        utility: null
      },
      skills: [["Pickaxes", 77], ["Clubs", 62], ["Crafting", 58], ["Blocking", 47], ["Cooking", 41]],
      stats: { kills: 2690, deaths: 29, built: 1612, crafted: 2034, distanceKm: 640, jumps: 9210, playtimeHours: 228, bossKills: 4 },
      topKill: "Drake", favoriteFood: "Onion soup"
    },
    {
      id: "p5", name: "Ulf", online: false, biome: "swamp", location: "Last seen near Sunken crypt",
      appearance: { model: 0, skin: "#d9a07a", hair: "#8a8783", hairStyle: "bald", beard: "long" },
      sessionMinutes: 0, lastSeen: new Date(Date.now() - 3 * 3600 * 1000).toISOString(), title: "Crypt diver",
      vitals: { hp: [0, 160], stamina: [0, 130], eitr: [0, 0] },
      rested: false, comfort: 0,
      foods: [],
      equipment: {
        head: { name: "Iron helmet", q: 3 },
        chest: { name: "Iron scale mail", q: 3 },
        legs: { name: "Iron greaves", q: 3 },
        cape: { name: "Troll hide cape", q: 2 },
        weapon: { name: "Iron mace", q: 3 },
        offhand: { name: "Banded shield", q: 2 },
        utility: null
      },
      skills: [["Clubs", 49], ["Pickaxes", 38], ["Blocking", 35], ["Swim", 30], ["Run", 28]],
      stats: { kills: 1104, deaths: 94, built: 210, crafted: 160, distanceKm: 410, jumps: 12002, playtimeHours: 96, bossKills: 2 },
      topKill: "Draugr", favoriteFood: "Turnip stew"
    },
    {
      id: "p6", name: "Ingrid", online: false, biome: "meadows", location: "Last seen at main base",
      appearance: { model: 1, skin: "#b9784f", hair: "#1f1a17", hairStyle: "long", beard: "none" },
      sessionMinutes: 0, lastSeen: new Date(Date.now() - 2 * 86400 * 1000).toISOString(), title: "Hearth keeper",
      vitals: { hp: [0, 140], stamina: [0, 120], eitr: [0, 0] },
      rested: false, comfort: 0,
      foods: [],
      equipment: {
        head: null,
        chest: { name: "Bronze plate cuirass", q: 2 },
        legs: { name: "Bronze plate leggings", q: 2 },
        cape: { name: "Deer hide cape", q: 1 },
        weapon: { name: "Bronze atgeir", q: 2 },
        offhand: null,
        utility: null
      },
      skills: [["Cooking", 64], ["Farming", 59], ["Polearms", 31], ["Fishing", 27], ["Crafting", 25]],
      stats: { kills: 412, deaths: 18, built: 3420, crafted: 980, distanceKm: 155, jumps: 3290, playtimeHours: 74, bossKills: 1 },
      topKill: "Boar", favoriteFood: "Queens jam"
    }
  ],

  foods: [
    ["Lox meat pie", 812], ["Bread", 774], ["Serpent stew", 621], ["Blood pudding", 598],
    ["Fish wraps", 455], ["Onion soup", 402], ["Misthare supreme", 288], ["Seeker aspic", 241],
    ["Wolf skewer", 233], ["Turnip stew", 190], ["Queens jam", 176], ["Sausages", 151]
  ],

  materials: [
    ["Wood", 48210, "meadows"], ["Stone", 31455, "meadows"], ["Fine wood", 12880, "blackforest"],
    ["Core wood", 9214, "blackforest"], ["Iron", 3412, "swamp"], ["Black metal", 2280, "plains"],
    ["Silver", 1966, "mountain"], ["Copper", 1840, "blackforest"], ["Yggdrasil wood", 1405, "mistlands"],
    ["Black marble", 1288, "mistlands"], ["Tin", 920, "blackforest"], ["Flametal", 0, "ashlands"]
  ],

  mobs: [
    ["Greydwarf", 3104, "blackforest"], ["Neck", 1540, "meadows"], ["Draugr", 1288, "swamp"],
    ["Deathsquito", 1066, "plains"], ["Fuling", 980, "plains"], ["Skeleton", 902, "blackforest"],
    ["Wolf", 811, "mountain"], ["Seeker", 744, "mistlands"], ["Blob", 690, "swamp"],
    ["Drake", 512, "mountain"], ["Boar", 498, "meadows"], ["Leech", 455, "swamp"],
    ["Lox", 312, "plains"], ["Troll", 141, "blackforest"], ["Fenring", 96, "mountain"],
    ["Gjall", 38, "mistlands"], ["Serpent", 27, "ocean"], ["Stone golem", 22, "mountain"]
  ],

  /* average players online, 7 days × 24 hours (Mon..Sun, 00..23 local) */
  heatmap: [
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,2,3,3,2,1],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,2,2,2,3,1,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,2,3,4,3,2,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,2,3,3,3,2,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,2,3,4,5,5,4,3],
    [2,2,1,0,0,0,0,0,0,1,2,3,3,3,4,4,4,4,5,5,6,5,4,3],
    [2,1,1,0,0,0,0,0,0,1,1,2,3,3,3,3,4,4,4,3,3,2,1,0]
  ],

  activity: [
    { m: 1, type: "kill", text: "**Astrid** took down a **Seeker soldier** in the Mistlands" },
    { m: 6, type: "join", text: "**Sigrid** joined the server" },
    { m: 14, type: "craft", text: "**Sigrid** upgraded **Frostner** to ★4" },
    { m: 22, type: "death", text: "**Leif** died to a **Serpent** at sea (the boat survived)" },
    { m: 41, type: "join", text: "**Leif** joined the server" },
    { m: 58, type: "build", text: "**Bjorn** placed 140 pieces on the new Plains longhouse" },
    { m: 94, type: "event", text: "Raid: **The ground is shaking** hit the Plains base and got pushed back" },
    { m: 180, type: "leave", text: "**Ulf** left after a 2h 10m session" },
    { m: 1440 * 3, type: "boss", text: "**Yagluth** was defeated by Astrid, Bjorn, Sigrid & Leif" }
  ]
};
