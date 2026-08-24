# Devir notu — 2026-08-24

Yeni oturum bu dosyayı okuyup kaldığı yerden devam edebilir. Bu, 2026-08-03 tarihli
devir notunun yerini alıyor; oradaki App Store gönderim tarifleri ve API tuzakları
hâlâ geçerli, git geçmişinde `bc2ea91` ve öncesinde duruyor.

Plan [`specs/monetization-v2.md`](../specs/monetization-v2.md) ve
[`specs/social-sign-in.md`](../specs/social-sign-in.md)'de; bu dosya **nerede kalındığı**.

---

## Durum — 2026-08-24

### 🎉 Android CANLI

`1.2.0 (versionCode 22)` **Play production'da**, tüm ülkeler, %100 yayın.
https://play.google.com/store/apps/details?id=com.driftstop.app

**22, reklam kimliklerini gerçekten taşıyan İLK build.** 19 çalışan hesabın
kimliklerini taşımıyordu; 20 ve 21 hiç yayınlanmadı (20'yi EAS kota reddi, 21'i
paketin içinde reklam id'si olmadığını kanıtlayan lokal build tüketti). 22 lokalde
`eas build --local` ile alındı — Android Studio'nun JDK 21'i, EAS bulut kotasına
hiç dokunmadan; `scripts/play-upload.js … production` ile çıkıldı.

Yayın için üç kapı arka arkaya açıldı, üçü de ilk denemede tıkanmıştı:
1. **Üretim erişimi** — Google'ın başvuru incelemesi (Çarşamba başvurulmuş, o gün onaylanmış)
2. **"first release cannot be staged"** — bir kanaldaki İLK sürüm kademeli olamıyor, %100 zorunlu
3. **"targeting no countries"** — production kanalında hiç ülke seçili değildi; konsoldan
   *Üretim → Ülkeler/bölgeler* ile tüm ülkeler eklendi. `countryTargeting` sürümün alanı ama
   yalnız kademeli sürümlerde çalışıyor, yani ilk sürümde API'den verilemiyor

⚠️ **Yayınlama tamamen otomatik** — hesapta "yönetilen yayınlama" KAPALI. `tracks.update` +
`commit` yaptığın an yayına gidiyor, ayrıca "incelemeye gönder" adımı yok.

### ✅ iOS build 8'in iki reddi de düzeltildi → **1.2.0 (10)**

**SIWA artık yazmıyor** (build 8'deki iki düzeltme tuttu, denetçi o adımı geçti). Bu turda yalnız
sürüm kalemi reddedilmişti; üç abonelik kalemi `Ready for Review`'da kaldı.

**1. Guideline 2.5.4 — bildirilen ama kullanılmayan arka plan sesi.** `app.json` `UIBackgroundModes`
yazmıyordu; anahtarı binary'ye **`expo-audio` config plugin'i** koyuyordu: düz string
(`"expo-audio"`) olarak kaydedilince kendi `enableBackgroundPlayback: true` varsayılanını uyguluyor.
Paket `src/` içinde **hiç kullanılmıyordu** ve hiçbir bağımlılık ona ihtiyaç duymuyordu, o yüzden
`enableBackgroundPlayback: false` demek yerine **tamamen kaldırıldı**. Aynı eklenti bedavaya iOS'a
`NSMicrophoneUsageDescription`, Android'e `RECORD_AUDIO` + `MODIFY_AUDIO_SETTINGS` de ekliyordu;
üçü de gitti.

**2. Guideline 4 — satın alma sonrası paywall'dan çıkış yok.** `buy()` başarıda artık bir `purchased`
bayrağı kaldırıyor. Hak sahibi olan kullanıcıya, mesajın hemen altında **paket kartlarıyla aynı
görsel dilde belirgin bir "Continue to the app" düğmesi** çıkıyor; üstteki bağlantı *"Maybe later"*
yerine **"Close"** oluyor; *"Continue with the free version"* ekrandan çekiliyor (ödemiş birine
söylenecek söz değil). **Otomatik kapatma bilerek yapılmadı:** misafirin "giriş yap ki premium
koleksiyonlar insin" onayı tam o ekranda gösteriliyor, anında `back()` onu okunmadan yok ederdi.

**Binary'den doğrulandı — build 8 ile build 9/10'un `Info.plist` farkı sadece şu üç şey:**

| Anahtar | build 8 | build 9 |
|---|---|---|
| `UIBackgroundModes` | `["audio"]` ← reddin sebebi | **yok** |
| `NSMicrophoneUsageDescription` | `"Allow DriftStop to access your microphone"` | **yok** |
| `GADApplicationIdentifier` | `…6963122807813930~4613840458` | `…3817081931651779~3993212711` |
| `CFBundleVersion` | `8` | `9`, sonra `10` |

Başka hiçbir anahtar değişmedi, hiçbir anahtar eklenmedi. (İki `.ipa` da indirilip
`plutil -convert json` ile karşılaştırıldı — `app.json`'a bakılarak değil.)

⚠️ `CFBundleIconName` **iki build'de de yok**. Bu bir gerileme değil, build 8 bu hâliyle yüklenip
incelemeye girdi; ama bir gün ITMS-90713 gelirse sebebi burada yazıyor.

**✅ Ekranda görüldü (iPhone 17 Pro simülatörü, Release build).** RevenueCat panelinden QA
müşterisine (`$RCAnonymousID:a63aa173…`) **bir günlük promosyon `pro` hakkı** verildi, uygulama
yeniden başlatıldı, paywall'a `driftstop://paywall` ile girildi:

- üst köşe *"Belki sonra"* değil **"Kapat"**
- *"Zaten Pro'sun. Desteğin için teşekkürler!"*
- çerçeveli, ekranın en belirgin eylemi olan **"Uygulamaya dön"** düğmesi
- *"Ücretsiz sürümle devam et"* **ekranda yok**
- düğmeye basıldı → paywall kapandı, Ayarlar'a dönüldü

Hak sahibi olmayan hâli de aynı oturumda görüldü: paketler, yenileme beyanı, *"Belki sonra"* ve
*"Ücretsiz sürümle devam et"* yerli yerinde, **"Uygulamaya dön" yok**. (Promosyon hakkı 24 saatte
kendiliğinden düşüyor; istenirse panelden erken geri alınabilir.)

⚠️ **Gerçek bir satın alma yine denenmedi** — simülatörde StoreKit yok. Sınanan şey "hak sahibi
olan kullanıcı bu ekrandan çıkabiliyor mu"; `buy()` başarısının aynı durumu ürettiğini testler
sabitliyor.

**Koruma testleri** — ikisi de düzeltme geri alınarak kırdırıldı:
`src/__tests__/backgroundAudioConfig.test.ts` (düz-string eklenti kaydını da yakalar),
`src/__tests__/paywallExitAfterPurchase.test.tsx` (8 test: çıkış var mı, iptal/hata durumunda
çıkmıyor mu, yığın boşken köke düşüyor mu, misafir onayı ekranda kalıyor mu).

**✅ İncelemede — `1.2.0 (10)`, gönderim `a252a46b-6a51-4834-a6bf-2cf1d1de5d95`.**

Önce build 9 gönderildi (11:00 UTC), sonra reklam kimliklerinin pakete hiç girmediği ortaya
çıkınca **build 10 ile değiştirildi**. Kuyruk sıfırlandı; kazanç, iOS'un reklamları gerçekten
çalışan ilk build'iyle incelemeye girmesi.

**Build 9 → 10 takas tarifi** (bir dahakine aynen işe yarar):
1. `.ipa` `xcrun altool --upload-app` (17 sn), Apple işlemesi **~7 dk** — build ASC API'sinde
   `VALID` görünmeden bağlamaya çalışma
2. `PATCH /v1/reviewSubmissions/{id}` `{attributes:{canceled:true}}` → `CANCELING`, birkaç saniyede
   `COMPLETE`
3. `PATCH /v1/appStoreVersions/{id}/relationships/build` → sürüm `PREPARE_FOR_SUBMISSION`, build 10
4. Sürüm sayfasında **"Add for Review"** → yeni bir **taslak gönderim** oluşuyor
5. ⚠️ **Gönderimi iptal etmek abonelikleri `Developer Rejected`'a düşürüyor** ve otomatik geri
   gelmiyorlar. Abonelik grubu **ve iki aboneliğin her biri** ayrı ayrı sayfalarından
   *Add for Review → Draft iOS Submission* ile taslağa eklenmeli. Taslak paneli 4 kalem
   göstermeden **Submit'e basma** — yoksa iOS hiçbir şey satamayan bir paywall'la yayına girer
6. **"Submit for Review"**

Şu an dört kalemin dördü de `READY_FOR_REVIEW`, sürüm ve gönderim `WAITING_FOR_REVIEW`.

⚠️ **Metadata'ya dokunma** — ASO düzenlemek build'i incelemeden çıkarır.

### ✅ AdMob çalışan hesaba taşındı ve iki platforma da çıktı

`pub-3817081931651779` (`authuser=0`) artık tek yayıncı. O hesapta **iOS uygulaması yoktu**;
"DriftStop iOS" ve iki reklam birimi oluşturuldu. Altı kimlik de konsol ekranından okundu:

| | id |
|---|---|
| Android app | `ca-app-pub-3817081931651779~3768978323` |
| Android banner / geçiş | `…/3409885671` · `…/3532753144` |
| iOS app | `ca-app-pub-3817081931651779~3993212711` |
| iOS banner / geçiş | `…/6401708030` · `…/3282766272` |

`app.json` + `.env` + EAS `production`/`preview` güncellendi (`development` bilerek boş — `__DEV__`
Google'ın test birimlerini kullanıyor). `src/constants/__tests__/admobPublisher.test.ts` kimliklerden
biri başka yayıncıya kayarsa kırılıyor.

**EAS'in ücretsiz Android kotası doluydu (1 Eylül'de yenileniyor), o yüzden `versionCode 22`
lokalde alındı** — Android Studio'nun içindeki JDK 21 ile `eas build --local`, buluta hiç
dokunmadan, 4dk38sn. `scripts/play-upload.js … production` ile %100 yayına çıktı. 20 ve 21
tüketilip yayınlanmadı (20: kota reddi, 21: reklam id'lerinin pakette olmadığını kanıtlayan build).

⚠️ **Sadece hesabı değiştirmek yetmezdi.** Aynı gün `process.env[key]` tuzağı bulundu (aşağıda);
o düzeltilmeden hiçbir build reklam gösteremiyordu. Android 22 ve iOS 10 ikisini birden taşıyan
ilk build'ler.

⚠️ **Sunum iki tarafta da sınırlı.** İki AdMob uygulaması da *"Onay durumu: İnceleme gerekli"*
diyor — Google her yeni uygulamayı tam hacimde sunmadan önce inceliyor (birkaç gün). Android
kaydında ayrıca *"Uygulama doğrulama: Doğrulanmadı"* ve bir **Verify app** düğmesi var; `app-ads.txt`
yayında olduğu için tarama bunu temizlemeli ama **düğmeye basılmadı** (politika beyanı içerebilir,
sahibin işi). iOS kaydına **mağaza listelemesi bağlı değil** — App Store'a çıkınca bağlanmalı.

### ✅ Her iki canlı build de TEMİZ

`monetization-v2`'deki test edilmemiş roadmap işi (kasa, akıllı zamanlama, `expo-task-manager`)
**hiçbir mağaza build'inde YOK** — doğrulandı: Android 19 (`063060f`, 14 Ağu) ve iOS build 8
(`fcdcd85`) ikisinde de `src/utils/vault.ts` ve `engagement.ts` bulunmuyor. O çalışma 16 Ağustos'ta,
build'lerden sonra geldi.

### Dal düzeni

| Dal | Commit | Not |
|---|---|---|
| `main` | mağazadaki kodla aynı | 2026-08-24'te 71 commit ilerletildi, artık gerçeği yansıtıyor |
| `ios-1.2.0-hotfix` | `main` + 4 | iOS build'leri buradan çıkıyor. **Build 9'un düzeltmeleri burada, `main`'de değil** — inceleme sonuçlanınca `main`'e ve `monetization-v2`'ye alınmalı |
| `monetization-v2` | `main`'i içerir, +41 | **Cihaz QA'sı yapılmadan `main`'e alınmamalı** |

---

## ⛔ SIRADAKİ İŞ

### 1. iOS incelemesini bekle (aksiyon yok)
`1.2.0 (10)` `WAITING_FOR_REVIEW`. Reddedilirse gerekçe Resolution Center'da. **Cevap yazma kutusu
yalnız gönderim `Unresolved Issues`'dayken görünüyor** — `Waiting for Review`'a geçtiği an ASC onu
kaldırıyor, geriye sadece *Cancel Submission* kalıyor.

### 2. Onaydan sonra: reklamın gerçekten döndüğünü gör
Kod tarafı artık doğru (kimlikler pakette, hesap onaylı) ama **hiçbir platformda ekranda bir reklam
görülmedi**. İki AdMob uygulaması da *"İnceleme gerekli"* durumunda; Google onayı geçince Android'de
canlı uygulamadan bakılabilir.

### 3. AdMob'da sahibin yapması gerekenler
- **Verify app** (Android kaydı, *"Uygulama doğrulama: Doğrulanmadı"*) — `app-ads.txt` yayında
  (HTTP 200, doğru yayıncı); düğme bir politika beyanı isteyebilir diye ajan basmadı
- iOS uygulaması **"mağazada listelenmiyor"** olarak oluşturuldu; App Store'a çıkınca
  **mağaza listelemesini bağla** (⚠️ paket adıyla arama sonuç vermiyor, mağaza URL'siyle ara)

### 4. Düzeltmeleri dallara yay
`ios-1.2.0-hotfix` `main`'in önünde. İnceleme sonuçlanınca `main`'e, oradan `monetization-v2`'ye.

---

## Diğer açık işler

1. **Tamamlanmış bir satın alma hâlâ hiçbir platformda kanıtlanmadı.** Artık Android canlı, yani
   **kendi telefonundan Play Store'dan indirip gerçek bir satın alma** yapmak mümkün — gelir
   yolunun ilk kanıtı buradan gelebilir.
2. **Apple ile giriş hiçbir cihazda çalıştırılmadı.** Simülatörde İMKÂNSIZ (altı varyant denendi,
   `OPERATIONS.md`'de tablo). Ama artık **imzalama kimliği var**, yani bir iPhone bulunduğunda
   TestFlight'sız doğrudan kurulabilir.
3. **`intensity-review.csv`** çalışma dizininde duruyor ve **gitignore'da değil** — sahibin onayını
   bekleyen sertlik etiketleme dosyası. Bir sonraki `git add -A` onu yanlışlıkla içeri alır.
4. **iOS ASO yapılmadı.** App Store'da 100 karakterlik ayrı anahtar kelime alanı var ve listeleme
   yalnız `en-US` + `en-GB` — Türkçe yok. ⚠️ **İnceleme bitmeden dokunma**: metadata düzenlemek
   build 8'i incelemeden çıkarır.

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
| `4e288d3` `0bd9f0d` | **2.1(a) SIWA reddi** — sessiz yutma + `try/finally` eksikliği (kalıcı ölü düğme) |
| `8ca889f` `8172137` | **İmzalama kimliği** ASC API'siyle üretildi; simülatörde SIWA'nın neden imkânsız olduğu |
| `368e504` `fcdcd85` `71394e6` | Aynı iki düzeltme izole dala alındı → **iOS build 8** |
| — | **Android production'a çıkarıldı** (`versionCode 19`), Play ASO (`en-US` + `tr-TR`), AdMob mağaza bağlantısı, `app-ads.txt` |
| `f80dd4e` | **Build 8'in iki reddi** — `expo-audio` kaldırıldı, paywall'a satın alma sonrası çıkış |
| `c1d15ca` | **AdMob `pub-3817…`'e taşındı** + iOS uygulaması/birimleri oluşturuldu, yayıncı bekçisi |
| `f1d355d` | iOS buildNumber 9 (Android sayacı 20'de, tüketilmedi) |

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

## 2026-08-24'te öğrenilenler

### 🔴 En pahalı sessiz hata: `process.env[key]` derlemede gömülmüyor
`constants/adUnits.ts` dört reklam birimini bir yardımcıyla okuyordu:
`const env = (key) => process.env[key]`. `babel-preset-expo` `EXPO_PUBLIC_*`
değerlerini pakete gömerken **yalnızca statik üye erişimini** (`process.env.X`)
tanıyor; hesaplanmış erişim olduğu gibi kalıyor ve cihazda `process.env` diye bir
nesne olmadığı için değer `undefined` oluyor. Yani **bugüne kadar çıkan hiçbir
yayın derlemesi tek bir reklam gösteremezdi** — yanlış AdMob hesabından bağımsız
olarak. Sadece hesabı düzeltmek tek bir gösterim bile üretmeyecekti.

Hiçbir gösterge bunu söylemedi: `tsc` temiz, testler yeşil (jest gerçek
`process.env`i okur, Babel dönüşümü koşmaz), EAS build logu dört değişkeni de
"yüklendi" diye yazdı. **Tek dürüst kaynak derlenmiş paketti:**

```bash
unzip -p <aab> base/assets/index.android.bundle > bundle.hbc   # iOS: Payload/*.app/main.jsbundle
strings -a bundle.hbc | grep -oE "ca-app-pub-[0-9]+/[0-9]+" | sort -u
```

`src/__tests__/noDynamicEnvAccess.test.ts` bu yazımı `src/` genelinde yasaklıyor.
**Yeni bir `EXPO_PUBLIC_*` eklerken: değeri paketin içinde gördüğünü doğrula.**

### Reddin sebebini `app.json` değil, iki `.ipa`'nın farkı söyler
Build 8 ve build 9'un `Info.plist`'leri indirilip `plutil -convert json` ile karşılaştırıldı; fark
tam olarak **iki fazla anahtar** çıktı (`UIBackgroundModes`, `NSMicrophoneUsageDescription`) ve
ikisi de `app.json`'da hiç yazmıyordu. Bir eklentinin ne eklediğini tartışmak yerine **eski ve yeni
binary'yi diffleyin** — hem düzeltmeyi hem de yan etkisizliğini tek adımda kanıtlıyor:

```bash
unzip -p <ipa> "Payload/*.app/Info.plist" | plutil -convert json -o - -
```

### Düz string eklenti kaydı iki yönde de tuzak
Bu proje daha önce `google-signin`'i props'suz kaydedip **hiçbir şey üretmemesini** yaşadı. Bu turda
tersi oldu: `"expo-audio"` props'suz kaydedilince **kendi varsayılanını** (`enableBackgroundPlayback: true`)
uygulayıp `UIBackgroundModes: ["audio"]` ekledi. Kural aynı: eklentiyi düz string yazma, ve etkisini
`expo config --type introspect` ile oku.

### Hiç kullanılmayan bir paketi susturmak yerine kaldırın
`enableBackgroundPlayback: false` reddi çözerdi ama `expo-audio` yine iOS'a
`NSMicrophoneUsageDescription`, Android'e `RECORD_AUDIO` + `MODIFY_AUDIO_SETTINGS` eklemeye devam
ederdi. Bir söz uygulamasında mikrofon izni istemek Play politika incelemesi çeker. `src/` içinde
tek `import` yoksa ve hiçbir paket ona bağlı değilse, doğru cevap `npm uninstall`.

### EAS ücretsiz kotası build'i reddetmeden ÖNCE `app.json`'ı artırıyor
`eas build -p android` `versionCode`'u 19 → 20 yazdı, **sonra** "bu ay Android kotan doldu" deyip
işi hiç oluşturmadı. Yani sayaç, hiç var olmamış bir build için tükendi. Geri sarmayın (bir kez
duplicate'e yol açtı); atlanan numara zararsız, Play yalnız artmasını istiyor.

### "Update Review" hâlâ tek anahtar — ama artık sırası belli
`PATCH .../relationships/build` sürümü `PREPARE_FOR_SUBMISSION` yapıyor, gönderim kalemi
`REJECTED` kalıyor ve **"Resubmit" soluk duruyor**. Sürüm sayfasındaki **"Update Review"** dört
kalemi birden `Ready for Review`'a çeviriyor, Resubmit ancak ondan sonra basılabiliyor. `altool`
yüklemesi 17 saniye, Apple'ın işlemesi ~8 dakika: build ASC API'sinde görünene kadar bağlama
denemeyin.

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
