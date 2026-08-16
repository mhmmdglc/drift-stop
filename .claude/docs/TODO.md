# DriftStop — Pending / TODO

Single place to check what's actually outstanding, instead of hunting through scattered notes in other docs. Update this file (don't just append to old docs) whenever a pending item is resolved or a new one comes up.

## ~~🔴 Found 2026-08-10 on the iOS Simulator — a guest who buys Pro never gets the premium quotes~~ — **half fixed the same day (`99d782d`)**

**Fixed:** the screen no longer lies. An entitled guest now gets *"Your premium quotes need an account"* and a button straight to `/auth`; an entitled **signed-in** user still gets the waiting message, because for them the download is real. The purchase confirmation says the same thing to a guest instead of "Pro is on, enjoy". Verified on the simulator with a granted entitlement: the CTA renders and opens the sign-in screen. Guard test proven by breaking it twice.

**Still open, deliberately:** an entitled *anonymous* customer still cannot read premium rows — the fix routes them to an account rather than making RLS work without one. That is the right trade for now (the content model is account-based end to end), but if guest purchases turn out to be the majority path, the read model itself has to change.

⚠️ **This fix is NOT in the build now in App Review** (`1.2.0 (5)` was cut before it). iOS 1.2.0 will ship with the old, misleading message unless the submission is pulled and rebuilt.


**Observed on screen, not inferred.** A promotional `pro` entitlement was granted in the RevenueCat dashboard
to the simulator's anonymous customer (`$RCAnonymousID:e2f4453…`). The app picked it up on relaunch and the
**UI unlocked correctly**: the Go Pro card and the trial line disappeared, the notification frequencies **7 and
10 became selectable** (10 was selected and stuck), and every content pack lost its lock. Then opening
**The Stoics** showed *"Syncing quotes, they'll be here shortly."* — and it never resolved.

**It cannot resolve.** `syncPremiumQuotes` says so in its own comment
([`quotesSync.ts`](../../src/services/quotesSync.ts)): premium rows are returned by RLS **only to a signed-in
user whose `profiles.is_premium` is true**; with no entitlement the server returns an empty list and the sync
silently reports 0. A guest has no Supabase user at all, so there is no profile for the RevenueCat webhook to
flip.

**Why this is a live revenue risk, not a corner case.** Every part of the product steers users into exactly
this state: the app advertises that everything works as a guest, the purchase flow never asks for an account,
and the paywall sells **"3,325+ premium quotes"**. So the default path for a paying iOS customer is: pay →
ads stop, 10 reminders unlock, packs look open → tap any pack → *"shortly"* forever. That reads as a broken
app the user just paid for.

**Two things are wrong and they are separable:**
1. **The message lies.** "They'll be here shortly" is shown in a state where they will never arrive. At
   minimum this must become "Sign in to get your premium quotes" with a button, for entitled guests.
2. **The entitlement does not reach the content.** Either purchases must require/offer an account, or the
   premium read path needs to work for an entitled anonymous customer.

**Not yet checked:** whether a signed-in purchaser works end to end — that needs the RevenueCat webhook to
flip `profiles.is_premium` from a real purchase, which has still never happened on any platform. The Android
QA of 2026-08-01 proved premium content for a **signed-in trial** user, which is a different path (the
`trials` table, not the webhook).

## Open bugs found during the 2026-07-25 documentation audit

Found by reading the code against the shipped copy while writing `PRODUCT.md`. None of these are fixed yet; none were introduced by the docs work.

