#!/usr/bin/env node
/* ============================================================
   SN Streaming — Lanceur public (Termux / PC / serveur)
   ------------------------------------------------------------
   Usage :  node public.js

   Démarre :
     1) server.js  (serveur local + proxy vidéo, port 8766)
     2) un tunnel Cloudflare (cloudflared) → URL publique
           https://xxx.trycloudflare.com
        Si cloudflared n'est pas installé : repli sur localtunnel
        (installé localement, sans npx — plus fiable sur Termux).

   Supervision :
     - si server.js crashe → relance automatique (limité)
     - si le tunnel meurt → reconnexion automatique (limitée)
     - Ctrl+C / SIGTERM → arrêt propre des deux process
   ============================================================ */
'use strict';

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const os = require('os');

const config = require('./config');
const { createLogger } = require('./lib/logger');
const log = createLogger(Object.assign({}, config, { logDir: config.logDir }));

const PORT = config.port;
const ROOT = __dirname;

const RE_CF = /https:\/\/[a-zA-Z0-9][a-zA-Z0-9-]*\.trycloudflare\.com/;
const RE_LT = /https?:\/\/[a-zA-Z0-9][a-zA-Z0-9-]*\.loca\.lt/;

const RETRY_DELAY_MS = 6000;
const MAX_TUNNEL_ATTEMPTS = 6;
const MAX_SERVER_RESTARTS = 5;

let serverProc = null;
let tunnelProc = null; // child process (cloudflared) OU objet localtunnel
let publicUrl = null;
let stopping = false;
let reconnecting = false;
let tunnelAttempts = 0;
let serverRestarts = 0;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function sep(title) {
  console.log('\n' + '='.repeat(56));
  if (title) console.log('  ' + title);
  console.log('='.repeat(56));
}

/* ------------------------------------------------------------
   Serveur local
   ------------------------------------------------------------ */

function startServer() {
  log.info('Démarrage du serveur local (server.js)…');
  serverProc = spawn(process.execPath, [path.join(ROOT, 'server.js')], { stdio: 'inherit' });
  serverProc.on('error', (e) => {
    log.error('Impossible de lancer server.js :', e.message);
    stop(1);
  });
  serverProc.on('exit', (code) => {
    serverProc = null;
    if (stopping || typeof code === 'object') return; // signal : pas une panne ordinaire
    if (code === 0) return;
    log.warn('Le serveur local s\'est arrêté (code ' + code + ').');
    if (serverRestarts >= MAX_SERVER_RESTARTS) {
      log.error('Trop de redémarrages du serveur local en échec. Arrêt.');
      stop(1);
      return;
    }
    serverRestarts++;
    log.info('Relance dans 1s (' + serverRestarts + '/' + MAX_SERVER_RESTARTS + ')…');
    setTimeout(() => { if (!stopping) { startServer(); waitServer(15000).then(() => {
      serverRestarts = 0;
      log.info('Serveur relancé et opérationnel.');
    }).catch(() => {}); } }, 1000);
  });
}

// Vérifie que le serveur répond réellement (status 200 + corps "ok").
function waitServer(timeout) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout;
    (function ping() {
      const req = http.get({ host: '127.0.0.1', port: PORT, path: '/_health', timeout: 1500 }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { if (body.length < 32) body += c; });
        res.on('end', () => {
          if (res.statusCode === 200 && body.trim() === 'ok') resolve();
          else reject(new Error('Le serveur local répond mais pas sur /_health (autre application sur le port ' + PORT + ' ?)'));
        });
      });
      req.on('error', () => {
        req.destroy();
        if (Date.now() > deadline) reject(new Error('Le serveur local ne répond pas sur le port ' + PORT + '.'));
        else setTimeout(ping, 400);
      });
      req.on('timeout', () => req.destroy());
    })();
  });
}

/* ------------------------------------------------------------
   Décodage des lignes (borné)
   ------------------------------------------------------------ */

function readLines(stream, onLine) {
  let pending = '';
  const MAX = 8192;
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    pending += chunk;
    let i;
    while ((i = pending.indexOf('\n')) >= 0) {
      onLine(pending.slice(0, i));
      pending = pending.slice(i + 1);
    }
    if (pending.length > MAX) pending = pending.slice(-MAX);
  });
  stream.on('end', () => { if (pending.trim()) onLine(pending); });
}

/* ------------------------------------------------------------
   Tunnels
   ------------------------------------------------------------ */

function cloudflaredAvailable() {
  return new Promise((resolve) => {
    const p = spawn('cloudflared', ['--version'], { stdio: 'ignore' });
    p.on('error', () => resolve(false));
    p.on('exit', () => resolve(true));
  });
}

