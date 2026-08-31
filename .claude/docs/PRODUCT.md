# DriftStop — Product Reference

Authoritative, code-grounded description of what the app actually does. Written so product questions can be
answered from here instead of reading source. Every claim cites a file (and line where useful). If code and
this doc diverge, the code wins — and the divergence should be fixed here.

Stack: React Native / Expo SDK 56, expo-router, TypeScript. Android is the shipped platform
(`app.json` versionCode 11 / version 1.0.1); iOS builds exist but with purchases disabled and no widget.

---

## Table of contents

1. [What DriftStop is](#1-what-driftstop-is)
2. [Screens & navigation](#2-screens--navigation)
3. [The core notification loop](#3-the-core-notification-loop)
4. [Content catalog](#4-content-catalog)
5. [Quote text localization reality](#5-quote-text-localization-reality)
6. [Accounts](#6-accounts)
7. [Monetization model](#7-monetization-model)
8. [Known product gaps](#8-known-product-gaps)
9. [⚠️ Discrepancies found](#9-️-discrepancies-found)

---

## 1. What DriftStop is

DriftStop is an anti-drift motivation app built around **scheduled local notifications, not a feed**. The user
picks interest themes, a daily notification count, and a time window; the app then schedules that many
notifications per day at randomized times inside the window, each carrying one quote. The app itself never
generates a new quote on demand — the Home screen shows only quotes the user has *already been sent*
(`src/hooks/useHistory.tsx:36-39`, and the on-screen copy "The next one comes when it's time. Be patient."
`src/locales/en.json:36`). There is deliberately **no "Next" button** on Home
(`src/app/(tabs)/index.tsx:132` comment).

Target user: someone who wants intermittent, unpredictable interruptions with hard-edged quotes (resilience,
discipline, reckoning, legacy) rather than a daily-quote app they must open. Onboarding copy frames it as
"These words aren't for you. They're for the you about to quit." (`src/locales/en.json:15`).

Core loop:

1. Notification fires at a random in-window time carrying a quote (`src/utils/scheduler.ts:117-131`).
2. Tapping it deep-links to `/quote/[id]` (`src/hooks/useNotifications.ts:42-47`).
3. That quote is recorded into local history (`src/hooks/useHistory.tsx:87-94`, `src/utils/scheduler.ts:145-186`).
4. Home shows the newest history entry; the user can swipe back through older ones or pull a random one
   (`src/app/(tabs)/index.tsx:85-92`).
5. Favorite / share (`src/components/QuoteCard.tsx:71-89`, `src/utils/share.ts`).
6. The Android home-screen widget mirrors the most recent history quote (`src/widgets/widget-task-handler.tsx:25-33`).

---

## 2. Screens & navigation

Routing is **expo-router** file-based. Root stack in `src/app/_layout.tsx:78-87`, all with `headerShown: false`.
The three main screens live in a `(tabs)` group with a fully custom hand-drawn tab bar
(`src/app/(tabs)/_layout.tsx:82-113` — the default tab bar is replaced by `SketchTabBar`).

| Route | File | What it does | How you reach it |
|---|---|---|---|
| `/` (tab: index) | `src/app/(tabs)/index.tsx` | Home. Renders the current history quote as a `QuoteCard`, favorite + share actions, "Previous"/"Random from history" buttons, horizontal swipe gestures (left = random, right = older), patience line, ad banner. Updates the Android widget on every quote change (`:51`). | Default screen after onboarding |
| `/favorites` (tab) | `src/app/(tabs)/favorites.tsx` | Flat list of favorited quotes; tap → quote detail, long-press → remove (confirm dialog). Resolves IDs via `lookupQuoteAnySource` so **premium pack quotes do appear here** while the user is entitled; once entitlement ends the premium row stays in the list as a **locked** row (`🔒 favorites.lockedPremium`) instead of vanishing, and free favourites are untouched. While entitlement is still resolving those rows show `common.loading` rather than a lock (a Pro user must never be shown a lock that is about to disappear), and the list re-reads itself when a restore lands seconds after a purchase. | Tab bar |
| `/settings` (tab) | `src/app/(tabs)/settings.tsx` | Account section (top), Pro card, packs link, notification master toggle + frequency, schedule window + weekend toggle, theme mode, language, interest themes, about (version / rate / privacy). | Tab bar, or gear icon on Home (`index.tsx:112`) |
| `/onboarding` | `src/app/onboarding.tsx` | 4 steps: 3 informational slides + interest-theme picker. "Start" requests notification permission, saves themes (which triggers scheduling), marks onboarding complete, replaces to `/` (`:43-48`). Skippable to the last step. | Auto-redirect on first launch when `driftstop:onboardingComplete` is false (`_layout.tsx:64-73`) |
| `/quote/[id]` | `src/app/quote/[id].tsx` | Single-quote detail with favorite/share. Records the quote into history **unless it is premium** (`:41-43`). A premium quote without entitlement shows a locked state (`quote.lockedTitle`/`lockedBody` + "Go Pro") — and `common.loading` while entitlement is still resolving; `errors.noQuotes` only when the ID resolves to nothing at all. | Notification tap, widget tap (`driftstop://quote/<id>`, `src/widgets/DriftStopWidget.tsx:41`), favorites row, pack/author row |
| `/wallpaper/[id]` | `src/app/wallpaper/[id].tsx` | Turns a quote into a phone background. Live preview (`WallpaperCanvas`) over five code-drawn backdrops (`src/constants/wallpapers.ts`), then **Save to photos** or **Share**. Saving asks for **write-only** media-library permission and drops a `DriftStop-wallpaper*.png` into the gallery; sharing needs no permission. Resolves the quote through `lookupQuoteAnySource`, so a premium quote shows the locked/`errors.noQuotes` state instead of leaking content. Export is 1080×2340 — the size passed to `captureRef` is platform-dependent (points on iOS, raw pixels on Android — see `src/utils/wallpaper.ts`). | Wallpaper icon on the quote card, on Home (`(tabs)/index.tsx:130`) and on quote detail (`quote/[id].tsx:78`) |
| `/auth` | `src/app/auth.tsx` | Email + password sign-in / sign-up toggle, client-side validation (email regex, password ≥ 6), inline errors, always skippable. | Settings → Account → "Sign in / Create account" (`settings.tsx:127`) |
| `/paywall` | `src/app/paywall.tsx` | Lists RevenueCat offering packages with real store prices; purchase + restore; graceful states for not-configured / loading / empty offering / already entitled. | 5 entry points — see [§7](#paywall-entry-points) |
| `/packs` | `src/app/packs/index.tsx` | Premium catalog browser: "Collections" (packs) + "Authors" sections, each row with a 🔒 badge when locked and a public quote count. | Settings → "Explore content packs" (`settings.tsx:157`), only rendered when `purchasesConfigured` |
| `/packs/[id]` | `src/app/packs/[id].tsx` | Pack detail. If locked → lock screen + "Go Pro" → paywall. If unlocked → quote list from local SQLite cache; empty list shows "Syncing quotes…". | Packs list row |
| `/packs/author/[name]` | `src/app/packs/author/[name].tsx` | Same as pack detail but grouped by author across packs (`getAuthorQuotes`). Author name is URL-encoded. | Packs list Authors row |

Not a route, but user-facing surfaces:

- **Android home-screen widget** "DriftStop" — declared in `app.json` under the `react-native-android-widget`
  plugin (250×110dp, `updatePeriodMillis` 1 800 000 = 30 min). Rendered by `src/widgets/DriftStopWidget.tsx`;
  hard-coded to `DarkColors` because the theme hook is unavailable in the headless native render (`:23-26`).
- **Splash overlay** (`SplashOverlay`) gates the boot flow until `splashDone` (`_layout.tsx:88`).
- **ErrorBoundary** wraps the whole tree (`_layout.tsx:113`).

Provider nesting (matters for what depends on what):
`ErrorBoundary → GestureHandlerRootView → SafeAreaProvider → SettingsProvider → ThemeProvider → AuthProvider → PurchasesProvider → HistoryProvider → AppShell` (`_layout.tsx:112-130`).

---

## 3. The core notification loop

All of this is **100 % local**. There is no push server, no FCM/APNs payload, no server-side scheduling.
Notifications are `expo-notifications` one-shot DATE triggers created on-device
(`src/utils/scheduler.ts:125-129`). Supabase is never involved in delivery.

### Scheduling parameters

| Parameter | Value | Source |
|---|---|---|
| Days scheduled ahead | 3 (`DAYS_AHEAD`) | `scheduler.ts:22` |
| Minimum gap between two notifications on a day | 90 minutes (`MIN_GAP`) | `scheduler.ts:23` |
| Frequency options | 3, 5, 7, 10 per day | `src/types/settings.ts:6` |
| Default frequency | 5 | `settings.ts:34` |
| Default window | 09:00 – 21:00 | `settings.ts:32-36` |
| Minimum window length | 120 minutes (`MIN_WINDOW_MINUTES`) | `settings.ts:44` |
| Weekend skip | `disableWeekends`, default false | `settings.ts:37`, applied at `scheduler.ts:104` |
| History cap | 200 IDs | `scheduler.ts:24`, `useHistory.tsx:19` |
| Android channel | `driftstop_motivation`, HIGH importance, vibration, badge, light `#C8923A` | `scheduler.ts:21,30-42` |
| Android permissions | `RECEIVE_BOOT_COMPLETED`, `SCHEDULE_EXACT_ALARM` | `app.json` |

Upper bound on outstanding scheduled notifications: 10/day × 3 days = 30 (fewer if weekends are skipped or
times already passed).

### `applySchedule(settings)` — `scheduler.ts:82-137`

1. Bails out entirely when `nativeFeaturesAvailable` is false (Expo Go — `src/utils/runtime.ts:11`).
2. Cancels **all** scheduled notifications first (`cancelAll`), so scheduling is always a full rebuild, never
   incremental.
3. If `notificationsEnabled` is false → clears `scheduledQuoteIds` + `lastScheduledDate` and returns.
4. Validates the window (`isValidWindow`: `end − start ≥ 120 min`). Invalid → returns without scheduling.
   The Settings UI blocks this earlier with `settings.schedule.timeRangeError` (`settings.tsx:64-71`).
5. Builds the quote pool once: `getQuotesByThemes(settings.themes)` — **static array only**
   (`src/data/quotes.ts:19-24`). Empty theme selection or a selection matching nothing → all 1000 quotes.
6. For each of the next 3 days (today included): skip weekends when `disableWeekends`; generate `frequency`
   random minute-of-day values via `generateRandomTimes(start, end, frequency, 90)`.
7. Skip any fire time that is in the past or within the next 60 s (`scheduler.ts:109`).
8. Pick a quote with `pickQuoteId(pool, prevId)` — uniform random, with the single rule that it must not equal
   the immediately previous pick (`scheduler.ts:63-71`). It is **not** de-duplicated against the user's history,
   so quotes can repeat across days.
9. Notification content: random title from the 8-item `notifications.titles` array
   (`en.json:140-149`), body = `quoteDisplayText(quote, i18n.locale)`, subtitle = `author · origin` localized,
   `data: { quoteId }`. Sound is deliberately unspecified so the channel default is used — passing `'default'`
   made Expo look for a custom sound file (`scheduler.ts:123` comment).
10. Persists the plan as `[{ id, at }]` in `driftstop:scheduledQuoteIds` and today's date key in
    `driftstop:lastScheduledDate` (AsyncStorage — `src/utils/storage.ts:4-14`).

`generateRandomTimes` (`src/utils/timeUtils.ts:35-74`) shrinks the gap to fit narrow windows
(`gap = min(90, floor(span/(count−1)))`), halves it after repeated failures, and finally fills with any unique
random minute. So a 2-hour window with 10/day yields clustered times rather than failing.

### What re-triggers scheduling

- Any change to `notificationsEnabled`, `frequency`, `startHour/Minute`, `endHour/Minute`, `disableWeekends`,
  `language`, or `themes` → `applySchedule` immediately (`src/hooks/useSettings.tsx:36-46,75-80`). `language`
  is in that list because notification bodies/titles are baked in at schedule time.
- App boot, after splash + settings load + onboarding check: `ensurePermissions()` then
  `rescheduleIfNeeded(settings)` (`_layout.tsx:71`).
- `rescheduleIfNeeded` (`scheduler.ts:189-205`) reschedules when the stored `lastScheduledDate` is not today, or
  when the stored plan is in the legacy `number[]` format (pre-`{id,at}` migration).
- Theme-mode / language changes go through the same `update()`; changing `themeMode` alone does not reschedule.

### How delivery becomes history

Three independent paths write to `driftstop:seenHistory` (newest at index 0, cap 200):

| Path | When | Code |
|---|---|---|
| Foreground listener | Notification arrives while app is open | `_layout.tsx:55-62` → `record(id)` |
| `syncDeliveredToHistory()` | On `HistoryProvider` mount and on every `AppState → active` | `useHistory.tsx:46-85` → `scheduler.ts:145-186` |
| Quote detail screen | User opens `/quote/[id]` (non-premium only) | `quote/[id].tsx:33-35` |

`syncDeliveredToHistory` reconciles two sources: notifications still sitting in the tray
(`getPresentedNotificationsAsync`) and stored plan entries whose `at` has passed — the latter covers
notifications the user dismissed. Passed entries are pruned from `scheduledQuoteIds` so they aren't
re-recorded. This is why "all quotes sent today" appear in-app even if the user never tapped them
(`scheduler.ts:139-144` comment).

First launch seeds exactly **one** starter quote into history from the selected themes
(`useHistory.tsx:54-59`), so Home is never blank while the user waits for the first notification.

Home resolves the current history ID with `getQuoteById` — the **static array only**
(`useHistory.tsx:106`). See [§4](#4-content-catalog) for why that matters.

---

## 4. Content catalog

Two entirely separate content tiers with a deliberate boundary between them.

| | Free catalog | Premium packs |
|---|---|---|
| Count | **1000 quotes**, ids 1–1000 | **3325 quotes across 18 packs** (`scripts/seed-packs.js`) |
| Storage | Static `src/data/quotes.json`, bundled; exposed via `src/data/quotes.ts` | Supabase `quotes` table (`is_premium = true`, `pack_id` set) → local SQLite `driftstop.db` cache, **purged when entitlement ends and re-downloaded when it returns** (`src/services/premiumCacheGuard.ts`) |
| Read path | `getQuoteById` / `getQuotesByThemes` (`data/quotes.ts:11-24`) | `getCachedQuoteById` / `getCachedQuotesByPackId` / `getCachedQuotesByAuthor` (`src/db/quotesCache.ts:178-205`) |
| Bridge helper | — | `lookupQuoteAnySource`, `getPackQuotes`, `getAuthorQuotes` (`src/data/quotesAnySource.ts`) — each requires `{ entitled }` |
| Works offline / with no backend | Yes, always | Only what has already synced; all sync no-ops when `supabase` is null (`src/lib/supabase.ts:12-22`) |
| Requires entitlement | No | Yes — RLS `quotes_premium_read_entitled` checks `profiles.is_premium` (`supabase/migrations/0001_init_schema.sql:86-95`) |

Pack sizes (from `scripts/seed-packs.js`, `sortOrder` 0–17): stoics 56, ancient-greece 56, eastern-wisdom 109,
modern-philosophy 86, literature-poetry 64, historical-figures 80, renaissance-enlightenment 255,
german-idealism 89, anglo-american-literature 100, romantic-poets 82, classical-epics 93,
eastern-poets-sages 91, african-proverbs 327, asian-proverbs 441, middle-eastern-proverbs 490,
nw-european-proverbs 320, se-european-proverbs 487, americas-proverbs 99. Premium quote IDs start at 100001,
which is why they never collide with the 1–1000 free range.

### Sync services (all fire-and-forget from boot, `_layout.tsx:48-50`)

| Service | What it pulls | Notes |
|---|---|---|
| `syncQuotes()` (`src/services/quotesSync.ts`) | `quotes` rows with `updated_at >` last sync, paged 500 | Seeds the SQLite cache from the bundled 1000 first (`seedIfEmpty`), then delta-syncs. Premium rows only arrive if RLS allows, i.e. `profiles.is_premium` is true |
| `syncPacks()` (`src/services/packsSync.ts`) | Whole `quote_packs` table (public read) | Full upsert, no delta — table is small. Gives free users pack names, descriptions, and `quote_count` |
| `syncAuthorCounts()` (`src/services/authorsSync.ts`) | `get_premium_author_counts()` RPC | Public `SECURITY DEFINER` RPC so free/guest users can see the Authors section (locked) without exposing quote text |

Every one of these swallows errors silently; the free experience never depends on them.

### Which screens can read premium content

| Screen | Reads premium? | Mechanism |
|---|---|---|
| `/packs`, `/packs/[id]`, `/packs/author/[name]` | Yes (metadata always; bodies only when unlocked) | `usePacks` + `getPackQuotes` / `getAuthorQuotes` |
| `/favorites` | Yes, while entitled | `lookupQuoteAnySource`; locked row after entitlement ends, loading row while entitlement is unresolved |
| `/quote/[id]` | Yes (display) while entitled, but does **not** record premium into history | `lookupQuoteAnySource` (`quote/[id].tsx:34`), history guard at `:42` |
| Home `/` | **No** | `useHistory` → `getQuoteById` (static only) |
| Notification scheduler | **No** | `getQuotesByThemes` (static only) |
| Android widget | **No** | `getQuoteById` / `QUOTES` (`widget-task-handler.tsx:3`, `updateWidget.tsx:4`) |

### ⚠️ IMPORTANT limitation

**The notification rotation, the Android widget, and the Home screen use ONLY the static 1000 free quotes.**
Buying Pro does not put a single premium quote into a notification, the widget, or the Home rotation. This is
an explicit product decision, documented twice in code: "Ana akışlar (Home/widget/bildirim) bilinçli olarak bu
fonksiyonu KULLANMIYOR" (`src/data/quotesAnySource.ts:9-11`) and in `.claude/docs/backend-roadmap.md`
Phase 4 notes — "premium content never mixes into the main rotation … packs are browsed separately."

The consequence chain is worth stating plainly:

- Premium packs are a **browse-only** surface. Pro value on the notification side is quantity (7/10 per day),
  not content.
- Because Home cannot resolve premium IDs, recording a premium quote into history would render a blank card —
  hence the explicit exclusion in `quote/[id].tsx:33-35` (a bug that was fixed, see TODO.md).
- A user can favorite a premium quote and see it in Favorites, but that quote will never surface on Home.

---

## 5. Quote text localization reality

**UI chrome: 6 active languages. Quote bodies: 2 languages.**

- `src/i18n/index.ts:16-25` registers 8 locales; `tr`, `en`, `es`, `de`, `fr`, `it` are `available: true`;
  `ar` and `ja` are listed in the language picker but marked "Coming soon" and are unselectable
  (`settings.tsx:268-293`). All 8 JSON files exist in `src/locales/`.
- Quote *bodies* have exactly two fields: `text` (English) and `textTr` (Turkish) — `src/types/quote.ts:37-40`.
  All 1000 free quotes have both populated (verified: 1000/1000 have non-empty `textTr`).
- Selection logic is one line, `src/utils/quoteText.ts:4-6`:
  `return locale.startsWith('tr') && quote.textTr ? quote.textTr : quote.text;`

**Therefore: users on Español, Deutsch, Français, or Italiano read every quote body in English.** Only the
surrounding UI is in their language. This applies to notification bodies (`scheduler.ts:116`), the Home card
(`QuoteCard.tsx:35`), favorites rows, pack lists, share text (`share.ts:15`), and the widget
(`DriftStopWidget.tsx:33`) — all funnel through the same helper.

Partial mitigation: author labels and origins *are* localized into all 5 non-Turkish available languages via
lookup tables — `AUTHOR_LABEL_L10N` (~120 entries, proverb/tradition labels like "Türk Atasözü" → "Turkish
Proverb") and `ORIGIN_L10N` (~60 country/region names) in `src/i18n/quoteLocalization.ts`. Real personal names
(Marcus Aurelius, Nietzsche) are not in the tables and pass through unchanged, which is correct.

Pack names and descriptions are `tr`/`en` only (`scripts/seed-packs.js`, e.g. `name: { tr: 'Stoacılar', en: 'The Stoics' }`).
`localizedPackField` (`src/types/quotePack.ts:15-22`) falls back `locale → tr → en → first value`, so an
`es`/`de`/`fr`/`it` user sees **Turkish** pack names, not English — the fallback order puts `tr` first.

Default language: device locale if it is one of the 6 available, otherwise **Turkish**
(`useSettings.tsx:17-22`, `DEFAULT_SETTINGS.language = 'tr'` at `settings.ts:39`). An English-locale device gets
English; a Portuguese-locale device gets Turkish.

---

## 6. Accounts

**Guest-first, and guest is fully functional.** Nothing in the free loop requires an account:
notifications, history, favorites, settings, themes, the widget, and ads all work with no Supabase client at
all. `src/lib/supabase.ts:12-22` returns `null` when `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`
are missing, and `useAuth` reports `configured: false`, which hides the whole Account section
(`settings.tsx:97`).

What auth actually supports (`src/hooks/useAuth.tsx`):

| Capability | Status |
|---|---|
| Email + password sign-up | Yes (`:66`), Supabase requires email confirmation → `auth.signUpSuccess` tells the user to check their inbox |
| Email + password sign-in | Yes (`:71`) |
| Sign out (with confirm dialog) | Yes (`:76`, `settings.tsx:43-48`) |
| Account deletion | Yes — invokes the `delete-account` Supabase Edge Function (service-role, verifies the caller's own JWT), then signs out (`:80-83`, `settings.tsx:57-62`) |
| Google / Apple sign-in | **No.** Not implemented anywhere. See [§8](#8-known-product-gaps) |
| Password reset | **No.** No reset flow, no "forgot password" link in `auth.tsx` |
| Error mapping | 6 mapped cases + generic (`:23-31`): emailInUse, emailNotConfirmed, invalidCredentials, weakPassword, rateLimited, network |

### What an account actually gives you today

Exactly two things:

1. **RevenueCat identity linkage.** `usePurchases` calls `Purchases.logIn(user.id)` / `logOut()` so the
   RevenueCat app-user-id equals the Supabase user id (`usePurchases.tsx:84-100`). Without it RevenueCat uses
   an anonymous id and the `revenuecat-webhook` Edge Function cannot find the right `profiles` row to set
   `is_premium`.
2. **Premium quote-body access.** The `quotes_premium_read_entitled` RLS policy joins on
   `auth.uid()` → `profiles.is_premium`, so premium quote *text* can only sync for a signed-in, premium user.
   (Pack/author *metadata* and the lock/unlock UI state come from RevenueCat client-side and work while a guest.)

### Sync: claimed but NOT implemented

The UI promises cross-device sync in three places:

- `settings.account.guestHint` — "Create an account to sync favorites and settings across devices." (`en.json:126`)
- `auth.subtitle` — "Sync your favorites and settings across devices." (`en.json:193`)
- `settings.account.deleteAccountConfirmMessage` — "Everything tied to your account — favorites, reflections,
  and settings — will be deleted." (`en.json:124`)

**None of that sync exists in the client.** Verified by grep: no client code references the `favorites`,
`user_settings`, or `reflections` tables. The only Supabase calls in `src/` are `auth.*`,
`functions.invoke('delete-account')`, `from('quotes')`, `from('quote_packs')`, and
`rpc('get_premium_author_counts')`.

Where state actually lives today — all device-local AsyncStorage (`src/utils/storage.ts:4-14`):

| Data | Key | Synced? |
|---|---|---|
| Favorites | `driftstop:favorites` (`useFavorites.ts`) | No |
| Settings | `driftstop:settings` (`useSettings.tsx`) | No |
| Seen history | `driftstop:seenHistory` (`useHistory.tsx`) | No |
| Onboarding flag | `driftstop:onboardingComplete` | No |
| Schedule state | `driftstop:lastScheduledDate`, `driftstop:scheduledQuoteIds` | No |
| Widget quote | `driftstop:widgetQuoteId` | No |

The server tables (`favorites`, `user_settings`, `reflections`) exist with RLS from
`supabase/migrations/0001_init_schema.sql` and are simply unused. Cross-device sync is Phase 5 in
`.claude/docs/backend-roadmap.md` and listed as "Not started yet" in `.claude/docs/TODO.md:41`. The paywall is
honest about it — `paywall.packages.proFeatures` says "Sync (soon)" (`en.json:233`) — but the Account/auth copy
is not.

---

## 7. Monetization model

Three revenue mechanics: AdMob ads for free users, a Pro-gated notification frequency cap, and Pro-gated
premium packs. All purchase logic goes through RevenueCat (`react-native-purchases`); Google Play Billing is
mandatory for this content type, so no external payment path exists.

### Free vs Pro matrix

| Capability | Free / guest | `no_ads` only | Pro |
|---|---|---|---|
| 1000 free quotes, all themes | ✅ | ✅ | ✅ |
| Notifications 3 or 5 per day | ✅ | ✅ | ✅ |
| Notifications **7 or 10** per day | 🔒 lock badge → paywall | 🔒 | ✅ |
| Banner ad on Home | Shown | Hidden | Hidden |
| Interstitial ads | Yes | No | No |
| 18 premium packs / 3325 quotes | 🔒 metadata + counts only | 🔒 | ✅ unlocked |
| Authors section on `/packs` | 🔒 visible but locked | 🔒 | ✅ |
| Quote on the lock screen (Android) | ✅ | ✅ | ✅ |
| Favorites, history, widget, share, themes, 6-language UI | ✅ | ✅ | ✅ |
| Cross-device sync | ❌ not built for anyone | ❌ | ❌ |
| Premium quotes in notifications / widget / lock screen / Home | ❌ | ❌ | ❌ (by design, see §4) |

### Entitlements

`src/hooks/usePurchases.tsx:12-13`:

- `pro` → `isPro`. Gates frequency 7/10 and premium pack unlocking.
- `no_ads` → `isAdsRemoved`. Suppresses banner + interstitial.

Per `.claude/docs/backend-roadmap.md:112`, `pro_monthly` and `pro_yearly` are attached to **both** entitlements
(a Pro subscriber is automatically ad-free); `remove_ads` is attached to `no_ads` only. Note the client checks
them independently — `isPro` alone would not hide ads, which is why the product↔entitlement mapping in the
RevenueCat dashboard matters.

### Products and prices

Per `.claude/docs/backend-roadmap.md:113,117` — prices were confirmed by the product owner; the client never
hard-codes a price, it renders `pkg.product.priceString` from the store (`paywall.tsx:127`).

| Product id | Type | Price (as configured) | RevenueCat package type | Paywall label |
|---|---|---|---|---|
| `remove_ads` | One-time / non-consumable | $2.99 | `LIFETIME` | "Remove ads" + "One-time purchase" |
| `pro_monthly` | Subscription | **$3.99 / month** (TR ₺229.99) | `MONTHLY` | "Pro — Monthly" |
| `pro_yearly` | Subscription | **$35.99 / year** (TR ₺2,049.99) | `ANNUAL` | "Pro — Yearly" + "Best value" |

**Prices corrected 2026-07-31.** The live Play configuration was read through the Play Developer API and
`pro_monthly` turned out to be **$299.99/month** — a decimal-point slip when it was first entered, fifteen times
the annual price and never caught because the app has no users yet. Both base plans were rewritten across all
173 regions via `pricing:convertRegionPrices` + a `basePlans` PATCH (regionVersion 2025/03), preserving each
region's existing availability flags. Annual is priced as $2.99/month-equivalent rounded to a store-conventional
`.99`, i.e. a 25% discount over monthly — deliberately weaker than the 40–60% industry norm; the owner chose the
per-month framing over a rounder headline number. Turkey is **not** priced separately, so Turkish users see
₺229.99/month; this was raised as a conversion risk for the app's primary market and accepted.

Offering: `default`, 3 packages. All 3 are Active in Play Console and the RevenueCat ↔ Play service-account
link is verified (backend-roadmap Phase 3 notes). The label mapping is `packageLabel` in `paywall.tsx:16-27`;
any unexpected package type falls back to the raw store title. Per `TODO.md:7`, a real purchase on a real
device has **never been verified** — the Android emulator returns `BILLING_UNAVAILABLE`.

### Frequency cap

`FREE_FREQUENCY_MAX = 5` (`src/types/settings.ts:14`). Two enforcement points:

- **UI:** `settings.tsx:40-41` computes `proOnlyFrequencies = FREQUENCY_OPTIONS.filter(f => f > FREE_FREQUENCY_MAX)`
  when `purchasesConfigured && !isPro`. `FrequencySelector` renders those with a lock badge and routes taps to
  the paywall instead of changing the value (`FrequencySelector.tsx:32`), plus a hint line
  ("7 and 10 daily reminders are a Pro feature.").
- **State repair:** `useEnforceFreeLimits` (mounted in `_layout.tsx:38`) downgrades a stale `frequency > 5` back
  to 5 when the entitlement lapses. It deliberately no-ops while `loading` so a real Pro user isn't downgraded
  during boot, and no-ops entirely when `!configured`.

**Important:** every gate is `purchasesConfigured &&` — when RevenueCat has no key for the platform
(`src/lib/purchases.ts:15`: Expo Go, or iOS until `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` exists), the app runs
with **no gating at all**: no paywall, no Pro card, no lock badges, and 10/day is freely selectable
(`settings.ts:11-12` comment).

### Ads

`src/utils/ads.ts` + `src/components/AdBanner.tsx` + `src/constants/adUnits.ts`:

- Disabled entirely in Expo Go (`adsEnabled = Constants.appOwnership !== 'expo'`).
- Banner: `ANCHORED_ADAPTIVE_BANNER`, non-personalized requests only, rendered at the bottom of Home only
  (`index.tsx:151`). Returns `null` when ads are disabled or `isAdsRemoved`.
- Interstitial: attempted every 12th Home navigation (`INTERSTITIAL_EVERY = 12`, `adUnits.ts:30`; counter in
  `index.tsx:64-70`) **and** at most once per 4 minutes (`MIN_INTERSTITIAL_GAP_MS`, `ads.ts:13`). `initAds()`
  sets `lastShownAt = Date.now()` at boot, so the first minutes of a session are ad-free (`ads.ts:48`).
- Real Android unit ids are populated; iOS ids are empty strings, and in `__DEV__` Google's `TestIds` are used
  regardless (`adUnits.ts:18-27`).
- `setAdsSuppressed` is pushed from `usePurchases` whenever `isAdsRemoved` changes (`usePurchases.tsx:104-106`),
  covering the module-level interstitial path that can't read React state.

### Paywall entry points

| # | Entry point | Code |
|---|---|---|
| 1 | Settings → "DriftStop Pro" benefits card (shown whenever `purchasesConfigured && !isPro`) | `settings.tsx:138-155` |
| 2 | Settings → tapping locked frequency 7 or 10 | `settings.tsx:187` via `FrequencySelector.tsx:32` |
| 3 | Home → "Remove ads ✕" link directly above the banner | `AdBanner.tsx:22-31` |
| 4 | Pack detail → locked state "Go Pro" button | `packs/[id].tsx:77` |
| 5 | Author detail → locked state "Go Pro" button | `packs/author/[name].tsx:72` |

There is no paywall in onboarding and no forced/timed paywall anywhere — every surface is user-initiated, and
the paywall itself is dismissible ("Maybe later", `paywall.tsx:70-74`).

---

## 8. Known product gaps

**Auth**

- **No Google or Apple social sign-in.** Email + password only (`useAuth.tsx:64-73` is the complete surface;
  `auth.tsx` has no social buttons). Deferred in backend-roadmap Phase 2: "Continue with Google → needs an
  OAuth client, deferred", and deliberately not stubbed because "a dead button call would be misleading."
  Apple Sign-In is not mentioned anywhere, and Apple requires it for App Store apps that offer third-party
  social login — currently moot since there is no social login at all, but it becomes relevant if Google is added.
- No password reset / "forgot password" flow.
- Supabase requires email confirmation before first sign-in, so sign-up is a two-step flow gated on the user's inbox.

**Content / i18n**

- Quote bodies are English + Turkish only; es/de/fr/it users read English quotes. See [§5](#5-quote-text-localization-reality).
  `TODO.md:51` flags this as a content-data limitation deliberately *not* to be patched with machine-generated text.
- Pack names/descriptions are `tr`/`en` only, and `localizedPackField` falls back to `tr` before `en`, so
  es/de/fr/it users see Turkish pack titles.
- `ar` and `ja` locale files exist but are marked "Coming soon" and unselectable.

**Product surface**

- Premium content never reaches the notification/widget/Home rotation (by design — see [§4](#-important-limitation)).
  Worth knowing when answering "what does Pro actually change day-to-day?": ads off, 7/10 reminders, and a
  browsable catalog.
- No streak, no reflections/notes, no weekly summary, no watermark-free share cards, no widget styles —
  Phases 6-8 in backend-roadmap, "Not started yet" in `TODO.md:41-44`.
- Cross-device sync (Phase 5) not started, despite the UI copy. See [§6](#sync-claimed-but-not-implemented).

**Platform**

- **iOS is partially blocked.** No `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`, so purchases are cleanly disabled on
  iOS (no paywall, no Pro card, no ads-removal UI) — `src/lib/purchases.ts:9-15`, `TODO.md:15`. iOS AdMob unit
  ids are empty (`adUnits.ts:11-12`), and `app.json`'s `iosAppId` is Google's sample id.
- **No iOS widget.** `react-native-android-widget` is Android-only; a WidgetKit/Swift implementation is
  required (`TODO.md:47`).
- **Release gating:** Play Console closed testing needs 12 testers × 14 days before production; 1 tester
  registered (`TODO.md:8`). Real-device purchase verification is still outstanding (`TODO.md:7`).

**Code-level loose ends** (not user-visible, but will confuse a reader)

- `pickUnseenQuoteId` (`src/utils/quoteSelector.ts:26-37`) and `StorageKeys.seenToday` (`storage.ts:10`) are
  dead — the scheduler uses its own local `pickQuoteId`, which only avoids back-to-back repeats and does not
  consult history at all. Only the test suite references `pickUnseenQuoteId`.
- Unused i18n keys: `home.nextQuote`, `home.swipeHint`, `home.historyEmpty`, `onboarding.permissionButton`,
  `settings.premium.goProLink`, `settings.sections.premium`, `paywall.restoreNothingFound`,
  `notifications.permission*`, `widget.tapHint`.
- `useHistory` exposes `goNewer` / `canNewer`, which no screen calls — Home only navigates older + random.

---

## 9. ⚠️ Discrepancies found

1. **`.claude/docs/TODO.md:60` is stale on premium catalog size.** It claims "Premium content expanded from
   1 pack/24 quotes to 6 packs/451 quotes … 31 authors", and `TODO.md:51` refers to "the 6 premium pack
   names/descriptions". `scripts/seed-packs.js` actually defines **18 packs / 3325 quotes** (18 pack objects in
   `PACKS`; 3301 quotes carrying an inline `packId` plus the 24 base stoics quotes that get `packId` via
   `.map()`). The user-facing copy is the *current* one — `en.json:135,218` says "3,325+ premium quotes in
   18 packs" — so the locale strings are right and TODO.md is out of date.
2. **Sync is advertised in-product but does not exist.** `settings.account.guestHint`, `auth.subtitle`, and
   `settings.account.deleteAccountConfirmMessage` all tell the user favorites/settings (and "reflections") sync
   across devices or are stored on the account. No client code touches the `favorites`, `user_settings`, or
   `reflections` tables. The paywall's own feature list is correctly hedged ("Sync (soon)"), which makes the
   Account/auth copy the outlier. Either build Phase 5 or soften those three strings.
3. **`paywall.purchaseSuccess` is ads-specific but shown for every purchase.** `paywall.tsx:49` sets it after
   *any* successful package purchase, including `pro_monthly` / `pro_yearly`, but the string is "Thank you! Ads
   are now off." (`en.json:223`). A Pro subscriber gets a message about ads instead of about Pro.
4. **`localizedPackField` fallback order contradicts the app's fallback story elsewhere.** i18n chrome falls
   back to `tr` (`i18n/index.ts:37`) *and* quote bodies fall back to English (`quoteText.ts:5`), but pack
   names fall back `locale → tr → en` (`quotePack.ts:21`). Net effect for an es/de/fr/it user: English quote
   bodies next to Turkish pack titles on the same screen.
5. **Every monetization gate is silently disabled when RevenueCat is unconfigured.** On iOS today (no iOS API
   key) a user gets 10 notifications/day for free with no paywall, no Pro card, and no lock badges
   (`settings.tsx:40-41`, `useEnforceFreeLimits.ts:18`). Intentional per the code comments, but it means "Free
   tier = 5/day" is only true on Android.
6. **`TODO.md:52` notes the Pro/unlocked pack view was never re-verified on-device** after the QA account's
   manual entitlement grant expired. The locked/free view was verified exhaustively; the unlocked path is
   code-reviewed only.
7. **Interstitial cadence is effectively time-gated, not swipe-gated.** `INTERSTITIAL_EVERY = 12` swipes and
   `MIN_INTERSTITIAL_GAP_MS = 4 min` are both required (`index.tsx:64-70`, `ads.ts:61`), and `initAds` primes
   `lastShownAt` at boot. In practice a normal user will rarely see an interstitial — relevant if ad revenue
   looks lower than a "1 per 12 navigations" model would predict.