| # | Severity | Issue |
|---|---|---|
| 1 | **Major** | **iOS currently has no monetization at all.** Every gate keys off `purchasesConfigured`, which is false on iOS until an iOS RevenueCat key exists — so on iOS the 10-reminders/day Pro feature is free, no Pro card and no paywall render. Shipping iOS before the key exists means giving Pro away. |
| 2 | ~~**Major**~~ **Copy fixed 2026-07-25 (`3e89b75`).** `settings.account.guestHint`, `auth.subtitle` and `deleteAccountConfirmMessage` no longer claim cross-device sync; they now promise only that Pro access and premium packs follow the account, and that favorites/settings stay on the device. Real cross-device sync is still **not built** — the `favorites` / `user_settings` / `reflections` tables still have no client code. |
| 3 | Major | **`paywall.purchaseSuccess` says "Ads are now off" after *any* purchase**, including a Pro subscription — wrong confirmation for the more expensive product. |
| 4 | Minor | **Pack titles fall back to Turkish for es/de/fr/it users.** `localizedPackField` resolves `locale → tr → en`, so those users see Turkish pack titles beside English quote bodies. The fallback should be `locale → en`. |
| 5 | Minor | Interstitial ads are effectively gated by a ~4-minute timer rather than the intended 12-swipe count. |
| 6 | Info | The Pro/unlocked pack view has still never been verified on a device (the QA grant expired). |
| 7 | ~~**Blocker (security)**~~ **Already fixed in HEAD — verify the deployment.** `revenuecat-webhook/index.ts` now rejects with `503` when `REVENUECAT_WEBHOOK_AUTH_TOKEN` is unset, so it fails closed. **Unverified:** whether the *deployed* copy is this version — the function was last deployed before this change and there is no way to read the live code from here. Redeploy before relying on it. |
| 8 | ~~**Major (revenue leak)**~~ **Code fixed 2026-07-25 — needs device QA.** Premium quotes are now purged from local SQLite whenever entitlement is known to be absent (`usePremiumCacheGuard`, every launch) and explicitly on sign-out / account deletion; the any-source readers all require `{ entitled }`; recovery re-downloads via `syncPremiumQuotes`, which ignores the delta cursor. Code review follow-up (same day) closed the gaps that made the first version unsafe: the purge is gated on `usePurchases.entitlementKnown` rather than `!loading` (a rejected `getCustomerInfo()` used to look like "no entitlement" and would wipe a paying user's cache), screens are invalidated after a restore through a version counter, completeness is measured against `packs.quote_count` + a backfill watermark instead of `count > 0`, both destructive entry points swallow errors, and the ungated `getAllCachedQuotes()` reader was deleted. Proven by unit tests + live RLS curl; **the purge/restore path has never run on a device** (needs a real Pro grant → lapse → re-grant). |
| 9 | **Major (iOS)** | **iOS ads are misconfigured.** iOS ad unit ids are empty (`src/constants/adUnits.ts:10,12`) so release builds would serve Google's `TestIds` — zero ad revenue — and `app.json:62` still carries Google's *sample* AdMob publisher app id. Must be fixed before any iOS submission. |
| 10 | Major | **The core feature has no tests.** `src/utils/scheduler.ts` — permission handling, the 3-day scheduling loop, `syncDeliveredToHistory` — is entirely untested, and a regression there is silent: notifications simply stop arriving. Edge functions are also excluded from `tsc` (`tsconfig.json:22`) and untested. |
| 11 | ~~Minor~~ **Half fixed 2026-07-31** | The 1,000-row boot seed is **gone**. Measured first: `396 ms` of blocking work on an Android emulator (`[PERF]` instrumentation, cleared app data) — and an emulator is faster than the cheap phones this hurts. `void syncQuotes()` looked deferred but is not: an async function body runs synchronously up to its first `await`, and `seedIfEmpty()` was the first statement. It was also **dead weight** — every cache reader filters `pack_id`, `author + is_premium = 1`, or `is_premium = 1`, and the one unfiltered reader (`getCachedQuoteById`) is unreachable for free ids because `lookupQuoteAnySource` returns from the static array first. Removed, not deferred. Indexes added on `pack_id`, `(author, is_premium)` and `is_premium` — the table had **none**, so every premium query was a full scan of up to 3,325 rows. **Still open:** `usePacks` does two synchronous SQLite reads inside `useMemo` during render (18 packs + ~104 authors, so small, but still render-blocking I/O). |
| 14 | **Blocker (revenue)** | **RevenueCat's offering may have no Play Store products attached.** Surfaced by RevenueCat's own diagnostic on the emulator: *"You have configured the SDK with a Play Store API key, but there are no Play Store products registered in the RevenueCat dashboard for your offerings."* This is a **separate error** from the emulator's `BILLING_UNAVAILABLE`, and it would not be fixed by running on a real device. It matches `backend-roadmap.md:113`, which records the three products as configured **in the Test Store** — the offering was verified against RevenueCat's test store during Phase 3 and may never have been re-pointed at the real Play products. If so the paywall renders its empty state in production too, and nothing can be bought on either platform. Needs checking in the RevenueCat dashboard: Offerings → `default` → each package must map to a **Play Store** product (`remove_ads`, `pro_monthly`, `pro_yearly`), not a test-store one. |
| 12 | ~~Minor~~ **Fixed for premium 2026-07-31** | Premium deletions now propagate. `syncPremiumQuotes` already fetches **every** premium row the user is entitled to (no cursor, all pages collected), so that response is authoritative — anything local and premium that is missing from it has been removed server-side. `deletePremiumQuotesNotIn` drops those rows, at zero extra network cost. Guarded so it cannot mass-delete: an empty response means "no entitlement", not "content gone", and a failed or cancelled fetch never reaches the deletion. Four tests cover exactly those refusals. Free quotes deliberately excluded — they are bundled in the app, nothing reads cached free rows, and pulling one needs an app update anyway. **Packs still have no delete propagation** (`packsSync`), so a retired collection keeps showing in the list. |
| 13 | Info | Three AsyncStorage keys are dead (written or read by nothing). Safe to remove. |

## QA sweep 2026-08-01 — what was driven on screen, and what broke

Full pass on the Android emulator from a wiped install. **Verified working:** all four onboarding pages,
notification scheduling (11 records in the OS store — 9 daily at 3/day×3 days plus the 2 trial notices, both
channels registered, trial notices do not consume the daily quota), trial active state (badge, 10 selectable
unlocked, no ad banner), trial end (frequency 10→3, locks and Pro hint back, ads back, end screen shown
exactly once and not again after relaunch), pack list, premium pack detail with real content, sign-up,
sign-in including the wrong-password error, and account deletion.

**Premium content for a signed-in trial user works end to end** — 3,325 premium rows downloaded (4,325
total), `trials` row written with exactly a 7-day span. This is the first on-device proof of migration 0007.

**Account deletion cascades correctly:** `auth.users`, `profiles` and `trials` all gone, local premium cache
purged 3,325 → 0 while the 1,000 free quotes stayed.

### Found and fixed this pass (`40ffd94`)
- The sign-in submit button sat behind the keyboard on Android with no way to reach it —
  `KeyboardAvoidingView` had `behavior: undefined` on Android (a no-op) over a fixed, non-scrolling View.
- Neither input had `returnKeyType`/`onSubmitEditing`, so the keyboard's action key did nothing.
- A signed-up user was stranded: confirmation is required, but there was no resend and no path back.

### Not covered by this pass (say so rather than imply coverage)
Favorites add/remove, the six locales on screen, schedule-time validation, the widget, interstitial ads,
deep link from a notification, offline behaviour. And **no purchase has ever been exercised anywhere** —
the emulator has no Play Billing.

### ~~Social sign-in is still absent~~ — superseded, this whole paragraph is now wrong

Left in place because the sweep is a dated record, but **do not act on it**. Every claim below has since
been overtaken:

- *"not a line of it exists"* → commit `5aefed2` shipped `src/lib/socialAuth.ts` + `useAuth.signInWithProvider`.
- *"there is also no password reset"* → password reset shipped separately.
- *"Supabase provider config"* → **done 2026-08-09.** Google (web + iOS audiences) and Apple
  (`com.driftstop.app`) are enabled and verified live; see `OPERATIONS.md` §5.
- *"Apple needs a Services ID and a `.p8`"* → **only for token revocation, which is now deferred** (below).
  Native Sign in with Apple needs neither, and neither is configured.

What is genuinely still open is tracked in `specs/social-sign-in.md` §6 (acceptance criteria — no criterion
has been observed on a device yet) and in the two items below.

### Apple token revocation on account deletion — deferred, accepted compliance gap (2026-08-09)

Owner decision: **not this release** (answers Q1 in `specs/social-sign-in.md` §2 with *no*, reversing the
provisional "yes" of 2026-07-25). Account deletion itself is unaffected and complete — `auth.users`, its
`auth.identities` row, `profiles` and `trials` all cascade away. The single visible consequence is that a
deleted user keeps seeing **DriftStop under iOS Settings → Apple ID → Sign in with Apple**.

Whoever submits to App Review must know this is a knowing, recorded gap and not an oversight. Full detail,
including what building it would cost (Services ID, a once-downloadable `.p8`, and a silent ~6-month secret
rotation forever after), is in `OPERATIONS.md` §7.

### Google sign-in on Android is still blocked on an owner-created OAuth client

Supabase now accepts Google id tokens, but Google itself will not issue one to the Android app until an
**Android OAuth client** exists for package `com.driftstop.app` with the right SHA-1s (debug, upload key,
and — the one that governs what closed testers actually install — **Play App Signing**). Until then the
Android button fails with `DEVELOPER_ERROR`. This is spec blocker B1 and is owner-only.

### Fixed 2026-08-01/02 (this sweep's second pass)
- `scheduler.ts` now has **27 tests** — permissions, both channels, the 3-day loop, the reschedule guard,
  delivered-to-history, and the `cancelAll` rule that must not delete trial notices. Finding #10 half closed.
- **Password reset shipped.** It did not exist at all: a user who forgot their password had no way back into
  the account, and Pro entitlement lives on the account.
- Finding #3 closed: the paywall no longer confirms "ads are off" after a **Pro** purchase.
- Paywall no longer promises **"Sync (soon)"** — sync is not built and is out of scope.
- Phase F's virtualization item closed: the packs screen rendered **122 rows** (18 packs + 104 authors), each
  with its own SVG border, in a plain ScrollView. Now one FlatList.
- Finding #5 closed and it was worse than recorded: the interstitial's 4-minute gap was seeded at app launch,
  so combined with the 12-swipe threshold a normal session showed **no interstitial at all**. Startup grace
  and inter-ad gap are now separate; the threshold retries every swipe instead of every twelfth.
- Finding #12's remainder closed: retired packs are now deleted locally (`deletePacksNotIn`), guarded so an
  empty or failed response can never wipe the catalogue.
- Finding #10's other half closed: edge functions are still outside the app's tsconfig (Deno globals and
  `jsr:` specifiers), but `npm run typecheck:functions` checks them with Deno. **Both pass.**

