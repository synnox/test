/* ============ page d'accueil ============ */

const genres = [...new Set(CATALOG.flatMap(i => i.genres))];
let currentFilter = "Tous";
let query = "";

function heroItem() {
  return CATALOG.find(i => i.featured) || CATALOG[0];
}

function renderHero(item) {
  const hero = document.getElementById("heroContent");
  hero.innerHTML = `
    <span class="hero-tag"><span class="pulse"></span> À l'affiche sur Sn Streaming</span>
    <h1>${item.title}</h1>
    <div class="meta">
      <span class="star">${starSVG()} ${item.rating.toFixed(1)}</span>
      <span>${item.year}</span>
      <span class="pill">${item.type === "movie" ? "Film" : "Série"}</span>
      ${item.type === "movie"
        ? `<span class="pill">${item.duration}</span>`
        : `<span class="pill">${item.seasons.length} saison${item.seasons.length > 1 ? "s" : ""}</span>`}
      <span class="pill">HD</span>
    </div>
    <p class="desc">${item.synopsis}</p>
    <div class="hero-actions">
      <a class="btn btn-primary" href="movie.html?id=${item.id}">${playSVG()} Regarder en HD</a>
      <a class="btn btn-ghost" href="movie.html?id=${item.id}">Détails ↑</a>
    </div>`;
}

function renderGenres() {
  const row = document.getElementById("genreRow");
  const cycle = ["01", "02", "03", "04", "05", "06", "07", "08"];
  row.innerHTML = genres.map((g, i) => `
    <div class="genre-card" data-genre="${g}" style="background:linear-gradient(135deg, ${posterGradient(i * 3)[0]}, #0f1524)">
      <span>${g} <small style="font-size:11px;opacity:.6">#${cycle[i % cycle.length]}</small></span>
    </div>`).join("");
}

function renderContinue() {
  const section = document.getElementById("continueSection");
  const history = getHistory();
  const ids = Object.keys(history).map(Number).filter(id => CATALOG.some(i => i.id === id))
    .sort((a, b) => history[b] - history[a]);
  if (!ids.length) { section.style.display = "none"; return; }
  section.style.display = "";
  renderGrid(ids.map(id => CATALOG.find(i => i.id === id)), "continueRow");
}

function applyFilters() {
  let items = [...CATALOG];
  if (currentFilter === "Films") items = items.filter(i => i.type === "movie");
  else if (currentFilter === "Séries") items = items.filter(i => i.type === "series");
  else if (currentFilter !== "Tous") items = items.filter(i => i.genres.includes(currentFilter));
  if (query) {
    const q = query.toLowerCase();
    items = items.filter(i =>
      i.title.toLowerCase().includes(q) ||
      i.genres.some(g => g.toLowerCase().includes(q)) ||
      (i.cast || []).some(c => c.toLowerCase().includes(q))
    );
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

/* nav links */
document.querySelectorAll(".nav-links a").forEach(a => {
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

renderHero(heroItem());
renderGenres();
renderContinue();
applyFilters();