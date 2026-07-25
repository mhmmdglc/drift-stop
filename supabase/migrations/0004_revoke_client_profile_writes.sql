-- DriftStop — güvenlik düzeltmesi: profiles.is_premium istemciden yazılabiliyordu.
--
-- SORUN: 0001'deki `profiles_update_own` politikası satır bazında doğru
-- (auth.uid() = id) ama Postgres'te RLS KOLON bazında kısıtlama yapamaz. `anon`
-- ve `authenticated` rolleri tablo seviyesinde UPDATE yetkisine sahip olduğu
-- için, giriş yapmış herhangi bir kullanıcı kendi satırında
-- `is_premium = true` yapıp `quotes_premium_read_entitled` politikasını
-- açabiliyordu — yani ücretsiz bir hesapla 3.325 premium sözün tamamı
-- indirilebiliyordu. 0001'in başlığındaki "bu alanı sadece webhook yazar"
-- ilkesi kodda değil, sadece yorumda kalmış.
--
-- ÇÖZÜM: istemci rollerinden UPDATE tamamen alınıyor. `profiles`'a yazan tek
-- yer `supabase/functions/revenuecat-webhook` ve o service_role ile çalışıp
-- RLS'i ve grant'leri baypas ediyor (doğrulandı: istemci kodunda tek bir
-- profiles write'ı yok).
--
-- İLERİDE bir ekran gerçekten profiles yazmak isterse (ör. Faz 5 streak veya
-- display_name düzenleme), yetkiyi TABLO seviyesinde değil KOLON seviyesinde
-- ver — asla is_premium/premium_since dahil etme:
--   grant update (display_name) on profiles to authenticated;
-- ve `profiles_update_own` politikasını geri ekle.

revoke update on profiles from anon;
revoke update on profiles from authenticated;

-- Politika artık hiçbir yetkiye dayanmıyor; kafa karıştırmasın diye kaldırılıyor.
-- (Yalnız SELECT kalıyor: profiles_select_own — kullanıcı kendi satırını okuyabilir.)
drop policy if exists "profiles_update_own" on profiles;
