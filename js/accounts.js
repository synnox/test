/* ============ comptes utilisateurs (cookies) ============
   - Comptes stockés dans le cookie "sn_users" (pseudo -> mot de passe hashé)
   - Session active dans le cookie "sn_session"
   - Chaque utilisateur a sa propre watchlist/historique
     (clé cookie "sn_history_<hash>" -- voir Accounts.historyKey())
   - Fonctionne 100% en local, aucun serveur, tout via cookies.
   ========================================================== */
var Accounts = (function () {
  const USERS_COOKIE = "sn_users";
  const SESSION_COOKIE = "sn_session";

  function getCookie(name) {
    const n = name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1");
    const m = document.cookie.match(new RegExp("(?:^|; )" + n + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function setCookie(name, val, days) {
    const d = new Date();
    d.setTime(d.getTime() + (days || 365) * 864e5);
    document.cookie =
      name + "=" + encodeURIComponent(val) +
      "; expires=" + d.toUTCString() + "; path=/; SameSite=Lax";
  }

  function delCookie(name) {
    document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax";
  }

  /* petit hash local (mot de passe non stocké en clair) */
  function hash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  function getUsers() {
    try { return JSON.parse(getCookie(USERS_COOKIE) || "{}"); } catch (e) { return {}; }
  }
  function saveUsers(u) { setCookie(USERS_COOKIE, JSON.stringify(u), 365); }

  function currentUser() { return getCookie(SESSION_COOKIE) || null; }
  function isLoggedIn() { return !!currentUser(); }

  /* clé d'historique : "sn_history" (invité) ou "sn_history_<hash>" (utilisateur) */
  function historyKey() {
    const u = currentUser();
    return u ? "sn_history_" + hash("user:" + u) : "sn_history";
  }

  function register(pseudo, mdp) {
    pseudo = (pseudo || "").trim();
    if (pseudo.length < 2) return "Le pseudo doit faire au moins 2 caractères.";
    if (!mdp || mdp.length < 2) return "Le mot de passe doit faire au moins 2 caractères.";
    const users = getUsers();
    const key = pseudo.toLowerCase();
    if (users[key]) return "Ce pseudo est déjà utilisé.";
    users[key] = { p: hash("pw:" + pseudo + ":" + mdp), created: Date.now() };
    saveUsers(users);
    setCookie(SESSION_COOKIE, pseudo, 365);
    return null;
  }

  function login(pseudo, mdp) {
    pseudo = (pseudo || "").trim();
    const u = getUsers()[pseudo.toLowerCase()];
    if (!u || u.p !== hash("pw:" + pseudo + ":" + mdp)) return "Pseudo ou mot de passe incorrect.";
    setCookie(SESSION_COOKIE, pseudo, 365);
    return null;
  }

  function logout() { delCookie(SESSION_COOKIE); }

  /* supprime le compte + sa watchlist + ses favoris */
  function removeAccount() {
    const u = currentUser();
    if (!u) return;
    const users = getUsers();
    delete users[u.toLowerCase()];
    saveUsers(users);
    const h = hash("user:" + u);
    delCookie("sn_history_" + h);
    delCookie("sn_fav_" + h);
    delCookie(SESSION_COOKIE);
  }

  /* redirige vers /parametres.html?login=1 si pas connecté (sauf sur les pages publiques) */
  function requireLogin() {
    const page = (location.pathname.split("/").pop() || "index.html").split("?")[0];
    if (page === "parametres.html" || page === "mentions-legales.html") return;
    if (!isLoggedIn()) location.href = "parametres.html?login=1";
  }

  /* met à jour le petit bouton utilisateur dans la barre de navigation */
  function updateNav() {
    const el = document.getElementById("navUser");
    if (!el) return;
    const u = currentUser();
    el.innerHTML = u
      ? '👤 <b>' + u.replace(/</g, "&lt;") + '</b>'
      : '👤 <span class="nav-user-off">Connexion</span>';
  }

  return {
    getCookie, setCookie, delCookie,
    currentUser, isLoggedIn, historyKey,
    register, login, logout, removeAccount, requireLogin, updateNav
  };
})();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => { Accounts.updateNav(); Accounts.requireLogin(); });
} else {
  Accounts.updateNav();
  Accounts.requireLogin();
}