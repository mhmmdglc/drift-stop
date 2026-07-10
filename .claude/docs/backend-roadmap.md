# DriftStop Pro — Account, Premium & Remote Content Architecture

> Visual/detailed version: published as an Artifact (with margin notes, typewriter-file design).
> This file is the plain-text, git-searchable reference for the same plan.

## Decision summary
1. **Free doesn't get worse.** The 1000 quotes, offline reading, basic notifications, and widget all stay exactly as they are.
2. **Account = door, Pro = key.** Signing up alone doesn't unlock anything by itself; its real value is sync and carrying a purchase across devices.
3. **Quotes come from the server, but offline-first isn't compromised.** A full copy is kept on-device; the server is only the update/premium source.

## 1) Architecture
```
App (Expo) — offline-first, SQLite cache
   ↓
Supabase (Postgres + Auth + RLS) — source of truth for quotes/favorites/profile
   ↓
RevenueCat (on top of Play Billing) — single source of truth for purchases
   └─ webhook → Supabase Edge Function → updates profiles.is_premium
```
**Critical principle:** entitlement (whether the user is premium) is never decided on the client. Only the `profiles.is_premium` field is consulted, and only the RevenueCat webhook ever writes that field.

## 2) Data model (Supabase / Postgres)

**profiles** — id, display_name, is_premium, premium_since, streak_count, streak_last_date, created_at

**quotes** — id, text, text_tr, author, origin, era, tags[], pack_id, is_premium, updated_at
```sql
create policy "public_read_free" on quotes for select
  using (is_premium = false);

create policy "premium_read_entitled" on quotes for select
  using (
    is_premium = true and exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.is_premium = true
    )
  );
```

