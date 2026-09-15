/* ============================================================
   SN Streaming - Logger minimal
   - niveaux : debug < info < warn < error  (config.logLevel)
   - écran + fichier logs/server.log avec rotation 1 Mo
   - niveau "none" pour couper tout (utilisé par les tests)
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, none: 99 };

function createLogger(opts) {
  const cfg = opts || require('../config');
  const level = LEVELS[cfg.logLevel] !== undefined ? cfg.logLevel : 'info';
  const threshold = LEVELS[level];

  let fileFd = null;
  function openFile() {
    if (fileFd) return;
    try {
      fs.mkdirSync(cfg.logDir, { recursive: true });
      const p = path.join(cfg.logDir, 'server.log');
      // rotation simple : si le fichier dépasse la taille max, on le renomme.
      try {
        const st = fs.statSync(p);
        if (st.size > cfg.maxLogSize) fs.renameSync(p, p + '.1');
      } catch (e) { /* pas encore de fichier */ }
      fileFd = fs.openSync(p, 'a');
    } catch (e) {
      fileFd = null; // pas de droits d'écriture : on reste en console seule
    }
  }

  function format(levelName, args) {
    const ts = new Date().toISOString();
    const msg = args.map((a) => (typeof a === 'string' ? a : safeString(a))).join(' ');
    return `[${ts}] [${levelName}] ${msg}`;
  }

  function safeString(o) {
    try { return JSON.stringify(o); } catch (e) { return String(o); }
  }

  function write(levelName, levelValue, args) {
    if (levelValue < threshold) return;
    const line = format(levelName, args);
    if (levelName === 'error') console.error(line);
    else console.log(line);
    openFile();
    if (fileFd) {
      try { fs.writeSync(fileFd, line + '\n'); }
      catch (e) { /* défile, on continue en console */ }
    }
  }

  return {
    debug: (...a) => write('debug', LEVELS.debug, a),
    info: (...a) => write('info', LEVELS.info, a),
    warn: (...a) => write('warn', LEVELS.warn, a),
    error: (...a) => write('error', LEVELS.error, a),
    close() {
      if (fileFd) { try { fs.closeSync(fileFd); } catch (e) {} }
      fileFd = null;
    },
  };
}

module.exports = { createLogger, LEVELS };