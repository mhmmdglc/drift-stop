# DriftStop — Build Plan (v1)

> Personal motivation app. No login, no account, no internet required.
> Sends hard/motivating quotes during the day via (local) push notifications.
> Aesthetic: "an old leather notebook, written in for 30 years, photographed by candlelight."

This file is the roadmap for **how we're building it**. Code follows this, phase by phase.
Every technical decision is based on **Expo SDK 56** (`docs.expo.dev/versions/v56.0.0`).

---

## ✅ STATUS (as of last update)

| Phase | Status |
|---|---|
| 0 — Scaffolding & cleanup | ✅ Done |
| 1 — Design system & Home | ✅ Done |
| 2 — 1000 quotes + favorites + sharing | ✅ Done |
| 3 — Notifications + Settings + Splash + Onboarding | ✅ Done |
| 4 — Prebuild (native build verified) | ✅ Done |
| 5 — AdMob (test IDs) | ✅ Done |
| 6 — Android Widget (JSX + task handler) | ✅ Done |
| 7 — Polish + EAS/README + go-live prep | ✅ Done (real IDs/assets came from the user) |
| 8 — iOS (post-launch) | ⏸ On hold |

**Verification:** `tsc --noEmit` clean · `jest` 23/23 passing · `expo export -p android` clean bundle · `expo prebuild -p android` produces native config (widget + AdMob + notification permissions) without errors.

**Note:** the "remaining (user input)" checklist that used to live here (real AdMob IDs, `google-services.json`, privacy/store links, app icon/splash, EAS production build → Play) has since been completed — the app has already shipped to the Play Store. See [TODO.md](TODO.md) for what's actually still pending.

---

## 0. Starting point (repo)

- A fresh Expo **SDK 56** template was installed (`expo-router`, TS strict, React 19, Reanimated 4, RN 0.85).
- Only the default demo screens exist: `src/app/index.tsx`, `src/app/explore.tsx`.
- The expo-router root in this project is **`src/app`** (not `/app` as in some specs). All planned routes go under `src/app/...`.

---

## 1. CRITICAL FACTS (read this first)

The original spec said "latest Expo SDK" but the project is pinned to **56**. Everything is pinned to 56.
The following directly affect how the spec plays out:

| Topic | Reality (SDK 56) | Impact |
|---|---|---|
| **Local notifications** | Work in Expo Go (iOS+Android), `scheduleNotificationAsync` unrestricted | Early development phase can be tested in Expo Go |
| **Remote/push** | Not available in Expo Go on Android since SDK 53 | Doesn't matter — we use **local** only |
| **Android Widget** (`react-native-android-widget`) | Native code → **doesn't work** in Expo Go | `expo prebuild` + **development build** required |
| **AdMob** (`react-native-google-mobile-ads`) | Native code + config plugin → **doesn't work** in Expo Go | Dev build required |
| **Custom Kotlin widget module** | Native → **doesn't work** in Expo Go | Dev build required |
| **iOS widget** | `react-native-android-widget` is Android-**only** | No iOS home-screen widget via this package (needs WidgetKit/Swift) → **out of scope / later phase** |
| **expo-background-fetch** | Deprecated since SDK 53 → `expo-background-task` | Already **optional** for us (explained below) |
| **Android exact alarm** | `SCHEDULE_EXACT_ALARM` + `RECEIVE_BOOT_COMPLETED` permissions | Added to the app.json plugin config |

### Result: development flow
1. **Phases 1–2** (UI, quotes, navigation, local notifications) → can be tested quickly in **Expo Go**.
2. **Phase 5+** (widget + AdMob) → `npx expo prebuild` generates `android/`, tested with a **development build** (device/emulator). Expo Go is dropped from here on.

> ⚠️ This means the app will not be "runs entirely in Expo Go." The moment widget + ads are needed, we move to a **bare/dev build**. That's a requirement of the spec, not a surprise.

---

## 2. THE BIGGEST SINGLE ITEM: 1000 quotes

`src/data/quotes.json` — 1000 real quotes, every one with `textTr` filled in. This is the **single largest piece** of the project.

