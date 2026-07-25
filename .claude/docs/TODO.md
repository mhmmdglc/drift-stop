# DriftStop — Pending / TODO

Single place to check what's actually outstanding, instead of hunting through scattered notes in other docs. Update this file (don't just append to old docs) whenever a pending item is resolved or a new one comes up.

## Open bugs found during the 2026-07-25 documentation audit

Found by reading the code against the shipped copy while writing `PRODUCT.md`. None of these are fixed yet; none were introduced by the docs work.

| # | Severity | Issue |
|---|---|---|
| 1 | **Major** | **iOS currently has no monetization at all.** Every gate keys off `purchasesConfigured`, which is false on iOS until an iOS RevenueCat key exists — so on iOS the 10-reminders/day Pro feature is free, no Pro card and no paywall render. Shipping iOS before the key exists means giving Pro away. |
| 2 | **Major** | **Three UI strings promise cross-device sync that does not exist.** `settings.account.guestHint`, `auth.subtitle` and `deleteAccountConfirmMessage` all say favorites/settings sync across devices; no client code syncs them (the paywall correctly hedges "Sync (soon)"). This is a truthfulness problem in a paid app — fix the copy or build the sync. |
| 3 | Major | **`paywall.purchaseSuccess` says "Ads are now off" after *any* purchase**, including a Pro subscription — wrong confirmation for the more expensive product. |
| 4 | Minor | **Pack titles fall back to Turkish for es/de/fr/it users.** `localizedPackField` resolves `locale → tr → en`, so those users see Turkish pack titles beside English quote bodies. The fallback should be `locale → en`. |
| 5 | Minor | Interstitial ads are effectively gated by a ~4-minute timer rather than the intended 12-swipe count. |
| 6 | Info | The Pro/unlocked pack view has still never been verified on a device (the QA grant expired). |
| 7 | **Blocker (security)** | **The RevenueCat webhook fails OPEN.** `revenuecat-webhook/index.ts:59` only checks the shared secret *if* `REVENUECAT_WEBHOOK_AUTH_TOKEN` is set. The function is deployed `--no-verify-jwt`, so if that secret is ever unset or lost, anyone who knows the URL can grant `is_premium` to any user UUID. The secret *is* currently set, so this is not live — but the code must fail closed (reject when the env var is missing) rather than depend on configuration being right. |
| 8 | **Major (revenue leak)** | **Premium content survives a lapsed subscription.** Premium quotes are cached in local SQLite and never purged, and `getQuoteByIdAnySource` / `getPackQuotes` / `getAuthorQuotes` read that cache with no entitlement check. A user who subscribes, syncs, then cancels keeps full premium text via Favorites and `/quote/[id]` indefinitely. |
| 9 | **Major (iOS)** | **iOS ads are misconfigured.** iOS ad unit ids are empty (`src/constants/adUnits.ts:10,12`) so release builds would serve Google's `TestIds` — zero ad revenue — and `app.json:62` still carries Google's *sample* AdMob publisher app id. Must be fixed before any iOS submission. |
| 10 | Major | **The core feature has no tests.** `src/utils/scheduler.ts` — permission handling, the 3-day scheduling loop, `syncDeliveredToHistory` — is entirely untested, and a regression there is silent: notifications simply stop arriving. Edge functions are also excluded from `tsc` (`tsconfig.json:22`) and untested. |
| 11 | Minor | Blocking synchronous SQLite work runs at boot (1,000-row seed) and inside `usePacks`'s `useMemo` during render. |
| 12 | Minor | Sync has no delete/tombstone propagation — a quote or pack removed server-side stays in the local cache forever. |
| 13 | Info | Three AsyncStorage keys are dead (written or read by nothing). Safe to remove. |

## Needs your action (blocking)

- **On your real phone once v11 reaches the Alpha track:** verify the paywall lists all 3 products with real prices and that a purchase completes. This is the ONLY thing never verified anywhere — the Android emulator has no Play Billing (`BILLING_UNAVAILABLE`), so product listing/purchase can only be checked on a real device with a Play account on the closed-testing list.
- **Play Console needs 12 testers + 14 days** on closed testing before production is unlockable (personal developer account rule). Currently 1 tester registered — send the ~12 emails when ready and they get added to the Alpha track's tester list.

## v11 submitted for review (2026-07-24)

versionCode 11 (1.0.1) uploaded to Kapalı test → Alpha, release name "11 (1.0.1)", en-US release notes written, submitted for Google review (status: "İncelenmekte olan değişiklikler"). Contains: EAS env fix (first builds with working Supabase/RevenueCat config were v10/v11 — 7/8/9 shipped with none), in-app account deletion, monetization UX overhaul, app display name fix. Only warning at review time was the missing R8/proguard mapping file — informational, non-blocking. Device support unchanged (12,268 phones, 0 dropped).

**Note on uploading:** the AAB drag-drop is the one step that can't be automated from here — the browser file-upload tool only accepts session-shared files and caps at 10 MB (the AAB is 86 MB), and `eas submit` needs a Google service-account JSON key (creating/downloading that key + granting it Play "Release manager" is a credential/permission op for the user). Everything after the upload (release name, notes, review submission) is automatable and was done here.
- **iOS App Store prep** (user has an Apple dev account, wants iOS live): needs an iOS RevenueCat API key (`EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`, both in `.env` and `eas env:create`) + App Store Connect app + IAP products mirroring Play's (`remove_ads`, `pro_monthly`, `pro_yearly`) + App Privacy form + screenshots. No 12-tester requirement on iOS; TestFlight optional; App Review is the only gate. Until the key exists, iOS builds run with purchases cleanly disabled (no paywall/Pro card/ads-removal UI shown).

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
