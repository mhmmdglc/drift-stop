# Spec — Monetizasyon v2, Reklam Geçişi ve Yayın

**Durum:** Onay bekliyor. Hiçbir kod yazılmadı.
**Tarih:** 2026-07-31
**Kapsam:** Ücretsiz/Pro çizgisinin yeniden çizilmesi, kartsız 7 günlük deneme, premium içeriğin günlük döngüye girmesi, karşılama akışı, AdMob → AppLovin MAX geçişi, veri katmanı ve eski cihaz performansı, test ve iki mağazaya yayın.

Bu belge okunup onaylanmadan uygulamaya geçilmeyecek. Onaydan sonra fazlar sırayla yürütülür; her fazın sonunda `WORKLOG.md`'ye giriş düşülür.

---

## 0. Kilitlenen kararlar

Bunlar tartışıldı ve karara bağlandı. Uygulama sırasında bunlara geri dönülmeyecek.

| Karar | Değer | Not |
|---|---|---|
| Ücretsiz bildirim tavanı | **3 / gün** | Bugün 5. Kullanıcı olmadığı için geçiş sorunu yok |
| Pro bildirim seçenekleri | 5 · 7 · 10 | `FREQUENCY_OPTIONS` değişmiyor, sadece ücretsiz tarafın sınırı iniyor |
| Ücretsiz söz havuzu | 1.000 statik söz | Bugünkü davranış |
| Pro söz havuzu | **4.325 söz** (1.000 statik + 3.325 premium) | Yeni. Premium sözler ilk kez bildirimlere girecek |
| Deneme | **7 gün, kartsız, tam Pro** | Ödeme ekranı çıkmaz, mağaza denemesi kullanılmaz |
| Deneme istismarı | **Korunmayacak** | Yeniden kurulumla sıfırlanabilir olması kabul edildi |
| Deneme bitişi | 8. gün **her şey birden** iner | Bildirim 3'e, havuz 1.000'e, reklamlar başlar. Kademeli seçenek değerlendirildi, reddedildi |
| Ön bilgilendirme | 6. gün + 7. gün akşamı bildirim | Sürpriz olmaması için |
| `remove_ads` | iOS v1'de **listelenmez** | iOS v1 reklamsız çıkıyor. AppLovin iOS'a girdiği sürümde aktif edilir |
| Temalar / kategoriler | **Ücretsiz kalır** | Kilitlemek ürünü bozar — kişiselleştirme çekirdek vaat |
| Reklam ağı | **AppLovin MAX**, iki platform | AdMob hesabı kapatıldı |
| Karşılama akışı | 3 soru + kişisel söz + "7 gün açık" | Satış ekranı değil, kurulum ekranı |

**Onaylanan 8. gün metinleri** ayrı bölümde (§5.4). Ton: sert, samimi, ikinci tekil şahıs, emoji yok, özür yok.

---

## 1. Mevcut durumun teşhisi

Planın dayandığı bulgular. Hepsi koddan doğrulandı.

1. **Ücretsiz katman kendi tavanında başlıyor.** `DEFAULT_SETTINGS.frequency = 5` ve `FREE_FREQUENCY_MAX = 5` (`src/types/settings.ts:14,34`). Kullanıcı hiçbir zaman sınıra çarpmıyor, dolayısıyla yükseltme arzusu oluşmuyor.

2. **Pro günlük deneyimi değiştirmiyor.** 3.325 premium söz bildirimlere, widget'a ve ana ekrana tasarım gereği hiç girmiyor. Zamanlayıcı yalnızca statik diziden besleniyor (`scheduler.ts:4` → `getQuotesByThemes`). Pro'nun günlük tek karşılığı fazladan bildirim.

3. **İlk 60 saniyede teklif yok.** Beş paywall girişinin hiçbiri karşılama akışında değil.

4. **iOS'ta hiçbir gate çalışmıyor.** Her gate `purchasesConfigured &&` ile korunuyor; iOS'ta RevenueCat anahtarı olmadığı için 10/gün serbest, paywall hiç render edilmiyor. Simülatörde ekranda doğrulandı.

5. **Reklam geliri her iki platformda sıfır.** AdMob yayıncı hesabı "dürüst olmayan beyanlar" gerekçesiyle kapatıldı; iOS'ta reklam kodu zaten kapatıldı.

---

## 2. Faz sırası ve bağımlılıklar

