-- DriftStop — güvenlik düzeltmesi: _migrations tablosu istemciye açıktı.
--
-- SORUN: `_migrations` (scripts/db-migrate.js'in hangi migration'ın uygulandığını
-- tuttuğu iç kayıt tablosu) RLS KAPALI olarak duruyordu ve `anon`/`authenticated`
-- rolleri INSERT + UPDATE yetkisine sahipti. Yani uygulamanın anon key'ini bilen
-- biri (ki o key istemci paketinin içinde, tanımı gereği herkese açık) bu tabloya
-- satır ekleyip mevcut satırları değiştirebiliyordu — ör. henüz uygulanmamış bir
-- migration'ı "uygulanmış" işaretleyerek sonraki deploy'ları sessizce bozabilirdi.
--
-- 0004 ile aynı sınıf hata: tablo seviyesi grant + eksik/yanlış RLS. Fark şu ki
-- burada RLS hiç açık değildi, 0004'te ise RLS açıktı ama kolon bazında
-- kısıtlayamadığı için yetersizdi.
--
-- ÇÖZÜM: tablo tamamen sunucu tarafına kapatılıyor. Bu tabloya sadece
-- scripts/db-migrate.js erişiyor ve o doğrudan Postgres'e `postgres` kullanıcısıyla
-- (session pooler üzerinden) bağlanıyor — PostgREST/anon key yolunu hiç kullanmıyor,
-- dolayısıyla bu revoke migration runner'ı etkilemez.

revoke all on _migrations from anon;
revoke all on _migrations from authenticated;

-- Kemer + askı: grant'ler ileride yanlışlıkla geri verilse bile RLS reddetsin.
-- (Politika tanımlanmadığı için RLS açıkken tüm istemci erişimi kapalı olur;
-- service_role ve postgres RLS'i baypas ettiği için etkilenmez.)
alter table _migrations enable row level security;
