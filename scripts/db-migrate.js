// DriftStop — Supabase şema migration çalıştırıcı.
// .env içindeki SUPABASE_PASSWORD ile doğrudan Postgres bağlantısı kurar,
// supabase/migrations/*.sql dosyalarını sırayla, daha önce uygulanmamış olanları çalıştırır.
//
// Kullanım: npm run db:migrate
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const PROJECT_REF = 'ftohdffebzhrthrpeuos';
// Doğrudan db.<ref>.supabase.co IPv6-only olduğu için (bu ağda IPv6 çıkışı yok),
// IPv4 uyumlu Session Pooler kullanıyoruz.
const POOLER_HOST = 'aws-0-ap-northeast-1.pooler.supabase.com';
const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations');

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

async function ensureMigrationsTable(client) {
  await client.query(`
    create table if not exists _migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    );
  `);
}

async function appliedMigrations(client) {
  const { rows } = await client.query('select name from _migrations');
  return new Set(rows.map((r) => r.name));
}

async function main() {
  const client = new Client({ connectionString: buildConnectionString(), ssl: { rejectUnauthorized: false } });

  console.log('Supabase Postgres\'e bağlanılıyor...');
  await client.connect();
  console.log('✔ Bağlantı kuruldu.\n');

  await ensureMigrationsTable(client);
  const applied = await appliedMigrations(client);

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let ranAny = false;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`⏭  ${file} (zaten uygulanmış)`);
      continue;
    }
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    console.log(`▶  ${file} uygulanıyor...`);
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into _migrations (name) values ($1)', [file]);
      await client.query('commit');
      console.log(`✔  ${file} tamamlandı.\n`);
      ranAny = true;
    } catch (err) {
      await client.query('rollback');
      console.error(`✘  ${file} başarısız:`, err.message);
      await client.end();
      process.exit(1);
    }
  }

  if (!ranAny) console.log('Uygulanacak yeni migration yok — şema güncel.');

  await client.end();
}

main().catch((err) => {
  console.error('Migration çalıştırılamadı:', err.message);
  process.exit(1);
});
