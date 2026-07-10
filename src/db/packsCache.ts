import * as SQLite from 'expo-sqlite';

import type { QuotePack } from '@/types/quotePack';

/**
 * Faz 4 — `quote_packs` tablosunun yerel SQLite kopyası. `quotesCache.ts`'teki
 * `quotes` tablosuyla aynı `driftstop.db` dosyasını paylaşır. Paket sayısı az
 * olduğu için delta sync yerine her senkronda tam tablo upsert edilir (bkz.
 * `src/services/packsSync.ts`).
 */

export type RemotePack = {
  id: string;
  name: Record<string, string>;
  description: Record<string, string> | null;
  coverImageUrl: string | null;
  isPremium: boolean;
  sortOrder: number;
};

let db: SQLite.SQLiteDatabase | null = null;

function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('driftstop.db');
    db.execSync(`
      create table if not exists packs (
        id text primary key,
        name text not null,
        description text,
        cover_image_url text,
        is_premium integer not null default 1,
        sort_order integer not null default 0
      );
    `);
  }
  return db;
}

/** Supabase `quote_packs`'ten gelen tüm satırları yerel cache'e yazar (tam upsert). */
export function upsertPacks(rows: RemotePack[]): void {
  const conn = getDb();
  conn.withTransactionSync(() => {
    const stmt = conn.prepareSync(
      `insert into packs (id, name, description, cover_image_url, is_premium, sort_order)
       values ($id, $name, $description, $coverImageUrl, $isPremium, $sortOrder)
       on conflict (id) do update set
        name = excluded.name,
        description = excluded.description,
        cover_image_url = excluded.cover_image_url,
        is_premium = excluded.is_premium,
        sort_order = excluded.sort_order`
    );
    try {
      for (const r of rows) {
        stmt.executeSync({
          $id: r.id,
          $name: JSON.stringify(r.name),
          $description: r.description ? JSON.stringify(r.description) : null,
          $coverImageUrl: r.coverImageUrl,
          $isPremium: r.isPremium ? 1 : 0,
          $sortOrder: r.sortOrder,
        });
      }
    } finally {
      stmt.finalizeSync();
    }
  });
}

export function getAllCachedPacks(): QuotePack[] {
  const conn = getDb();
  const rows = conn.getAllSync<{
    id: string;
    name: string;
    description: string | null;
    cover_image_url: string | null;
    is_premium: number;
    sort_order: number;
  }>('select id, name, description, cover_image_url, is_premium, sort_order from packs order by sort_order, id');

  return rows.map((r) => ({
    id: r.id,
    name: JSON.parse(r.name) as Record<string, string>,
    description: r.description ? (JSON.parse(r.description) as Record<string, string>) : null,
    coverImageUrl: r.cover_image_url,
    isPremium: !!r.is_premium,
    sortOrder: r.sort_order,
  }));
}
