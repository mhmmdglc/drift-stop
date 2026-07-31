import * as SQLite from 'expo-sqlite';

import type { Quote } from '@/types/quote';

/**
 * Faz 1 — sözlerin yerel SQLite kopyası. Bu modül şimdilik SADECE ek bir
 * önbellek/senkron katmanı: `src/data/quotes.ts`'teki statik `QUOTES` dizisi
 * (widget headless task'ı, testler, mevcut ekranlar) hâlâ tek gerçek zamanlı
 * okuma kaynağı ve DEĞİŞTİRİLMEDİ. Premium paketler/uzak güncellemeler bu
 * cache'i okumaya başladığında (Faz 4) bu bilinçli bir karardı.
 */

export type RemoteQuote = {
  id: number;
  text: string;
  textTr: string;
  author: string;
  origin: string;
  originEmoji: string;
  category: string;
  era: string;
  tags: string[];
  isPremium: boolean;
  packId: string | null;
  updatedAt: string;
};

let db: SQLite.SQLiteDatabase | null = null;

function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('driftstop.db');
    db.execSync(`
      create table if not exists quotes (
        id integer primary key,
        text text not null,
        text_tr text not null,
        author text not null,
        origin text not null,
        origin_emoji text not null default '',
        category text not null default '',
        era text not null,
        tags text not null default '[]',
        is_premium integer not null default 0,
        pack_id text,
        updated_at text not null
      );
      create table if not exists meta (
        key text primary key,
        value text not null
      );
      -- Entitlement bitince silinen premium sözlerin SADECE id'leri (içerik değil).
      -- Favorilerde/söz detayında "bu söz artık kilitli" durumunu gösterebilmek için
      -- id'nin premium olduğunu bilmemiz gerekiyor; satır silindiği için başka
      -- kaynak yok. Bkz. purgePremiumQuotes() ve data/quotesAnySource.ts.
      create table if not exists purged_premium_quotes (
        id integer primary key
      );
      -- Okuma yollarının üçü de bu üç sütundan filtreliyor ve tablo 3.325 premium
      -- satıra kadar büyüyor; indekssiz her sorgu tam tarama demekti.
      create index if not exists quotes_pack_id_idx on quotes (pack_id);
      create index if not exists quotes_author_premium_idx on quotes (author, is_premium);
      create index if not exists quotes_is_premium_idx on quotes (is_premium);
    `);
  }
  return db;
}

/** Supabase'ten gelen satırları yerel cache'e yazar (id çakışmasında üzerine yazar). */
export function upsertQuotes(rows: RemoteQuote[]): void {
  if (rows.length === 0) return;
  const conn = getDb();
  conn.withTransactionSync(() => {
    const stmt = conn.prepareSync(
      `insert into quotes
        (id, text, text_tr, author, origin, origin_emoji, category, era, tags, is_premium, pack_id, updated_at)
       values ($id, $text, $textTr, $author, $origin, $originEmoji, $category, $era, $tags, $isPremium, $packId, $updatedAt)
       on conflict (id) do update set
        text = excluded.text,
        text_tr = excluded.text_tr,
        author = excluded.author,
        origin = excluded.origin,
        origin_emoji = excluded.origin_emoji,
        category = excluded.category,
        era = excluded.era,
        tags = excluded.tags,
        is_premium = excluded.is_premium,
        pack_id = excluded.pack_id,
        updated_at = excluded.updated_at`
    );
    try {
      for (const r of rows) {
        stmt.executeSync({
          $id: r.id,
          $text: r.text,
          $textTr: r.textTr,
          $author: r.author,
          $origin: r.origin,
          $originEmoji: r.originEmoji,
          $category: r.category,
          $era: r.era,
          $tags: JSON.stringify(r.tags),
          $isPremium: r.isPremium ? 1 : 0,
          $packId: r.packId,
          $updatedAt: r.updatedAt,
        });
      }
    } finally {
      stmt.finalizeSync();
    }
  });
}

