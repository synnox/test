/* ============ utilitaires SN Streaming ============ */

/* Échappement HTML centralisé (utilisé partout où une valeur provient
   du catalogue ou de l'utilisateur est injectée dans le DOM). */
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- stockage versionné (localStorage primaire, cookies en migration) ---------- */

const STORE_PREFIX = "sn1_";
function stKey(name) { return STORE_PREFIX + name; }

// Historique : clé de stockage = "sn1_history_<accountsKey>"
function stHistoryKey() { return stKey("history_" + Accounts.historyKey()); }
function stFavKey() { return stKey("fav_" + getFavoritesKey()); }

function sanitizeHistory(obj) {
  const out = {};
  if (!obj || typeof obj !== "object") return out;
  for (const k of Object.keys(obj)) {
    const id = Number(k);
    if (!Number.isInteger(id) || id <= 0) continue;
    const e = obj[k];
    if (!e || typeof e !== "object") continue;
    const dur = Number(e.dur);
    const cur = Number(e.cur);
    out[id] = {
      cur: Number.isFinite(cur) ? Math.max(0, cur) : 0,
      dur: Number.isFinite(dur) ? Math.max(0, dur) : 0,
      ts: Number.isFinite(Number(e.ts)) ? Number(e.ts) : Date.now(),
      fin: !!e.fin,
    };
  }
  return out;
}

function sanitizeFavorites(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const v of arr) {
    const n = Number(v);
    if (Number.isInteger(n) && n > 0 && !out.includes(n)) out.push(n);
  }
  return out;
}

// Nettoie les données d'un compte (appelé lors de la suppression du compte).
window.__clearUserStorage = function (u) {
  const suffix = (Accounts.userStorageSuffix && Accounts.userStorageSuffix(u)) || String(u);
  const remove = (k) => { try { localStorage.removeItem(k); } catch (e) {} };
  remove(stKey("history_sn_history_" + suffix));
  remove(stKey("fav_sn_fav_" + suffix));
};

/* ---------- poster ---------- */

function posterGradient(id) {
  const palettes = [
    ["#1d2740", "#e50914"],
    ["#2a1745", "#7c3aed"],
    ["#12203a", "#0ea5e9"],
    ["#1f1236", "#f5c518"],
    ["#0d2b33", "#14b8a6"],
    ["#33141d", "#f43f5e"],
    ["#172028", "#64748b"],
    ["#3a1f0d", "#f97316"],
  ];
  return palettes[id % palettes.length];
}

function posterSVG(item) {
  const [c1, c2] = posterGradient(item.id);
  const initials = item.title.replace(/^Le |^La |^Les |^L'/, "").split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  const label = item.type === "series" ? "SÉRIE" : "FILM";
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${c1}"/>
          <stop offset="100%" stop-color="${c2}"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="35%" r="60%">
          <stop offset="0%" stop-color="rgba(255,255,255,0.18)"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
        </radialGradient>
      </defs>
      <rect width="400" height="600" fill="url(#g)"/>
      <rect width="400" height="600" fill="url(#glow)"/>
      <text x="200" y="270" font-family="Arial" font-size="150" font-weight="900"
        fill="rgba(255,255,255,0.92)" text-anchor="middle">${initials}</text>
      <rect x="140" y="470" width="120" height="30" rx="15" fill="rgba(0,0,0,0.35)"/>
      <text x="200" y="491" font-family="Arial" font-size="15" font-weight="700" letter-spacing="2"
        fill="#ffffff" text-anchor="middle">${label}</text>
    </svg>`)}`;
}

function starSVG() {
  return '<svg viewBox="0 0 24 24" width="14" height="14" fill="#1e90ff"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z"/></svg>';
}

/* vraie image si fournie, sinon poster SVG généré */
function poster(item) {
  return item.poster || posterSVG(item);
}

function playSVG() {
  return '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
}

let serverCheck = null;
/* Détecte la présence du serveur local/proxy (endpoint /_health).
   Ashkrone que si on est sur GitHub Pages ou un hébergement statique,
   le proxy n'existe pas. */
function serverAvailable() {
  if (serverCheck === null) {
    serverCheck = fetch(location.origin + "/_health", { method: "GET", cache: "no-store" })
      .then(r => r.status === 200)
      .catch(() => false);
    serverCheck.catch(() => {});
  }
  return serverCheck;
}

/* vidéos protégées (sibnet) : on les lit via le proxy local
   (cf. server.js). S'il n'y a pas de serveur (GitHub Pages), on renvoie
   l'URL directe : le lecteur affichera une erreur propre plutôt qu'un
   faux "/proxy?url=..." 404. */
function proxyURL(url) {
  if (!url) return Promise.resolve(url);
  if (/sibnet\.ru/i.test(url)) {
    return serverAvailable().then(ok => {
      if (!ok) return url;
      const base = location.protocol && /^https?:$/.test(location.protocol)
        ? location.origin
        : "http://127.0.0.1:8766";
      return base + "/proxy?url=" + encodeURIComponent(url);
    });
  }
  return Promise.resolve(url);
}

function infoSVG() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';
}

