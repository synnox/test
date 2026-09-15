'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createServer } = require('../server');

const silentLogger = {
  debug() {}, info() {}, warn() {}, error() {},
};

let server;
let base;

const FIXTURE_FILES = {
  'index.html': '<!doctype html><title>SN</title><script src="js/app.js?v=OLD"></script>',
  'css/style.css': 'body{color:#fff}\n',
};

before(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sn-test-'));
  for (const [name, content] of Object.entries(FIXTURE_FILES)) {
    const full = path.join(root, name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  fs.writeFileSync(path.join(root, 'data.bin'), Buffer.alloc(3000, 7));

  const created = createServer({ config: { root, port: 0, bindHost: '127.0.0.1' }, logger: silentLogger });
  server = created.server;
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  base = 'http://127.0.0.1:' + server.address().port;
});

after(async () => {
  if (server) await new Promise((ok) => server.close(ok));
});

async function get(p, opts = {}, extra = {}) {
  const res = await fetch(base + p, {
    method: extra.method || 'GET',
    headers: opts,
    redirect: 'manual',
  });
  const body = Buffer.from(await res.arrayBuffer());
  return { res, body };
}

test('GET /_health -> 200 "ok"', async () => {
  const { res, body } = await get('/_health');
  assert.equal(res.status, 200);
  assert.equal(body.toString('utf8'), 'ok');
});

test('GET /_health interdit en POST -> 405', async () => {
  const { res } = await get('/_health', {}, { method: 'POST' });
  assert.equal(res.status, 405);
});

test('GET / sert index.html + injecte le cache-buster', async () => {
  const { res, body } = await get('/');
  assert.equal(res.status, 200);
  const html = body.toString('utf8');
  assert.match(html, /js\/app\.js\?v=[a-z0-9]+/);
  assert.ok(!html.includes('js/app.js?v=OLD'), 'le cache-buster "OLD" doit être remplacé');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
});

test('traversal (..%2f) -> 403', async () => {
  const { res } = await get('/..%2f..%2fetc%2fpasswd');
  assert.equal(res.status, 403);
});

test('fichier inconnu -> 404', async () => {
  const { res } = await get('/nope.txt');
  assert.equal(res.status, 404);
});

test('gzip : index compressé quand Accept-Encoding: gzip', async () => {
  const { res, body } = await get('/index.html', { 'Accept-Encoding': 'gzip' });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-encoding'), 'gzip');
  // fetch() décompresse automatiquement le corps ; on vérifie donc le contenu décodé.
  assert.match(body.toString('utf8'), /<!doctype html>/);
});

test('Range : bytes=0-9 -> 206 découpé', async () => {
  const { res, body } = await get('/data.bin', { Range: 'bytes=0-9' });
  assert.equal(res.status, 206);
  assert.equal(body.length, 10);
  assert.equal(res.headers.get('content-range'), 'bytes 0-9/3000');
  assert.equal(res.headers.get('accept-ranges'), 'bytes');
});

test('Range invalide (hors fichiers) -> 416', async () => {
  const { res } = await get('/data.bin', { Range: 'bytes=9999-10000' });
  assert.equal(res.status, 416);
  assert.equal(res.headers.get('content-range'), 'bytes */3000');
});

test('ETag : If-None-Match -> 304', async () => {
  const first = await get('/data.bin', { Range: 'bytes=0-9' });
  const etag = first.res.headers.get('etag');
  assert.ok(etag, 'un ETag doit être présent');
  const { res } = await get('/data.bin', { Range: 'bytes=0-9', 'If-None-Match': etag });
  assert.equal(res.status, 304);
});

test('HEAD renvoie headers sans corps', async () => {
  const { res, body } = await get('/data.bin', {}, { method: 'HEAD' });
  assert.equal(res.status, 200);
  assert.equal(body.length, 0);
  assert.equal(res.headers.get('content-length'), '3000');
});

test('proxy : url manquante -> 400', async () => {
  const { res } = await get('/proxy');
  assert.equal(res.status, 400);
});

test('proxy : domaine hors allowlist -> 403', async () => {
  const { res } = await get('/proxy?url=' + encodeURIComponent('http://evil.com/v.mp4'));
  assert.equal(res.status, 403);
});

test('proxy : host privé (127.0.0.1) -> 403', async () => {
  const { res } = await get('/proxy?url=' + encodeURIComponent('http://127.0.0.1:9/x.mp4'));
  assert.equal(res.status, 403);
});

test('internals : isPrivateIP / isHostAllowed', () => {
  const internals = createServer({ config: { root: os.tmpdir() }, logger: silentLogger }).internals;
  assert.equal(internals.isPrivateIP('127.0.0.1'), true);
  assert.equal(internals.isPrivateIP('192.168.1.10'), true);
  assert.equal(internals.isPrivateIP('172.16.5.5'), true);
  assert.equal(internals.isPrivateIP('8.8.8.8'), false);
  assert.equal(internals.isHostAllowed('sibnet.ru'), true);
  assert.equal(internals.isHostAllowed('video.sibnet.ru'), true);
  assert.equal(internals.isHostAllowed('notsibnet.ru'), false);
});