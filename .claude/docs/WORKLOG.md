# DriftStop — work log

Append-only record of who did what, when, and what came of it. Newest entries at the top.

The orchestrator writes an entry **when an agent is dispatched** and updates it **when that agent reports back**. Nothing is deleted or rewritten — if something turned out to be wrong, a later entry says so.

**Columns:** date · agent · task (with spec link) · outcome · evidence (commit, build id, screenshot path, or "not verified")

---

## 2026-07-25

| Time | Agent | Task | Outcome | Evidence |
|---|---|---|---|---|
| 21:5x | backend-engineer | T#26 follow-up: fix the 7 findings `code-reviewer` raised on the cached-premium purge | **Done in code; device behaviour still NOT verified.** (1) The purge now gates on a new `usePurchases.entitlementKnown` (`customerInfo != null`) instead of `!loading` — `loading` also clears when `getCustomerInfo()` *rejects*, which would have wiped a paying user's 3,325 rows on an offline/cleared-data cold start; the service now takes `'entitled' | 'none' | 'unknown'` so "unknown" cannot be passed as `false`. (2) Screens are invalidated after a restore via a module-level version counter (`usePremiumCacheVersion`, the `usePacks` idiom) — Favorites/quote detail/pack/author all depend on it. (3) Favorites shows `common.loading` instead of a lock while entitlement resolves. (4) Both destructive entry points swallow errors (a throwing purge used to leave `settings.tsx` stuck at "Loading…" *after* the account was deleted). (5) Cache completeness is measured against `packs.quote_count` + a `premium_backfill_count` watermark, so a partial cache converges instead of sticking at `count > 0`. (6) Deleted the unused ungated `getAllCachedQuotes()`. (7) `syncPremiumQuotes` takes an `isCancelled` probe checked between fetch and write, so signing out mid-restore cannot land rows on top of the purge. No migration and no server change — migrations 0004–0006 (`3e36793`) had already made the RLS/grant story real, and the docs were updated to match. | 132/132 tests (was 95), 17 suites; `tsc` clean; `expo lint` unchanged at 11 pre-existing errors (baseline worktree compared). New regression tests: guard does nothing when `loading` is false but `customerInfo` is null; Favorites re-reads the cache when only the version counter changes (verified it fails if the memo dep is removed); sufficiency/watermark rules. **Not verified on a device** — see the three extra QA steps in `TODO.md` |
| 17:4x | backend-engineer | T#26 Close the cached-premium-content revenue leak (TODO #8) — purge on entitlement loss, recover on re-subscribe, gate the local read path | **Done in code; device behaviour NOT verified.** Purge runs on every launch once entitlement is known (`usePremiumCacheGuard`) plus explicitly in `signOut`/`deleteAccount`; restore uses a new cursor-free `syncPremiumQuotes` (the delta cursor would otherwise never re-fetch those rows); all any-source readers now require `{ entitled }`; orphaned premium favorites render a locked row via id-only tombstones. No migration needed (local SQLite only). | 95/95 tests (was 60), `tsc` clean; live curl: premium query returns `[]` for anon **and** for a signed-in `is_premium=false` user, free rows + pack counts + 104-author RPC unaffected; `delete-account` still 401 unauth / `{ok:true}` with own JWT (test user created and deleted) |
| 15:3x | ux-designer | T1 (#16) Social button placement/treatment + rewrite 3 untrue "sync" strings in 6 locales | **Done.** Full design spec delivered; 3 corrected strings landed in all 6 locales. Also found: `/auth` has no ScrollView (would clip in German at large font scale — the mechanism by which AC 13 fails), and two app-wide contrast failures now tracked as #25. Asked for AC 14 to be reworded ("Continue with Apple" is an approved Apple button type). | `3e89b75`; 60/60 tests incl. locale parity |
| 15:0x | orchestrator | Fix 3 stale task descriptions PM could not amend (#18, #21, #22 still read "conditional") | Done | tasks #18/#21/#22 |
| 15:0x | project-manager | T2–T9 (#17–#24) created with owners + dependencies; spec updated with owner decisions (both platforms, Apple revoke IN, fix sync copy) | Done — flagged that it could not amend 3 task descriptions itself | [`specs/social-sign-in.md`](../specs/social-sign-in.md) |
| 14:5x | project-manager | Intake social sign-in request → spec + 3 blocking questions + work split | Done — owner answered all 3; found 5 doc contradictions, now on T9's checklist | [`specs/social-sign-in.md`](../specs/social-sign-in.md) |
| 14:24 | orchestrator | Close webhook fail-open found by the doc audit | Done — rejects with 503 when secret absent; redeployed | `0b70289`; verified live: no header → 401, wrong token → 401, valid token + TEST → `{ok,test}`, unauth grant attempt → 401 |
| 14:22 | orchestrator | Create the 7-agent pipeline + `WORKFLOW.md` | Done | `8994a5e` |
| ~14:20 | doc agent (ops) | Write `OPERATIONS.md` | Done — 592 lines; flagged 3 items it could not verify firsthand | `8994a5e` |
| ~14:15 | doc agent (arch) | Write `ARCHITECTURE.md` | Done — 649 lines; found the webhook fail-open, the lapsed-Pro content leak, empty iOS ad units, untested scheduler | `8994a5e`, findings → `TODO.md` |
| ~14:10 | doc agent (product) | Write `PRODUCT.md` | Done — 503 lines; found 7 discrepancies incl. sync promised in UI copy but never built | `8994a5e`, findings → `TODO.md` |
| 14:04 | orchestrator | Record v11 submission state | Done | `97d27ad` |

## 2026-07-24

| Time | Agent | Task | Outcome | Evidence |
|---|---|---|---|---|
| 21:07 | orchestrator | Android emulator regression + monetization UI verification | Passed — Pro card, lock badges, paywall entry points, widget provider all confirmed on screen. **Not verified:** purchase flow (emulator has no Play Billing) | `839ca8a`; screenshots under the session scratchpad |
| 21:05 | orchestrator | Fix launcher/dialog app name showing raw slug | Done | `f97c442` |
| — | orchestrator | Build + download versionCode 11 | Done | build `1b0d9e7a-c306-44f6-b70b-5b325a37fa74`, `~/Downloads/DriftStop-v11.aab` |

## 2026-07-23

| Time | Agent | Task | Outcome | Evidence |
|---|---|---|---|---|
| 23:43 | orchestrator | Monetization UX overhaul + iOS support fixes | Shipped to repo; **UI unverified at the time** (later verified 07-24) | `715e69f` |
| — | orchestrator | iOS Simulator E2E pass | Passed — auth, account create + email confirm, account deletion verified end to end against the live function | delete-account: real user created then deleted, API confirmed `user_not_found` |

## Earlier

Pre-dating this log. See `git log` and the dated "done" sections of `TODO.md` for: the EAS env-var failure and fix (versionCodes 7/8/9 shipped with no backend config), the account-deletion feature, both edge-function deployments, the RevenueCat webhook registration, and the privacy-policy rewrite.