function startCloudflared() {
  return new Promise((resolve, reject) => {
    log.info('Lancement du tunnel Cloudflare (cloudflared)…');
    const cf = spawn('cloudflared',
      ['tunnel', '--url', 'http://127.0.0.1:' + PORT, '--no-autoupdate'],
      { stdio: ['ignore', 'pipe', 'pipe'] });
    tunnelProc = cf;
    const seen = new Set();

    const onLine = (line) => {
      if (!/^\s*$/.test(line)) log.debug('cf |', line.trim().slice(0, 180));
      const m = line.match(RE_CF);
      if (m && !seen.has(m[0])) {
        seen.add(m[0]);
        publicUrl = m[0];
        resolve(m[0]);
      }
    };
    readLines(cf.stdout, onLine);
    readLines(cf.stderr, onLine);

    cf.on('error', (e) => reject(new Error('cloudflared introuvable : ' + e.message)));
    cf.on('exit', (code) => {
      if (!publicUrl) reject(new Error('cloudflared s\'est arrêté avant de fournir une URL (code ' + code + ').'));
      else if (!stopping) onTunnelDown('cloudflared');
    });
  });
}

function localtunnelLocalPath() {
  try { return require.resolve('localtunnel', { paths: [ROOT] }); }
  catch (e) { return null; }
}

function installLocalTunnel() {
  return new Promise((resolve, reject) => {
    log.info('Installation de localtunnel (une seule fois, pas de npx)…');
    const npm = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['install', 'localtunnel', '--no-save', '--no-bin-links', '--silent'],
      { cwd: ROOT, stdio: 'inherit' });
    npm.on('error', (e) => reject(new Error('npm introuvable : ' + e.message)));
    npm.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('échec npm install localtunnel (code ' + code + ')'))));
  });
}

function startLocalTunnelModule() {
  return new Promise((resolve, reject) => {
    let lt;
    try {
      lt = require(localtunnelLocalPath());
    } catch (e) {
      installLocalTunnel()
        .then(() => { lt = require(localtunnelLocalPath()); run(); })
        .catch(reject);
      return;
    }
    run();

    function run() {
      log.info('Lancement du tunnel localtunnel…');
      lt({ port: PORT })
        .then((tunnel) => {
          tunnelProc = tunnel;
          publicUrl = tunnel.url;
          tunnel.on('error', (err) => log.warn('localtunnel error:', err && err.message));
          tunnel.on('close', () => { if (!stopping) onTunnelDown('localtunnel'); });
          resolve(tunnel.url);
        })
        .catch((err) => reject(new Error('localtunnel échoue : ' + (err && err.message))));
    }
  });
}

// Dernier recours : npx (documenté comme moins fiable sur Termux).
function startLocalTunnelNpx() {
  return new Promise((resolve, reject) => {
    log.warn('Repli sur npx localtunnel (moins fiable sur Termux)…');
    const lt = spawn('npx', ['--yes', 'localtunnel', '--port', String(PORT)], { stdio: ['ignore', 'pipe', 'pipe'] });
    tunnelProc = lt;
    const seen = new Set();
    const onLine = (line) => {
      if (!/^\s*$/.test(line)) log.debug('lt |', line.trim().slice(0, 180));
      const m = line.match(RE_LT);
      if (m && !seen.has(m[0])) {
        seen.add(m[0]);
        publicUrl = m[0];
        resolve(m[0]);
      }
    };
    readLines(lt.stdout, onLine);
    readLines(lt.stderr, onLine);
    lt.on('error', (e) => reject(new Error('localtunnel impossible : ' + e.message)));
    lt.on('exit', (code) => {
      if (!publicUrl) reject(new Error('localtunnel s\'est arrêté avant de fournir une URL (code ' + code + ').'));
      else if (!stopping) onTunnelDown('localtunnel');
    });
  });
}

// Choisit et démarre un tunnel (cloudflared → localtunnel local → npx).
async function establishTunnel() {
  reconnecting = true;
  try {
    if (await cloudflaredAvailable()) {
      try { return await startCloudflared(); }
      catch (e) {
        log.warn('cloudflared a échoué :', e.message);
        // ne laisse traîner aucun process cloudflared encore vivant (bug 15)
        if (tunnelProc && tunnelProc.kill) { try { tunnelProc.kill(); } catch (e2) {} }
        tunnelProc = null;
      }
    } else {
      installCloudflaredHints();
    }

    if (localtunnelLocalPath()) {
      try { return await startLocalTunnelModule(); }
      catch (e) { log.warn('localtunnel local a échoué :', e.message); }
    } else {
      try { return await startLocalTunnelModule(); } // installe puis lance
      catch (e) { log.warn('install+localtunnel a échoué :', e.message); }
    }

    try { return await startLocalTunnelNpx(); }
    catch (e) { log.warn('npx localtunnel a échoué :', e.message); }
    return null;
  } finally {
    reconnecting = false;
  }
}

