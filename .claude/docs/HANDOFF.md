# Devir notu — 2026-08-03

Yeni oturum bu dosyayı okuyup kaldığı yerden devam edebilir.
Plan [`specs/monetization-v2.md`](../specs/monetization-v2.md)'de; bu dosya **nerede kalındığı**.

Bir önceki devir notu 2026-07-31'deydi ve artık bayat — bu onu değiştiriyor.

---

## Tek satırlık durum

**Android canlı:** `1.1.0 (versionCode 14)` Play kapalı test → **alpha** kanalında.
**iOS neredeyse hazır:** ürünler, fiyatlar, mağaza metinleri, reklam birimleri kurulu; RevenueCat'te
**üç tıklama** kaldı, sonra build alınabilir.

Kapılar: `tsc` temiz · **214/214 test** (oturuma 132 ile başladı) · edge function'lar Deno ile temiz ·
`expo lint` 11 hata = değişmemiş taban.

---

## SIRADAKİ İŞ — RevenueCat, üç adım (sahibi "sen yap" dedi)

[Products](https://app.revenuecat.com/projects/9019ea60/product-catalog/products) → **DriftStop (App Store)**:

1. `pro_monthly` (`prod3ca927c62c`) → *Associated Entitlements* → Attach `pro`, tekrar Attach `no_ads`
2. `+ New` → Identifier `pro_yearly`, tip **Subscription** → aynı iki entitlement
3. [Offerings](https://app.revenuecat.com/projects/9019ea60/product-catalog/offerings) → `default`
   (`ofrng6ee7af37ec`) → **Edit** → `$rc_monthly` ve `$rc_annual` paketlerinde **DriftStop (App Store)**
   satırına ürünleri seç → **Save**

⚠️ **Otomasyon burada takıldı:** entitlement açılır listesi native `<select>` DEĞİL (DIV),
`form_input` reddediyor; tıklama kabul ediliyor ama değer kaydolmuyor — denendi, `pro_monthly`
hâlâ "No associated entitlements". Bir dahaki denemede seçeneği tıkladıktan sonra **seçimin
gerçekten yansıdığını ekran görüntüsüyle doğrula**, sonra Attach'a bas.

Bu üçü bitince: iOS build → paywall dolar → abonelik grubu için **inceleme ekran görüntüsü**
üretilebilir (Apple satın alma arayüzünün göründüğü bir kare istiyor; paywall boşken üretmek
Apple'a yanlış bilgi vermek olur) → TestFlight.

---

## Bu oturumda bitenler

### Play — yayınlandı
- `1.1.0 (versionCode 14)` alpha'ya **yüklendi** (`eas submit`, Play API'den doğrulandı: alpha `completed:14`).
  Mağazadaki önceki sürüm 11'di.
- `eas submit` artık `eas.json`'da ayarlı — 86 MB'lık elle sürükle-bırak yükleme tarihe karıştı.
- **İlk build hata verdi ve sebebi gerçek bir engeldi:** iOS ATT metni Expo'nun kök `locales`
  ayarı üzerinden Android `strings.xml`'ine de yazılıyordu; varsayılan dilde karşılığı olmayınca
  lint `ExtraTranslation` diyor ve `lintVitalRelease` release build'lerde ölümcül. **ATT
  değişikliğinden bu yana hiçbir Android release build'i alınamıyordu.** SDK 56 dokümanı: platforma
  özel metinler locale dosyasının İÇİNDE `ios`/`android` anahtarı altında olmalı. Düzeltildi,
  iki native proje yeniden üretilip doğrulandı (Android dil dosyaları boş, iOS'un altı `.lproj`
  dosyası metni taşıyor).

### Faz B — kartsız 7 günlük deneme (tamam)
`services/trial.ts` (saf, zaman enjekte edilebilir) · `useTrial` provider · **`useEntitlement`
tek yetki kaynağı** · `usePremiumCacheGuard` denemeyi tanıyor · `useAdSuppression` ·
`useTrialLifecycle` (frekans → yeniden planlama → ekran sırası) · `/trial-ended` ekranı ·
6./7. gün uyarıları **ayrı kanalda** ve günlük kotayı yemiyor · 8 dilde metin.

Emülatörde uçtan uca doğrulandı: deneme aktifken 10 bildirim seçilebiliyor + reklam yok;
bitince frekans 10→3 düşüyor, kilitler ve reklamlar dönüyor, bitiş ekranı **bir kez** açılıyor.
**Giriş yapmış deneme kullanıcısı 3.325 premium sözü indirdi** (`trials` satırı tam 7 gün) —
migration 0007'nin ilk cihaz kanıtı. Hesap silme `auth.users` + `profiles` + `trials`'ı
cascade ile siliyor, yerel premium cache 3.325 → 0, ücretsiz 1.000 duruyor.

### Bulunan ve düzeltilen hatalar
- **`remove_ads` canlıda $299.99 / ₺16.859,99 idi** (173 bölge, ACTIVE). `pro_monthly`'deki ondalık
  kaymasının aynısı, bu ürüne hiç bakılmamış. Sahibin kararı "reklamsızlık ayrı ürün değil, Pro
  ile geliyor" → Play'de INACTIVE, RevenueCat offering'inden `$rc_lifetime` çıkarıldı, ASC'den silindi.
  `no_ads` entitlement'ı ve `isAdsRemoved` mantığı **bilerek duruyor** (Pro da `no_ads` veriyor).
- **Paket tarayıcısı iOS'ta erişilemezdi** — `/packs`'e giden tek link `purchasesConfigured`'a bağlıydı.
- **Geçiş reklamı neredeyse hiç çıkmıyordu** — 4 dk aralık açılıştan işliyordu, 12 kaydırma eşiğiyle
  birleşince tipik oturumda sıfır. Açılış payı ve reklam aralığı ayrıldı.
- **Auth ekranı:** klavye gönder butonunu örtüyordu (`KeyboardAvoidingView` Android'de no-op),
  klavyeden gönderilemiyordu, onay maili gelmezse çıkmaz vardı → ScrollView + `onSubmitEditing` +
  `resendConfirmation`.
- **Şifre sıfırlama yoktu** — eklendi. Pro hakkı hesaba bağlı olduğu için gelir kaybıydı.
- Paywall her satın almada "reklamlar kapandı" diyordu · "Sync (soon)" kaldırıldı ·
  paket ekranı 122 satırı düz ScrollView'da basıyordu → FlatList · emekli paketler silinmiyordu.

### Test ve altyapı
- **`scheduler.ts` için 27 test** — çekirdeğin sıfır testi vardı, regresyonu sessizdi.
- Edge function'lar artık kontrolsüz değil: `npm run typecheck:functions` (Deno), ikisi de temiz.
- `revenuecat-webhook` **yeniden deploy edildi**, canlıda doğrulandı (`GET`→405, yetkisiz `POST`→401).
- AdMob test cihazı desteği (`EXPO_PUBLIC_ADMOB_TEST_DEVICE_IDS`, `initialize()`'dan ÖNCE uygulanıyor).

### iOS kurulumu
Bundle ID kaydı · ASC uygulama kaydı (sahibi oluşturdu) · abonelik grubu + iki abonelik +
yerelleştirmeler · **fiyatlar $3.99 / $35.99, 175 ülke** · availability tüm ülkeler ·
mağaza metinleri (açıklama/anahtar kelimeler/promo/alt başlık/URL'ler) API'den ·
AdMob iOS uygulaması + iki birim · `adsEnabled` iOS'a açıldı · `appl_` anahtarı env'e yazıldı ·
App Privacy cevapları [`APP-PRIVACY.md`](APP-PRIVACY.md)'de.

**iOS Release build simülatörde çalıştı** ve ATT istemi ekranda göründü (değişiklikten önce
`initAds` iOS'ta erken dönüyordu, istem hiç çıkmıyordu).

---

## Kimlik ve id tablosu

| Ne | Değer |
|---|---|
| RevenueCat proje | `9019ea60` · App Store app `app7ff0fee28c` · offering `ofrng6ee7af37ec` |
| RevenueCat iOS SDK anahtarı | `appl_UchWQUYfuwoHfUigBzkTRCntwVE` (`.env` + EAS production/preview) |
| IAP anahtarı | `BVNHR2U7ST` — EvolaRoa için yüklenmişti, takım seviyesinde geçerli, RevenueCat'te seçildi |
| ASC | app `6797533621` · grup `22283837` · `pro_monthly` `6797551481` · `pro_yearly` `6797551678` |
| Bundle ID kaydı | `TCG8J4F9P8` (`com.driftstop.app`) |
| AdMob yayıncı | `pub-6963122807813930` |
| AdMob Android | app `~1493084605` · banner `/2682757204` · interstitial `/8223124425` |
| AdMob iOS | app `~4613840458` · banner `/8083026183` · interstitial `/6023270839` |
| ASC API anahtarı | `~/.driftstop-secrets/AuthKey_2B4CL4C8CB.p8` · Issuer `bc64b7a2-f7c3-45f5-b073-2c4083fa3b0c` |

---

## Sahipten bekleyenler

1. **Gerçek cihazda satın alma testi** — alpha build'i telefona kur, paywall'da iki aboneliği gerçek
   fiyatlarla gör, bir satın alma tamamla. **Gelir yolunun hâlâ hiçbir kanıtı yok**, emülatörde
   Play Billing olmadığı için sadece gerçek cihaz gösterebilir.
2. **12 testçi** — başladı, tamamlanmalı. 14 günlük sayaç onlarla işliyor; üretime çıkışın takvim engeli.
3. **DSA tüccar beyanı** — ASC → Business → Digital Services Act. Active mi? API bu alanı vermiyor.
4. **App Privacy / yaş derecelendirmesi / kategori / export compliance** — cevaplar hazır, tıklamak sahibin.
5. **App Review'a gönder** düğmesi.

---

## Bu makinede tekrar edecek tuzaklar

- **AdMob: her zaman `?authuser=1`.** Chrome'un birincil hesabı AdMob'un **kapattığı** eski hesap;
  düz açılınca "Hesabınız kapatıldı" gelir ve yeni hesabın öldüğü sanılır. Ayrıntı `OPERATIONS.md`'de.
- **Play tek seferlik ürünler:** `inappproducts` 403, `onetimeproducts` 404, **`oneTimeProducts`
  (camelCase) 200.** $299.99'un aylarca fark edilmemesinin sebebi buydu. `STORE-AUTOMATION.md`'de.
- **ASC fiyat API'si kullanılamıyor:** `POST /v1/subscriptionPrices` dört istek şeklinde de
  `409 ENTITY_ERROR.RELATIONSHIP.INVALID`. Fiyatlar arayüzden girildi. Availability API'den sorunsuz.
- **ASC arayüzünde `$35.99` fiyat listesinde YOK**, arama da "No Results" der —
  **"See Additional Prices"** linkine basınca çıkıyor.
- **Metro transform cache'i worklets sürümünü saklıyor.** Siyah ekran + "Mismatch between JavaScript
  and native part of Worklets" görürsen `npx expo start --clear`. Ayrıca
  `node_modules/react-native-worklets/android/build` ve `.cxx` eski `.so`'yu tutabiliyor;
  Gradle build-cache'i de geri servis ediyor.
- **Dev client `10.0.2.2:8081`'e sabit.** Sahibin diğer projeleri (milkteeth, stillflame) o portu
  alabiliyor; o zaman DriftStop başka projenin bundle'ını çeker. Mağaza görselleri için zaten
  **Release build** doğrusu — Metro'ya hiç ihtiyaç yok.
- **`lsof -ti:8081 | xargs kill -9` YAPMA** — emülatör süreci de o portta listelenir, onu da öldürür.

---

## Temizlik notları

- `DriftStop (Play Store)` altında `evolaroa_pro_yearly/monthly/weekly` ürünleri **"Not found"**
  olarak duruyor — ilk yanlış yapılandırmadan kalma çöp, silinebilir.
- Mağaza ekran görüntüleri (6.9", 1320×2868: ana ekran, ayarlar, onboarding) oturumun geçici
  dizininde üretildi ve **kaybolmuş olacak**. Release build `DerivedData`'da duruyorsa yeniden
  üretmek dakikalar sürer.
- Play'de uygulama herkese açık olduğunda **AdMob → Mağaza ekle** ile bağlanmalı; "sınırlı reklam
  sunumu" limiti ancak o zaman kalkıyor. İlk günlerde reklam görünmemesi normal.
- Kalan cihaz QA'sı: favoriler, altı dil ekranda, saat aralığı doğrulaması, widget, bildirimden
  derin bağlantı, çevrimdışı. Hiçbiri sürülmedi.
