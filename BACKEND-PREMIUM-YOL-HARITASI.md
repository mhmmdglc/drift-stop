# DriftStop Pro — Hesap, Premium ve Uzaktan İçerik Mimarisi

> Görsel/detaylı versiyon: Artifact olarak yayınlandı (kenar notlarıyla, daktilo-dosya tasarımıyla).
> Bu dosya, aynı planın düz-metin/git'te aranabilir referansı.

## Karar özeti
1. **Free bozulmuyor.** 1000 söz, offline okuma, temel bildirim ve widget aynen kalır.
2. **Hesap = kapı, Pro = anahtar.** Kayıt tek başına bir şey açmaz; asıl değeri senkron ve satın almanın cihazlar arası taşınmasıdır.
3. **Sözler sunucudan gelir ama offline-first bozulmaz.** Cihazda tam kopya tutulur; sunucu sadece güncelleme/premium kaynağıdır.

## 1) Mimari
```
Uygulama (Expo) — offline-first, SQLite cache
   ↓
Supabase (Postgres + Auth + RLS) — sözlerin/favorilerin/profilin gerçek kaynağı
   ↓
RevenueCat (Play Billing üzerinde) — satın alma gerçeğinin tek kaynağı
   └─ webhook → Supabase Edge Function → profiles.is_premium günceller
```
**Kritik ilke:** Entitlement (premium olup olmama) asla istemcide karar verilmez. Sadece `profiles.is_premium` alanına bakılır, o alanı da sadece RevenueCat webhook'u yazar.

## 2) Veri modeli (Supabase / Postgres)

**profiles** — id, display_name, is_premium, premium_since, streak_count, streak_last_date, created_at

**quotes** — id, text, text_tr, author, origin, era, tags[], pack_id, is_premium, updated_at
```sql
create policy "public_read_free" on quotes for select
  using (is_premium = false);

create policy "premium_read_entitled" on quotes for select
  using (
    is_premium = true and exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.is_premium = true
    )
  );
```

