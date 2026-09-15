/* ============================================================
   SN Streaming - Serveur local + proxy vidéo
   Lancement : double-clic sur lancer.bat,  node server.js
   Rôle :
     - sert les fichiers du site sur http://127.0.0.1:8766
     - /proxy?url=... relaie les vidéos protégées (sibnet)
       vers le lecteur en contournant les restrictions de
       Referer / redirections cross-origin.
   Zéro dépendance (Node >= 18, fetch natif).

   Rigueur, sécurité et robustesse apportées :
     - anti traversal avec séparateur de chemin
     - anti SSRF (allowlist de domaines + blocage IP privées)
     - CORS restreint (écho de l'origine, plus de '*')
     - headers de sécurité (CSP, nosniff, referrer, XFO)
     - flux proxy : timeout par inactivité + durée max (plus de coupure à 10 min)
     - gestion de la plage (Range) même si la source ignore nos plages
     - ETag / 304 / compression gzip / cache immutable avec cache-buster auto
     - fichiers statiques lus en flux avec gestion d'erreur (pas de crash)
     - méthode HEAD supportée
     - logs horodatés avec rotation (lib/logger.js)
   ============================================================ */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const dns = require('dns');
const net = require('net');
const { URL } = require('url');

const config = require('./config');
const { createLogger } = require('./lib/logger');

const mainLogger = createLogger(config);

/* En-têtes de sécurité appliqués à toutes les réponses. */
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "img-src * data: blob:; media-src * blob:; font-src * data:; connect-src 'self' *; " +
    "object-src 'none'; base-uri 'self'; frame-ancestors 'self'",
};

/* ============================================================
   Helpers réseau / sécurité
   ============================================================ */

function isPrivateIP(ip) {
  if (net.isIPv4(ip)) {
    const p = ip.split('.').map(Number);
    if (p[0] === 0 || p[0] === 10 || p[0] === 127 || p[0] === 255) return true;
    if (p[0] === 169 && p[1] === 254) return true; // link-local
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true; // CGNAT
    if (p[0] === 198 && (p[1] === 18 || p[1] === 19)) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    if (l === '::1' || l === '::' || l === '::ffff:0:0') return true;
    if (l.startsWith('::ffff:')) return isPrivateIP(l.slice(7)); // IPv4 mappée
    if (l.startsWith('fc') || l.startsWith('fd')) return true; // fc00::/7
    if (l.startsWith('fe8') || l.startsWith('fe9') || l.startsWith('fea') || l.startsWith('feb')) return true; // fe80::/10
    if (l.startsWith('fec') || l.startsWith('fed') || l.startsWith('fee') || l.startsWith('fef')) return true; // fec0::/10
    if (l.startsWith('ff')) return true; // multicast
    return false;
  }
  return true; // format inconnu : on bloque par précaution
}

function isHostAllowed(host) {
  host = String(host || '').toLowerCase().replace(/\.$/, '');
  if (!host || host.includes('@')) return false;
  return config.allowedProxyHosts.some((d) => host === d || host.endsWith('.' + d));
}

const dnsCache = new Map(); // host -> { ok, ts }
const DNS_TTL = 300000; // 5 min

function hostIsPublic(host) {
  const cached = dnsCache.get(host);
  if (cached && Date.now() - cached.ts < DNS_TTL && cached.pending !== true) {
    return Promise.resolve(cached.ok);
  }
  if (net.isIP(host)) {
    const ok = !isPrivateIP(host);
    dnsCache.set(host, { ok, ts: Date.now() });
    return Promise.resolve(ok);
  }
  return new Promise((resolve) => {
    if (dnsCache.get(host) && !dnsCache.get(host).pending) return resolve(dnsCache.get(host).ok);
    dnsCache.set(host, { pending: true, ts: Date.now() });
    dns.lookup(host, { all: true }, (err, addrs) => {
      let ok = false;
      if (!err && Array.isArray(addrs) && addrs.length) {
        ok = addrs.every((a) => !isPrivateIP(a.address));
      }
      dnsCache.set(host, { ok, ts: Date.now() });
      resolve(ok);
    });
  });
}

