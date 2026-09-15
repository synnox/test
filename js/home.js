/* ============ page d'accueil ============ */

const GENRE_ORDER = ["Action", "Science-Fiction", "Drame", "Comédie", "Policier", "Horreur", "Thriller", "Aventure", "Fantastique", "Romance", "Histoire", "Anime"];
const genres = GENRE_ORDER.filter(g => CATALOG.some(i => i.genres.includes(g)));
let currentFilter = "Tous";
let query = (new URLSearchParams(location.search).get("q") || "").trim();

/* ---------- tri du catalogue ---------- */
const SORTERS = {
  default: () => 0,
  title: (a, b) => String(a.title).localeCompare(String(b.title), "fr", { sensitivity: "base" }),
  rating: (a, b) => Number(a.rating) - Number(b.rating),
  year: (a, b) => Number(a.year) - Number(b.year),
  duration: (a, b) => durationSec(a.duration) - durationSec(b.duration),
};
function durationSec(s) {
  s = String(s || "");
  const h = /(\d+)\s*h/i.exec(s);
  const m = /(\d+)\s*(?:min|m\b)/i.exec(s);
  return (h ? +h[1] * 3600 : 0) + (m ? +m[1] * 60 : 0);
}
let currentSort = (new URLSearchParams(location.search).get("sort") || "default");
let sortAsc = (new URLSearchParams(location.search).get("dir") || "asc") !== "desc";
function applySort(list) {
  const f = SORTERS[currentSort] || SORTERS.default;
  return [...list].sort((a, b) => {
    const c = f(a, b);
    return c === 0 ? 0 : (sortAsc ? c : -c);
  });
}

function heroItem() {
  return CATALOG.find(i => i.featured) || CATALOG[0];
}

