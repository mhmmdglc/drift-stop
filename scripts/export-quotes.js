/**
 * quotes.json'ı insan-okur QUOTES.md'ye döker (kategoriye göre gruplu).
 * Çalıştır: node scripts/export-quotes.js
 */
const fs = require('fs');
const path = require('path');

const quotes = require('../src/data/quotes.json');
const OUT = path.join(__dirname, '..', 'QUOTES.md');

const CAT_TR = {
  resilience: 'Dayanıklılık',
  fire: 'Ateş',
  discipline: 'Disiplin',
  regret: 'Pişmanlık',
  wisdom: 'Hikmet',
  identity: 'Kimlik',
  suffering: 'Acı',
  legacy: 'Miras',
};
const ERA_TR = { ancient: 'Antik', medieval: 'Orta Çağ', modern: 'Modern', contemporary: 'Çağdaş' };
const TAG_TR = {
  motivation: 'Motivasyon', discipline: 'Disiplin', resilience: 'Dayanıklılık', focus: 'Odak',
  wisdom: 'Bilgelik', peace: 'Huzur', reckoning: 'Yüzleşme', legacy: 'Miras',
};
const ORDER = ['fire', 'discipline', 'resilience', 'regret', 'suffering', 'identity', 'wisdom', 'legacy'];

const byCat = {};
for (const q of quotes) (byCat[q.category] ??= []).push(q);

let md = `# DriftStop — ${quotes.length} Söz\n\n`;
md += `> Hızlı gözden geçirme. Kategoriye göre gruplu. Kalın = uygulamada görünen Türkçe metin; italik = orijinal (farklıysa).\n\n`;

md += `## İçindekiler\n\n`;
for (const cat of ORDER) {
  md += `- [${CAT_TR[cat]}](#${CAT_TR[cat].toLowerCase().replace(/ /g, '-').replace(/ç/g,'c').replace(/ı/g,'i').replace(/ş/g,'s').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ö/g,'o')}) — ${(byCat[cat] || []).length}\n`;
}
md += `\n---\n\n`;

let n = 0;
for (const cat of ORDER) {
  const list = byCat[cat] || [];
  md += `## ${CAT_TR[cat]} — ${list.length}\n\n`;
  for (const q of list) {
    n++;
    const sameText = q.text.trim() === q.textTr.trim();
    const orig = sameText ? '' : ` _“${q.text}”_`;
    const tagList = (q.tags || []).map((tg) => TAG_TR[tg] || tg).join(', ');
    md += `${q.id}. **“${q.textTr}”** — ${q.author} · ${q.originEmoji} ${q.origin} · ${ERA_TR[q.era]} · \`${tagList}\`${orig}\n`;
  }
  md += `\n`;
}

fs.writeFileSync(OUT, md);
console.log(`Wrote ${OUT} (${quotes.length} quotes, ${n} listed)`);