```
A  Ücretsiz/Pro çizgisi          (bağımsız, en küçük)
│
├─ B  Kartsız 7 günlük deneme     (A'ya bağlı)
│  │
│  └─ C  Premium sözler havuza    (B'ye bağlı — denemenin anlamı bu)
│     │
│     └─ D  Karşılama akışı       (B'ye bağlı — "7 gün açık" der)
│
E  AppLovin MAX                   (bağımsız, paralel yürüyebilir)
│
F  Veri katmanı + eski cihaz      (C'den önce başlamalı, C onun üstüne kurulacak)
│
G  Test                           (hepsinden sonra)
│
H  Yayın                          (G'den sonra)
```

**Kritik sıra notu:** F fazı (veri katmanı) C'den **önce** yapılmalı. Premium sözleri bildirim havuzuna sokmak, SQLite okumasını sıcak yola taşıyor; mevcut senkron/boot-time yapısı bunu kaldırmaz.

---

## 3. Faz A — Ücretsiz/Pro çizgisi

**Amaç:** Kıtlığı yaratmak. En küçük değişiklik, en hızlı etki.

### Yapılacaklar

- [ ] `FREE_FREQUENCY_MAX` 5 → **3** (`src/types/settings.ts:14`)
- [ ] `DEFAULT_SETTINGS.frequency` 5 → **3** (`src/types/settings.ts:34`)
- [ ] `useEnforceFreeLimits` yeni sınıra göre çalıştığını doğrula — sabit üzerinden okuduğu için otomatik olmalı, teyit et (`src/hooks/useEnforceFreeLimits.ts:19`)
- [ ] Ayarlar ekranında artık **5, 7, 10** kilitli görünecek; kilit rozeti ve paywall yönlendirmesi zaten var (`settings.tsx:41`)
- [ ] İpucu metnini güncelle: "7 ve 10 günlük hatırlatma Pro özelliğidir" → "Günde 3'ten fazla hatırlatma Pro özelliğidir"
- [ ] Metni **6 dilde** güncelle (`src/locales/*.json`) — parite testi zorunlu kılıyor
- [ ] `useEnforceFreeLimits` için yeni sınır testi ekle

### Kabul kriterleri

- Ücretsiz kullanıcıda yalnızca 3 seçilebilir; 5/7/10 kilit rozetiyle görünür ve tıklanınca paywall açılır
- Pro kullanıcıda dördü de serbest
- Entitlement düşünce `frequency` otomatik 3'e iner ve bildirimler yeniden planlanır
- 6 dilde metin paritesi testi geçer

### Riskler

Düşük. Tek sabit değişikliği, mekanizma zaten kurulu.

---

## 4. Faz F — Veri katmanı ve eski cihaz performansı

> C fazından önce yapılması gerektiği için burada. Numarası akış sırasına göre değil bağımlılığa göre.

**Amaç:** Premium sözleri sıcak yola sokmadan önce veri katmanını buna hazırlamak, ve uygulamayı eski cihazlarda kullanılabilir tutmak.

### 4.1 Boot performansı

- [ ] **Senkron 1.000 satır seed'i boot'tan çıkar.** `quotesCache.seedIfEmpty()` şu an `openDatabaseSync` + `execSync` ile açılışta çalışıyor (`src/db/quotesCache.ts:33,66`). Eski cihazlarda ilk açılışta gözle görülür donma üretir. Asenkron kur, splash arkasında yap veya ilk gerçek ihtiyaçta tembel çalıştır.
- [ ] **`usePacks`'in `useMemo` içindeki SQLite okumasını render dışına al** — render sırasında senkron I/O yapılıyor (mevcut `TODO.md` #11).
- [ ] Boot süresini **ölçüp kaydet**: değişiklik öncesi ve sonrası, düşük segment bir Android cihazda/emülatörde.

### 4.2 SQLite şeması ve sorgular

- [ ] Premium söz tablosunda **tema tag'i var mı doğrula.** Zamanlayıcı temaya göre filtreliyor; premium sözlerde tag yoksa Pro havuzu tema filtresine uymaz ve kişiselleştirme bozulur. Yoksa şema + seed script'i güncellenecek.
- [ ] Zamanlayıcının kullanacağı sorgu için **indeks ekle** (tema/tag üzerinden rastgele N satır çekme).
- [ ] 3.325 satırı belleğe almadan rastgele seçim yapan sorgu yaz — tüm tabloyu JS'e çekmek eski cihazlarda bellek baskısı üretir.

