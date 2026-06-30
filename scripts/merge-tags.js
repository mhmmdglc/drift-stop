/**
 * src/data/tags/*.json (id → tags[]) parçalarını okuyup quotes.json'a `tags` ekler.
 * - geçersiz/duplike tag'leri ayıklar, en fazla 4
 * - tag'siz kalan söze kategorisinden fallback tag verir
 * Çalıştır: node scripts/merge-tags.js
 */
const fs = require('fs');
const path = require('path');

const QUOTES = path.join(__dirname, '..', 'src', 'data', 'quotes.json');
const TAGS_DIR = path.join(__dirname, '..', 'src', 'data', 'tags');

const VOCAB = new Set([
  'motivation', 'discipline', 'resilience', 'focus', 'wisdom', 'peace', 'reckoning', 'legacy',
]);

const CATEGORY_FALLBACK = {
  resilience: ['resilience'],
  fire: ['motivation'],
  discipline: ['discipline'],
  regret: ['reckoning'],
  wisdom: ['wisdom'],
  identity: ['wisdom'],
  suffering: ['reckoning', 'resilience'],
  legacy: ['legacy'],
};

const quotes = JSON.parse(fs.readFileSync(QUOTES, 'utf8'));

// tag haritası
const tagMap = new Map();
for (const f of fs.readdirSync(TAGS_DIR).filter((x) => x.endsWith('.json'))) {
  const arr = JSON.parse(fs.readFileSync(path.join(TAGS_DIR, f), 'utf8'));
  for (const { id, tags } of arr) {
    const clean = [...new Set((tags || []).filter((t) => VOCAB.has(t)))].slice(0, 4);
    if (clean.length) tagMap.set(id, clean);
  }
}

let fromAgents = 0;
let fromFallback = 0;
const dist = {};

const out = quotes.map((q) => {
  let tags = tagMap.get(q.id);
  if (tags && tags.length) {
    fromAgents++;
  } else {
    tags = CATEGORY_FALLBACK[q.category] || ['motivation'];
    fromFallback++;
  }
  for (const t of tags) dist[t] = (dist[t] || 0) + 1;
  return {
    id: q.id,
    text: q.text,
    textTr: q.textTr,
    author: q.author,
    origin: q.origin,
    originEmoji: q.originEmoji,
    category: q.category,
    era: q.era,
    tags,
  };
});

fs.writeFileSync(QUOTES, JSON.stringify(out, null, 2) + '\n');

console.log(`Quotes: ${out.length}`);
console.log(`Tagged by agents: ${fromAgents}`);
console.log(`Fallback from category: ${fromFallback}`);
console.log('Tag distribution:', JSON.stringify(dist));
const missing = out.filter((q) => !q.tags || q.tags.length === 0).length;
console.log(`Quotes with no tags: ${missing}`);