type CachedQuoteRow = {
  id: number;
  text: string;
  text_tr: string;
  author: string;
  origin: string;
  origin_emoji: string;
  category: string;
  era: string;
  tags: string;
  is_premium: number;
  pack_id: string | null;
};

function rowToQuote(r: CachedQuoteRow): Quote {
  return {
    id: r.id,
    text: r.text,
    textTr: r.text_tr,
    author: r.author,
    origin: r.origin,
    originEmoji: r.origin_emoji,
    category: r.category as Quote['category'],
    era: r.era as Quote['era'],
    tags: JSON.parse(r.tags) as Quote['tags'],
    isPremium: !!r.is_premium,
    packId: r.pack_id,
  };
}

const CACHED_QUOTE_COLUMNS =
  'id, text, text_tr, author, origin, origin_emoji, category, era, tags, is_premium, pack_id';

// NOT: burada bir `getAllCachedQuotes()` vardı; hiçbir yerden çağrılmıyordu ve
// premium satırları da döndürdüğü için entitlement kontrolü olmayan hazır bir
// sızıntı yolu oluşturuyordu. Silindi. Yeniden gerekirse `quotesAnySource.ts`
// üzerinden ve ZORUNLU `{ entitled }` parametresiyle eklenmeli.

/** Tek bir sözü id ile cache'ten okur (statik dizide olmayan premium paket sözleri için). */
export function getCachedQuoteById(id: number): Quote | null {
  const conn = getDb();
  const row = conn.getFirstSync<CachedQuoteRow>(
    `select ${CACHED_QUOTE_COLUMNS} from quotes where id = ?`,
    [id]
  );
  return row ? rowToQuote(row) : null;
}

/** Bir pakete ait tüm sözleri cache'ten okur (sadece senkronize olmuş premium sözler). */
export function getCachedQuotesByPackId(packId: string): Quote[] {
  const conn = getDb();
  const rows = conn.getAllSync<CachedQuoteRow>(
    `select ${CACHED_QUOTE_COLUMNS} from quotes where pack_id = ? order by id`,
    [packId]
  );
  return rows.map(rowToQuote);
}

/** Belirli bir yazarın TÜM premium sözlerini cache'ten okur. */
export function getCachedQuotesByAuthor(author: string): Quote[] {
  const conn = getDb();
  const rows = conn.getAllSync<CachedQuoteRow>(
    `select ${CACHED_QUOTE_COLUMNS} from quotes where author = ? and is_premium = 1 order by id`,
    [author]
  );
  return rows.map(rowToQuote);
}

/** Cache'te kaç premium söz var (entitlement geri geldiğinde geri yüklendi mi kontrolü). */
export function countCachedPremiumQuotes(): number {
  const conn = getDb();
  const row = conn.getFirstSync<{ count: number }>(
    'select count(*) as count from quotes where is_premium = 1'
  );
  return row?.count ?? 0;
}

/**
 * Premium sözleri yerel cache'ten siler ve id'lerini mezar taşı tablosuna yazar.
 * Abonelik bitince / çıkış yapınca / hesap silinince çağrılır: aksi halde bir kez
 * senkronize edilmiş premium içerik cihazda sonsuza kadar okunabilir kalır
 * (gelir kaçağı). `is_premium = 1` filtresi, sunucudaki RLS politikasının premium
 * tanımıyla birebir aynı — ücretsiz 1000 söze (is_premium = 0) asla dokunmaz.
 * Geri dönüş: silinen satır sayısı.
 */
export function purgePremiumQuotes(): number {
  const conn = getDb();
  const count = countCachedPremiumQuotes();
  if (count === 0) return 0;

  conn.withTransactionSync(() => {
    conn.runSync(
      'insert or ignore into purged_premium_quotes (id) select id from quotes where is_premium = 1'
    );
    conn.runSync('delete from quotes where is_premium = 1');
  });
  return count;
}

