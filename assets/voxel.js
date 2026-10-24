/* 3D voxel character figures.
 * Builds a pixel-art style Viking out of voxels from the same appearance and gear
 * data the flat SVG figure uses, and draws it with plain WebGL (no libraries).
 * Faces get baked ambient occlusion and a thin edge line, which is what makes
 * voxel art read as voxel art. Drag to turn it.
 * Without WebGL the SVG figure from figure.js stays in place. */
(function () {
  "use strict";

  const SPIN = 0.3;        // idle spin, radians per second
  const CENTER_Y = 31;     // voxel height the camera looks at
  const DISTANCE = 127;
  const FOV = (30 * Math.PI) / 180;

  const BIOME_GROUND = {
    meadows: "#6f8f3f", blackforest: "#3f5a3a", swamp: "#5a5f3b", mountain: "#dfe4e9", plains: "#c6ae66",
    mistlands: "#7f8591", ashlands: "#6a3a30", ocean: "#3b6a8a", deepnorth: "#cfe0ec"
  };

  /* ---------- color helpers ---------- */

  function rgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  function hex(c) {
    return "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, "0")).join("");
  }
  function mix(a, b, t) {
    const pa = rgb(a), pb = rgb(b);
    return hex(pa.map((v, i) => v + (pb[i] - v) * t));
  }
  // small fixed per-voxel brightness jitter, the "pixel texture"
  function jitter(x, y, z) {
    let h = (x * 73856093) ^ (y * 19349663) ^ (z * 83492791);
    h = (h ^ (h >>> 13)) * 1274126177;
    return 1 + (((h >>> 0) % 1000) / 1000 - 0.5) * 0.06;
  }

  /* ---------- model ---------- */

  function buildModel(player, opts) {
    const F = window.LonghouseFigure;
    const { MATERIALS, CAPES, SHIELDS, pick, shade, weaponKind, helmetKind } = F.palette;
    const eq = (player && player.equipment) || {};
    const look = (player && player.appearance) || (opts.unknown ? F.looks.UNKNOWN_LOOK : F.looks.DEFAULT_LOOK);

    const vox = new Map();
    const set = (x, y, z, c) => vox.set(x + "," + y + "," + z, [x, y, z, c]);
    const box = (x0, x1, y0, y1, z0, z1, c) => {
      if (x0 > x1) [x0, x1] = [x1, x0];
      if (y0 > y1) [y0, y1] = [y1, y0];
      if (z0 > z1) [z0, z1] = [z1, z0];
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) set(x, y, z, c);
    };
    const both = (fn) => { fn(1); fn(-1); };     // mirror across x
    const stripe = (c, i, amt = 0.07) => (i % 2 ? shade(c, -amt) : c);

    const slim = look.model === 1;
    const hw = slim ? 6 : 7;                     // torso half-width
    const aw = slim ? 3 : 4;                     // arm width
    const lw = slim ? 5 : 6;                     // leg width
    const skin = look.skin, hair = look.hair, hairDark = shade(hair, -0.09);
    const chestMat = eq.chest ? pick(MATERIALS, eq.chest.name) : null;
    const legMat = eq.legs ? pick(MATERIALS, eq.legs.name) : null;
    const chest = chestMat ? chestMat[1] : opts.unknown ? "#b9b5ad" : "#9b8466";
    const chestAccent = chestMat ? chestMat[2] : shade(chest, 0.12);
    const legs = legMat ? legMat[1] : opts.unknown ? "#a9a59c" : "#6b5b4b";
    const boots = legMat ? mix(legMat[1], "#3a2c20", 0.6) : "#4a3a2c";
    const gold = "#c9a24a", steel = "#c8cfd6", steelDark = "#8d949c", wood = "#6b4a2b";

    // ground: a stone disc tinted by where the player is, with a shadow under the feet
    const ground = BIOME_GROUND[player && player.biome] || "#6e6962";
    const rim = shade(ground, -0.22);
    for (let x = -14; x <= 14; x++) for (let z = -14; z <= 14; z++) {
      const r = Math.hypot(x, z);
      if (r > 14.3) continue;
      const top = r > 12.6 ? rim : r < 7.5 ? shade(ground, -0.14 * (1 - r / 7.5)) : ground;
      set(x, -1, z, top);
      set(x, -2, z, shade(rim, -0.08));
    }

    // legs, knees, boots
    both((s) => {
      box(s * 1, s * lw, 6, 23, -3, 2, legs);
      box(s * 1, s * lw, 17, 23, 3, 3, legs);
      box(s * 1, s * lw, 7, 7, -3, 2, shade(legs, -0.05));
      if (legMat) box(s * 2, s * (lw - 1), 10, 13, 3, 3, mix(legMat[1], legMat[2], 0.5));
      box(s * 1, s * (lw + 1), 0, 5, -4, 3, boots);
      box(s * 2, s * lw, 0, 2, 4, 4, boots);
      box(s * 1, s * (lw + 1), 5, 5, -4, 3, shade(boots, 0.1));
      box(s * 1, s * (lw + 1), 0, 0, -4, 3, shade(boots, -0.12));
    });
    box(-1, 1, 17, 23, -3, 2, legs);

    // belt and buckle
    const megingjord = eq.utility && /megingjord|belt/i.test(eq.utility.name);
    const belt = megingjord ? "#6b4a22" : "#3a2c20";
    box(-hw, hw, 24, megingjord ? 27 : 26, -3, 3, belt);
    if (megingjord) { box(-2, 2, 24, 27, 4, 4, gold); box(-1, 1, 25, 26, 4, 4, shade(gold, 0.18)); }
    else box(-1, 1, 25, 25, 4, 4, "#b08d57");

    // torso: waist a little narrower than the chest, shoulders rounded off
    box(-(hw - 1), hw - 1, 27, 33, -3, 3, chest);
    box(-hw, hw, 34, 46, -3, 3, chest);
    box(-(hw - 1), hw - 1, 47, 47, -3, 3, chest);
    if (chestMat) {
      const plate = mix(chestMat[1], chestMat[2], 0.3);
      box(-(hw - 2), hw - 2, 35, 45, 4, 4, plate);
      box(0, 0, 36, 44, 4, 4, chestAccent);
      box(-(hw - 2), hw - 2, 35, 35, 4, 4, chestAccent);
      box(-(hw - 2), hw - 2, 45, 45, 4, 4, chestAccent);
      box(-(hw - 2), hw - 2, 35, 45, -4, -4, shade(plate, -0.08));
      both((s) => {                                               // pauldrons
        box(s * (hw - 1), s * (hw + aw), 45, 47, -3, 3, chestAccent);
        box(s * (hw - 1), s * (hw + aw - 1), 48, 48, -2, 2, chestAccent);
        box(s * (hw + aw), s * (hw + aw), 44, 44, -2, 2, shade(chestAccent, -0.1));
      });
    } else {
      box(-2, 2, 47, 47, 3, 3, shade(chest, -0.14));              // tunic collar
      box(-1, 1, 46, 46, 3, 3, shade(chest, -0.14));
      set(0, 45, 3, shade(chest, -0.14));
      box(-(hw - 1), hw - 1, 28, 28, -3, 3, shade(chest, -0.06));
    }

    // arms: sleeve, bracer, hand
    const sleeve = shade(chest, -0.06);
    const glove = chestMat ? "#5a4636" : skin;
    both((s) => {
      box(s * (hw + 1), s * (hw + aw), 36, 46, -2, 3, sleeve);
      box(s * (hw + 1), s * (hw + aw), 28, 35, -2, 3, chestMat ? mix(chestMat[1], chestMat[2], 0.2) : sleeve);
      box(s * (hw + 1), s * (hw + aw), 22, 27, -2, 3, glove);
      box(s * (hw + 1), s * (hw + aw), 27, 27, -2, 3, shade(glove, -0.1));
    });

    // neck and head, with the corners knocked off so it reads round
    box(-2, 2, 48, 49, -2, 2, shade(skin, -0.08));
    const bald = look.hairStyle === "bald";
    for (let x = -4; x <= 4; x++) for (let y = 50; y <= 61; y++) for (let z = -4; z <= 4; z++) {
      const ax = Math.abs(x), az = Math.abs(z);
      if (ax === 4 && az === 4) continue;
      if ((y === 50 || y === 61) && (ax === 4 || az === 4)) continue;
      set(x, y, z, y === 61 && !bald ? hair : skin);
    }
    // face (front is +z)
    both((s) => {
      set(s * 3, 56, 4, "#f2efe8"); set(s * 2, 56, 4, "#2a2320");
      box(s * 2, s * 3, 58, 58, 4, 4, hairDark);
      box(s * 5, s * 5, 54, 56, -1, 0, shade(skin, -0.05));
    });
    box(0, 0, 54, 55, 5, 5, shade(skin, -0.1));
    box(-1, 1, 52, 52, 4, 4, shade(skin, -0.28));

    // hair: a shell around the top of the head, styles differ in how far it hangs
    const hairShell = (sideY, backY) => {
      for (let x = -5; x <= 5; x++) for (let y = Math.min(sideY, backY); y <= 62; y++) for (let z = -5; z <= 5; z++) {
        const ax = Math.abs(x), az = Math.abs(z), top = y === 62;
        if (!(ax === 5 || az === 5 || top)) continue;
        if (ax === 5 && az === 5) continue;
        if (top) { if (ax === 5 || az === 5 || (ax === 4 && az === 4)) continue; }
        else if (z === 5) { if (y < 59 || ax > 3) continue; }
        else if (z === -5) { if (y < backY) continue; }
        else if (y < sideY || (z >= 3 && y < 58)) continue;
        set(x, y, z, top || z === 5 ? hair : hairDark);
      }
    };
    if (bald) {
      both((s) => box(s * 5, s * 5, 52, 56, -4, 1, hairDark));
      box(-4, 4, 52, 56, -5, -5, hairDark);
    } else if (look.hairStyle === "long") {
      hairShell(50, 41);
      for (let y = 41; y <= 49; y++) box(-4, 4, y, y, -6, -6, stripe(hairDark, y, 0.05));
    } else if (look.hairStyle === "ponytail") {
      hairShell(55, 54);
      box(-1, 1, 56, 58, -6, -6, hair);
      for (let y = 43; y <= 55; y++) set(0, y, -6, stripe(hairDark, y, 0.05));
      box(-1, 1, 49, 54, -6, -6, hairDark);
      set(0, 42, -6, gold);
    } else if (look.hairStyle === "braids") {
      hairShell(55, 53);
      both((s) => {
        for (let y = 41; y <= 54; y++) set(s * 5, y, 2, stripe(hair, y, 0.1));
        set(s * 5, 40, 2, gold);
      });
    } else {
      hairShell(55, 53);
    }

    // beard sits one voxel proud of the jaw
    if (look.beard && look.beard !== "none") {
      box(-3, 3, 50, 53, 5, 5, hair);
      both((s) => box(s * 5, s * 5, 50, 54, 0, 4, hair));
      box(-3, 3, 49, 49, 1, 4, hair);
      box(-2, 2, 53, 53, 5, 5, hairDark);                           // moustache
      box(-1, 1, 52, 52, 5, 5, hairDark);
      if (look.beard === "short") box(-2, 2, 48, 48, 2, 4, hair);
      if (look.beard === "long") {
        for (let y = 40; y <= 48; y++) {
          const w = y >= 46 ? 3 : y >= 43 ? 2 : 1;
          box(-w, w, y, y, 4, y >= 44 ? 5 : 4, stripe(hair, y, 0.06));
        }
      }
      if (look.beard === "braided") {
        both((s) => { for (let y = 42; y <= 48; y++) set(s * 2, y, 5, stripe(hair, y, 0.1)); set(s * 2, 41, 5, gold); });
        box(-1, 1, 46, 48, 5, 5, hair);
      }
    }

    // cape hangs behind the back, widens toward the hem, folds every third column
    if (eq.cape) {
      const hit = pick(CAPES, eq.cape.name);
      const cape = hit ? hit[1] : "#8b6a45";
      const feather = /feather/i.test(eq.cape.name);
      for (let y = 8; y <= 47; y++) {
        const w = hw + Math.floor((47 - y) / 9);
        for (let x = -w; x <= w; x++) {
          if (y === 8 && (x & 1)) continue;
          let c = (x + 300) % 3 === 0 ? shade(cape, -0.07) : cape;
          if (feather && y < 16 && (x + y) % 2 === 0) c = "#b9b7c4";
          set(x, y, -4, c);
        }
      }
      box(-(hw - 2), hw - 2, 48, 48, -3, 3, shade(cape, -0.12));
      box(-1, 1, 46, 46, 4, 4, gold);
    }

    // helmets
    if (eq.head) {
      const kind = helmetKind(eq.head.name);
      const hit = pick(MATERIALS, eq.head.name) || [0, "#7a838d", "#b9c0c8"];
      const main = hit[1], accent = hit[2];
      const n = eq.head.name.toLowerCase();
      if (kind === "hood") {
        const fur = /fur|wolf|fenris/.test(n);
        for (let x = -5; x <= 5; x++) for (let y = 48; y <= 63; y++) for (let z = -5; z <= 5; z++) {
          const ax = Math.abs(x), az = Math.abs(z), top = y === 63;
          if (!(ax === 5 || az === 5 || top)) continue;
          if (ax === 5 && az === 5) continue;
          if (top && (ax === 5 || az === 5 || (ax === 4 && az === 4))) continue;
          if (z === 5 && y >= 51 && y <= 58 && ax <= 3) continue;   // the face opening
          const edge = z === 5 && (y === 50 || y === 59 || ax === 4) && y >= 50 && y <= 59;
          const furTex = fur && (x + y + z) & 1 ? shade(main, -0.06) : main;
          set(x, y, z, edge && fur ? accent : top ? shade(main, 0.05) : furTex);
        }
        box(-hw, hw, 46, 48, -4, 4, shade(main, -0.08));               // drapes onto the shoulders
        box(-(hw - 2), hw - 2, 49, 49, -4, 4, main);
      } else {
        for (let x = -6; x <= 6; x++) for (let y = 56; y <= 66; y++) for (let z = -6; z <= 6; z++) {
          const d = (x / 6.3) ** 2 + ((y - 57) / 8.6) ** 2 + (z / 6.3) ** 2;
          const inner = (x / 5.3) ** 2 + ((y - 57) / 7.6) ** 2 + (z / 5.3) ** 2;
          if (d > 1 || inner <= 1) continue;
          let c = y <= 57 ? accent : (x + z) & 1 ? main : shade(main, 0.04);
          if (kind !== "horned" && /padded|carapace/.test(n) && (x === 0 || z === 0) && y > 57) c = accent;
          set(x, y, z, c);
        }
        box(0, 0, 52, 58, 5, 5, accent);                                 // nose guard
        if (/iron|bronze|blackmetal|flametal|root/.test(n)) both((s) => box(s * 5, s * 5, 51, 56, 0, 4, main));
        if (/carapace/.test(n)) for (let z = -3; z <= 2; z++) box(0, 0, 65 - Math.abs(z + 0.5) * 0.6 | 0, 66, z, z, accent);
        if (kind === "horned") {
          const horn = [[6, 58], [7, 59], [8, 60], [8, 61], [9, 62], [9, 63], [10, 64], [10, 65]];
          horn.forEach(([hx, hy], i) => both((s) => {
            const c = i > 5 ? "#bdb3a0" : "#efe9da";
            set(s * hx, hy, 0, c);
            if (i < 6) set(s * hx, hy, -1, shade(c, -0.08));
          }));
        }
      }
    }

    // weapon in the character's right hand (viewer's left), gripped in front of the fist
    if (eq.weapon) {
      const n = eq.weapon.name.toLowerCase();
      const kind = weaponKind(eq.weapon.name);
      const hx = -(hw + 2), z = 4;
      if (kind === "bow") {
        const limb = n.includes("fang") ? "#3d4a3a" : wood;
        for (let y = 10; y <= 52; y++) {
          const t = (y - 31) / 21;
          set(hx, y, z + Math.round(4 * (1 - t * t)), limb);
          set(hx, y, z, "#e8e4da");
        }
        box(hx, hx, 22, 27, z + 4, z + 4, shade(limb, -0.15));
      } else if (kind === "polearm") {
        for (let y = 2; y <= 54; y++) set(hx, y, z, stripe(wood, y >> 2, 0.05));
        box(hx, hx, 55, 62, z, z, steel);
        both((s) => { set(hx + s, 54, z, steelDark); set(hx + s, 55, z, steel); set(hx + s, 56, z, steel); });
        set(hx, 63, z, "#e6ebef");
      } else if (kind === "staff") {
        const orb = /ember|fire/.test(n) ? "#f08a3a" : /frost|ice/.test(n) ? "#9ad7f0" : /protect|shield/.test(n) ? "#f0d060" : "#9b8cf0";
        for (let y = 4; y <= 54; y++) set(hx, y, z, stripe(wood, y >> 2, 0.05));
        box(hx - 1, hx + 1, 55, 55, z, z, "#4a3a2c");
        box(hx - 2, hx + 2, 56, 60, z - 2, z + 2, orb);
        box(hx - 1, hx + 1, 57, 59, z - 1, z + 1, shade(orb, 0.2));
        set(hx - 1, 59, z + 2, "#ffffff");
      } else if (kind === "mace") {
        const head = n.includes("frost") ? "#a9dcf0" : n.includes("porcupine") ? "#5d6268" : steelDark;
        for (let y = 14; y <= 38; y++) set(hx, y, z, stripe(wood, y >> 1, 0.05));
        box(hx - 2, hx + 2, 39, 45, z - 1, z + 3, head);
        box(hx - 1, hx + 1, 40, 44, z - 1, z + 3, shade(head, 0.08));
        if (n.includes("porcupine")) [[-3, 0, 0], [3, 0, 0], [0, 4, 0], [0, 0, -3], [0, 0, 3], [-3, 3, 0], [3, 3, 0]]
          .forEach(([dx, dy, dz]) => set(hx + dx, 42 + dy, z + 1 + dz, shade(head, -0.1)));
        if (n.includes("frost")) { set(hx - 1, 44, z + 3, "#ffffff"); set(hx + 1, 41, z + 3, "#e8f6fb"); }
        box(hx - 1, hx + 1, 13, 13, z, z, "#5b4636");
      } else if (kind === "axe") {
        for (let y = 14; y <= 46; y++) set(hx, y, z, stripe(wood, y >> 1, 0.05));
        const blade = (s) => {
          box(hx + s, hx + s, 37, 45, z, z, steel);
          box(hx + 2 * s, hx + 2 * s, 37, 45, z, z, steel);
          box(hx + 3 * s, hx + 3 * s, 38, 44, z, z, steel);
          box(hx + 4 * s, hx + 4 * s, 39, 43, z, z, "#e6ebef");
          box(hx + s, hx + 2 * s, 41, 41, z, z, shade(steel, -0.1));
        };
        blade(-1);
        if (/battleaxe|jotun|himminafl|krom/.test(n)) blade(1);
        box(hx - 1, hx + 1, 13, 13, z, z, "#5b4636");
      } else {
        const blade = n.includes("mistwalker") ? "#a9c2ff" : n.includes("black") ? "#5a6168" : "#d3d9df";
        for (let y = 20; y <= 25; y++) set(hx, y, z, stripe("#5b4636", y, 0.12));
        set(hx, 19, z, gold);
        box(hx - 2, hx + 2, 26, 26, z, z, steelDark);
        box(hx - 1, hx + 1, 27, 45, z, z, blade);
        box(hx, hx, 27, 46, z, z, shade(blade, 0.15));
        box(hx - 1, hx + 1, 46, 46, z, z, blade);
        set(hx, 47, z, blade); set(hx, 48, z, shade(blade, 0.15));
        if (n.includes("mistwalker")) for (let y = 29; y <= 44; y += 4) set(hx - 1, y, z, "#e6edff");
      }
    }

    // shield strapped to the left forearm, facing outward
    if (eq.offhand) {
      const hit = pick(SHIELDS, eq.offhand.name) || [0, "#8a6a45", "round"];
      const color = hit[1], shape = hit[2];
      const n = eq.offhand.name.toLowerCase();
      const rimC = /blackmetal/.test(n) ? "#9aa1a9" : shade(color, -0.2);
      const sx = hw + aw + 1, cy = 34;
      const banded = /banded/.test(n), wooden = /wood|banded/.test(n), scale = /serpent/.test(n);
      for (let dy = -11; dy <= 11; dy++) for (let dz = -9; dz <= 9; dz++) {
        let d;
        if (shape === "kite") d = Math.hypot(dy / (dy < 0 ? 9.2 : 7.2), dz / (6.8 - Math.max(0, dy) * 0.4));
        else d = Math.hypot(dy, dz) / (shape === "buckler" ? 5.4 : 8.4);
        if (d > 1) continue;
        let c = d > 0.83 ? rimC : color;
        if (d <= 0.83) {
          if (wooden && (dz + 300) % 3 === 0) c = shade(color, -0.08);
          if (banded && (dy === 0 || dz === 0)) c = "#7a838d";
          if (scale && (dy + dz) & 1) c = shade(color, 0.1);
          if (shape === "kite" && dz === 0) c = shade(color, 0.15);
        }
        set(sx, cy + dy, dz, c);
      }
      const bossR = shape === "buckler" ? 1.5 : 2.3;
      for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) if (Math.hypot(dy, dz) <= bossR) set(sx + 1, cy + dy, dz, Math.hypot(dy, dz) < 1 ? "#dde2e7" : steelDark);
    }

    return vox;
  }

  /* ---------- mesh: only the faces that touch air, with baked ambient occlusion ---------- */

  // for each face: its normal, and which two axes span it (u, v); winding keeps the outside front-facing
  const FACES = [
    { n: [1, 0, 0], t: [1, 2] }, { n: [-1, 0, 0], t: [2, 1] },
    { n: [0, 1, 0], t: [2, 0] }, { n: [0, -1, 0], t: [0, 2] },
    { n: [0, 0, 1], t: [0, 1] }, { n: [0, 0, -1], t: [1, 0] }
  ];
  const CORNERS = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const AO = [0.52, 0.72, 0.87, 1];

  function buildMesh(vox) {
    const has = (p) => vox.has(p[0] + "," + p[1] + "," + p[2]);
    const out = [];
    for (const [x, y, z, hexColor] of vox.values()) {
      const base = rgb(hexColor), j = jitter(x, y, z);
      const col = base.map((v) => Math.min(1, v * j));
      for (const f of FACES) {
        const nb = [x + f.n[0], y + f.n[1], z + f.n[2]];
        if (has(nb)) continue;
        const a = f.n.findIndex((v) => v !== 0), [t1, t2] = f.t;
        const verts = CORNERS.map(([u, v]) => {
          const pos = [x - 0.5, y - 0.5, z - 0.5];
          pos[a] += f.n[a] > 0 ? 1 : 0;
          pos[t1] += u; pos[t2] += v;
          const d1 = u ? 1 : -1, d2 = v ? 1 : -1;
          const s1 = nb.slice(), s2 = nb.slice(), cn = nb.slice();
          s1[t1] += d1; s2[t2] += d2; cn[t1] += d1; cn[t2] += d2;
          const o1 = has(s1), o2 = has(s2);
          const ao = o1 && o2 ? 0 : 3 - (o1 + o2 + has(cn));
          return { pos, ao: AO[ao], uv: [u, v] };
        });
        // flip the quad's diagonal so the occlusion gradient doesn't streak
        const order = verts[0].ao + verts[2].ao >= verts[1].ao + verts[3].ao ? [0, 1, 2, 0, 2, 3] : [1, 2, 3, 1, 3, 0];
        for (const i of order) {
          const v = verts[i];
          out.push(...v.pos, ...f.n, ...col, v.ao, ...v.uv);
        }
      }
    }
    return new Float32Array(out);
  }

  /* ---------- matrices (column-major) ---------- */

  const mul = (a, b) => {
    const o = new Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
    return o;
  };
  const perspective = (fov, aspect, near, far) => {
    const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
    return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
  };
  const translate = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
  const rotX = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; };
  const rotY = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; };

  /* ---------- viewer ---------- */

  const VS = `
    attribute vec3 aPos; attribute vec3 aNormal; attribute vec3 aColor; attribute float aAo; attribute vec2 aUv;
    uniform mat4 uMVP; uniform mat4 uRot;
    varying vec3 vColor; varying vec2 vUv;
    void main() {
      vec3 n = (uRot * vec4(aNormal, 0.0)).xyz;
      float key = max(dot(n, normalize(vec3(0.3, 0.9, 0.55))), 0.0);
      float fill = max(dot(n, normalize(vec3(-0.7, 0.1, -0.4))), 0.0);
      float light = 0.38 + 0.58 * key + 0.12 * fill;
      vColor = aColor * light * aAo;
      vUv = aUv;
      gl_Position = uMVP * vec4(aPos, 1.0);
    }`;
  // a thin darker line along every voxel edge, the pixel-art outline
  const FS_EDGE = `
    #extension GL_OES_standard_derivatives : enable
    precision mediump float;
    varying vec3 vColor; varying vec2 vUv;
    void main() {
      vec2 e = min(vUv, 1.0 - vUv);
      float d = min(e.x, e.y);
      float edge = mix(0.91, 1.0, smoothstep(0.0, fwidth(d) * 1.1, d));
      gl_FragColor = vec4(vColor * edge, 1.0);
    }`;
  const FS_PLAIN = `
    precision mediump float;
    varying vec3 vColor; varying vec2 vUv;
    void main() { gl_FragColor = vec4(vColor, 1.0); }`;

  function createViewer() {
    const wrap = document.createElement("div");
    wrap.className = "voxel";
    const canvas = document.createElement("canvas");
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "img");
    const hint = document.createElement("span");
    hint.className = "voxel-hint";
    hint.textContent = "Drag to turn";
    wrap.append(canvas, hint);

    const gl = canvas.getContext("webgl", { antialias: false, alpha: true, premultipliedAlpha: true });
    if (!gl) return null;
    const derivatives = !!gl.getExtension("OES_standard_derivatives");
    const shader = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const link = (fs) => {
      const v = shader(gl.VERTEX_SHADER, VS), f = shader(gl.FRAGMENT_SHADER, fs);
      if (!v || !f) return null;
      const p = gl.createProgram();
      gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
      return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
    };
    const prog = (derivatives && link(FS_EDGE)) || link(FS_PLAIN);
    if (!prog) return null;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    const STRIDE = 12 * 4;
    [["aPos", 3, 0], ["aNormal", 3, 3], ["aColor", 3, 6], ["aAo", 1, 9], ["aUv", 2, 10]].forEach(([name, size, off]) => {
      const loc = gl.getAttribLocation(prog, name);
      if (loc < 0) return;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, STRIDE, off * 4);
    });
    const uMVP = gl.getUniformLocation(prog, "uMVP"), uRot = gl.getUniformLocation(prog, "uRot");
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 0);

    const reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const v = { wrap, sig: null, pid: null, dead: false };
    let count = 0, yaw = -0.45, pitch = 0.14, dragging = false, lastX = 0, lastY = 0;
    let idleUntil = 0, visible = true, raf = 0, last = 0;

    function resize() {
      // one canvas pixel per CSS pixel: the voxels themselves are the "pixels"
      const w = Math.max(1, Math.round(canvas.clientWidth)), h = Math.max(1, Math.round(canvas.clientHeight));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    }
    function draw() {
      if (v.dead) return;
      resize();
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      if (!count) return;
      const rot = mul(rotX(pitch), rotY(yaw));
      const model = mul(rot, translate(0, -CENTER_Y, 0));
      const mvp = mul(perspective(FOV, canvas.width / canvas.height, 1, 600), mul(translate(0, 0, -DISTANCE), model));
      gl.uniformMatrix4fv(uMVP, false, new Float32Array(mvp));
      gl.uniformMatrix4fv(uRot, false, new Float32Array(rot));
      gl.drawArrays(gl.TRIANGLES, 0, count);
    }
    function spinning() { return !reduced && !dragging && visible && !document.hidden && wrap.isConnected; }
    function frame(t) {
      raf = 0;
      const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
      last = t;
      if (performance.now() > idleUntil) yaw += SPIN * dt;
      draw();
      if (spinning()) raf = requestAnimationFrame(frame);
    }
    function kick() {
      if (!raf && spinning()) { last = 0; raf = requestAnimationFrame(frame); }
    }

    canvas.addEventListener("pointerdown", (e) => {
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
      wrap.classList.add("touched");
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      yaw += (e.clientX - lastX) * 0.012;
      pitch = Math.max(-0.1, Math.min(0.55, pitch + (e.clientY - lastY) * 0.006));
      lastX = e.clientX; lastY = e.clientY;
      draw();
    });
    const release = () => { if (!dragging) return; dragging = false; idleUntil = performance.now() + 2500; kick(); };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    canvas.addEventListener("dblclick", () => { yaw = -0.45; pitch = 0.14; draw(); });
    canvas.addEventListener("keydown", (e) => {
      const step = { ArrowLeft: -0.3, ArrowRight: 0.3 }[e.key];
      if (!step) return;
      e.preventDefault();
      yaw += step; idleUntil = performance.now() + 2500; draw();
    });
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      v.dead = true;
      const host = wrap.parentElement;
      if (host) host.classList.remove("has-voxel");
      wrap.remove();
    });
    if (window.ResizeObserver) new ResizeObserver(() => draw()).observe(wrap);
    if (window.IntersectionObserver) new IntersectionObserver((es) => { visible = es[0].isIntersecting; kick(); }).observe(wrap);
    document.addEventListener("visibilitychange", kick);

    v.setModel = (vox) => {
      const data = buildMesh(vox);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      count = data.length / 12;
    };
    v.resetView = () => { yaw = -0.45; pitch = 0.14; };
    v.label = (text) => canvas.setAttribute("aria-label", text + " (3D, drag or use arrow keys to turn)");
    v.draw = () => { draw(); kick(); };
    return v;
  }

  let viewer = null;

  // Swaps the SVG figure inside `host` for the 3D one. Returns false when it can't
  // (no WebGL), and the SVG simply stays. One canvas is reused across re-renders so
  // live refreshes don't flicker or leak WebGL contexts.
  function mount(host, player, opts = {}) {
    if (!host || !window.LonghouseFigure || mount.unsupported) return false;
    if (viewer && viewer.dead) viewer = null;
    if (!viewer) {
      try { viewer = createViewer(); } catch (e) { viewer = null; }
      if (!viewer) { mount.unsupported = true; return false; }
    }
    const pid = player ? player.id : null;
    const sig = JSON.stringify([pid, player && player.appearance, player && player.equipment, player && player.biome, !!opts.unknown]);
    if (pid !== viewer.pid) viewer.resetView();
    if (sig !== viewer.sig) viewer.setModel(buildModel(player, opts));
    viewer.sig = sig; viewer.pid = pid;
    viewer.label(player ? `${player.name}'s character` : "Character");
    host.classList.add("has-voxel");
    host.prepend(viewer.wrap);
    viewer.draw();
    return true;
  }

  window.LonghouseVoxel = { mount, buildModel };
})();