/* ============ tiroir de navigation mobile ============
   Contient TOUT (liens, recherche, thème, compte) dans une
   sidebar droite sur ≤900px, avec voile arrière. */
(function () {
  const burger = document.getElementById("burger");
  const links = document.querySelector(".nav-links");
  if (!burger || !links) return;

  const overlay = document.createElement("div");
  overlay.className = "side-overlay";
  overlay.setAttribute("aria-hidden", "true");
  // le voile doit vivre dans le MÊME contexte d'empilement que le tiroir
  // (.nav-links est un enfant de .navbar qui porte z-index:100) :
  // posé dans <body>, il s'afficherait AU-DESSUS du tiroir et bloquerait
  // tous les clics de la sidebar.
  (document.querySelector(".navbar") || document.body).appendChild(overlay);

  const WIDE = 900;
  function setOpen(open) {
    links.classList.toggle("open", open);
    overlay.classList.toggle("show", open);
    burger.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.classList.toggle("menu-locked", open);
  }
  function toggle() { setOpen(!links.classList.contains("open")); }
  burger.addEventListener("click", toggle);
  burger.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
  });
  overlay.addEventListener("click", () => setOpen(false));
  links.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
  window.addEventListener("resize", () => { if (window.innerWidth > WIDE) setOpen(false); });
})();

/* ============ THEME : clair / sombre / auto ============
   Le choix est appliqué AVANT le premier rendu par un petit script
   inline dans le <head> de chaque page (pas de flash).
   Ici : menu popover + mémorisation (sn_theme = light|dark|system). */
(function () {
  const btn = document.getElementById("themeToggle");
  if (!btn) return;

  const readMode = () => {
    const m = localStorage.getItem("sn_theme");
    return m === "light" || m === "dark" ? m : "system";
  };

  function applyMode(mode) {
    if (mode === "light") document.documentElement.setAttribute("data-theme", "light");
    else document.documentElement.removeAttribute("data-theme");
    try { localStorage.setItem("sn_theme", mode); } catch (e) {}
    markActive();
  }

  const IC = { stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round", fill: "none" };
  const ico = (inner) => `<svg viewBox="0 0 24 24" ` +
    Object.entries(IC).map(([k, v]) => `${k}="${v}"`).join(" ") + `>${inner}</svg>`;

  const menu = document.createElement("div");
  menu.className = "theme-menu";
  menu.setAttribute("role", "menu");
  menu.innerHTML = [
    { m: "light", inner: '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>', label: "Clair" },
    { m: "dark", inner: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>', label: "Sombre" },
    { m: "system", inner: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M9 21h6M12 17v4"/>', label: "Auto (système)" },
  ].map(o => `<button type="button" class="tm-item" data-mode="${o.m}" role="menuitem">${ico(o.inner)}<span>${o.label}</span><span class="tm-check">✓</span></button>`).join("");
  document.body.appendChild(menu);

  function markActive() {
    const cur = readMode();
    menu.querySelectorAll(".tm-item").forEach(b => b.classList.toggle("active", b.dataset.mode === cur));
  }

  function positionMenu() {
    const r = btn.getBoundingClientRect();
    menu.style.top = (r.bottom + 8) + "px";
    const w = menu.offsetWidth;
    let left = r.right - w;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    menu.style.left = left + "px";
  }

  function openMenu(open) {
    btn.setAttribute("aria-expanded", String(open));
    if (!open) { menu.classList.remove("show"); return; }
    menu.style.position = "fixed";
    positionMenu();
    menu.classList.add("show");
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const wasOpen = menu.classList.contains("show");
    openMenu(!wasOpen);
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".theme-menu") && btn !== e.target && !btn.contains(e.target)) openMenu(false);
  });
  menu.addEventListener("click", (e) => {
    const b = e.target.closest(".tm-item");
    if (!b) return;
    applyMode(b.dataset.mode);
    openMenu(false);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") openMenu(false); });
  window.addEventListener("resize", () => { if (menu.classList.contains("show")) positionMenu(); });

  markActive();
})();

/* raccourci clavier : "/" pour rechercher (hors champs de saisie) */
(function () {
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key !== "/") return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || tag === "BUTTON") return;
    const inp = document.getElementById("searchInput");
    if (inp && !inp.disabled) { e.preventDefault(); inp.focus(); inp.select(); }
  });
})();

