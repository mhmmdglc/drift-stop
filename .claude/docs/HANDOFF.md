# Devir notu — 2026-07-31

Bir oturum burada bitti. Yeni oturum bu dosyayı okuyup kaldığı yerden devam edebilir.
Plan [`specs/monetization-v2.md`](../specs/monetization-v2.md) içinde; bu dosya yalnızca **nerede kalındığı**.

---

## Durum: `monetization-v2` dalı, 6 commit, çalışma alanı temiz

```
e3d8fba  fix(sync): propagate premium quote deletions from the server
e2dc7dd  fix(packs): correct locale fallback, move cache reads off the render path
d555ba1  perf(db): drop the dead 1,000-row boot seed, add the missing indexes
5d08c68  docs: monetization v2 spec, store automation playbook, price correction
1d3b245  feat(monetization): free tier drops to 3 daily reminders
897c070  feat(ios): make iOS buildable — ATT, credentials, ads held back
```

`main`'e dokunulmadı. Kalite kapıları: `tsc` temiz · **144/144 test** (başlangıç 132) · `expo lint` **11 hata** = değişmemiş taban.

---

## Bitenler

### Faz A — ücretsiz katman ✅ iki platformda ekranda doğrulandı
Ücretsiz tavan **5 → 3**, varsayılan da 3. İkisi de 5 olduğu için kullanıcı ücretsiz paketin tam tavanında
başlıyordu ve hiç sınıra çarpmıyordu. Artık 5/7/10 Pro tarafında. İpucu metni 6 dilde değişti — **5 de
kilitlendiği** için "7 ve 10 Pro'ya özel" yanlış olurdu; eşik anlatan cümleye çevrildi.
Android'de görüldü: 3 seçili, 5/7/10 kilit rozetli, kilitliye dokununca değer değişmiyor ve paywall açılıyor.

### Faz F — veri katmanı ✅ büyük kısmı
- **Boot'taki 1.000 satırlık senkron seed silindi.** Önce ölçüldü: emülatörde **396 ms** JS thread bloke.
  `void syncQuotes()` ertelenmiş görünüyor ama bir `async` gövde ilk `await`'e kadar senkron çalışır.
  Ertelenmedi, **silindi** — yazdığı satırları hiçbir sorgu okuyamıyordu (okuyucuların hepsi premium
  filtreliyor; filtresiz tek okuyucuya statik dizi yüzünden ücretsiz id ile ulaşılamıyor).
- **İndeksler eklendi** (`pack_id`, `author+is_premium`, `is_premium`) — tabloda hiç indeks yoktu.
- `usePacks` render sırasındaki iki senkron SQLite okuması effect'e taşındı, `version` sayacı kalktı.
- **Paket başlıkları düzeltildi:** yedek sırası `locale → tr → en` idi; Türk kullanıcı zaten ilk adımda
  eşleştiği için `tr` yedeği yalnızca Türk OLMAYAN kullanıcıda çalışıyordu. Artık `locale → en → tr`.
- **Premium silme yayılımı eklendi.** Delta senkronu silmeyi haber veremiyor; `syncPremiumQuotes` zaten tüm
  premium satırları çektiği için o liste otoriter. Boş/hatalı/iptal edilmiş çekimde silme YAPILMIYOR —
  dört test bu reddetmeleri sabitliyor.
- İki ölü AsyncStorage anahtarı silindi (`seenToday`, `themeMode`). TODO üç diyordu; `widgetQuoteId`
  gerçekten kullanılıyor.
- **Premium sözlerde tema tag'i VAR** — Faz C için şema değişikliği gerekmiyor (spec'teki bilinmez kapandı).

