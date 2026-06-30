# DriftStop — Build Plan (v1)

> Kişisel motivasyon uygulaması. Login yok, hesap yok, internet yok.
> Gün içinde rastgele saatlerde push (local) bildirimleriyle sert/motive edici sözler gönderir.
> Estetik: "30 yıldır yazılan, mum ışığında fotoğraflanmış eski bir deri defter."

Bu dosya **nasıl inşa edeceğimizin** yol haritasıdır. Kod yazımı buna göre, fazlar halinde ilerleyecek.
Her teknik karar **Expo SDK 56** (`docs.expo.dev/versions/v56.0.0`) baz alınarak verilmiştir.

---

## ✅ DURUM (güncel)

| Faz | Durum |
|---|---|
| 0 — İskelet & temizlik | ✅ Bitti |
| 1 — Tasarım sistemi & Home | ✅ Bitti |
| 2 — 1000 söz + favoriler + paylaşım | ✅ Bitti |
| 3 — Bildirimler + Settings + Splash + Onboarding | ✅ Bitti |
| 4 — Prebuild (native üretim doğrulandı) | ✅ Bitti |
| 5 — AdMob (test ID'leri) | ✅ Bitti |
| 6 — Android Widget (JSX + task handler) | ✅ Bitti |
| 7 — Cila + EAS/README + go-live hazırlık | ✅ Bitti (gerçek ID/asset kullanıcıdan) |
| 8 — iOS (lansman sonrası) | ⏸ Beklemede |

**Doğrulama:** `tsc --noEmit` temiz · `jest` 23/23 geçiyor · `expo export -p android` temiz bundle · `expo prebuild -p android` native config (widget + AdMob + bildirim izinleri) hatasız üretiyor.

**Kalan (kullanıcı girdisi):** gerçek AdMob ID'leri, `google-services.json`, gizlilik/mağaza linkleri, app icon/splash görselleri, EAS production build → Play. Detay: README "Canlıya alma".

---

## 0. Mevcut Durum (repo)

- Expo **SDK 56** taze template kurulu (`expo-router`, TS strict, React 19, Reanimated 4, RN 0.85).
- Sadece varsayılan demo ekranlar var: `src/app/index.tsx`, `src/app/explore.tsx`.
- expo-router kökü bu projede **`src/app`** (spec'teki `/app` değil). Plandaki tüm rotalar `src/app/...` altına kurulacak.

---

## 1. KRİTİK GERÇEKLER (önce bunu okuyun)

Spec "Expo SDK latest" diyor ama proje **56**'da sabit. Her şeyi 56'ya pinliyoruz.
Aşağıdakiler spec'in çalışma şeklini doğrudan etkiliyor:

| Konu | Gerçek (SDK 56) | Etkisi |
|---|---|---|
| **Local bildirim** | Expo Go'da çalışır (iOS+Android), `scheduleNotificationAsync` kısıtsız | Geliştirmenin erken fazı Expo Go'da test edilebilir |
| **Remote/push** | Android'de SDK 53'ten beri Expo Go'da YOK | Bize gerekmiyor — biz **local** kullanıyoruz |
| **Android Widget** (`react-native-android-widget`) | Native kod → Expo Go'da **çalışmaz** | `expo prebuild` + **development build** şart |
| **AdMob** (`react-native-google-mobile-ads`) | Native kod + config plugin → Expo Go'da **çalışmaz** | Dev build şart |
| **Custom Kotlin widget modülü** | Native → Expo Go'da **çalışmaz** | Dev build şart |
| **iOS widget** | `react-native-android-widget` SADECE Android | iOS ana ekran widget'ı bu paketle olmaz (WidgetKit/Swift gerekir) → **kapsam dışı / sonraki faz** |
| **expo-background-fetch** | SDK 53+'da deprecated → `expo-background-task` | Bizde zaten **opsiyonel** (aşağıda açıklandı) |
| **Android exact alarm** | `SCHEDULE_EXACT_ALARM` + `RECEIVE_BOOT_COMPLETED` izinleri | app.json plugin config'ine eklenecek |

### Sonuç: Geliştirme akışı
1. **Faz 1–2** (UI, sözler, navigasyon, local bildirim) → **Expo Go** ile hızlı test edilebilir.
2. **Faz 5+** (widget + AdMob) → `npx expo prebuild` ile `android/` üretilir, **development build** (cihaz/emülatör) ile test edilir. Expo Go bırakılır.

> ⚠️ Bu, "tamamen Expo Go'da çalışan" bir uygulama olmayacak demek. Widget + reklam istendiği an **bare/dev build**'e geçiyoruz. Bu spec'in bir gereği, sürpriz değil.

---

## 2. EN BÜYÜK İŞ KALEMİ: 1000 söz

`src/data/quotes.json` — 1000 gerçek söz, hepsinde `textTr` dolu. Bu, projenin **en uzun tek parçası**.

- Dağıtım (spec'teki gibi): İslami & Doğu 150, Roma/Yunan 100, Japonya/Samuray 120, Çin 100, Türkiye folk 60, ABD 100, Avrupa 80, Hindistan 80, Afrika 60, Latin Amerika 40, Misc 10 = **1000**.
- Ton kuralları **sert**: 1–2 cümle, göğse yumruk gibi, "kucaklama değil". Pinterest/toxic-positivity yok.
- **Yaklaşım:** kategori/bölge bazında **batch'ler** halinde üreteceğim (ör. 50–100'lük partiler), `id` 1–1000 sıralı, şema doğrulamalı. Tek seferde değil; her batch'i schema'ya karşı kontrol edeceğiz.
- **Dürüst not:** 1000 sözün hepsinin birebir tarihsel doğru atıf + kaliteli Türkçe çeviri olması ciddi emek. Atıfların doğruluğu için kendi kontrolümü yapacağım; istersen sonradan birlikte gözden geçiririz. Yer tutucu (placeholder) kullanmayacağım.

`quotes.schema` (her kayıt):
```
id:number · text:string · textTr:string · author:string · origin:string
originEmoji:string · category:enum(8) · era:enum(4)
```

---

## 3. MİMARİ & DOSYA YAPISI (bu projeye uyarlanmış)

```
src/
  app/                         ← expo-router kökü (BU projede src/app)
    _layout.tsx                ← root stack: splash → onboarding|tabs, font yükleme, i18n, tema, bildirim listener
    splash.tsx                 ← SVG fırça-darbesi animasyonu (2.2s)
    onboarding.tsx             ← 3 slayt + izin (ilk açılış)
    (tabs)/
      _layout.tsx              ← tab bar (Home / Favorites / Settings)
      index.tsx                ← HomeScreen
      favorites.tsx            ← FavoritesScreen
      settings.tsx             ← SettingsScreen
    quote/[id].tsx             ← QuoteDetailScreen (bildirime tıklayınca)
  components/
    QuoteCard.tsx  AdBanner.tsx  CategoryBadge.tsx  OriginBadge.tsx
    TimePicker.tsx  WobblyBorder.tsx  SketchButton.tsx  PaperBackground.tsx
  hooks/
    useRandomQuote.ts  useNotifications.ts  useFavorites.ts  useSettings.ts
  utils/
    scheduler.ts       ← bildirim zamanlama (rastgele, min 90dk gap)
    quoteSelector.ts   ← rastgele seçim + "art arda tekrar yok" + günlük seen list
    timeUtils.ts       ← aktif saat hesapları
  constants/
    colors.ts  fonts.ts  adUnits.ts
  data/
    quotes.json        ← 1000 söz
  locales/
    tr.json (aktif)  en.json  ar.json  de.json  fr.json  ja.json (shell)
  i18n/
    index.ts  useTranslation.ts

android/  (prebuild SONRASI üretilir — Faz 5)
  app/src/main/java/.../widget/{DriftStopWidgetProvider.kt, WidgetDataManager.kt}
  app/src/main/res/layout/driftstop_widget.xml
  app/src/main/res/xml/driftstop_widget_info.xml
```

> Not: spec'teki örnek demo dosyaları (`explore.tsx`, vb.) ilk fazda temizlenecek.

---

## 4. ZAMANLAMA ALGORİTMASI (çekirdek)

`utils/scheduler.ts`:
- Aktif saat penceresi (varsayılan 09:00–21:00), günde N bildirim (3/5/7/10).
- N adet zaman damgasını pencere içinde **rastgele** seç; aralarında **min 90dk**.
- Sırala → her birine "art arda tekrarsız" rastgele `quoteId` ata → `scheduleNotificationAsync`.
- Her gece (00:00) ertesi gün için yeniden planla; ayrıca **app açılışında** bugünün planı yoksa hemen planla (telefon yeniden başlatma senaryosu).
- AsyncStorage: `lastScheduledDate`, `scheduledQuoteIds[]`, `seenToday[]`.
- "Gece planlama" için Faz 5'te `expo-background-task` (deprecated `background-fetch` yerine) opsiyonel; ama OS bildirimleri önceden zamanlandığı için **app-open reschedule** tek başına yeterli bir fallback.

---

## 5. FAZLAR (build sırası)

Her faz **çalışır + test edilebilir** bir çıktı verir. Onayınla sırayla ilerlerim.

**Faz 0 — İskelet & temizlik**
Template demo ekranları temizle, klasör yapısını kur, tema/renk/font sabitlerini ekle, i18n (`tr.json` tam, diğerleri shell), `PaperBackground` (grain + defter çizgileri + kenar marjı).
→ Test: Expo Go.

**Faz 1 — Tasarım sistemi & Home (statik söz)**
Fontlar (Caveat/Kalam/Architects Daughter), `WobblyBorder`, `SketchButton`, Phosphor ince ikonlar, `QuoteCard`, `CategoryBadge`, `OriginBadge`. HomeScreen tek sözle + swipe/fade animasyon (Reanimated). Söz geçişleri.
→ Test: Expo Go.

**Faz 2 — Söz veritabanı + seçim + Favoriler + Paylaş**
`quotes.json` (batch'lerle 1000'e doğru), `quoteSelector`, `useRandomQuote`, `useFavorites` (AsyncStorage), Favorites ekranı, `expo-sharing` ile paylaşım.
→ Test: Expo Go.

**Faz 3 — Bildirimler (local) + Settings + Splash + Onboarding**
`expo-notifications` kurulum (handler, izin, Android kanalı `driftstop_motivation`), `scheduler.ts`, Settings (frequency, aktif saat picker, hafta sonu/master toggle, tema, dil seçici), Splash animasyonu, 3-slayt Onboarding + izin, ilk-açılış akışı, `quote/[id]` (bildirime tıkla → o söz).
→ Test: Expo Go (local bildirim Go'da çalışıyor). Android exact-alarm izinleri eklenir.

**Faz 4 — Prebuild'e geçiş**
`app.json` plugin config'leri (expo-notifications ikon/renk/kanal, izinler), `npx expo prebuild`, development build kurulumu (iOS/Android). Bundan sonra test **dev build** ile.
→ Test: Development build.

**Faz 5 — AdMob**
`react-native-google-mobile-ads` + config plugin, **TEST** ad unit ID'leri (`constants/adUnits.ts`). HomeScreen alt banner; 5 swipe'ta bir interstitial; ilk açılışta ve bildirimden gelişte interstitial YOK; gösterdikten sonra preload.
→ Test: Development build.

**Faz 6 — Android Widget (native)**
`react-native-android-widget` + custom Kotlin: `DriftStopWidgetProvider.kt`, `WidgetDataManager.kt`, `driftstop_widget.xml`, `driftstop_widget_info.xml`, AndroidManifest kaydı. Bildirim teslim → BroadcastReceiver → SharedPreferences'a `quoteId` → `updateAppWidget`. App içinde swipe → widget güncelle. Fallback default söz.
→ Test: Android development build (widget Android-only).

**Faz 7 — Cila & Android canlıya alma**
Animasyon ince ayar (ink-stamp, page-flip), boş durumlar, hata durumları, badge sayacı (opsiyonel), gerçek AdMob ID'leri (sen verince), gizlilik/rate linkleri, ikonlar. → **Google Play yayını** (aşağıdaki kontrol listesi).

**Faz 8 — iOS (LANSMAN SONRASI)**
Android canlıya alındıktan sonra: iOS dev build, App Store yayını ve iOS widget (WidgetKit/Swift + App Groups). Bu faz şimdilik beklemede.

---

## 5.1 CANLIYA ALMA (Android Go-Live) Kontrol Listesi

Faz 7'de Google Play'e çıkmadan önce kapatılması gerekenler:

- [ ] **Gerçek AdMob** App ID + Ad Unit ID'leri (test ID'leri kaldır) — *senden gelecek*
- [ ] **App icon / adaptive icon / splash** son haline getirilmiş
- [ ] **Gizlilik politikası** URL'i (AdMob veri topladığı için Play zorunlu)
- [ ] **Bildirim izinleri** (`SCHEDULE_EXACT_ALARM`, `RECEIVE_BOOT_COMPLETED`) test edilmiş
- [ ] **versionCode / version** ayarı, `app.json` paket adı (ör. `com.driftstop.app`)
- [ ] **EAS Build** (production AAB) + Play Console listeleme
- [ ] Gerçek cihazda: bildirim akışı, widget güncelleme, reklam gösterimi doğrulandı

---

## 6. PAKET LİSTESİ (Faz bazlı kurulum)

- **Erken:** `react-native-svg`, `@expo-google-fonts/caveat`, `@expo-google-fonts/kalam`, `@expo-google-fonts/architects-daughter`, `phosphor-react-native`, `i18n-js`, `expo-localization`, `date-fns`, `@react-native-async-storage/async-storage`, `expo-haptics`, `expo-sharing`. (expo-font/router/reanimated zaten var.)
- **Faz 3:** `expo-notifications`.
- **Faz 5:** `react-native-google-mobile-ads`.
- **Faz 6:** `react-native-android-widget` (+ `expo-background-task` opsiyonel).

Hepsi `npx expo install` ile 56-uyumlu sürümlerde kurulacak.

---

## 7. KARARLAR (sabitlendi)

> Strateji: **Önce Android'i baştan sona bitir → canlıya al → sonra iOS'a bak.**

1. **iOS widget:** ✅ **Lansman sonrasına ertelendi** (Faz 8). Lansmanda iOS kullanıcısı uygulamayı + bildirimleri kullanır, widget olmaz.
2. **Geliştirme/yayın önceliği:** ✅ **Android.** Dev build ve store yayını önce Android.
3. **1000 söz:** ✅ Kaynak verilmedi → **ben batch'ler halinde üreteceğim** (schema doğrulamalı).
4. **AdMob:** ✅ Geliştirmede **TEST ID'leri**. Gerçek App ID/Ad Unit'ler **canlıya alma şartı** (aşağıdaki kontrol listesi).
5. **Dil:** ✅ Lansmanda yalnız **Türkçe aktif**, diğerleri shell.

---

## 8. RİSKLER

- **1000 kaliteli söz** = en büyük zaman/kalite riski (atıf doğruluğu, ton tutarlılığı).
- **Native geçiş** (prebuild) sonrası Expo Go bırakılır; iterasyon biraz yavaşlar (build süresi).
- **AdMob/Widget** native config hataları cihaz-bağımlı olabilir; gerçek cihazda test şart.
- **El-çizimi (wobbly SVG) estetik** tutarlılığı: yeniden kullanılabilir bileşenlerle (WobblyBorder/SketchButton) standardize edeceğiz.