function heroHeart(fav) {
  return `<svg viewBox="0 0 24 24" fill="${fav ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
}

function renderHero(item, tag) {
  const bg = document.getElementById("heroBg");
  if (bg && item.poster) bg.style.setProperty("--img", `url("${item.poster}")`);
  const hero = document.getElementById("heroContent");
  const t = esc(item.title);
  const syn = esc(item.synopsis);
  const dur = esc(item.duration);
  hero.innerHTML = `
    <div class="hero-box">
      <span class="hero-tag"><span class="pulse"></span> ${esc(tag) || "À l'affiche"}</span>
      <h1>${t}</h1>
      <div class="meta">
        <span class="star">${starSVG()} ${item.rating.toFixed(1)}</span>
        <span>${item.year}</span>
        <span class="pill">${item.type === "movie" ? "Film" : "Série"}</span>
        ${item.type === "movie"
          ? `<span class="pill">${dur}</span>`
          : `<span class="pill">${item.seasons.length} saison${item.seasons.length > 1 ? "s" : ""}</span>`}
        <span class="pill">HD • VF</span>
      </div>
      <p class="desc">${syn}</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="movie.html?id=${item.id}">${playSVG()} Regarder en HD</a>
        <a class="btn btn-ghost" href="movie.html?id=${item.id}">${infoSVG()} Détails</a>
        <button class="btn btn-ghost hero-fav ${isFavorite(item.id) ? "active" : ""}" id="heroFav" title="Ajouter / retirer de Ma Liste">${heroHeart(isFavorite(item.id))} ${isFavorite(item.id) ? "Dans Ma Liste" : "Ma Liste"}</button>
        <button class="btn btn-ghost" id="btnSurprise" title="Surprends-moi !">🎲 Surprends-moi</button>
      </div>
    </div>
    <div class="hero-poster"><img src="${poster(item)}" alt="${t}"></div>`;
  const sb = document.getElementById("btnSurprise");
  if (sb) sb.addEventListener("click", () => {
    const r = getRandomFilm();
    location.href = `movie.html?id=${r.id}`;
  });
  const hf = document.getElementById("heroFav");
  if (hf) hf.addEventListener("click", () => {
    const added = toggleFavorite(item.id);
    hf.classList.toggle("active", added);
    hf.innerHTML = heroHeart(added) + (added ? " Dans Ma Liste" : " Ma Liste");
  });
}

function renderTop() {
  const section = document.getElementById("topSection");
  const top = getTopFilms();
  if (!top.length) { section.style.display = "none"; return; }
  section.style.display = "";
  renderGrid(top.map(e => e.item), "topGrid", "");
}

function renderGenres() {
  const row = document.getElementById("genreRow");
  row.innerHTML = genres.map((g, i) => {
    const [c1, c2] = posterGradient(i * 7 + 2);
    return `
    <div class="genre-card" data-genre="${esc(g)}" style="background:linear-gradient(135deg, ${c1}, ${c2})">
      <span>${esc(g)}</span>
    </div>`;
  }).join("");
}

function renderContinue() {
  const section = document.getElementById("continueSection");
  const films = getUnfinishedFilms();
  if (!films.length) { section.style.display = "none"; return; }
  section.style.display = "";
  renderGrid(films, "continueRow");
}

function applyFilters() {
  const yMin = document.getElementById("advYearMin") ? document.getElementById("advYearMin").value : "";
  const yMax = document.getElementById("advYearMax") ? document.getElementById("advYearMax").value : "";
  const rMin = document.getElementById("advRating") ? document.getElementById("advRating").value : "0";
  const genre = (currentFilter === "Films" || currentFilter === "Tous") ? "Tous" : currentFilter;
  let items = advancedSearch(query, genre, yMin || 0, yMax || 9999, rMin || 0);
  if (currentFilter === "Films") items = items.filter(i => i.type === "movie");
  items = applySort(items);
  if (query) {
    document.getElementById("catalogTitle").textContent = `Résultats pour « ${query} »`;
  } else {
    document.getElementById("catalogTitle").textContent = "Catalogue";
  }
  renderGrid(items, "catalogGrid", "Aucun résultat trouvé.");
}

function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll("#filters .chip").forEach(c => c.classList.toggle("active", c.dataset.filter === filter || (filter === "Tous" && c.dataset.filter === "Tous")));
  document.querySelectorAll(".nav-links a").forEach(a => a.classList.toggle("active", a.dataset.filter === filter));
  applyFilters();
  updateURL(query, filter);
}

/* global click : genre cards */
document.addEventListener("click", (e) => {
  const gc = e.target.closest(".genre-card");
  if (gc) { query = ""; document.getElementById("searchInput").value = ""; setFilter(gc.dataset.genre); window.scrollTo({ top: document.getElementById("catalogGrid").offsetTop - 120, behavior: "smooth" }); }
});

/* nav links (seuls les liens data-filter gèrent les filtres) */
document.querySelectorAll(".nav-links a").forEach(a => {
  if (!a.dataset.filter) return;
  a.addEventListener("click", (e) => { e.preventDefault(); setFilter(a.dataset.filter); });
});

/* filters */
document.querySelectorAll("#filters .chip").forEach(c => {
  c.addEventListener("click", () => setFilter(c.dataset.filter));
});

/* search */
const searchInput = document.getElementById("searchInput");
let searchTimer;
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { query = searchInput.value.trim(); setFilter(currentFilter); }, 220);
});

/* advanced search listeners */
["advYearMin", "advYearMax", "advRating"].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("change", () => setFilter(currentFilter));
});
const advReset = document.getElementById("advReset");
if (advReset) advReset.addEventListener("click", () => {
  const yMin = document.getElementById("advYearMin");
  const yMax = document.getElementById("advYearMax");
  const rMin = document.getElementById("advRating");
  if (yMin) yMin.value = "";
  if (yMax) yMax.value = "";
  if (rMin) rMin.value = "0";
  setFilter(currentFilter);
});

/* tri du catalogue */
const sortSel = document.getElementById("sortSel");
const sortDir = document.getElementById("sortDir");
if (sortSel) {
  sortSel.value = SORTERS[currentSort] ? currentSort : "default";
  if (sortDir) sortDir.textContent = sortAsc ? "↓" : "↑";
  sortSel.addEventListener("change", () => {
    currentSort = sortSel.value;
    setFilter(currentFilter);
  });
}
if (sortDir) sortDir.addEventListener("click", () => {
  sortAsc = !sortAsc;
  sortDir.textContent = sortAsc ? "↓" : "↑";
  setFilter(currentFilter);
});

/* j'ai de la chance */
const btnLucky = document.getElementById("btnLucky");
if (btnLucky) btnLucky.addEventListener("click", () => {
  const r = getRandomFilm();
  if (r) location.href = "movie.html?id=" + r.id;
});

if (searchInput && query) searchInput.value = query;

renderHero(getDailyPick(), "Film du jour");
renderGenres();
renderContinue();
renderTop();
applyFilters();