### iOS'u derlenebilir hale getirme ✅
`eas.json` profil seviyesinde `credentialsSource: "local"` idi ve `credentials.json`'da yalnızca Android
keystore var — her iOS build'i ilk saniyede düşüyordu. Platform bazlı ayrıldı.
ATT kuruldu: izin SDK başlatılmadan önce çözülüyor ve sonuç `requestNonPersonalizedAdsOnly`'ye yansıyor
(eskiden sabit `true` idi, yani izin verilse bile kişiselleştirilmiş reklam alınamıyordu). İzin metni 6 dilde,
50 SKAdNetwork ID'si eklendi.
**iOS'ta reklam kapatıldı** — AdMob hesabı kapatıldığı için iOS birimleri yok; birim ID'si boş kalınca kod
Google'ın `TestIds`'ine düşüyor ve release'de gerçek kullanıcıya test reklamı göstermek başlı başına ihlal.

### Play fiyatları ✅ düzeltildi
API'den okununca `pro_monthly` **299,99 $/ay** çıktı — ilk girişte ondalık kaymış, yıllığın 15 katı,
kullanıcı olmadığı için kimse fark etmemiş. Sahibin kararıyla:
**`pro_monthly` $3.99/ay · `pro_yearly` $35.99/yıl**, 173 bölgeye `convertRegionPrices` + `basePlans` PATCH ile
yazıldı (regionVersion 2025/03). TR: ₺229,99 ve ₺2.049,99. Türkiye'ye ayrı fiyat konmadı — dönüşüm riski
olarak belirtildi, kabul edildi.

### RevenueCat zinciri ✅ tamir edildi — oturumun en büyük bulgusu
Panelde şu çıktı: DriftStop'un **Play Store** kaydında `evolaroa_pro_*` ürünleri vardı (başka bir uygulamanın
ID'leri, hepsi "Not found"), ve `default` offering yalnızca **Test Store** ürünlerine bağlıydı. Gerçek Play
ürünleri RevenueCat'e hiç kaydedilmemişti. Yani paywall prodüksiyonda da boş kalacaktı.
Yapılanlar: gerçek üç ürün Play Console'dan içe aktarıldı (üçü de Published) → entitlement'lar bağlandı
(`remove_ads` → `no_ads`; iki abonelik → `pro` + `no_ads`) → offering'in üç paketine de Play ürünleri eklendi.
Emülatörde doğrulandı: *"no Play Store products registered"* hatası **kalktı**.

### Play Developer API erişimi ✅
Servis hesabı `driftstop-eas@driftstop.iam.gserviceaccount.com`, yalnızca DriftStop'a bağlı, yetkiler:
üretim sürümü + test kanalı + mağazadaki varlığı yönetme. **`eas submit` otomasyonu artık mümkün.**
Not: Google, Play Console'daki "API erişimi" sayfasını kaldırmış; yeni akış servis hesabını normal kullanıcı
gibi davet etmek. Ayrıntı [`STORE-AUTOMATION.md`](STORE-AUTOMATION.md)'de.

---

## Çözüldü — Android worklets uyuşmazlığı (2026-07-31, akşam)

`[Worklets] Mismatch ... (0.8.3 vs 0.10.1)` → siyah ekran. **Kod hatası değildi.**

Kök neden ölçüldü ve `prebuild --clean` DEĞİLDİ. `android/` bayat değildi; bayat olan iki ayrı cache'ti:

1. **Native taraf:** `node_modules/react-native-worklets/android/build` ve `.cxx` içinde 0.10.1'den kalma
   derlenmiş `libworklets.so` duruyordu. CMake bunu güncel sayıyor, üstelik Gradle'ın
   `~/.gradle/caches/build-cache-1`'i her seferinde geri servis ediyordu — bu yüzden `android/app/build`'i
   silmek bile yetmiyor, `assembleDebug` "BUILD SUCCESSFUL in 14s" deyip eski `.so`'yu paketliyordu.
2. **JS taraf:** Metro'nun transform cache'i (`$TMPDIR/metro-*`) 0.10.1 dönemi modülünü tutuyordu.
   Cache temizlenmeden başlatılan Metro, native düzeldikten SONRA bile uyuşmazlığı geri getiriyor.