function itemJSON(id) {
  return CATALOG.find(i => i.id === Number(id));
}

function cardHTML(item) {
  const t = esc(item.title);
  const star = `<span class="star">${starSVG()} ${item.rating.toFixed(1)}</span>`;
  const meta = item.type === "movie" ? esc(item.duration) : `${item.seasons.length}S`;
  const h = getHistory()[item.id];
  const pct = h && h.dur > 0 ? Math.min(100, Math.round((h.cur / h.dur) * 100)) : 0;
  const fav = isFavorite(item.id);
  return `
    <div class="card" data-id="${item.id}" title="${esc(item.title)}" data-title="${esc(t)}" data-genres="${esc(item.genres.join(","))}" data-type="${esc(item.type)}">
      <div class="card-poster">
        <span class="type-badge ${esc(item.type)}">${esc(item.type)}</span>
        <img src="${poster(item)}" alt="${t}" loading="lazy">
        <span class="runtime">${meta}</span>
        <button class="card-fav ${fav ? 'active' : ''}" data-fav="${item.id}" title="${fav ? 'Retirer des favoris' : 'Ajouter à Ma Liste'}">
          <svg viewBox="0 0 24 24" fill="${fav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
        <div class="play-overlay"><span>${playSVG()}</span></div>
        ${pct > 0 ? `<div class="card-progress"><div class="card-progress-fill" style="width:${pct}%"></div></div>` : ""}
      </div>
      <div class="card-body">
        <h3>${t}</h3>
        <div class="sub">${star}<span>${item.year}</span><span>${esc(item.genres[0])}</span></div>
      </div>
    </div>`;
}

function renderGrid(items, containerId, emptyMsg) {
  const el = document.getElementById(containerId);
  if (!items.length) {
    el.innerHTML = `<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><p>${emptyMsg}</p></div>`;
    return;
  }
  el.innerHTML = items.map(cardHTML).join("");
}

function toast(msg, type) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.setAttribute("role", "status");
    t.setAttribute("aria-live", "polite");
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.dataset.type = type || "";
  t.classList.toggle("ok", type === "ok");
  t.classList.toggle("err", type === "err");
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 2400);
}

/* ============ historique de lecture ============
   Stockage versionné : localStorage PRIMAIRE (clés sn1_*),
   cookies conservés uniquement pour la migration des anciennes données. */

function saveAllHistory(list) {
  try { localStorage.setItem(stHistoryKey(), JSON.stringify(list)); } catch (e) {}
}

function getHistory() {
  try {
    const raw = localStorage.getItem(stHistoryKey());
    if (raw) return sanitizeHistory(JSON.parse(raw));
  } catch (e) {}
  // migration depuis l'ancien cookie
  try {
    const c = Accounts.getCookie(Accounts.historyKey());
    if (c) {
      const val = sanitizeHistory(JSON.parse(c));
      saveAllHistory(val);
      Accounts.delCookie(Accounts.historyKey());
      return val;
    }
  } catch (e) {}
  return {};
}

function saveProgress(id, cur, dur) {
  const list = getHistory();
  const now = Date.now();
  if (list[id]) {
    list[id].ts = now;
    if (cur !== undefined) list[id].cur = cur;
    if (dur !== undefined) list[id].dur = dur;
  } else {
    list[id] = { ts: now, cur: cur || 0, dur: dur || 0 };
  }
  saveAllHistory(list);
}

