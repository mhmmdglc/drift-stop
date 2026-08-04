# Devir notu — 2026-08-03 (RevenueCat bölümü 2026-08-04'te güncellendi)

Yeni oturum bu dosyayı okuyup kaldığı yerden devam edebilir.
Plan [`specs/monetization-v2.md`](../specs/monetization-v2.md)'de; bu dosya **nerede kalındığı**.

Bir önceki devir notu 2026-07-31'deydi ve artık bayat — bu onu değiştiriyor.

---

## Tek satırlık durum

**Android canlı:** `1.1.0 (versionCode 14)` Play kapalı test → **alpha** kanalında.
**iOS App Store Connect'te:** `1.1.0 (buildNumber 3)` yüklendi ve **`processingState: VALID`**
(build id `c8e21a7e-26e0-4995-9ce9-3c6a3c3cc656`, 2026-08-04). İmza kimlikleri kuruldu,
RevenueCat tarafı bitti, export compliance takılmıyor. **iOS'ta kalan teknik iş yok** —
sırada cihazda doğrulama ve inceleme formları var.

Kapılar: `tsc` temiz · **214/214 test** (oturuma 132 ile başladı) · edge function'lar Deno ile temiz ·
`expo lint` 11 hata = değişmemiş taban.

---

## iOS imza kimlikleri — kuruldu (2026-08-04), yöntemi burada kalsın

**Bu bölüm sertifika yenilerken tekrar lazım olacak.** İlk denemede `credentialsSource: "remote"`
ile build reddedildi: *"Distribution Certificate is not validated for non-interactive builds"*.
EAS kimlikleri kendi üretebiliyor ama bunun için **Apple hesabına interaktif giriş** (şifre + 2FA)
istiyor; `EXPO_ASC_API_KEY_PATH` / `EXPO_ASC_KEY_ID` / `EXPO_ASC_ISSUER_ID` vermek **yetmiyor**.

Hesaptaki mevcut sertifika (`WYUFC5YYM5`, Mart 2026, PomoPet döneminden) işe yaramıyordu:
**özel anahtarı bu Mac'te yok** — `security find-identity -v -p codesigning` → *0 valid identities*.
Sertifika özel anahtarsız imzalayamaz. `credentials/` içindeki `SubscriptionKey_C8L6M9WRV4.p8`
de imzalama değil, **IAP/abonelik** anahtarı — karıştırmayın.

**Çözüm — şifresiz, tamamen ASC API ile.** Özel anahtar yerelde doğar, Apple'a asla gitmez:

1. `openssl genrsa` + `openssl req` ile anahtar ve CSR üret.
2. `POST /v1/certificates` (`certificateType: IOS_DISTRIBUTION`, `csrContent`) → sertifika.
3. `openssl pkcs12 -export -legacy` ile `.p12`.
4. `POST /v1/profiles` (`IOS_APP_STORE`, bundleId `TCG8J4F9P8`, yeni sertifika) → profil.
5. `credentials.json`'a `ios` bloğu, `eas.json` → `production.ios.credentialsSource: "local"`.

ASC API'ye ES256 JWT üreten yardımcı script'ler oturumun geçici dizinindeydi ve **kaybolacak**;
tarif yukarıda, yeniden yazmak birkaç dakika. JWT: `{alg:ES256, kid:<KEY_ID>}` +
`{iss:<ISSUER_ID>, aud:"appstoreconnect-v1", exp:iat+1200}`, imza `dsaEncoding:'ieee-p1363'`.

⚠️ **İlk build bunda patladı:** *"Provisioning profile doesn't include the Push Notifications
capability / aps-environment entitlement"*. `com.driftstop.app`'te push yetkisi kapalıymış —
`expo-notifications` `aps-environment` istiyor. `POST /v1/bundleIdCapabilities`
(`PUSH_NOTIFICATIONS`) ile açıldı, **sonra profil silinip yeniden üretildi** (yetki değişince
eski profil geçersiz kalıyor, Apple yenilemeyi şart koşuyor). İkinci build geçti.

## ⚠️ EAS Submit ücretsiz kuyrukta saatlerce bekliyor — `altool` ile bypass edin

