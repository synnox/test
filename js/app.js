/* ============ utilitaires SN Streaming ============ */

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

/* vidéos protégées (sibnet) : on les lit via le proxy local
   (cf. server.js) qui relaie le flux avec le bon Referer. */
function proxyURL(url) {
  if (!url) return url;
  if (/sibnet\.ru/i.test(url)) {
    const base = location.protocol && /^https?:$/.test(location.protocol)
      ? location.origin
      : "http://127.0.0.1:8766";
    return base + "/proxy?url=" + encodeURIComponent(url);
  }
  return url;
}

function infoSVG() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';
}

/* menu burger (mobile) */
(function () {
  const burger = document.getElementById("burger");
  const links = document.querySelector(".nav-links");
  if (!burger || !links) return;
  burger.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    burger.setAttribute("aria-expanded", open ? "true" : "false");
  });
  links.addEventListener("click", (e) => {
    if (e.target.closest("a")) {
      links.classList.remove("open");
      burger.setAttribute("aria-expanded", "false");
    }
  });
})();

/* theme toggle (bleu & noir <=> bleu & blanc) */
(function () {
  const btn = document.getElementById("themeToggle");
  if (!btn) return;
  const saved = localStorage.getItem("sn_theme");
  if (saved === "light") document.documentElement.setAttribute("data-theme", "light");
  btn.addEventListener("click", () => {
    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    document.documentElement.setAttribute("data-theme", isLight ? "" : "light");
    localStorage.setItem("sn_theme", isLight ? "" : "light");
  });
})();

function itemJSON(id) {
  return CATALOG.find(i => i.id === Number(id));
}

function cardHTML(item) {
  const star = `<span class="star">${starSVG()} ${item.rating.toFixed(1)}</span>`;
  const meta = item.type === "movie" ? item.duration : `${item.seasons.length}S`;
  const h = getHistory()[item.id];
  const pct = h && h.dur > 0 ? Math.min(100, Math.round((h.cur / h.dur) * 100)) : 0;
  const fav = isFavorite(item.id);
  return `
    <div class="card" data-id="${item.id}" data-title="${item.title}" data-genres="${item.genres.join(",")}" data-type="${item.type}">
      <div class="card-poster">
        <span class="type-badge ${item.type}">${item.type}</span>
        <img src="${poster(item)}" alt="${item.title}" loading="lazy">
        <span class="runtime">${meta}</span>
        <button class="card-fav ${fav ? 'active' : ''}" data-fav="${item.id}" title="${fav ? 'Retirer des favoris' : 'Ajouter à Ma Liste'}">
          <svg viewBox="0 0 24 24" fill="${fav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
        <div class="play-overlay"><span>${playSVG()}</span></div>
        ${pct > 0 ? `<div class="card-progress"><div class="card-progress-fill" style="width:${pct}%"></div></div>` : ""}
      </div>
      <div class="card-body">
        <h3>${item.title}</h3>
        <div class="sub">${star}<span>${item.year}</span><span>${item.genres[0]}</span></div>
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

function toast(msg) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 2400);
}

/* historique de lecture : cookie par utilisateur (Accounts.historyKey)
   + localStorage en secours. Chaque compte a sa propre watchlist. */
function setHistoryCookie(list) {
  const d = new Date();
  d.setTime(d.getTime() + 365 * 864e5);
  document.cookie =
    Accounts.historyKey() + "=" + encodeURIComponent(JSON.stringify(list)) +
    "; expires=" + d.toUTCString() + "; path=/; SameSite=Lax";
}

function saveAllHistory(list) {
  setHistoryCookie(list);
  try { localStorage.setItem(Accounts.historyKey(), JSON.stringify(list)); } catch (e) {}
}

function getHistory() {
  const key = Accounts.historyKey();
  try {
    const c = Accounts.getCookie(key);
    if (c) return JSON.parse(c);
  } catch (e) {}
  try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch (e) { return {}; }
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
  const qs = params.toString();
  history.replaceState(null, "", qs ? "?" + qs : location.pathname);
}

/* ============ FAVORIS (ma liste perso) ============ */
function getFavoritesKey() {
  const hk = Accounts.historyKey();
  return hk === "sn_history" ? "sn_fav" : "sn_fav_" + hk.split("_").slice(2).join("_");
}
function getFavorites() {
  try { return JSON.parse(Accounts.getCookie(getFavoritesKey()) || "[]"); } catch (e) { return []; }
}
function saveFavorites(arr) {
  const d = new Date(); d.setTime(d.getTime() + 365 * 864e5);
  document.cookie = getFavoritesKey() + "=" + encodeURIComponent(JSON.stringify(arr)) + "; expires=" + d.toUTCString() + "; path=/; SameSite=Lax";
}
function isFavorite(id) { return getFavorites().includes(id); }
function toggleFavorite(id) {
  const fav = getFavorites();
  const i = fav.indexOf(id);
  if (i === -1) { fav.push(id); toast("Ajouté aux favoris"); }
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
  const d = new Date();
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  let h = seed;
  for (let i = 0; i < 8; i++) { h = ((h << 5) + h + (i * 31)) | 0; }
  return CATALOG[Math.abs(h) % CATALOG.length];
}

/* ============ SURPRENDS-MOI ============ */
function getRandomFilm() { return CATALOG[Math.floor(Math.random() * CATALOG.length)]; }

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
      i.title.toLowerCase().includes(ql) ||
      i.director.toLowerCase().includes(ql) ||
      i.cast.some(c => c.toLowerCase().includes(ql))
    );
  }
  if (genre && genre !== "Tous") items = items.filter(i => i.genres.includes(genre));
  if (yearMin) items = items.filter(i => i.year >= Number(yearMin));
  if (yearMax) items = items.filter(i => i.year <= Number(yearMax));
  if (ratingMin) items = items.filter(i => i.rating >= Number(ratingMin));
  return items;
}

/* global event delegation : une carte -> page détail, un favori -> toggle */
document.addEventListener("click", (e) => {
  const favBtn = e.target.closest("[data-fav]");
  if (favBtn) {
    e.stopPropagation();
    const id = Number(favBtn.dataset.fav);
    const added = toggleFavorite(id);
    favBtn.classList.toggle("active", added);
    favBtn.querySelector("svg").setAttribute("fill", added ? "currentColor" : "none");
    favBtn.title = added ? "Retirer des favoris" : "Ajouter à Ma Liste";
    return;
  }
  const card = e.target.closest(".card");
  if (card) {
    location.href = `movie.html?id=${card.dataset.id}`;
  }
});