### Device QA that is still open, and why
Favorites add/remove, the six locales on screen, schedule-time validation, the widget, deep link from a
notification, and offline behaviour were **not** exercised. The dev client is pinned to `10.0.2.2:8081` and
that port is held by another project's Metro on this machine; pointing DriftStop at another port did not
override the pinned URL. Nothing here indicates a DriftStop defect — the same client worked on 8081 earlier
the same day. Re-run when 8081 is free.


### `remove_ads` kaldırıldı — canlıda $299.99 ile duruyordu (2026-08-03)

Sahibin ürün kararı: **reklamsızlık ayrı satılan bir ürün değil**, Pro aboneliği
(aylık ya da yıllık) alındığında otomatik geliyor. Kontrol edilince `remove_ads`'in
Play'de **ACTIVE** ve **$299.99 / ₺16.859,99** (173 bölge) olduğu görüldü — `pro_monthly`
ile aynı ondalık kayması, ama bu ürüne hiç bakılmamıştı çünkü Play'in eski endpoint'i
403 veriyor (bkz. STORE-AUTOMATION'daki `oneTimeProducts` notu). Kapalı testte olduğu
için gerçek para gitmedi.

Yapılanlar: Play'de satın alma seçeneği **INACTIVE** edildi · RevenueCat `default`
offering'inden `$rc_lifetime` paketi çıkarıldı (artık yalnızca `$rc_annual` ve
`$rc_monthly`) · App Store Connect'te bugün oluşturulan `remove_ads` ürünü silindi.

