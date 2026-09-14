#!/usr/bin/env node
/* ============================================================
   SN Streaming — Lanceur public (Termux / PC / serveur)
   ------------------------------------------------------------
   Usage :  node public.js

   Démarre :
     1) server.js  (serveur local + proxy vidéo, port 8766)
     2) un tunnel Cloudflare (cloudflared) → URL publique
        https://xxx.trycloudflare.com
     Si cloudflared n'est pas installé : repli automatique sur
        localtunnel via npx  →  https://xxx.loca.lt / http://xxx.loca.lt

   Stop : Ctrl+C (coupe le tunnel ET le serveur local)
   ============================================================ */
'use strict';

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const os = require('os');

const PORT = 8766;
const ROOT = __dirname;

const RE_CF = /https:\/\/[a-zA-Z0-9][a-zA-Z0-9-]*\.trycloudflare\.com/;
const RE_LT = /https?:\/\/[a-zA-Z0-9][a-zA-Z0-9-]*\.loca\.lt/;

let serverProc = null;
let tunnelProc = null;
let publicUrl = null;

function log(...a) { console.log('[public]', ...a); }

function sep(title) {
  console.log('\n' + '='.repeat(56));
  if (title) console.log('  ' + title);
  console.log('='.repeat(56));
}

function startServer() {
  log('Démarrage du serveur local (server.js)…');
  serverProc = spawn(process.execPath, [path.join(ROOT, 'server.js')], { stdio: 'inherit' });
  serverProc.on('error', (e) => {
    log('Impossible de lancer server.js :', e.message);
    stop(1);
  });
  serverProc.on('exit', (code) => {
    if (code !== null && code !== undefined) log('Le serveur local s\'est arrêté (code ' + code + ').');
  });
}

function waitServer(timeout) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout;
    (function ping() {
      const req = http.get({ host: '127.0.0.1', port: PORT, path: '/_health', timeout: 1500 }, (res) => {
        res.resume();
        resolve();
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

function readLines(stream, onLine) {
  let pending = '';
  stream.on('data', (chunk) => {
    pending += chunk.toString();
    let i;
    while ((i = pending.indexOf('\n')) >= 0) {
      onLine(pending.slice(0, i));
      pending = pending.slice(i + 1);
    }
  });
  stream.on('end', () => { if (pending.trim()) onLine(pending); });
}

function cloudflaredAvailable() {
  return new Promise((resolve) => {
    const p = spawn('cloudflared', ['--version'], { stdio: 'ignore' });
    p.on('error', () => resolve(false));
    p.on('exit', () => resolve(true));
  });
}

function startCloudflared() {
  return new Promise((resolve, reject) => {
    log('Lancement du tunnel Cloudflare (cloudflared)…');
    const cf = spawn('cloudflared',
      ['tunnel', '--url', 'http://127.0.0.1:' + PORT, '--no-autoupdate'],
      { stdio: ['ignore', 'pipe', 'pipe'] });
    tunnelProc = cf;
    const seen = new Set();

    const onLine = (line) => {
      if (!/^\s*$/.test(line)) log('cf |', line.trim().slice(0, 180));
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
    });
  });
}

function startLocalTunnel() {
  return new Promise((resolve, reject) => {
    log('Repli automatique sur localtunnel (npx)…');
    const lt = spawn('npx', ['--yes', 'localtunnel', '--port', String(PORT)], { stdio: ['ignore', 'pipe', 'pipe'] });
    tunnelProc = lt;
    const seen = new Set();

    const onLine = (line) => {
      if (!/^\s*$/.test(line)) log('lt |', line.trim().slice(0, 180));
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
    });
  });
}

function installCloudflaredHints() {
  log('');
  log('Pour ne plus dépendre de localtunnel, installe cloudflared :');
  if (process.platform === 'linux' && /android/i.test(os.type())) {
    log('  Termux :  pkg update && pkg install cloudflared');
    log('  (ou : curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm -o cloudflared');
    log('        && chmod +x ./cloudflared)');
  } else if (process.platform === 'win32') {
    log('  Windows :  winget install cloudflare.cloudflared');
  } else {
    log('  Linux :  utiliser le paquet cloudflared de ta distribution');
  }
}

async function main() {
  sep('SN STREAMING — MODE PUBLIC');

  startServer();
  try {
    await waitServer(15000);
    log('Serveur local OK  →  http://127.0.0.1:' + PORT + '/');
  } catch (e) {
    log('ERREUR :', e.message);
    stop(1);
    return;
  }

  let url = null;
  if (await cloudflaredAvailable()) {
    try { url = await startCloudflared(); }
    catch (e) { log('cloudflared a échoué :', e.message); url = null; }
  }
  if (!url) {
    installCloudflaredHints();
    try { url = await startLocalTunnel(); }
    catch (e) { log('ERREUR tunnel :', e.message); url = null; }
  }

  sep();
  if (url) {
    log('TA PAGE PUBLIQUE :');
    console.log('\n    ▸  ' + url + '\n');
    log('Accessible depuis n\'importe quel appareil / navigateur.');
    log('Envoie ce lien à qui tu veux (tant que ce script reste ouvert).');
    log('Les vidéos fonctionnent aussi : le proxy sibnet tourne ici.');
  } else {
    log('Aucun tunnel n\'a pu être créé. Vérifie ta connexion internet,');
    log('puis relance  :  node public.js');
    log('Le serveur reste accessible en local : http://127.0.0.1:' + PORT + '/');
  }
  sep();

  console.log('\n[public] Appuie sur Ctrl+C pour tout arrêter (tunnel + serveur local).\n');
}

function stop(code) {
  if (tunnelProc) { try { tunnelProc.kill(); } catch (e) {} }
  if (serverProc) { try { serverProc.kill(); } catch (e) {} }
  setTimeout(() => process.exit(typeof code === 'number' ? code : 0), 200);
}

process.on('SIGINT', () => { console.log('\n[public] Arrêt…'); stop(0); });
process.on('SIGTERM', () => { console.log('\n[public] Arrêt…'); stop(0); });
process.on('uncaughtException', (e) => { log('Erreur inattendue :', (e && e.message) || e); });
process.on('unhandledRejection', (e) => { log('Rejet non géré :', (e && e.message) || e); });

main();