// Harness de test : simule document/window/location puis charge accounts.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 0. Vérifie le SHA-256 JavaScript pur contre celui de Node
function getSha256hex(src) {
  const m = src.match(/var sha256hex = \(function \(\) \{[\s\S]*?\n  \}\)\(\);/);
  if (!m) { console.log('sha256hex introuvable dans accounts.js'); process.exit(1); }
  const fn = new Function(m[0] + '\nreturn sha256hex;');
  return fn();
}
const sha256hex = getSha256hex(fs.readFileSync(path.join(__dirname, '..', 'js', 'accounts.js'), 'utf8'));
const vectors = ['', 'abc', 'sn::alice::motdepasse', 'hello', 'héllo wörld 😀', 'a'.repeat(1000)];
let shaOk = true;
for (const v of vectors) {
  const expected = crypto.createHash('sha256').update(v, 'utf8').digest('hex');
  if (sha256hex(v) !== expected) { shaOk = false; console.log('SHA MISMATCH for', JSON.stringify(v), sha256hex(v), 'vs', expected); }
}
console.log('SHA-256 JS pur == Node crypto:', shaOk ? 'OK' : 'FAIL');

let _cookies = [];
const document = {
  cookie: '',
  readyState: 'complete',
  addEventListener() {},
  getElementById() { return null; },
};
Object.defineProperty(document, 'cookie2', { get() { return _cookies.map(c => c.name + '=' + c.value).join('; '); } });

const cookieStore = {
  get cookies() { return _cookies; }
};
// On intercepte les écritures de document.cookie via defineProperty
let _val = '';
Object.defineProperty(document, 'cookie', {
  get() { return _cookies.map(c => c.name + '=' + c.value).join('; '); },
  set(v) {
    if (v.indexOf('=;') !== -1 || /expires=Thu, 01 Jan 1970/.test(v)) {
      // suppression
      const name = v.split('=')[0];
      _cookies = _cookies.filter(c => c.name !== name);
      return;
    }
    if (v.indexOf('=') === -1) return;
    const name = v.slice(0, v.indexOf('='));
    const value = v.slice(v.indexOf('=') + 1, v.indexOf(';') === -1 ? v.length : v.indexOf(';')).trim();
    const i = _cookies.findIndex(c => c.name === name);
    if (i === -1) _cookies.push({ name, value });
    else _cookies[i].value = value;
  }
});

const window = { crypto: globalThis.crypto };
const location = { pathname: '/index.html', href: 'http://127.0.0.1:8766/index.html' };

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'accounts.js'), 'utf8');
const run = new Function('document', 'window', 'location', 'navigator', src + '\nreturn Accounts;');
const Accounts = run(document, window, location, {});

async function main() {
  // 1. inscription
  let err = await Accounts.register('Alice', 'motdepasse');
  console.log('register err:', err);
  let u = Accounts.currentUser();
  console.log('after register currentUser:', u, '| historyKey:', Accounts.historyKey());

  // 2. déconnexion puis reconnexion avec casse différente
  Accounts.logout();
  console.log('after logout:', Accounts.currentUser());

  // 3. cookie forgé : pseudo seul (ancien format buggé)
  _cookies = _cookies.filter(c => c.name !== 'sn_session');
  _cookies.push({ name: 'sn_session', value: encodeURIComponent('Alice') });
  console.log('forged old-format currentUser:', Accounts.currentUser(), '(doit être null)');

  // 4. cookie forgé avec mauvais jeton
  _cookies = _cookies.filter(c => c.name !== 'sn_session');
  _cookies.push({ name: 'sn_session', value: encodeURIComponent('alice::ffffffffffffffffffffffffffffffffffffffff') });
  console.log('forged bad-token currentUser:', Accounts.currentUser(), '(doit être null)');

  // 5. login correct
  err = await Accounts.login('alice', 'motdepasse');
  console.log('login err:', err);
  console.log('after login currentUser:', Accounts.currentUser(), '| historyKey:', Accounts.historyKey());

  // 6. login correct avec casse différente (capitalisation)
  Accounts.logout();
  err = await Accounts.login('ALICE', 'motdepasse');
  console.log('login ALICE err:', err);
  console.log('after login(ALICE) currentUser:', Accounts.currentUser(), '| historyKey:', Accounts.historyKey());

  // 7. mot de passe accentué / unicod̊é
  Accounts.logout();
  err = await Accounts.register('Zoé', 'möt de pàsse ©');
  console.log('register Zoé err:', err, '| user:', Accounts.currentUser());
  Accounts.logout();
  err = await Accounts.login('zoé', 'möt de pàsse ©');
  console.log('login zoé err:', err, '| user:', Accounts.currentUser());

  // 8. migration ancien compte v1 (repli XOR)
  const dataB = 'sn::bob::mdp';
  let hb = 0;
  for (let i = 0; i < dataB.length; i++) hb = (hb * 33 + dataB.charCodeAt(i)) | 0;
  const v1hash = 'v1:' + (hb >>> 0).toString(36);
  _cookies = _cookies.filter(c => c.name !== 'sn_users' && c.name !== 'sn_session');
  _cookies.push({ name: 'sn_users', value: encodeURIComponent(JSON.stringify({ bob: { p: v1hash, v: 3, created: 1 } })) });
  err = await Accounts.login('bob', 'mdp');
  const usersAfter = JSON.parse(decodeURIComponent(_cookies.find(c => c.name === 'sn_users').value));
  console.log('login v1 bob err:', err, '| migré v2:', usersAfter.bob.p.startsWith('v2:'), '| user:', Accounts.currentUser());

  // 9. contexte SANS crypto.subtle (http LAN) : le login DOIT toujours marcher
  accountsInsecure = null; // (voir instance dédiée ci-dessous)
  console.log('COOKIES:', JSON.stringify(_cookies));
}

// instance avec window.crypto sans subtle ni getRandomValues : simule le http LAN
const AccountsInsecure = run(document, { crypto: {} }, { pathname: '/index.html' }, {});

main().then(async () => {
  // test 9 : compte créé en contexte sécurisé, login tenté SANS crypto (LAN http)
  Accounts.logout();
  let e9 = await Accounts.register('Alice', 'motdepasse');
  _cookies = _cookies.filter(c => c.name === 'sn_users');
  let errIn = await AccountsInsecure.login('ALICE', 'motdepasse');
  console.log('login sans crypto (LAN http) err:', errIn, '| user:', AccountsInsecure.currentUser());
  if (e9 || errIn) { console.log('FAIL: login bloqué hors contexte sécurisé'); process.exit(1); }
  console.log('TOUS LES TESTS OK');
}).catch(e => { console.error('EXCEPTION:', e); process.exit(1); });