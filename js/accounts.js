/* ============ comptes utilisateurs (cookies) ============
   - Comptes stockés dans le cookie "sn_users" (pseudo -> mot de passe hashé)
   - Session active dans le cookie "sn_session"
   - Chaque utilisateur a sa propre watchlist/historique
     (clé cookie "sn_history_<hash>" -- voir Accounts.historyKey())
   - Fonctionne 100% en local, aucun serveur, tout via cookies.

   Sécurité (bug 17) :
     - les mots de passe sont hachés en SHA-256 (sel dérivé du pseudo).
       L'implémentation est 100 % JavaScript : elle donne le MÊME résultat
       dans tous les contextes (localhost, https, LAN http) — plus aucun
       risque de bloquer le login selon l'adresse utilisée. Les anciens
       comptes (WebCrypto v2, repli XOR v1, hash djb2 des débuts) restent
       connectables et sont migrés au premier login.

   Sécurité (bug 16, corrigé) :
     - la session n'est plus le pseudo brut (forgable) : c'est un jeton
       aléatoire stocké dans sn_session sous la forme "pseudo::jeton",
       et le cookie sn_users garde le jeton attendu pour chaque compte.
       Un cookie forgé sans jeton valide est rejeté et effacé. Les
       sessions d'avant cette fix sont invalidées (reconnexion requise).
   ========================================================== */
