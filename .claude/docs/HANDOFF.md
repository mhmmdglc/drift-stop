# Devir notu — 2026-08-10

Yeni oturum bu dosyayı okuyup kaldığı yerden devam edebilir. Bu, 2026-08-03 tarihli
devir notunun yerini alıyor; oradaki App Store gönderim tarifleri ve API tuzakları
hâlâ geçerli, git geçmişinde `bc2ea91` ve öncesinde duruyor.

Plan [`specs/monetization-v2.md`](../specs/monetization-v2.md) ve
[`specs/social-sign-in.md`](../specs/social-sign-in.md)'de; bu dosya **nerede kalındığı**.

---

## Tek satırlık durum

**Android canlı:** `1.2.0 (versionCode 16)` Play kapalı test → **alpha** kanalında,
16 testçi güncelleyebilir. Emülatörde RELEASE-READY aldı.

**iOS incelemede.** `1.2.0 (build 5)` ve iki abonelik `WAITING_FOR_REVIEW` (2026-08-10).
Build 4 terk edildi — 3.1.2 düzeltmesi build 5'e girdi. İkon düzeltmesi ve hukuki bağlantılar
**binary'nin içinden** doğrulandı, config'e bakarak değil.

Kapılar: `tsc` temiz · **285 test / 32 suite** (oturuma 214 ile başladı) ·
`expo lint` **11 hata = değişmemiş taban** (uyarı sayısı test dosyalarıyla arttı, hata değil).

---

## Bu oturumda ne yapıldı

| Commit | Ne |
|---|---|
| `d14709d` `114d999` | Duvar kağıdı özelliği — söz → 5 zemin → galeriye kaydet |
| `f2c157e` | 16 testçi + AdMob'un hangi hesapta olduğu belgelendi |
| `5aefed2` `c20bcbf` | Google + Apple ile giriş, ve onu gerçekten erişilebilir yapan 3 düzeltme |
| `15827b8` | Android duvar kağıdı 411×891 → **1080×2340** + 5 düzeltme |
| `8761f98` | **iOS ikonu** — Expo placeholder'ı yerine DriftStop alevi |
| `46b0cfb` | İptal artık `/auth` ekranını kapatmıyor |
| `cbc971b` `90fb3f2` | Paywall: haftalık fiyat kahraman, üstü çizili $47.88, %24 tasarruf, kahve cümlesi |

---

## ✅ iOS 1.2.0 İNCELEMEDE — 2026-08-10

`1.2.0 (build 5)` + **iki abonelik birlikte** gönderildi. Gönderim `1cc18361-…`, **4 kalem**,
hepsi `WAITING_FOR_REVIEW`. Apple 48 saate kadar diyor.

Bugün iki tuzak yakalandı, ikisi de gönderimden **önce**:

1. **Sürüm abonelikleri arkada bırakarak gönderilebiliyor.** İlk gönderim `WAITING_FOR_REVIEW`
   oldu ama içinde tek kalem vardı; onaylansaydı iOS **hiçbir şey satamayan bir paywall**'la
   yayına girerdi. ASC API'si abonelik eklemeyi kabul etmiyor — arayüz şart (`OPERATIONS.md` §7).
2. **3.1.2:** paywall'da gizlilik/koşullar bağlantısı yoktu, kullanım koşulları uygulamanın
   **hiçbir yerinde** yoktu. Eklendi (`bb95158`), mağaza açıklamasına da abonelik bloğu girdi.

Ayrıca **"Regulated Medical Device: hayır"** beyanı verildi — birincil kategori Health & Fitness
olduğu için AB dağıtımını açık tutuyor.

**Doğrulama kuralı:** sürümün durumuna bakma, **abonelik tarafını oku**
(`/v1/subscriptions/{id}` + `/versions`). Sürüm `WAITING_FOR_REVIEW` iken abonelikler
`READY_TO_SUBMIT`'te kalabiliyor ve bunu başka hiçbir yer söylemiyor.

