# Devir notu — 2026-08-14

Yeni oturum bu dosyayı okuyup kaldığı yerden devam edebilir. Bu, 2026-08-03 tarihli
devir notunun yerini alıyor; oradaki App Store gönderim tarifleri ve API tuzakları
hâlâ geçerli, git geçmişinde `bc2ea91` ve öncesinde duruyor.

Plan [`specs/monetization-v2.md`](../specs/monetization-v2.md) ve
[`specs/social-sign-in.md`](../specs/social-sign-in.md)'de; bu dosya **nerede kalındığı**.

---

## Tek satırlık durum — 2026-08-14

**Android canlı:** `1.2.0 (versionCode 19)` Play kapalı test → **alpha** kanalında,
Play API'sinden okunarak doğrulandı. Production kanalı **boş**, sayaç ~15 Ağustos.

**iOS incelemede (üçüncü tur).** `1.2.0 (build 6)` + iki abonelik `WAITING_FOR_REVIEW`,
gönderim `1cc18361-…`, **4 kalem**.

Kapılar: `tsc` temiz · **296 test / 34 suite** · `expo lint` **11 hata = değişmemiş taban**.

**HEAD ile mağazadakiler artık aynı.** Build 6 ve versionCode 19, bugünkü bütün
düzeltmeleri taşıyor — geride kalan bir şey yok.

---

## Apple iki kez reddetti, ikisi de kapatıldı

**1. Guideline 3.1.2(c) — build 5 (2026-08-13).** *"Haftalık hesaplanmış fiyat, tahsil
edilen tutardan daha belirgin."* Sebep bizim kendi tasarım kararımızdı (`90fb3f2`).
Hiyerarşi ters çevrildi, yenileme/iptal beyanı eklendi, açık bir ücretsiz çıkış kondu.
**Bu tur bir daha yazılmadı — yani geçti.**

**2. Guideline 2.1 Information Needed — build 6 (2026-08-14).** Kod hatası değil, bilgi
talebi. 8 maddenin tamamı hem cevaba hem App Review Notes'a yazıldı, 8:42'lik ekran kaydı
eklendi. Cevap `Messages (3)` altında duruyor.

⚠️ **Apple'a açıkça söylenen iki şey** — bir sonraki oturum bunları bilsin, çünkü Apple
bunlara geri dönebilir:
- Kayıt **fiziksel cihazda değil, simülatörde** alındı. Gerçek cihaz şart koşulursa tek
  çıkış bir iPhone bulup TestFlight'tan kurmak.
- Hesap silme **onay ekranında durduruldu**, çünkü giriş yapılan hesap denetçinin
  kullanacağı demo hesap. Silinseydi bir sonraki tur "erişemedik" diye reddedilirdi.

---

## ⛔ SIRADAKİ İŞ — Apple'ın cevabını beklemek

**Onaylanırsa:** iOS canlıya çıkar. Android production sayacı da ~15 Ağustos'ta dolduğu
için ikisi birlikte yayına alınabilir.

**Yine 2.1 gelirse:** büyük ihtimalle fiziksel cihaz kaydı isteyeceklerdir. Bu noktada
herhangi bir iPhone + TestFlight tek çözüm; build 6 zaten ASC'de, kurulum dakikalar sürer.

**Başka bir gerekçe gelirse:** `OPERATIONS.md` §7'deki denetim tablosuyla karşılaştır ve
yeni çıkan maddeyi tabloya ekle. Sürüm kaydı `REJECTED`'a düşer ve **yeniden kullanılır** —
yeni kayıt açma. Reddi temizleyen düğme sürüm sayfasındaki **"Update Review"**; yeni build
bağlamak tek başına yetmiyor (bkz. `OPERATIONS.md` §7).

**Her durumda:** `app.json`'daki `autoIncrement` yazımını commit et.

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
| `c5ac4c7` | iOS 1.2.0 build 4 + `app.json`'ın mağazanın gerisine düşmesi düzeltildi |
| `4348849` `22f6aca` | ASC API'sinin abonelik gönderemediği, ve iOS gönderim öncesi denetim listesi |
| `bb95158` | **3.1.2** — paywall'a gizlilik + kullanım koşulları, mağaza açıklamasına abonelik bloğu |
| `870b2ff` | iOS 1.2.0 (build 5) + iki abonelik incelemeye gönderildi |
| `36d78a2` | Android 1.2.0 (versionCode 17) Alpha'ya + `scripts/play-upload.js` |
| `a157444` `99d782d` `030c3c8` | **Misafir-Pro kusuru** — bulundu, düzeltildi, ekranda doğrulandı |
| `1db6031` | **3.1.2(c) reddi** — tahsil edilen tutar kahraman, yenileme şartları, ücretsiz çıkış |
| `246ec1f` `ed8c8e1` | 1.2.0 (6) yeniden gönderildi; reddi temizleyen "Update Review" tarifi |
| `063060f` | **Android'e "Apple Account" deniyordu** — platforma göre ayrıldı, 2 testle sabitlendi |
| `8b82121` | Android 1.2.0 (versionCode 19) Alpha'ya |

