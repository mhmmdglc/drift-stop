-- DriftStop — derinlemesine savunma: içerik tabloları istemciden yazılamaz olsun.
--
-- DURUM: `quotes` ve `quote_packs` üzerinde `anon`/`authenticated` rollerinin
-- INSERT + UPDATE yetkisi vardı. Sömürülebilir DEĞİLDİ, çünkü bu tablolarda RLS
-- açık ve tanımlı bir yazma politikası yok — RLS eşleşen satır bırakmadığı için
-- PATCH "204 / sıfır satır" dönüyordu. Canlıda doğrulandı: anon key ile
-- `PATCH /quotes?id=eq.1` sonrası söz metni değişmemişti ve veritabanında
-- 'tampered' metni hiç oluşmamıştı.
--
-- NEDEN YİNE DE KAPATIYORUZ: tek savunma "yazma politikası yok" olması. İleride
-- biri tamamen başka bir sebeple bu tablolara bir UPDATE politikası eklerse
-- (ör. kullanıcı katkısı, moderasyon, beğeni sayacı), grant zaten orada
-- beklediğinden açık kendiliğinden oluşur. 0004'teki hata tam olarak buydu:
-- grant ile politika birleşince kimse fark etmeden yetki açılmıştı.
--
-- ETKİ YOK: bu tablolara yazan tek şey `scripts/seed-quotes.js` ve
-- `scripts/seed-packs.js`; ikisi de session pooler üzerinden doğrudan Postgres'e
-- `postgres` kullanıcısıyla bağlanıyor (SUPABASE_PASSWORD), PostgREST/anon key
-- yolunu hiç kullanmıyorlar. Okuma yetkileri (SELECT) bilinçli olarak
-- dokunulmadı: ücretsiz sözler, paket adları ve `quote_count` herkese açık
-- olmalı ki kilitli paketler gerçek sayılarını gösterebilsin (bkz. 0003).

revoke insert, update, delete on quotes from anon;
revoke insert, update, delete on quotes from authenticated;

revoke insert, update, delete on quote_packs from anon;
revoke insert, update, delete on quote_packs from authenticated;

-- profiles'ta INSERT de gereksiz duruyordu: satırı `handle_new_user` trigger'ı
-- (security definer) oluşturuyor, istemci asla insert etmiyor.
revoke insert on profiles from anon;
revoke insert on profiles from authenticated;