---

## Eski not — iOS 1.2.0'ı incelemeye göndermek

**2026-08-10'da yapıldı:** build alındı (`1.2.0`, build **4**), `.ipa`'nın içi açılıp ikon
gözle doğrulandı, `altool` ile yüklendi, Apple tarafında **`VALID`** oldu, ve sürüm kaydı
`1.1.0`/`DEVELOPER_REJECTED` → **`1.2.0`/`PREPARE_FOR_SUBMISSION`** çekilip build 4 bağlandı.

**Kalan tek adım incelemeye göndermek** ve bu bilerek yapılmadı — sahibin kararı. İki şey
gönderimden önce bilinsin diye duruyor:

1. **Apple token iptali hâlâ yok** (bilinerek ertelendi, `OPERATIONS.md` §7).
2. **iOS'ta ne bir satın alma ne de Apple ile giriş hiçbir cihazda çalıştırılmadı.**
   Yapılandırma kâğıt üzerinde doğru; ilk gerçek çalıştırma App Review'da olacak.
   TestFlight'tan geçmek bunu gönderimden önce kanıtlardı.

Gönderme çağrıları (`reviewSubmissions` üçlüsü) `OPERATIONS.md` §7'de yazılı.
Abonelikler sürümle birlikte gidiyor — ayrıca göndermek gerekmiyor.

---

## Sahipten bekleyen kararlar / işler

1. **Gerçek cihazda satın alma testi.** Oturum boyunca değişmeyen tek boşluk. Ne simülatör
   ne emülatör çözüyor; **gelir yolunun hâlâ hiçbir kanıtı yok.**
2. **Android üretim ~2026-08-15'te açılıyor** (14 gün × 16 testçi, sayaç 5 Ağustos'ta 4. gündeydi).
   Süre **kesintisiz** olmalı — sayaç dolmadan Alpha kanalından kimse çıkarılmamalı.
3. **AdMob** iki kapı da kapalı: hesap (`muhammed.gulcu.x@gmail.com` / `pub-6963122807813930`)
   hâlâ doğrulanıyor, ve mağaza bağlantısı ancak uygulamalar **herkese açık listelendiğinde**
   eklenebiliyor. Kapalı testte eklenemiyor — 2026-08-05'te arama ile denendi, sıfır sonuç.

---

## 🔨 Yapılacak işler — sahip onayladı, kodlanmadı

### 1. Pro alınca bildirim sıklığı otomatik 7'ye çıksın
Sahip 10 istedi, riski konuşulunca **7'de karar kılındı** (ürün "sessiz dürtme" vaat ediyor;
günde 10 dürtmek bildirimleri tamamen kapattırabilir). Üç kenar durumu **şart**:

- **Denemede DEĞİL, sadece gerçek satın almada.** Uygulama ilk açılışta 7 günlük deneme veriyor
  ve deneme kullanıcısı da "entitled" görünüyor — hakka bağlanırsa her yeni kullanıcı ilk gün
  7 bildirim alır.
- **Bir kez.** Pro kullanıcısı bilerek 3'e düşürdüyse her açılışta geri çekilmemeli; "bu
  yükseltme yapıldı" işareti tutulmalı.
- **Sessiz olmasın.** Satın alma onayında bir satır: sıklığın değiştiği ve Ayarlar'dan
  geri alınabileceği yazsın.

`FREE_FREQUENCY_MAX = 5` (`src/types/settings.ts`), düşürme yolu `useEnforceFreeLimits`'te zaten var.

### 2. Pro'da bildirim kartı "janjanlı" olsun
Sahibin son isteği, hiç konuşulmadı. Android'de `react-native-android-widget` /
`expo-notifications` kanalı üzerinden zengin bildirim; iOS'ta muhtemelen
`UNNotificationContentExtension`. **Kapsam belirsiz — önce `project-manager` ile spec.**