Çözüm — ikisini birlikte temizlemek:
```bash
rm -rf node_modules/react-native-worklets/android/build node_modules/react-native-worklets/android/.cxx \
       node_modules/react-native-reanimated/android/build node_modules/react-native-reanimated/android/.cxx \
       android/app/build android/build ~/.gradle/caches/build-cache-1
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
npx expo run:android          # --device VERME, adb serisini tanımıyor
npx expo start --clear        # JS tarafı için ŞART
```
Doğrulama: APK'nın içindeki gerçek sürümü oku, zaman damgasına güvenme —
`unzip -p .../app-debug.apk lib/arm64-v8a/libworklets.so | strings | grep -E '^0\.[0-9]+\.[0-9]+$'`
→ `0.8.3` çıkmalı. Metro logunda `Mismatch` ve `Cannot find native module` sayısı **0** olmalı
(ikinci hata birincisinin sonucu: worklets JSI kurulumunda patlayınca expo-modules-core'un modül kaydı
hiç yüklenmiyor, o yüzden `ExpoLocalization` bile "bulunamıyor").

### Bu makinede tekrar edecek iki tuzak

- **`lsof -ti:8081 | xargs kill -9` emülatörü de öldürüyor.** Emülatör süreci Metro'ya bağlı olduğu için
  o listede çıkıyor. Metro'yu pid'iyle değil, port taramasıyla öldürmek AVD'yi düşürüyor.
- Emülatörü `nohup ... &` ile başlatmak yetmiyor; araç çağrısı bitince süreç toplanıyor. Uzun ömürlü bir
  arka plan görevi olarak başlatılmalı.
- Emülatörün `/data` diski dolabiliyor: 95 MB'lık debug APK `INSTALL_FAILED_INSUFFICIENT_STORAGE` veriyor.
  Önce `adb uninstall com.driftstop.app`.
- Soğuk JS başlangıcı bu AVD'de **~1,5-2 dakika**. Bu süre içinde alınan ekran görüntüsü siyah çıkar ve
  hataya benzer; bekle.

## Paywall — hâlâ ekranda doğrulanmadı, sebebi config değil

Paywall açılıyor ama boş durum metnini gösteriyor:
`BILLING_UNAVAILABLE — Billing service unavailable on device`. Emülatörde **hiç Google hesabı yok**
(`adb shell dumpsys account` → 0 hesap). Android'de RevenueCat ürün metadata'sını Play Billing üzerinden
çekiyor, yani Billing yoksa hiç ürün gelmiyor. **Devir notunun eski hâlindeki "emülatörde ürünler ve
fiyatlar yine listelenmeli" beklentisi yanlıştı.**

Sunucu tarafı Play API'den doğrulandı: `pro_monthly` ACTIVE / 173 bölge / $3.99 / ₺229,99 ·
`pro_yearly` ACTIVE / 173 bölge / $35.99 / ₺2.049,99. `remove_ads` okunamadı — eski `inappproducts`
endpoint'i artık `403 "Please migrate to the new publishing API"` veriyor.

Ekran kanıtı için gereken: emülatörün Play Store'una kapalı testte lisanslı bir Google hesabıyla giriş
yapmak (sahibin yapması gerekiyor) ya da internal testing build'ini gerçek cihaza kurmak.

## Sıradaki işler (spec sırası)

