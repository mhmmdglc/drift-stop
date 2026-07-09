import * as SQLite from 'expo-sqlite';

import { QUOTES } from '@/data/quotes';
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
    `);
  }
  return db;
}

/** Fabrika kurulumu/ilk açılış: cache boşsa gömülü quotes.json ile doldurur. Ağ gerekmez. */
export function seedIfEmpty(): void {
  const conn = getDb();
  const row = conn.getFirstSync<{ count: number }>('select count(*) as count from quotes');
  if (row && row.count > 0) return;

  conn.withTransactionSync(() => {
    const stmt = conn.prepareSync(
      `insert or replace into quotes
        (id, text, text_tr, author, origin, origin_emoji, category, era, tags, is_premium, pack_id, updated_at)
       values ($id, $text, $textTr, $author, $origin, $originEmoji, $category, $era, $tags, 0, null, $updatedAt)`
    );
    try {
      for (const q of QUOTES) {
        stmt.executeSync({
          $id: q.id,
          $text: q.text,
          $textTr: q.textTr,
          $author: q.author,
          $origin: q.origin,
          $originEmoji: q.originEmoji,
          $category: q.category,
          $era: q.era,
          $tags: JSON.stringify(q.tags),
          $updatedAt: new Date(0).toISOString(),
        });
      }
    } finally {
      stmt.finalizeSync();
    }
  });
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

export function getAllCachedQuotes(): Quote[] {
  const conn = getDb();
  const rows = conn.getAllSync<{
    id: number;
    text: string;
    text_tr: string;
    author: string;
    origin: string;
    origin_emoji: string;
    category: string;
    era: string;
    tags: string;
  }>('select id, text, text_tr, author, origin, origin_emoji, category, era, tags from quotes order by id');

  return rows.map((r) => ({
    id: r.id,
    text: r.text,
    textTr: r.text_tr,
    author: r.author,
    origin: r.origin,
    originEmoji: r.origin_emoji,
    category: r.category as Quote['category'],
    era: r.era as Quote['era'],
    tags: JSON.parse(r.tags) as Quote['tags'],
  }));
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