- Distribution (per spec): Islamic & Eastern 150, Roman/Greek 100, Japan/Samurai 120, Chinese 100, Turkish folk 60, US 100, European 80, Indian 80, African 60, Latin American 40, Misc 10 = **1000**.
- Tone rules are **hard**: 1–2 sentences, a punch to the chest, "not a hug." No Pinterest/toxic-positivity.
- **Approach:** generated in **batches** by category/region (e.g. 50–100 at a time), `id` sequential 1–1000, schema-validated. Not all at once — each batch checked against the schema.
- **Honest note:** getting all 1000 quotes exactly historically attributed with a quality Turkish translation is serious work. I'll do my own attribution check; we can review together afterward if you want. No placeholders will be used.

`quotes.schema` (per record):
```
id:number · text:string · textTr:string · author:string · origin:string
originEmoji:string · category:enum(8) · era:enum(4)
```

---

## 3. ARCHITECTURE & FILE LAYOUT (adapted to this project)

```
src/
  app/                         ← expo-router root (src/app in THIS project)
    _layout.tsx                ← root stack: splash → onboarding|tabs, font loading, i18n, theme, notification listener
    splash.tsx                 ← SVG brush-stroke animation (2.2s)
    onboarding.tsx              ← 3 slides + permission (first launch)
    (tabs)/
      _layout.tsx              ← tab bar (Home / Favorites / Settings)
      index.tsx                ← HomeScreen
      favorites.tsx            ← FavoritesScreen
      settings.tsx             ← SettingsScreen
    quote/[id].tsx              ← QuoteDetailScreen (opened by tapping a notification)
  components/
    QuoteCard.tsx  AdBanner.tsx  CategoryBadge.tsx  OriginBadge.tsx
    TimePicker.tsx  WobblyBorder.tsx  SketchButton.tsx  PaperBackground.tsx
  hooks/
    useRandomQuote.ts  useNotifications.ts  useFavorites.ts  useSettings.ts
  utils/
    scheduler.ts       ← notification scheduling (random, min 90 min gap)
    quoteSelector.ts   ← random selection + "no immediate repeats" + daily seen list
    timeUtils.ts       ← active-hours calculations
  constants/
    colors.ts  fonts.ts  adUnits.ts
  data/
    quotes.json        ← 1000 quotes
  locales/
    tr.json (active)  en.json  ar.json  de.json  fr.json  ja.json (shell)
  i18n/
    index.ts  useTranslation.ts

android/  (generated AFTER prebuild — Phase 5)
  app/src/main/java/.../widget/{DriftStopWidgetProvider.kt, WidgetDataManager.kt}
  app/src/main/res/layout/driftstop_widget.xml
  app/src/main/res/xml/driftstop_widget_info.xml
```

> Note: the spec's example demo files (`explore.tsx`, etc.) get cleaned up in the first phase.

---

## 4. SCHEDULING ALGORITHM (core)

`utils/scheduler.ts`:
- Active-hours window (default 09:00–21:00), N notifications per day (3/5/7/10).
- Pick N timestamps **randomly** within the window; **min 90 min** apart.
- Sort → assign each a "no immediate repeat" random `quoteId` → `scheduleNotificationAsync`.
- Reschedule every night (00:00) for the next day; also reschedule immediately **on app launch** if today has no plan yet (covers the phone-restart scenario).
- AsyncStorage: `lastScheduledDate`, `scheduledQuoteIds[]`, `seenToday[]`.
- For "night scheduling," `expo-background-task` (replacing the deprecated `background-fetch`) is optional in Phase 5; but since OS notifications are pre-scheduled, **app-open reschedule** alone is a sufficient fallback.

---

## 5. PHASES (build order)

Each phase produces a **working, testable** output. I'll proceed phase by phase with your sign-off.

**Phase 0 — Scaffolding & cleanup**
Clean up the template demo screens, set up folder structure, add theme/color/font constants, i18n (`tr.json` full, others as shells), `PaperBackground` (grain + notebook lines + margin).
→ Test: Expo Go.

**Phase 1 — Design system & Home (static quote)**
Fonts (Caveat/Kalam/Architects Daughter), `WobblyBorder`, `SketchButton`, thin Phosphor icons, `QuoteCard`, `CategoryBadge`, `OriginBadge`. HomeScreen with a single quote + swipe/fade animation (Reanimated). Quote transitions.
→ Test: Expo Go.

**Phase 2 — Quote database + selection + Favorites + Share**
`quotes.json` (built up to 1000 in batches), `quoteSelector`, `useRandomQuote`, `useFavorites` (AsyncStorage), Favorites screen, sharing via `expo-sharing`.
→ Test: Expo Go.

