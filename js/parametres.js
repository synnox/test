/* ============ page Paramètres : compte + watchlist ============ */
(function () {
  const acctBox = document.getElementById("acctBox");
  const wlList = document.getElementById("wlList");
  const wlNote = document.getElementById("wlNote");
  const paramSub = document.getElementById("paramSub");

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* ---------- compte ---------- */
  const forcedLogin = location.search.includes("login=1");

  function renderAccount() {
    const u = Accounts.currentUser();
    if (u) {
      paramSub.textContent = "Connecté — " + u;
      acctBox.innerHTML = `
        <div class="acct-on">
          <div class="acct-on-ico">👤</div>
          <div class="acct-on-info">
            <h3>${esc(u)}</h3>
            <p>Connecté. Ta watchlist est personnelle et sauvegardée dans un cookie.</p>
            <div class="acct-btns">
              <button type="button" class="btn btn-ghost btn-sm" id="btnLogout">Se déconnecter</button>
              <button type="button" class="btn btn-ghost btn-sm btn-danger" id="btnDeleteAcct">Supprimer mon compte</button>
            </div>
          </div>
        </div>`;
      document.getElementById("btnLogout").addEventListener("click", () => {
        Accounts.logout();
        toast("Déconnecté !");
        afterAuth();
      });
      document.getElementById("btnDeleteAcct").addEventListener("click", () => {
        if (!confirm("Supprimer ton compte et toute ta watchlist ? Cette action est irréversible.")) return;
        Accounts.removeAccount();
        toast("Compte supprimé !");
        afterAuth();
      });
    } else {
      paramSub.textContent = forcedLogin
        ? "Connecte-toi ou crée un compte pour commencer."
        : "Compte & watchlist personnelle";
      acctBox.innerHTML = `
        ${forcedLogin ? '<p class="login-welcome">Tu dois te connecter pour accéder au site. Tu peux aussi <b>créer un compte</b> en quelques secondes.</p>' : ''}
        <div class="acct-forms">
          <form id="loginForm" class="acct-form">
            <h3>Se connecter</h3>
            <label>Pseudo <input name="pseudo" autocomplete="username" required></label>
            <label>Mot de passe <input type="password" name="mdp" autocomplete="current-password" required></label>
            <div class="form-err" id="loginErr"></div>
            <button class="btn btn-primary" type="submit">Se connecter</button>
          </form>
          <form id="signupForm" class="acct-form">
            <h3>Créer un compte</h3>
            <label>Pseudo <input name="pseudo" autocomplete="username" required minlength="2"></label>
            <label>Mot de passe <input type="password" name="mdp" autocomplete="new-password" required minlength="2"></label>
            <label>Confirmer <input type="password" name="mdp2" autocomplete="new-password" required></label>
            <div class="form-err" id="signupErr"></div>
            <button class="btn btn-primary" type="submit">Créer mon compte</button>
          </form>
        </div>`;
      bindForms();
    }
  }

  function bindForms() {
    const lf = document.getElementById("loginForm");
    const sf = document.getElementById("signupForm");

    if (lf) lf.addEventListener("submit", (e) => {
      e.preventDefault();
      const err = Accounts.login(lf.pseudo.value, lf.mdp.value);
      document.getElementById("loginErr").textContent = err || "";
      if (!err) { toast("Connecté !"); afterAuth(); }
    });

    if (sf) sf.addEventListener("submit", (e) => {
      e.preventDefault();
      const errEl = document.getElementById("signupErr");
      errEl.textContent = "";
      if (sf.mdp.value !== sf.mdp2.value) {
        errEl.textContent = "Les mots de passe ne correspondent pas.";
        return;
      }
      const err = Accounts.register(sf.pseudo.value, sf.mdp.value);
      errEl.textContent = err || "";
      if (!err) { toast("Compte créé !"); afterAuth(); }
    });
  }

  function afterAuth() {
    Accounts.updateNav();
    renderAccount();
    renderWatchlist();
    renderStats();
    if (Accounts.isLoggedIn() && location.search.includes("login=1")) {
      history.replaceState(null, "", "parametres.html");
    }
  }

  /* ---------- statistiques ---------- */
  function renderStats() {
    const box = document.getElementById("statsRow");
    if (!box) return;
    const s = getStats();
    box.innerHTML = `
      <div class="stat"><b>${s.nbFilms}</b><span>films vus</span></div>
      <div class="stat"><b>${s.totalLabel}</b><span>temps de visionnage</span></div>
      <div class="stat"><b>${s.topGenre}</b><span>genre favori (${s.topGenreCount})</span></div>`;
  }

  /* ---------- watchlist (films en cours, pas terminés) ---------- */
  function renderWatchlist() {
    const history = getHistory();
    const u = Accounts.currentUser();
    wlNote.textContent = u
      ? "Ta liste — films commencés et PAS terminés. Les films finis vont dans l'historique."
      : "Liste invité. Crée un compte pour avoir TON propre watchlist.";

    const ids = Object.keys(history)
      .map(Number)
      .filter(id => CATALOG.some(i => i.id === id) && !isFinished(id))
      .sort((a, b) => (history[b].ts || 0) - (history[a].ts || 0));

    if (!ids.length) {
      wlList.innerHTML = `
        <div class="empty" style="width:100%">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>
          <p>Aucun film en cours.</p>
          <a class="btn btn-primary" style="margin-top:14px" href="index.html">Voir le catalogue</a>
        </div>`;
      return;
    }

    wlList.innerHTML = ids.map(id => {
      const it = CATALOG.find(i => i.id === id);
      const h = history[id];
      const pct = h && h.dur > 0 ? Math.min(100, Math.round((h.cur / h.dur) * 100)) : 0;
      const label = pct > 0 ? pct + "% — " + fmtTime(h.cur) : "Démarrage…";
      return `
        <div class="wl-row">
          <img class="wl-thumb" src="${poster(it)}" alt="">
          <div class="wl-info">
            <div class="wl-title"><a href="movie.html?id=${it.id}">${esc(it.title)}</a></div>
            <div class="wl-progress">${label}</div>
            <div class="wl-progress-bar"><div class="wl-progress-fill" style="width:${pct}%"></div></div>
          </div>
          <button type="button" class="wl-del" data-id="${id}" title="Supprimer de la watchlist">✕</button>
        </div>`;
    }).join("");

    wlList.querySelectorAll(".wl-del").forEach(btn => {
      btn.addEventListener("click", () => {
        removeProgress(Number(btn.dataset.id));
        toast("Retiré de la watchlist");
        renderWatchlist();
        renderStats();
      });
    });
  }

  /* ---------- favoris ---------- */
  function renderFavorites() {
    const box = document.getElementById("favList");
    if (!box) return;
    const favIds = getFavorites().filter(id => CATALOG.some(i => i.id === id));
    const u = Accounts.currentUser();
    if (!favIds.length) {
      box.innerHTML = `
        <div class="empty" style="width:100%">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <p>Aucun favori.</p>
          <a class="btn btn-primary" style="margin-top:14px" href="index.html">Découvrir le catalogue</a>
        </div>`;
      return;
    }
    box.innerHTML = favIds.map(id => {
      const it = CATALOG.find(i => i.id === id);
      return `
        <div class="wl-row">
          <img class="wl-thumb" src="${poster(it)}" alt="">
          <div class="wl-info">
            <div class="wl-title"><a href="movie.html?id=${it.id}">${esc(it.title)}</a></div>
          </div>
          <button type="button" class="wl-del" data-fav="${id}" title="Retirer des favoris">✕</button>
        </div>`;
    }).join("");

    box.querySelectorAll(".wl-del").forEach(btn => {
      btn.addEventListener("click", () => {
        removeFavorite(Number(btn.dataset.fav));
        toast("Retiré des favoris");
        renderFavorites();
      });
    });
  }

  renderAccount();
  renderWatchlist();
  renderStats();
})();