**Kodda bilinçli olarak bırakılanlar:** `no_ads` entitlement'ı ve `isAdsRemoved`
mantığı duruyor, çünkü Pro abonelikleri de `no_ads` veriyor ve reklam bastırma buna
bakıyor. Paywall'ın LIFETIME etiketi ile `alreadyAdsRemoved`/`purchaseSuccessAdsRemoved`
metinleri de duruyor: ürünü daha önce satın almış biri varsa onun deneyimi bozulmasın.
Paywall offering'den ne gelirse onu basıyor, yani satış yolu kendiliğinden kapandı.

**Fiyat bilerek düzeltilmedi.** Ürün satılmayacaksa doğru fiyat diye bir şey yok;
$299.99 kaydı INACTIVE bir seçenekte duruyor. Bir gün gerçekten satılacaksa fiyat
kasıtlı olarak belirlenmeli.


### iOS ürün kurulumu tamam (2026-08-03)

App Store Connect tarafı bitti. `pro_monthly` **$3.99**, `pro_yearly` **$35.99**, ikisi de
**175 ülkeye** türetilmiş fiyatlarla ve "All countries or regions" availability ile.
Yerelleştirmeler (ad + açıklama) ve `DriftStop Pro` grup adı girildi.

İkisi de `MISSING_METADATA` / "Prepare for Submission" durumunda ve **bu bir eksiklik
değil**: Apple'ın kendi uyarısı diyor ki *"Your first auto-renewable subscription must be
submitted with a new app version."* İlk abonelik ancak bir build ile birlikte incelemeye
gider.

