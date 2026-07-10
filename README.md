# DriftStop 🔥

Personal motivation app. No login, no account, no internet required.
Sends **local push notifications** with hard/motivating quotes at random times during the day —
to keep you from drifting away from your goals.

Aesthetic: "an old leather notebook, written in for 30 years, photographed by candlelight."
Hand-drawn (wobbly SVG) borders, handwriting fonts (Caveat / Kalam / Architects Daughter),
a warm coffee/amber/charcoal palette.

> Expo SDK **56** • React Native 0.85 • TypeScript • expo-router (file-based)

---

## Features

- **1000 quotes** (`src/data/quotes.json`) — Roman, Greek, Japanese/Samurai, Chinese, Islamic & Eastern, Turkish, US, European, Indian, African, Latin American. All have a Turkish translation.
- **Smart notification scheduling** — 3/5/7/10 random notifications per day within an active-hours window (default 09:00–21:00), min 90 min apart; rescheduled daily / on app launch.
- **Favorites** + **sharing** (AsyncStorage, offline).
- **Settings** — frequency, active hours, weekends, theme (dark/light/system), language.
- **Android home-screen widget** — quote of the day, opens the app on tap.
- **AdMob** — banner + interstitial every 5 swipes (TEST IDs in development).
- **6 active languages**: Turkish, English, Español, Deutsch, Français, Italiano — auto-selected from device language, changeable in Settings (Arabic/Japanese are stubbed shells). Quotes are shown in their original language (Turkish translation if TR is selected, otherwise English/original).

## Architecture

```
src/
  app/                  expo-router routes (root: src/app)
    _layout.tsx         splash → onboarding/tabs gate, providers, notification listener
    onboarding.tsx      3 slides + permission
    quote/[id].tsx       quote opened via notification/widget tap
    (tabs)/             index (Home) · favorites · settings
  components/           QuoteCard, WobblyBorder, SketchButton, TimePicker, AdBanner, ...
  hooks/                useRandomQuote, useFavorites, useSettings, useNotifications, use-theme
  utils/                scheduler, quoteSelector, timeUtils, ads, share, storage
  data/                 quotes.json (1000) + gen/ (regional source chunks, build source)
  i18n/ · locales/      i18n-js, tr.json active + stub shells
  widgets/              Android widget (JSX) + task handler
index.js                custom entry: registers the widget task handler, then expo-router/entry
```

## Running it

> ⚠️ **Native features** (Android widget, AdMob, exact-alarm) **don't work in Expo Go** — a development build is required.
> Quotes, favorites, settings, and **local notifications** can be tested in Expo Go (ads/widget disabled).

### Quick test (Expo Go)
```bash
npm install
npm start            # scan the QR code with Expo Go on your phone
```

### Development build (recommended — all features)
```bash
npx expo prebuild -p android        # generates android/ (gitignored)
npx expo run:android                # installs on device/emulator
# or with EAS:
eas build --profile development --platform android
```

## Tests & verification

```bash
npm test                 # Jest (timeUtils, quoteSelector, quote data integrity)
npx tsc --noEmit         # type checking
npm run build:quotes     # rebuilds quotes.json from the gen/ chunks (1000)
```

## Going live (Android)

The app has already shipped to the Play Store (see [.claude/docs/TODO.md](.claude/docs/TODO.md) for what's still pending, e.g. the RevenueCat webhook deploy).

Full history and reference docs: [.claude/docs/](.claude/docs/) (build plan, backend/premium roadmap, Play Store publishing playbook).