function updateProgress(id, cur, dur) {
  const list = getHistory();
  if (!list[id]) return;
  list[id].cur = cur;
  list[id].dur = dur;
  saveAllHistory(list);
}

function removeProgress(id) {
  const list = getHistory();
  delete list[id];
  saveAllHistory(list);
}

/* marque un film comme terminé (reste dans l'historique, sort de la watchlist) */
function finishProgress(id) {
  const list = getHistory();
  if (!list[id]) return;
  list[id].fin = true;
  list[id].cur = list[id].dur || 0;
  list[id].ts = Date.now();
  saveAllHistory(list);
}

/* un film est terminé s'il est marqué fini (ou presque terminé) */
function isFinished(id) {
  const h = getHistory()[id];
  if (!h) return false;
  if (h.fin) return true;
  if (h.dur > 0 && h.cur >= h.dur - 40) return true;
  return false;
}

function isNearEnd(id) {
  const h = getHistory()[id];
  if (!h || !h.dur) return false;
  return h.cur >= h.dur - 40;
}

function fmtTime(s) {
  if (!isFinite(s) || s < 0) s = 0;
  s = Math.floor(s);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ":" + (r < 10 ? "0" : "") + r;
}

function parseQuery() {
  const params = new URLSearchParams(location.search);
  return { q: params.get("q") || "", filter: params.get("filter") || "Tous" };
}

function updateURL(q, filter) {
  const params = new URLSearchParams();
  if (filter && filter !== "Tous") params.set("filter", filter);
  if (q) params.set("q", q);
  if (typeof currentSort !== "undefined" && currentSort && currentSort !== "default") {
    params.set("sort", currentSort);
    params.set("dir", sortAsc ? "asc" : "desc");
  }
  const qs = params.toString();
  history.replaceState(null, "", qs ? "?" + qs : location.pathname);
}

/* ============ FAVORIS (ma liste perso) ============ */
function getFavoritesKey() {
  const hk = Accounts.historyKey();
  return hk === "sn_history" ? "sn_fav" : "sn_fav_" + hk.split("_").slice(2).join("_");
}
function getFavorites() {
  try {
    const raw = localStorage.getItem(stFavKey());
    if (raw) return sanitizeFavorites(JSON.parse(raw));
  } catch (e) {}
  // migration depuis l'ancien cookie
  try {
    const c = Accounts.getCookie(getFavoritesKey());
    if (c) {
      const val = sanitizeFavorites(JSON.parse(c));
      saveFavorites(val);
      Accounts.delCookie(getFavoritesKey());
      return val;
    }
  } catch (e) {}
  return [];
}
function saveFavorites(arr) {
  try { localStorage.setItem(stFavKey(), JSON.stringify(sanitizeFavorites(arr))); } catch (e) {}
}
function isFavorite(id) { return getFavorites().includes(id); }
function toggleFavorite(id) {
  const fav = getFavorites();
  const i = fav.indexOf(id);
  if (i === -1) { fav.push(id); toast("Ajouté aux favoris", "ok"); }
  else { fav.splice(i, 1); toast("Retiré des favoris"); }
  saveFavorites(fav);
  return i === -1;
}
function removeFavorite(id) {
  saveFavorites(getFavorites().filter(f => f !== id));
}

/* films en cours (pas encore terminés) pour "Ma Liste" */
function getUnfinishedFilms() {
  const hist = getHistory();
  return Object.keys(hist)
    .map(Number)
    .filter(id => {
      if (!CATALOG.some(i => i.id === id)) return false;
      return !isFinished(id);
    })
    .sort((a, b) => (hist[b].ts || 0) - (hist[a].ts || 0))
    .map(id => CATALOG.find(i => i.id === id));
}

/* ============ FILM DU JOUR (seed = date) ============ */
function getDailyPick() {
  if (!CATALOG.length) return null;
  const d = new Date();
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  let h = seed;
  for (let i = 0; i < 8; i++) { h = ((h << 5) + h + (i * 31)) | 0; }
  return CATALOG[Math.abs(h) % CATALOG.length];
}

/* ============ SURPRENDS-MOI ============ */
function getRandomFilm() { return CATALOG.length ? CATALOG[Math.floor(Math.random() * CATALOG.length)] : null; }

