/* ============================================================
   SN Streaming - Configuration centralisée
   Toutes les constantes "serveur/tunnel" sont ici.
   Ajustable via variables d'environnement :
     SN_PORT           port d'écoute (défaut 8766)
     SN_LOG            niveau de log : debug|info|warn|error|none
     SN_PROXY_INACTIVITY_MS  inertie max du proxy (ms)
     SN_PROXY_MAX_MS         durée max globale d'un flux proxy (ms)
   ============================================================ */
'use strict';

const path = require('path');

const ROOT = __dirname;

module.exports = Object.freeze({
  port: Number(process.env.SN_PORT) || 8766,
  bindHost: '127.0.0.1',
  root: ROOT,

  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',

  /* ---- proxy vidéo ---- */
  // Seuls ces domaines (et leurs sous-domaines) sont relayés par /proxy.
  allowedProxyHosts: ['sibnet.ru'],
  // Aucun octet reçu de la source pendant ce délai -> le flux est coupé.
  proxyInactivityMs: Number(process.env.SN_PROXY_INACTIVITY_MS) || 60000,
  // Durée d'écoute (connexion au serveur source) avant abandon.
  proxyConnectMs: 15000,
  // Durée totale maximale d'un flux via le proxy (6 h par défaut).
  proxyMaxMs: Number(process.env.SN_PROXY_MAX_MS) || 6 * 3600 * 1000,

  /* ---- fichiers statiques ---- */
  mime: {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.gif': 'image/gif',
    '.webm': 'video/webm',
    '.mp4': 'video/mp4',
    '.ogg': 'video/ogg',
    '.ogv': 'video/ogg',
    '.mov': 'video/quicktime',
    '.m3u8': 'application/vnd.apple.mpegurl',
    '.ts': 'video/mp2t',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.vtt': 'text/vtt; charset=utf-8',
    '.srt': 'text/plain; charset=utf-8',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.eot': 'application/vnd.ms-fontobject',
    '.wasm': 'application/wasm',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.webmanifest': 'application/manifest+json',
    '.map': 'application/json',
  },
  // Extensions compressées (gzip) à la volée.
  compressible: ['.html', '.js', '.mjs', '.css', '.json', '.txt', '.md', '.svg', '.vtt', '.webmanifest', '.map'],
  // Cache long (immutable) pour les assets chargés avec ?v=...
  immutableAssets: true,

  /* ---- logs ---- */
  logLevel: process.env.SN_LOG || 'info', // debug|info|warn|error|none
  logDir: path.join(ROOT, 'logs'),
  maxLogSize: 1 << 20, // 1 Mo avant rotation
});