**Phase 3 — Notifications (local) + Settings + Splash + Onboarding**
`expo-notifications` setup (handler, permission, Android channel `driftstop_motivation`), `scheduler.ts`, Settings (frequency, active-hours picker, weekend/master toggle, theme, language picker), Splash animation, 3-slide Onboarding + permission, first-launch flow, `quote/[id]` (tap a notification → that quote).
→ Test: Expo Go (local notifications work in Go). Android exact-alarm permissions added.

**Phase 4 — Moving to prebuild**
`app.json` plugin configs (expo-notifications icon/color/channel, permissions), `npx expo prebuild`, development build setup (iOS/Android). From here on, testing uses a **dev build**.
→ Test: Development build.

**Phase 5 — AdMob**
`react-native-google-mobile-ads` + config plugin, **TEST** ad unit IDs (`constants/adUnits.ts`). Bottom banner on HomeScreen; interstitial every 5 swipes; NO interstitial on first launch or when arriving from a notification; preload after showing one.
→ Test: Development build.

**Phase 6 — Android Widget (native)**
`react-native-android-widget` + custom Kotlin: `DriftStopWidgetProvider.kt`, `WidgetDataManager.kt`, `driftstop_widget.xml`, `driftstop_widget_info.xml`, AndroidManifest registration. Notification delivery → BroadcastReceiver → `quoteId` into SharedPreferences → `updateAppWidget`. In-app swipe → update widget. Fallback default quote.
→ Test: Android development build (widget is Android-only).

**Phase 7 — Polish & Android go-live**
Animation fine-tuning (ink-stamp, page-flip), empty states, error states, badge counter (optional), real AdMob IDs (once provided), privacy/rate links, icons. → **Google Play publishing** (checklist below).

**Phase 8 — iOS (POST-LAUNCH)**
Once Android is live: iOS dev build, App Store publishing, and iOS widget (WidgetKit/Swift + App Groups). This phase is on hold for now.

---

## 5.1 GO-LIVE (Android) checklist

Things to close out in Phase 7 before shipping to Google Play:

- [x] **Real AdMob** App ID + Ad Unit IDs (test IDs removed)
- [x] **App icon / adaptive icon / splash** finalized
- [x] **Privacy policy** URL (required by Play since AdMob collects data)
- [x] **Notification permissions** (`SCHEDULE_EXACT_ALARM`, `RECEIVE_BOOT_COMPLETED`) tested
- [x] **versionCode / version** set, `app.json` package name (`com.driftstop.app`)
- [x] **EAS Build** (production AAB) + Play Console listing
- [x] Verified on a real device: notification flow, widget updates, ad display

(This checklist is historical — all items above are done; see [TODO.md](TODO.md) for anything currently outstanding.)

---

## 6. PACKAGE LIST (by phase)

- **Early:** `react-native-svg`, `@expo-google-fonts/caveat`, `@expo-google-fonts/kalam`, `@expo-google-fonts/architects-daughter`, `phosphor-react-native`, `i18n-js`, `expo-localization`, `date-fns`, `@react-native-async-storage/async-storage`, `expo-haptics`, `expo-sharing`. (expo-font/router/reanimated already present.)
- **Phase 3:** `expo-notifications`.
- **Phase 5:** `react-native-google-mobile-ads`.
- **Phase 6:** `react-native-android-widget` (+ `expo-background-task` optional).

All installed via `npx expo install` at SDK-56-compatible versions.

---

## 7. DECISIONS (locked in)

> Strategy: **finish Android end-to-end first → ship it → then look at iOS.**

1. **iOS widget:** ✅ **Deferred to post-launch** (Phase 8). At launch, iOS users get the app + notifications, no widget.
2. **Development/release priority:** ✅ **Android.** Dev build and store release go to Android first.
3. **1000 quotes:** ✅ No source provided → **generated in batches** (schema-validated).
4. **AdMob:** ✅ **TEST IDs** during development. Real App ID/Ad Units are a **go-live requirement** (checklist above).
5. **Language:** ✅ Only **Turkish active** at launch, the rest are shells.

---

## 8. RISKS

- **1000 quality quotes** = the biggest time/quality risk (attribution accuracy, tone consistency).
- **Native transition** (prebuild) means dropping Expo Go; iteration slows down a bit (build time).
- **AdMob/Widget** native config errors can be device-dependent; testing on a real device is required.
- **Hand-drawn (wobbly SVG) aesthetic** consistency: standardized via reusable components (WobblyBorder/SketchButton).