---

## Sahipten bekleyen kararlar / işler

1. **Tamamlanmış bir satın alma — hâlâ tek gerçek boşluk, ama artık çok daha dar.**
   2026-08-10'da zincirin **iki ucu ayrı ayrı** kanıtlandı:
   - **Ön uç:** simülatörde paywall iki ürünü de **gerçek App Store fiyatlarıyla** çekti
     (`$3.99` / `$35.99`, ASC'yle birebir) ve "Satın Al" **StoreKit'in ödeme ekranını açtı**.
   - **Arka uç:** RevenueCat panelinden promotional `pro` verildiğinde uygulama **doğru
     davrandı** — Go Pro kartı gitti, 7 ve 10 seçilebilir oldu, paketler açıldı.

   Test edilmemiş tek halka **Apple'ın satın almayı onaylaması**. Bunun için sandbox testçi
   hesabı gerekiyor; `muhammed.gulcu+dsbox1@gmail.com` oluşturuldu ama simülatörde giriş
   Apple'ın **iki faktörlü doğrulamasına** takıldı ve tamamlanamadı. Doğru yer
   **Ayarlar → Developer → Sandbox Apple Account** (satın alma sırasında çıkan sistem
   penceresi DEĞİL — oradan girmek hesabı tam Apple hesabı sanıp 2FA kurmaya çalışıyor).
   İlk gerçek satın alma büyük ihtimalle App Review'da olacak.

2. **Android üretim ~2026-08-15'te açılıyor** (14 gün × 16 testçi). Süre **kesintisiz**
   olmalı — sayaç dolmadan Alpha kanalından kimse çıkarılmamalı.
3. **AdMob** iki kapı da kapalı: hesap (`muhammed.gulcu.x@gmail.com` / `pub-6963122807813930`)
   hâlâ doğrulanıyor, ve mağaza bağlantısı ancak uygulamalar **herkese açık listelendiğinde**
   eklenebiliyor. Kapalı testte eklenemiyor — 2026-08-05'te arama ile denendi, sıfır sonuç.
4. **Apple ile giriş hiçbir cihazda çalıştırılmadı.** Simülatör bunu çözemiyor: imzasız build
   `com.apple.developer.applesignin` entitlement'ını taşımıyor (`AKAuthenticationError -7026`),
   bu Mac'te imzalama kimliği yok. İlk kanıt App Review'dan gelecek.

---

## 🔨 Yapılacak işler — sahip onayladı, kodlanmadı

### ~~0. 1.2.1'i kes~~ — **gerek kalmadı, düzeltmeler 1.2.0'a yetişti**
Misafir-Pro düzeltmesi (`99d782d`) iOS build 6'ya ve Android versionCode 19'a girdi.
Ayrı bir sürüm kesmeye gerek yok.

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
- ~~Satın alma sonrası mesaj~~ — **kapandı** (`99d782d`): misafire ayrı onay veriliyor,
  LIFETIME dalı zaten `cbc971b`'de düzeltilmişti

⚠️ Hepsi `src/locales/`'e dokunuyor — **paralel agent çalıştırma**, çakışır. Not: parity testi
**altı aktif dili** kapsıyor (`tr en es de fr it`); `ja` ve `ar` kısmi dosyalar, `packs`/`paywall`
bölümleri hiç yok ve teste girmiyorlar.

---

## ❌ Kararı bekleyen ürün sorusu

**Premium sözler bildirimlere / widget'a / ana ekrana hiç ulaşmıyor** (tasarım gereği,
`PRODUCT.md` §4). Pro alan kişi günlük hayatta fark hissetmiyor: reklamlar kapanıyor,
7/10 seçeneği açılıyor, katalog göz atılabilir oluyor. Paywall "3.325+ premium söz" diyor,
kullanıcı bunu "bildirimlerim zenginleşecek" diye okuyor. **İade ve kötü yorum riski.**
Ya rotasyona sokulmalı ya vaat dürüstleştirilmeli. Madde 1 (7'ye çıkarma) bunun bir
parçasını çözüyor ama tamamını değil.

---

## 2026-08-13/14'te öğrenilenler

### Bir testin yeşil olması, doğru şeyi koruduğu anlamına gelmiyor
`paywallPriceEmphasis.test.tsx` birebir *"haftalık rakam iki satırda da en büyük olmalı"*
diye sınıyordu — yani **App Store'un reddettiği düzeni** koruyordu ve yeşil olduğu için
kimse şüphelenmedi. Test bozuk değildi; yanlış kuralı doğru şekilde sabitliyordu.
Bir mağaza kuralını koda gömerken, testin o kuralı **mağazanın yazdığı gibi** ifade
ettiğinden emin ol.

### Reddi temizleyen şey yeni build değil, "Update Review"
`PATCH .../relationships/build` sürümü `PREPARE_FOR_SUBMISSION`'a çekiyor ama gönderim
kalemi **`Rejected` kalıyor** ve Resubmit soluk duruyor. `PATCH reviewSubmissions
{submitted:true}` da `409` veriyor. Sürüm sayfasındaki **"Update Review"** düğmesi dört
kalemi birden `Ready for Review`'a çeviriyor; asıl anahtar o.

### Platforma özel metin, platforma özel test ister
3.1.2 için eklenen yenileme metni *"Settings → Apple Account → Subscriptions"* diyordu ve
Android'e olduğu gibi gidiyordu — var olmayan bir iptal yolu. Mağazaya bağlı her cümle
`Platform.OS` ile ayrılmalı **ve** her iki dal ayrı ayrı sınanmalı; tek dallı test bunu
yakalamaz.

### Simülatör dokunuşlarında ekran görüntüsü ölçeği tuzak
Ekran görüntüsünün en-boy oranı nokta uzayıyla birebir değil (`920/440 ≠ 1936/956`).
Yüksekliği kendi oranıyla çevirirsen **alt kısımdaki dokunuşlar sessizce ıskalar** —
düğme çalışmıyor sanırsın. Her iki eksende de **genişlik oranını** kullan
(`440/920 = 0.4783`).

### ASC arayüzünde "An error has occurred" çoğu zaman bayat oturum
Cevap gönderimi hata verip taslakta kaldı; **sayfa tazelenince** `Continue Draft` → `Reply`
ilk denemede çalıştı. İçerikte sorun yoktu. Aynı hatayı görürsen önce yenile.

### İptal edilen build numarayı geri vermiyor
Android build'i uçuşta iptal edildi ama `versionCode 18`'i tüketmişti; sonraki build 19
oldu. Sayaç `app.json`'da yaşıyor — iptal ettiğin numarayı bir daha kullanamazsın.

---

## 2026-08-10'da öğrenilenler

### Bir sürüm, aboneliklerini arkada bırakarak incelemeye girebiliyor
Sürüm `WAITING_FOR_REVIEW` oldu, gönderimde **tek kalem** vardı, abonelikler `READY_TO_SUBMIT`'te
kaldı — ve bunu **sürüm tarafında hiçbir alan söylemiyor**. Onaylansaydı iOS hiçbir şey satamayan
bir paywall'la yayına girerdi. **Kural: sürümün durumuna bakma, abonelik tarafını oku**
(`/v1/subscriptions/{id}` + `/versions`). ASC API'si abonelik eklemeyi dört ayrı uçtan reddediyor;
arayüz şart ve grup tek başına yetmiyor — tarif `OPERATIONS.md` §7'de.

### RevenueCat'i Apple hesabı olmadan test edebilirsin
Sandbox'a takılırsan zincirin arka ucunu ayrıca sınayabilirsin: uygulamanın müşteri kimliği
simülatör konteynerinde duruyor —
`Library/Preferences/com.revenuecat.user_defaults.plist` içinde `$RCAnonymousID:…`
(`strings` ile çek, `plutil` bu dosyayı JSON'a çeviremiyor). Panelden o müşteriye promotional
entitlement ver, uygulamayı yeniden başlat. Hiçbir kimlik bilgisi gerekmiyor ve
"hak gelince uygulama doğru davranıyor mu" sorusunu tek başına cevaplıyor.

### Simülatörde uygulamayı çalıştırmanın üç engeli var
1. **CocoaPods** UTF-8 olmayan locale'de patlıyor → `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`.
2. **Port 8081** başka bir projenin Metro'su tarafından tutuluyor → `--port 8082`.
3. **`expo run:ios` simülatörü fiziksel cihaz sanıp imza istiyor** (UDID versen de, isim
   versen de). Çözüm: Expo CLI'yı atla, doğrudan
   `xcodebuild -workspace ios/DriftStop.xcworkspace -scheme DriftStop -configuration Release
   -sdk iphonesimulator -destination "id=<udid>" CODE_SIGNING_ALLOWED=NO` + `simctl install`.
   Release seçmek Metro ihtiyacını da kaldırıyor ve gerçek paketlenmiş JS'i çalıştırıyor.

### Hermes bundle'da `grep` boş dönerse panik yapma
`main.jsbundle` **Hermes bytecode**, düz `grep` hiçbir şey bulmaz ve bu "düzeltme binary'de yok"
gibi okunur. `grep -a` kullan. Bugün hukuki URL'lerin build 5'te olduğu böyle kanıtlandı.

### `app.json` mağazanın gerisine düşüyor
`cli.appVersionSource` ayarlı değil → EAS `autoIncrement` sayıyı **`app.json` içinde** artırıp
çalışma ağacına yazıyor. Commit edilmezse dosya sessizce geride kalıyor: repo `versionCode 15`
derken Play'de 16 vardı, sıradaki build 16'yı tekrar üretip **duplicate** yiyecekti.
**Her production build'den sonra `git diff app.json` ve commit.**

---

## Daha önceki oturumda öğrenilen tuzaklar — tekrar düşmeyin

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
