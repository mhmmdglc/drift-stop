# DriftStop 🔥

Kişisel motivasyon uygulaması. Login yok, hesap yok, internet yok.
Gün içinde rastgele saatlerde **local push bildirimleriyle** sert/motive edici sözler gönderir —
hedeflerinden sürüklenmeni engellemek için.

Estetik: "30 yıldır yazılan, mum ışığında fotoğraflanmış eski bir deri defter."
El-çizimi (wobbly SVG) kenarlar, el yazısı fontlar (Caveat / Kalam / Architects Daughter),
sıcak kahve/amber/kömür paleti.

> Expo SDK **56** • React Native 0.85 • TypeScript • expo-router (file-based)

---

## Özellikler

- **1000 söz** (`src/data/quotes.json`) — Roma, Yunan, Japon/Samuray, Çin, İslami & Doğu, Türk, ABD, Avrupa, Hindistan, Afrika, Latin Amerika. Hepsinde Türkçe çeviri.
- **Akıllı bildirim zamanlama** — aktif saat penceresinde (vars. 09:00–21:00) günde 3/5/7/10 rastgele bildirim, aralarında min 90 dk; her gün / app açılışında yeniden planlanır.
- **Favoriler** + **paylaşım** (AsyncStorage, offline).
- **Ayarlar** — frekans, aktif saat, hafta sonu, tema (karanlık/aydınlık/sistem), dil.
- **Android ana ekran widget'ı** — günün sözü, dokununca uygulamada açılır.
- **AdMob** — banner + 5 swipe'ta bir interstitial (geliştirmede TEST ID'leri).
- **6 dil aktif**: Türkçe, English, Español, Deutsch, Français, Italiano — cihaz diline göre otomatik seçilir, Ayarlar'dan değiştirilir (Arapça/Japonca shell). Sözler orijinal dilinde (TR seçiliyse Türkçe çeviri, değilse İngilizce/orijinal) gösterilir.

## Mimari

```
src/
  app/                  expo-router rotaları (kök: src/app)
    _layout.tsx         splash → onboarding/tabs gate, sağlayıcılar, bildirim dinleyici
    onboarding.tsx      3 slayt + izin
    quote/[id].tsx      bildirim/widget tıklamasıyla açılan söz
    (tabs)/             index (Home) · favorites · settings
  components/           QuoteCard, WobblyBorder, SketchButton, TimePicker, AdBanner, ...
  hooks/                useRandomQuote, useFavorites, useSettings, useNotifications, use-theme
  utils/                scheduler, quoteSelector, timeUtils, ads, share, storage
  data/                 quotes.json (1000) + gen/ (bölge parçaları, build kaynağı)
  i18n/ · locales/      i18n-js, tr.json aktif + shell'ler
  widgets/              Android widget (JSX) + task handler
index.js                özel giriş: widget task handler'ı kaydeder, sonra expo-router/entry
```

## Çalıştırma

> ⚠️ **Native özellikler** (Android widget, AdMob, exact-alarm) **Expo Go'da çalışmaz** — development build gerekir.
> Sözler, favoriler, ayarlar ve **local bildirimler** Expo Go'da test edilebilir (reklam/widget devre dışı).

### Hızlı test (Expo Go)
```bash
npm install
npm start            # telefonda Expo Go ile QR okut
```

### Development build (önerilen — tüm özellikler)
```bash
npx expo prebuild -p android        # android/ üretir (gitignore'da)
npx expo run:android                # cihaz/emülatöre kurar
# veya EAS ile:
eas build --profile development --platform android
```

## Testler & doğrulama

```bash
npm test                 # Jest (timeUtils, quoteSelector, quotes veri bütünlüğü)
npx tsc --noEmit         # tip kontrolü
npm run build:quotes     # gen/ parçalarından quotes.json'ı yeniden üret (1000)
```

## Canlıya alma (Android) — kalan adımlar

Kod hazır; aşağıdakiler **senin gireceğin** değerler/dosyalar:

- [ ] **Gerçek AdMob** App ID + Ad Unit ID'leri → `app.json` (`react-native-google-mobile-ads` plugin) ve `src/constants/adUnits.ts` (`REAL`).
- [ ] `google-services.json` (Android, AdMob).
- [ ] **Gizlilik politikası** URL'i + uygulama mağaza linki → `src/constants/links.ts`.
- [ ] App icon / splash görselleri (şu an Expo varsayılanı).
- [ ] `eas build --profile production --platform android` → AAB → Google Play.

Detaylı plan: [PLAN.md](PLAN.md)
