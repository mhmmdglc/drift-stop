# Hesap silme (`delete-account`)

Play Store, uygulama içi hesap oluşturma destekleniyorsa uygulama içi hesap
silmeyi de zorunlu tutuyor. Bu fonksiyon kod olarak hazır ama **henüz deploy
edilmedi** — deploy, `revenuecat-webhook` ile aynı `supabase login`/`link`
oturumunu kullanır, tek seferde ikisini birden yapabilirsiniz.

## Ne yapıyor?

Çağıranın kendi JWT'siyle kimliğini doğrular, sonra `auth.admin.deleteUser`
ile o kullanıcının `auth.users` satırını siler. `profiles`, `favorites`,
`reflections`, `user_settings` hepsi `on delete cascade` ile tanımlı (bkz.
`supabase/migrations/0001_init_schema.sql`) — auth kullanıcısı silinince hepsi
otomatik silinir, fonksiyonun ayrıca tablo tablo silme yapmasına gerek yok.

Sadece giriş yapmış (guest olmayan) kullanıcılar çağırabilir — istemci
tarafında `src/hooks/useAuth.tsx`'teki `deleteAccount()` kendi oturum
JWT'sini `Authorization` header'ında gönderir, fonksiyon bunu doğrular ve
sadece o kullanıcıyı siler (başka bir user id verilemez).

## Deploy adımları

```bash
npx supabase login
npx supabase link --project-ref ftohdffebzhrthrpeuos
npx supabase functions deploy delete-account
```

`--no-verify-jwt` **kullanmayın** — bu fonksiyon Supabase'in kendi JWT
doğrulamasına güveniyor (Authorization header'ı olmayan/anonim istekler
otomatik reddedilsin diye).

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` her Edge
Function'a Supabase tarafından otomatik enjekte edilir — ayrıca secret
ayarlamanıza gerek yok.

Deploy edilene kadar Ayarlar ekranındaki "Hesabı sil" butonu tıklanınca genel
bir hata mesajı gösterir (fonksiyon 404 döner) — arayüz çökmez.
