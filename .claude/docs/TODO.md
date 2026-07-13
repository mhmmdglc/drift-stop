# DriftStop — Pending / TODO

Single place to check what's actually outstanding, instead of hunting through scattered notes in other docs. Update this file (don't just append to old docs) whenever a pending item is resolved or a new one comes up.

## Needs your action (blocking)

- **Deploy the RevenueCat webhook** (`supabase/functions/revenuecat-webhook/`). Code is fully written; deploying requires `supabase login`/`link`/`deploy` + generating a secret + entering the webhook URL in the RevenueCat dashboard — all account-auth/integration steps that have to be done by you (see the function's own `README.md`). Until this is deployed, `profiles.is_premium` never gets set, so premium pack *content* won't actually sync for Pro users even though the paywall/lock UI works fine client-side. Details: [backend-roadmap.md](backend-roadmap.md) (Phase 4 notes).

## Not started yet (future phases, no urgency)

From the backend roadmap's rollout order — these come after the webhook deploy above:
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

- `usePurchases.tsx`: `getOfferings()` failing used to silently block `getCustomerInfo()` from ever updating `isPro`/`isAdsRemoved` (both were awaited in one `Promise.all`). Now independent calls.
- `quote/[id].tsx`: viewing a premium pack quote used to record its ID into the Home screen's own history, which only resolves static-quote IDs — this left the Home quote card blank. Premium quotes are now excluded from that recording.
- Free/guest users saw "0 söz" on locked packs and the entire "Yazarlar" (Authors) section was invisible, because pack quote counts and author counts were previously derived from RLS-restricted quote rows. Added `quote_packs.quote_count` (public column) and `get_premium_author_counts()` (public `SECURITY DEFINER` RPC) so counts are visible without exposing quote content — see migration `supabase/migrations/0003_pack_public_counts.sql`.
- **Premium content expanded from 1 pack/24 quotes to 6 packs/451 quotes** across 31 real, publicly-sourced authors (Stoics extended to 56; new packs: Ancient Greek Philosophers 56, Eastern Wisdom 109, Enlightenment & Modern Thinkers 86, Literature & Poetry 64, Historical Trailblazers 80). Every quote is a real, verifiable line from a public-domain primary source (cited per-quote during research, not fabricated) — see `scripts/seed-packs.js`. Verified live via curl (public metadata) and on-device (locked/free view, all 6 packs + all 31 authors render with correct counts).
- Added a root `ErrorBoundary` (`src/components/ErrorBoundary.tsx`) so an unhandled render error shows a recoverable screen instead of a blank/black one; wired to optional Sentry crash reporting (`src/utils/crashReporting.ts`, no-ops until `EXPO_PUBLIC_SENTRY_DSN` is set in `.env`).
- Added accessibility roles/labels/states to the tab bar, `SketchButton`, `SketchToggle`, `ThemeChips`, `FrequencySelector`, and `QuoteCard`'s favorite/share actions.
- Added `.github/workflows/ci.yml` (type-check + tests on every push/PR; lint runs non-blocking due to pre-existing React Compiler false positives on Reanimated's `.value =` API).
- Test suite grew from 48 to 60 tests (9 to 12 suites) — added `ErrorBoundary`, `useSettings`, and `crashReporting` coverage using `@testing-library/react-native` (newly added dependency; note `render`/`renderHook`/`act` are async in this version).
