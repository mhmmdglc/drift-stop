// DriftStop — Faz 1: src/data/quotes.json içindeki 1000 sözü Supabase `quotes`
// tablosuna taşır (upsert, tekrar çalıştırılabilir). `is_premium` ve `pack_id`
// alanlarına dokunmaz — premium paket ataması ayrı, Faz 4 işi.
//
// Kullanım: npm run db:seed-quotes
require('dotenv').config();
const path = require('path');
const { Client } = require('pg');
const quotes = require('../src/data/quotes.json');

const PROJECT_REF = 'ftohdffebzhrthrpeuos';
const POOLER_HOST = 'aws-0-ap-northeast-1.pooler.supabase.com';
const BATCH_SIZE = 200;

function buildConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const password = process.env.SUPABASE_PASSWORD;
  if (!password) {
    console.error('HATA: .env dosyasında SUPABASE_PASSWORD veya DATABASE_URL bulunamadı.');
    process.exit(1);
  }
  const encoded = encodeURIComponent(password);
  return `postgresql://postgres.${PROJECT_REF}:${encoded}@${POOLER_HOST}:5432/postgres`;
}

const COLUMNS = ['id', 'text', 'text_tr', 'author', 'origin', 'origin_emoji', 'category', 'era', 'tags'];

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function upsertBatch(client, batch) {
  const values = [];
  const rows = batch.map((q, i) => {
    const base = i * COLUMNS.length;
    values.push(q.id, q.text, q.textTr, q.author, q.origin, q.originEmoji, q.category, q.era, q.tags);
    return `(${COLUMNS.map((_, j) => `$${base + j + 1}`).join(', ')})`;
  });

  const sql = `
    insert into quotes (${COLUMNS.join(', ')})
    values ${rows.join(', ')}
    on conflict (id) do update set
      text = excluded.text,
      text_tr = excluded.text_tr,
      author = excluded.author,
      origin = excluded.origin,
      origin_emoji = excluded.origin_emoji,
      category = excluded.category,
      era = excluded.era,
      tags = excluded.tags,
      updated_at = now();
  `;
  await client.query(sql, values);
}

async function main() {
  console.log(`${quotes.length} söz bulundu (${path.relative(process.cwd(), require.resolve('../src/data/quotes.json'))}).`);

  const client = new Client({ connectionString: buildConnectionString(), ssl: { rejectUnauthorized: false } });
  console.log('Supabase Postgres\'e bağlanılıyor...');
  await client.connect();
  console.log('✔ Bağlantı kuruldu.\n');

  const batches = chunk(quotes, BATCH_SIZE);
  let done = 0;
  for (const batch of batches) {
    await client.query('begin');
    try {
      await upsertBatch(client, batch);
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      console.error('✘ Batch başarısız:', err.message);
      await client.end();
      process.exit(1);
    }
    done += batch.length;
    console.log(`▶  ${done}/${quotes.length} söz yazıldı...`);
  }

  const { rows } = await client.query('select count(*)::int as count from quotes');
  console.log(`\n✔ Tamamlandı. quotes tablosunda toplam ${rows[0].count} satır var.`);

  await client.end();
}

main().catch((err) => {
  console.error('Seed çalıştırılamadı:', err.message);
  process.exit(1);
});
