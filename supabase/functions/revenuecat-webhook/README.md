# RevenueCat webhook → `profiles.is_premium`

Bu fonksiyon kod olarak hazır ama **henüz deploy edilmedi**. Deploy, Supabase
CLI hesap girişi ve gizli bir secret üretimi gerektirdiği için bu adım
kullanıcı tarafından yapılmalı (kimlik bilgisi/hesap işlemleri Claude
tarafından yapılmıyor).

## Neden gerekli?

`quotes` tablosundaki premium sözler RLS ile korunuyor
(`quotes_premium_read_entitled` — bkz. `supabase/migrations/0001_init_schema.sql`),
ve bu politika `profiles.is_premium = true` şartına bakıyor. Bu alanı SADECE
bu webhook yazar — RevenueCat'te satın alma/iptal/süre dolumu olduğunda tetiklenir.

İstemci tarafındaki `isPro` (RevenueCat SDK, `src/hooks/usePurchases.tsx`)
zaten güvenilir ve anında çalışıyor — kilit/kilit-açık arayüzü buna bakar,
webhook'a bağımlı değil. Webhook sadece premium söz İÇERİĞİNİN Supabase'ten
gerçekten senkronize olabilmesi için gerekli.

## Deploy adımları

```bash
npx supabase login
npx supabase link --project-ref ftohdffebzhrthrpeuos
npx supabase functions deploy revenuecat-webhook --no-verify-jwt
```

Sonra bir gizli değer üretip secret olarak ayarlayın (ör. `openssl rand -hex 32`):

```bash
npx supabase secrets set REVENUECAT_WEBHOOK_AUTH_TOKEN=<üretilen-değer>
```

`SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` Supabase tarafından her Edge
Function'a otomatik enjekte edilir — ayrıca ayarlamanıza gerek yok.

## RevenueCat tarafında bağlama

RevenueCat dashboard → **Project settings → Integrations → Webhooks** →
"Add webhook":

- **URL:** `https://ftohdffebzhrthrpeuos.supabase.co/functions/v1/revenuecat-webhook`
- **Authorization header value:** yukarıda ürettiğiniz `REVENUECAT_WEBHOOK_AUTH_TOKEN` ile birebir aynı değer

Kaydettikten sonra "Send test event" ile deneyin — fonksiyon `TEST` event
tipini veritabanına dokunmadan `200 { ok: true, test: true }` döner.

## Davranış özeti

| RevenueCat event | `profiles.is_premium` |
|---|---|
| INITIAL_PURCHASE / RENEWAL / UNCANCELLATION / NON_RENEWING_PURCHASE / PRODUCT_CHANGE / TRANSFER (entitlement `pro` içeriyorsa) | `true` |
| EXPIRATION (entitlement `pro` içeriyorsa) | `false` |
| CANCELLATION / BILLING_ISSUE | değişmez (kullanıcı dönem sonuna kadar erişimi korur) |
| TEST | veritabanına dokunmaz |
| `app_user_id` gerçek bir Supabase UUID değilse (anonim/guest) | atlanır |

`app_user_id`'nin Supabase UUID'siyle eşleşmesi `Purchases.logIn(user.id)`
çağrısına bağlıdır — bu bağlama `src/hooks/usePurchases.tsx`'te (Faz 4'te
eklendi) kullanıcı giriş/çıkış yaptığında otomatik yapılır.
