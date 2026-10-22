/* Dashboard renderer.
 * Renders a snapshot object (see docs.html#schema). When the page is served by the
 * Longhouse collector it reads api/snapshot.json; anywhere else (GitHub Pages, a
 * plain static server) it falls back to the bundled mock in assets/mock-data.js.
 * Every panel copes with missing fields, because vanilla servers only provide some. */
(function () {
  "use strict";

  const SNAPSHOT_URL = "api/snapshot.json";

  const $ = (id) => document.getElementById(id);
  const has = (v) => v !== undefined && v !== null;

  // ---------- icons (24px stroke icons) ----------
  const ICON = {
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    cloud: '<path d="M17.5 19H8a6 6 0 1 1 5.7-8h.3a4.5 4.5 0 0 1 3.5 8z"/>',
    calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    tag: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    signal: '<path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    swords: '<path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M14.5 6.5L18 3h3v3l-3.5 3.5M5 14l4 4M7 17l-3 3M3 19l2 2"/>',
    skull: '<circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><path d="M8 20v2h8v-2M16 20a2 2 0 0 0 1.6-3.2 8 8 0 1 0-11.2 0A2 2 0 0 0 8 20"/>',
    hammer: '<path d="M15 12l-8.5 8.5a2.1 2.1 0 0 1-3-3L12 9M17.6 15L22 10.6M20.9 11.7l-1.3-1.3a2 2 0 0 1-.6-1.4V7.9l-2.3-2.3A5.6 5.6 0 0 0 12.7 4H9l.9.8A6.2 6.2 0 0 1 12 9.4V11l2 2h.5a2 2 0 0 1 1.4.6l1.3 1.3"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
    up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    down: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
    login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    crown: '<path d="M3 7l4 4 5-6 5 6 4-4-2 12H5z"/>',
    alert: '<path d="M12 3L2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
    power: '<path d="M12 2v10M18.4 6.6a9 9 0 1 1-12.8 0"/>',
    star: '<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill="currentColor" stroke="none"/>'
  };
  const icon = (name) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] || ICON.alert}</svg>`;

  const BIOMES = {
    meadows: "Meadows", blackforest: "Black Forest", swamp: "Swamp", mountain: "Mountain",
    plains: "Plains", mistlands: "Mistlands", ashlands: "Ashlands", deepnorth: "Deep North", ocean: "Ocean"
  };
  const biomeTag = (b) =>
    `<span class="biome"><span class="dot" style="background:var(--b-${esc(b)})"></span>${esc(BIOMES[b] || b)}</span>`;

  // ---------- formatting ----------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  const bold = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  // tooltip html is built from escaped values, then escaped again for the attribute
  const tip = (html) => `data-tip="${esc(html)}"`;
  const fmt = (n) => Number(n).toLocaleString("en-US");
  const compact = (n) => (n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, "") + "k" : fmt(n));
  const duration = (sec) => {
    const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
    return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
  };
  const minsAgo = (m) => (m < 1 ? "just now" : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`);
  const sinceIso = (iso) => (iso ? minsAgo(Math.round((Date.now() - new Date(iso)) / 60000)) : "a while ago");
  const portrait = (p) => window.LonghouseFigure.render(p, { portrait: true, unknown: !p.appearance, className: "portrait", label: p.name });

  // ---------- server status ----------
  function renderHero(data) {
    const s = data.server;
    const max = s.players.max || Math.max(s.players.online, 10);
    const meter = Array.from({ length: Math.min(max, 16) }, (_, i) => `<i class="${i < s.players.online ? "on" : ""}"></i>`).join("");
    const metrics = [
      has(s.worldDay) && ["calendar", "World day", `<span class="num">${fmt(s.worldDay)}</span>`],
      has(s.timeOfDay) && ["sun", "Time of day", esc(s.timeOfDay)],
      has(s.weather) && ["cloud", "Weather", esc(s.weather)],
      has(s.version) && ["tag", "Version", `<span class="num">${esc(s.version)}</span>`],
      has(s.pingMs) && ["signal", "Ping", `<span class="num">${s.pingMs}</span> <small>ms</small>`],
      has(s.nextSaveMinutes) && ["save", "Next save", `<span class="num">${s.nextSaveMinutes}</span> <small>min</small>`],
      has(s.playersToday) && ["users", "Vikings today", `<span class="num">${s.playersToday}</span>`],
      has(s.peakToday) && ["users", "Peak today", `<span class="num">${s.peakToday}</span> <small>online</small>`]
    ].filter(Boolean).slice(0, 6);

    $("hero").innerHTML = `
      <div class="hero-main">
        <span class="eyebrow">Dedicated server${s.world ? ` · World “${esc(s.world)}”` : ""}</span>
        <h1>${esc(s.name)}</h1>
        <div class="hero-status">
          ${s.online
            ? `<span class="online"><span class="dot live"></span>Online</span>`
            : `<span class="online" style="color:var(--bad)"><span class="dot" style="background:var(--bad)"></span>Offline</span>`}
          <span class="sep"></span>
          <span><b class="num">${s.players.online}</b>${s.players.max ? ` of ${s.players.max}` : ""} Vikings online</span>
          <span class="players-meter" aria-hidden="true">${meter}</span>
          ${has(s.uptimeSeconds) && s.online ? `<span class="sep"></span><span>Up <span class="num">${duration(s.uptimeSeconds)}</span></span>` : ""}
        </div>
        <div class="hero-foot">
          ${s.address ? `<span class="badge">${esc(s.address)}</span>` : `<span class="badge">${icon("lock")} Address shared privately</span>`}
          ${has(s.crossplay) ? `<span class="badge">${s.crossplay ? "Crossplay" : "Steam"}</span>` : ""}
          <span class="badge" id="updated">Updated just now</span>
        </div>
      </div>
      <div class="hero-side" data-count="${metrics.length}">
        ${metrics.map(([ic, k, v]) => `
          <div class="metric"><span class="eyebrow">${icon(ic)}${k}</span><div class="val">${v}</div></div>`).join("")}
      </div>`;
  }

  function renderBosses(data) {
    const card = $("bossCard");
    if (!data.bosses || !data.bosses.length) { card.hidden = true; return; }
    card.hidden = false;
    const list = data.bosses;
    const done = list.filter((b) => b.defeated).length;
    const nextIdx = list.findIndex((b) => !b.defeated);
    $("bossSub").textContent = `${done} of ${list.length} forsaken defeated`;
    $("bosses").innerHTML = list.map((b, i) => {
      const cls = b.defeated ? "done" : i === nextIdx ? "next" : "";
      const who = b.by && b.by.length ? ` · ${b.by.map(esc).join(", ")}` : "";
      const t = b.defeated ? `<b>${esc(b.name)}</b><br>${b.day ? `Day ${b.day}` : "Defeated"}${who}` : `<b>${esc(b.name)}</b><br>${i === nextIdx ? "Up next" : "Locked"}`;
      return `<li class="boss ${cls}" ${tip(t)}>
        <span class="boss-node">${icon(b.defeated ? "check" : i === nextIdx ? "crown" : "lock")}</span>
        <span class="boss-name">${esc(b.name)}</span>
        <span class="boss-meta">${b.defeated ? (b.day ? `Day ${b.day}` : "Defeated") : i === nextIdx ? "Up next" : "—"}</span>
        ${biomeTag(b.biome)}
      </li>`;
    }).join("");
  }

  function renderKpis(data) {
    const w = data.week || {};
    const d = w.deltas || {};
    // [key, icon, label, format, lowerIsBetter]
    const defs = [
      ["playtimeHours", "clock", "Playtime this week", (v) => `${v}<small style="font-size:16px;color:var(--text-3)"> h</small>`, false],
      ["kills", "swords", "Creatures slain", fmt, false],
      ["deaths", "skull", "Deaths this week", fmt, true],
      ["built", "hammer", "Pieces built", fmt, false],
      ["sessions", "login", "Sessions this week", fmt, false],
      ["uniquePlayers", "users", "Vikings this week", fmt, false]
    ].filter(([k]) => has(w[k])).slice(0, 4);
    $("kpis").innerHTML = defs.map(([k, ic, label, f, lower]) => {
      const delta = d[k];
      const deltaHtml = has(delta)
        ? `<span class="delta ${(lower ? delta <= 0 : delta >= 0) ? "up" : "down"}">${icon(delta >= 0 ? "up" : "down")}${Math.abs(delta)}%</span><span class="vs">vs last week</span>`
        : `<span class="vs" style="margin:0">this week</span>`;
      return `<div class="card kpi"><span class="eyebrow">${icon(ic)}${label}</span><div class="big num">${f(w[k])}</div>${deltaHtml}</div>`;
    }).join("");
  }

  // ---------- players ----------
  let selectedId = null;

  function renderRoster(data) {
    const players = [...data.players].sort((a, b) => b.online - a.online);
    const on = players.filter((p) => p.online), off = players.filter((p) => !p.online);
    if (!players.some((p) => p.id === selectedId)) selectedId = players.length ? (on[0] || players[0]).id : null;

    const row = (p) => {
      const hp = p.vitals && p.vitals.hp && p.vitals.hp[1] ? (p.vitals.hp[0] / p.vitals.hp[1]) * 100 : null;
      const where = p.online ? (p.biome ? biomeTag(p.biome) : `<span class="faint">Online now</span>`) : `<span class="faint">Seen ${sinceIso(p.lastSeen)}</span>`;
      return `<button class="p-row ${p.online ? "" : "off"}" role="option" aria-selected="${p.id === selectedId}" data-id="${esc(p.id)}">
        <span class="avatar">${portrait(p)}<span class="st ${p.online ? "on" : ""}"></span></span>
        <span style="min-width:0"><span class="name">${esc(p.name)}</span><span class="where">${where}</span></span>
        ${p.online && hp !== null ? `<span class="mini-hp" ${tip(`Health ${p.vitals.hp[0]} / ${p.vitals.hp[1]}`)}><i style="width:${hp}%"></i></span>` : ""}
      </button>`;
    };
    $("roster").innerHTML = players.length
      ? `<span class="eyebrow roster-label">Online (${on.length})</span>${on.map(row).join("")}` +
        (off.length ? `<span class="eyebrow roster-label">Offline (${off.length})</span>${off.map(row).join("")}` : "")
      : `<div class="empty" style="margin:8px">No Vikings yet. Players appear after their first login.</div>`;
  }

  const stars = (q, max = 4) =>
    `<span class="stars" aria-label="Quality ${q} of ${max}">${Array.from({ length: max }, (_, i) => `<span class="${i < q ? "on" : "off"}">${icon("star")}</span>`).join("")}</span>`;

  function renderProfile(data) {
    const el = $("profile");
    const p = data.players.find((x) => x.id === selectedId);
    if (!p) { el.innerHTML = `<div class="empty">Pick a Viking to see their profile.</div>`; return; }
    const v = p.vitals;
    const vital = (label, pair, color) =>
      pair && pair[1] ? `<div class="vital"><span class="lbl">${label}</span><span class="track"><i style="width:${(pair[0] / pair[1]) * 100}%;background:${color}"></i></span><span class="v num">${pair[0]} / ${pair[1]}</span></div>` : "";
    const foodIcon = { hp: "heart", stamina: "bolt", eitr: "spark" };
    const eq = p.equipment;
    const slot = ([k, label]) => {
      const it = eq && eq[k];
      return it
        ? `<div class="slot"><span class="eyebrow">${label}</span><div class="item" title="${esc(it.name)}">${esc(it.name)}</div>${it.q ? stars(it.q) : ""}</div>`
        : `<div class="slot none"><span class="eyebrow">${label}</span><div class="item">${eq ? "Empty" : "—"}</div></div>`;
    };
    const st = p.stats || {};
    const lifetime = [
      has(st.kills) && ["Kills", fmt(st.kills)],
      has(st.deaths) && ["Deaths", fmt(st.deaths)],
      has(st.built) && ["Pieces built", compact(st.built)],
      has(st.piecesStanding) && ["Pieces standing", compact(st.piecesStanding)],
      has(st.crafted) && ["Items crafted", fmt(st.crafted)],
      has(st.distanceKm) && ["Distance", `${fmt(st.distanceKm)} <small class="faint">km</small>`],
      has(st.jumps) && ["Jumps", compact(st.jumps)],
      has(st.playtimeHours) && ["Playtime", `${fmt(st.playtimeHours)} <small class="faint">h</small>`],
      has(st.bossKills) && ["Bosses", `${st.bossKills} <small class="faint">/ 7</small>`],
      has(st.sessions) && ["Sessions", fmt(st.sessions)],
      has(st.longestSessionMinutes) && ["Longest session", duration(st.longestSessionMinutes * 60)]
    ].filter(Boolean).slice(0, 8);

    const status = p.online
      ? [p.biome && biomeTag(p.biome), p.location && `<span class="faint">${esc(p.location)}</span>`,
         has(p.sessionMinutes) && `<span class="faint">· <span class="num">${duration(p.sessionMinutes * 60)}</span> this session</span>`].filter(Boolean).join("")
      : `<span class="faint">Offline · seen ${sinceIso(p.lastSeen)}${p.location ? ` · ${esc(p.location)}` : ""}</span>`;

    el.innerHTML = `
      <div class="pf-head">
        <span class="avatar lg">${portrait(p)}<span class="st ${p.online ? "on" : ""}"></span></span>
        <div>
          <h3>${esc(p.name)}</h3>
          <div class="line">${p.title ? `<span>${esc(p.title)}</span>` : ""}${status}</div>
        </div>
        <div class="tags">
          ${p.rested ? `<span class="badge good">Rested</span>` : ""}
          ${p.comfort ? `<span class="badge">Comfort <b class="num">${p.comfort}</b></span>` : ""}
          ${p.favoriteFood ? `<span class="badge">Fav food · ${esc(p.favoriteFood)}</span>` : ""}
        </div>
      </div>

      <div class="armory">
        <div class="arm-col left">${[["head", "Head"], ["chest", "Chest"], ["legs", "Legs"], ["cape", "Cape"]].map(slot).join("")}</div>
        <div class="arm-figure">
          ${window.LonghouseFigure.render(p, { unknown: !p.appearance })}
          ${eq ? "" : `<span class="arm-note">Gear shows with the server plugin</span>`}
        </div>
        <div class="arm-col right">${[["weapon", "Weapon"], ["offhand", "Off-hand"], ["utility", "Utility"]].map(slot).join("")}</div>
      </div>

      <div class="pf-grid">
        <div>
          <div class="pf-block">
            <span class="eyebrow">Vitals</span>
            ${!v ? `<div class="empty">Health shows with the server plugin</div>`
              : p.online ? vital("Health", v.hp, "var(--hp)") + vital("Stamina", v.stamina, "var(--stamina)") + vital("Eitr", v.eitr, "var(--eitr)")
              : `<div class="empty">Vitals show while ${esc(p.name)} is online</div>`}
          </div>
          ${p.foods ? `<div class="pf-block">
            <span class="eyebrow">Active food</span>
            ${p.foods.length ? p.foods.map((f) => `
              <div class="food">
                <span class="food-ic ${esc(f.kind)}">${icon(foodIcon[f.kind])}</span>
                <span style="min-width:0"><span class="fname">${esc(f.name)}</span>
                  <span class="track"><i style="width:${(f.minutesLeft / f.total) * 100}%;background:var(--${f.kind === "hp" ? "hp" : esc(f.kind)})"></i></span></span>
                <span class="left num">${f.minutesLeft}m</span>
              </div>`).join("") : `<div class="empty">No food buffs active</div>`}
          </div>` : ""}
        </div>
        <div>
          ${p.skills && p.skills.length ? `<div class="pf-block">
            <span class="eyebrow">Top skills</span>
            ${p.skills.map(([n, lv]) => `<div class="skill"><span>${esc(n)}</span><span class="track"><i style="width:${lv}%"></i></span><span class="v num">${lv}</span></div>`).join("")}
          </div>` : ""}
        </div>
      </div>
      ${lifetime.length ? `
      <div class="pf-block lifetime-block">
        <span class="eyebrow">Lifetime</span>
        <div class="lifetime" data-count="${lifetime.length}">
          ${lifetime.map(([k, val]) => `<div><span class="eyebrow">${k}</span><div class="val num">${val}</div></div>`).join("")}
        </div>
      </div>` : ""}`;
  }

  // ---------- records ----------
  function renderLeaders(data) {
    const boards = [
      ["swords", "Most kills", (p) => p.stats && p.stats.kills, (n) => `${fmt(n)} kills`, compact],
      ["skull", "Most trips to Valhalla", (p) => p.stats && p.stats.deaths, (n) => `${fmt(n)} deaths`, compact],
      ["hammer", "Master builder", (p) => p.stats && p.stats.built, (n) => `${fmt(n)} pieces`, compact],
      ["hammer", "Master builder", (p) => p.stats && p.stats.piecesStanding, (n) => `${fmt(n)} pieces standing`, compact],
      ["compass", "Furthest wanderer", (p) => p.stats && p.stats.distanceKm, (n) => `${fmt(n)} km`, compact],
      ["clock", "Most time in Midgard", (p) => p.stats && p.stats.playtimeHours, (n) => `${fmt(n)} hours played`, (n) => `${n}h`],
      ["calendar", "Longest session", (p) => p.stats && p.stats.longestSessionMinutes, (n) => duration(n * 60), (n) => duration(n * 60)],
      ["login", "Always logging in", (p) => p.stats && p.stats.sessions, (n) => `${fmt(n)} sessions`, compact]
    ].filter(([, , get]) => data.players.some((p) => has(get(p)))).slice(0, 4);

    $("records").hidden = !boards.length || !data.players.length;
    $("leaders").innerHTML = boards.map(([ic, title, get, label, short]) => {
      const ranked = data.players.filter((p) => has(get(p))).sort((a, b) => get(b) - get(a));
      const [first, ...rest] = ranked;
      return `<div class="card leader">
        <span class="ic">${icon(ic)}</span>
        <h3>${title}</h3>
        <div class="who">${esc(first.name)}</div>
        <div class="amt num">${label(get(first))}</div>
        ${rest.length ? `<ol>${rest.slice(0, 3).map((p, i) => `<li><span><b>${i + 2}</b>${esc(p.name)}</span><span class="num">${short(get(p))}</span></li>`).join("")}</ol>` : ""}
      </div>`;
    }).join("");
  }

  // ---------- bar lists ----------
  function renderBars(el, rows, { unit = "", withBiome = false, limit = 9 } = {}) {
    const top = rows.slice(0, limit);
    const max = Math.max(...top.map((r) => r[1]), 1);
    el.innerHTML = top.map(([name, n, biome]) => `
      <div class="bar ${n ? "" : "zero"}" ${tip(`<b>${esc(name)}</b><br>${fmt(n)} ${unit}${withBiome && biome ? ` · ${esc(BIOMES[biome] || biome)}` : ""}`)}>
        <span class="lbl">${withBiome && biome ? `<span class="dot" style="background:var(--b-${esc(biome)})"></span>` : ""}${esc(name)}</span>
        <span class="track"><i style="width:${(n / max) * 100}%"></i></span>
        <span class="v num">${n ? compact(n) : "—"}</span>
      </div>`).join("");
  }

  let mobFilter = "all";
  function renderWorld(data) {
    const any = data.foods || data.materials || data.mobs;
    $("world").hidden = !any;
    document.querySelector('.nav a[href="#world"]').hidden = !any;
    if (!any) return;
    $("foodCard").hidden = !data.foods;
    $("materialCard").hidden = !data.materials;
    $("mobCard").hidden = !data.mobs;
    if (data.foods) renderBars($("foods"), data.foods, { unit: "servings" });
    if (data.materials) renderBars($("materials"), data.materials, { unit: "gathered", withBiome: true });
    if (!data.mobs) return;

    const biomes = [...new Set(data.mobs.map((m) => m[2]).filter(Boolean))];
    if (mobFilter !== "all" && !biomes.includes(mobFilter)) mobFilter = "all";
    $("mobTotal").textContent = `${fmt(data.mobs.reduce((s, m) => s + m[1], 0))} total`;
    $("mobFilter").innerHTML =
      `<button class="chip" data-b="all" type="button">All</button>` +
      biomes.map((b) => `<button class="chip" data-b="${esc(b)}" type="button"><span class="dot" style="background:var(--b-${esc(b)})"></span>${esc(BIOMES[b] || b)}</button>`).join("");
    const rows = mobFilter === "all" ? data.mobs : data.mobs.filter((m) => m[2] === mobFilter);
    renderBars($("mobs"), rows, { unit: "slain", withBiome: true, limit: 8 });
    $("mobFilter").querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", c.dataset.b === mobFilter));
  }

  // ---------- activity ----------
  function renderHeat(data) {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const grid = data.heatmap || days.map(() => new Array(24).fill(0));
    const max = Math.max(...grid.flat(), 0.0001);
    const level = (v) => (v > 0 ? Math.max(1, Math.ceil((v / max) * 5)) : 0);
    const hour = (h) => `${String(h).padStart(2, "0")}:00`;
    const avg = (v) => (v >= 1 || v === 0 ? Math.round(v) : v.toFixed(1));
    $("heat").innerHTML =
      grid.map((row, d) => `
        <span class="heat-day">${days[d]}</span>
        <div class="heat-row">${row.map((v, h) =>
          `<i style="background:var(--heat-${level(v)})" ${tip(`<b>${days[d]} ${hour(h)}</b><br>${v > 0 ? `~${avg(v)} player${v > 1 ? "s" : ""} online` : "Nobody online"}`)}></i>`).join("")}</div>`).join("") +
      `<span></span><div class="heat-hours"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span></div>
       <div class="heat-legend"><span>Quiet</span>${[0, 1, 2, 3, 4, 5].map((l) => `<i style="background:var(--heat-${l})"></i>`).join("")}<span>Busy</span></div>`;

    let peak = [0, 0, 0];
    grid.forEach((row, d) => row.forEach((v, h) => { if (v > peak[0]) peak = [v, d, h]; }));
    if (!peak[0]) { $("heatStats").innerHTML = `<div class="faint" style="grid-column:1/-1">The heatmap fills in as your group plays.</div>`; return; }
    const dayTotals = grid.map((row) => row.reduce((a, b) => a + b, 0));
    const busiest = dayTotals.indexOf(Math.max(...dayTotals));
    const firstOn = grid.map((row) => row.findIndex((v) => v > 0)).filter((h) => h >= 0).sort((a, b) => a - b);
    const usualStart = firstOn[Math.floor(firstOn.length / 2)];
    $("heatStats").innerHTML = [
      ["Peak hour", `${days[peak[1]]} ${hour(peak[2])}`, `~${avg(peak[0])} online`],
      ["Busiest day", ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][busiest], `${fmt(Math.round(dayTotals[busiest]))} player-hours`],
      ["Usual start", hour(usualStart), "median first login"]
    ].map(([k, v, s]) => `<div><span class="eyebrow">${k}</span><div class="val">${v}</div><div class="faint">${s}</div></div>`).join("");
  }

  function renderFeed(data) {
    const kind = { kill: "swords", join: "login", leave: "logout", craft: "hammer", build: "hammer", death: "skull", event: "alert", boss: "crown", server: "power" };
    const items = data.activity || [];
    $("feed").innerHTML = items.length
      ? items.map((e) => `
      <li><span class="ev ${esc(e.type)}">${icon(kind[e.type])}</span>
        <span class="txt">${bold(e.text)}</span><span class="when">${minsAgo(e.m)}</span></li>`).join("")
      : `<li class="faint" style="display:block">Nothing yet. Joins, deaths and raids show up here.</li>`;
  }

  // ---------- tooltip ----------
  function wireTooltip() {
    const t = $("tip");
    const place = (e) => {
      const r = t.getBoundingClientRect();
      let x = e.clientX + 14, y = e.clientY + 14;
      if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 14;
      if (y + r.height > innerHeight - 8) y = e.clientY - r.height - 14;
      t.style.left = x + "px"; t.style.top = y + "px";
    };
    document.addEventListener("mouseover", (e) => {
      const el = e.target.closest("[data-tip]");
      if (!el) return t.classList.remove("show");
      t.innerHTML = el.dataset.tip; // decoded once from the attribute; inner values are still escaped
      t.classList.add("show"); place(e);
    });
    document.addEventListener("mousemove", (e) => t.classList.contains("show") && place(e));
    document.addEventListener("scroll", () => t.classList.remove("show"), { passive: true });
  }

  // ---------- theme ----------
  function wireTheme() {
    const btn = $("themeBtn");
    const paint = () => {
      const dark = document.documentElement.dataset.theme === "dark";
      btn.innerHTML = icon(dark ? "sun" : "moon");
      btn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    };
    btn.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("longhouse-theme", next); } catch (e) {}
      paint();
    });
    paint();
  }

  // ---------- boot ----------
  let current, live = false, stampTimer;

  function render(data) {
    current = data;
    document.title = `${data.server.name} · Longhouse`;
    renderHero(data);
    renderBosses(data);
    renderKpis(data);
    renderRoster(data);
    renderProfile(data);
    renderLeaders(data);
    renderWorld(data);
    renderHeat(data);
    renderFeed(data);
    const stamp = () => {
      const s = Math.max(0, Math.round((Date.now() - new Date(data.generatedAt)) / 1000));
      const el = $("updated");
      if (el) el.textContent = `Updated ${s < 60 ? s + "s" : Math.round(s / 60) + "m"} ago`;
    };
    stamp();
    clearInterval(stampTimer);
    stampTimer = setInterval(stamp, 1000);
  }

  async function load() {
    // static hosts (GitHub Pages, opening the file directly) never have a collector
    if (location.protocol === "file:" || /\.github\.io$/.test(location.hostname)) return window.LONGHOUSE_MOCK;
    try {
      const res = await fetch(SNAPSHOT_URL, { cache: "no-store" });
      const type = res.headers.get("content-type") || "";
      if (res.ok && type.includes("json")) {
        const data = await res.json();
        if (data && data.schema) { live = true; return data; }
      }
    } catch (e) { /* not served by the collector */ }
    live = false;
    return window.LONGHOUSE_MOCK;
  }

  $("roster").addEventListener("click", (e) => {
    const row = e.target.closest(".p-row");
    if (!row) return;
    selectedId = row.dataset.id;
    $("roster").querySelectorAll(".p-row").forEach((r) => r.setAttribute("aria-selected", r.dataset.id === selectedId));
    renderProfile(current);
  });
  $("mobFilter").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (chip) { mobFilter = chip.dataset.b; renderWorld(current); }
  });

  wireTooltip();
  wireTheme();
  load().then((data) => {
    const badge = $("modeBadge");
    badge.textContent = live ? "Live" : "Preview · mock data";
    badge.className = live ? "badge good" : "badge accent";
    render(data);
    if (live) {
      const every = (data.refreshSeconds || 15) * 1000;
      setInterval(() => load().then((d) => live && render(d)), every);
    }
  });
})();
