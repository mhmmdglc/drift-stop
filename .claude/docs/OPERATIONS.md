# DriftStop — Operations Runbook

Everything needed to build, test, and ship DriftStop from a clean machine. Accounts, environment, gates, releases, and the gotchas that cost real releases.

Scope: this is the *operational* doc. Product/architecture rationale lives in [build-plan.md](build-plan.md) and [backend-roadmap.md](backend-roadmap.md); the Play Console UI walkthrough lives in [google-play-publishing-guide.md](google-play-publishing-guide.md); currently-open work lives in [TODO.md](TODO.md).

**No secret values appear in this document.** Secrets are referred to by variable name plus where they live.

---


### ⚠️ AdMob: her zaman `?authuser=1` ile aç

Bu Mac'teki Chrome'un **birincil** Google hesabı, AdMob'un **kapattığı eski hesap**.
`admob.google.com` düz açıldığında "Hesabınız kapatıldı" ekranına düşüyor ve yeni hesabın
öldüğü sanılıyor — bir oturum tam olarak buna zaman kaybetti.

Yeni (çalışan) yayıncı hesabı `authuser=1`:

```
https://admob.google.com/v2/apps/list?authuser=1
```

Yeni hesabın yayıncı kimliği `pub-6963122807813930`. Android tarafı orada kurulu:
uygulama `DriftStop` (`ca-app-pub-6963122807813930~1493084605`), banner ve geçiş
birimleri aktif. Ayrıca AdMob oturumu sık düşüyor; düştüğünde tarayıcıdan Google
girişi gerekiyor ve bunu ajan yapamaz (kimlik bilgisi girişi).


## Table of contents