`eas submit --platform ios` işi **EAS'in Free Tier Queue'suna** giriyor ve orada
**bir saatten fazla** `Queued` durumunda bekledi; bu sırada CLI hiçbir şey basmıyor ve
App Store Connect'te iz olmuyor. **Takılmış gibi görünüyor ama takılmamış.** İlk deneme bu
yüzden yanlışlıkla öldürüldü ve kuyruk sırası kaybedildi.

Kuyruğu tamamen atlayıp Apple'a doğrudan yüklemek **36 saniye** sürdü:

```
curl -sSL -o app.ipa "<EAS build artifact URL>"
cp ~/.driftstop-secrets/AuthKey_2B4CL4C8CB.p8 ~/.appstoreconnect/private_keys/
xcrun altool --upload-app -f app.ipa -t ios \
  --apiKey 2B4CL4C8CB --apiIssuer bc64b7a2-f7c3-45f5-b073-2c4083fa3b0c
```

`altool` anahtarı **`~/.appstoreconnect/private_keys/`** altında arıyor, başka yerden okumuyor.
Yükleme bittikten sonra Apple'ın işlemesi ~3 dakika; `GET /v1/builds?filter[app]=6797533621`
ile `processingState` izlenebilir.

## Paywall iOS'ta doğrulandı (2026-08-04) — ama satın alma HÂLÂ denenmedi

Sahibin iPhone'u yok (Samsung), o yüzden TestFlight yolu kapalı; doğrulama **simülatörde**
yapıldı. Release build (`xcodebuild -sdk iphonesimulator`, `CODE_SIGNING_ALLOWED=NO`) kuruldu
ve paywall açıldı:

- **Pro — Yearly `$35.99`** ve **Pro — Monthly `$3.99`** ikisi de listelendi.
- Fiyatlar **StoreKit'ten** geliyor: `paywall.tsx:147` → `pkg.product.priceString`.
  Kaynakta `3.99`/`35.99` için **sıfır** eşleşme var, yani sabit yazılmış değil.
- Ayarlar'da **Pro kartı iOS'ta artık görünüyor** — `purchasesConfigured` true, TODO'daki
  1 numaralı "iOS'ta hiç para kazanma yok" maddesi kapandı.

Bu **RevenueCat ↔ App Store bağının çalıştığını** kanıtlıyor. **Kanıtlamadığı şey: gerçek bir
satın alma.** Simülatörde işlem yapılamıyor. Gelir yolunun tam kanıtı hâlâ yok; ödünç bir
iPhone + TestFlight ya da App Review'ın kendi testi bunu gösterecek.

### Abonelik inceleme görseli — yüklendi

`MISSING_METADATA`'nın tek sebebi bu görselin olmamasıydı (fiyatlar 175 bölgede, `en-US`
metinleri yerinde). Yukarıdaki paywall ekranı `simctl io ... screenshot` ile alınıp ASC API
ile iki aboneliğe de yüklendi (rezervasyon → `PUT` → `PATCH uploaded:true` + md5 checksum).
**İkisi de artık `READY_TO_SUBMIT`.**

## App Store gönderim formları — 2026-08-04'te dolduruldu

