/* ============ page détail + lecteur ============ */

const params = new URLSearchParams(location.search);
const item = itemJSON(params.get("id"));

if (!item) {
  document.title = "Introuvable — Sn Streaming";
  document.getElementById("detailContent").innerHTML = `
    <div class="empty" style="width:100%">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>
      <p>Contenu introuvable.</p>
      <a class="btn btn-primary" style="margin-top:16px" href="index.html">Retour à l'accueil</a>
    </div>`;
} else {
  document.title = `${item.title} — Sn Streaming`;
  renderDetail(item);
}

function renderDetail(item) {
  document.title = `${item.title} — Sn Streaming`;
  document.getElementById("detailContent").innerHTML = `
    <div class="detail-poster"><img src="${poster(item)}" alt="${item.title}"></div>
    <div class="detail-info">
      <h1>${item.title}</h1>
      <div class="meta">
        <span class="star">${starSVG()} ${item.rating.toFixed(1)}</span>
        <span>${item.year}</span>
        <span class="pill">${item.type === "movie" ? "Film" : "Série"}</span>
        ${item.type === "movie" ? `<span class="pill">${item.duration}</span>` : `<span class="pill">${item.seasons.length} saison${item.seasons.length > 1 ? "s" : ""}</span>`}
        <span class="pill">HD • VF</span>
      </div>
      <p class="synopsis">${item.synopsis}</p>
      <div class="extra">
        <div><b>Genres :</b> ${item.genres.join(" • ")}</div>
        <div><b>Réalisation :</b> ${item.director}</div>
        <div><b>Avec :</b> ${item.cast.join(", ")}</div>
      </div>
      <div class="actions">
        <a class="btn btn-primary" href="#playerWrap" onclick="playFirst(event)">${playSVG()} Regarder en HD</a>
        <button class="btn btn-ghost" onclick="shareItem()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
          Partager
        </button>
      </div>
    </div>`;
}

function playFirst(e) {
  if (e) e.preventDefault();
  if (item.type === "series") {
    playEpisode(item.seasons[0].episodes[0], item.seasons[0].number);
  } else {
    play(item.source, `${item.title} — Film complet`);
  }
}

function play(url, label) {
  const wrap = document.getElementById("playerWrap");
  const video = document.getElementById("player");
  document.getElementById("nowPlaying").textContent = label;
  wrap.style.display = "";
  video.src = url;
  video.play().catch(() => {});
  wrap.scrollIntoView({ behavior: "smooth", block: "start" });
  saveProgress(item.id, 0, 0);
}

function shareItem() {
  const url = location.href;
  if (navigator.share) navigator.share({ title: item.title, url }).catch(() => {});
  else { navigator.clipboard.writeText(url); toast("Lien copié dans le presse-papiers !"); }
}

/* ------- séries : saisons + épisodes ------- */
function renderEpisodes() {
  const section = document.getElementById("episodesSection");
  if (item.type !== "series") return;
  section.style.display = "";

  const tabs = item.seasons.map((s, i) =>
    `<button class="chip ${i === 0 ? "active" : ""}" data-season="${s.number}">Saison ${s.number}</button>`).join("");

  section.innerHTML = `
    <div class="section-head"><h2>Épisodes</h2></div>
    <div class="season-tabs" id="seasonTabs">${tabs}</div>
    <div class="episode-list" id="episodeList"></div>`;

  renderSeason(item.seasons[0].number);

  section.querySelectorAll("#seasonTabs .chip").forEach(c => {
    c.addEventListener("click", () => {
      section.querySelectorAll("#seasonTabs .chip").forEach(x => x.classList.remove("active"));
      c.classList.add("active");
      renderSeason(Number(c.dataset.season));
    });
  });
}

function renderSeason(seasonNum) {
  const season = item.seasons.find(s => s.number === seasonNum);
  const list = document.getElementById("episodeList");
  list.innerHTML = season.episodes.map(ep => `
    <div class="episode-item" data-src="${ep.source}" data-season="${seasonNum}" data-ep="${ep.number}">
      <div class="ep-num">${ep.number}</div>
      <div class="ep-info">
        <h4>Épisode ${ep.number} — ${ep.title}</h4>
        <span>${ep.duration} • HD</span>
      </div>
      <div class="ep-play">${playSVG()}</div>
    </div>`).join("");

  list.querySelectorAll(".episode-item").forEach(el => {
    el.addEventListener("click", () => {
      list.querySelectorAll(".episode-item").forEach(x => x.classList.remove("active"));
      el.classList.add("active");
      const src = el.dataset.src;
      const label = `${item.title} — S${el.dataset.season} E${el.dataset.ep}`;
      play(src, label);
    });
  });
}

/* recherche sur la page détail */
const searchInput = document.getElementById("searchInput");
let searchTimer;
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const q = searchInput.value.trim();
    if (q) location.href = `index.html?q=${encodeURIComponent(q)}`;
  }, 500);
});

if (item) renderEpisodes();

/* ------- tracking de lecture : sauvegarde position + auto-suppression à -40s ------- */
(function () {
  if (!item) return;
  const video = document.getElementById("player");
  if (!video) return;
  let saveTimer = null;

  video.addEventListener("loadedmetadata", () => {
    updateProgress(item.id, video.currentTime, video.duration);
    const h = getHistory()[item.id];
    if (h && h.cur > 5 && h.cur < h.dur - 40) {
      video.currentTime = h.cur;
      toast("Reprise à " + fmtTime(h.cur));
    }
  });

  video.addEventListener("timeupdate", () => {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      saveProgress(item.id, video.currentTime, video.duration);
      if (video.duration && video.currentTime >= video.duration - 40) {
        removeProgress(item.id);
        toast("Film terminé — retiré de la liste");
      }
      saveTimer = null;
    }, 4000);
  });

  video.addEventListener("ended", () => {
    removeProgress(item.id);
    toast("Film terminé !");
  });
})();