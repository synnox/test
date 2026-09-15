/* Validation du catalogue (js/data.js) : ids uniques, champs requis,
   valeurs cohérentes. Utilisable en CI et localement :
     node scripts/check-data.js   (sortie non vide = erreur, exit 1)
*/
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const file = path.join(__dirname, '..', 'js', 'data.js');
const src = fs.readFileSync(file, 'utf8');

let CATALOG;
try {
  // le `const` du fichier n'est pas exposé au contexte : on évalue
  // une expression qui renvoie la valeur (dernière expression = retour).
  CATALOG = vm.runInNewContext(src + '\n;CATALOG;', {}, { filename: file });
} catch (e) {
  console.error('[check-data] impossible d\'évaluer ' + file + ' :', e.message);
  process.exit(1);
}
const errors = [];
const warn = [];

if (!Array.isArray(CATALOG)) {
  console.error('[check-data] CATALOG absent ou pas un tableau.');
  process.exit(1);
}

const seen = new Set();
const seenTitles = new Set();
const genreSet = new Set();

CATALOG.forEach((it, i) => {
  const where = 'film #' + (i + 1) + ' (id=' + it.id + ')';

  if (!Number.isInteger(it.id) || it.id <= 0) { errors.push(where + ' : id manquant / non entier'); }
  else if (seen.has(it.id)) { errors.push(where + ' : id dupliqué (' + it.id + ')'); }
  seen.add(it.id);

  if (it.type !== 'movie' && it.type !== 'series') errors.push(where + ' : type invalide (' + it.type + ')');

  if (typeof it.title !== 'string' || !it.title.trim()) errors.push(where + ' : titre manquant');
  else {
    const k = it.title.toLowerCase().trim();
    if (seenTitles.has(k)) warn.push(where + ' : titre en double (« ' + it.title + ' »)');
    seenTitles.add(k);
  }

  if (!Number.isInteger(it.year)) errors.push(where + ' : année invalide (' + it.year + ')');
  if (!(typeof it.rating === 'number') || it.rating < 0 || it.rating > 10) errors.push(where + ' : note hors bornes (0-10) : ' + it.rating);

  if (!Array.isArray(it.genres) || !it.genres.length) errors.push(where + ' : genres vides');
  else it.genres.forEach(g => {
    if (typeof g !== 'string' || !g.trim()) errors.push(where + ' : genre invalide');
    else genreSet.add(g);
  });

  ['synopsis', 'director'].forEach(k => {
    if (typeof it[k] !== 'string' || !it[k].trim()) errors.push(where + ' : ' + k + ' manquant');
  });

  if (!Array.isArray(it.cast)) errors.push(where + ' : cast manquant (doit être un tableau)');
  else if (it.cast.length && it.cast.some(c => typeof c !== 'string' || !c.trim())) errors.push(where + ' : entrée de cast invalide');

  if (it.type === 'movie' && (typeof it.duration !== 'string' || !it.duration.trim())) errors.push(where + ' : durée manquante (film)');
  if (it.type === 'series' && !Array.isArray(it.seasons)) errors.push(where + ' : saisons manquantes (série)');

  if (typeof it.source !== 'string' || !/^https?:\/\//i.test(it.source)) errors.push(where + ' : source invalide (doit être http(s))');
  if (it.poster != null && (typeof it.poster !== 'string' || !it.poster.trim())) warn.push(where + ' : poster ignoré (vide)');
  if (it.featured != null && typeof it.featured !== 'boolean') warn.push(where + ' : featured n\'est pas un booléen');
});

if (warn.length) {
  console.warn('[check-data] avertissements : ' + warn.length);
  warn.forEach(w => console.warn('  - ' + w));
}

if (errors.length) {
  console.error('[check-data] ' + errors.length + ' erreur(s) dans le catalogue :');
  errors.forEach(e => console.error('  - ' + e));
  process.exit(1);
}

const byType = {};
CATALOG.forEach(it => { byType[it.type] = (byType[it.type] || 0) + 1; });
const notes = CATALOG.map(it => it.rating);
const years = CATALOG.map(it => it.year);

console.log('[check-data] OK — ' + CATALOG.length + ' entrées' +
  ' | films: ' + (byType.movie || 0) +
  ' | séries: ' + (byType.series || 0) +
  ' | genres: ' + genreSet.size +
  ' | note min/max: ' + Math.min(...notes) + '/' + Math.max(...notes) +
  ' | années: ' + Math.min(...years) + '-' + Math.max(...years));