// DriftStop — Faz 4: premium içerik paketlerini Supabase'e yazar.
// `quote_packs` + bu pakete ait `quotes` satırlarını upsert eder (tekrar
// çalıştırılabilir). Bu sözler BİLİNÇLİ OLARAK `src/data/quotes.json`'a
// eklenmedi — premium/server-driven içerik, sadece Supabase'te yaşar ve
// istemciye sadece Pro aboneler için senkronize edilir (RLS: quotes_premium_read_entitled).
//
// Kullanım: npm run db:seed-packs
require('dotenv').config();
const { Client } = require('pg');

const PROJECT_REF = 'ftohdffebzhrthrpeuos';
const POOLER_HOST = 'aws-0-ap-northeast-1.pooler.supabase.com';

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

// ── Paket 1: Stoacılar (Marcus Aurelius, Seneca, Epictetus) ────────────────
const STOICS_PACK = {
  id: 'stoics',
  name: { tr: 'Stoacılar', en: 'The Stoics' },
  description: {
    tr: 'Marcus Aurelius, Seneca ve Epiktetos\'tan; kontrol, disiplin ve iç huzur üzerine 24 söz.',
    en: '24 sayings from Marcus Aurelius, Seneca, and Epictetus on control, discipline, and inner calm.',
  },
  coverImageUrl: null,
  isPremium: true,
  sortOrder: 0,
};

const STOICS_QUOTES = [
  { id: 100001, author: 'Marcus Aurelius', category: 'discipline', tags: ['discipline', 'focus'],
    text: 'You have power over your mind, not outside events. Realize this, and you will find strength.',
    textTr: 'Aklın üzerinde gücün var, dış olaylar üzerinde değil. Bunu kavradığında güç bulursun.' },
  { id: 100002, author: 'Marcus Aurelius', category: 'discipline', tags: ['discipline', 'resilience'],
    text: 'Waste no more time arguing about what a good man should be. Be one.',
    textTr: 'İyi bir insanın nasıl olması gerektiğini tartışarak vakit kaybetme. Öyle biri ol.' },
  { id: 100003, author: 'Marcus Aurelius', category: 'resilience', tags: ['resilience', 'wisdom'],
    text: 'The obstacle on the path becomes the path. Never forget this.',
    textTr: 'Yoldaki engel, yolun kendisi olur. Bunu asla unutma.' },
  { id: 100004, author: 'Marcus Aurelius', category: 'wisdom', tags: ['wisdom', 'focus'],
    text: 'How much time he gains who does not look to see what his neighbor says or does.',
    textTr: 'Komşusunun ne söylediğine, ne yaptığına bakmayan insan, ne çok zaman kazanır.' },
  { id: 100005, author: 'Marcus Aurelius', category: 'wisdom', tags: ['focus', 'peace'],
    text: 'Confine yourself to the present.',
    textTr: 'Kendini şimdiki ana hapset.' },
  { id: 100006, author: 'Marcus Aurelius', category: 'discipline', tags: ['discipline', 'wisdom'],
    text: 'If it is not right, do not do it. If it is not true, do not say it.',
    textTr: 'Doğru değilse yapma, gerçek değilse söyleme.' },
  { id: 100007, author: 'Marcus Aurelius', category: 'wisdom', tags: ['wisdom', 'peace'],
    text: 'Very little is needed to make a happy life; it is all within yourself, in your way of thinking.',
    textTr: 'Mutlu bir hayat için çok az şey gerekir; hepsi kendi içinde, düşünme biçiminde saklı.' },
  { id: 100008, author: 'Marcus Aurelius', category: 'identity', tags: ['peace', 'wisdom'],
    text: 'Accept the things to which fate binds you, and love the people with whom fate brings you together.',
    textTr: 'Kaderin seni bağladığı şeyleri kabul et, kaderin bir araya getirdiği insanları sev.' },

  { id: 100009, author: 'Seneca', category: 'suffering', tags: ['resilience', 'wisdom'],
    text: 'We suffer more often in imagination than in reality.',
    textTr: 'Çoğu zaman gerçekte değil, hayalimizde acı çekeriz.' },
  { id: 100010, author: 'Seneca', category: 'resilience', tags: ['resilience', 'discipline'],
    text: 'Difficulties strengthen the mind, as labor does the body.',
    textTr: 'Zorluklar zihni güçlendirir, tıpkı emeğin bedeni güçlendirdiği gibi.' },
  { id: 100011, author: 'Seneca', category: 'regret', tags: ['reckoning', 'wisdom'],
    text: 'It is not that we have a short time to live, but that we waste a lot of it.',
    textTr: 'Yaşamak için az zamanımız yok, çoğunu boşa harcıyoruz.' },
  { id: 100012, author: 'Seneca', category: 'discipline', tags: ['discipline', 'motivation'],
    text: 'Luck is what happens when preparation meets opportunity.',
    textTr: 'Şans, hazırlığın fırsatla buluştuğu andır.' },
  { id: 100013, author: 'Seneca', category: 'fire', tags: ['resilience', 'motivation'],
    text: 'He who is brave is free.',
    textTr: 'Cesur olan, özgür olandır.' },
  { id: 100014, author: 'Seneca', category: 'legacy', tags: ['legacy', 'wisdom'],
    text: "Every new beginning comes from some other beginning's end.",
    textTr: 'Her yeni başlangıç, başka bir bitişten doğar.' },
  { id: 100015, author: 'Seneca', category: 'wisdom', tags: ['wisdom', 'discipline'],
    text: 'As long as you live, keep learning how to live.',
    textTr: 'Yaşadığın sürece, nasıl yaşanacağını öğrenmeye devam et.' },
  { id: 100016, author: 'Seneca', category: 'suffering', tags: ['resilience', 'wisdom'],
    text: 'A gem cannot be polished without friction, nor a man perfected without trials.',
    textTr: 'Sürtünme olmadan taş parlamaz, sınanmadan insan olgunlaşmaz.' },

  { id: 100017, author: 'Epictetus', category: 'resilience', tags: ['resilience', 'discipline'],
    text: "It's not what happens to you, but how you react to it that matters.",
    textTr: 'Önemli olan başına ne geldiği değil, ona nasıl tepki verdiğindir.' },
  { id: 100018, author: 'Epictetus', category: 'discipline', tags: ['discipline', 'wisdom'],
    text: 'No man is free who is not master of himself.',
    textTr: 'Kendine hâkim olmayan hiç kimse özgür değildir.' },
  { id: 100019, author: 'Epictetus', category: 'identity', tags: ['discipline', 'motivation'],
    text: 'First say to yourself what you would be; and then do what you have to do.',
    textTr: 'Önce kendine ne olmak istediğini söyle, sonra yapman gerekeni yap.' },
  { id: 100020, author: 'Epictetus', category: 'wisdom', tags: ['wisdom', 'peace'],
    text: 'He who is discontented with what he has will be discontented with what he would like to have.',
    textTr: 'Elindekine razı olmayan, elde etmek istediğine de razı olmaz.' },
  { id: 100021, author: 'Epictetus', category: 'wisdom', tags: ['wisdom', 'peace'],
    text: 'Wealth consists not in having great possessions, but in having few wants.',
    textTr: 'Zenginlik çok şeye sahip olmak değil, az şeye ihtiyaç duymaktır.' },
  { id: 100022, author: 'Epictetus', category: 'identity', tags: ['wisdom', 'peace'],
    text: "Circumstances don't make the man, they only reveal him to himself.",
    textTr: 'Koşullar insanı yapmaz, sadece insanı kendine gösterir.' },
  { id: 100023, author: 'Epictetus', category: 'wisdom', tags: ['wisdom', 'discipline'],
    text: 'Only the educated are free.',
    textTr: 'Yalnızca eğitimli olan özgürdür.' },
  { id: 100024, author: 'Epictetus', category: 'discipline', tags: ['discipline', 'resilience'],
    text: "Don't explain your philosophy. Embody it.",
    textTr: 'Felsefeni açıklama. Onu yaşa.' },
].map((q) => ({
  ...q,
  origin: 'Roma',
  originEmoji: '🏛️',
  era: 'ancient',
  packId: STOICS_PACK.id,
}));

