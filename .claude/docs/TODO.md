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

## Recently fixed (for context, not action items)

- `usePurchases.tsx`: `getOfferings()` failing used to silently block `getCustomerInfo()` from ever updating `isPro`/`isAdsRemoved` (both were awaited in one `Promise.all`). Now independent calls.
- `quote/[id].tsx`: viewing a premium pack quote used to record its ID into the Home screen's own history, which only resolves static-quote IDs — this left the Home quote card blank. Premium quotes are now excluded from that recording.