1. [Accounts & ownership](#1-accounts--ownership)
2. [Environment variables](#2-environment-variables)
3. [Local development](#3-local-development)
4. [Quality gates](#4-quality-gates)
5. [Database & backend operations](#5-database--backend-operations)
6. [Release process (Android)](#6-release-process-android)
7. [Release process (iOS)](#7-release-process-ios)
8. [Store constraints](#8-store-constraints)
9. [QA test accounts](#9-qa-test-accounts)
10. [Troubleshooting index](#10-troubleshooting-index)

---

## 1) Accounts & ownership

### ⚠️ Gotcha: the Play Console / Expo account is NOT the user's personal Google account

The Google Play Console listing for DriftStop **and** the Expo/EAS project are both owned by **`evolaroa.app@gmail.com`**. The user's personal `muhammed.gulcu@gmail.com` account has its own, separate Play developer profile ("Muhammed Gülcü") which is **closed/suspended** (Policy status → "Hesap kapatıldı", closed 15 Mar 2024) and has **nothing to do with DriftStop**. If you land on a Play Console that shows no DriftStop app, or shows a suspended account banner, you are signed into the wrong account — switch via the account-picker pill at the top of the page.

| Asset | Owner / identifier | Notes |
|---|---|---|
| Google Play Console (developer) | `evolaroa.app@gmail.com` — developer name "evolaroa app", account id **5307704099308379347** | Personal (not organization) account type → subject to the 12-tester rule, see §8 |
| Play Console app record | app id **4975806618322585367**, package `com.driftstop.app` | Package name is permanent |
| Expo / EAS project | owner `evolaroa.app` (`app.json` → `expo.owner`), projectId `fb1bca5b-8847-4c5f-9073-fa68ad53f539`, slug `drift-stop` → `@evolaroa.app/drift-stop` | `eas whoami` must report `evolaroa.app` |
| GitHub (app source) | `git@github.com:mhmmdglc/drift-stop.git`, branch `main` | |
| Supabase | project ref **`ftohdffebzhrthrpeuos`**, region **`ap-northeast-1`** (Tokyo) | URL `https://ftohdffebzhrthrpeuos.supabase.co` |
| RevenueCat | project **"DriftStop"** (`proj9019ea60`); Android app `com.driftstop.app` (`app2be5c8cadb`) | An auto-created sample iOS app ("EvolaRoa") exists and is unused — leave it alone |
| Google Cloud | project **`extreme-lattice-470518-d8`** (display name "My First Project") | Hosts the RevenueCat service account, the Google Play Android Developer API, and the Pub/Sub topic `driftstop-play-notifications` |
| AdMob | app + banner + interstitial units; IDs live in `app.json` (plugin config) and `src/constants/adUnits.ts` | Real IDs in prod, Google test IDs under `__DEV__` |
| Privacy policy site | repo `~/workspace/MyWorkspace/my-site` → `git@github.com:mhmmdglc/my-website.git` | Page source `app/driftstop/privacy/page.tsx`; serves https://mgulcu.me/driftstop/privacy; **auto-deploys on push to `main`** — no manual deploy step |
| Android upload keystore | `credentials/driftstop-upload.keystore` + `credentials.json` (both gitignored) | See the keystore warning below |

### Store / product identifiers

| Thing | Value |
|---|---|
| Android package / iOS bundle id | `com.driftstop.app` |
| Current app version | `1.0.1` (`app.json` → `expo.version`) |
| Current Android versionCode | `11` |
| Current iOS buildNumber | `1` |
| IAP product ids | `remove_ads` (one-time), `pro_monthly`, `pro_yearly` |
| RevenueCat entitlements | `pro`, `no_ads` (both subscriptions grant both; `remove_ads` grants `no_ads` only) |
| RevenueCat offering | `default` (Lifetime / Annual / Monthly packages) |
| Closed-testing opt-in link | https://play.google.com/apps/testing/com.driftstop.app |

### ⚠️ Gotcha: `credentials/` and `credentials.json` are gitignored, but production builds depend on them

`eas.json` sets `"credentialsSource": "local"` for both the `preview` and `production` profiles. That means EAS does **not** manage the signing key — it reads `credentials.json`, which points at `credentials/driftstop-upload.keystore` and carries the keystore/key passwords. Both paths are in `.gitignore`, so **a fresh clone cannot produce a signed production build** until those files are restored from backup. `credentials.json` structure (values redacted):

```
{ "android": { "keystore": { "keystorePath", "keystorePassword", "keyAlias", "keyPassword" } } }
```

The keystore is the Play **upload key**. Losing it means no more updates without a Google Play App Signing key-reset request. Back it up off-machine. `credentials/KEYSTORE-INFO.txt` documents it locally.

---

## 2) Environment variables

Two completely separate stores must be kept in sync:

| Store | Read by | How to set |
|---|---|---|
| `.env` in the repo root (gitignored; template: `.env.example`) | Metro / local `expo run:*` builds, and the Node DB scripts via `dotenv` | edit the file |
| **EAS cloud Environment Variables** (per environment: `production` / `preview` / `development`) | `eas build` cloud builds | `eas env:create …` (below) |

### ⚠️⚠️ CRITICAL — EAS cloud builds never receive `.env`

> **`.env` is gitignored and there is no `.easignore` in this repo.** When `.easignore` is absent, EAS Build falls back to `.gitignore` to decide what to upload to its cloud build servers — so `.env` is silently excluded from **every** cloud build.
>
> **Every `EXPO_PUBLIC_*` variable must therefore ALSO be registered with EAS:**
>
> ```bash
> npx eas env:create --environment production --name EXPO_PUBLIC_EXAMPLE --value "<value>" --visibility plaintext --scope project
> ```
>
> Repeat per environment (`production`, `preview`, `development`) for whichever environments will build the feature.
>
> **The failure mode this caused:** versionCodes **7, 8 and 9** all shipped to the Play Store with **no Supabase and no RevenueCat configuration at all**. Nothing crashed and no error surfaced — `src/lib/supabase.ts` returns a `null` client and `src/lib/purchases.ts` sets `purchasesConfigured = false` when their keys are missing, so the features simply **no-opped silently**: no "Account" section in Settings, no sync, no premium, no paywall. Every earlier "verified on device" claim was true only for the local emulator (`expo run:android`, which reads `.env` straight from the dev server) and was never true for the shipped binary. `eas build` even printed *"No environment variables found for the 'production' environment"* on each of those builds and nobody read it.
>
> **Always do this after triggering a build:** open the build log and confirm the line
> `Environment variables with visibility "Plain text" and "Sensitive" loaded from the "production" environment on EAS: EXPO_PUBLIC_…`
> If that line is absent — or says *no environment variables found* — the binary is misconfigured. Do not upload it.

Verify at any time:

```bash
npx eas env:list --environment production
```

### Variable reference

| Variable | Purpose | `.env` | EAS env | Notes |
|---|---|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL used by `src/lib/supabase.ts` | ✅ required | ✅ required | `https://ftohdffebzhrthrpeuos.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable key (`sb_publishable_…` under Supabase's new key naming; replaces the old "anon key"). Without it, auth + quote/pack sync silently no-op | ✅ required | ✅ required | Supabase → Project Settings → API → **Publishable key** |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` | RevenueCat Android public SDK key (`goog_…` for the real Play Store app; `test_…` for the Test Store). Without it, `purchasesConfigured=false` → no paywall, no premium UI | ✅ required | ✅ required | RevenueCat → Project settings → Apps → [Android app] → Public API Key |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | RevenueCat iOS public SDK key | ❌ **does not exist yet** | ❌ not set | Until it exists, iOS purchases are cleanly disabled by design — `Platform.select` in `src/lib/purchases.ts` yields `undefined` and no purchase UI renders. Passing the Android key to iOS throws "invalid API key", so do **not** reuse it |
| `EXPO_PUBLIC_SENTRY_DSN` | Optional crash reporting (`src/utils/crashReporting.ts`). Unset ⇒ Sentry never initializes, app unaffected | optional | optional (must be added if you want it in shipped builds) | Sentry → Settings → Projects → Client Keys (DSN) |
| `SUPABASE_PASSWORD` | **Real Postgres credential.** Used only by `scripts/db-migrate.js`, `seed-quotes.js`, `seed-packs.js` | ✅ required for DB ops | 🚫 **never** — deliberately excluded | Not an `EXPO_PUBLIC_*` var; must never be bundled into the app |
| `DATABASE_URL` | Optional full connection-string override for the same three scripts (takes precedence over `SUPABASE_PASSWORD`) | optional | 🚫 never | |

Supabase Edge Function secrets are separate again (`supabase secrets set`) — see §5. `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are injected automatically into every Edge Function; only `REVENUECAT_WEBHOOK_AUTH_TOKEN` was set by hand.

### ⚠️ Gotcha: adding a new client var is a two-place change, forever

Any new `EXPO_PUBLIC_*` var must go into `.env` **and** `eas env:create` for each environment. Skipping the second half reproduces the v7/8/9 failure exactly: no error, feature quietly absent from the store build.

---

## 3) Local development

Expo **SDK 56** with the **CNG (Continuous Native Generation)** workflow: `/android` and `/ios` are gitignored and regenerated by `expo prebuild`. Never hand-edit native files — changes are lost on the next prebuild. Native customization goes through config plugins in `app.json` (see `plugins/withGradleVersion`).

Read the exact versioned docs before writing code: https://docs.expo.dev/versions/v56.0.0/

### Install

```bash
npm install
```

Then create `.env` from `.env.example` and fill in the values (see §2).

### Run — iOS simulator

```bash
npx expo run:ios
```

### Run — Android emulator

The Android toolchain is **not** on `PATH` by default on this machine and bare `java` fails; Android Studio's bundled JBR is the working JDK.

SDK: `~/Library/Android/sdk` · AVD: **`Medium_Phone_API_36.1`**

```bash
export ANDROID_HOME=~/Library/Android/sdk
```

```bash
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
```

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
```

Boot the emulator (run it in the background — it does not return):

```bash
emulator -avd Medium_Phone_API_36.1 -no-snapshot -no-boot-anim
```

Wait for the device, then build + install + start Metro:

```bash
npx expo run:android
```

First build with warm caches is roughly a minute. Metro stays attached for Fast Refresh afterwards.

### ⚠️ Gotcha: a new native module needs a fresh native build

Fast Refresh only covers JS. After adding a package with native code (e.g. `react-native-purchases`, `react-native-android-widget`), kill the running `expo run:android` process and re-run it so CNG prebuilds and Gradle relinks. Editing JS and reloading will not pick up the new native module — you will get confusing "module not found"/undefined-native-module errors instead.

### ⚠️ Gotcha: `INSTALL_FAILED_INSUFFICIENT_STORAGE`

The AVD's data partition fills up quickly. Installs then fail with `INSTALL_FAILED_INSUFFICIENT_STORAGE`. Fix:

```bash
adb uninstall com.driftstop.app
```

```bash
adb uninstall host.exp.exponent
```

(`host.exp.exponent` is Expo Go — it is large and unnecessary once you are on dev builds.) Then trim caches:

```bash
adb shell pm trim-caches 1024M
```

Also keep the host Mac's disk above a few GB free — a nearly-full disk has broken local Gradle release builds before.

### Driving the emulator headlessly

Useful for automated verification without a visible window.

Screenshot (write the PNG, then open it with the Read tool to actually see it):

```bash
adb exec-out screencap -p > /tmp/screen.png
```

Tap / type / key:

```bash
adb shell input tap <x> <y>
```

```bash
adb shell input text 'hello'
```

```bash
adb shell input keyevent KEYCODE_ENTER
```

### ⚠️ Gotcha: get tap coordinates from `uiautomator`, never by eyeballing a screenshot

```bash
adb shell uiautomator dump /sdcard/ui.xml && adb shell cat /sdcard/ui.xml
```

Parse `bounds="[x1,y1][x2,y2]"` for the target element and tap its centre. Guessing pixel positions from a scaled screenshot preview missed buttons repeatedly — especially on **native Android dialogs** (e.g. RevenueCat's Test Store purchase sheet), which do not share the React Native content's coordinate space.

Two more emulator quirks:

- **⚠️ Gotcha:** `adb shell input text` drops trailing characters or duplicates text when commands fire back-to-back. Put a `sleep 1` between the focus tap and the type.
- **⚠️ Gotcha:** the persistent "Open debugger to view warnings" dev-mode toast overlays and swallows touches on the bottom tab bar. Dismiss it (tap its X, top-right of the toast) or tap outside its bounds first.

### ⚠️ Gotcha: the emulator has no Play Billing

`getOfferings()` fails with `BILLING_UNAVAILABLE` on the emulator. The paywall correctly renders a graceful empty state — **this is not a bug.** Product listing and real purchases can only be verified on a physical device signed in with a Play account that is on the closed-testing tester list.

---

## 4) Quality gates

Run all three before any build. Expected: typecheck clean, **60 tests / 12 suites** passing, lint reporting **11 pre-existing errors** (see below).

```bash
npx tsc --noEmit
```

```bash
npx jest
```

```bash
npx expo lint
```

Optional extra sanity check used historically before releases (catches bundling/resolution failures that tests miss):

```bash
npx expo export -p android
```

### CI

`.github/workflows/ci.yml` runs on push/PR to `main` (Node 20, `npm ci`):

| Step | Command | Blocking |
|---|---|---|
| Type check | `npx tsc --noEmit` | ✅ yes |
| Unit tests | `npx jest --ci` | ✅ yes |
| Lint | `npx expo lint \|\| true` | ❌ no — visibility only |

### ⚠️ Gotcha: do NOT "fix" the pre-existing lint errors

`expo lint` reports 11 errors (plus ~33 warnings). They are React Compiler rules misfiring on intended API usage. Blindly "fixing" them will break working code. Known set:

| File | Rule | Why it is a false positive |
|---|---|---|
| `src/app/(tabs)/index.tsx` (×5) | `react-hooks/immutability`, refs-during-render | Reanimated shared values: `x.value = …` is the library's documented mutation API |
| `src/components/SketchButton.tsx` (×2) | `react-hooks/immutability` | same — Reanimated `.value =` |
| `src/i18n/useTranslation.ts` | `react-hooks/immutability` | `i18n.locale = locale` — i18n-js's own locale setter |
| `src/hooks/useAuth.tsx` | set-state-in-effect | legitimate async auth-session effect |
| `src/hooks/usePurchases.tsx` | set-state-in-effect | legitimate async purchases effect |
| `src/hooks/use-color-scheme.web.ts` | set-state-in-effect | web-only hydration hook |

New code should be lint-clean; the above are the documented baseline.

---

## 5) Database & backend operations

Schema lives in `supabase/migrations/*.sql` (`0001_init_schema.sql`, `0002_quotes_extra_fields.sql`, `0003_pack_public_counts.sql`). The migration runner is idempotent and tracks applied files in a `_migrations` table, so all three commands below are safe to re-run.

All three require `SUPABASE_PASSWORD` (or `DATABASE_URL`) in `.env`.

Apply pending migrations:

```bash
npm run db:migrate
```

Upsert the 1000 embedded quotes from `src/data/quotes.json` into `quotes` (does not touch `is_premium`/`pack_id`):

```bash
npm run db:seed-quotes
```

Upsert the premium packs and their quotes (`quote_packs` + premium `quotes`, ids from 100001 up):

```bash
npm run db:seed-packs
```

> Premium pack quotes deliberately live **only** in Supabase, never in `src/data/quotes.json` — they must not ship as plaintext inside the APK. RLS policy `quotes_premium_read_entitled` gates them on `profiles.is_premium`.

### ⚠️ Gotcha: the direct database host is unreachable — use the session pooler

`db.ftohdffebzhrthrpeuos.supabase.co` resolves **IPv6-only** and this network has no IPv6 egress, so direct connections hang/fail. All three scripts hardcode the IPv4-capable **session pooler**:

```
aws-0-ap-northeast-1.pooler.supabase.com:5432   user: postgres.ftohdffebzhrthrpeuos
```

Any new script or ad-hoc `psql` session must use the pooler host too.

### Edge Functions

Two functions live in `supabase/functions/`:

| Function | Purpose | JWT verification |
|---|---|---|
| `revenuecat-webhook` | Only writer of `profiles.is_premium`; consumes RevenueCat purchase/renewal/expiration events | deployed with `--no-verify-jwt` (RevenueCat authenticates via a shared `Authorization` header value) |
| `delete-account` | Verifies the caller's own JWT, then `auth.admin.deleteUser` — cascades wipe `profiles`/`favorites`/`reflections`/`user_settings` | deployed **with** JWT verification (`verify_jwt: true`) |

`supabase login` is an account-credential step — **the account owner must run it**, it cannot be delegated:

```bash
npx supabase login
```

```bash
npx supabase link --project-ref ftohdffebzhrthrpeuos
```

```bash
npx supabase functions deploy revenuecat-webhook --no-verify-jwt
```

```bash
npx supabase functions deploy delete-account
```

⚠️ **`delete-account` must NOT get `--no-verify-jwt`** — it relies on Supabase's own JWT verification so that unauthenticated/anonymous requests are rejected before the function body runs.

Webhook secret (generate a fresh value, e.g. `openssl rand -hex 32`, then set it — and paste the *same* value into RevenueCat → Project settings → Integrations → Webhooks → Authorization header):

```bash
npx supabase secrets set REVENUECAT_WEBHOOK_AUTH_TOKEN=<generated-value>
```

Webhook URL to register in RevenueCat: `https://ftohdffebzhrthrpeuos.supabase.co/functions/v1/revenuecat-webhook`
Verify with RevenueCat's "Send test event" → expect `200 {"ok":true,"test":true}` (the `TEST` event type never touches the database).

### Verifying a deploy

```bash
npx supabase functions list
```

```bash
curl -i https://ftohdffebzhrthrpeuos.supabase.co/functions/v1/delete-account -X POST
```

Expected for `delete-account`: `ACTIVE` with `verify_jwt: true` in the list, and `401` from curl with a missing or garbage `Authorization` header.

### ⚠️ Gotcha: a backgrounded `functions deploy` can report success and deploy nothing

`delete-account`'s first deploy was launched in the background, printed `{"message":"Deployed Functions."}` and exited 0 — yet the function did not appear in `supabase functions list` and returned **404** on repeated retries. A plain **foreground** redeploy fixed it instantly. **Never trust the exit code alone:** always confirm with `functions list` plus a live curl, and redeploy in the foreground if either disagrees.

---

## 6) Release process (Android)

### Sequence

**1. Quality gates** — §4, all three green.

**2. Confirm EAS env is complete** for the `production` environment (§2):

```bash
npx eas env:list --environment production
```

**3. Confirm you are the right EAS user:**

```bash
npx eas whoami
```

Expect `evolaroa.app`.

**4. Build.** `eas.json`'s `production` profile sets `autoIncrement: true`, so `versionCode` is bumped automatically (11 → 12 → …); `buildType: app-bundle` produces an AAB; `credentialsSource: local` signs with `credentials/driftstop-upload.keystore`.

```bash
npx eas build --platform android --profile production
```

Non-interactive / fire-and-forget variant used previously:

```bash
npx eas build --platform android --profile production --non-interactive --no-wait
```

For an installable test APK instead of a store bundle, use the `preview` profile (also local credentials, `buildType: apk`):

```bash
npx eas build --platform android --profile preview
```

**5. Read the build log** and confirm the `Environment variables … loaded from the "production" environment on EAS: EXPO_PUBLIC_…` line is present. If it is missing, stop — see the §2 warning.

**6. Download the AAB** from the EAS build page (~86 MB).

**7. Upload in Play Console.** Exact path:

> **DriftStop → "Test edin ve yayınlayın" (Test and release) → "Test etme" (Testing) → "Kapalı test" (Closed testing) → "Kapalı test - Alpha" → "Yeni sürüm oluştur" (Create new release)**

Then: drag-and-drop the AAB into the bundle box → fill in **release name** (convention so far: `"11 (1.0.1)"`, i.e. `versionCode (version)`) → **release notes** in `<en-US>…</en-US>` form → **"İleri"** (Next) → **"Kaydet"** (Save).

**8. Submit for review — this is a separate, explicit step.**

> **"Test edin ve yayınlayın" → "Yayın özeti"** (publishing overview) → **"N değişikliği incelemeye gönder"** (Submit N changes for review) → confirm in the dialog.

⚠️ **Gotcha: uploading a build does NOT submit it.** A saved release sits as a pending change until you submit it from **Yayın özeti**. Status afterwards reads *"İncelenmekte olan değişiklikler"* (changes under review). Closed-testing review is typically much faster than production review.

💡 To put an **already-uploaded** bundle on another track (closed → production), do not re-upload: use **"Kitaplıktan ekle"** (Add from library) on the target track.

### What cannot be automated, and why

| Step | Why |
|---|---|
| **AAB drag-and-drop** | Browser file-upload tooling only accepts files shared into the session and caps at 10 MB. The AAB is ~86 MB. Must be done by a human in the browser. |
| **`eas submit -p android`** | Needs a Google Play **service-account JSON key** downloaded from Google Cloud, plus the Play Console **"Release manager"** permission granted to it. Creating/downloading a credential and granting permissions are account-owner operations. Once set up, `eas submit` would replace steps 6-8. |

Everything after the upload — release name, notes, and the review submission — *is* automatable via a connected browser session, and has been done that way for v9 and v11.

### In-app products (Play Console → Monetize)

Products `remove_ads`, `pro_monthly`, `pro_yearly` are all **Active**. `pro_yearly` needed a base plan named `yearly` (annual, auto-renewing) created from scratch before it could be priced.

### ⚠️ Gotcha: price fields expect a COMMA decimal separator

The Play Console account language is **Turkish**, so every price input (the single "Fiyatı düzenle" popup *and* the bulk "Set prices" dialog) parses numbers in Turkish format: **comma = decimal, period = thousands**. Typing `19.99` is read as `1.999,99` → **1999.99**, roughly 100× the intended price. **Always type `19,99`.** Entered correctly for one USD region, the bulk dialog then converts correctly across all 177 regions (Germany €20,99, Australia AUD 31,99, …) — the bulk logic was never the problem, only the decimal parsing.

### Release history (for context)

| versionCode | What shipped | Backend config present? |
|---|---|---|
| 7 | RevenueCat / billing integration (`d3f9b4a`) | ❌ none (EAS env bug) |
| 8 | — | ❌ none |
| 9 | In-app account deletion (`742ce4b`) | ❌ none |
| 10 | First build with the EAS env fix | ✅ |
| **11 (1.0.1)** | EAS env fix + account deletion + monetization UX overhaul + display-name fix. Uploaded to Kapalı test → Alpha and submitted for review 2026-07-24 | ✅ |

Only review warning on v11 was a missing R8/proguard mapping file — informational, non-blocking. Device support: 12,268 phones, 0 dropped.

---

## 7) Release process (iOS)

**Status: not submitted. No App Store Connect app record exists yet.** Android was deliberately finished first ([build-plan.md](build-plan.md) Phase 8).

### What already exists

| Item | Value / location |
|---|---|
| `ios.bundleIdentifier` | `com.driftstop.app` (`app.json`) |
| `ios.buildNumber` | `1` |
| `ios.supportsTablet` | `false` |
| `ITSAppUsesNonExemptEncryption` | `false` (in `ios.infoPlist`) — pre-answers the export-compliance question |
| iOS icon | `./assets/expo.icon` |
| AdMob iOS app id | present in the `react-native-google-mobile-ads` plugin config |
| Apple developer account | the user has one |
| Local run | `npx expo run:ios` works |

### What is still missing

| Missing | Notes |
|---|---|
| **`EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`** | Must be added to `.env` **and** `eas env:create` for each environment. Until it exists, iOS purchases are **cleanly disabled by design** — `purchasesConfigured` is false, so no paywall, no Pro card, no ads-removal UI. Do not substitute the Android key: RevenueCat throws "invalid API key". |
| **App Store Connect app record** | Create under bundle id `com.driftstop.app` |
| **IAP products** | Mirror Play's: `remove_ads` (non-consumable), `pro_monthly`, `pro_yearly` — then wire the iOS app in RevenueCat |
| **App Privacy form** | Equivalent of Play's Data safety; AdMob collects an advertising identifier, so declare it |
| **iOS screenshots** | Required sizes per App Store Connect; `store-assets/` currently holds Android-sized assets only |
| **iOS home-screen widget** | Not planned for launch — `react-native-android-widget` is Android-only; an iOS widget needs WidgetKit/Swift + App Groups |

### Store-process differences vs. Android

- **No 12-tester / 14-day requirement.** TestFlight is optional. **App Review is the only gate.**
- ⚠️ **Gotcha (Apple rule):** offering *any* third-party social login makes **Sign in with Apple mandatory**. Today the app ships email/password only (Google sign-in was deferred for lack of an OAuth client), so this does not bite — but adding "Continue with Google" to the iOS build obligates adding Sign in with Apple in the same release.

---

## 8) Store constraints

**Google Play, personal developer account (ours):** before production can be unlocked, the app must run a **closed test with at least 12 testers who stay opted in for 14 continuous days**. Only then does **"Üretime başvur"** (Apply for production) unlock, and Google then reviews the application.

**Current state: only 1 tester registered.** Roughly 12 more email addresses need adding to the Alpha track's tester list.

| Account type | Path to production |
|---|---|
| Personal (ours) | ⚠️ 12 testers × 14 continuous days on closed testing first |
| Organization | Straight to production, but requires a D-U-N-S number. Google generally does not convert personal → organization; it takes a new account. |

Notes:
- Opt-in link: https://play.google.com/apps/testing/com.driftstop.app — works only after the review is approved **and** the tester's email is on the list; otherwise it reports "app not available".
- ⚠️ **Gotcha:** emulators generally do not count toward the 12; real devices are required. Faking 12 accounts on one phone risks rejection.
- ⚠️ **Gotcha:** the closed-testing release must have **countries/regions selected** ("select all" from the table header) or it is rejected with a "no country selected" error.
- ⚠️ **Gotcha:** the dashboard setup checklist must read 11/11 — in particular **Store settings (category + contact details)** — or "Submit for review" stays greyed out. This one has bitten this project the most.
- ⚠️ **Gotcha:** most Play Console screens pop a "publish this change?" confirmation dialog after Save. Navigating away without confirming saves **nothing** (contact details were lost this way twice).

---

## 9) QA test accounts

Testing uses throwaway **mailinator** public inboxes, because Supabase Auth requires email confirmation by default and the flow must be driven end-to-end without a real mailbox.

| Account | Use |
|---|---|
| `driftstop.qa.test1@mailinator.com` | Primary QA account (signup → confirm → sign-in → sign-out, and premium-view checks) |

Any `<anything>@mailinator.com` address works — public inboxes need no signup. Inbox name = the local part of the address.

### Fetching a confirmation email

List the inbox (returns message ids):

```bash
curl -s "https://www.mailinator.com/api/v2/domains/public/inboxes/driftstop.qa.test1"
```

Fetch one message by id from that listing:

```bash
curl -s "https://www.mailinator.com/api/v2/domains/public/inboxes/driftstop.qa.test1/messages/<message-id>"
```

### ⚠️ Gotcha: the body is quoted-printable — the verify token looks mangled

Supabase's confirmation mail is quoted-printable encoded, so in the raw JSON body the `=` characters are escaped and long URLs are soft-wrapped with trailing `=`. The confirmation link's `token=<hex>` parameter therefore shows up corrupted (e.g. as `token=3D…` / rendered elsewhere as `token:3a…`) and may be split across lines. **Decode quoted-printable before using the link** — or, minimally, rejoin the soft-wrapped lines and restore `=3D` → `=`. The real parameter is `token=<hex>`. Copy-pasting the mangled string produces an invalid-token error, not a working confirmation.

### RevenueCat premium testing

Pro can be granted manually to a test customer from the RevenueCat dashboard. ⚠️ **Gotcha:** these manual grants **expire**; the previous grant on `driftstop.qa.test1@mailinator.com` had lapsed, which is why the Pro/unlocked pack view is currently unverified on-device. Renew the grant before testing the unlocked path.

⚠️ **Gotcha:** real product listing and real purchases cannot be tested on the emulator at all (`BILLING_UNAVAILABLE`) — only on a physical device whose Play account is on the closed-testing tester list.

---

## 10) Troubleshooting index

| Symptom | Likely cause | Fix |
|---|---|---|
| Shipped app shows no "Account" section in Settings | `EXPO_PUBLIC_SUPABASE_ANON_KEY` missing from the binary → `supabase` client is `null`, `authConfigured=false` | Register the var via `eas env:create` for that environment, rebuild, confirm the "Environment variables … loaded from" line in the build log (§2) |
| Shipped app shows no paywall / no Pro card / ads never removable | `EXPO_PUBLIC_REVENUECAT_*_API_KEY` missing → `purchasesConfigured=false` | Same as above |
| Build log says *"No environment variables found for the 'production' environment"* | Vars only exist in local `.env`; EAS never receives `.env` (gitignored, no `.easignore`) | `eas env:create …` per environment, then rebuild. Do not upload the current artifact |
| Paywall shows an empty state; logs say `BILLING_UNAVAILABLE` | Android emulator has no Play Billing | Not a bug. Verify on a physical device with a tester Play account |
| RevenueCat "invalid API key" on iOS | Android `goog_…` key used for iOS, or no iOS key set | Add `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`; never share keys across platforms |
| Pro user sees "quotes are syncing" and no premium quote text | `profiles.is_premium` still false → RLS `quotes_premium_read_entitled` blocks the rows. Only the `revenuecat-webhook` writes that field | Confirm the webhook is deployed, registered in RevenueCat with the matching `REVENUECAT_WEBHOOK_AUTH_TOKEN`, and that `Purchases.logIn(user.id)` ran (RevenueCat `app_user_id` must equal the Supabase user UUID) |
| DB script hangs or cannot connect | Using the direct `db.<ref>.supabase.co` host (IPv6-only, no egress here) | Use the session pooler `aws-0-ap-northeast-1.pooler.supabase.com:5432` |
| DB script exits with "SUPABASE_PASSWORD bulunamadı" | `.env` missing or `SUPABASE_PASSWORD` unset | Add it to local `.env` only — never to EAS env |
| `supabase functions deploy` said success but the function 404s / is absent from `functions list` | Backgrounded deploy silently no-opped | Redeploy in the **foreground**, then re-verify with `functions list` + curl |
| `delete-account` accepts unauthenticated requests | Deployed with `--no-verify-jwt` | Redeploy **without** that flag; confirm `verify_jwt: true` |
| `INSTALL_FAILED_INSUFFICIENT_STORAGE` on the emulator | AVD data partition full | `adb uninstall com.driftstop.app`, `adb uninstall host.exp.exponent`, `adb shell pm trim-caches 1024M` |
| New native module behaves as if not installed | Only JS reloaded; native side not relinked | Kill and re-run `npx expo run:android` for a fresh prebuild + Gradle build |
| `java`/`adb`/`emulator` not found | Toolchain not on PATH; system JDK unusable | Export `ANDROID_HOME`, add `platform-tools`+`emulator` to PATH, set `JAVA_HOME` to `/Applications/Android Studio.app/Contents/jbr/Contents/Home` (§3) |
| Automated taps miss their targets | Coordinates eyeballed from a scaled screenshot; native dialogs use a different coordinate space | Get exact bounds from `adb shell uiautomator dump` and tap the centre |
| `adb shell input text` loses or duplicates characters | Commands fired without a settle delay | `sleep 1` between the focus tap and the type |
| Bottom tab bar unresponsive on the emulator | "Open debugger to view warnings" dev toast overlaying it | Dismiss the toast (its X, top-right) or tap outside its bounds |
| `expo lint` reports 11 errors | React Compiler rules misfiring on Reanimated `.value =`, i18n-js's locale setter, and legitimate async effects | Expected baseline — do **not** "fix". CI runs lint non-blocking (§4) |
| Play Console: an IAP price is ~100× too high | Turkish locale parses `.` as a thousands separator | Re-enter with a comma: `19,99` |
| Play Console: "Submit for review" greyed out | Dashboard setup incomplete — usually Store settings (category + contact) | Complete Store settings to reach 11/11 |
| Play Console: a saved change never took effect | The post-Save "publish this change?" dialog was not confirmed | Redo the edit and confirm the dialog |
| Play Console: uploaded a build but nothing is in review | Upload and submission are separate steps | Go to **Yayın özeti** and submit the pending change |
| Play Console: misleading "fix the errors to save" | Session silently dropped | Refresh, sign in again, retry — the form answers were fine |
| Play Console: no DriftStop app / suspended-account banner | Signed into `muhammed.gulcu@gmail.com` (closed personal developer account) | Switch to `evolaroa.app@gmail.com` via the account-picker pill (§1) |
| Tester's opt-in link says "app not available" | Review not yet approved, or the email is not on the tester list | Wait for approval / add the address to the Alpha tester list |
| "Apply for production" locked | Personal-account rule: 12 testers × 14 continuous days not satisfied | Recruit testers; currently 1 registered (§8) |
| Hand-edited native file reverted | CNG regenerates `/android` and `/ios` on prebuild | Move the change into an `app.json` config plugin (see `plugins/withGradleVersion`) |
| Production build fails on missing keystore | `credentials/` + `credentials.json` are gitignored, and both `preview` and `production` use `credentialsSource: local` | Restore both from backup before building (§1) |
| Supabase confirmation link reports an invalid token | Quoted-printable-mangled token copied verbatim | Decode the body first; the real param is `token=<hex>` (§9) |