const PACKS = [STOICS_PACK];
const ALL_QUOTES = [...STOICS_QUOTES];

async function upsertPack(client, pack) {
  await client.query(
    `insert into quote_packs (id, name, description, cover_image_url, is_premium, sort_order)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (id) do update set
       name = excluded.name,
       description = excluded.description,
       cover_image_url = excluded.cover_image_url,
       is_premium = excluded.is_premium,
       sort_order = excluded.sort_order`,
    [pack.id, pack.name, pack.description, pack.coverImageUrl, pack.isPremium, pack.sortOrder]
  );
}

async function upsertQuote(client, q) {
  await client.query(
    `insert into quotes
      (id, text, text_tr, author, origin, origin_emoji, category, era, tags, pack_id, is_premium, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, now())
     on conflict (id) do update set
       text = excluded.text,
       text_tr = excluded.text_tr,
       author = excluded.author,
       origin = excluded.origin,
       origin_emoji = excluded.origin_emoji,
       category = excluded.category,
       era = excluded.era,
       tags = excluded.tags,
       pack_id = excluded.pack_id,
       is_premium = true,
       updated_at = now()`,
    [q.id, q.text, q.textTr, q.author, q.origin, q.originEmoji, q.category, q.era, q.tags, q.packId]
  );
}

async function main() {
  const client = new Client({ connectionString: buildConnectionString(), ssl: { rejectUnauthorized: false } });
  console.log('Supabase Postgres\'e bağlanılıyor...');
  await client.connect();
  console.log('✔ Bağlantı kuruldu.\n');

  for (const pack of PACKS) {
    await client.query('begin');
    try {
      await upsertPack(client, pack);
      await client.query('commit');
      console.log(`▶  Paket yazıldı: ${pack.id} (${pack.name.tr})`);
    } catch (err) {
      await client.query('rollback');
      console.error(`✘ Paket başarısız (${pack.id}):`, err.message);
      await client.end();
      process.exit(1);
    }
  }

  let done = 0;
  for (const q of ALL_QUOTES) {
    await client.query('begin');
    try {
      await upsertQuote(client, q);
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      console.error(`✘ Söz başarısız (id=${q.id}):`, err.message);
      await client.end();
      process.exit(1);
    }
    done += 1;
  }
  console.log(`▶  ${done}/${ALL_QUOTES.length} premium söz yazıldı.`);

  const { rows } = await client.query(
    'select pack_id, count(*)::int as count from quotes where pack_id is not null group by pack_id'
  );
  console.log('\n✔ Tamamlandı. Paket başına söz sayısı:', rows);

  await client.end();
}

main().catch((err) => {
  console.error('Seed çalıştırılamadı:', err.message);
  process.exit(1);
});