/* ============ STATISTIQUES ============ */
function getStats() {
  const hist = getHistory();
  const ids = Object.keys(hist).map(Number).filter(id => CATALOG.some(i => i.id === id));
  let totalSec = 0, genreCount = {};
  ids.forEach(id => {
    const h = hist[id];
    if (h && h.dur > 0) totalSec += Math.min(h.cur, h.dur);
    const it = CATALOG.find(i => i.id === id);
    if (it) it.genres.forEach(g => { genreCount[g] = (genreCount[g] || 0) + 1; });
  });
  const topGenre = Object.entries(genreCount).sort((a, b) => b[1] - a[1])[0];
  const totalH = Math.floor(totalSec / 3600);
  const totalM = Math.floor((totalSec % 3600) / 60);
  return {
    nbFilms: ids.length,
    totalSec,
    totalLabel: totalH > 0 ? totalH + "h " + totalM + "min" : totalM + " min",
    topGenre: topGenre ? topGenre[0] : "—",
    topGenreCount: topGenre ? topGenre[1] : 0,
    genreCount
  };
}

/* ============ TOP 10 PERSONNEL (par temps de visionnage) ============ */
function getTopFilms() {
  const hist = getHistory();
  return Object.keys(hist).map(Number)
    .map(id => ({ id, ...hist[id], item: CATALOG.find(i => i.id === id) }))
    .filter(e => e.item && e.dur > 0)
    .sort((a, b) => Math.min(b.cur, b.dur) - Math.min(a.cur, a.dur))
    .slice(0, 10);
}

/* ============ HISTORIQUE COMPLET ============ */
function getFullHistory() {
  const hist = getHistory();
  return Object.keys(hist).map(Number)
    .map(id => ({ id, ...hist[id], item: CATALOG.find(i => i.id === id) }))
    .filter(e => e.item)
    .sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

/* ============ FILMS SIMILAIRES ============ */
function getSimilarFilms(id) {
  const item = CATALOG.find(i => i.id === id);
  if (!item) return [];
  return CATALOG.filter(i => i.id !== id && i.genres.some(g => item.genres.includes(g)));
}

/* ============ RECHERCHE AVANCÉE ============ */
function advancedSearch(q, genre, yearMin, yearMax, ratingMin) {
  let items = [...CATALOG];
  if (q) {
    const ql = q.toLowerCase();
    items = items.filter(i =>
      (i.title || "").toLowerCase().includes(ql) ||
      (i.director || "").toLowerCase().includes(ql) ||
      (i.cast || []).some(c => (c || "").toLowerCase().includes(ql))
    );
  }
  if (genre && genre !== "Tous") items = items.filter(i => (i.genres || []).includes(genre));
  if (yearMin) items = items.filter(i => Number(i.year) >= Number(yearMin));
  if (yearMax) items = items.filter(i => Number(i.year) <= Number(yearMax));
  if (ratingMin) items = items.filter(i => Number(i.rating) >= Number(ratingMin));
  return items;
}

/* ============ INTERFACE v2 ============ */

/* Suggestions de recherche : liste cliquable sous la barre,
   navigation clavier (↑/↓/Entrée/Échap). */
function initSearchSuggestions() {
  const box = document.querySelector(".search-box");
  const input = document.getElementById("searchInput");
  if (!box || !input) return;

  const panel = document.createElement("div");
  panel.className = "search-suggest";
  box.appendChild(panel);

  let items = [];
  let highlight = -1;
  let open = false;

  function hide() { panel.classList.remove("show"); open = false; highlight = -1; }

  function updateSel() {
    panel.querySelectorAll(".ss-item").forEach((a, i) => a.classList.toggle("sel", i === highlight));
    const el = panel.querySelector(".ss-item.sel");
    if (el) el.scrollIntoView({ block: "nearest" });
  }

  function render() {
    panel.innerHTML = items.map((it, idx) => `
      <a class="ss-item ${idx === highlight ? "sel" : ""}" href="movie.html?id=${it.id}" title="${esc(it.title)}">
        <img src="${poster(it)}" alt="" loading="lazy">
        <div class="ss-info">
          <span class="ss-title">${esc(it.title)}</span>
          <span class="ss-sub">${it.year} · ⭐ ${it.rating.toFixed(1)} · ${esc((it.genres || [])[0] || "—")}</span>
        </div>
        <span class="ss-go">→</span>
      </a>`).join("");
    const links = [...panel.querySelectorAll(".ss-item")];
    links.forEach((a, i) => a.addEventListener("mouseenter", () => { highlight = i; updateSel(); }));
  }

  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { hide(); return; }
    items = CATALOG
      .filter(i =>
        (i.title || "").toLowerCase().includes(q) ||
        (i.director || "").toLowerCase().includes(q) ||
        (i.genres || []).some(g => g.toLowerCase().includes(q)) ||
        (i.cast || []).some(c => c.toLowerCase().includes(q)))
      .slice(0, 8);
    highlight = -1;
    if (!items.length) {
      panel.innerHTML = '<div class="search-suggest-empty">Aucun résultat pour « ' + esc(q) + ' »</div>';
      panel.classList.add("show"); open = true;
      return;
    }
    render();
    panel.classList.add("show"); open = true;
  });

  input.addEventListener("keydown", (e) => {
    if (!open) return;
    if (e.key === "Escape") { hide(); input.blur(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); highlight = (highlight + 1) % items.length; updateSel(); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); highlight = (highlight - 1 + items.length) % items.length; updateSel(); return; }
    if (e.key === "Enter") {
      if (highlight >= 0 && items[highlight]) { e.preventDefault(); location.href = "movie.html?id=" + items[highlight].id; return; }
      const q = input.value.trim();
      if (q && !/(^|\/)index\.html/i.test(location.pathname)) { e.preventDefault(); location.href = "index.html?q=" + encodeURIComponent(q); }
    }
  });

  document.addEventListener("click", (e) => { if (!e.target.closest(".search-box")) hide(); });
}