async function assertProxyAllowed(urlStr) {
  let target;
  try { target = new URL(urlStr); } catch (e) { return { code: 400, msg: 'URL invalide\n' }; }
  if (!/^https?:$/.test(target.protocol)) return { code: 400, msg: 'Protocole non supporté\n' };
  if (!isHostAllowed(target.hostname)) return { code: 403, msg: 'Domaine non autorisé\n' };
  if (!(await hostIsPublic(target.hostname))) return { code: 403, msg: 'Hôte privé ou réservé\n' };
  return null;
}

/* ============================================================
   Envoi de réponse + headers de sécurité
   ============================================================ */

function withSec(h) {
  const out = Object.assign({}, SECURITY_HEADERS, h);
  delete out['Cache-Control'];
  out['Cache-Control'] = h['Cache-Control'] || 'no-store';
  return out;
}

function send(res, code, body, headers) {
  const h = withSec(headers || {});
  if (body && typeof body !== 'string' && !Buffer.isBuffer(body)) body = String(body);
  if (!('Content-Type' in h)) h['Content-Type'] = 'text/plain; charset=utf-8';
  if (body && !('Content-Length' in h)) h['Content-Length'] = Buffer.byteLength(body);
  res.writeHead(code, h);
  res.end(body);
}

/* ============================================================
   Serveur statique
   ============================================================ */

