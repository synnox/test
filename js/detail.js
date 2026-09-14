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
  const h = getHistory()[item.id];
  const hasProgress = h && h.dur > 0 && h.cur > 5 && h.cur < h.dur - 40;
  const progressPct = hasProgress ? Math.round((h.cur / h.dur) * 100) : 0;
  const progressLabel = hasProgress ? fmtTime(h.cur) : "";

  document.getElementById("detailContent").innerHTML = `
    <div class="detail-poster"><img src="${poster(item)}" alt="${item.title}"></div>
    <div class="detail-info">
      <h1>${item.title}</h1>
      <div class="meta">
        <span class="star">${starSVG()} ${item.rating.toFixed(1)}</span>
        <span>${item.year}</span>
        <span class="pill">Film</span>
        <span class="pill">${item.duration}</span>
        <span class="pill">HD • VF</span>
      </div>
      ${hasProgress ? `
      <div class="detail-progress">
        <div class="detail-progress-bar"><div class="detail-progress-fill" style="width:${progressPct}%"></div></div>
        <span class="detail-progress-text">${progressPct}% vu — ${progressLabel}</span>
      </div>` : ""}
      <p class="synopsis">${item.synopsis}</p>
      <div class="extra">
        <div><b>Genres :</b> ${item.genres.join(" • ")}</div>
        <div><b>Réalisation :</b> ${item.director}</div>
        <div><b>Avec :</b> ${item.cast.join(", ")}</div>
      </div>
      <div class="actions">
        ${hasProgress
          ? `<a class="btn btn-primary" href="#playerWrap" onclick="playResume(event)">${playSVG()} Reprendre à ${progressLabel}</a>
             <a class="btn btn-ghost" href="#playerWrap" onclick="playFirst(event)">${playSVG()} Recommencer</a>`
          : `<a class="btn btn-primary" href="#playerWrap" onclick="playFirst(event)">${playSVG()} Regarder en HD</a>`
        }
        <button class="btn btn-ghost btn-fav-detail ${isFavorite(item.id) ? 'active' : ''}" id="btnFavDetail">
          <svg viewBox="0 0 24 24" fill="${isFavorite(item.id) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          ${isFavorite(item.id) ? 'Favori' : 'Favori'}
        </button>
        <button class="btn btn-ghost" onclick="shareItem()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
          Partager
        </button>
      </div>
    </div>`;
}

function play(url, label) {
  const wrap = document.getElementById("playerWrap");
  const video = document.getElementById("player");
  document.getElementById("nowPlaying").textContent = label;
  wrap.style.display = "";
  video.src = proxyURL(url);
  video.load();
  video.play().catch(() => {});
  wrap.scrollIntoView({ behavior: "smooth", block: "start" });
  // NE PAS réinitialiser la position - la reprise se fait dans loadedmetadata
}

function playFirst(e) {
  if (e) e.preventDefault();
  // Recommencer explicitement : on remet à 0
  saveProgress(item.id, 0, 0);
  play(item.source, `${item.title} — Film complet`);
}

function playResume(e) {
  if (e) e.preventDefault();
  // Reprendre : on ne touche pas à l'historique, le loadedmetadata va restaurer
  play(item.source, `${item.title} — Film complet`);
}

function shareItem() {
  const url = location.href;
  if (navigator.share) navigator.share({ title: item.title, url }).catch(() => {});
  else { navigator.clipboard.writeText(url); toast("Lien copié dans le presse-papiers !"); }
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

/* ------- tracking de lecture ------- */
(function () {
  if (!item) return;
  const video = document.getElementById("player");
  if (!video) return;
  let saveTimer = null;
  let hasResumed = false;

  // Ne PAS écraser la position pendant le chargement :
  // loadedmetadata se déclenche avec currentTime = 0 (via le proxy),
  // ce qui détruirait la position sauvegardée avant la reprise.
  video.addEventListener("loadedmetadata", () => {
    tryResume();
  });

  function tryResume() {
    if (hasResumed) return;
    const h = getHistory()[item.id];
    if (h && h.cur > 5 && h.cur < h.dur - 40) {
      video.currentTime = h.cur;
      toast("Reprise à " + fmtTime(h.cur));
      hasResumed = true;
    }
  }

  video.addEventListener("canplay", tryResume);
  video.addEventListener("playing", tryResume);

  video.addEventListener("timeupdate", () => {
    if (video.duration && video.currentTime >= video.duration - 40) {
      if (!isFinished(item.id)) {
        finishProgress(item.id);
        toast("Film terminé — retrouvé dans l'historique");
      }
      return;
    }
    // tant que la reprise n'est pas appliquée, ignorer currentTime ≈ 0
    if (!hasResumed && video.currentTime < 5) return;
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      updateProgress(item.id, video.currentTime, video.duration);
      saveTimer = null;
    }, 4000);
  });

  video.addEventListener("ended", () => {
    if (!isFinished(item.id)) {
      finishProgress(item.id);
      toast("Film terminé !");
    }
  });
})();

/* ---------- bouton favori ---------- */
(function () {
  if (!item) return;
  const btn = document.getElementById("btnFavDetail");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const added = toggleFavorite(item.id);
    btn.classList.toggle("active", added);
    btn.querySelector("svg").setAttribute("fill", added ? "currentColor" : "none");
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="${added ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> ${added ? 'Favori' : 'Favori'}`;
  });
})();

/* ---------- films similaires ---------- */
(function () {
  if (!item) return;
  const similar = getSimilarFilms(item.id).slice(0, 10);
  if (!similar.length) return;
  const sec = document.getElementById("similarSection");
  if (sec) {
    sec.style.display = "";
    renderGrid(similar, "similarGrid", "");
  }
})();