/* Bouton "retour en haut" (injecté, visible après 600px de scroll). */
function initBackToTop() {
  const btn = document.createElement("button");
  btn.id = "backTop";
  btn.setAttribute("aria-label", "Retour en haut");
  btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>';
  btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  document.body.appendChild(btn);
  let timer = null;
  const onScroll = () => {
    clearTimeout(timer);
    timer = setTimeout(() => btn.classList.toggle("show", window.scrollY > 600), 80);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

/* Ombrage de la navbar au défilement. */
function initScrollNavbar() {
  const nav = document.querySelector(".navbar");
  if (!nav) return;
  let timer = null;
  const onScroll = () => {
    clearTimeout(timer);
    timer = setTimeout(() => nav.classList.toggle("scrolled", window.scrollY > 10), 60);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

/* Apparition douce des sections au défilement. */
function initReveal() {
  if (!("IntersectionObserver" in window)) return;
  const els = [...document.querySelectorAll(".section, .legal-card, .page-head")];
  els.forEach(el => { if (el.offsetParent !== null) el.classList.add("reveal"); });
  if (!els.some(el => el.classList.contains("reveal"))) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add("reveal-in"); io.unobserve(en.target); }
    });
  }, { threshold: 0.06, rootMargin: "0px 0px -8% 0px" });
  els.forEach(el => { if (el.classList.contains("reveal")) io.observe(el); });
}

initSearchSuggestions();
initBackToTop();
initScrollNavbar();
initReveal();

/* PWA : enregistre le service worker (hors protocoles exotiques). */
(function () {
  if (!("serviceWorker" in navigator)) return;
  if (!/^https?:$/.test(location.protocol)) return;
  navigator.serviceWorker.register("sw.js").catch(() => {});
})();

/* global event delegation : une carte -> page détail, un favori -> toggle */
document.addEventListener("click", (e) => {
  const favBtn = e.target.closest("[data-fav]");
  if (favBtn) {
    e.stopPropagation();
    const id = Number(favBtn.dataset.fav);
    const added = toggleFavorite(id);
    favBtn.classList.toggle("active", added);
    const svg = favBtn.querySelector("svg");
    if (svg) svg.setAttribute("fill", added ? "currentColor" : "none");
    favBtn.title = added ? "Retirer des favoris" : "Ajouter à Ma Liste";
    return;
  }
  const card = e.target.closest(".card");
  if (card) {
    location.href = `movie.html?id=${card.dataset.id}`;
  }
});