**Fiyat API'si kullanılamadı, arayüzden yapıldı.** `POST /v1/subscriptionPrices` dört farklı
istek şeklinde de `409 ENTITY_ERROR.RELATIONSHIP.INVALID` verdi (yerelleştirme eklendikten
sonra bile). Fiyat noktası id'leri doğruydu — `$3.99` ve `$35.99` ikisi de API'de mevcut.
Sebep bulunamadı; arayüz ürün başına birkaç tıklama, oradan girildi. Availability ise
API'den sorunsuz kuruldu (`POST /v1/subscriptionAvailabilities`, 175 ülke).

**Arayüzde bir tuzak:** `$35.99` fiyat dropdown'ında görünmüyor, arama da "No Results"
diyor. **"See Additional Prices"** linkine basınca çıkıyor. Apple bazı fiyat noktalarını
varsayılan listede saklıyor; Play ile fiyat eşitlemeye çalışan biri burada takılır.

**Kalan iOS engelleri:** RevenueCat `appl_` anahtarı (özel `.p8` yüklemesi — sahibin işi),
sonra bir build, sonra abonelik grubunun inceleme ekran görüntüsü (paywall'ın dolması
`appl_`'a bağlı olduğu için ondan önce üretilemez).

## Needs device QA (not blocked on you)

- **Cached-premium purge/restore (finding #8, fixed in code 2026-07-25).** Cannot be verified without a device and a real RevenueCat entitlement. Sequence for `qa-tester`: grant Pro → open a premium pack so content syncs → favorite one premium quote and one free quote → revoke Pro (or sign out) → relaunch → the premium favorite must show the locked row (not a blank card, not a vanished favorite), the free favorite must be untouched, pack detail must be locked again, and pack/author *counts* must still be visible → re-grant Pro → relaunch → premium content and the favorite must come back within a few seconds.
  - **Also check, from the review follow-up:** (a) **purchase while Favorites is open** — buy Pro from the paywall reached by tapping a locked favorite, then go back without leaving the tab; the row must flip from lock → real text on its own within ~5 s (this is the version-counter path, and Favorites stays mounted so a tab switch would not save it); (b) **airplane mode cold start as a paying user** — kill the app, disable networking, launch: premium favourites must still render (nothing may be purged when `getCustomerInfo()` fails), then re-enable networking; (c) **sign out during the restore** — re-grant Pro, relaunch, and sign out within the 2–5 s restore window: premium rows must stay gone rather than reappearing.

## Needs your action (blocking)

- **On your real phone once v11 reaches the Alpha track:** verify the paywall lists all 3 products with real prices and that a purchase completes. This is the ONLY thing never verified anywhere — the Android emulator has no Play Billing (`BILLING_UNAVAILABLE`), so product listing/purchase can only be checked on a real device with a Play account on the closed-testing list.
- **Play Console needs 12 testers + 14 days** on closed testing before production is unlockable (personal developer account rule). **Resolved on the tester side: 16 testers, testing daily, day 4 as of 2026-08-05** — production should unlock around **2026-08-15**. The 14 days must be continuous, so nobody should be removed from the Alpha track until then.
- **Create the Android OAuth client for Google sign-in** (spec blocker B1) — Google Cloud project `driftstop`, package `com.driftstop.app`, registering **all three** SHA-1s: debug keystore, upload key (`93:64:96:08:BB:0F:2F:51:C9:7E:6D:9D:FE:34:43:E1:6F:F7:4D:B3`) and the **Play App Signing** certificate from Play Console → Test and release → Setup → App integrity. Without it the Google button fails with `DEVELOPER_ERROR` on Android — and if only the upload key is registered it will work everywhere *except* for real closed testers. Supabase's side of Google sign-in is already done (2026-08-09).
- **Publish the Google OAuth app** (spec blocker B3) — Google Auth Platform → Audience → publishing status **"In production"**. While it sits in "Testing", only listed test users can sign in (100 cap) and everyone else sees a failure indistinguishable from a code bug.
- **Confirm the Sign In with Apple capability** on `com.driftstop.app` and that the regenerated provisioning profile is the one EAS will use (spec blocker B7). `5aefed2`'s commit message says this was done via the ASC API; it has never been independently verified. If it is wrong, the iOS build compiles and Apple sign-in fails only at runtime.

## v11 submitted for review (2026-07-24)

versionCode 11 (1.0.1) uploaded to Kapalı test → Alpha, release name "11 (1.0.1)", en-US release notes written, submitted for Google review (status: "İncelenmekte olan değişiklikler"). Contains: EAS env fix (first builds with working Supabase/RevenueCat config were v10/v11 — 7/8/9 shipped with none), in-app account deletion, monetization UX overhaul, app display name fix. Only warning at review time was the missing R8/proguard mapping file — informational, non-blocking. Device support unchanged (12,268 phones, 0 dropped).

**Note on uploading:** the AAB drag-drop is the one step that can't be automated from here — the browser file-upload tool only accepts session-shared files and caps at 10 MB (the AAB is 86 MB), and `eas submit` needs a Google service-account JSON key (creating/downloading that key + granting it Play "Release manager" is a credential/permission op for the user). Everything after the upload (release name, notes, review submission) is automatable and was done here.
- **iOS App Store prep** (user has an Apple dev account, wants iOS live): needs an iOS RevenueCat API key (`EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`, both in `.env` and `eas env:create`) + App Store Connect app + IAP products mirroring Play's (`remove_ads`, `pro_monthly`, `pro_yearly`) + App Privacy form + screenshots. No 12-tester requirement on iOS; TestFlight optional; App Review is the only gate. Until the key exists, iOS builds run with purchases cleanly disabled (no paywall/Pro card/ads-removal UI shown).

## iOS-first push (2026-07-29) — user decided to ship iOS before Android v12

Android v12 deliberately deferred; note that the two security fixes `3e36793` (self-grantable premium entitlement) and `e6db845` (premium content survives a lapsed subscription) are **in HEAD but in no shipped build** — the Play build still on review is versionCode 11, cut before both.

**Apple account setup: DONE and verified in App Store Connect this session.** Individual (not Organization) account under `muhammed.gulcu@gmail.com` — note this is a *different* account from the Play-side `evolaroa.app@gmail.com` that owns DriftStop on Android, so the App Store seller name will read "Muhammed Gülcü". Paid Apps Agreement **Active**, Free Apps Agreement Active, bank account (TEB, EUR, `…4889`) **Active**, U.S. Form W-8BEN + U.S. Certificate of Foreign Status both **Active** (treaty claim filed as Article 7(1) / 0% on "income from the sale of applications"), Digital Services Act trader declaration submitted for 27 EU countries and **In Review** on Apple's side. Nothing here blocks a build or a submission.

**Done in code this session (`tsc` clean, 132/132 tests, verified via `expo config --type introspect`):**
- `eas.json` production profile: iOS now uses `credentialsSource: "remote"` (was profile-level `"local"`, and `credentials.json` only carries an Android keystore — every iOS build would have failed instantly).
- ATT wired for real: `expo-tracking-transparency` installed, permission resolved *before* `mobileAds().initialize()`, and the result now drives `requestNonPersonalizedAdsOnly` on both the banner and the interstitial (it was hardcoded `true`, so consent could never have been monetised). `AdBanner` subscribes via `useSyncExternalStore` so a late consent answer re-requests.
- `NSUserTrackingUsageDescription` localized into all six available locales via `app.json` `locales` → `assets/locales/*.json`; 50 Google-published `skAdNetworkItems` added.

**Still blocking an iOS submission — all need the owner:**
1. **ASC API Key** (Users and Access → Integrations → Team Keys, App Manager role) + **Issuer ID** + **Team ID** — the critical path; nothing can be built or submitted without them.
2. **AdMob iOS**: `app.json:62` still carries Google's *sample* publisher id `ca-app-pub-3940256099942544~1458002511`, and `src/constants/adUnits.ts` iOS unit ids are still empty. AdMob's "Add app" flow accepts "not listed on a store yet", so this can be done before launch.
3. **RevenueCat iOS**: public SDK key (`appl_…`) into `.env` **and** `eas env:create`, plus an App Store Connect In-App Purchase key uploaded to RevenueCat for receipt validation.
4. **IAP prices** — user must state them; mirror Play's. Products must be named exactly `remove_ads`, `pro_monthly`, `pro_yearly`, the two subscriptions in one group.
5. **ASC app record** — needs a globally-unique app name; not yet created.

Ads are **in scope** for iOS v1 (user chose "reklamlı çıkalım" over a faster ad-free first release).

## Monetization UX overhaul shipped (commit 715e69f, 2026-07-23)

User demanded a real monetization funnel ("how will we sell subscriptions?"). Now: Account section at TOP of Settings, Pro benefits card under it (→ paywall), notification counts 7/10 are Pro-gated (lock badge → paywall; `useEnforceFreeLimits` downgrades stale >5 frequency when entitlement lapses), "Remove ads" link above the AdMob banner, paywall subtitle sells the actual catalog. All copy in 6 locales. **Android emulator verification done (2026-07-24):** fresh install → onboarding (interests, notification permission), Pro card + lock badges + hint render correctly, locked 7 → opens paywall and selection stays at 5, "Remove ads" link → paywall, paywall shows graceful empty state without Play services (BILLING_UNAVAILABLE is an emulator limitation, not a bug), widget provider still registered after the index.js platform guard. Also caught & fixed: app display name was the raw slug "drift-stop" in the launcher/permission dialogs → now "DriftStop" (commit `f97c442`).

## CRITICAL bug found and fixed (2026-07-20)

- **Every Play Store build so far (versionCode 7, 8, 9) shipped with NO backend config at all** — no Supabase, no RevenueCat. Root cause: `.env` is (correctly) gitignored, but there was no `.easignore` file, so EAS Build fell back to `.gitignore` to decide what to upload to its cloud build servers — which excluded `.env` from every single cloud build. `eas build` even printed "No environment variables found for the 'production' environment" on every past build, but nobody was watching for that line. Locally (`expo run:android` on the emulator) this was invisible because the local dev server reads `.env` directly — so every "verified on-device" claim from earlier phases was true for the emulator/dev build, but never true for the actual shipped Play Store binary. This is why the user's phone showed no "Hesap" (Account) section after installing versionCode 9 from Play Store: `authConfigured` was false because `EXPO_PUBLIC_SUPABASE_ANON_KEY` was undefined in that binary. Real accounts, real sync, and real purchases have likely never worked for any actual Play Store tester until this fix.
  - **Fix:** registered the three public `EXPO_PUBLIC_*` vars (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`) as EAS's own cloud Environment Variables (`eas env:create`, visibility `plaintext`, scoped to production/preview/development) — confirmed via `eas env:list` and via the next builds' logs actually printing "Environment variables ... loaded from the ... environment on EAS: EXPO_PUBLIC_...". `SUPABASE_PASSWORD` (a real DB credential, non-public) was deliberately NOT added here — it stays local-only for `scripts/db-migrate.js`.
  - New builds triggered: production AAB (versionCode 10) and a preview-profile installable APK, both with the fix. Once they finish, versionCode 10 needs uploading to Play Console the same way as before (Kapalı test → Alpha → Yeni sürüm oluştur → submit from Yayın özeti).

## Done, no longer blocking (2026-07-20)

- **versionCode 9 (account deletion) uploaded and submitted for review.** Uploaded via Play Console (evolaroa.app@gmail.com developer account — the DriftStop-owning one; note `muhammed.gulcu@gmail.com`'s own personal developer account is separate and shows as closed/suspended, not the right one) to Kapalı test → Alpha channel, then submitted for Google's review from the "Yayın özeti" (publishing overview) page. As of submission it was in Google's automated pre-check (~13 min), then goes to full review (usually much faster than production for closed testing). Check status at Play Console → DriftStop → Test edin ve yayınlayın → Yayın özeti.

- **Privacy policy at `mgulcu.me/driftstop/privacy` rewritten and pushed** (`my-site` repo, commit `6d8781b`, auto-deployed). Now covers: guest mode vs. optional accounts, what's stored server-side (email, favorites, reflections, settings via Supabase), RevenueCat-processed subscriptions, and the in-app account-deletion flow (Settings → Account → "Delete account"). Both EN and TR sections updated, dated 20 July 2026.

- **Both Supabase Edge Functions are deployed and verified live**, via `supabase login` (you) + `link`/`deploy`/`secrets set` (me):
  - `revenuecat-webhook` — `profiles.is_premium` now syncs from RevenueCat events. Webhook registered in the RevenueCat dashboard (DriftStop → Integrations → Webhooks → "Supabase profiles.is_premium sync"), auth secret generated and set via `supabase secrets set REVENUECAT_WEBHOOK_AUTH_TOKEN=...`. Verified end-to-end: "Send test event" → `200 {"ok":true,"test":true}`.
  - `delete-account` — verified deployed (`supabase functions list` shows `ACTIVE`, `verify_jwt: true`) and correctly rejects unauthenticated/invalid-token requests (`401` for both no `Authorization` header and a garbage token, checked via `curl`). Not exercised with a real logged-in user yet — do that once the next build with this feature is on a device.

## Not started yet (future phases, no urgency)

- **Engagement dalgası spec'i yazıldı (2026-08-16), iş başlamadı.** Onboarding hedef sorusu, gece
  hesaplaşması + streak, bildirim aksiyonları, geleceğe mesaj kasası, SOS, sertlik ayarı, akıllı
  zamanlama, özel bildirim sesi — dosya dosya TODO, testler ve cihaz-QA adımlarıyla:
  [`specs/engagement-roadmap.md`](../../specs/engagement-roadmap.md). İlk adım W0 spike'ları.

From the backend roadmap's rollout order — now unblocked since the webhook is deployed:
- Cross-device sync (favorites + settings + streak)
- Ritual layer (streak, notes/reflection, weekly summary)
- Personalization (themes, icons, widget styles)
- Sharing power (watermark-free cards, story format)
- Play Console declaration update (once email/personal data is actually collected via sync)

From the build plan:
- **iOS** (Phase 8) — on hold until Android is fully settled; needs a separate dev build, App Store listing, and a WidgetKit/Swift-based widget (the current widget package is Android-only).

## Known content gap (not a bug, no action needed unless you want it)

- Quote *body* text is only bilingual: `text` (English) and `textTr` (Turkish) — see `src/utils/quoteText.ts`. UI chrome (buttons, labels, settings, categories) is fully localized into all 6 supported languages (tr/en/es/de/fr/it), but users who pick Español/Deutsch/Français/Italiano see quote bodies in English (the fallback), not their own language. Confirmed live on-device for all four. This is a content-data limitation, not something to patch with generated text — flagging in case you want to prioritize translating the quote set later. The same gap applies to the 6 premium pack names/descriptions added below (`tr`/`en` only).
- The RevenueCat dashboard-granted "Pro" entitlement on the QA test account (`driftstop.qa.test1@mailinator.com`) is a temporary manual grant and had expired by the end of this session — the Pro/unlocked view of the new packs wasn't re-verified live on-device this round (the locked/free view was, exhaustively). Renew the grant in the RevenueCat dashboard if you want to re-check the unlocked view yourself.

## Recently fixed (for context, not action items)

- **Added in-app account deletion (2026-07-15)** — `supabase/functions/delete-account/` (new Edge Function, service-role, verifies the caller's own JWT before deleting), `useAuth.tsx` gained `deleteAccount()`, Settings → Account has a destructive "Delete account" link with a confirm dialog, localized into all 6 active languages. Not yet deployed — see the blocking item above.
- `usePurchases.tsx`: `getOfferings()` failing used to silently block `getCustomerInfo()` from ever updating `isPro`/`isAdsRemoved` (both were awaited in one `Promise.all`). Now independent calls.
- `quote/[id].tsx`: viewing a premium pack quote used to record its ID into the Home screen's own history, which only resolves static-quote IDs — this left the Home quote card blank. Premium quotes are now excluded from that recording.
- Free/guest users saw "0 söz" on locked packs and the entire "Yazarlar" (Authors) section was invisible, because pack quote counts and author counts were previously derived from RLS-restricted quote rows. Added `quote_packs.quote_count` (public column) and `get_premium_author_counts()` (public `SECURITY DEFINER` RPC) so counts are visible without exposing quote content — see migration `supabase/migrations/0003_pack_public_counts.sql`.
- **Premium content expanded to 18 packs / 3,325 quotes** (this line previously said "6 packs/451 quotes", which described only the first expansion wave — `scripts/seed-packs.js` is authoritative). The first wave was 6 packs/451 quotes across 31 real, publicly-sourced authors (Stoics extended to 56; new packs: Ancient Greek Philosophers 56, Eastern Wisdom 109, Enlightenment & Modern Thinkers 86, Literature & Poetry 64, Historical Trailblazers 80). Every quote is a real, verifiable line from a public-domain primary source (cited per-quote during research, not fabricated) — see `scripts/seed-packs.js`. Verified live via curl (public metadata) and on-device (locked/free view, all 6 packs + all 31 authors render with correct counts).
- Added a root `ErrorBoundary` (`src/components/ErrorBoundary.tsx`) so an unhandled render error shows a recoverable screen instead of a blank/black one; wired to optional Sentry crash reporting (`src/utils/crashReporting.ts`, no-ops until `EXPO_PUBLIC_SENTRY_DSN` is set in `.env`).
- Added accessibility roles/labels/states to the tab bar, `SketchButton`, `SketchToggle`, `ThemeChips`, `FrequencySelector`, and `QuoteCard`'s favorite/share actions.
- Added `.github/workflows/ci.yml` (type-check + tests on every push/PR; lint runs non-blocking due to pre-existing React Compiler false positives on Reanimated's `.value =` API).
- Test suite grew from 48 to 60 tests (9 to 12 suites) — added `ErrorBoundary`, `useSettings`, and `crashReporting` coverage using `@testing-library/react-native` (newly added dependency; note `render`/`renderHook`/`act` are async in this version).
