/* ============================================================
   SN Streaming - Serveur local + proxy vidéo
   Lancement : double-clic sur lancer.bat, ou  node server.js
   Rôle :
     - sert les fichiers du site sur http://127.0.0.1:8766
     - /proxy?url=... relaie les vidéos protégées (sibnet)
       vers le lecteur en contournant les restrictions de
       Referer / redirections cross-origin.
   Zéro dépendance (Node >= 18, utilise fetch natif).
   ============================================================ */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = 8766;
const ROOT = __dirname;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
};

function send(res, code, body, headers) {
  const h = Object.assign({ 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }, headers || {});
  if (body && typeof body !== 'string' && !Buffer.isBuffer(body)) body = String(body);
  if (body && !('Content-Length' in h)) h['Content-Length'] = Buffer.byteLength(body);
  res.writeHead(code, h);
  res.end(body);
}

function log(...args) {
  const ts = new Date().toLocaleTimeString('fr-FR');
  console.log('[' + ts + ']', ...args);
}

/* ---------- proxy vidéo ---------- */
async function proxy(src, req, res) {
  log('PROXY ->', src);
  let target;
  try {
    target = new URL(src);
  } catch (e) {
    return send(res, 400, 'URL invalide\n');
  }
  if (!/^https?:$/.test(target.protocol)) return send(res, 400, 'Protocole non supporté\n');

  const headers = {
    'User-Agent': UA,
    'Accept': '*/*',
    'Accept-Language': 'fr,fr-FR;q=0.9,en;q=0.8',
  };
  // On se présente comme venant de sibnet : la plupart des lecteurs exigent ce Referer.
  if (target.hostname.includes('sibnet.ru'))
    headers['Referer'] = 'https://video.sibnet.ru/';
  // Transfère la demande de plage (seeking) du lecteur.
  if (req.headers.range) headers['Range'] = req.headers.range;

  try {
    const r = await fetch(src, {
      redirect: 'follow',
      headers,
      // durée de vie raisonnable ~ 10 min (flux vidéo long)
      signal: AbortSignal.timeout(600000),
    });
    if (!r.ok && r.status !== 206) return send(res, r.status, 'Erreur source ' + r.status + '\n');

    const h = {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
      'Content-Type': r.headers.get('content-type') || 'video/mp4',
    };
    if (r.status === 206) {
      h['Accept-Ranges'] = 'bytes';
      const cr = r.headers.get('content-range');
      if (cr) h['Content-Range'] = cr;
      const cl = r.headers.get('content-length');
      if (cl) h['Content-Length'] = cl;
    }
    log('  <-', r.status, h['Content-Type'], h['Content-Range'] || '');
    res.writeHead(r.status, h);
    // Flux continu : quand le lecteur se déconnecte, on arrête le téléchargement.
    const reader = r.body.getReader();
    const pipe = (async () => {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        if (!res.write(value)) {
          await new Promise((ok) => res.once('drain', ok));
        }
      }
    })();
    res.on('close', () => reader.cancel().catch(() => {}));
    try {
      await pipe;
      res.end();
    } catch (e) {
      if (!res.writableEnded) res.end();
    }
  } catch (e) {
    log('  !! proxy error:', e.message);
    if (!res.headersSent) return send(res, 502, 'Proxy error: ' + e.message + '\n');
    res.destroy();
  }
}

/* ---------- fichiers statiques ---------- */
function serveStatic(req, res, pathname) {
  let p;
  try {
    p = path.normalize(path.join(ROOT, decodeURIComponent(pathname)));
  } catch (e) {
    return send(res, 400, 'Bad path\n');
  }
  if (!p.startsWith(ROOT)) return send(res, 403, 'Forbidden\n');
  if (p === ROOT || !fs.existsSync(p)) {
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  }
  if (!fs.existsSync(p) || !fs.statSync(p).isFile()) return send(res, 404, 'Not found\n');

  const ext = path.extname(p).toLowerCase();
  const h = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' };

  const range = req.headers.range;
  const size = fs.statSync(p).size;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (m && (m[1] !== '' || m[2] !== '')) {
      let start = m[1] === '' ? 0 : parseInt(m[1], 10);
      let end = m[2] === '' ? size - 1 : parseInt(m[2], 10);
      if (isNaN(start)) start = 0;
      if (isNaN(end)) end = size - 1;
      if (start > end || start >= size) {
        h['Content-Range'] = 'bytes */' + size;
        return send(res, 416, '', h);
      }
      end = Math.min(end, size - 1);
      h['Content-Range'] = `bytes ${start}-${end}/${size}`;
      h['Content-Length'] = end - start + 1;
      h['Accept-Ranges'] = 'bytes';
      res.writeHead(206, h);
      const f = fs.createReadStream(p, { start, end });
      f.pipe(res);
      return;
    }
  }
  h['Content-Length'] = size;
  h['Accept-Ranges'] = 'bytes';
  res.writeHead(200, h);
  fs.createReadStream(p).pipe(res);
}

/* ---------- handle ---------- */
const server = http.createServer((req, res) => {
  try {
    const u = new URL(req.url, 'http://localhost');
    if (u.pathname === '/proxy' && u.searchParams.has('url')) {
      return proxy(u.searchParams.get('url'), req, res);
    }
    if (u.pathname === '/_health') return send(res, 200, 'ok');
    return serveStatic(req, res, u.pathname === '/' ? '/index.html' : u.pathname);
  } catch (e) {
    send(res, 500, 'Server error\n');
  }
});

server.on('clientError', (err, socket) => {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.listen(PORT, '127.0.0.1', () => {
  log('Serveur prêt : http://127.0.0.1:' + PORT + '/');
  log('Proxy vidéo : /proxy?url=...');
});