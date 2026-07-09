-- DriftStop — Faz 1: quotes tablosuna istemcinin ihtiyaç duyduğu alanları ekle.
-- src/types/quote.ts içindeki Quote tipiyle birebir eşleşmesi için
-- (origin_emoji rozet ikonunda, category CategoryBadge'de kullanılıyor).

alter table quotes add column if not exists origin_emoji text not null default '';
alter table quotes add column if not exists category text not null default '';
