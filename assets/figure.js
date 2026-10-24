/* Character figures.
 * Draws a flat SVG "paper doll" from a player's appearance (body type, skin, hair,
 * beard) and equipped gear. Valheim's own models are game assets and can't be
 * redistributed, so this is an original illustration driven by the same data. */
(function () {
  "use strict";

  const DEFAULT_LOOK = { model: 0, skin: "#d9a989", hair: "#5b4636", hairStyle: "short", beard: "short" };
  const UNKNOWN_LOOK = { model: 0, skin: "#c9c6bf", hair: "#a9a59c", hairStyle: "short", beard: "none" };

  // armor sets, matched by keyword in the item name: [main, accent]
  const MATERIALS = [
    ["carapace", "#2e3b4f", "#6f93bd"], ["padded", "#5d6570", "#a3acb6"], ["fenris", "#3f3d46", "#8c8794"],
    ["wolf", "#d8d4cb", "#8f897e"], ["drake", "#e4e0d6", "#9a9284"], ["blackmetal", "#2c3034", "#6c757e"],
    ["iron", "#7a838d", "#b9c0c8"], ["bronze", "#a5733a", "#d8a965"], ["troll", "#3c5a6a", "#6f909f"],
    ["root", "#6b5a3a", "#9c8758"], ["flametal", "#5a2e2a", "#e0703a"], ["ask", "#5e3a2e", "#b06a4c"],
    ["leather", "#8a6a4a", "#b48f69"], ["rag", "#9d8f78", "#c2b59c"]
  ];
  const CAPES = [
    ["feather", "#eceaf3"], ["lox", "#8b6a45"], ["wolf", "#e2dfd8"], ["deer", "#a07a52"],
    ["troll", "#3e6a7a"], ["linen", "#d8c9a8"], ["asksvin", "#7a2f2a"], ["ash", "#5b5560"]
  ];
  const SHIELDS = [
    ["serpent", "#3f6f6a", "kite"], ["blackmetal", "#2b2f33", "round"], ["carapace", "#2e3b4f", "buckler"],
    ["banded", "#8a6a45", "round"], ["bronze", "#a5733a", "buckler"], ["iron", "#7a838d", "round"],
    ["wood", "#8a6a45", "round"], ["flametal", "#5a2e2a", "round"]
  ];

  const pick = (list, name) => {
    const n = (name || "").toLowerCase();
    return list.find(([k]) => n.includes(k));
  };
  const shade = (hex, amt) => {
    const n = parseInt(hex.slice(1), 16);
    const c = (v) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
    return "#" + [c(n >> 16), c((n >> 8) & 255), c(n & 255)].map((v) => v.toString(16).padStart(2, "0")).join("");
  };

  function weaponKind(name) {
    const n = (name || "").toLowerCase();
    if (/bow|fang|spinesnap|crossbow|arbalest/.test(n)) return "bow";
    if (/atgeir|spear|halberd/.test(n)) return "polearm";
    if (/mace|frostner|porcupine|club|sledge|demolisher|hammer/.test(n)) return "mace";
    if (/axe|jotun|himminafl|battleaxe/.test(n)) return "axe";
    if (/staff/.test(n)) return "staff";
    return "sword";
  }

  function helmetKind(name) {
    const n = (name || "").toLowerCase();
    if (/drake/.test(n)) return "horned";
    if (/hood|fur|troll|leather|rag/.test(n)) return "hood";
    return "dome";
  }

  /* ---------- parts ---------- */

  function hairBack(look) {
    const h = look.hair;
    if (look.hairStyle === "long") return `<path d="M79 52 Q76 96 84 112 L116 112 Q124 96 121 52 Z" fill="${shade(h, -0.06)}"/>`;
    if (look.hairStyle === "ponytail") return `<path d="M112 48 Q132 60 124 104 Q118 92 110 60 Z" fill="${shade(h, -0.06)}"/>`;
    return "";
  }

  function hairFront(look, capped) {
    const h = look.hair;
    if (look.hairStyle === "bald") return capped ? "" : `<path d="M80 62 Q79 54 82 50 L84 64 Z M120 62 Q121 54 118 50 L116 64 Z" fill="${h}"/>`;
    // under a helmet only the strands that hang below it are drawn
    const cap = capped ? "" : `<path d="M79 62 Q76 33 100 33 Q124 33 121 62 Q117 46 100 44 Q83 46 79 62 Z" fill="${h}"/>`;
    if (look.hairStyle === "braids") {
      const braid = (x) => [92, 102, 112, 122].map((y, i) => `<ellipse cx="${x}" cy="${y}" rx="${4.4 - i * 0.4}" ry="6" fill="${i % 2 ? shade(h, -0.08) : h}"/>`).join("");
      return cap + braid(81) + braid(119);
    }
    if (look.hairStyle === "long") return cap + `<path d="M79 60 Q77 80 82 96 L86 96 Q83 78 84 60 Z M121 60 Q123 80 118 96 L114 96 Q117 78 116 60 Z" fill="${h}"/>`;
    return cap;
  }

  function beard(look) {
    const h = look.hair;
    if (look.beard === "short") return `<path d="M82 64 Q84 86 100 90 Q116 86 118 64 Q112 74 100 75 Q88 74 82 64 Z" fill="${h}"/>`;
    if (look.beard === "long") return `<path d="M82 63 Q82 92 100 112 Q118 92 118 63 Q112 74 100 75 Q88 74 82 63 Z" fill="${h}"/><path d="M94 79 Q100 82 106 79" stroke="${shade(h, -0.15)}" stroke-width="1.5" fill="none"/>`;
    if (look.beard === "braided") return `<path d="M82 63 Q83 84 100 92 Q117 84 118 63 Q112 74 100 75 Q88 74 82 63 Z" fill="${h}"/>` +
      [94, 102, 110].map((y, i) => `<ellipse cx="94" cy="${y}" rx="${3.6 - i * 0.5}" ry="5" fill="${h}"/><ellipse cx="106" cy="${y}" rx="${3.6 - i * 0.5}" ry="5" fill="${h}"/>`).join("") +
      `<rect x="91" y="114" width="6" height="3" rx="1" fill="#c9a24a"/><rect x="103" y="114" width="6" height="3" rx="1" fill="#c9a24a"/>`;
    return `<path d="M94 74 Q100 77 106 74" stroke="${shade(look.skin, -0.3)}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  }

  function helmet(item) {
    if (!item) return "";
    const kind = helmetKind(item.name);
    const [, main, accent] = pick(MATERIALS, item.name) || [0, "#7a838d", "#b9c0c8"];
    if (kind === "hood") {
      return `<path d="M75 74 Q72 28 100 27 Q128 28 125 74 L118 74 Q119 44 100 42 Q81 44 82 74 Z" fill="${main}" stroke="${shade(main, -0.18)}" stroke-width="1"/>` +
        `<path d="M80 44 Q100 30 120 44" stroke="${accent}" stroke-width="2" fill="none" opacity=".6"/>`;
    }
    const dome = `<path d="M77 58 Q77 29 100 28 Q123 29 123 58 Z" fill="${main}" stroke="${shade(main, -0.2)}" stroke-width="1"/>` +
      `<rect x="76" y="53" width="48" height="7" rx="3" fill="${accent}"/>` +
      `<rect x="98" y="56" width="4" height="15" rx="2" fill="${accent}"/>`;
    if (kind === "horned") {
      const horn = "#efe9da";
      return `<path d="M81 46 Q62 42 58 18 Q70 34 86 38 Z" fill="${horn}" stroke="#bdb3a0" stroke-width="1"/>` +
        `<path d="M119 46 Q138 42 142 18 Q130 34 114 38 Z" fill="${horn}" stroke="#bdb3a0" stroke-width="1"/>` + dome;
    }
    return dome;
  }

  function weapon(item, hx, hy) {
    if (!item) return "";
    const kind = weaponKind(item.name);
    const n = item.name.toLowerCase();
    const wood = "#6b4a2b";
    if (kind === "bow") {
      return `<path d="M${hx + 3} ${hy - 76} Q${hx - 30} ${hy} ${hx + 3} ${hy + 76}" stroke="${n.includes("fang") ? "#3d4a3a" : wood}" stroke-width="4.5" fill="none" stroke-linecap="round"/>` +
        `<line x1="${hx + 3}" y1="${hy - 76}" x2="${hx + 3}" y2="${hy + 76}" stroke="#e8e4da" stroke-width="1"/>`;
    }
    if (kind === "polearm") {
      return `<line x1="${hx + 6}" y1="${hy + 80}" x2="${hx - 12}" y2="${hy - 104}" stroke="${wood}" stroke-width="3.5" stroke-linecap="round"/>` +
        `<path d="M${hx - 12} ${hy - 104} l-6 -22 l10 8 z" fill="#c8cfd6" stroke="#8d949c"/>`;
    }
    if (kind === "mace") {
      const head = n.includes("frost") ? "#a9dcf0" : n.includes("porcupine") ? "#5d6268" : "#8d949c";
      const spikes = n.includes("porcupine") ? [0, 60, 120, 180, 240, 300].map((a) => {
        const r = (a * Math.PI) / 180, cx = hx - 6, cy = hy - 70;
        return `<line x1="${cx}" y1="${cy}" x2="${cx + Math.cos(r) * 16}" y2="${cy + Math.sin(r) * 16}" stroke="${head}" stroke-width="2.5"/>`;
      }).join("") : "";
      return `<line x1="${hx}" y1="${hy + 10}" x2="${hx - 6}" y2="${hy - 62}" stroke="${wood}" stroke-width="4" stroke-linecap="round"/>` + spikes +
        `<circle cx="${hx - 6}" cy="${hy - 70}" r="11" fill="${head}" stroke="${shade(head, -0.25)}"/>` +
        (n.includes("frost") ? `<circle cx="${hx - 9}" cy="${hy - 73}" r="3" fill="#ffffff" opacity=".7"/>` : "");
    }
    if (kind === "axe") {
      return `<line x1="${hx}" y1="${hy + 10}" x2="${hx - 6}" y2="${hy - 70}" stroke="${wood}" stroke-width="4" stroke-linecap="round"/>` +
        `<path d="M${hx - 6} ${hy - 72} q-22 4 -20 24 q10 -8 22 -8 z" fill="#b9c0c8" stroke="#7a838d"/>`;
    }
    if (kind === "staff") {
      return `<line x1="${hx + 4}" y1="${hy + 80}" x2="${hx - 8}" y2="${hy - 96}" stroke="${wood}" stroke-width="4" stroke-linecap="round"/>` +
        `<circle cx="${hx - 8}" cy="${hy - 100}" r="7" fill="#9b8cf0" opacity=".9"/>`;
    }
    const blade = n.includes("mistwalker") ? "#a9c2ff" : n.includes("black") ? "#5a6168" : "#d3d9df";
    return `<path d="M${hx - 2} ${hy - 8} L${hx - 9} ${hy - 82} L${hx - 4} ${hy - 90} L${hx + 1} ${hy - 82} L${hx + 3} ${hy - 8} Z" fill="${blade}" stroke="${shade(blade, -0.3)}"/>` +
      `<rect x="${hx - 11}" y="${hy - 10}" width="18" height="4" rx="2" fill="#5b4636"/>` +
      (n.includes("mistwalker") ? `<path d="M${hx - 6} ${hy - 20} L${hx - 9} ${hy - 74}" stroke="#e6edff" stroke-width="1.2" opacity=".8"/>` : "");
  }

  function shield(item, hx, hy) {
    if (!item) return "";
    const [, color, shape] = pick(SHIELDS, item.name) || [0, "#8a6a45", "round"];
    const rim = shade(color, -0.2), boss = "#b9c0c8";
    if (shape === "kite") {
      return `<path d="M${hx} ${hy - 34} Q${hx + 24} ${hy - 30} ${hx + 22} ${hy - 4} Q${hx + 18} ${hy + 22} ${hx} ${hy + 40} Q${hx - 18} ${hy + 22} ${hx - 22} ${hy - 4} Q${hx - 24} ${hy - 30} ${hx} ${hy - 34} Z" fill="${color}" stroke="${rim}" stroke-width="3"/>` +
        `<path d="M${hx} ${hy - 26} L${hx} ${hy + 30}" stroke="${shade(color, 0.15)}" stroke-width="2"/>`;
    }
    const r = shape === "buckler" ? 17 : 25;
    return `<circle cx="${hx}" cy="${hy}" r="${r}" fill="${color}" stroke="${rim}" stroke-width="3"/>` +
      (shape === "round" && /banded|wood/.test(item.name.toLowerCase()) ? `<path d="M${hx - r + 3} ${hy} H${hx + r - 3} M${hx} ${hy - r + 3} V${hy + r - 3}" stroke="#7a838d" stroke-width="2.5"/>` : "") +
      `<circle cx="${hx}" cy="${hy}" r="5" fill="${boss}" stroke="${shade(boss, -0.3)}"/>`;
  }

  /* ---------- whole figure ---------- */

  function figure(player, opts = {}) {
    const eq = (player && player.equipment) || {};
    const look = (player && player.appearance) || (opts.unknown ? UNKNOWN_LOOK : DEFAULT_LOOK);
    const slim = look.model === 1;
    const sh = slim ? 29 : 34, waist = slim ? 19 : 22, hip = slim ? 22 : 24;
    const outline = "rgba(0,0,0,.14)";

    const chestMat = eq.chest ? pick(MATERIALS, eq.chest.name) : null;
    const legMat = eq.legs ? pick(MATERIALS, eq.legs.name) : null;
    const chest = chestMat ? chestMat[1] : opts.unknown ? "#b9b5ad" : "#9b8466";
    const chestAccent = chestMat ? chestMat[2] : shade(chest, 0.1);
    const legs = legMat ? legMat[1] : opts.unknown ? "#a9a59c" : "#6b5b4b";
    const capeHit = eq.cape ? pick(CAPES, eq.cape.name) : null;
    const cape = eq.cape ? (capeHit ? capeHit[1] : "#8b6a45") : null;
    const belt = eq.utility && /megingjord|belt/i.test(eq.utility.name);
    const leftHand = [100 - sh - 6.5, 172], rightHand = [100 + sh + 6.5, 172];

    const parts = [
      `<ellipse cx="100" cy="286" rx="50" ry="6" fill="rgba(0,0,0,.08)"/>`,
      cape ? `<path d="M${100 - sh + 4} 92 L${100 + sh - 4} 92 L${100 + sh + 16} 256 Q100 268 ${100 - sh - 16} 256 Z" fill="${cape}" stroke="${shade(cape, -0.15)}" stroke-width="1.2"/>` : "",
      hairBack(look),
      // legs + boots
      `<rect x="${100 - hip + 1}" y="166" width="${hip - 4}" height="98" rx="7" fill="${legs}" stroke="${outline}"/>`,
      `<rect x="103" y="166" width="${hip - 4}" height="98" rx="7" fill="${legs}" stroke="${outline}"/>`,
      `<rect x="${100 - hip - 1}" y="250" width="${hip}" height="24" rx="6" fill="#4a3a2c"/>`,
      `<rect x="101" y="250" width="${hip}" height="24" rx="6" fill="#4a3a2c"/>`,
      legMat ? `<rect x="${100 - hip + 3}" y="200" width="${hip - 8}" height="10" rx="4" fill="${legMat[2]}" opacity=".7"/><rect x="105" y="200" width="${hip - 8}" height="10" rx="4" fill="${legMat[2]}" opacity=".7"/>` : "",
      // torso
      `<path d="M${100 - sh} 98 Q${100 - sh - 1} 89 ${100 - sh + 9} 87 L${100 + sh - 9} 87 Q${100 + sh + 1} 89 ${100 + sh} 98 L${100 + waist} 174 L${100 - waist} 174 Z" fill="${chest}" stroke="${outline}"/>`,
      chestMat ? `<path d="M${100 - sh + 10} 104 Q100 120 ${100 + sh - 10} 104 L${100 + waist - 4} 150 Q100 160 ${100 - waist + 4} 150 Z" fill="${chestAccent}" opacity=".35"/>` : "",
      `<rect x="${100 - waist - 1}" y="162" width="${waist * 2 + 2}" height="${belt ? 13 : 9}" rx="3" fill="#3a2c20"/>`,
      belt ? `<rect x="91" y="162" width="18" height="13" rx="3" fill="#d4a72c" stroke="#9c7a1c"/>` : `<rect x="96" y="163" width="8" height="7" rx="2" fill="#b08d57"/>`,
      // arms
      `<rect x="${100 - sh - 14}" y="94" width="15" height="76" rx="7.5" fill="${shade(chest, -0.06)}" stroke="${outline}"/>`,
      `<rect x="${100 + sh - 1}" y="94" width="15" height="76" rx="7.5" fill="${shade(chest, -0.06)}" stroke="${outline}"/>`,
      chestMat ? `<circle cx="${100 - sh - 3}" cy="98" r="11" fill="${chestAccent}" stroke="${outline}"/><circle cx="${100 + sh + 3}" cy="98" r="11" fill="${chestAccent}" stroke="${outline}"/>` : "",
      weapon(eq.weapon, ...leftHand),
      `<circle cx="${leftHand[0]}" cy="${leftHand[1]}" r="7.5" fill="${look.skin}" stroke="${outline}"/>`,
      `<circle cx="${rightHand[0]}" cy="${rightHand[1]}" r="7.5" fill="${look.skin}" stroke="${outline}"/>`,
      shield(eq.offhand, rightHand[0] + 4, rightHand[1] - 12),
      // head
      `<rect x="92" y="74" width="16" height="16" rx="4" fill="${shade(look.skin, -0.06)}"/>`,
      `<ellipse cx="100" cy="60" rx="19" ry="22" fill="${look.skin}" stroke="${outline}"/>`,
      `<circle cx="93" cy="61" r="2.1" fill="#2a2320"/><circle cx="107" cy="61" r="2.1" fill="#2a2320"/>`,
      `<path d="M89 55 Q93 53 96 55 M104 55 Q107 53 111 55" stroke="${shade(look.hair, -0.1)}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
      beard(look),
      hairFront(look, !!eq.head),
      helmet(eq.head)
    ];

    const vb = opts.portrait ? "70 22 60 60" : "0 0 200 300";
    const label = opts.label || (player ? `${player.name}'s character` : "Character");
    return `<svg class="${opts.className || "figure"}" viewBox="${vb}" role="img" aria-label="${label.replace(/"/g, "&quot;")}" xmlns="http://www.w3.org/2000/svg">${parts.join("")}</svg>`;
  }

  window.LonghouseFigure = {
    render: figure,
    // shared with the 3D voxel figure (voxel.js) so both read gear the same way
    looks: { DEFAULT_LOOK, UNKNOWN_LOOK },
    palette: { MATERIALS, CAPES, SHIELDS, pick, shade, weaponKind, helmetKind }
  };
})();