function computeAssetVersion(cfg) {
  let s = '';
  for (const dir of ['js', 'css']) {
    const full = path.join(cfg.root, dir);
    let files = [];
    try { files = fs.readdirSync(full); } catch (e) { continue; }
    for (const f of files) {
      try { const st = fs.statSync(path.join(full, f)); s += dir + '/' + f + ':' + st.mtimeMs + ':' + st.size + ';'; }
      catch (e) { /* fichier en cours d'écriture : ignoré */ }
    }
  }
  s += ':' + Date.now(); // le token change à chaque redémarrage
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function createServer(opts = {}) {
  const cfg = Object.assign({}, config, opts.config || {});
  const log = opts.logger || mainLogger;
  const assetVersion = cfg.assetVersion || computeAssetVersion(cfg);

  const MIME = cfg.mime;
  const COMPRESSIBLE = new Set(cfg.compressible);

  function resolvePath(pathname) {
    // normalise et vérifie qu'on reste bien DANS le dossier racine.
    const decoded = decodeURIComponent(pathname);
    const p = path.normalize(path.join(cfg.root, decoded));
    if (!(p === cfg.root || p.startsWith(cfg.root + path.sep))) return null;
    return p;
  }

  function serveStatic(req, res, pathname) {
    const p0 = resolvePath(pathname);
    if (!p0) return send(res, 403, 'Forbidden\n');

    let p = p0;
    let st;
    try { st = fs.statSync(p); }
    catch (e) {
      if (p === cfg.root) p = path.join(p, 'index.html');
      try { st = fs.statSync(p); } catch (e2) { return send(res, 404, 'Not found\n'); }
    }
    if (st.isDirectory()) {
      p = path.join(p, 'index.html');
      try { st = fs.statSync(p); } catch (e) { return send(res, 404, 'Not found\n'); }
    }

    const ext = path.extname(p).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';
    const etag = '"' + st.mtimeMs.toString(36) + '-' + st.size.toString(36) + '"';
    const isText = COMPRESSIBLE.has(ext);
    const hasVersionedQuery = (() => {
      try { return new URL(req.url, 'http://localhost').searchParams.has('v'); } catch (e) { return false; }
    })();
    const cacheControl = hasVersionedQuery && cfg.immutableAssets
      ? 'public, max-age=31536000, immutable'
      : 'no-cache';

    /* --- 304 (revalidation) : a priorité sur Range --- */
    const inm = req.headers['if-none-match'];
    const ims = req.headers['if-modified-since'];
    if ((inm && inm === etag) || (ims && ims === st.mtime.toUTCString())) {
      res.writeHead(304, withSec({ 'ETag': etag, 'Cache-Control': cacheControl }));
      return res.end();
    }

    /* --- Range --- */
    if (req.headers.range && req.method === 'GET') {
      const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (m && (m[1] !== '' || m[2] !== '')) {
        let start = m[1] === '' ? Math.max(0, st.size - (parseInt(m[2], 10) || 0)) : parseInt(m[1], 10);
        let end = m[2] === '' ? st.size - 1 : parseInt(m[2], 10);
        if (isNaN(start) || start < 0) start = 0;
        if (isNaN(end)) end = st.size - 1;
        if (start > end || start >= st.size) {
          const h = withSec({ 'Content-Range': 'bytes */' + st.size, 'Content-Type': contentType, 'Cache-Control': cacheControl });
          return send(res, 416, '', h);
        }
        end = Math.min(end, st.size - 1);
        const h = withSec({
          'Content-Type': contentType,
          'Content-Range': `bytes ${start}-${end}/${st.size}`,
          'Content-Length': end - start + 1,
          'Accept-Ranges': 'bytes',
          'ETag': etag,
          'Cache-Control': cacheControl,
        });
        res.writeHead(206, h);
        if (req.method === 'HEAD') return res.end();
        const f = fs.createReadStream(p, { start, end });
        f.on('error', () => { try { res.destroy(); } catch (e) {} });
        f.pipe(res);
        return;
      }
    }

    /* --- gzip / compression --- */
    const acceptsGzip = isText && /gzip/.test(req.headers['accept-encoding'] || '');

    const base = {
      'Content-Type': contentType,
      'ETag': etag,
      'Accept-Ranges': 'bytes',
      'Cache-Control': cacheControl,
    };

    /* --- HEAD : headers seulement --- */
    if (req.method === 'HEAD') {
      const h = withSec(Object.assign({}, base, acceptsGzip ? { 'Content-Encoding': 'gzip', 'Vary': 'Accept-Encoding' } : { 'Content-Length': st.size }));
      res.writeHead(200, h);
      return res.end();
    }

    /* --- texte : buffer + cache-buster + gzip --- */
    if (isText && !req.headers.range) {
      let buf;
      try { buf = fs.readFileSync(p); }
      catch (e) { return send(res, 500, 'Impossible de lire le fichier\n'); }
      if (ext === '.html') {
        buf = Buffer.from(buf.toString('utf8').replace(/(\?v=)[A-Za-z0-9_-]+/g, '$1' + assetVersion), 'utf8');
      }
      const h = withSec(Object.assign({}, base));
      if (acceptsGzip) {
        buf = zlib.gzipSync(buf);
        h['Content-Encoding'] = 'gzip';
        h['Vary'] = 'Accept-Encoding';
      }
      h['Content-Length'] = buf.length;
      res.writeHead(200, h);
      return res.end(buf);
    }

    /* --- binaire : flux direct --- */
    const h = withSec(Object.assign({}, base, { 'Content-Length': st.size }));
    res.writeHead(200, h);
    const f = fs.createReadStream(p);
    f.on('error', () => { try { res.destroy(); } catch (e) {} });
    f.pipe(res);
  }

  /* ============================================================
     Proxy vidéo
     ============================================================ */

  function relayBody(res, body, status, headers, touch, skip, limit) {
    const reader = body.getReader();
    let sent = 0;
    res.writeHead(status, headers);
    let closed = false;
    res.on('close', () => { closed = true; reader.cancel().catch(() => {}); });
    res.on('error', () => { closed = true; reader.cancel().catch(() => {}); });
    return (async () => {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done || closed) break;
          let chunk = value;
          if (skip > 0) {
            if (chunk.length <= skip) { skip -= chunk.length; continue; }
            chunk = chunk.subarray(skip);
            skip = 0;
          }
          if (limit !== undefined) {
            const remain = limit - sent;
            if (remain <= 0) break;
            if (chunk.length > remain) chunk = chunk.subarray(0, remain);
          }
          sent += chunk.length;
          touch();
          if (!res.write(chunk)) {
            await new Promise((ok) => res.once('drain', ok));
          }
        }
        if (!res.writableEnded) res.end();
      } catch (e) {
        if (!res.writableEnded) { try { res.destroy(); } catch (e2) {} }
      }
    })();
  }

  async function proxy(src, req, res) {
    log.info('PROXY ->', src);
    const denied = await assertProxyAllowed(src);
    if (denied) {
      log.warn('proxy refusé:', denied.code, src);
      return send(res, denied.code, denied.msg);
    }

    const target = new URL(src);
    const headers = {
      'User-Agent': cfg.userAgent,
      'Accept': '*/*',
      'Accept-Language': 'fr,fr-FR;q=0.9,en;q=0.8',
    };
    // On se présente comme venant de sibnet : la plupart des lecteurs exigent ce Referer.
    if (isHostAllowed(target.hostname) && target.hostname.includes('sibnet.ru')) {
      headers['Referer'] = 'https://video.sibnet.ru/';
    }
    // Transfère la demande de plage (seeking) du lecteur.
    if (req.headers.range) headers['Range'] = req.headers.range;

    const ctrl = new AbortController();
    let connected = false;
    let lastActivity = Date.now();
    const started = Date.now();

    // Timer "inactivité" + "durée max" : remplace l'ancien timeout global
    // qui coupait brutalement les films de plus de 10 minutes.
    const iv = setInterval(() => {
      const now = Date.now();
      const idleExceeded = connected
        ? now - lastActivity > cfg.proxyInactivityMs
        : now - started > cfg.proxyConnectMs;
      if (idleExceeded || now - started > cfg.proxyMaxMs) ctrl.abort();
    }, 5000);
    if (iv.unref) iv.unref();

    try {
      const r = await fetch(src, {
        redirect: 'follow',
        headers,
        signal: ctrl.signal,
      });
      connected = true;
      lastActivity = Date.now();

      if (!r.ok && r.status !== 206) {
        return send(res, r.status || 502, 'Erreur source ' + r.status + '\n');
      }

      const origin = req.headers.origin;
      const cors = origin ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' } : {};

      /* ....... cas 206 : la source a honoré notre Range ....... */
      if (r.status === 206) {
        const h = withSec(Object.assign({}, cors, {
          'Cache-Control': 'no-store',
          'Content-Type': r.headers.get('content-type') || 'video/mp4',
          'Accept-Ranges': 'bytes',
        }));
        const cr = r.headers.get('content-range');
        if (cr) h['Content-Range'] = cr;
        const cl = r.headers.get('content-length');
        if (cl) h['Content-Length'] = cl;
        log.info('  <-', r.status, h['Content-Type'], h['Content-Range'] || '');
        if (req.method === 'HEAD') { res.writeHead(r.status, h); return res.end(); }
        await relayBody(res, r.body, r.status, h, () => { lastActivity = Date.now(); });
        return;
      }

      /* ....... cas 200 avec Range demandé mais ignoré par la source :
              on découpe nous-mêmes pour garantir le seek ....... */
      if (req.headers.range && req.method === 'GET') {
        const contentLength = Number(r.headers.get('content-length'));
        const hasLen = Number.isFinite(contentLength) && contentLength > 0;
        const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        if (m && (m[1] !== '' || m[2] !== '')) {
          let start = m[1] === '' ? 0 : parseInt(m[1], 10);
          let end = m[2] === '' ? (hasLen ? contentLength - 1 : undefined) : parseInt(m[2], 10);
          if (isNaN(start) || start < 0) start = 0;
          if (hasLen && end !== undefined && isNaN(end)) end = contentLength - 1;
          // On ne découpe que si on peut borner proprement.
          if (Number.isInteger(start) && (end === undefined || Number.isInteger(end))) {
            if (hasLen) {
              if (start >= contentLength) { r.body.cancel().catch(() => {}); return send(res, 416, ''); }
              if (end === undefined || end >= contentLength) end = contentLength - 1;
            }
            const len = end !== undefined ? end - start + 1 : undefined;
            const cr = hasLen
              ? `bytes ${start}-${end}/${contentLength}`
              : `bytes ${start}-${end || '*'}/${hasLen ? contentLength : '*'}`;
            const h = withSec(Object.assign({}, cors, {
              'Cache-Control': 'no-store',
              'Content-Type': r.headers.get('content-type') || 'video/mp4',
              'Accept-Ranges': 'bytes',
              'Content-Range': cr,
            }));
            if (len !== undefined) h['Content-Length'] = len;
            log.info('  <- 200 découpé -> 206', cr);
            await relayBody(res, r.body, 206, h, () => { lastActivity = Date.now(); }, start, len);
            return;
          }
        }
      }

      /* ....... cas 200 simple ....... */
      const h = withSec(Object.assign({}, cors, {
        'Cache-Control': 'no-store',
        'Content-Type': r.headers.get('content-type') || 'video/mp4',
      }));
      const cl = r.headers.get('content-length');
      if (cl) h['Content-Length'] = cl;
      log.info('  <-', r.status, h['Content-Type'], h['Content-Length'] || '');
      if (req.method === 'HEAD') { res.writeHead(r.status, h); return res.end(); }
      await relayBody(res, r.body, r.status, h, () => { lastActivity = Date.now(); });
    } catch (e) {
      clearInterval(iv);
      if (ctrl.signal.aborted) log.warn('  !! proxy arrêté (inactivité ou durée max)');
      else log.error('  !! proxy error:', e && e.message);
      if (!res.headersSent) return send(res, 504, 'Proxy error\n');
      try { res.destroy(); } catch (e2) {}
    } finally {
      clearInterval(iv);
    }
  }

  /* ============================================================
     Handler principal
     ============================================================ */

  function handle(req, res) {
    let u;
    try { u = new URL(req.url, 'http://localhost'); }
    catch (e) { return send(res, 400, 'Bad request\n'); }

    try {
      if (u.pathname === '/_health') {
        if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed\n');
        return send(res, 200, 'ok');
      }
      if (u.pathname === '/proxy') {
        if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed\n');
        if (!u.searchParams.has('url')) return send(res, 400, 'Paramètre url manquant\n');
        return proxy(u.searchParams.get('url'), req, res);
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed\n');
      return serveStatic(req, res, u.pathname === '/' ? '/index.html' : u.pathname);
    } catch (e) {
      log.error('requête en échec:', e && e.message);
      if (!res.headersSent) return send(res, 500, 'Server error\n');
      try { res.destroy(); } catch (e2) {}
    }
  }

  const server = http.createServer(handle);
  server.on('clientError', (err, socket) => {
    if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  });

  return {
    server,
    cfg,
    internals: { isPrivateIP, isHostAllowed, hostIsPublic, assertProxyAllowed, computeAssetVersion },
  };
}

/* ============================================================
   Démarrage direct (node server.js)
   ============================================================ */
if (require.main === module) {
  const { server, cfg } = createServer();
  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      mainLogger.error('Le port ' + cfg.port + ' est déjà utilisé. Ferme l\'autre instance ou change SN_PORT.');
      process.exit(1);
    }
    mainLogger.error('Erreur serveur:', err && err.message);
  });
  server.listen(cfg.port, cfg.bindHost, () => {
    mainLogger.info('Serveur prêt : http://127.0.0.1:' + cfg.port + '/');
    mainLogger.info('Proxy vidéo : /proxy?url=...  (domaines autorisés : ' + cfg.allowedProxyHosts.join(', ') + ')');
    mainLogger.debug('Cache-buster local : ' + computeAssetVersion(cfg));
  });
}

process.on('uncaughtException', (e) => { mainLogger.error('uncaughtException:', e && e.stack || e); });
process.on('unhandledRejection', (e) => { mainLogger.error('unhandledRejection:', e && e.stack || e); });

module.exports = { createServer, config, send, withSec, isPrivateIP };