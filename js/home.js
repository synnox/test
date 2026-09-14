/* ============ page d'accueil ============ */

const genres = [...new Set(CATALOG.flatMap(i => i.genres))];
let currentFilter = "Tous";
let query = "";

function heroItem() {
  return CATALOG.find(i => i.featured) || CATALOG[0];
}

function renderHero(item, tag) {
  const bg = document.getElementById("heroBg");
  if (bg && item.poster) bg.style.setProperty("--img", `url("${item.poster}")`);
  const hero = document.getElementById("heroContent");
  hero.innerHTML = `
    <div class="hero-box">
      <span class="hero-tag"><span class="pulse"></span> ${tag || "À l'affiche"}</span>
      <h1>${item.title}</h1>
      <div class="meta">
        <span class="star">${starSVG()} ${item.rating.toFixed(1)}</span>
        <span>${item.year}</span>
        <span class="pill">${item.type === "movie" ? "Film" : "Série"}</span>
        ${item.type === "movie"
          ? `<span class="pill">${item.duration}</span>`
          : `<span class="pill">${item.seasons.length} saison${item.seasons.length > 1 ? "s" : ""}</span>`}
        <span class="pill">HD • VF</span>
      </div>
      <p class="desc">${item.synopsis}</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="movie.html?id=${item.id}">${playSVG()} Regarder en HD</a>
        <a class="btn btn-ghost" href="movie.html?id=${item.id}">${infoSVG()} Détails</a>
        <button class="btn btn-ghost" id="btnSurprise" title="Surprends-moi !">🎲 Surprends-moi</button>
      </div>
    </div>
    <div class="hero-poster"><img src="${poster(item)}" alt="${item.title}"></div>`;
  const sb = document.getElementById("btnSurprise");
  if (sb) sb.addEventListener("click", () => {
    const r = getRandomFilm();
    location.href = `movie.html?id=${r.id}`;
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
  const emo = { "Action": "🎬", "Science-Fiction": "🚀", "Drame": "🎭", "Comédie": "😂", "Policier": "🕵️‍♂️", "Histoire": "🏛️", "Fantaisie": "✨", "Horreur": "🎃", "Thriller": "🔪", "Romance": "❤️", "Animation": "🐭" };
  row.innerHTML = genres.map((g, i) => {
    const [c1, c2] = posterGradient(i * 7 + 2);
    return `
    <div class="genre-card" data-genre="${g}" style="background:linear-gradient(135deg, ${c1}, ${c2})">
      <span>${emo[g] || "🎞️"} ${g}</span>
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

renderHero(getDailyPick(), "Film du jour");
renderGenres();
renderContinue();
renderTop();
applyFilters();