| Form | Durum | Nasıl |
|---|---|---|
| Kategori | Health & Fitness / Lifestyle | ASC API, `PATCH /v1/appInfos/{id}` |
| Yaş derecelendirmesi | **4+** (Brezilya `SELF_RATED_L`) | `PATCH /v1/ageRatingDeclarations/{id}` |
| App Privacy | 9 veri türü, **yayımlandı** | tarayıcı — **API'de yok** |
| Gizlilik politikası URL'si | iki yerelde de girili | `PATCH /v1/appInfoLocalizations/{id}` |
| Abonelik inceleme görseli | ikisi de `READY_TO_SUBMIT` | `POST /v1/subscriptionAppStoreReviewScreenshots` |
| Mağaza ekran görüntüleri | 3 görsel × 2 yerel | `POST /v1/appScreenshotSets` + `/v1/appScreenshots` |
| Sürüm → build | `1.1.0` ← build `3` | `PATCH /v1/appStoreVersions/{id}` |
| DSA tüccar beyanı | **In Review** (sahibi 29 Tem'de girmiş) | ASC → Business |

### Bu turda öğrenilen API tuzakları

- **Yaş derecelendirmesi 2025'te değişti:** 22 zorunlu alan var, bir kısmı artık **boolean**
  (`advertising`, `healthOrWellnessTopics`, `userGeneratedContent`, `messagingAndChat`,
  `parentalControls`, `ageAssurance`), kalanı `NONE`/`INFREQUENT_OR_MILD`/... enum'u.
  Boş `attributes:{}` ile PATCH atıp hata listesinden zorunlu alanları öğrenebilirsin.
- **`APP_IPHONE_69` diye bir ekran görüntüsü tipi YOK.** 6.9" (1320×2868) görseller
  **`APP_IPHONE_67`** yuvasına yükleniyor.
- **App Privacy anketi API'de yok** — `appDataUsages`/`appPrivacyDetails` yolları 404,
  uygulamanın ilişkileri arasında da geçmiyor. Tarayıcıdan doldurmak zorunlu.
- ASC sürüm kaydı `1.0` iken build `1.1.0`'dı; **sürüm numarası eşleşmeden build seçilemiyor.**
- Gizlilik URL'si `en-US`'de vardı, **`en-GB`'de yoktu** ve arayüz U.K. yerelini gösterdiği için
  "boş" görünüyordu. Yerel başına ayrı alan.

### Sıradaki iş

1. **App Review iletişim bilgileri** — `appStoreReviewDetail` **boş** (`data: null`).
   Ad, soyad, **telefon**, e-posta gerekiyor; telefon numarası sahibinden alınmalı,
   uydurulamaz. Demo hesap gerekmiyor (uygulama misafir modunda tam çalışıyor).
2. **Add for Review → Submit.**

### RevenueCat — bitti (2026-08-04)

App Store tarafındaki üç adım da yapıldı ve **temiz sayfa yüklemesinde doğrulandı**:

1. `pro_monthly` (`prod3ca927c62c`) → `pro` + `no_ads`. (`pro` bir önceki oturumda zaten
   bağlanmıştı; devir notundaki "hiç bağlanmadı" kaydı yanlıştı.)
2. `pro_yearly` (`prodf4074b7112`) oluşturuldu, tip Subscription → `pro` + `no_ads`.
3. `default` offering (`ofrng6ee7af37ec`) → `$rc_annual` → `pro_yearly`,
   `$rc_monthly` → `pro_monthly`, **DriftStop (App Store)** satırında. Kaydedildi.

⚠️ **Arayüzün iki tuzağı, bir dahakine:** entitlement açılır listesi native `<select>` DEĞİL (DIV),
`form_input` "Element type DIV is not a supported form input" der — tıklamak gerekiyor. Ve Attach
sonrası **"Entitlement attached successfully" toast'ı çıkarken tablo eski hâlini gösteriyor**;
başarısızlık sanılabilir, oysa yalnızca bayat. Sayfayı yeniden yükleyip doğrula.

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
| RevenueCat App Store ürünleri | `pro_monthly` `prod3ca927c62c` · `pro_yearly` `prodf4074b7112` |
| iOS imza (2026-08-04 üretildi) | sertifika `S583744M99` (bitiş 2027-08-04) · profil `568J8YR282` "DriftStop App Store" |
| iOS imza dosyaları | `credentials/driftstop-dist.p12` + `credentials/driftstop-appstore.mobileprovision` — **gitignore'lu, yedeklenmezse kayıp** |
| Kullanılmayan eski sertifika | `WYUFC5YYM5` — özel anahtarı yok, hiçbir işe yaramıyor |
| ASC | app `6797533621` · grup `22283837` · `pro_monthly` `6797551481` · `pro_yearly` `6797551678` |
| Bundle ID kaydı | `TCG8J4F9P8` (`com.driftstop.app`) |
| AdMob yayıncı | `pub-6963122807813930` |
| AdMob Android | app `~1493084605` · banner `/2682757204` · interstitial `/8223124425` |
| AdMob iOS | app `~4613840458` · banner `/8083026183` · interstitial `/6023270839` |
| ASC API anahtarı | `~/.driftstop-secrets/AuthKey_2B4CL4C8CB.p8` · Issuer `bc64b7a2-f7c3-45f5-b073-2c4083fa3b0c` |

---

## Sahipten bekleyenler

0. **`credentials/` dizinini yedekle.** iOS `.p12` + `.mobileprovision` ve Android keystore orada,
   hepsi gitignore'lu. Bu Mac giderse **imzalı sürüm üretilemez**; Android keystore'un kaybı
   uygulamayı Play'de güncelleyememek demek.
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