| # | İş | Not |
|---|---|---|
| 1 | Faz F kalanı | Uzun listelerde sanallaştırma kontrolü (3.325 sözlük yazar listesi düz `map` ise ucuz cihaz kilitlenir); minSdk/deployment target belgeleme (iOS **16.4** doğrulandı, Android'inki Gradle `ext`'ten geliyor) |
| ~~2~~ | ~~**Faz B — kartsız 7 günlük deneme**~~ **BİTTİ 2026-07-31** (`48dae60`, `326e401`). Kalan tek şey: oturum açmış deneme kullanıcısının premium sözleri gerçekten indirdiğini bir cihazda görmek | En riskli faz. `useEntitlement` tek kaynak olacak; ⚠️ `usePremiumCacheGuard` denemeyi TANIMAK ZORUNDA, yoksa deneme kullanıcısının 3.325 satırlık premium cache'ini her açılışta siler. Sunucu tarafı: misafir kullanıcı çoğunlukta olacağı için deneme cihazda başlar, kullanıcı giriş yaparsa Supabase ile uzlaştırılır (yeni tablo + RLS) |
| 3 | Faz C — premium sözler bildirim havuzuna | Tag'ler hazır. `scheduler.ts` SQLite'tan okuyacak; yetki bitince planlı bildirimler yeniden kurulmalı. `scheduler.ts` için hâlâ **sıfır test** var |
| 4 | Faz D — karşılama akışı | 3 soru + kişisel söz + "7 gün açık". Metinler onaylandı, 6 dile çevrilecek. ⚠️ Paywall alt satırında **"Sync (soon)"** duruyor — senkron yapılmadı ve kapsam dışı, bu metin düzeltilmeli |
| 5 | Faz E — AppLovin MAX | `react-native-applovin-max` 9.6.0. **Resmî Expo config plugin'i yok**, `plugins/withAppLovin.js` yazılacak. Kullanıcıdan: hesap + SDK Key + 4 reklam birimi |
| 6 | Faz H — yayın | iOS: RevenueCat `appl_` anahtarı, ASC uygulama kaydı, IAP ürünleri, App Privacy, 6.9" screenshot. Android: v12 (⚠️ `3e36793` ve `e6db845` güvenlik düzeltmeleri **hiçbir build'de yok**), 12 tester |

---

## Sahipten bekleyenler

1. **RevenueCat iOS anahtarı** (`appl_...`) → `.env` + `eas env:create`. Yoksa iOS'ta paywall/Pro kartı hiç
   render edilmiyor, yani Pro bedavaya gidiyor.
2. **ASC'de DriftStop uygulama kaydı** — API'ye soruldu, `pomoPet` ve `EvolaRoa` dışında bir şey yok.
   İsim rezerve mi edildi, yoksa başka Apple hesabında mı, netleşmedi.
3. **AppLovin hesabı** + SDK Key + 4 reklam birimi.
4. **AdMob itirazı** — hesap "dürüst olmayan beyanlar" gerekçesiyle kapatıldı, **her iki platformda reklam
   geliri sıfır**. İtiraz metni için gerekli iki bilgi hâlâ alınmadı: kapatılan hesabın hangi mülke ait olduğu
   ve daha önce başka bir AdSense/AdMob hesabı olup olmadığı.

---

## Kimlik bilgileri (yerinde, çalışıyor)

| Ne | Nerede |
|---|---|
| ASC API Key | `~/.driftstop-secrets/AuthKey_2B4CL4C8CB.p8` · Issuer `bc64b7a2-f7c3-45f5-b073-2c4083fa3b0c` · Team `J8FX8G238M` |
| Play servis hesabı | `credentials/driftstop-891f4e9df260.json` (gitignore'da) |
| RevenueCat servis hesabı | `credentials/extreme-lattice-470518-d8-4a3d57098d76.json` |

Apple hesabı tarafı tamamen hazır: Paid Apps ✅ · banka ✅ · W-8BEN ✅ · DSA 🕐 incelemede.

## Bu makinede tekrar edecek ortam sorunları

Ajan kabuğu `LANG`, `JAVA_HOME` ve `ANDROID_HOME` olmadan başlıyor. Üçü de
[`STORE-AUTOMATION.md`](STORE-AUTOMATION.md) Bölüm 3'teki tuzaklar tablosunda çözümleriyle yazılı.