var Accounts = (function () {
  const USERS_COOKIE = "sn_users";
  const SESSION_COOKIE = "sn_session";
  const VERSION = 3;

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

  /* Petit hash local (POUR LES CLÉS de stockage uniquement, PAS pour les mots de passe). */
  function hash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  /* SHA-256 100 % JavaScript : aucun besoin de crypto.subtle, donc un
     résultat IDENTIQUE dans tous les contextes (localhost, https, LAN http).
     Vérifié contre Node crypto dans test/accounts-harness.js. */
  var sha256hex = (function () {
    const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    return function sha256hex(str) {
      const utf8 = [];
      for (let i = 0; i < str.length; i++) {
        let c = str.charCodeAt(i);
        if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
          const lo = str.charCodeAt(i + 1);
          if (lo >= 0xdc00 && lo <= 0xdfff) {
            c = 0x10000 + ((c - 0xd800) << 10) + (lo - 0xdc00);
            utf8.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
            i++;
            continue;
          }
        }
        if (c < 0x80) utf8.push(c);
        else if (c < 0x800) utf8.push(0xc0 | (c >> 6), 0x80 | (c & 63));
        else utf8.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      }
      const bitLen = utf8.length * 8;
      utf8.push(0x80);
      while (utf8.length % 64 !== 56) utf8.push(0);
      utf8.push(0, 0, 0, 0, (bitLen >>> 24) & 255, (bitLen >>> 16) & 255, (bitLen >>> 8) & 255, bitLen & 255);
      let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
      let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
      const w = new Array(64);
      for (let off = 0; off < utf8.length; off += 64) {
        for (let i = 0; i < 16; i++) {
          w[i] = (utf8[off + i * 4] << 24) | (utf8[off + i * 4 + 1] << 16) | (utf8[off + i * 4 + 2] << 8) | utf8[off + i * 4 + 3];
        }
        for (let i = 16; i < 64; i++) {
          const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
          const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
          w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
        }
        let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, H = h7;
        for (let i = 0; i < 64; i++) {
          const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
          const ch = (e & f) ^ (~e & g);
          const t1 = (H + S1 + ch + K[i] + w[i]) | 0;
          const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
          const maj = (a & b) ^ (a & c) ^ (b & c);
          const t2 = (S0 + maj) | 0;
          H = g; g = f; f = e; e = (d + t1) | 0;
          d = c; c = b; b = a; a = (t1 + t2) | 0;
        }
        h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
        h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + H) | 0;
      }
      return [h0, h1, h2, h3, h4, h5, h6, h7].map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
    };
  })();

  function hashPassword(pseudo, mdp) {
    return Promise.resolve("v2:" + sha256hex("sn::" + pseudo.toLowerCase() + "::" + mdp));
  }

  /* Ancien repli XOR (v1) utilisé quand crypto.subtle manquait :
     conservé uniquement pour migrer ces comptes au premier login. */
  function xorLegacyHash(pseudo, mdp) {
    const data = "sn::" + pseudo.toLowerCase() + "::" + mdp;
    let h = 0;
    for (let i = 0; i < data.length; i++) h = (h * 33 + data.charCodeAt(i)) | 0;
    return "v1:" + (h >>> 0).toString(36);
  }

  /* Ancien hash (avant migration) : djb2 32 bits, conservé pour
     permettre la connexion des comptes créés avant SHA-256. */
  function legacyHash(pseudo, mdp) {
    let h = 5381;
    const data = "pw:" + pseudo + ":" + mdp;
    for (let i = 0; i < data.length; i++) h = ((h << 5) + h + data.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  function getUsers() {
    try { return JSON.parse(getCookie(USERS_COOKIE) || "{}"); } catch (e) { return {}; }
  }
  function saveUsers(u) { setCookie(USERS_COOKIE, JSON.stringify(u), 365); }

  /* jeton de session aléatoire (48 hex) : impossible à deviner. */
  function genToken() {
    try {
      const b = new Uint8Array(24);
      (window.crypto || {}).getRandomValues(b);
      return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
    } catch (e) {
      return Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
    }
  }

  /* la session est "pseudo::jeton", validée contre le jeton du compte.
     Tout cookie sn_session sans jeton valide (forgé) est rejeté puis effacé. */
  function currentUser() {
    const raw = getCookie(SESSION_COOKIE);
    if (!raw) return null;
    const i = raw.indexOf("::");
    if (i < 1) { delCookie(SESSION_COOKIE); return null; }
    const pseudo = raw.slice(0, i);
    const token = raw.slice(i + 2);
    const u = getUsers()[pseudo.toLowerCase()];
    if (!u || !u.session || u.session !== token) { delCookie(SESSION_COOKIE); return null; }
    return pseudo;
  }
  function isLoggedIn() { return !!currentUser(); }

  /* clé d'historique : "sn_history" (invité) ou "sn_history_<hash>" (utilisateur) */
  function historyKey() {
    const u = currentUser();
    return u ? "sn_history_" + hash("user:" + u) : "sn_history";
  }

  function register(pseudo, mdp) {
    pseudo = (pseudo || "").trim();
    if (pseudo.length < 2) return Promise.resolve("Le pseudo doit faire au moins 2 caractères.");
    if (!mdp || mdp.length < 2) return Promise.resolve("Le mot de passe doit faire au moins 2 caractères.");
    const users = getUsers();
    const key = pseudo.toLowerCase();
    if (users[key]) return Promise.resolve("Ce pseudo est déjà utilisé.");
    return hashPassword(pseudo, mdp).then((p) => {
      users[key] = { p, v: VERSION, created: Date.now(), session: genToken() };
      saveUsers(users);
      setCookie(SESSION_COOKIE, key + "::" + users[key].session, 365);
      return null;
    });
  }

  function login(pseudo, mdp) {
    pseudo = (pseudo || "").trim();
    const users = getUsers();
    const key = pseudo.toLowerCase();
    const u = users[key];
    if (!u) return Promise.resolve("Pseudo ou mot de passe incorrect.");
    return hashPassword(pseudo, mdp).then((pNew) => {
      if (u.p === pNew) {
        u.session = genToken();
        saveUsers(users);
        setCookie(SESSION_COOKIE, key + "::" + u.session, 365);
        return null;
      }
      // migration des anciens comptes : hash djb2 (débuts) ou repli XOR v1
      if (u.p === legacyHash(pseudo, mdp) || u.p === xorLegacyHash(pseudo, mdp)) {
        u.p = pNew;
        u.v = VERSION;
        u.created = u.created || Date.now();
        u.session = genToken();
        saveUsers(users);
        setCookie(SESSION_COOKIE, key + "::" + u.session, 365);
        return null;
      }
      return "Pseudo ou mot de passe incorrect.";
    });
  }

  function logout() {
    const raw = getCookie(SESSION_COOKIE);
    if (raw) {
      const i = raw.indexOf("::");
      if (i > 0) {
        const users = getUsers();
        const u = users[raw.slice(0, i).toLowerCase()];
        if (u) { delete u.session; saveUsers(users); }
      }
    }
    delCookie(SESSION_COOKIE);
  }

  /* supprime le compte + sa watchlist + ses favoris */
  function userStorageSuffix(u) { return u ? hash("user:" + u) : ""; }

  function removeAccount() {
    const u = currentUser();
    if (!u) return;
    const users = getUsers();
    delete users[u.toLowerCase()];
    saveUsers(users);
    const h = userStorageSuffix(u);
    delCookie("sn_history_" + h);
    delCookie("sn_fav_" + h);
    // nettoie aussi le stockage localStorage (sn1_*) rattaché au compte
    try { if (window.__clearUserStorage) window.__clearUserStorage(u); } catch (e) {}
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
    currentUser, isLoggedIn, historyKey, userStorageSuffix,
    register, login, logout, removeAccount, requireLogin, updateNav
  };
})();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => { Accounts.updateNav(); Accounts.requireLogin(); });
} else {
  Accounts.updateNav();
  Accounts.requireLogin();
}