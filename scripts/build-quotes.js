/**
 * Bölge bazlı üretilen src/data/gen/*.json parçalarını birleştirir:
 *  - dosyaları round-robin harmanlar (çeşitlilik için)
 *  - şema doğrular (anahtarlar, category/era enum, boş alan yok)
 *  - text/textTr'ye göre tekrarları ayıklar
 *  - en fazla TARGET kadar tutar, sıralı id atar (1..N)
 *  - src/data/quotes.json olarak yazar
 * Çalıştır: node scripts/build-quotes.js
 */
const fs = require('fs');
const path = require('path');

const GEN_DIR = path.join(__dirname, '..', 'src', 'data', 'gen');
const OUT = path.join(__dirname, '..', 'src', 'data', 'quotes.json');
const TARGET = 1000;

const CATEGORIES = new Set([
  'resilience', 'fire', 'discipline', 'regret', 'wisdom', 'identity', 'suffering', 'legacy',
]);
const ERAS = new Set(['ancient', 'medieval', 'modern', 'contemporary']);
const KEYS = ['text', 'textTr', 'author', 'origin', 'originEmoji', 'category', 'era'];

const norm = (s) =>
  String(s).toLowerCase().replace(/\s+/g, ' ').replace(/["'“”‘’.,!?;:]/g, '').trim();

const files = fs.readdirSync(GEN_DIR).filter((f) => f.endsWith('.json')).sort();
const buckets = [];
const perFile = {};
const problems = [];

for (const f of files) {
  let arr;
  try {
    arr = JSON.parse(fs.readFileSync(path.join(GEN_DIR, f), 'utf8'));
  } catch (e) {
    problems.push(`PARSE FAIL ${f}: ${e.message}`);
    continue;
  }
  if (!Array.isArray(arr)) {
    problems.push(`NOT ARRAY ${f}`);
    continue;
  }
  perFile[f] = arr.length;
  buckets.push(arr.map((q) => ({ __src: f, ...q })));
}

// Round-robin harmanla
const merged = [];
let raw = 0;
for (let i = 0; ; i++) {
  let any = false;
  for (const b of buckets) {
    if (i < b.length) {
      merged.push(b[i]);
      raw++;
      any = true;
    }
  }
  if (!any) break;
}

// Doğrulama + dedup + cap
const seen = new Set();
const valid = [];
let dupCount = 0;
let invalidCount = 0;

for (const q of merged) {
  if (valid.length >= TARGET) break;
  const missing = KEYS.filter((k) => !q[k] || String(q[k]).trim() === '');
  if (missing.length) {
    invalidCount++;
    problems.push(`INVALID [${q.__src}] missing ${missing.join(',')} :: ${(q.text || '').slice(0, 40)}`);
    continue;
  }
  if (!CATEGORIES.has(q.category)) {
    invalidCount++;
    problems.push(`BAD CATEGORY [${q.__src}] ${q.category}`);
    continue;
  }
  if (!ERAS.has(q.era)) {
    invalidCount++;
    problems.push(`BAD ERA [${q.__src}] ${q.era}`);
    continue;
  }
  const keyTr = norm(q.textTr);
  const keyEn = norm(q.text);
  if (seen.has(keyTr) || seen.has(keyEn)) {
    dupCount++;
    continue;
  }
  seen.add(keyTr);
  seen.add(keyEn);
  valid.push({
    text: q.text.trim(),
    textTr: q.textTr.trim(),
    author: q.author.trim(),
    origin: q.origin.trim(),
    originEmoji: q.originEmoji.trim(),
    category: q.category,
    era: q.era,
  });
}

const out = valid.map((q, i) => ({ id: i + 1, ...q }));
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');

// Rapor
console.log('Per-file counts:');
for (const f of files) console.log(`  ${f}: ${perFile[f] ?? 'ERR'}`);
console.log(`Raw merged: ${raw}`);
console.log(`Duplicates skipped: ${dupCount}`);
console.log(`Invalid skipped: ${invalidCount}`);
console.log(`FINAL quotes.json count: ${out.length}`);

const catDist = {};
const eraDist = {};
for (const q of out) {
  catDist[q.category] = (catDist[q.category] || 0) + 1;
  eraDist[q.era] = (eraDist[q.era] || 0) + 1;
}
console.log('Category distribution:', JSON.stringify(catDist));
console.log('Era distribution:', JSON.stringify(eraDist));

if (problems.length) {
  console.log('\nPROBLEMS (first 20):');
  problems.slice(0, 20).forEach((p) => console.log('  ' + p));
  console.log(`...total problems: ${problems.length}`);
}