/**
 * Sunucuda artık var olmayan premium sözleri yerelden siler.
 *
 * `ids`, `syncPremiumQuotes`'un TAM ve BAŞARILI bir çekiminden gelmek zorunda —
 * yani kullanıcının hak ettiği premium satırların tamamı. Yarım bir liste burada
 * silme demektir, o yüzden çağıran taraf boş/başarısız çekimde bu fonksiyonu
 * çağırmıyor.
 *
 * Neden gerekli: senkron `updated_at > imleç` deltasıyla çalışıyor. Sunucudan bir
 * satır SİLİNDİĞİNDE ortada güncellenecek bir satır kalmıyor, dolayısıyla delta
 * onu hiç haber vermiyor ve söz cihazda sonsuza kadar yaşıyor. Yanlış atıf ya da
 * telif şikâyeti yüzünden bir sözü geri çekmek gerektiğinde bu, geri çekilemeyen
 * içerik demek.
 *
 * Mezar taşı tablosuna YAZMIYOR: burada silinen satır "hakkın bitti, kilitli"
 * değil "artık yok" anlamına geliyor; favorilerde kilit değil kayıp göstermeli.
 * Geri dönüş: silinen satır sayısı.
 */
export function deletePremiumQuotesNotIn(ids: number[]): number {
  if (ids.length === 0) return 0;
  const conn = getDb();
  const placeholders = ids.map(() => '?').join(',');
  const row = conn.getFirstSync<{ count: number }>(
    `select count(*) as count from quotes where is_premium = 1 and id not in (${placeholders})`,
    ids
  );
  const count = row?.count ?? 0;
  if (count === 0) return 0;
  conn.runSync(`delete from quotes where is_premium = 1 and id not in (${placeholders})`, ids);
  return count;
}

/** Bu id daha önce entitlement bitince silinmiş bir premium söz mü? */
export function isPurgedPremiumQuoteId(id: number): boolean {
  const conn = getDb();
  const row = conn.getFirstSync<{ id: number }>(
    'select id from purged_premium_quotes where id = ?',
    [id]
  );
  return row != null;
}

/** Premium içerik geri yüklendiğinde mezar taşlarını temizler. */
export function clearPurgedPremiumQuoteIds(): void {
  const conn = getDb();
  conn.runSync('delete from purged_premium_quotes');
}

/**
 * Son BAŞARILI tam premium geri-doldurmanın getirdiği satır sayısı (yok → null).
 *
 * Neden gerekiyor: cache'in "yeterli" olup olmadığını ölçmek için beklenen sayıyı
 * `packs.quote_count` toplamından okuyoruz (herkese açık metadata). Ama bu metadata
 * ile sunucunun RLS altında gerçekten verdiği satır sayısı ayrışabilir (bir söz
 * yayından kaldırılmışsa metadata daha büyük kalır). O durumda "cached < beklenen"
 * kuralı her açılışta 3.325 satırı yeniden indirmeye yol açardı. Bu filigran,
 * "tam çekim yapıldı ve bu kadarı geldi" bilgisini kalıcılaştırarak akışı
 * yakınsatır. `meta` tablosunda durur; premium temizliği `meta`'ya dokunmaz,
 * ama temizlikten sonra `cached = 0 < filigran` olduğu için geri yükleme yine tetiklenir.
 */
export function getPremiumBackfillCount(): number | null {
  const conn = getDb();
  const row = conn.getFirstSync<{ value: string }>('select value from meta where key = ?', [
    'premium_backfill_count',
  ]);
  if (!row) return null;
  const parsed = Number(row.value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function setPremiumBackfillCount(count: number): void {
  const conn = getDb();
  conn.runSync(
    'insert into meta (key, value) values (?, ?) on conflict (key) do update set value = excluded.value',
    'premium_backfill_count',
    String(count)
  );
}

export function getLastSyncAt(): string | null {
  const conn = getDb();
  const row = conn.getFirstSync<{ value: string }>('select value from meta where key = ?', ['last_sync_at']);
  return row?.value ?? null;
}

export function setLastSyncAt(iso: string): void {
  const conn = getDb();
  conn.runSync(
    'insert into meta (key, value) values (?, ?) on conflict (key) do update set value = excluded.value',
    'last_sync_at',
    iso
  );
}
