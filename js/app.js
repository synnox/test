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
  return `
    <div class="card" data-id="${item.id}" data-title="${item.title}" data-genres="${item.genres.join(",")}" data-type="${item.type}">
      <div class="card-poster">
        <span class="type-badge ${item.type}">${item.type}</span>
        <img src="${poster(item)}" alt="${item.title}" loading="lazy">
        <span class="runtime">${meta}</span>
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
  localStorage.setItem("sn_history", JSON.stringify(list));
}

function updateProgress(id, cur, dur) {
  const list = getHistory();
  if (!list[id]) return;
  list[id].cur = cur;
  list[id].dur = dur;
  localStorage.setItem("sn_history", JSON.stringify(list));
}

function removeProgress(id) {
  const list = getHistory();
  delete list[id];
  localStorage.setItem("sn_history", JSON.stringify(list));
}

function isNearEnd(id) {
  const h = getHistory()[id];
  if (!h || !h.dur) return false;
  return h.cur >= h.dur - 40;
}

function getHistory() {
  try { return JSON.parse(localStorage.getItem("sn_history") || "{}"); } catch (e) { return {}; }
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

/* global event delegation : une carte -> page détail */
document.addEventListener("click", (e) => {
  const card = e.target.closest(".card");
  if (card) {
    location.href = `movie.html?id=${card.dataset.id}`;
  }
});