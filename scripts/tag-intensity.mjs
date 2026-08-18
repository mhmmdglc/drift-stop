// DriftStop — W3.1 (sertlik ayarı) ön-etiketleme.
//
// METİN ÜRETMEZ — 1000 sözün MEVCUT metnini kategori/tag önyargısı + İngilizce
// gövdedeki anahtar kelime sinyaliyle 1 (sakin bilge) / 2 (sert) / 3 (acımasız)
// olarak ÖN-ETİKETLER. Otomatik etiket asla doğrudan `quotes.json`'a yazılmaz —
// bu script yalnızca `intensity-review.csv` üretir; düşük-güvenli satırları
// (skor bir sertlik sınırına çok yakınsa, ya da kategori/anahtar-kelime sinyali
// birbiriyle çelişiyorsa) ayrıca işaretler ki sahip 1000 satırın tamamını değil
// sadece o alt kümeyi okusun.
//
// Çalıştır: node scripts/tag-intensity.mjs
// Çıktı: intensity-review.csv (repo kökünde, git'e eklenmez — bkz. .gitignore notu)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QUOTES_PATH = path.join(__dirname, '..', 'src', 'data', 'quotes.json');
const OUT_PATH = path.join(__dirname, '..', 'intensity-review.csv');

/**
 * Kategori önyargısı — spec kararı: "reckoning ağırlıklı 3'e, legacy 1-2'ye yatar".
 * BİLEREK tam sayı: `.5` gibi bir değer HER satırı otomatik sınıra oturtup
 * (round(2.5)=3, mesafe her zaman 0.5) düşük-güven oranını yapay şişiriyordu.
 * fire/legacy'nin sertlik eğilimi burada değil TAG_DELTA + anahtar kelime
 * sinyaliyle kuruluyor — "temiz" (sinyalsiz) bir söz tam sayıda oturur,
 * yalnızca gerçek bir sinyal varsa sınıra yaklaşır.
 */
const CATEGORY_BASE = {
  regret: 3, // pişmanlık/hesaplaşma — en sert kategori
  suffering: 3,
  fire: 2,
  discipline: 2,
  resilience: 2,
  identity: 2,
  legacy: 2,
  wisdom: 1, // en sakin kategori
};

/** Tag ince-ayarı — kategoriye ek, küçük deltalar. */
const TAG_DELTA = {
  reckoning: 0.5,
  peace: -0.5,
  wisdom: -0.3,
  legacy: -0.2,
  motivation: 0.1,
  discipline: 0,
  resilience: 0,
  focus: 0,
};

/** Sert/acımasız imge — İngilizce gövdede geçiyorsa skoru yukarı iter. */
const HARSH_WORDS = [
  'die', 'death', 'dead', 'kill', 'suffer', 'suffering', 'pain', 'blood',
  'war', 'fight', 'battle', 'destroy', 'break', 'burn', 'scream', 'brutal',
  'ruthless', 'merciless', 'grave', 'corpse', 'rot', 'ashes', 'weak',
  'coward', 'excuses', 'no excuses', 'fail', 'failure', 'fear', 'enemy',
  'wound', 'scar', 'bleed', 'sacrifice', 'grief', 'ruin', 'wreck',
];

/** Sakin/nazik imge — geçiyorsa skoru aşağı iter. */
const CALM_WORDS = [
  'peace', 'calm', 'gentle', 'rest', 'kind', 'kindness', 'love', 'hope',
  'grace', 'patience', 'patient', 'quiet', 'stillness', 'breath', 'heal',
  'comfort', 'joy', 'beauty', 'grateful', 'gratitude', 'compassion',
  'tender', 'serenity', 'harmony', 'bloom', 'gift', 'wonder',
];

function keywordAdjustment(text) {
  const lower = text.toLowerCase();
  let harsh = 0;
  let calm = 0;
  for (const w of HARSH_WORDS) if (lower.includes(w)) harsh++;
  for (const w of CALM_WORDS) if (lower.includes(w)) calm++;
  // Her iki yönde de en fazla 4 kelime sayılır (tek bir aşırı-yüklü cümle
  // tüm skoru domine etmesin), her kelime 0.15 puan.
  const adj = Math.min(harsh, 4) * 0.15 - Math.min(calm, 4) * 0.15;
  return { adj, harsh, calm };
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function csvEscape(s) {
  const str = String(s ?? '');
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

const quotes = JSON.parse(fs.readFileSync(QUOTES_PATH, 'utf8'));

const results = [];
for (const q of quotes) {
  const base = CATEGORY_BASE[q.category] ?? 2; // bilinmeyen kategori → nötr orta
  const tagSum = (q.tags || []).reduce((sum, t) => sum + (TAG_DELTA[t] ?? 0), 0);
  const { adj: kwAdj, harsh, calm } = keywordAdjustment(q.text);

  const rawScore = clamp(base + tagSum + kwAdj, 1, 3);
  const suggested = Math.round(rawScore);

  // Düşük-güvenli işaretleme sebepleri (birden fazlası olabilir):
  const reasons = [];
  const distToBoundary = Math.abs(rawScore - suggested);
  if (distToBoundary > 0.35) reasons.push('sınıra-yakın');
  // Kategori önyargısı sert (>=2.5) ama metin sinyali belirgin sakin (<=-0.3),
  // ya da tersi — iki sinyal çelişiyor.
  if (base === 3 && kwAdj <= -0.3) reasons.push('kategori-vs-metin-çelişkisi');
  if (base === 1 && kwAdj >= 0.3) reasons.push('kategori-vs-metin-çelişkisi');

  results.push({
    id: q.id,
    text: q.text,
    category: q.category,
    tags: (q.tags || []).join('|'),
    rawScore: rawScore.toFixed(2),
    suggested,
    lowConfidence: reasons.length > 0,
    reasons: reasons.join(';'),
  });
}

const lowConf = results.filter((r) => r.lowConfidence);

const header = 'id,suggested_intensity,confidence,reasons,category,tags,raw_score,text';
const rows = lowConf.map((r) =>
  [
    r.id,
    r.suggested,
    'LOW',
    csvEscape(r.reasons),
    r.category,
    csvEscape(r.tags),
    r.rawScore,
    csvEscape(r.text),
  ].join(',')
);
fs.writeFileSync(OUT_PATH, [header, ...rows].join('\n') + '\n', 'utf8');

const dist = { 1: 0, 2: 0, 3: 0 };
for (const r of results) dist[r.suggested]++;

console.log(`Toplam söz: ${results.length}`);
console.log(`Önerilen dağılım — 1 (sakin): ${dist[1]}, 2 (sert): ${dist[2]}, 3 (acımasız): ${dist[3]}`);
console.log(`Düşük-güvenli (CSV'ye yazıldı): ${lowConf.length} / ${results.length}`);
console.log(`Çıktı: ${OUT_PATH}`);