**quote_packs, favorites, reflections, user_settings** — hepsi RLS ile korunur:
```sql
alter table favorites enable row level security;
create policy "own_rows_only" on favorites for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

**Bilinçli karar:** `seenHistory` (200 kapak) senkron edilmez, sadece cihazda kalır. Senkronun değeri favoriler + ayarlar + streak'te.

## 3) Kimlik doğrulama
- Supabase Auth: e-posta/şifre + Google ile devam et
- Guest-first: login zorunlu değil, sadece "Pro ol"/"Senkron et" tetikler
- Mevcut kullanıcılar korunur: ilk girişte cihaz verisi otomatik sunucuya taşınır (migration-on-login)
- Satın alma hesaba bağlanır: RevenueCat `app_user_id` = Supabase user id → yeni cihazda otomatik restore

## 4) İçerik taşıma
- quotes.json → Postgres (tek seferlik migration script)
- İstemci: seed set gömülü + `updated_at` bazlı delta sync + **expo-sqlite** (AsyncStorage değil)
- Premium paket satın alınca ilgili `pack_id` indirilir + kilit açılır

## 5) Ödeme
- **RevenueCat + Google Play Billing** (Play politikası: dijital içerik satışında zorunlu, harici ödeme kullanılamaz)
- `remove_ads` — tek seferlik (~$3-5)
- `pro_yearly` / `pro_monthly` — abonelik: reklamsız + premium paketler + ritüel + senkron
- Webhook → Supabase Edge Function → `profiles.is_premium`

## 6) Uygulama sırası (bağımlılığa göre dizilmiş)

| # | Faz | Not |
|---|---|---|
| 0 | ✅ Supabase iskeleti | Tablolar + RLS + Auth. Kullanıcı görmez. |
| 1 | ✅ Sözler → API + lokal cache | Görünmez geçiş, delta sync |
| 2 | ✅ Giriş/Kayıt (guest-first) | E-posta/şifre tamam. Google ile devam et → OAuth client gerekiyor, ertelendi. |
| 3 | ✅ RevenueCat + "Reklamı Kaldır" | SDK + paywall + entitlement gating tamam. Test Store ile doğrulandı; gerçek Play Console bağlantısı bekliyor. |
| 4 | Premium içerik paketleri | Server-driven, entitlement-gated |
| 5 | Cihazlar arası senkron | Favoriler + ayarlar + streak |
| 6 | Ritüel katmanı | Streak, not/yansıma, haftalık özet |
| 7 | Kişiselleştirme | Temalar, ikonlar, widget stilleri |
| 8 | Paylaşım gücü | Watermark'sız kartlar, story formatı |
| 9 | **Play Console beyan güncellemesi** | Zorunlu — e-posta/kişisel veri toplanacak |
| 10 | Analitik | Supabase Studio yeter, ayrı panel gerekmez |

## 7) Başlamak için gereken bilgiler

| Ne | Nereden | Hassasiyet |
|---|---|---|
| Proje URL + `anon` key | Supabase → Project Settings → API | Herkese açık, güvenle paylaşılır |
| `service_role` key | Aynı sayfa | Sadece migration script'inde, `.env`'de, asla commit edilmez |
| RevenueCat hesabı | Yoksa birlikte açarız | — |
| Google OAuth client | Google Cloud Console | Faz 2'de gerekecek |

---
Faz 0'a başlamak için: Supabase project URL + anon key + (migration için) service_role key yeter.

## Faz 1 notları (tamamlandı)
- `supabase/migrations/0002_quotes_extra_fields.sql` — `quotes` tablosuna `origin_emoji`, `category` eklendi (istemcideki `Quote` tipiyle birebir eşleşsin diye).
- `scripts/seed-quotes.js` (`npm run db:seed-quotes`) — `src/data/quotes.json`'daki 1000 sözü Supabase'e upsert eder, tekrar çalıştırılabilir. `is_premium`/`pack_id`'ye dokunmaz.
- İstemci: `src/lib/supabase.ts` (client, `EXPO_PUBLIC_SUPABASE_ANON_KEY` boşsa `null` — senkron sessizce devre dışı kalır), `src/db/quotesCache.ts` (expo-sqlite, senkron API — `driftstop.db`), `src/services/quotesSync.ts` (`updated_at` bazlı delta sync). `src/app/_layout.tsx` boot akışında arka planda, hataları yutarak çağrılır.
- **Bilinçli karar:** `src/data/quotes.ts`'teki statik `QUOTES` dizisi (widget headless task, testler, mevcut ekranlar) DEĞİŞMEDİ — hâlâ tek okuma kaynağı. SQLite cache şimdilik sadece arkada dolup senkronize oluyor; ekranların oradan okumaya geçişi Faz 4'te premium paketlerle birlikte yapılacak (o zaman gerçek bir ihtiyaç doğuyor).
- **Eksik:** `EXPO_PUBLIC_SUPABASE_ANON_KEY` henüz `.env`'de yok (bkz. `.env.example`) — Supabase → Project Settings → API'den alınıp eklenmeden istemci senkronu devreye girmez (uygulama bundan etkilenmez, sadece senkron no-op kalır).

## Faz 2 notları (tamamlandı — e-posta/şifre; Google ertelendi)
- `src/hooks/useAuth.tsx` — `AuthProvider`/`useAuth()`: Supabase Auth session state (`getSession` + `onAuthStateChange`), `signUpWithEmail`/`signInWithEmail`/`signOut`. `configured=false` (anon key yoksa) her yerde guest gibi davranır.
- `src/app/auth.tsx` — e-posta/şifre ile giriş/kayıt ekranı, "Karalama" tasarım sistemine uygun, `Skip` ile her zaman atlanabilir (guest-first bozulmuyor).
- `src/app/(tabs)/settings.tsx` — yeni "Hesap" bölümü: guest → "Giriş yap/Hesap oluştur" linki; giriş yapılmışsa → e-posta + "Çıkış yap" (onay dialoglu).
- 6 aktif dile (tr/en/es/de/fr/it) `auth.*` ve `settings.account.*` çevirileri eklendi.
- **Android emulator'de uçtan uca doğrulandı:** kayıt ol → Supabase e-posta onayı (gerçek mailinator adresiyle) → giriş yap → `profiles` satırı otomatik oluştu (Faz 0 trigger'ı çalışıyor) → çıkış yap. Test kullanıcısı temizlendi.
- **Google ile devam et ertelendi** — Google Cloud OAuth client gerekiyor, kullanıcıda henüz yok (bkz. §7 tablosu). Kod, `signInWithEmail`/`signUpWithEmail` yanına eklenecek şekilde tasarlandı; Google butonu eklenmedi (yok fonksiyon çağrısı yanıltıcı olurdu).
- Supabase projesinde e-posta onayı **zorunlu** (varsayılan) — `mapAuthError` bunu `auth.errors.emailNotConfirmed` ile karşılıyor. Prod'da gerçek kullanıcılar gerçek e-posta alacağı için sorun değil.

## Faz 3 notları (tamamlandı — sandbox/Test Store ile)
- **RevenueCat projesi kuruldu:** proje adı "DriftStop" (proj9019ea60), Android app `com.driftstop.app` (app2be5c8cadb). Hesapta otomatik gelen örnek "EvolaRoa" App Store app'i (iOS, kullanılmıyor — iOS Faz 8'e ertelendi) dokunulmadan bırakıldı.
- **Entitlement'lar:** `pro` (mevcut, hesapla birlikte gelen varsayılan) + yeni eklenen `no_ads`. `pro_monthly`/`pro_yearly` ürünleri her ikisine birden bağlı (Pro abone olan otomatik reklamsız da olur); `remove_ads` sadece `no_ads`'a bağlı.
- **Ürünler (Test Store'da, fiyatlar kullanıcı onaylı):** `remove_ads` ($2.99, non-consumable), `pro_monthly` ($2.99/ay), `pro_yearly` ($19.99/yıl). Offering: `default` (3 paket: Lifetime/Annual/Monthly).
- **Gerçek Play Store app'i de var** (`DriftStop (Play Store)`, public key `goog_kfnkyAeLFJPffpZuAGGaYfiRWEN`) ama servis hesabı kimlik bilgileri geçersiz/örnek veri — Play Console bağlantısı henüz kurulmadı. İstemci şu an **Test Store key'i** (`test_...`, `.env`'de `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`) kullanıyor — satın alımlar simüle, gerçek para geçmiyor.
- **İstemci:** `src/lib/purchases.ts` (configure), `src/hooks/usePurchases.tsx` (PurchasesProvider/usePurchases — customerInfo, isPro, isAdsRemoved, purchasePackage, restorePurchases), `src/app/paywall.tsx` (paket listesi + satın al + restore), Settings'e "Premium" bölümü eklendi. `src/utils/ads.ts`'e `setAdsSuppressed` — `no_ads` aktifse hem banner (reaktif hook) hem interstitial (modül seviyesi flag) devre dışı kalıyor.
- **Android emulator'de uçtan uca doğrulandı:** paywall açıldı → "Remove ads" satın alındı (RevenueCat'in native Test Store dialogu üzerinden "TEST VALID PURCHASE") → entitlement anında aktif oldu → reklam banner'ı restart gerekmeden kayboldu → Settings "Ads removed" gösterdi → RevenueCat dashboard'da customer'da "Total Spent: USD 2.99" + "No Ads" entitlement'ı aktif olarak doğrulandı.
- **Prod'a çıkmadan önce gereken:** Play Console'da gerçek in-app ürünler (`remove_ads`, `pro_monthly`, `pro_yearly`) oluşturulmalı, gerçek bir Play Console servis hesabı RevenueCat'e bağlanmalı, sonra `.env`'deki key `goog_...` ile değiştirilmeli. Bu adım kullanıcının Play Console'da ürün/fiyat kararı vermesini gerektiriyor.