### 4.3 Senkronizasyon eksikleri

- [ ] **Silme/tombstone yayılımı yok** (mevcut `TODO.md` #12): sunucudan kaldırılan bir söz veya paket yerel önbellekte sonsuza kadar kalıyor. Delta senkronuna silme sinyali ekle.
- [ ] **Paket başlıkları es/de/fr/it'te Türkçeye düşüyor** (`TODO.md` #4): `localizedPackField` sırası `locale → tr → en`; `locale → en` olmalı.
- [ ] **3 ölü AsyncStorage anahtarını sil** (`TODO.md` #13).

### 4.4 Eski cihaz desteği

- [ ] `minSdkVersion` (Android) ve iOS deployment target'ı **tespit et ve belgele** — şu an ne olduğu yazılı değil.
- [ ] Ne kadar eskiye destek verileceğine karar ver. Play Console v11 için 12.268 cihaz raporluyor; bu sayının düşmediğinden emin ol.
- [ ] Uzun listelerde (favoriler, paket detayı, yazar detayı) **sanallaştırma** kullanıldığını doğrula; 3.325 sözlük bir yazar listesi düz `map` ile render edilirse eski cihaz kilitlenir.
- [ ] Reanimated/worklets tabanlı animasyonların düşük segmentte kare düşürüp düşürmediğini ölç; gerekiyorsa `prefers-reduced-motion` benzeri bir düşük performans yolu ekle.

### Kabul kriterleri

- Soğuk açılış, düşük segment bir cihazda ölçülebilir şekilde iyileşmiş olmalı (rakam kaydedilecek)
- Premium söz sorgusu tüm tabloyu belleğe almadan çalışmalı
- 6 dilde paket başlıkları doğru dile düşmeli

---

## 5. Faz B — Kartsız 7 günlük deneme

**Amaç:** Kullanıcının Pro'yu anlatılarak değil **yaşayarak** öğrenmesi.

### 5.1 Yetki kaynağının birleştirilmesi

Bugün her yerde `isPro` okunuyor. Deneme geldiğinde iki kaynak olacak: gerçek abonelik ve aktif deneme. Bunun **tek noktadan** okunması şart, yoksa bir ekran denemeyi tanır diğeri tanımaz.

- [ ] `src/hooks/useEntitlement.ts` — tek gerçek kaynak. Döndürecekleri: `entitled`, `source: 'subscription' | 'trial' | 'none'`, `trialDaysLeft`, `entitlementKnown`
- [ ] Tüm tüketicileri buna geçir: `settings.tsx`, `quote/[id].tsx`, `packs/*`, `favorites.tsx`, `AdBanner.tsx`, `useEnforceFreeLimits`
- [ ] ⚠️ **`usePremiumCacheGuard` denemeyi bilmek zorunda.** Bilmezse deneme kullanıcısının indirdiği 3.325 satırlık premium önbelleği her açılışta siler. Bu, mevcut kodda en kolay gözden kaçacak bağlantı noktası.

### 5.2 Deneme durumu

- [ ] Başlangıç zaman damgasını ilk açılışta yaz (AsyncStorage). İstismar koruması yok — karar bu.
- [ ] Kalan gün hesabı **yerel saate göre** ve gün sınırında; saat farkı/yolculuk kenar durumlarını kabul et
- [ ] Cihaz saati geriye alınırsa deneme uzar — kabul edilen risk, koruma yazılmayacak

### 5.3 Deneme bitişi

- [ ] Bitişte sırayla: `frequency > 3` ise 3'e indir → bildirimleri yeniden planla → premium önbelleği temizle → `/trial-ended` ekranını bir kez göster
- [ ] Ekran **bir kez** gösterilecek; kapatıldıktan sonra tekrar açılmayacak
- [ ] Favorilerdeki premium sözler kilitli satıra dönecek — bu mekanizma **zaten kurulu ve test edilmiş**, sadece deneme bitişine bağlanacak

### 5.4 Bildirimler ve ekran metni (onaylandı)

**6. gün — bildirim**
> **Yarından sonra ritim değişiyor.**
> Bir haftadır 4.325 sözün arasındasın. Perşembe günü havuz küçülüyor. Detayları o gün anlatacağım — şimdilik okumaya devam et.

**7. gün akşamı — bildirim**
> **Bugün son gün.**
> Yarın seni bekleyen bir ekran var. Kötü bir şey değil.

**8. gün — tam ekran**

Başlık:
> Yedi gün doldu.

Ne değişiyor:
> Bugünden itibaren günde 10 değil **3 söz** alacaksın.
> Ve aramıza küçük reklamlar girecek. Seni rahatsız etmeyecek kadar az tutuyoruz — söz veriyorum, okuduğun anın önüne geçmeyecek.

Davet:
> Bu bir hafta boyunca Marcus Aurelius'un, Konfüçyüs'ün, Seneca'nın sözlerinin arasından geçtin. Bazıları tam ihtiyacın olduğu anda geldi. Hangisi olduğunu biliyorsun.
> **Hayatını değiştirecek kelimelerden vazgeçme.** Bu senin hayatın — en dolu halinle yaşa.

Güvence:
> Ama korkma, bir yere gitmiyoruz.
> Favorilerin duruyor. Geçmişin duruyor. Sözler gelmeye devam edecek — sadece daha az, daha sığ bir havuzdan.
> Bu hafta favorilerine eklediğin premium sözler **silinmiyor**; kilitli duruyor ve seni bekliyor. İstediğin gün geri dönebilirsin.

Butonlar: **Pro'ya devam et** (birincil) · *Ücretsiz devam et* (ikincil, saklanmıyor)

- [ ] "6. gün / 7. gün" bildirimleri normal söz bildirimlerinden ayrı kanaldan gitmeli, günlük kotayı yememeli
- [ ] Metinler **6 dile** çevrilecek
- [ ] Yeni route: `src/app/trial-ended.tsx`

### Kabul kriterleri

- Deneme boyunca: 10 bildirim seçilebilir, tüm paketler açık, reklam yok
- 8. gün: frekans 3'e iner, premium içerik kilitlenir, ekran bir kez görünür
- Premium favoriler silinmez, kilitli satır olarak durur
- Denemeden Pro'ya geçişte hiçbir şey kaybolmaz

### Riskler

**En yüksek riskli faz bu.** Deneme durumu, RevenueCat yetkisi ve önbellek temizliği birbirine bağlı üç mekanizma. Yanlış bağlanırsa ya paralı kullanıcının önbelleği silinir ya da ücretsiz kullanıcı premium içeriği görmeye devam eder (gelir kaçağı). Mevcut `premiumCacheGuard` testleri genişletilecek.

---

## 6. Faz C — Premium sözler bildirim havuzuna

**Amaç:** Denemeye ve Pro'ya gerçek bir içerik farkı vermek.

### Yapılacaklar

- [ ] `scheduler.ts` söz havuzunu yetkiye göre kurgula: yetkisiz → statik 1.000; yetkili → statik + SQLite premium
- [ ] Havuz okuması **asenkron** olacak; `applySchedule` zaten async
- [ ] Tema filtresi premium sözlerde de çalışacak (§4.2'ye bağlı)
- [ ] Bildirim gövdesinde premium söz gösterilecek; dokununca `/quote/[id]` premium çözümü zaten yapıyor
- [ ] **Yetki biterken planlanmış bildirimler premium söz içeriyorsa yeniden planlanacak** — aksi halde ücretsiz kullanıcıya premium söz düşer
- [ ] Widget geçmişten besleniyor; premium söz geçmişe girdiğinde widget'ta görünecek — yetki bitince widget'ın ne göstereceğine karar ver
- [ ] `scheduler.ts` için **ilk testler** yazılacak (bugün sıfır test var, `TODO.md` #10)

### Kabul kriterleri

- Yetkili kullanıcının aldığı bildirimlerde premium sözler görünür
- Yetki bitince bir sonraki planlamada premium söz kalmaz
- Tema seçimi premium sözlerde de geçerlidir

---

## 7. Faz D — Karşılama akışı

**Amaç:** Kişiselleştirme sinyalini toplamak ve "7 gün açık" demek. Satış yapmıyor.

### Akış

| Adım | Soru | Neyi belirler |
|---|---|---|
| 1 | "Seni buraya ne getirdi?" | Tema seti |
| 2 | "Sana nasıl seslenelim?" | Ton (sert / sakin / ikisi) → tema ağırlığı |
| 3 | "Gün içinde ne zaman kaybediyorsun kendini?" | Bildirim penceresi |
| 4 | Kişisel sonuç | Cevaba göre kataloğdan **gerçek bir söz**, tam ekran |
| 5 | "Önümüzdeki 7 gün her şey açık" | Bildirim izni + başlat |

### Yapılacaklar

- [ ] `src/app/onboarding.tsx` yeniden yazılacak (bugün 3 bilgi slaytı + tema seçici)
- [ ] Cevap → tema/pencere eşleme tablosu; mevcut tema seçici Ayarlar'da kalacak (ince ayar isteyenler için)
- [ ] Sonuç ekranında gösterilecek söz kataloğdan seçilecek — sahte "analiz ediliyor" ekranı **yok**
- [ ] Misafir olarak tamamlanabilir kalacak; kayıt duvarı **eklenmeyecek**
- [ ] Tüm metinler 6 dilde

### Kabul kriterleri

- Akış 5 adımda, geri dönülebilir, atlanabilir
- Cevaplar gerçekten ayarlara yazılıyor
- Sonunda deneme başlıyor ve kullanıcı bunu biliyor

---

## 8. Faz E — AppLovin MAX

**Amaç:** AdMob'un yerini almak, Android'de duran reklam gelirini geri açmak, iOS'a reklam eklemek.

### Ön koşul — kullanıcıdan

- [ ] AppLovin hesabı açılacak (dash.applovin.com)
- [ ] **SDK Key**
- [ ] 4 reklam birimi: Android banner, Android interstitial, iOS banner, iOS interstitial

### Yapılacaklar

- [ ] `react-native-applovin-max` **9.6.0** kurulacak (resmi paket, MIT)
- [ ] ⚠️ **Resmi Expo config plugin'i yok.** `plugins/withAppLovin.js` yazılacak — mevcut `plugins/withGradleVersion` deseni izlenecek
- [ ] `react-native-google-mobile-ads` kaldırılacak
- [ ] `src/utils/ads.ts`, `src/components/AdBanner.tsx`, `src/constants/adUnits.ts` yeniden yazılacak
- [ ] iOS'ta reklam yeniden **açılacak** (`adsEnabled` içindeki geçici platform kapatması kalkacak)
- [ ] ATT akışı korunacak — AppLovin de IDFA kullanıyor
- [ ] `SKAdNetworkItems` listesi AppLovin'in yayımladığıyla **değiştirilecek** (şu an Google'ınki duruyor)
- [ ] `app.json`'daki AdMob plugin bloğu ve örnek `iosAppId` temizlenecek
- [ ] Gizlilik beyanı (App Privacy / Data safety) AppLovin'e göre güncellenecek

### Kabul kriterleri

- Her iki platformda banner ve interstitial gerçekten render ediyor (test modunda görsel doğrulama)
- Reklamsız yetkisi olan kullanıcıda hiç reklam çıkmıyor
- iOS'ta ATT diyaloğu çıkıyor ve cevabı reklam isteğine yansıyor

### Kapsam dışı (sonraki faz)

Ödüllü video ve "bir reklam izle, koleksiyonu 24 saat aç" mekanizması. Ayrı tasarım işi.

---

## 9. Faz G — Test ve doğrulama

> Bu projenin kuralı: **derlenmesi çalışması değildir.** Aşağıdakilerin hepsi ekranda görülecek.

### Otomatik

- [ ] `scheduler.ts` için ilk birim testleri — izin, 3 günlük planlama döngüsü, `syncDeliveredToHistory`
- [ ] Deneme durumu testleri: başlangıç, kalan gün, bitiş, bitişte frekans indirimi
- [ ] `useEntitlement` testleri: abonelik / deneme / yok üçlüsü
- [ ] `premiumCacheGuard` testleri deneme durumu için genişletilecek
- [ ] 6 dil parite testi (mevcut, yeni metinlerle geçmeli)
- [ ] `tsc` temiz, `expo lint` yeni hata üretmiyor

### Cihazda — iOS Simulator ve Android emülatör

- [ ] Karşılama akışı baştan sona, 6 dilde en az ikisiyle
- [ ] Deneme boyunca: 10 bildirim, paketler açık, reklam yok
- [ ] Saat ileri alınarak 8. gün simüle edilecek: ekran çıkıyor mu, frekans iniyor mu, premium kilitleniyor mu
- [ ] Premium favori kilitli satıra dönüyor mu
- [ ] AppLovin banner + interstitial iki platformda görünüyor mu
- [ ] Eski cihaz profili: düşük segment emülatörde soğuk açılış ve liste kaydırma

### Gerçek cihaz — sende

- [ ] Satın alma akışı gerçek telefonda (emülatörde Play Billing yok)
- [ ] Deneme → Pro geçişinde içerik kaybı olmuyor
- [ ] Mevcut `TODO.md`'deki purge/restore senaryoları: uçak modu soğuk açılış, favoriler açıkken satın alma, geri yükleme sırasında çıkış

---

## 10. Faz H — Yayın

### iOS

- [ ] RevenueCat iOS anahtarı `.env` + `eas env:create`
- [ ] IAP ürünleri: `pro_monthly`, `pro_yearly` tek abonelik grubunda — **fiyat sahibinden alınacak**
- [ ] `remove_ads` iOS'ta **listelenmeyecek** (v1 reklamsız)
- [ ] App Store Connect uygulama kaydı (isim globalde benzersiz olmalı)
- [ ] Dağıtım sertifikası + provisioning profile
- [ ] App Privacy formu
- [ ] 6.9" ekran görüntüleri, Release build ile
- [ ] `eas submit` → App Review

### Android

- [ ] AppLovin ile v12 build'i
- [ ] ⚠️ **Şu an HEAD'de olup hiçbir build'de olmayan iki güvenlik düzeltmesi var** (`3e36793`, `e6db845`). v12 bunları taşıyacak
- [ ] Play servis hesabı JSON'u → `eas submit` otomasyonu
- [ ] Data safety formu AppLovin'e göre güncellenecek
- [ ] 12 tester + 14 gün

---

## 11. Kapsam dışı

Bu spec'e girmeyen, ayrı karar bekleyen işler:

- Ödüllü reklam ile 24 saatlik paket açma
- Cihazlar arası senkronizasyon (favoriler, ayarlar, seri) — hâlâ hiç kimse için yapılmadı
- iOS widget (WidgetKit) — mevcut widget Android'e özel
- Söz metinlerinin es/de/fr/it'e çevrilmesi — bugün gövdeler yalnızca tr/en
- AdMob hesap itirazı — ayrı süreç, ürünü bloklamıyor
- Sosyal giriş (`specs/social-sign-in.md`)

---

## 12. Açık sorular

Uygulama sırasında karara bağlanacak, şimdi bloklamayan sorular:

1. ~~**IAP fiyatları**~~ **Kapandı 2026-07-31.** Play'deki canlı yapılandırma Play Developer API üzerinden okundu ve `pro_monthly` **299,99 $/ay** çıktı — ilk girişte ondalık kaymış, yıllığın 15 katı. Düzeltildi: **`pro_monthly` $3.99/ay**, **`pro_yearly` $35.99/yıl**, 173 bölgeye Google'ın kur dönüşümüyle yazıldı. App Store'da aynı fiyatlar kurulacak. Türkiye'ye ayrı fiyat konmadı (₺229,99/ay) — ana pazar için dönüşüm riski olarak belirtildi, sahibi kabul etti.
2. **App Store'daki uygulama adı** — `DriftStop` alınmışsa alternatif ne olacak? *(ASC API'de hâlâ uygulama kaydı görünmüyor.)*
3. **Yetki bitince widget ne gösterecek?** Son premium söz mü kalacak, yoksa ücretsiz bir sözle mi değişecek?
4. **Eski cihaz eşiği** — hangi Android/iOS sürümüne kadar destek verilecek?
5. **Deneme, hesap açan kullanıcıda cihaz değişince ne olacak?** Sunucuya yazılmıyorsa yeni cihazda yeniden başlar. Kabul mü?

---

## 13. Tahmini büyüklük

| Faz | Büyüklük | Not |
|---|---|---|
| A — Ücretsiz/Pro çizgisi | Çok küçük | Tek sabit + 6 dil metni |
| F — Veri katmanı + eski cihaz | Orta-büyük | Ölçüm gerektiriyor |
| B — Deneme | Orta-büyük | En riskli faz |
| C — Premium sözler havuza | Orta | F'ye bağlı |
| D — Karşılama akışı | Orta | Çoğu metin ve çeviri |
| E — AppLovin | Orta-büyük | Config plugin sıfırdan yazılacak |
| G — Test | Orta | Cihaz doğrulaması zaman alır |
| H — Yayın | Küçük-orta | Beklemeler dışarıda |

---

**Onay bekleniyor.** Değiştirmek istediğin bir karar veya sıra varsa söyle; onayladığında Faz A'dan başlıyorum.