**quote_packs, favorites, reflections, user_settings** — all protected by RLS:
```sql
alter table favorites enable row level security;
create policy "own_rows_only" on favorites for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

**Deliberate decision:** `seenHistory` (a 200-entry cap) is not synced, it stays on-device only. Sync's value is in favorites + settings + streak.

## 3) Authentication
- Supabase Auth: email/password + continue with Google
- Guest-first: login isn't required, only triggered by "Go Pro"/"Sync"
- Existing users are preserved: on first sign-in, device data is automatically migrated to the server (migration-on-login)
- Purchases are tied to the account: RevenueCat `app_user_id` = Supabase user id → auto-restores on a new device

## 4) Content migration
- quotes.json → Postgres (one-time migration script)
- Client: embedded seed set + `updated_at`-based delta sync + **expo-sqlite** (not AsyncStorage)
- Buying a premium pack downloads the matching `pack_id` + unlocks it

## 5) Payments
- **RevenueCat + Google Play Billing** (Play policy: mandatory for digital content sales, no external payment allowed)
- `remove_ads` — one-time purchase (~$3-5)
- `pro_yearly` / `pro_monthly` — subscription: ad-free + premium packs + ritual features + sync
- Webhook → Supabase Edge Function → `profiles.is_premium`

## 6) Rollout order (sequenced by dependency)

| # | Phase | Note |
|---|---|---|
| 0 | ✅ Supabase scaffolding | Tables + RLS + Auth. Invisible to the user. |
| 1 | ✅ Quotes → API + local cache | Invisible transition, delta sync |
| 2 | ✅ Sign-up/sign-in (guest-first) | Email/password done. Continue with Google → needs an OAuth client, deferred. |
| 3 | ✅ RevenueCat + "Remove Ads" | SDK + paywall + entitlement gating done. Verified with the Test Store; real Play Console link is set up. |
| 4 | ✅ Premium content packs | Server-driven, entitlement-gated. UI ready; webhook deploy still pending. |
| 5 | Cross-device sync | Favorites + settings + streak |
| 6 | Ritual layer | Streak, notes/reflection, weekly summary |
| 7 | Personalization | Themes, icons, widget styles |
| 8 | Sharing power | Watermark-free cards, story format |
| 9 | **Play Console declaration update** | Required — email/personal data will be collected |
| 10 | Analytics | Supabase Studio is enough, no separate dashboard needed |

## 7) Info needed to get started

| What | Where from | Sensitivity |
|---|---|---|
| Project URL + `anon` key | Supabase → Project Settings → API | Public, safe to share |
| `service_role` key | Same page | Migration script only, in `.env`, never committed |
| RevenueCat account | We'll set one up together if none exists | — |
| Google OAuth client | Google Cloud Console | Needed in Phase 2 |

---
To start Phase 0: the Supabase project URL + anon key + (for migration) the service_role key are enough.

## Phase 1 notes (done)
- `supabase/migrations/0002_quotes_extra_fields.sql` — added `origin_emoji`, `category` to the `quotes` table (to match the client's `Quote` type exactly).
- `scripts/seed-quotes.js` (`npm run db:seed-quotes`) — upserts the 1000 quotes from `src/data/quotes.json` into Supabase, safe to re-run. Doesn't touch `is_premium`/`pack_id`.
- Client: `src/lib/supabase.ts` (client is `null` if `EXPO_PUBLIC_SUPABASE_ANON_KEY` is unset — sync silently no-ops), `src/db/quotesCache.ts` (expo-sqlite, sync API — `driftstop.db`), `src/services/quotesSync.ts` (delta sync by `updated_at`). Called in the background during `src/app/_layout.tsx`'s boot flow, swallowing errors.
- **Deliberate decision:** the static `QUOTES` array in `src/data/quotes.ts` (used by the widget headless task, tests, existing screens) was NOT changed — still the single read source. The SQLite cache just fills and syncs in the background for now; switching screens to read from it happens in Phase 4 alongside premium packs (when there's an actual need for it).
- **Missing:** `EXPO_PUBLIC_SUPABASE_ANON_KEY` isn't in `.env` yet (see `.env.example`) — until it's fetched from Supabase → Project Settings → API and added, client sync stays inactive (the app isn't affected, sync just stays a no-op).

## Phase 2 notes (done — email/password; Google deferred)
- `src/hooks/useAuth.tsx` — `AuthProvider`/`useAuth()`: Supabase Auth session state (`getSession` + `onAuthStateChange`), `signUpWithEmail`/`signInWithEmail`/`signOut`. `configured=false` (no anon key) behaves like guest everywhere.
- `src/app/auth.tsx` — email/password sign-in/sign-up screen, matching the "Sketch" design system, always skippable via `Skip` (guest-first stays intact).
- `src/app/(tabs)/settings.tsx` — new "Account" section: guest → "Sign in/Create account" link; signed in → email + "Sign out" (with confirmation dialog).
- Added `auth.*` and `settings.account.*` translations to all 6 active languages (tr/en/es/de/fr/it).
- **Verified end-to-end on the Android emulator:** sign up → Supabase email confirmation (via a real mailinator address) → sign in → a `profiles` row was auto-created (Phase 0's trigger works) → sign out. Test user cleaned up.
- **Continue with Google deferred** — needs a Google Cloud OAuth client the user doesn't have yet (see the table in §7). The code is designed so it can slot in next to `signInWithEmail`/`signUpWithEmail`; no Google button was added (a dead button call would be misleading).
- Supabase project requires email confirmation **by default** — `mapAuthError` handles this via `auth.errors.emailNotConfirmed`. Not an issue in prod since real users get a real email.

## Phase 3 notes (done — via sandbox/Test Store)
- **RevenueCat project set up:** project name "DriftStop" (proj9019ea60), Android app `com.driftstop.app` (app2be5c8cadb). The auto-created sample "EvolaRoa" App Store app (iOS, unused — iOS deferred to Phase 8) was left untouched.
- **Entitlements:** `pro` (came default with the account) + newly added `no_ads`. `pro_monthly`/`pro_yearly` products are both tied to both (a Pro subscriber automatically also becomes ad-free); `remove_ads` is tied only to `no_ads`.
- **Products (in the Test Store, prices confirmed by the user):** `remove_ads` ($2.99, non-consumable), `pro_monthly` ($2.99/mo), `pro_yearly` ($19.99/yr). Offering: `default` (3 packages: Lifetime/Annual/Monthly).
- **A real Play Store app also exists** (`DriftStop (Play Store)`, public key `goog_kfnkyAeLFJPffpZuAGGaYfiRWEN`) but the service account credentials were invalid/sample data — the Play Console link wasn't set up yet at that point. The client currently uses the **Test Store key** (`test_...`, `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` in `.env`) — purchases are simulated, no real money moves.
- **Client:** `src/lib/purchases.ts` (configure), `src/hooks/usePurchases.tsx` (PurchasesProvider/usePurchases — customerInfo, isPro, isAdsRemoved, purchasePackage, restorePurchases), `src/app/paywall.tsx` (package list + purchase + restore), a "Premium" section added to Settings. `src/utils/ads.ts` gained `setAdsSuppressed` — when `no_ads` is active, both the banner (reactive hook) and the interstitial (module-level flag) are disabled.
- **Verified end-to-end on the Android emulator:** opened the paywall → bought "Remove ads" (via RevenueCat's native Test Store dialog, "TEST VALID PURCHASE") → the entitlement activated instantly → the ad banner disappeared without a restart → Settings showed "Ads removed" → confirmed in the RevenueCat dashboard: customer showed "Total Spent: USD 2.99" and the "No Ads" entitlement active.
- **Needed before going to prod:** real in-app products (`remove_ads`, `pro_monthly`, `pro_yearly`) had to be created in Play Console, a real Play Console service account had to be linked to RevenueCat, then the `.env` key swapped for the real `goog_...` one. This step required the user to make product/pricing decisions in Play Console.
- **Completed later (2026-07-10):** all of the above is done — 3/3 products Active in Play Console, the RevenueCat ↔ Play Console service account link is set up and verified as "Valid credentials," and real-time Google developer notifications were tested end-to-end too. The `.env` key is now the real `goog_...` key. See the `driftstop-backend-status` project memory for details.

## Phase 4 notes (client side done — 2026-07-10; webhook deploy still pending on the user)

**Architecture — two independent layers, deliberately separated:**
1. **Client-side lock/unlock decision:** `isPro` from `usePurchases()` (the RevenueCat SDK, instant and reliable) — this drives the 🔒/unlocked state on the packs screen and the purchase CTA. Does NOT depend on the webhook.
2. **Server-side content delivery:** whether the actual premium quote TEXT can sync from Supabase depends on the `quotes_premium_read_entitled` RLS policy, which checks `profiles.is_premium` — and only the RevenueCat webhook writes that field (see below).

**Client changes:**
- `src/types/quote.ts` — added optional `isPremium`/`packId` to `Quote` (the embedded 1000 quotes are unaffected). New `src/types/quotePack.ts` — the `QuotePack` type + a `localizedPackField` helper.
- `src/db/quotesCache.ts` — `getAllCachedQuotes` now also returns `isPremium`/`packId` (it used to drop them); new `getCachedQuoteById`, `getCachedQuotesByPackId`, `getCachedPackQuoteCounts`.
- New `src/db/packsCache.ts` + `src/services/packsSync.ts` — a local SQLite mirror of the `quote_packs` table (full upsert, not delta, since the table is small). `syncPacks()` added next to `syncQuotes()` in `_layout.tsx` (fire-and-forget, silent failure).
- New `src/data/quotesAnySource.ts` — `getQuoteByIdAnySource` (checks the static array first, falls back to the cache) + `getPackQuotes`. **Deliberate boundary:** ONLY `favorites.tsx` and `quote/[id].tsx` use this. Home/widget/notification/scheduler were NOT changed — they still only ever return the static 1000 quotes; premium content never mixes into the main rotation (a product decision: packs are browsed separately, they don't leak into the main flow).
- New `src/hooks/usePacks.tsx` — manages the pack list (cache + locked/unlocked state via `isPro`). Computed synchronously with `useMemo` (to avoid tripping the new React Compiler rule `react-hooks/set-state-in-effect`); `refresh()` calls `syncPacks()` in the background and bumps a `version` counter.
- New screens: `src/app/packs/index.tsx` (pack list), `src/app/packs/[id].tsx` (pack detail — a paywall CTA if locked, a quote list → `/quote/[id]` if unlocked). Routes added to `_layout.tsx`. A "Discover content packs" link added to Settings → Premium.
- Translations added to all 6 active languages (`packs.*` + `settings.premium.packsLink`); `paywall.packages.proFeatures`'s "Premium packs (soon)" → "Premium packs" (now live, sync is still "soon").
- **Critical fix — the RevenueCat↔Supabase user link was missing:** added `Purchases.logIn(user.id)`/`Purchases.logOut()` to `usePurchases.tsx` (fired when the user signs in/out of Supabase). Without this, RevenueCat was using an anonymous `app_user_id` and the webhook could never know which `profiles` row to update.

**First premium pack — "The Stoics" (`scripts/seed-packs.js`, `npm run db:seed-packs`):** 24 quotes from Marcus Aurelius/Seneca/Epictetus (ids `100001`-`100024`, a range separate from the embedded 1000 — no collisions). **Deliberate decision:** these quotes were NOT added to `src/data/quotes.json` — they live only in Supabase, not as plaintext in the APK (consistent with the server-driven principle, protected by RLS). The script is re-runnable (upsert). RLS verified live: with the anon key, `quote_packs` is visible but `quotes` (pack_id=stoics) returns empty.

**Missing/the one piece still waiting on the user — RevenueCat webhook deploy:** `supabase/functions/revenuecat-webhook/index.ts` is fully written (updates `profiles.is_premium` based on event type: INITIAL_PURCHASE/RENEWAL/UNCANCELLATION/NON_RENEWING_PURCHASE/PRODUCT_CHANGE/TRANSFER → true, EXPIRATION → false, CANCELLATION/BILLING_ISSUE → unchanged, TEST → no-op). Deploy steps are in `supabase/functions/revenuecat-webhook/README.md` — they require `supabase login`/`link`/`deploy` + generating a secret + entering the webhook URL in the RevenueCat dashboard, all account-authentication/integration-configuration steps that have to be done by the user. **Until this is deployed:** the pack-unlock/paywall UI works fine (isPro is client-side), but even a signed-in Pro subscriber may not see the premium quote TEXT actually sync (RLS blocks it while `profiles.is_premium` is still false) — `packs/[id].tsx` shows a "Quotes are syncing" empty state in that case, it doesn't crash.

**Verification:** `tsc --noEmit`, `jest` (41/41, including new `quotesAnySource.test.ts` + `packsSync.test.ts`), `expo export -p android` (5390+ modules, no errors), `expo lint` (zero errors/warnings in the new code — pre-existing lint errors in the rest of the codebase were left out of scope for this phase; this was the first time `expo lint` was ever set up/run in this project).

**Phase 4 addendum — "Browse by author" (same day, at the user's request):** the user asked about the idea of sending content from the DB once the first 1000 quotes run out, or if a Pro user picks different content (e.g. specific authors); when asked to decide, this direction was chosen: **Home/widget/notification/scheduler were left untouched** (risky in a live app, and deliberately isolated since Phase 1) — instead, the existing, already-tested "packs" architecture was extended.
- `src/db/quotesCache.ts` — new `getCachedPremiumAuthors()` (all distinct authors across premium quotes + their counts, regardless of which pack) and `getCachedQuotesByAuthor(author)`.
- `src/data/quotesAnySource.ts` — new `getAuthorQuotes(author)`.
- `src/hooks/usePacks.tsx` — now also returns `authors: AuthorWithState[]` alongside `packs` (each author locked if `!isPro` — all premium content is gated on Pro, not pack-specific).
- `src/app/packs/index.tsx` — split into two sections: "Collections" (curated packs) and "Authors" (all authors across premium quotes).
- New screen `src/app/packs/author/[name].tsx` (author name URL-encoded) — same locked/unlocked read pattern as `packs/[id].tsx`.
- i18n: `packs.collectionsSectionTitle` / `packs.authorsSectionTitle` added to all 6 languages.
- Verification: `tsc`/`jest` (41/41)/`expo lint`/`expo export` all clean again.