function onTunnelDown(name) {
  if (stopping) return;
  publicUrl = null;
  tunnelProc = null;
  log.warn('Tunnel "' + name + '" coupé.');
  scheduleReconnect();
}

let reconnectTimer = null;
function scheduleReconnect() {
  if (stopping || reconnecting) return;
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(async () => {
    if (stopping) return;
    tunnelAttempts++;
    if (tunnelAttempts > MAX_TUNNEL_ATTEMPTS) {
      log.error('Abandon après ' + (tunnelAttempts - 1) + ' tentatives de reconnexion.');
      return;
    }
    log.info('Reconnexion du tunnel… (' + tunnelAttempts + '/' + MAX_TUNNEL_ATTEMPTS + ')');
    try {
      const url = await establishTunnel();
      if (url) {
        tunnelAttempts = 0;
        printPublicUrl(url);
      } else {
        scheduleReconnect();
      }
    } catch (e) {
      log.error('Reconnexion échouée :', e.message);
      scheduleReconnect();
    }
  }, RETRY_DELAY_MS);
}

function printPublicUrl(url) {
  sep();
  log.info('TA PAGE PUBLIQUE :');
  console.log('\n    ▸  ' + url + '\n');
  log.info('Accessible depuis n\'importe quel appareil / navigateur.');
  log.info('Envoie ce lien à qui tu veux (tant que ce script reste ouvert).');
  log.info('Les vidéos fonctionnent aussi : le proxy sibnet tourne ici.');
  sep();
  console.log('\n[public] Appuie sur Ctrl+C pour tout arrêter (tunnel + serveur local).\n');
}

function installCloudflaredHints() {
  log.info('');
  log.info('Pour ne plus dépendre de localtunnel, installe cloudflared :');
  if (process.platform === 'linux' && /android/i.test(os.type())) {
    log.info('  Termux :  pkg update && pkg install cloudflared');
    log.info('  (ou : curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm -o cloudflared');
    log.info('        && chmod +x ./cloudflared)');
  } else if (process.platform === 'win32') {
    log.info('  Windows :  winget install cloudflare.cloudflared');
  } else {
    log.info('  Linux :  utiliser le paquet cloudflared de ta distribution');
  }
}

/* ------------------------------------------------------------
   Arrêt propre
   ------------------------------------------------------------ */

function killAndWait(proc) {
  return new Promise((resolve) => {
    if (!proc) return resolve();
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    proc.once('exit', finish);
    proc.once('close', finish);
    setTimeout(finish, 3000);
    try { if (proc.kill) proc.kill(); else if (proc.close) proc.close().catch(finish).finally(finish); }
    catch (e) { finish(); }
  });
}

async function stop(code) {
  if (stopping) return;
  stopping = true;
  console.log('\n[public] Arrêt…');
  clearTimeout(reconnectTimer);

  const jobs = [];
  if (tunnelProc) {
    // localtunnel = objet avec close(), cloudflared = child
    if (tunnelProc.close) {
      try { await tunnelProc.close(); } catch (e) { log.warn('close tunnel :', e.message); }
    } else {
      jobs.push(killAndWait(tunnelProc));
    }
  }
  if (serverProc) jobs.push(killAndWait(serverProc));

  await Promise.all(jobs);
  log.info('Tout est arrêté.');
  process.exit(typeof code === 'number' ? code : 0);
}

/* ------------------------------------------------------------
   Démarrage
   ------------------------------------------------------------ */

async function main() {
  sep('SN STREAMING — MODE PUBLIC');

  startServer();
  try {
    await waitServer(15000);
    log.info('Serveur local OK  →  http://127.0.0.1:' + PORT + '/');
  } catch (e) {
    log.error('ERREUR :', e.message);
    stop(1);
    return;
  }

  const url = await establishTunnel();
  if (url) {
    printPublicUrl(url);
  } else {
    log.error('Aucun tunnel n\'a pu être créé. Vérifie ta connexion internet,');
    log.error('puis relance  :  node public.js');
    log.error('Le serveur reste accessible en local : http://127.0.0.1:' + PORT + '/');
  }
}

process.on('SIGINT', () => { if (!stopping) stop(0); });
process.on('SIGTERM', () => { if (!stopping) stop(0); });
process.on('uncaughtException', (e) => { log.error('Erreur inattendue :', (e && e.stack) || e); });
process.on('unhandledRejection', (e) => { log.error('Rejet non géré :', (e && e.stack) || e); });

main();

/* Exports pour les tests éventuels. */
module.exports = { sleep, readLines, waitServer, RE_CF, RE_LT };