# DriftStop — Code Architecture

Reference map of the codebase for engineers who need to find things without grepping.
Every claim below is anchored to a file (and line, where specific).

> **Expo SDK 56.** APIs changed relative to SDK 53/54 tutorials you may remember.
> Always read the versioned docs: <https://docs.expo.dev/versions/v56.0.0/>.
> This is also mandated by `AGENTS.md` / `CLAUDE.md` at the repo root.

## Table of contents

1. [Stack & versions](#1-stack--versions)
2. [Directory map](#2-directory-map)
3. [App boot sequence](#3-app-boot-sequence)
4. [State & data layer](#4-state--data-layer)
5. [Data flow: quotes](#5-data-flow-quotes)
6. [Backend (Supabase)](#6-backend-supabase)
7. [Purchases & ads](#7-purchases--ads)
8. [Notifications & widget](#8-notifications--widget)
9. [i18n](#9-i18n)
10. [Testing & quality gates](#10-testing--quality-gates)
11. [Conventions](#11-conventions)
12. [⚠️ Risks & untested areas](#-risks--untested-areas)

---

## 1. Stack & versions

From `package.json`:

| Layer | Package | Version | Notes |
|---|---|---|---|
| SDK | `expo` | `~56.0.12` | **SDK 56** — read docs at `/versions/v56.0.0/` |
| Runtime | `react-native` | `0.85.3` | New Architecture era |
| UI runtime | `react` / `react-dom` | `19.2.3` | React Compiler enabled (`app.json:88`) |
| Routing | `expo-router` | `~56.2.11` | file-based, root = `src/app` |
| Language | `typescript` | `~6.0.3` | `strict: true` (`tsconfig.json:4`) |
| Animation | `react-native-reanimated` `4.3.1` + `react-native-worklets` `0.8.3` | | worklet-based; `'worklet'` directives in gesture handlers |
| Gestures | `react-native-gesture-handler` `~2.31.1` | | `GestureHandlerRootView` at root |
| Vector | `react-native-svg` `15.15.4` | | all hand-drawn "sketch" chrome |
| Local DB | `expo-sqlite` `~56.0.5` | | file `driftstop.db` |
| Storage | `@react-native-async-storage/async-storage` `2.2.0` | | all user state |
| Notifications | `expo-notifications` `~56.0.18` | | local scheduled notifications only, no push server |
| Widget | `react-native-android-widget` `^0.20.3` | | Android only |
| Ads | `react-native-google-mobile-ads` `^16.3.4` | | AdMob banner + interstitial |
| Purchases | `react-native-purchases` `^10.4.2` | | RevenueCat |
| Backend | `@supabase/supabase-js` `^2.109.0` | | + Deno edge functions |
| Crash | `@sentry/react-native` `^8.18.0` | | opt-in via DSN env |
| i18n | `i18n-js` `^4.5.3` | | 8 locale files, 6 active |
| Fonts | `@expo-google-fonts/{caveat,kalam,architects-daughter}` | | handwriting-only typography |
| Icons | `phosphor-react-native` `^3.0.6` | | always `weight="thin"` |
| Test | `jest` `~29.7.0` + `jest-expo` `~56.0.5` + `@testing-library/react-native` `^14` | | |

**Native config** lives in `app.json` (Continuous Native Generation — `ios/` and `android/` are
gitignored, `.gitignore:44-45`). Config plugins: `expo-router`, `expo-splash-screen`,
`expo-notifications`, `expo-localization`, `expo-sharing`, `react-native-google-mobile-ads`,
`react-native-android-widget`, `./plugins/withGradleVersion`, `expo-sqlite` (`app.json:38-85`).

`plugins/withGradleVersion.js:11` pins the Gradle wrapper to **8.13** on every prebuild because SDK
56 emits Gradle 9.3.1, which AGP 8.12 cannot use (`JvmVendorSpec.IBM_SEMERU` failure).

Identity: bundle id / package `com.driftstop.app`, scheme `driftstop`, Android `versionCode 11`,
`version 1.0.1`, EAS project `fb1bca5b-8847-4c5f-9073-fa68ad53f539`, owner `evolaroa.app`.
Build profiles in `eas.json`: `development` (APK, dev client), `preview` (APK, local credentials),
`production` (AAB, `autoIncrement`, local credentials).

---

## 2. Directory map

| Path | What lives there | When you'd touch it |
|---|---|---|
| `index.js` | Custom entry point: registers the Android widget task handler, then `require('expo-router/entry')` | Anything that must run before the router mounts |
| `src/app/` | expo-router routes. `_layout.tsx` = providers + boot gate; `(tabs)/` = Home/Favorites/Settings; `onboarding`, `auth`, `paywall`, `quote/[id]`, `packs/*` | New screens, navigation, boot order |
| `src/components/` | Presentational components incl. the "sketch" family (`WobblyBorder`, `SketchButton`, `SketchToggle`, `SketchUnderline`, `SketchIcons`, `SketchOnboardingIcons`, `SketchStrike`, `CornerBrackets`, `Doodle`,
`PaperBackground`), plus `QuoteCard`, `ThemedText`, `TimePicker`, `FrequencySelector`, `ThemeChips`, `AdBanner`, `SplashOverlay`, `ErrorBoundary` | UI work |
| `src/hooks/` | Providers + hooks: `useSettings`, `use-theme`, `useAuth`, `usePurchases`, `useHistory`, `usePacks`, `useFavorites`, `useNotifications`, `useEnforceFreeLimits`, `usePremiumCacheGuard`, `usePremiumCacheVersion`, `use-color-scheme(.web)` | State ownership, persistence |
| `src/services/` | Supabase → SQLite sync: `quotesSync`, `packsSync`, `authorsSync`; entitlement↔cache reconciliation: `premiumCacheGuard` | Remote content refresh logic |
| `src/db/` | SQLite cache layer: `quotesCache`, `packsCache` (both open `driftstop.db`) | Cache schema, local queries |
| `src/lib/` | Third-party client construction: `supabase.ts`, `purchases.ts` | SDK config / env keys |
| `src/utils/` | `scheduler` (notifications), `storage` (AsyncStorage keys), `timeUtils`, `quoteSelector`, `quoteText`, `ads`, `share`, `sketch` (SVG path math), `pricing` (paywall price arithmetic), `runtime` (Expo Go detection), `crashReporting` | Pure logic, platform shims |
| `src/types/` | `quote.ts` (`Quote`, categories/eras/tags), `quotePack.ts`, `settings.ts` (`Settings`, `DEFAULT_SETTINGS`, frequency gate) | Domain model changes |
| `src/constants/` | `colors` (palettes), `fonts`, `layout` (spacing/radius/paper), `adUnits` (AdMob ids), `links` (store/privacy URLs) | Design tokens, ids |
| `src/data/` | `quotes.json` (1000 free quotes) + `quotes.ts` reader, `quotesAnySource.ts` (static ∪ SQLite), `gen/*.json` (regional build inputs), `tags/*.json` (tag assignments) | Content pipeline |
| `src/i18n/` + `src/locales/` | `i18n-js` setup + language registry, `quoteLocalization.ts` (origin/author label maps), `useTranslation.ts`; 8 JSON locale files | Copy, new languages |
| `src/widgets/` | `DriftStopWidget.tsx` (widget JSX), `widget-task-handler.tsx` (headless lifecycle), `updateWidget.tsx` (in-app push to widget) | Android home-screen widget |
| `supabase/migrations/` | `0001_init_schema.sql`, `0002_quotes_extra_fields.sql`, `0003_pack_public_counts.sql`, `0004_revoke_client_profile_writes.sql`, `0005_lock_down_migrations_table.sql`, `0006_revoke_client_content_writes.sql` | Schema + RLS + grants |
| `supabase/functions/` | `delete-account/`, `revenuecat-webhook/` (Deno) | Server-side entitlement/account ops |
| `scripts/` | Content build + DB seed/migrate scripts (see §6) | Content or schema ops |
| `plugins/` | `withGradleVersion.js` config plugin | Native build breakage |
| `.claude/docs/` | `TODO.md`, `backend-roadmap.md`, `build-plan.md`, `google-play-publishing-guide.md`, `release-handoff.md`, `quotes-reference.md`, this file | Project history/decisions |

---

## 3. App boot sequence

```
index.js
  └─ Platform.OS === 'android' ? registerWidgetTaskHandler(widgetTaskHandler) : (skip)
  └─ require('expo-router/entry')
       └─ src/app/_layout.tsx  (module scope, then RootLayout, then AppShell)
```

**Step 0 — `index.js` (custom entry, why it exists).**
`react-native-android-widget` requires its headless task handler to be registered **before** the
router/app bootstraps, otherwise an OS-initiated widget update (which can run with no JS app alive)
has nothing to call. `expo-router/entry` immediately mounts the app, so the registration must
precede it — hence `package.json:3` points `main` at `index.js` instead of `expo-router/entry`.
The `Platform.OS === 'android'` guard at `index.js:7` exists because the library has **no iOS native
module**: importing is harmless, calling `registerWidgetTaskHandler` is not. `require()` (not
`import`) is used so the module isn't even evaluated on iOS.

**Step 1 — module scope of `src/app/_layout.tsx`.**
`SplashScreen.preventAutoHideAsync()` (`:31`) and `initCrashReporting()` (`:32`) run before any
component renders. Sentry initialises only if `EXPO_PUBLIC_SENTRY_DSN` is set
(`src/utils/crashReporting.ts:11`) and is `enabled: !__DEV__`.
Importing `@/hooks/useNotifications` also runs its module-level
`Notifications.setNotificationHandler(...)` (`src/hooks/useNotifications.ts:8-21`), guarded by
`nativeFeaturesAvailable` so Expo Go doesn't crash.

**Step 2 — `RootLayout` (`_layout.tsx:96`) loads fonts.**
`useFonts` with Caveat 400/700, Kalam 400/700, ArchitectsDaughter 400 (`:97-103`).
While `!loaded` it renders `null` (`:111-113`) — the native splash is still up.
When `loaded` flips, `SplashScreen.hideAsync()` (`:105-109`).

**Step 3 — provider nesting (`_layout.tsx:116-132`), outermost → innermost.**

| # | Provider | Why at this depth |
|---|---|---|
| 1 | `ErrorBoundary` | Class boundary with hardcoded colors (`src/components/ErrorBoundary.tsx:60-94`) so it survives failures *inside* theme/settings contexts; reports via `reportError` |
| 2 | `GestureHandlerRootView` | Required ancestor for `react-native-gesture-handler` |
| 3 | `SafeAreaProvider` | Insets needed by tab bar + screens |
| 4 | `SettingsProvider` | Root of user state; owns language → must precede anything that translates |
| 5 | `ThemeProvider` | Reads `settings.themeMode` (`src/hooks/use-theme.tsx:19`) — depends on Settings |
| 6 | `AuthProvider` | Supplies `user.id` |
| 7 | `PurchasesProvider` | Consumes `useAuth()` to link RevenueCat `app_user_id` (`usePurchases.tsx:38`) |
| 8 | `HistoryProvider` | Consumes `useSettings()` for the theme-filtered seed pool (`useHistory.tsx:41`) |
| 9 | `AppShell` | Screens + boot effects |

**Step 4 — `AppShell` (`_layout.tsx:35`) side effects.**

| Order | What | Line |
|---|---|---|
| a | `useNotificationObserver()` — deep-links notification taps to `/quote/[id]` | `:36` |
| b | `useEnforceFreeLimits()` — downgrades Pro-only `frequency` for non-entitled users | `:37` |
| b2 | `usePremiumCacheGuard()` — purges locally cached premium quotes when entitlement is gone, re-downloads them when it returns | `:39` |
| c | mount effect: `setupAndroidChannel()`, `initAds()`, `syncQuotes()`, `syncPacks()`, `syncAuthorCounts()`, read `onboardingComplete` | `:48-55` |
| d | foreground `addNotificationReceivedListener` → `record(quoteId)` into history | `:58-65` |
| e | boot gate: waits for `splashDone && settingsLoaded && onboarded !== null`, runs **once** via `bootRan` ref | `:67-76` |

The gate (`:71-75`) either `router.replace('/onboarding')` or
`ensurePermissions().then(() => rescheduleIfNeeded(settings))`.
Note: **notification permission is only requested on the onboarded path here**; the onboarding
screen calls `ensurePermissions()` itself at `src/app/onboarding.tsx:44` before finishing.

**Step 5 — first paint.** `Stack` with `headerShown: false` and 8 registered screens
(`_layout.tsx:81-90`); `SplashOverlay` renders on top until its 2200 ms animation finishes
(`src/components/SplashOverlay.tsx:19`, `:41-46` → `onDone` → `splashDone = true`).

---

## 4. State & data layer

### Providers / hooks

| Hook | Kind | Owns | Persistence | Public API |
|---|---|---|---|---|
| `useSettings` (`src/hooks/useSettings.tsx:48`) | Provider | The whole `Settings` object; keeps `i18n.locale` in sync; triggers rescheduling | AsyncStorage `driftstop:settings` | `{ settings, loaded, update(patch), setThemeMode(mode), setLanguage(lang) }` |
| `useTheme` (`src/hooks/use-theme.tsx:18`) | Provider | Resolves `themeMode` + OS scheme → palette | none (derives from Settings) | `{ colors, themeName, mode, setMode }` |
| `useAuth` (`src/hooks/useAuth.tsx:33`) | Provider | Supabase session | Supabase client's own storage (SQLite-backed `localStorage`, `src/lib/supabase.ts:1,16`) | `{ configured, session, user, loading, signUpWithEmail, signInWithEmail, resendConfirmation, sendPasswordReset, signInWithProvider, signOut, deleteAccount }` |
| `usePurchases` (`src/hooks/usePurchases.tsx:37`) | Provider | RevenueCat `CustomerInfo`, current offering, entitlement flags | RevenueCat SDK | `{ configured, loading, entitlementKnown, isPro, isAdsRemoved, offering, purchasePackage, restorePurchases }` |
| `useHistory` (`src/hooks/useHistory.tsx:40`) | Provider | Ordered list of *seen* quote ids + a read pointer | AsyncStorage `driftstop:seenHistory` (cap 200, `:19`) | `{ quote, count, loaded, record, goOlder, goNewer, randomFromHistory, canOlder, canNewer }` |
| `useFavorites` (`src/hooks/useFavorites.ts:6`) | Hook (per-consumer state!) | Favourite quote ids | AsyncStorage `driftstop:favorites` | `{ ids, isFavorite, toggle, remove, loaded }` |
| `usePacks` (`src/hooks/usePacks.tsx:28`) | Hook | Premium pack + author lists with `locked` flags | reads SQLite synchronously; refreshes from Supabase on mount | `{ packs, authors, loading, refresh }` |
| `useNotificationObserver` (`src/hooks/useNotifications.ts:35`) | Hook | Notification-tap routing | none | `void` |
| `useEnforceFreeLimits` (`src/hooks/useEnforceFreeLimits.ts:13`) | Hook | Clamps `frequency` to `FREE_FREQUENCY_MAX` | writes through `useSettings.update` | `void` |
| `usePremiumCacheGuard` (`src/hooks/usePremiumCacheGuard.ts:37`) | Hook | Keeps the local premium cache aligned with entitlement | writes SQLite via `services/premiumCacheGuard` | `void` |
| `usePremiumCacheVersion` (`src/hooks/usePremiumCacheVersion.ts:18`) | Hook (`useSyncExternalStore`) | Re-render signal for screens that read the premium cache; the counter lives in `services/premiumCacheGuard` and bumps on purge/restore | none | `number` |
| `useColorScheme` (`src/hooks/use-color-scheme.ts`) | Re-export | — | — | RN's `useColorScheme` (`.web.ts` variant exists) |

Details worth knowing:

- **Settings → scheduler coupling.** `SCHEDULE_KEYS` (`useSettings.tsx:36-46`) lists the fields that
  force `applySchedule(next)` on change: notifications toggle, frequency, window start/end,
  weekend flag, **language** (notification body text) and **themes** (quote pool).
- **First-launch language.** `detectLanguage()` (`useSettings.tsx:17-22`) picks the device language
  if it is in `AVAILABLE_LANGUAGE_CODES`, else `'tr'`. Stored language always wins.
- **Social sign-in has three outcomes, not two.** `signInWithProvider` returns
  `{ error, cancelled? }` — the same shape as `purchasePackage`. Cancelling the provider sheet is
  neither an error (no red line) nor a success (**the screen must stay open**), and `auth.tsx:72-80`
  checks `cancelled` *before* `error`. While cancel and success were both a bare `{ error: null }`,
  dismissing Google's sheet closed `/auth` and dropped the user back on Settings, still a guest,
  with no explanation. Pinned by `src/hooks/__tests__/useAuthSocial.test.tsx` and
  `src/__tests__/authScreenSocialCancel.test.tsx`.
- **`useFavorites` is not a provider** — every screen that calls it holds an independent copy of
  `ids`. Two mounted screens can drift until remount. Writes are last-write-wins.
- **History is not a generator.** The app never invents "next quote" in-app; new quotes arrive via
  notifications and get folded into history (`useHistory.tsx:36-39` comment). Seeding on first
  launch picks exactly one random quote from the theme-filtered pool (`:54-59`). `AppState` →
  `active` re-runs `syncDeliveredToHistory()` (`:72-85`).
- **Entitlement flags are derived, never stored locally.** `deriveFlags` (`usePurchases.tsx:30-35`)
  reads `entitlements.active['pro'|'no_ads']`; `getOfferings()` failure is deliberately isolated
  from `getCustomerInfo()` (`:66-73`) so a missing dashboard offering can't hide an active
  subscription.
- **`entitlementKnown` ≠ `!loading`.** `loading` is cleared in a `.finally()`, so it also flips
  false when `getCustomerInfo()` *rejects* — leaving `customerInfo === null`, `isPro === false`
  and nothing actually learned. `entitlementKnown` is `customerInfo != null`. Reversible UI
  decisions (lock/unlock, spinners) may key off `loading`; **anything that deletes data must key
  off `entitlementKnown`** — see `usePremiumCacheGuard`, and the three-state
  `PremiumEntitlementState` (`'entitled' | 'none' | 'unknown'`) that makes "unknown" impossible to
  confuse with "not entitled" at the type level.

### AsyncStorage keys

All keys are centralised in `src/utils/storage.ts:4-14`; access goes through `getJSON`/`setJSON`,
both of which swallow errors (`:16-32`).

| Key | Written by | Read by | Meaning |
|---|---|---|---|
| `driftstop:settings` | `useSettings.tsx:74` | `useSettings.tsx:54` | serialized `Settings` |
| `driftstop:favorites` | `useFavorites.ts:25` | `useFavorites.ts:12` | `number[]` quote ids |
| `driftstop:onboardingComplete` | `onboarding.tsx:46` | `_layout.tsx:51` | boot gate |
| `driftstop:seenHistory` | `useHistory.tsx:58,90`, `scheduler.ts:184` | `useHistory.tsx:51`, `widget-task-handler.tsx:25` | newest-first `number[]`, cap 200 |
| `driftstop:scheduledQuoteIds` | `scheduler.ts:87,135,172` | `scheduler.ts:162,199` | `{id, at}[]` — pending notifications with fire time |
| `driftstop:lastScheduledDate` | `scheduler.ts:88,136` | `scheduler.ts:195` | `YYYY-MM-DD`, drives daily reschedule |
| `driftstop:widgetQuoteId` | `widgets/updateWidget.tsx:15` | *(nothing reads it)* | vestigial |
| `driftstop:themeMode` | *(nothing)* | *(nothing)* | superseded by `settings.themeMode` |
| `driftstop:seenToday` | *(nothing)* | *(nothing)* | dead key |

### SQLite (`driftstop.db`)

| Table | Created in | Columns |
|---|---|---|
| `quotes` | `src/db/quotesCache.ts:34-48` | `id` PK, `text`, `text_tr`, `author`, `origin`, `origin_emoji`, `category`, `era`, `tags` (JSON string), `is_premium` (0/1), `pack_id`, `updated_at` |
| `meta` | `src/db/quotesCache.ts:49-52` | `key` PK, `value` — holds the `last_sync_at` delta cursor and `premium_backfill_count` (how many rows the last *complete* premium backfill returned; the convergence watermark used by `premiumCacheGuard`) |
| `purged_premium_quotes` | `src/db/quotesCache.ts:57-59` | `id` PK — **ids only, never content**: tombstones for premium quotes deleted when entitlement ended, so favourites can render a deliberate "locked" row instead of a blank/vanished card |
| `packs` | `src/db/packsCache.ts:28-36` | `id` PK, `name` (JSON), `description` (JSON), `cover_image_url`, `is_premium`, `sort_order`, `quote_count` |
| `premium_authors` | `src/db/packsCache.ts:45-48` | `author` PK, `quote_count` |

Both modules keep their **own** module-level connection to the same file
(`quotesCache.ts:29`, `packsCache.ts:22`). `packsCache.ts:38-43` runs a blind
`alter table packs add column quote_count …` inside `try/catch` to migrate installs created before
that column existed. All reads are **synchronous** (`getAllSync`/`getFirstSync`), which is what lets
`usePacks` compute inside `useMemo` (`usePacks.tsx:34-54`).

---

## 5. Data flow: quotes

```
src/data/gen/*.json ──build-quotes.js──┐
src/data/tags/*.json ──merge-tags.js───┴─> src/data/quotes.json  (1000, ids 1..1000)
                                              │
                        ┌─────────────────────┼──────────────────────────┐
                        │ (bundled, sync)     │ seed-quotes.js           │ seedIfEmpty()
                        ▼                     ▼                          ▼
                 src/data/quotes.ts     Supabase `quotes` ──syncQuotes──> SQLite `quotes`
                  (QUOTES + byId)        (+ ~3325 premium rows           (delta by updated_at)
                        │                 from seed-packs.js)                    │
                        └──────────────► src/data/quotesAnySource.ts ◄────────────┘
```

### The two readers, and who uses which

| Reader | Source | Used by |
|---|---|---|
| `src/data/quotes.ts` — `QUOTES`, `getQuoteById`, `getQuotesByThemes` | **static bundled array only** (`quotes.ts:5,9,19`) | `utils/scheduler.ts:4` (notification pool), `hooks/useHistory.tsx:12` (Home card), `widgets/widget-task-handler.tsx:3`, `widgets/updateWidget.tsx:4`, `db/quotesCache.ts:3` (seed source) |
| `src/data/quotesAnySource.ts` — `lookupQuoteAnySource`, `getPackQuotes`, `getAuthorQuotes` — **every one takes a mandatory `{ entitled }`** and refuses premium content without it (second line of defence behind RLS) | static **first**, then SQLite cache, then purge tombstones (`quotesAnySource.ts:34-51`) | `app/quote/[id].tsx:12`, `app/(tabs)/favorites.tsx:13`, `app/packs/[id].tsx:13`, `app/packs/author/[name].tsx:13` |

This split is deliberate and documented at `quotesAnySource.ts:5-12`: the **core loops (Home,
widget, notifications) never touch SQLite**, so they stay synchronous, offline and independent of
entitlement. Only screens that must be able to show premium pack content fall through to the cache.
`getQuotesByThemes` returns *all* quotes when `themes` is empty or when the filter matches nothing
(`quotes.ts:20-23`) so a screen can never be empty.

### Sync strategy

| Service | Query | Cursor / strategy |
|---|---|---|
| `syncQuotes` (`src/services/quotesSync.ts:65`) | `quotes` where `updated_at > since`, ordered `updated_at, id`, paged 500 (`:4,38-58`) | **Delta by `updated_at`**. Cursor read from `meta.last_sync_at` (`quotesCache.ts:207`) defaulting to epoch; after upsert the cursor advances to `max(updated_at)` of the fetched rows (`quotesSync.ts:76-77`). Always calls `seedIfEmpty()` **first** (`:66`) so an offline first launch still has a populated cache. All errors swallowed → `{synced: 0}` (`:79-83`) |
| `syncPremiumQuotes` (`src/services/quotesSync.ts:105`) | `quotes` where `is_premium = true`, ordered by `id`, paged 500 | **No cursor at all, by design.** Used only to restore premium content after a purge: the server-side `updated_at` of those rows never changed, so the delta cursor is already past them and `syncQuotes` would never re-fetch them. Deliberately does **not** advance `meta.last_sync_at` (that would skip free rows updated meanwhile). RLS returns `[]` unless the caller is a signed-in user with `profiles.is_premium`. All pages are accumulated **before** a single `upsertQuotes` transaction, so an interrupted run writes nothing; an optional `isCancelled` probe is checked between the fetch and that write so a sign-out during the 2–5 s restore can't land rows on top of the purge |
| `syncPacks` (`src/services/packsSync.ts:32`) | full `quote_packs` select ordered by `sort_order` | **Full upsert every time** — table is tiny (`packsSync.ts:26-31`) |
| `syncAuthorCounts` (`src/services/authorsSync.ts:14`) | RPC `get_premium_author_counts()` | Full replace of `premium_authors`. Uses a `SECURITY DEFINER` RPC so free/guest users can see author names + counts (public metadata) without RLS letting them read quote text |

`seedIfEmpty()` (`quotesCache.ts:59-89`) inserts all 1000 bundled quotes with
`updated_at = 1970-01-01`, `is_premium = 0`, `pack_id = null` inside one synchronous transaction —
so the first remote delta re-fetches every row that Supabase has ever touched.

Content-pipeline invariants are enforced by tests: 1000 quotes, sequential unique ids, non-empty
fields, no "Unknown/Belirsiz" attributions, unique Turkish texts, 1–4 valid tags
(`src/data/__tests__/quotes.test.ts:10-61`).

---

## 6. Backend (Supabase)

**Project ref `ftohdffebzhrthrpeuos`** (`supabase/.temp/linked-project.json`,
`scripts/db-migrate.js:11`). Scripts connect through the IPv4 **session pooler**
`aws-0-ap-northeast-1.pooler.supabase.com:5432` because `db.<ref>.supabase.co` is IPv6-only
(`db-migrate.js:12-14`).

Client construction: `src/lib/supabase.ts:12-22`. If `EXPO_PUBLIC_SUPABASE_URL` or
`EXPO_PUBLIC_SUPABASE_ANON_KEY` is missing, `supabase` is `null` and **every dependent feature
degrades silently** — auth reports `configured: false`, all three syncs no-op. Session persistence
uses `expo-sqlite/localStorage/install` (`:1,16`), not AsyncStorage.

### Tables & RLS

| Table | Columns | RLS policy | Intent |
|---|---|---|---|
| `profiles` (`0001:9-17`) | `id` → `auth.users` (cascade), `display_name`, `is_premium`, `premium_since`, `streak_count`, `streak_last_date`, `created_at` | `profiles_select_own` (`auth.uid() = id`). **`profiles_update_own` was dropped in `0004`** together with the client roles' table-level INSERT/UPDATE grants | Server-side entitlement record. **Only the RevenueCat webhook writes `is_premium`** (service role bypasses RLS and grants) — this is now enforced by grants, not just intent. Postgres RLS cannot restrict *columns*, so the row-correct `profiles_update_own` policy plus a table-level UPDATE grant let any signed-in user set their own `is_premium = true` until `0004` (see that migration's header for the exploit and the column-grant recipe if a screen ever needs to write `display_name`). Rows are created by trigger `on_auth_user_created` → `handle_new_user()` (`0001:30-44`) |
| `quote_packs` (`0001:47-54`, `+quote_count` `0003:8`) | `id` PK text, `name` jsonb, `description` jsonb, `cover_image_url`, `is_premium`, `sort_order`, `quote_count` | `quote_packs_public_read` — `using (true)` (`0001:58-60`); client INSERT/UPDATE/DELETE revoked in `0006` | Pack *metadata* is public marketing surface; the content is protected in `quotes`. `quote_count` is also what the client uses to tell a complete premium cache from a partial one |
| `quotes` (`0001:63-74`, `+origin_emoji/category` `0002`) | `id` PK bigint, `text`, `text_tr`, `author`, `origin`, `origin_emoji`, `category`, `era`, `tags text[]`, `pack_id` → `quote_packs`, `is_premium`, `updated_at`; indexes on `pack_id`, `is_premium`, `updated_at` (`0001:76-78`) | Two SELECT policies: `quotes_public_read_free` (`is_premium = false`) and `quotes_premium_read_entitled` (`is_premium = true AND EXISTS(profiles where id = auth.uid() and is_premium)`) (`0001:82-94`); client INSERT/UPDATE/DELETE revoked in `0006` | The entitlement gate. A non-entitled client physically cannot download premium rows — and since `0004` it also cannot grant itself entitlement |
| `favorites` (`0001:97-102`) | `(user_id, quote_id)` PK, `created_at` | `favorites_own_rows` FOR ALL, `auth.uid() = user_id` (`0001:108-110`) | Cloud favourites — **not yet used by the client** (`useFavorites` is AsyncStorage-only) |
| `reflections` (`0001:113-119`) | `id` uuid, `user_id`, `quote_id`, `note`, `created_at` | `reflections_own_rows` FOR ALL (`0001:125-127`) | Planned ritual layer — no client code |
| `user_settings` (`0001:130-136`) | `user_id` PK, `theme`, `language`, `notification_prefs` jsonb, `updated_at` | `user_settings_own_rows` FOR ALL (`0001:140-142`) | Planned settings sync — no client code |
| `_migrations` | `name` PK, `applied_at` | RLS **enabled with no policy** and all client grants revoked (`0005`) — server-side only | Applied-migration ledger (`db-migrate.js:31-37`). The runner connects as `postgres` through the pooler, not PostgREST, so it is unaffected |

**RPC `public.get_premium_author_counts()`** (`0003:12-25`): `SECURITY DEFINER`, `search_path = public`,
returns `(author, quote_count)` for `is_premium = true` only, granted to `anon, authenticated`. It
deliberately bypasses RLS to expose *counts and names but never text* — the fix for free users
seeing "0 quotes" on locked packs (rationale in the migration header, `0003:1-6`).

### Auth providers & `auth.identities`

Enabled server-side on `ftohdffebzhrthrpeuos` (configured and verified live 2026-08-09): **email**,
**google** (accepted audiences = web client id, then iOS client id) and **apple** (audience
`com.driftstop.app`). No OAuth secret is set for either social provider — `signInWithProvider` in
`useAuth` uses `supabase.auth.signInWithIdToken`, the native id-token flow, which performs no code
exchange. Values, the Management-API recipe and the verification curls are in `OPERATIONS.md` §5.

`auth.identities` holds one row per (user, provider). Signing in with Google on the address of an existing
**confirmed** email account links a *second* identity row to the **same** `auth.users.id` — which is exactly
why the `profiles` row, the RevenueCat `app_user_id` and the entitlement survive the link. Every child of
`auth.users` cascades on delete — `auth.identities`, `profiles`, `favorites`, `reflections`,
`user_settings`, `trials` (verified against the live DB via `pg_constraint`, 2026-08-09) — so
`delete-account` still removes the linked social identity without naming a single table.

**Social sign-in required no schema change.** The `on_auth_user_created` trigger creates the `profiles` row
for a first-time Google/Apple user exactly as for an email signup; migrations 0001–0007 are untouched. Live
check on the same date: 4 users / 4 profiles / 0 users without a profile.

⚠️ **Apple token revocation on account deletion is deliberately not implemented** (owner decision,
2026-08-09). A deleted Apple user keeps seeing DriftStop under iOS Settings → Apple ID → Sign in with Apple
even though the account is genuinely gone. Recorded as a compliance gap in `OPERATIONS.md` §7.

### Edge functions (Deno)

| Function | Auth model | Behaviour |
|---|---|---|
| `delete-account` (`supabase/functions/delete-account/index.ts`) | **Caller JWT required.** `Authorization` header parsed at `:26-28`, then re-verified by constructing an anon client with that JWT and calling `auth.getUser()` (`:37-41`) — so a caller can only ever delete *itself*. The service-role client is used **only** for the actual delete (`:43-44`) | `POST` only (`:24`). Deletes the `auth.users` row; `profiles`/`favorites`/`reflections`/`user_settings` disappear via `on delete cascade`. Invoked from `useAuth.deleteAccount` (`src/hooks/useAuth.tsx:80`), which then signs out. Required by Play policy |
| `revenuecat-webhook` (`supabase/functions/revenuecat-webhook/index.ts`) | **Shared secret, no JWT.** Deployed `--no-verify-jwt` (`:13`); compares the `Authorization` bearer against `REVENUECAT_WEBHOOK_AUTH_TOKEN` (`:58-63`). Note the check is skipped entirely if the secret is unset | `POST` only. Maps event types to entitlement state: grant on `INITIAL_PURCHASE`/`RENEWAL`/`UNCANCELLATION`/`NON_RENEWING_PURCHASE`/`PRODUCT_CHANGE`/`TRANSFER` (`:26-33`), revoke **only** on `EXPIRATION` (`:38`) — `CANCELLATION`/`BILLING_ISSUE` intentionally keep access to period end. Requires `entitlement_ids` to include `pro` (`:23,86`). `TEST` events short-circuit (`:77`); non-UUID `app_user_id` (anonymous RevenueCat users) skipped (`:81-83`). Then `profiles.update({is_premium, premium_since})` with the service role (`:100-106`) |

### Scripts

| Script | npm script | Purpose |
|---|---|---|
| `scripts/build-quotes.js` | `npm run build:quotes` | Merges `src/data/gen/*.json` round-robin for diversity, validates schema + `category`/`era` enums, dedupes on normalised `text`/`textTr`, caps at `TARGET = 1000`, assigns sequential ids, writes `src/data/quotes.json` |
| `scripts/merge-tags.js` | *(none — `node scripts/merge-tags.js`)* | Merges `src/data/tags/*.json` (`id → tags[]`) into `quotes.json`; filters to the 8-tag vocabulary, max 4 tags, falls back to a category-derived tag when an entry has none |
| `scripts/export-quotes.js` | `npm run export:quotes` | Renders `quotes.json` into the human-readable `.claude/docs/quotes-reference.md`, grouped by category |
| `scripts/db-migrate.js` | `npm run db:migrate` | Applies `supabase/migrations/*.sql` in filename order, one transaction each, recording names in `_migrations`; needs `SUPABASE_PASSWORD` or `DATABASE_URL` from `.env` |
| `scripts/seed-quotes.js` | `npm run db:seed-quotes` | Upserts the 1000 bundled quotes into Supabase `quotes` in batches of 200; deliberately does **not** touch `is_premium`/`pack_id` |
| `scripts/seed-packs.js` | `npm run db:seed-packs` | **13.7k lines of inline content.** 18 premium packs (`sortOrder` 0–17: stoics, ancient-greece, eastern-wisdom, modern-philosophy, literature-poetry, historical-figures, renaissance-enlightenment, german-idealism, anglo-american-literature, romantic-poets, classical-epics, eastern-poets-sages, african-proverbs, asian-proverbs, middle-eastern-proverbs, nw-european-proverbs, se-european-proverbs, americas-proverbs) with ~3325 quotes at ids ≥ 100001. These exist **only** in Supabase, never in `quotes.json`. Finally recomputes `quote_packs.quote_count` from actual rows (tail of file) |
| `scripts/reset-project.js` | `npm run reset-project` | Expo template scaffold-reset helper; unused, safe to delete |

Env vars (`.env.example`): `SUPABASE_PASSWORD` (scripts only), `EXPO_PUBLIC_SUPABASE_URL`,
`EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`,
`EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`,
`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`,
`EXPO_PUBLIC_SENTRY_DSN`, and the four
`EXPO_PUBLIC_ADMOB_*` unit ids. `.env` and `credentials*` are gitignored
(`.gitignore:31-32,46-47`).

The two `EXPO_PUBLIC_GOOGLE_*` values are the only ones checked in with real values — OAuth client
ids are not secrets (they are embedded in every bundle anyway), and the iOS one has to be present in
CI for the divergence guard below to run. `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` is mirrored, reversed,
as the `iosUrlScheme` prop of the `@react-native-google-signin/google-signin` config plugin in
`app.json`; without it Google sign-in on iOS has no way back into the app and **nothing errors**.
`src/lib/__tests__/googleSignInConfig.test.ts` fails if the two ever diverge, or if the plugin is
registered as a bare string again (which is how the scheme went missing in the first place).

`EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` is **never read at runtime** — on Android, Google matches the
caller by package name + signing SHA-1, not by a client id in the bundle. Its only job is to gate the
button: `googleSignInAvailableFor` (`src/lib/socialAuth.ts`) requires the web id everywhere, the iOS
id on iOS and this one on Android, so a platform with no OAuth client behind it renders no button
instead of a button that fails with `DEVELOPER_ERROR`. It is empty today (no Android client exists
yet), which is why Google sign-in ships iOS-only; turning Android on is a config change — create the
client, then set the value in `.env` **and** in EAS cloud env — not a code change.

---

## 7. Purchases & ads

### RevenueCat

`src/lib/purchases.ts:9-12` selects the API key **per platform** via `Platform.select`:
`EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` on Android, `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` on iOS.
The comment at `:6-8` explains why: passing an Android key to the iOS SDK throws
"invalid API key". `purchasesConfigured` (`:15`) = not Expo Go **and** a key exists for this
platform; `configurePurchases()` (`:20-24`) is idempotent.

Entitlement derivation (`src/hooks/usePurchases.tsx`):

| Entitlement id | Flag | Effect |
|---|---|---|
| `pro` (`:12`) | `isPro` | Unlocks premium packs/authors (`usePacks.tsx:38,51`), frequencies 7 & 10 (`(tabs)/settings.tsx:41`), and implies no ads |
| `no_ads` (`:13`) | `isAdsRemoved` | Suppresses ads only |

`Purchases.logIn(user.id)` / `logOut()` keeps RevenueCat's `app_user_id` equal to the Supabase user
id (`:84-100`) — without this the webhook cannot find a `profiles` row to update (comment `:81-83`).
`purchasePackage` treats `userCancelled` as a non-error (`:122`).

### Paywall price display (`src/utils/pricing.ts` + `src/app/paywall.tsx`)

Everything the paywall claims about money is **derived at runtime** from the numeric
`product.price` + `product.currencyCode` of the packages RevenueCat returns. No price, total or
percentage is ever written into the code or the locale files: prices are set per country (TR monthly
is ₺229.99, not a converted dollar figure), so a baked-in "$47.88" would be false almost everywhere.
`priceString` is displayed but never parsed — it is localized text.

`buildPaywallPricing(monthly, annual, locale)` returns `monthlyPerWeek`, `annualPerWeek` and a
`comparison`. The rules, all tested:

- per-week = `price × 12 / 52` for the monthly plan, `price / 52` for the annual;
- the struck-through baseline is `monthly.price × 12`, rendered with `SketchStrike`;
- the saving is `Math.floor(...)` — **rounded down**, because claiming 25% when it is 24.8% is a lie;
- `comparison` is `null` unless **both** a MONTHLY and an ANNUAL package exist, they share a
  currency, and the annual is genuinely cheaper by ≥ 1%. A one-package offering shows the plain
  price and nothing else rather than inventing a baseline.

Formatting goes through `Intl.NumberFormat` with the store's currency code, with a fallback to
`"47.88 USD"` if the Hermes build has no usable `Intl` — an honest ISO code instead of a guessed
symbol.

**Emphasis hierarchy on the package row** (`paywall.tsx`, price column, right-aligned):

| Slot | Content | Style |
|---|---|---|
| hero | per-week amount + `perWeekUnit` ("/ week") | `heading` (22, display font) in `accent`, unit at `label` (13) on a shared baseline |
| secondary | the **actually billed amount with its period** — `billedAnnual` / `billedMonthly` → "$35.99 / year" | `body` (15) in the primary text colour |
| baseline | `comparison.annualizedMonthly` under `SketchStrike` | `label` (13), muted |

The per-week figure is the largest number on the screen because that is what converts, but the
charged amount is never rendered bare and never below body size: App Store Review 3.1.2 and Play's
subscription policy require the amount and billing period to be *clear and conspicuous*, and a
headline "$0.69" over a whisper-thin real price is a known rejection trigger. The LIFETIME row has no
per-week figure, so its `priceString` takes the hero slot instead.

The a11y label is one sentence per row and **must carry the same facts in the same honesty order**:
weekly figure, then real charge + period, then (annual only) baseline + floored saving.
`src/__tests__/paywallPriceEmphasis.test.tsx` pins both halves — the rendered font sizes
(weekly > billed ≥ struck) and the a11y string content — and `locales.test.ts` asserts every locale's
`billed*`/`a11y*` strings still contain `{{price}}` plus a period word.

### Ad suppression

`utils/ads.ts` holds module-level state, not React state:

- `adsEnabled = Constants.appOwnership !== 'expo'` (`:10`) — hard-off in Expo Go.
- `adsSuppressed` (`:20`) is a module variable set by `setAdsSuppressed()` (`:23-25`), which
  `usePurchases` calls in an effect whenever `isAdsRemoved` changes (`usePurchases.tsx:104-106`).
  Every ad path checks both flags: `preloadInterstitial` (`:28`), `initAds` (`:47`),
  `showInterstitialIfReady` (`:60`).
- Frequency capping is two-layered: **every 12th** Home navigation attempts an interstitial
  (`constants/adUnits.ts:30` + `(tabs)/index.tsx:65-70`) **and** at least
  `MIN_INTERSTITIAL_GAP_MS = 4 min` must have elapsed (`ads.ts:13,61`). `initAds` seeds
  `lastShownAt = Date.now()` (`:48`) so the first minutes after launch are ad-free.
- The banner (`src/components/AdBanner.tsx:17`) returns `null` when `!adsEnabled || isAdsRemoved`,
  and renders a "remove ads ✕" link into the paywall when purchases are configured (`:21-32`).
  Both banner and interstitial request `requestNonPersonalizedAdsOnly: true`.

### AdMob unit ids (`src/constants/adUnits.ts`)

| Slot | Android (real) | iOS (real) | Effective value |
|---|---|---|---|
| Banner | `ca-app-pub-3817081931651779/3409885671` (`:9`) | **empty** (`:10`) | `!__DEV__ && real ? real : TestIds.BANNER` (`:19-22`) |
| Interstitial | `ca-app-pub-3817081931651779/3532753144` (`:11`) | **empty** (`:12`) | `!__DEV__ && real ? real : TestIds.INTERSTITIAL` (`:23-26`) |

So: **Android release = real ids; every dev build and all of iOS = Google test ids.**
`app.json:60-63` app ids: Android `ca-app-pub-3817081931651779~3768978323` (real), iOS
`ca-app-pub-3940256099942544~1458002511` — Google's **sample** publisher id.

---

## 8. Notifications & widget

### Scheduler (`src/utils/scheduler.ts`)

Everything is a **local scheduled notification**; there is no push infrastructure.
Every exported function early-returns when `!nativeFeaturesAvailable` (Expo Go).

| Export | Line | Behaviour |
|---|---|---|
| `setupAndroidChannel()` | `:30` | Creates channel `driftstop_motivation` (`:21`), `AndroidImportance.HIGH`, vibration `[0,250,250,250]`, `lightColor #C8923A`. **Sound is intentionally unspecified** (`:35-36`) — the string `'default'` made Android look for a custom asset and warn |
| `ensurePermissions()` | `:45` | Returns true if granted; requests only when `canAskAgain` |
| `applySchedule(settings)` | `:82` | Cancels all, then for `DAYS_AHEAD = 3` days (`:22`) generates `frequency` random times inside the window with `MIN_GAP = 90 min` (`:23`, `timeUtils.generateRandomTimes`), skipping weekends when configured, skipping fire times within 60 s (`:109`). Body = `quoteDisplayText(quote, i18n.locale)`, subtitle = localized `author · origin` (`:116-121`), `data.quoteId` carries the id. Persists `{id, at}[]` to `scheduledQuoteIds` and today's `dateKey` to `lastScheduledDate` (`:135-136`). Titles are picked randomly from the `notifications.titles` array in the active locale (`:54-60`) |
| `syncDeliveredToHistory()` | `:145` | Two sources: notifications currently in the tray (`getPresentedNotificationsAsync`, `:152`) and stored `{id, at}` entries whose `at <= now` (`:162-174`, which also prunes them). Prepends to `seenHistory` newest-last-wins, caps at 200. Returns the new array or `null` |
| `rescheduleIfNeeded(settings)` | `:189` | Reschedules when `lastScheduledDate !== today`, **or** when `scheduledQuoteIds` is detected in the legacy `number[]` format (`:200-202`) |
| `cancelAll()` | `:73` | `cancelAllScheduledNotificationsAsync` |

Pure time math lives in `src/utils/timeUtils.ts` with injectable `rng` for determinism:
`generateRandomTimes` (`:35`) progressively halves the gap when the window is too tight
(`:60-62`) and then fills with unique randoms (`:66-71`); `isValidWindow` requires
`MIN_WINDOW_MINUTES = 120` (`types/settings.ts:44`).

**Notification handling.**
`Notifications.setNotificationHandler` is registered at module scope of
`src/hooks/useNotifications.ts:8-21` (banner + list + sound, no badge).
`useNotificationObserver` (`:35`) handles both cold start
(`getLastNotificationResponseAsync`, `:50`) and warm taps
(`addNotificationResponseReceivedListener`, `:57`), routing to `/quote/${quoteId}`.
Separately, `_layout.tsx:60-64` listens for *foreground receipt* and records the quote into history
without navigating. `quote/[id].tsx:33-35` records the opened quote — but **only if
`!quote.isPremium`**, because Home's history resolves ids through the static array only.

### Android widget

| File | Role |
|---|---|
| `app.json:65-82` | Declares widget `DriftStop`, 250×110 dp min, 4×2 cells, `updatePeriodMillis: 1800000` (30 min) |
| `index.js:7-11` | Registers the task handler before the router — the only reason a custom entry exists |
| `src/widgets/widget-task-handler.tsx:20` | Headless lifecycle handler. Returns early on `WIDGET_DELETED`; reads `seenHistory[0]` for the last-seen quote (`:25-27`), falls back to a random static quote (`:33`). **`renderWidget` is called unconditionally** (`:36`) — the comment at `:16-18` explains that skipping it leaves a transparent widget |
| `src/widgets/DriftStopWidget.tsx` | The widget UI as `FlexWidget`/`TextWidget`. Cannot use hooks/context, so colors come straight from `DarkColors` — **the widget is always dark**. Length and font size come from `metricsFor(height, width)`: ≥170 dp (lock screen 4×3) gets 200 chars, ≥100 dp gets 110, below that 70/50. Whole i18n block wrapped in try/catch with hardcoded Turkish fallbacks. Tapping opens `driftstop://quote/<id>` via `clickAction="OPEN_URI"` |
| `plugins/withLockScreenWidget.js` | Patches the generated `widgetprovider_driftstop.xml` to `android:widgetCategory="home_screen|keyguard"`. The library hardcodes `home_screen` and its `Widget` type exposes no `widgetCategory`. ⚠️ **Must be FIRST in `app.json`'s `plugins`** — Expo runs mods last-added-first, so from any later position this silently does nothing |
| `src/widgets/updateWidget.tsx` | In-app push: guards on `nativeFeaturesAvailable && Platform.OS === 'android'`, writes `widgetQuoteId`, then `requestWidgetUpdate` with `widgetNotFound: () => {}`. **Passes `info.height`/`info.width` through to the component** — without it an in-app update resets a tall lock-screen widget to home-screen metrics. Called from Home whenever the displayed quote changes |

### Lock screen quote (`src/utils/lockScreenQuote.ts`)

The quote the user last saw, kept on the Android lock screen under the clock as a **persistent silent
notification**. Separate from the widget on purpose: the lock screen *widget* surface only exists on
Android 16 QPR2+, while a notification reaches the lock screen of every Android phone.

| Export | Role |
|---|---|
| `ensureLockScreenChannel()` | Creates channel `lockscreen`. **DEFAULT importance, `sound: null`, vibration off, no badge** |
| `showLockScreenQuote(id)` | Posts with a fixed identifier so each call replaces the previous one. `sticky: true` + `autoDismiss: false` → `FLAG_ONGOING_EVENT`, cannot be swiped away |
| `hideLockScreenQuote()` | Dismisses and cancels |
| `syncLockScreenQuote(enabled, id)` | Single entry point; called from Home on every quote change and whenever `settings.lockScreenEnabled` flips |

**Two things that look right in code and are wrong on the device** — both found by reading `dumpsys`,
not by reading the config:

1. **`trigger: null` carries no channel.** The notification lands in expo's
   `expo_notifications_fallback_notification_channel`, which is HIGH importance **and makes a sound**.
   The channel is passed through `ChannelAwareTriggerInput`: `trigger: { channelId }`. Same "immediate"
   semantics, correct channel.
2. **`IMPORTANCE_MIN` hides the quote.** Android 16 shrinks MIN/LOW notifications on the lock screen to
   a dot, so nothing is readable. The channel has to be DEFAULT importance to render as a card; silence
   comes from `sound: null` and `enableVibrate: false` instead.

🟡 **Known limit, observed not assumed:** Android 16 collapses the notification into an icon chip about
two minutes after posting. The quote reads as a full card while it is fresh (after each delivered
reminder, or after the user opens the app) and is one tap away after that. Making it permanent needs a
native `SCREEN_ON` receiver to re-post — not built.

### iOS lock screen widget (WidgetKit)

Android's persistent-notification trick has no iOS equivalent — iOS has no ongoing, undismissable
notification. The only thing that stays under the clock on an iOS lock screen is a WidgetKit
`accessoryRectangular` widget, so that is what iOS got.

| File | Role |
|---|---|
| `targets/quote/expo-target.config.js` | Target definition for `@bacons/apple-targets`. `type: "widget"`, bundle id `.quote` → `com.driftstop.app.quote`, deployment target 16.0 (the release `accessoryRectangular` shipped in). App Groups are read from the main app's config so the two can never drift apart |
| `targets/quote/index.swift` | The widget. `Provider` reads `lastQuote` from `UserDefaults(suiteName:)`; timeline policy `.never` because the app pushes updates rather than the widget polling. Families: `accessoryRectangular` (lock screen), `accessoryInline`, `systemSmall`, `systemMedium`. `widgetURL` deep-links to `driftstop://quote/<id>` |
| `src/widgets/updateIosWidget.ts` | Writes `{id, text, author}` into the App Group via `ExtensionStorage`, then `reloadWidget()`. The `@bacons/apple-targets` import is lazy so Expo Go does not blow up |
| `src/widgets/updateWidget.tsx` | `updateWidgets(quoteId)` — the platform-agnostic entry point Home calls; it fans out to the Android widget and the iOS one |

`app.json` gained `ios.appleTeamId` (the plugin refuses to sign the extension without it) and
`ios.entitlements["com.apple.security.application-groups"] = ["group.com.driftstop.app"]`.

⚠️ **The App Group string is load-bearing and fails silently.** If `APP_GROUP` in the Swift file, the
constant in `updateIosWidget.ts`, and `app.json`'s entitlement ever disagree, `UserDefaults` returns
nil, the widget quietly renders its fallback quote, and nothing errors. `iosLockScreenWidget.test.ts`
asserts all three match.

⚠️ **`CODE_SIGNING_ALLOWED=NO` strips entitlements**, so a simulator build made that way has no App
Group at all and the widget always shows the fallback — which looks exactly like a broken data path.
Build simulator test builds with ad-hoc signing instead:
`CODE_SIGN_IDENTITY="-" CODE_SIGNING_REQUIRED=NO AD_HOC_CODE_SIGNING_ALLOWED=YES`.

**Verified on an iPhone 17 Pro simulator (iOS 26.5):** the widget appears in the lock screen widget
picker, its preview renders the real quote from the App Group, and after adding it the quote sits
under the clock before unlocking — and unlike Android's notification it stays there indefinitely.

**Android's widget** still uses `react-native-android-widget`, which is Android-only; the registration
(`index.js`) and the Android update call remain platform-guarded.

---

## 9. i18n

Setup: `src/i18n/index.ts:33` constructs `new I18n({tr, en, es, de, fr, it, ar, ja})`, then
`locale = 'tr'`, `enableFallback = true`, `defaultLocale = 'tr'` (`:35-37`).
`SUPPORTED_LANGUAGES` (`:16-25`) marks **tr, en, es, de, fr, it** as `available: true` and
**ar, ja** as `available: false` (shown in the picker as "coming soon").
`AVAILABLE_LANGUAGE_CODES` (`:29-31`) is what `detectLanguage()` matches against.

`useTranslation()` (`src/i18n/useTranslation.ts:10`) reads `settings.language`, syncs
`i18n.locale` **during render** (`:13-15`) and returns `{ t, locale }`. Non-React callers
(`utils/scheduler.ts`, `utils/share.ts`, `widgets/DriftStopWidget.tsx`) import the `i18n` singleton
directly — which is why `useSettings.update` sets `i18n.locale` *before* calling `applySchedule`
(`useSettings.tsx:71-73`).

Locale files: `src/locales/{tr,en,es,de,fr,it,ar,ja}.json`, top-level namespaces
`app, onboarding, home, quote, favorites, settings, notifications, share, widget, errors, common,
themes, auth, paywall, trial, packs, ads, wallpaper`. tr has **229 leaf keys**; ar and ja have
**150** (79 missing — they carry only the `paywall.packages` price strings, not the whole namespace).

**Placeholders are `{{name}}` *or* `%{name}`** — i18n-js's default pattern is
`/(?:\{\{|%\{)(.*?)(?:\}\}?)/`, which accepts both. The trap: Turkish writes the percent sign
*before* the number, so `"%{{percent}} tasarruf"` is parsed as the `%{…}` form, the placeholder name
comes out as `{percent`, and the screen renders `[missing "%{{percent}}" value]`. Percent signs are
therefore never typed into a locale file — `formatPercent` (`src/utils/pricing.ts`) asks
`Intl.NumberFormat` where the sign goes (`%24` in tr, `24%` in en, `24 %` in fr) and the string
interpolates the finished text.

**Parity test** — `src/i18n/__tests__/locales.test.ts`. Its `ACTIVE` map covers only the six
available locales and asserts (a) identical flattened key structure to `tr` including array lengths,
(b) no empty string values, (c) the eight paywall price strings interpolate through the real `i18n`
instance with no `[missing …]` and no leftover `{{`, (d) every locale's `billedMonthly`/`billedAnnual`
still names a billing period next to `{{price}}` and the a11y strings still carry both `{{price}}`
and `{{perWeek}}`, (e) `share.quoteTemplate` keeps both `{{quote}}`
and `{{author}}` placeholders. **ar/ja are excluded**, so their gaps don't fail CI.

### `quoteLocalization` vs `quoteText` — two different things

These are frequently confused. They are unrelated:

| | `src/i18n/quoteLocalization.ts` | `src/utils/quoteText.ts` |
|---|---|---|
| Concerns | **Attribution metadata**: the origin/country name and generic author *labels* | **The quote body text itself** |
| API | `localizeOrigin(origin, locale)` (`:125`), `localizeAuthor(author, locale)` (`:132`) | `quoteDisplayText(quote, locale)` (`:4`) |
| Mechanism | Two hand-maintained lookup tables — `ORIGIN_L10N` (~59 countries/regions, `:3-60`) and `AUTHOR_LABEL_L10N` (~60 proverb/wisdom labels like `'Türk Atasözü'`, `:62-123`) — each with `{en, es, de, fr, it}`. Source language is **Turkish**: `lang === 'tr'` or an unmapped key returns the input unchanged (`:128,135`) | One expression: `locale.startsWith('tr') && quote.textTr ? quote.textTr : quote.text` |
| Scope | Only generic labels. **Named people (Marcus Aurelius, Nietzsche…) are never in the table** and pass through verbatim — correct behaviour | Every quote has both `text` (original/English) and `textTr` |
| Callers | `scheduler.ts:121`, `share.ts:18`, `DriftStopWidget.tsx:35`, `packs/index.tsx:14`, `packs/author/[name].tsx` | `scheduler.ts:116`, `share.ts:14`, `DriftStopWidget.tsx:33`, `QuoteCard` |

Pack names/descriptions are a third mechanism: `localizedPackField()` (`src/types/quotePack.ts:15-22`)
reads a jsonb map with fallback chain `lang → tr → en → first value`.

---

## 10. Testing & quality gates

```bash
npx tsc --noEmit     # type check (strict)
npm test             # jest — 17 suites, 132 tests, ~1.5 s
npm run lint         # expo lint (eslint flat config, eslint-config-expo)
```

Jest config (`jest.config.js`): `jest-expo` preset, `@/*` → `src/*` mapper,
`testMatch` only `**/__tests__/**/*.test.ts(x)`. `jest.setup.js` installs the official
AsyncStorage mock, so tests may exercise `utils/storage.ts` for real.

CI (`.github/workflows/ci.yml`) on push/PR to `main`: `npm ci` → `npx tsc --noEmit` →
`npx jest --ci` → `npx expo lint || true`. **Lint is deliberately non-blocking**; the comment in
the workflow explains that the React Compiler rules misfire on Reanimated's `.value =` mutation API
and on the async-effect setState pattern used throughout the repo (see the several
`eslint-disable-next-line` markers in `usePacks.tsx:41,53,64,66`, `useHistory.tsx:68`).

### What the 285 tests actually cover

| Suite | Covers |
|---|---|
| `src/data/__tests__/quotes.test.ts` (8) | Dataset integrity: 1000 rows, sequential unique ids, valid non-empty fields, no unknown attributions, unique TR texts, 1–4 valid tags, `getQuoteById`, `getQuotesByThemes` filter + fallback |
| `src/data/__tests__/quotesAnySource.test.ts` (10) | Static-first lookup, SQLite fallback, miss case, and the entitlement gate: free quotes always resolve, cached premium → `locked` without entitlement, purged premium id → `locked`, `getPackQuotes` drops premium rows, `getAuthorQuotes` returns `[]` (cache module mocked) |
| `src/utils/__tests__/timeUtils.test.ts` (10) | `formatHM`, `toMinutes`/`windowOf`, `isValidWindow`, `isWeekend`, `dateKey`, `generateRandomTimes` (count/sort/uniqueness/tight-window) |
| `src/utils/__tests__/quoteSelector.test.ts` (7) | `randomIndex` bounds + exclusion, `pickUnseenQuoteId` incl. exhausted-pool reset |
| `src/utils/__tests__/share.test.ts` (3) | Template interpolation (no `[missing …]`), TR text selection, cancelled-share swallow |
| `src/utils/__tests__/pricing.test.ts` (15) | Paywall arithmetic: per-week for both plans, the monthly×12 baseline, saving **floored** (24.83% → 24, exact 25% → 25), and every guard — monthly missing, annual missing, annual not cheaper, saving under 1%, mismatched currencies, NaN/zero/blank-currency prices. Plus formatting: store currency (not `$`) and locale-correct percent placement, each with the honest fallback used when `Intl` throws |
| `src/utils/__tests__/crashReporting.test.ts` (4) | Sentry init/report gated on DSN presence |
| `src/services/__tests__/quotesSync.test.ts` (12) | Always seeds first, upsert + cursor advance, pagination, error swallow, unconfigured no-op; `syncPremiumQuotes` filters on `is_premium` with **no** `updated_at` cursor, never advances the cursor, paginates, swallows errors, no-ops unconfigured, and writes nothing when the caller cancels mid-fetch |
| `src/services/__tests__/premiumCacheGuard.test.ts` (25) | `'unknown'` never purges (the paying-user-with-a-failed-fetch case), purge on entitlement loss, no download while purging, cheap no-op for free users, cache-sufficiency rules (partial cache re-downloads, backfill watermark stops the re-download loop, missing pack metadata falls back to "not empty"), re-subscribe restore + tombstone clearing, `restore-pending`, cancellation, errors swallowed on both destructive paths, and the version counter bumping/notifying only on real changes |
| `src/db/__tests__/quotesCache.test.ts` (13) | Purge SQL is scoped to `is_premium = 1` (free rows untouched), tombstones written before the delete, no writes when nothing is cached, tombstone lookup/clear, the `premium_backfill_count` watermark round-trip, and that no ungated "read every cached quote" helper exists (`expo-sqlite` mocked) |
| `src/db/__tests__/packsCache.test.ts` (3) | `getExpectedPremiumQuoteCount` sums `quote_count` over premium packs only; 0 when metadata never synced |
| `src/hooks/__tests__/usePremiumCacheGuard.test.tsx` (11) | Acts **only** once entitlement is known: no action while loading, none when `loading` finished but `customerInfo` never arrived, none when unconfigured; purge when not Pro, restore when Pro + signed in, skip restore without a session, act after the state becomes known, cancellation probe flips on teardown, retry on `restore-pending`, no retry after `cancelled` |
| `src/__tests__/favoritesPremiumInvalidation.test.tsx` (6) | Favorites screen: locked row for a lapsed subscriber, **re-reads the cache when the restore lands after the purchase** (nothing else changes — this is the memo-dependency regression test), re-reads after a purge, loading row instead of a lock while entitlement resolves, lock once it resolves, free favourites never delayed |
| `src/services/__tests__/packsSync.test.ts` (4) | camelCase mapping, empty, error, unconfigured |
| `src/services/__tests__/authorsSync.test.ts` (4) | same four shapes for the RPC |
| `src/i18n/__tests__/locales.test.ts` (5) | Locale key parity / non-empty / placeholder retention (6 active locales), plus: every locale states the **billing period** beside the charged amount and keeps `{{price}}` + `{{perWeek}}` in the paywall a11y strings |
| `src/__tests__/paywallPriceEmphasis.test.tsx` (4) | Paywall price hierarchy: per-week is the largest number on both rows, the billed amount stays at body size (never below the struck baseline), no bare amount without its period is on screen, and the a11y label still carries the real charge + period + weekly + saving |
| `src/hooks/__tests__/useSettings.test.tsx` (4) | Device-locale fallback, AsyncStorage persistence, **reschedule only on schedule-affecting fields**, throw outside provider |
| `src/hooks/__tests__/useAuthSocial.test.tsx` (8) | `signInWithProvider`'s three outcomes: Google/Apple cancellation → `{ error: null, cancelled: true }` and **no** call to Supabase, real sign-in → not cancelled, every `SocialError` reason → its own key with `cancelled` unset, Supabase rejecting the id token → mapped error |
| `src/__tests__/authScreenSocialCancel.test.tsx` (3) | `/auth` after a social attempt: cancel keeps the screen open with no error line and a tappable button, a real failure renders the error line and keeps it open, a real success calls `router.back()` |
| `src/components/__tests__/ErrorBoundary.test.tsx` (4) | Renders children, fallback on throw, reports error, retry action |

### What has **no** test coverage

| Area | Files |
|---|---|
| **Notification scheduling — the app's core feature** | `src/utils/scheduler.ts` (all 6 exports; only its `timeUtils` helpers are tested) |
| SQLite cache layer | `src/db/quotesCache.ts` (only the purge/tombstone/watermark SQL is tested), `src/db/packsCache.ts` (only `getExpectedPremiumQuoteCount`) — the seed transaction, the upserts, the read queries, the blind `alter table` |
| Most state | `useHistory`, `usePurchases` (incl. the `entitlementKnown`/`loading` split — only its *consumers* are tested), `useAuth`'s email/session paths (its **social** path is covered), `usePacks`, `useFavorites`, `useEnforceFreeLimits`, `useNotifications`, `use-theme` (`usePremiumCacheGuard` **is** covered) |
| Ads | `src/utils/ads.ts` (suppression, gap capping), `src/constants/adUnits.ts` id selection, `AdBanner` |
| Widget | `src/widgets/*` — the headless handler, its fallbacks, the deep-link URI |
| Screens | All 10 routes + both layouts under `src/app/` — except Favorites' premium locked/loading/invalidation paths (`src/__tests__/favoritesPremiumInvalidation.test.tsx`) `/auth`'s social-outcome branch (`src/__tests__/authScreenSocialCancel.test.tsx`) and the paywall's
price hierarchy (`src/__tests__/paywallPriceEmphasis.test.tsx`). `quote/[id]`, `packs/[id]` and `packs/author/[name]` carry the same invalidation wiring with **no** test |
| Pure helpers | `src/utils/sketch.ts`, `src/utils/quoteText.ts` (indirect only), `src/i18n/quoteLocalization.ts`, `src/types/quotePack.ts:localizedPackField` |
| Backend | Both edge functions (no Deno test runner configured), all SQL/RLS policies, every script in `scripts/` |
| Config | `plugins/withGradleVersion.js` |

`tsconfig.json:22` excludes `supabase/functions/**` from type checking (they are Deno, with
`jsr:` imports), so **the edge functions are neither type-checked nor tested by any gate.**

---

## 11. Conventions

A new contributor must match these to keep diffs consistent:

1. **Code comments are in Turkish.** Doc comments, inline rationale, and `eslint-disable`
   justifications are all Turkish prose (e.g. `useHistory.tsx:36-39`, `ads.ts:12`,
   `quotesAnySource.ts:5-12`). User-facing strings go through i18n; identifiers, types and test
   names are English. Test descriptions are English (`quotes.test.ts`).
2. **Comments explain *why*, at length.** The codebase leans on multi-line rationale blocks before
   non-obvious decisions — platform quirks (`index.js:1-4`), deliberate architectural limits
   (`quotesCache.ts:6-12`), and workarounds (`scheduler.ts:35-36`, `purchases.ts:6-8`). Preserve
   this: several of these comments are the only record of a bug that was already paid for.
3. **`@/` path alias for all intra-src imports** (`tsconfig.json:5-12`, mirrored in
   `jest.config.js:3-5`). Relative imports appear only for siblings inside the same folder
   (`i18n/useTranslation.ts:4`, `widgets/widget-task-handler.tsx:6`).
4. **Import order**: third-party first, then `@/…` groups, alphabetical-ish within a group. See
   `src/app/(tabs)/index.tsx:1-28`.
5. **`StyleSheet.create` at the bottom of the file**, after the component, named `styles`
   (`ThemedText.tsx:52`, `(tabs)/index.tsx:157`, `paywall.tsx:155`). Dynamic values (theme colors,
   insets) are applied inline in the `style` array, never baked into the sheet.
6. **Never hardcode colors, fonts, or spacing.** Use `useTheme().colors`, `Fonts`/`FontSizes`, and
   `Spacing`/`Radius`. The two intentional exceptions are documented: `ErrorBoundary` (must survive
   a broken ThemeProvider, `:14-19`) and `DriftStopWidget` (no React context in a native widget,
   `:11`).
7. **Text goes through `ThemedText`**, never bare `<Text>`. Pick a `variant`
   (`quote|quoteLarge|author|label|title|heading|body`) and optionally a `tone` (a `ThemeColors`
   key); each variant has a default tone (`ThemedText.tsx:35-43`).
8. **The hand-drawn "sketch" family.** Chrome is SVG generated by `src/utils/sketch.ts` —
   `wobblyRectPath`, `roughRectPath`, `wavyLinePath`, `cornerBracketPaths`, `brushStrokePath`,
   `grainDots`. All deviations are **deterministic** (`sin`-based `wobble`, `:7-10`), never random,
   so components don't jitter on re-render. New decorative chrome belongs here, not in a new
   random-based helper. Icons: `phosphor-react-native` with `weight="thin"`.
9. **Accessibility props are expected on every touchable**: `accessibilityLabel` (translated),
   `accessibilityRole`, `accessibilityState`, plus `hitSlop` — see `(tabs)/_layout.tsx:57-61`,
   `AdBanner.tsx:24-26`, `(tabs)/index.tsx:113-114`, `ErrorBoundary.tsx:49-50`.
10. **Fail silently for optional infrastructure.** The established pattern: if an env key or native
    module is absent, expose a `configured` boolean and no-op — `supabase.ts:12`, `purchases.ts:15`,
    `crashReporting.ts:11`, `runtime.ts:11`, `storage.ts:21,30`, all three `services/*`. User-facing
    errors are only surfaced for actions the user explicitly took (purchase, auth).
11. **`nativeFeaturesAvailable` guards every native call** (`src/utils/runtime.ts:11`) so the app
    still runs in Expo Go with notifications/ads/widget disabled.
12. **Types are `const` arrays + derived unions**, not enums:
    `QUOTE_CATEGORIES`/`QUOTE_ERAS`/`QUOTE_TAGS` (`types/quote.ts`), `FREQUENCY_OPTIONS`
    (`types/settings.ts:6`), `SUPPORTED_LANGUAGES` (`i18n/index.ts:16`).
13. **Context hooks throw a Turkish error when used outside their provider** — the exact wording
    `"useX, XProvider içinde kullanılmalı."` (`useSettings.tsx:98`, `use-theme.tsx:40`,
    `useAuth.tsx:94`, `usePurchases.tsx:145`, `useHistory.tsx:128`).
14. **Async effects use an `active`/`mounted` flag** to avoid post-unmount `setState`
    (`useSettings.tsx:52-66`, `useFavorites.ts:10-21`, `useAuth.tsx:42-56`, `usePurchases.tsx:51`).

---

## ⚠️ Risks & untested areas

Ordered roughly by blast radius.

1. **The core feature is untested.** `src/utils/scheduler.ts` — permission handling, 3-day
   scheduling loop, delivered→history migration, legacy-format detection — has **zero direct
   tests**. Every regression here is silent: the user simply stops getting notifications, and
   nothing logs. `syncDeliveredToHistory` (`:145-186`) is the most intricate untested function in
   the repo (two data sources, mutation of persisted state, cap logic).
2. **Entitlement leak after Pro lapses — fixed (2026-07-25), on-device behaviour still unverified.**
   Premium rows are purged from SQLite whenever entitlement is **known** to be absent
   (`usePremiumCacheGuard` → `reconcilePremiumCache`, every launch, plus an explicit purge in
   `useAuth.signOut`/`deleteAccount`), and every any-source reader requires `{ entitled }`
   (`quotesAnySource.ts`). Recovery uses `syncPremiumQuotes`, which ignores the delta cursor.
   The destructive branch is gated on `entitlementKnown` (not `!loading`) and on the three-state
   `PremiumEntitlementState`, so a failed `getCustomerInfo()` can no longer be read as "no
   entitlement". Completeness is measured against `packs.quote_count` plus a
   `premium_backfill_count` watermark, so a partial cache converges instead of sticking.
   Remaining caveats: **the purge/restore path has never been exercised on a device**; the restore
   depends on the RevenueCat webhook having written `profiles.is_premium`, so it retries at
   3/8/20 s and otherwise waits for the next launch; and screens are refreshed through a single
   module-level counter (`usePremiumCacheVersion`) — a new screen that reads the cache without
   depending on it will show stale locks (only Favorites has a test for this).
3. **No delete/tombstone propagation in sync.** `syncQuotes` only fetches
   `updated_at > cursor` (`quotesSync.ts:46`). A quote deleted or unpublished server-side lives on
   in every client's SQLite indefinitely. There is also no cursor reset path: if the local `meta`
   row is ever wrong (clock skew, partial write), the client silently stops receiving updates.
4. **iOS monetisation is effectively dead code.**
   - `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` is referenced (`lib/purchases.ts:11`) but **absent from
     `.env.example`** → `purchasesConfigured` is false on iOS → paywall shows
     `paywall.errors.notConfigured` and no Pro gating applies at all
     (`useEnforceFreeLimits.ts:18` bails when `!configured`, so free iOS users get frequency 10).
   - Knock-on for premium content: with `configured` false, `getCustomerInfo()` is never called, so
     `entitlementKnown` stays false and `isPro` stays false. Any premium favourite renders as a
     **locked row with no unlock CTA** on iOS (the CTA itself is gated on `configured`). No data is
     lost — `usePremiumCacheGuard` also does nothing when unconfigured — but the lock has no exit.
     The rationale sits at the origin, `src/lib/purchases.ts` (`purchasesConfigured`); tracked as
     TODO #9 and resolved by shipping the iOS key, not by faking entitlement client-side.
   - iOS ad unit ids are empty strings (`constants/adUnits.ts:10,12`) → iOS **always** serves
     `TestIds`, in release builds too; and `app.json:62` uses Google's sample publisher app id
     `ca-app-pub-3940256099942544~…`. Shipping to the App Store in this state means zero ad revenue
     and, potentially, a policy review flag.
5. **Synchronous SQLite on the JS thread at boot and during render.** `seedIfEmpty()` inserts 1000
   rows in one blocking `withTransactionSync` (`quotesCache.ts:64-88`) and is called from
   `syncQuotes()` fired in the mount effect (`_layout.tsx:48`). `usePacks` calls
   `getAllCachedPacks()`/`getCachedPremiumAuthorCounts()` **inside `useMemo`** during render
   (`usePacks.tsx:35,48`). On low-end Android this is a visible hitch, and it is untested.
6. **Two SQLite connections to one file.** `quotesCache.ts:29` and `packsCache.ts:22` each hold
   their own `openDatabaseSync('driftstop.db')` handle with independent `create table`/`alter table`
   bootstraps, including a blind `alter table` in a swallowing `try/catch` (`packsCache.ts:38-43`)
   that would hide a genuine migration failure. Any future write contention or schema change has to
   be reasoned about across both modules.
7. **`useFavorites` is per-consumer, not shared.** Home, Favorites and `/quote/[id]` each mount an
   independent copy (`(tabs)/index.tsx:35`, `quote/[id].tsx:24`). Concurrent screens can show stale
   favourite state and can clobber each other's writes (`useFavorites.ts:23-27` persists the whole
   array). The server `favorites` table exists with correct RLS but is unused — favourites are
   device-local and lost on reinstall, despite the app having accounts.
8. **Premium ids must never enter `seenHistory`.** Home resolves history ids through the static
   array only (`useHistory.tsx:106` → `getQuoteById`), so a premium id renders a blank card. Today
   this is guarded in exactly one place — `quote/[id].tsx:34` (`if (quote && !quote.isPremium)`) —
   an implicit invariant with no test. The widget handler degrades gracefully
   (`widget-task-handler.tsx:27,33`), but any new `record()` call site can break Home.
9. **Webhook auth is optional at runtime.** `revenuecat-webhook/index.ts:59` only enforces the
   shared secret **if `REVENUECAT_WEBHOOK_AUTH_TOKEN` is set**. If the secret is missing or cleared
   in the deployment, the function is deployed `--no-verify-jwt` and becomes an unauthenticated
   endpoint that can grant `profiles.is_premium` to any UUID. There is no signature verification
   and no replay protection.
10. **Edge functions bypass every quality gate.** Excluded from `tsc`
    (`tsconfig.json:22`), no Deno tests, not exercised in CI. Both use non-null assertions on env
    vars (`delete-account/index.ts:30-32`) which would throw at request time if a secret is missing.
11. **RLS/SQL is untested.** The premium read policy (`0001:86-94`) and the `SECURITY DEFINER` RPC
    (`0003:12-25`) are the entire content paywall. `get_premium_author_counts` is granted to `anon`
    by design — safe today because it selects only `author, count(*)`, but any future edit to that
    function body leaks premium text to anonymous callers with no test to stop it.
12. **ar/ja locales are 79 keys short of tr (155 vs 234) and excluded from the parity test**
    (`locales.test.ts:9`). They are hidden by `available: false` (`i18n/index.ts:23-24`); flipping
    that flag ships a half-Turkish UI (via `enableFallback`) with a green CI. There is also no
    RTL handling anywhere for Arabic.
13. **DST / timezone fragility.** `dateAt` uses `setHours(0, minuteOfDay, 0, 0)`
    (`timeUtils.ts:90-94`) and schedules 3 days out; a DST transition inside that window shifts fire
    times by an hour. `dateKey` is local-time based (`:82-87`), so travelling across timezones can
    skip or double a reschedule. Untested.
14. **Vestigial state keys** — `driftstop:widgetQuoteId` is written and never read
    (`updateWidget.tsx:15`); `driftstop:themeMode` and `driftstop:seenToday`
    (`storage.ts:11,10`) are written and read by nothing. Harmless, but they mislead readers about
    where state lives.
15. **`Links.rateAndroid` is empty** (`constants/links.ts:7`) so the "rate the app" row renders as
    "coming soon" even though the app has shipped to Play.
16. **Lint is not a gate.** The React Compiler / Reanimated conflict is real, but the consequence is
    that any *new* lint error also lands silently (`.github/workflows/ci.yml`, "non-blocking" step).
    Read the lint output manually before merging.