### 3. Kalan UX maddeleri (sıra bu)
- **Paketleri sekmeye çıkar** — sattığın şeyin sekmesi yok, Ayarlar'da tek satır
- **ATT'yi ilk değer anından sonraya al** — şu an kullanıcı tek söz görmeden izin isteniyor,
  opt-in düşüklüğü doğrudan reklam geliri kaybı
- **Satın alma sonrası mesaj** — Pro alana "reklamlar kapandı" diyor (`paywall.tsx`,
  `PACKAGE_TYPE.LIFETIME` dalı)

⚠️ Hepsi `src/locales/`'in sekiz dosyasına dokunuyor — **paralel agent çalıştırma**, çakışır.

---

## ❌ Kararı bekleyen ürün sorusu

**Premium sözler bildirimlere / widget'a / ana ekrana hiç ulaşmıyor** (tasarım gereği,
`PRODUCT.md` §4). Pro alan kişi günlük hayatta fark hissetmiyor: reklamlar kapanıyor,
7/10 seçeneği açılıyor, katalog göz atılabilir oluyor. Paywall "3.325+ premium söz" diyor,
kullanıcı bunu "bildirimlerim zenginleşecek" diye okuyor. **İade ve kötü yorum riski.**
Ya rotasyona sokulmalı ya vaat dürüstleştirilmeli. Madde 1 (7'ye çıkarma) bunun bir
parçasını çözüyor ama tamamını değil.

---

## Bu oturumda öğrenilen tuzaklar — tekrar düşmeyin

### `captureRef` birimi platforma göre değişiyor
- **iOS** `rendererFormat.scale = 0` → verilen sayı **nokta**, piksel oranıyla çarpılıyor.
- **Android** sayıyı doğrudan `Bitmap.createScaledBitmap`'e veriyor → **piksel**.

Tek formül ikisinde doğru olmuyor: `Platform.OS === 'android' ? 1 : PixelRatio.get()`.
Testi platforma bölmeden yazmak hatayı **görünmez** kılıyordu — 242/242 yeşilken Android 411×891
üretiyordu. Kalan bilinen sorun: Android önizlemeyi ~454 px'te yakalayıp 1080'e büyütüyor,
yani boyut doğru ama görüntü yumuşak. Gerçek çözüm ekran dışı 1080'lik tuval.

### i18n-js `%{...}` biçimini de placeholder sayıyor
Türkçe için `"%{{percent}} tasarruf"` yazmak `%{...}` olarak ayrıştırılıp **sadece Türkçede**
`[missing]` üretiyordu — birincil pazarda, sessizce. Yüzde işareti artık dil dosyalarına
hiç yazılmıyor, `Intl.NumberFormat` nereye koyacağını söylüyor. Testle korunuyor.

### Expo config plugin'ini düz string yazmak sessizce hiçbir şey yapmıyor
`@react-native-google-signin/google-signin` props'suz kaydedilince **Firebase koluna** düşüyor
ve hiç URL şeması eklemiyor. Doğrulaması da yalnızca options kolunda koştuğu için hata vermiyor.
`npx expo config --type introspect` ile kanıtlayın, diff'e bakarak değil.
`src/lib/__tests__/googleSignInConfig.test.ts` bunu koruyor.

### `expo-media-library` Android'e istenmeyen izinler ekliyor
`app.json`'daki `savePhotosPermission`/`photosPermission` **iOS anahtarları**; Android tarafına
`READ_MEDIA_AUDIO/IMAGES/VIDEO` giriyordu. Bir söz uygulamasında ses okuma izni Play politika
incelemesi çeker. `granularPermissions: []` + `android.blockedPermissions` ile daraltıldı,
**birleşmiş manifest'te** doğrulandı ve kaydetmenin bozulmadığı test edildi.

### iOS'ta `ios.icon` üst seviye ikonu eziyordu
`./assets/expo.icon` Expo şablonuydu ve **ilk commit'ten beri** oradaydı. `CFBundleIconName`
`"expo"` çıkıyordu. Kaldırıldı; introspect ile doğrulandı.

### Simülatörde Sign in with Apple **imzasız build'de çalışmaz**
`CODE_SIGNING_ALLOWED=NO` entitlement'ları siliyor → `AKAuthenticationError -7026`.
Apple ID'yi simülatöre girmek **çözmüyor** — bu oturumda girildi, fark etmedi.
Bu Mac'te codesigning kimliği yok (`security find-identity` → 0). Elle yeniden imzalama
üç yöntemle denendi, hepsi uygulamayı açılamaz yapıyor.

**ÖNEMLİ:** Yapılandırma doğru — `com.apple.developer.applesignin` provisioning profile'da
**var**, bundle ID'de `APPLE_ID_AUTH` açık, Supabase sağlayıcısı açık. Yani mağaza build'i
taşıyacak. Ama **hiçbir cihazda kanıtlanmadı**; ilk kanıt App Review'dan gelecek.

### Play'e yükleme — EAS kuyruğunu atlayın
`eas submit` ücretsiz kuyrukta saatlerce bekliyor. Play Developer API'siyle doğrudan yükleme
dakikalar sürüyor: servis hesabı JWT → erişim jetonu → `edits.insert` → `bundles.upload`
→ `tracks.update` (alpha) → `edits.commit`. Anahtar `credentials/driftstop-891f4e9df260.json`.
iOS'ta karşılığı `xcrun altool --upload-app`, anahtar `~/.appstoreconnect/private_keys/` altında.

### Play Console'da doğru hesap `u/2`
Chrome'un birincil hesabı `muhammed.gulcu@gmail.com` ve DriftStop orada **yok**.
`https://play.google.com/console/u/2/...` kullanın.

---

## Kimlikler (bu oturumda eklenenler)

| Ne | Değer |
|---|---|
| Google Web client | `591923071526-4tmk3ook27po20c67nt8rcvrbp2qmhdo.apps.googleusercontent.com` |
| Google iOS client | `591923071526-2le5mn1grsdie51f63afh8vkmm84pa13...` (ters: `com.googleusercontent.apps.591923071526-2le5...`) |
| Google Android client | `591923071526-lo2akmd95n2uct8o56p230a8rsj7199h...` |
| Play imzalama SHA-1 | `19:89:41:6A:9D:7C:3C:0C:1E:7E:5F:FF:5C:23:B1:5E:4A:14:A2:99` |
| Yükleme anahtarı SHA-1 | `93:64:96:08:BB:0F:2F:51:C9:7E:6D:9D:FE:34:43:E1:6F:F7:4D:B3` (**ikinci Android istemcisi hâlâ açılmadı** — kendi yerel build'lerinde Google girişi bu yüzden çalışmaz) |
| App Review demo hesabı | `driftstop.appreview@mailinator.com` / `DriftStop-Review-2026` (Supabase'de, e-postası elle onaylandı) |

Üç Google client id de `.env` ve **EAS bulut ortamının üçünde** kayıtlı.

---

## Boru hattı gerçekten işe yarıyor — kullanın

Bu oturumda tek başıma çalıştığım turlarda üç bloker gözden kaçtı; `.claude/agents/`
altındaki agent'lar hepsini buldu:

- **frontend-dev** iOS URL şemasının hiç yazılmadığını introspect ile kanıtladı ve
  koruma testini **bilerek iki kez bozarak** doğruladı.
- **backend-dev** Supabase'de iki sağlayıcının da **kapalı** olduğunu buldu; açarken
  242 ayarı diffleyip sadece 4'ünün değiştiğini kanıtladı.
- **qa-tester** Android'de 411×891 çıktıyı, iOS'ta Expo ikonunu ve cancel hatasını buldu —
  hiçbirini `tsc` veya testler yakalamamıştı.

`WORKFLOW.md`'deki kural geçerli: **döngü "kod yazıldı" ile değil, `qa-tester` her kriteri
PASS işaretleyince biter.**
