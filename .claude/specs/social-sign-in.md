# Spec — Social sign-in (Google + Apple) — v2

Status: **in progress, code partially merged, nothing verified on any device.**
Author: project-manager, 2026-08-09.
Supersedes: `.claude/specs/social-sign-in-v1-2026-07-25.md` (v1, approved 2026-07-25 — archived unchanged;
its §1.3 SHA-1 table, §1.4 identity-linking analysis and §6 documentation checklist are still authoritative
and are referenced from here rather than repeated).
Related: `.claude/docs/PRODUCT.md` §6/§8, `.claude/docs/ARCHITECTURE.md` §6, `.claude/docs/OPERATIONS.md`
§2/§7, `.claude/docs/TODO.md`.

> **Read this before planning anything.** v1 was written as if no code existed. Since then commit
> `5aefed2 feat: sign in with Google and Apple` landed on branch `monetization-v2` and implemented roughly
> 70 % of it. This v2 exists to (a) record what is actually in the tree, (b) list the defects found by
> reviewing that code against the config, and (c) define what still has to happen before anyone can call it
> done. **No part of this feature has ever run on a device or simulator.** `npx tsc --noEmit` is clean and
> `npx jest` is 232/232 green at HEAD — which, per `AGENTS.md` rule 2, means nothing about whether it works.

---

## Goal

A DriftStop user who does not want to invent another password can create or recover their account in one
tap. On `/auth` they see, above the existing email + password form, "Continue with Google" (Android and iOS)
and Apple's native Sign in with Apple button (iOS only). Tapping either opens the OS account sheet; on
success the user lands back where they came from, already signed in, with the same Supabase user id and
therefore the same `profiles` row, the same RevenueCat `app_user_id` and the same Pro entitlement they would
have had via email. Guests are unaffected: nothing in the free loop — notifications, history, favourites,
widget, settings — requires an account, and if a provider is not configured for the build its button is not
rendered at all.

---

## 1. What is already in the tree (HEAD = `5aefed2`, branch `monetization-v2`)

| Piece | File | State |
|---|---|---|
| Native Google + Apple credential capture | `src/lib/socialAuth.ts` (new, 123 lines) | Implemented. `signInWithGoogle()`, `signInWithApple()`, `googleSignInAvailable` (const, true when `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is non-empty), `appleSignInAvailable()` (async: iOS **and** `AppleAuthentication.isAvailableAsync()`), `isSocialError()`. Google SDK is dynamically `import()`ed so it does not cost boot time |
| Supabase exchange | `src/hooks/useAuth.tsx:103-131` | Implemented. `signInWithProvider('google' \| 'apple')` → `supabase.auth.signInWithIdToken({ provider, token })`. Cancellation returns `{ error: null }`. Apple's first-authorization full name is written immediately via `auth.updateUser({ data: { full_name } })` |
| `/auth` UI | `src/app/auth.tsx:157-177` | Implemented **with the wrong button components** — see F2/F3 below. Social block sits above the email form, hidden entirely when neither provider is available, followed by an `auth.orEmail` divider line. `ScrollView` restructure from v1 §1.7 is done |
| Copy | `src/locales/*.json` | `auth.continueWithGoogle`, `auth.continueWithApple`, `auth.orEmail`, `auth.errors.providerUnavailable` present in all 6 active locales (verified key-by-key) and additionally in `ar`/`ja`. Parity suite green |
| Native config | `app.json` plugins | `@react-native-google-signin/google-signin` and `expo-apple-authentication` added. Introspection confirms the entitlement `com.apple.developer.applesignin: ['Default']` is emitted |
| Apple capability | Apple Developer portal | Commit message records that Sign In with Apple was enabled on `com.driftstop.app` via the ASC API and the provisioning profile regenerated. **Not independently verified here** |
| Client ids | `.env` + EAS cloud env | Verified present in `.env` and in EAS `production` (`npx eas env:list`): `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`. `preview`/`development` **not** re-checked in this pass |

### Defects and gaps found reviewing that code (this is the real work list)

| # | Severity | Finding | Evidence |
|---|---|---|---|
| **F1** | **Blocker (iOS)** | **The reversed iOS client id is not registered as a URL scheme, so Google sign-in on iOS cannot return to the app.** The Google plugin was added to `app.json` as a bare string with no props, so it contributed no `iosUrlScheme`. `npx expo config --type introspect` emits `CFBundleURLSchemes: ['driftstop', 'com.driftstop.app']` — no `com.googleusercontent.apps.591923071526-2le5mn1grsdie51f63afh8vkmm84pa13` anywhere in the config. The plugin did not error; it silently did nothing. **This is the project's signature failure mode** (three Play builds with no backend config) reproduced exactly | introspected config, 2026-08-09 |
| **F2** | **Blocker (App Review)** | **The Apple button is a hand-drawn `SketchButton`, not `AppleAuthentication.AppleAuthenticationButton`.** Apple requires Sign in with Apple to use their button (or a compliant equivalent carrying the Apple logo and approved wording, at approved sizes/contrast). A custom-drawn button with no Apple mark is a rejection risk on a submission we are otherwise ready for. v1 §1.7 already specified the native button | `src/app/auth.tsx:166-172` |
| **F3** | Major | **The Google button carries no Google mark.** Google's branding rules for "Sign in with Google" require the G mark and approved styling; the current button is a plain sketch button with a text label. Lower review risk than F2 but still a policy item, and v1 §1.7 specified a `GoogleGlyph`/`GoogleSignInButton` pair with the explicit rule that the glyph is never dimmed | `src/app/auth.tsx:159-165` |
| **F4** | **Blocker (Android)** | **The Google button renders on Android whenever the *web* client id exists — but no Android OAuth client exists yet.** Google matches an Android client on package name + signing-certificate SHA-1; with none registered, tapping the button fails with `DEVELOPER_ERROR` and the user sees only the generic error line. Shipping this to the Alpha track as-is gives every tester a broken button | `socialAuth.ts:26` + the fact that the Android client is still unregistered |
| **F5** | Major | **Apple token revocation on account deletion is not implemented.** v1 §1.5 committed to it (owner decision, 2026-07-25); `supabase/functions/delete-account/index.ts` was not touched by `5aefed2`. Without it, a deleted user still sees DriftStop under Settings → Apple ID → Sign in with Apple. Needs a Services ID + `.p8` key, both owner-produced. **See blocking question Q1** | `git show 5aefed2 --stat` |
| **F6** | Major | **No nonce is generated for either provider**, contrary to v1 §1.2. This is probably fine — Apple omits the `nonce` claim when none is requested and Supabase then has nothing to compare — but it is unproven, and the failure mode is a generic "invalid token" that looks like a config error. Must be settled empirically on device, not by reading | `socialAuth.ts` (no `expo-crypto`, no nonce) |
| **F7** | Major | **The `iosUrlScheme` ↔ `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` divergence guard required by v1 §5 does not exist**, and F1 is precisely the bug it was supposed to catch | no test references `socialAuth` or `app.json` client ids |
| **F8** | Minor | `.env.example` does not list either new variable, so a fresh clone silently ships without Google sign-in | `grep GOOGLE .env.example` → nothing |
| **F9** | Minor | **Google Play services failure has no distinct message.** `hasPlayServices()` throwing lands in the generic `auth.errors.generic`, so a user with an outdated Play Services gets "Something went wrong" instead of an actionable line. v1 §1.7 specified `auth.errors.playServices` | `socialAuth.ts:76-81` |
| **F10** | Minor | **No hint that Apple's Hide My Email creates a separate account.** v1 §1.7 specified `auth.social.appleRelayHint`; it was not shipped. This is the most likely future support question ("where did my Pro go?") | locale diff of `5aefed2` |
| **F11** | Info | **Zero test coverage for the new module.** No test asserts that the buttons hide when unconfigured — the exact behaviour that is supposed to protect us from a broken shipped build | `src/lib/` has no `__tests__` |

---

## 2. Blocking questions for the owner

Only two. Everything else in this spec is decided.

**Q1 — Is Apple token revocation on account deletion still in scope for this release?**
v1 said yes (owner decision, 2026-07-25) and it was not built. It needs an Apple **Services ID** and a
**`.p8` signing key** — both owner-only, both credential-creation steps — plus a 6-month secret-rotation
chore forever after. If the answer is "not this release", account deletion still works and Supabase still
deletes the user; the only visible gap is that DriftStop keeps appearing under the user's Apple ID settings,
and we accept that in writing rather than discovering it in review.

**Q2 — Does the next release ship Android as well as iOS, and if the Play App Signing SHA-1 is not
registered by then, may we hide the Google button on Android?**
Right now the button renders on Android with no Android OAuth client behind it (F4). The proposed default,
if you do not say otherwise: **gate the Google button on a build-time flag so Android shows it only once the
Android OAuth client exists**, and ship iOS first. A wrong assumption here means either shipping a broken
button to 16 closed testers or needlessly delaying iOS.

Already settled, do not re-ask: both providers ship in the same release (Apple's rule — Google alone on iOS
is a guaranteed rejection); sign-in stays optional and no screen becomes account-gated; all 6 active locales
(tr/en/es/de/fr/it) ship day one, ar/ja stay excluded from the parity suite as today; no new store products,
SKUs or prices are involved; the notification rotation, widget and Home screen are not touched and stay on
the static 1000 free quotes.

---

## 3. The auth flow, end to end

### 3.1 Google (Android and iOS) — native, no browser

```
[user taps Continue with Google]
  → GoogleSignin.configure({ webClientId: EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
                             iosClientId:  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID })   (once per process)
  → GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })          (Android only in practice)
  → GoogleSignin.signIn()            → OS account chooser
  → result.data.idToken              (v13+ wraps the response in { type, data })
  → supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })
  → onAuthStateChange fires → AuthProvider session set
  → PurchasesProvider effect calls Purchases.logIn(user.id)  → entitlement follows the account
```

- The **web** client id is the audience Supabase validates; the **iOS** client id is what lets the native
  flow start on iOS. The **Android** client id is never read by the app — the client merely has to exist in
  the same Google Cloud project with package `com.driftstop.app` and the right SHA-1 fingerprints.
- Three fingerprints must eventually be registered: debug keystore, upload key
  (`93:64:96:08:BB:0F:2F:51:C9:7E:6D:9D:FE:34:43:E1:6F:F7:4D:B3`), and **Play App Signing** — the last one is
  the only one that governs what closed testers install. See v1 §1.3 for how to read each.
- Supabase side: Authentication → Providers → Google enabled, **Client IDs** = web id first, then the iOS
  id, comma-separated.

### 3.2 Apple (iOS only) — native, no browser

```
[user taps Sign in with Apple]
  → AppleAuthentication.signInAsync({ requestedScopes: [FULL_NAME, EMAIL] })
  → credential.identityToken (aud = com.driftstop.app)
  → supabase.auth.signInWithIdToken({ provider: 'apple', token: identityToken })
  → if credential.fullName was supplied (FIRST authorization only):
       supabase.auth.updateUser({ data: { full_name } })     ← or it is lost forever
```

- Apple is deliberately **iOS-only**: `expo-apple-authentication` has no Android implementation and Apple
  mandates the button only on Apple platforms. The button is never rendered on Android.
- Supabase side: Authentication → Providers → Apple enabled with `com.driftstop.app` in **Client IDs**. A
  Secret Key is required only for the web flow and for token revocation (Q1); if revocation ships, the
  **Services ID must be listed first** — native sign-in accepts any id in the list, but the REST side uses
  the first, so getting this wrong breaks revocation only, silently, while the happy path stays green.
- **The design must never depend on getting a name or a real email address.** Hide My Email returns an
  `@privaterelay.appleid.com` address; that address is the account. No screen may require a display name.

### 3.3 What an account is worth (unchanged, do not re-promise more)

Signing in gives exactly two things today: the RevenueCat `app_user_id` becomes the Supabase user id (so a
purchase follows the person to a new phone), and premium quote *bodies* become downloadable under the
`quotes_premium_read_entitled` RLS policy. **Cross-device sync of favourites/settings/history does not
exist and is not built here.** The in-app copy was already corrected in `3e89b75` and now says exactly this
("Pro access and premium packs follow your account. Favorites and settings stay on this device.") — this
feature **leaves that copy as it is** and adds no new sync claim. `PRODUCT.md` §6/§9 still quote the old,
pre-`3e89b75` strings and are stale (see §9).

### 3.4 Identity linking (unchanged from v1 §1.4, restated because QA must check it)

| Case | Behaviour we rely on | Decision |
|---|---|---|
| Confirmed email+password account, later signs in with Google on the same address | Supabase links the identity to the existing user → same user id, same `profiles` row, same entitlement; password keeps working | Desired. Write no linking code. Verify (AC 10) |
| Unconfirmed email+password account, then Google on the same address | Supabase drops the unconfirmed identity; the password stops working | Accept. Observe and record (AC 11) |
| Apple Hide My Email | Relay address ⇒ a separate Supabase user with separate entitlement | Accept, and warn in copy (F10) |
| Anything else | No `linkIdentity()` / `unlinkIdentity()` UI | Out of scope |

---

## 4. Scope

- **Fix F1**: give the Google config plugin its `iosUrlScheme`
  (`com.googleusercontent.apps.591923071526-2le5mn1grsdie51f63afh8vkmm84pa13`) so the reversed client id
  reaches `CFBundleURLTypes`, and prove it by introspection **and** on a simulator.
- **Fix F2**: replace the Apple `SketchButton` with `AppleAuthentication.AppleAuthenticationButton`
  (`buttonType = CONTINUE`), styled only via `buttonStyle` + `cornerRadius` + an explicit `height`/`width`
  in `style` (without a size it does not render at all). No `backgroundColor`, no `borderRadius` override.
- **Fix F3**: give the Google button the Google mark per v1 §1.7 (`GoogleGlyph` + `GoogleSignInButton`), with
  the standing rule that the glyph is never dimmed — press/disabled/loading dim the container and label only.
- **Fix F4**: gate Google-on-Android on the Android OAuth client actually existing (owner-controlled flag or
  a separate `EXPO_PUBLIC_*` var), per Q2.
- **Fix F6**: settle the nonce question empirically. If either provider's token is rejected, implement the
  raw/SHA-256 nonce pair with `expo-crypto` (hashed to the provider, raw to Supabase) — never
  `skip_nonce_check`.
- **Fix F7**: a Jest test that reverses `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` and asserts it equals the
  `iosUrlScheme` in `app.json`, failing loudly on divergence. This runs in CI and would have caught F1.
- **Fix F8**: both variables added to `.env.example`; EAS `preview` and `development` environments
  re-verified with pasted `eas env:list` output.
- **Fix F9**: a distinct, actionable message for the Play-services failure (`auth.errors.playServices`).
- **Fix F10**: a one-line hint near the Apple button that hiding your email creates a separate account.
- **Fix F11**: unit tests for the availability gating — button hidden when the client id is absent, hidden on
  Android for Apple, cancellation mapped to `{ error: null }`.
- New/changed strings land in **all 6 active locale files**, written by `ux-designer`, transcribed verbatim.
- Supabase provider configuration for both providers (owner at the keyboard).
- **Conditional on Q1:** Apple token revocation before `auth.admin.deleteUser` in `delete-account`, with
  `APPLE_TEAM_ID` / `APPLE_SERVICES_ID` / `APPLE_KEY_ID` / `.p8` as Supabase function secrets. A revocation
  failure must be logged but must **not** block the Supabase deletion — the user asked to be deleted.

### Out of scope

- Cross-device sync of favourites / settings / history / reflections (backend roadmap Phase 5). Not even the
  copy — it is already correct.
- `linkIdentity()` / `unlinkIdentity()` UI, account merging, or any "we found your other account" flow.
- Facebook, X, or any third provider. Android Credential Manager migration.
- Showing a Google/Apple avatar anywhere. The captured `full_name` is stored but not displayed.
- Password reset (already shipped separately), email confirmation changes.
- Fixing `DarkColors.fire` (3.77:1) and `LightColors.textMuted` (4.14:1) contrast — app-wide palette work,
  still tracked as #25. The new error and hint lines knowingly inherit it.
- iOS AdMob unit ids, the iOS widget, RevenueCat iOS product verification — unrelated, still open.
- Uploading anything to Play Console or App Store Connect.

---

## 5. UI / UX requirements for `/auth`

- Social block sits **above** the email form (already true), followed by the `auth.orEmail` divider. The
  whole block, divider included, is hidden when no provider is available — no orphan "or", no empty gap.
- Order: Google first, then Apple on iOS. Both full-width and of equal prominence; the Apple button must
  never be visually smaller or lower-contrast than Google's.
- Only one auth attempt at a time: while a provider is in flight, the other provider button and the email
  submit are disabled.
- `/auth` keeps its `ScrollView` inside the `KeyboardAvoidingView` so two extra buttons plus a divider cannot
  push the submit button out of reach at large system font scale (this was v1's AC 13 and is already done —
  do not regress it).
- Accessibility props on both buttons, per project convention: `accessibilityRole="button"`,
  `accessibilityLabel` from i18n, `hitSlop`.
- Every string from i18n. No hardcoded label, no invented translation.

### Error and cancellation states

| Situation | What the user sees |
|---|---|
| User dismisses the account chooser / Apple sheet | **Nothing.** No error line, no toast, no layout shift; the button returns to idle and is tappable again. `ERR_REQUEST_CANCELED`, `SIGN_IN_CANCELLED`, `-5`, `12501` and the v13 `{ type: 'cancelled' }` shape all map to silence |
| Provider returns no id token | One localized generic error line in the existing error slot |
| Network failure | One localized error line; app does not crash; retry works after connectivity returns |
| Google Play services missing/outdated (Android) | The distinct `auth.errors.playServices` line, not the generic one |
| Provider not configured for this build | Button not rendered at all. `auth.errors.providerUnavailable` exists as a defence in depth but should be unreachable in a correctly configured build |
| Supabase rejects the id token | Generic error line; the raw SDK message never reaches the screen |
| Success | `/auth` closes back to where the user came from; Settings → Account shows the address and a Sign out row |

---

## 6. Acceptance criteria

QA reports each as **observed-pass**, **observed-fail** (with what was seen) or **not-verified** (with why).
Not-verified never counts as a pass. "Signed in" means Settings → Account shows an email address and a
"Sign out" row.

**Configuration proof (before any device work)**

1. `npx expo config --type introspect` emits `com.googleusercontent.apps.591923071526-2le5mn1grsdie51f63afh8vkmm84pa13`
   inside `ios.infoPlist.CFBundleURLTypes[].CFBundleURLSchemes`, alongside `driftstop`.
2. `npx eas env:list` for `production`, `preview` **and** `development` each show both
   `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (paste the output).
3. `npx jest` includes a test that fails if `app.json`'s `iosUrlScheme` and the reversed
   `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` diverge (demonstrate by temporarily breaking one).

**Android emulator `Medium_Phone_API_36.1` (`google_apis_playstore`, Play Services present)**

4. Fresh install → onboarding → Settings → Account (guest) → "Sign in / Create account" opens `/auth`, which
   shows the Google button with the Google mark above the email form and a single "or use email" divider.
   **No Apple button appears anywhere on Android.**
5. Tapping the Google button opens the system account chooser; choosing an account dismisses it, `/auth`
   closes, and Settings → Account shows that Google address.
6. Force-quit and relaunch: still signed in, no re-auth prompt, no visible extra delay at boot.
7. Sign out → guest state returns. Signing in again with the same Google account shows the same email, and
   the Supabase dashboard shows **one** `auth.users` row for it, not two.
8. **Cancel:** tap the Google button, dismiss the chooser with Back or by tapping outside → back on `/auth`
   with no error text, no stuck "loading" label, button tappable again.
9. **No network:** airplane mode → tap → exactly one localized human-readable error line (no raw SDK text,
   no stack trace, no silent nothing), no crash. Disable airplane mode, retry → sign-in succeeds.
10. **Not configured:** a build with `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` removed renders `/auth` with no
    Google button, no orphan divider and no empty gap; email sign-in still works.
11. **Linking, confirmed account:** sign in with the email+password QA account, note the email; sign out;
    sign in with Google on the **same address**. Settings → Account shows the same email, the Supabase user
    id is unchanged, the entitlement state shown in Settings is the same before and after, and signing in
    with the password afterwards still works.
12. **Linking, unconfirmed account:** create a new email+password account, do not confirm it, then sign in
    with Google on that address. Report the observed behaviour verbatim (expected: Google succeeds, the
    password stops working). This criterion is about knowing the truth, not a specific outcome.
13. **Deletion:** as a Google-signed-in user, Settings → Account → Delete account → confirm → signed out,
    guest state, and the `auth.users` row gone in the Supabase dashboard. Signing in with the same Google
    account afterwards produces a **new** user id.
14. **Guest is untouched:** from a fresh install, skip `/auth` entirely and use the app for a full session —
    onboarding, Home, favourites, settings, quote detail. No screen asks for an account, no modal, no nag.
15. **Core loop has not regressed after the native-module prebuild:** a scheduled notification fires and its
    quote lands in history; the DriftStop widget still appears in the widget picker and renders the latest
    quote; frequency 7/10 still shows the lock badge for a non-Pro user; the Home banner ad still renders for
    a free user.
16. `/auth` renders correctly in all 6 UI languages and in both light and dark theme — no clipped labels, no
    `[missing …]` placeholders, divider text on one line.

**iOS Simulator (`npx expo run:ios`)**

17. `/auth` shows Apple's **native** Sign in with Apple button (unrestyled apart from `buttonStyle` and
    `cornerRadius`) **and** the Google button, Apple's at least as prominent as Google's.
18. Tapping the Apple button presents the system sheet; completing it returns to the app signed in, with
    Settings → Account showing the Apple-provided address.
19. **Apple cancel:** dismiss the sheet → back on `/auth`, nothing displayed, button tappable again.
20. **First-authorization name capture:** on a *first-ever* authorization for this bundle id, after sign-in
    the Supabase user's `user_metadata.full_name` is populated. Sign out and sign in again (Apple now sends
    no name): sign-in still succeeds and the stored name is not blanked.
21. **Hide My Email:** choosing "Hide My Email" signs in successfully and Settings → Account shows the
    `@privaterelay.appleid.com` address; the app does not error on the relay address anywhere.
22. **Google on iOS completes** — the sheet opens, an account is chosen, and control returns to the app
    signed in. (This is the F1 fix; before it, this criterion fails.)
23. Sign out and sign back in with Apple → the same Supabase user id, no duplicate row.
24. **Deletion as an Apple user:** the same outcome as criterion 13. **If Q1 = revocation in scope:**
    additionally, DriftStop no longer appears under iOS Settings → Apple ID → Sign in with Apple for that
    Apple ID. This is the only place revocation is observable.
25. With `isAvailableAsync()` forced false, no Apple button renders and `/auth` is otherwise intact.

**Store-build gate**

26. An EAS `preview` build's log contains the `Environment variables … loaded from the "preview"
    environment on EAS:` line **listing both `EXPO_PUBLIC_GOOGLE_*` vars**, and a Google sign-in completes
    from that installed artifact on real hardware. Per `OPERATIONS.md` §2, nothing about the shipped binary
    is verified without this — and for Android it is only fully proven from a build re-signed by Play App
    Signing, i.e. from the closed-testing track.

---

## 7. Work split

| Agent | Task | Depends on |
|---|---|---|
| `ux-designer` | **W1** Google-branded button + Apple native button placement, states, and the copy for `auth.errors.playServices` and the Hide-My-Email hint, in EN/TR source | — |
| `frontend-dev` | **W2** Fix F1 (`iosUrlScheme`) + F7 (divergence test) + F8 (`.env.example`) | — |
| `frontend-dev` | **W3** Fix F2/F3: native Apple button, Google-marked button, one-attempt-at-a-time states | W1 |
| `frontend-dev` | **W4** Fix F4 (Android gating per Q2), F9 (Play-services error), F10 (relay hint), 6-locale strings | W1, Q2 answered |
| `frontend-dev` | **W5** Fix F11: unit tests for availability gating and cancel-is-not-an-error | W2, W3 |
| `backend-dev` | **W6** Supabase Google + Apple provider configuration (owner at the keyboard), plus EAS env re-verification for all three environments | owner sessions |
| `backend-dev` | **W7** Apple token revocation in `delete-account` + function secrets — **only if Q1 = yes** | Q1, W6 |
| `qa-tester` | **W8** Android run: AC 1–3, 4–16 | W2–W5, W6 |
| `qa-tester` | **W9** iOS Simulator run: AC 17–25 | W2–W5, W6, W7 |
| `release-manager` | **W10** EAS `preview` build + store-build gate, AC 26 | W8 |
| `project-manager` | **W11** Triage QA failures, correct criteria that were wrong, re-run until every criterion passes; then the doc updates in §9 and v1 §6's checklist | W8, W9, W10 |

---

## 8. Risks

| Risk | Why it is plausible here | Covered by |
|---|---|---|
| **The feature silently no-ops in the store build** | Exactly the v7/8/9 failure, and F1 is the same class of bug already present today: a missing config value produces no error, just an absent scheme or an absent button | AC 1, 2, 26 |
| **`DEVELOPER_ERROR` for real Play testers only** | Only the Play App Signing SHA-1 governs store installs; debug/upload fingerprints make it work everywhere except where it matters | AC 26, §10 blocker B1 |
| **App Review rejection on the Apple button** | F2 as it stands today; a submission is imminent | AC 17 |
| **Notification scheduler regression** | Any `_layout.tsx` / provider-order churn silently stops notifications. `AuthProvider` must stay above `PurchasesProvider` (`usePurchases` consumes `useAuth`) | AC 15 |
| **Android widget stops registering** | New native modules force a prebuild, and `index.js` registers the widget handler before the router; this has broken before | AC 15 |
| **Entitlement churn on sign-in** | Social sign-in makes "guest bought Pro, then signs in" common; `Purchases.logIn(user.id)` may alias or transfer the anonymous purchaser. Losing entitlement here is a fix-now bug, not a RevenueCat quirk to accept | AC 11 |
| **Guest experience degraded** | Guest-first is a core product property; a new native module crashing at boot would break the whole app for people who never sign in | AC 6, 14, 15 |
| **6-locale parity test fails** | `src/i18n/__tests__/locales.test.ts` compares flattened key structure against `tr` and rejects empty strings | `npx jest` in DoD, AC 16 |
| **Nonce mismatch** | F6; surfaces as a generic invalid-token error indistinguishable from a config mistake | AC 5, 18 |
| **Google OAuth app left in "Testing"** | Only listed test users can sign in — looks exactly like a code bug | §10 blocker B3 |
| **Apple secret expiry (~6 months, silent)** | If revocation ships, the `.p8`-derived secret expires and both Apple sign-in and revocation start failing on an app nobody is actively working on | §10 blocker B5; must land in `OPERATIONS.md` |
| **versionCode / build-number collision** | iOS 1.1.0 (build 3) is in App Review right now; the wallpaper feature is already merged for the next version | `release-manager` cuts the next version only after review resolves |

---

## 9. Findings that contradict the docs (raise, do not silently fix)

1. **`PRODUCT.md` §6 accounts table says "Google / Apple sign-in — **No.** Not implemented anywhere."** and
   §8 repeats it. Wrong as of `5aefed2`. Must be rewritten when this feature lands — including the "Apple
   requires it … currently moot" sentence, which is no longer moot.
2. **`PRODUCT.md` §6 "Sync: claimed but NOT implemented" and §9 discrepancy #2 quote the pre-`3e89b75`
   strings verbatim.** The live copy no longer promises cross-device sync (verified in `en.json` today), so
   those quotations will send the next reader to "fix" copy that is already fixed. The section's real point —
   `favorites` / `user_settings` / `reflections` have no client code — is still true and should stay.
3. **`OPERATIONS.md` §7 says the Apple 4.8 rule "does not bite" because the app is email/password only, and
   that "Google sign-in was deferred for lack of an OAuth client".** Both clauses are now false: the OAuth
   clients exist, the code exists, and the rule now binds absolutely.
4. **`OPERATIONS.md` §2 and §7 say `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` "does not exist yet".** It is present
   in `.env` on this machine (seen in the env export list during config introspection). Not this feature's
   business, but the doc is stale and the same table is where the two new Google vars must be added.
5. **`ARCHITECTURE.md` §6's env list** omits both Google vars and still lists `EXPO_PUBLIC_SENTRY_DSN` as a
   `.env` entry. Fold into the same doc pass.
6. **`TODO.md` "Social sign-in is still absent" (QA sweep 2026-08-01)** says "not a line of it exists" and
   that `useAuth` has only email/password + sign-out + delete, and that there is "no password reset". All
   three are now wrong — password reset shipped, and `5aefed2` shipped social sign-in.
7. **`ARCHITECTURE.md` §10 test counts (132 tests / 17 suites) and `PRODUCT.md`'s versionCode 11 / 1.0.1
   header are stale.** HEAD is 232 tests / 25 suites and `versionCode 14`.

---

## 10. Blockers owned by the account owner

These cannot be automated. Each is a credential, a permission, or a password.

| # | Blocker | Why only the owner | Consequence if skipped |
|---|---|---|---|
| **B1** | **Android OAuth client** in Google Cloud project `driftstop`, package `com.driftstop.app`, registering **all three** SHA-1s: debug keystore, upload key (`93:64:96:08:BB:0F:2F:51:C9:7E:6D:9D:FE:34:43:E1:6F:F7:4D:B3`) and the **Play App Signing** certificate read from Play Console → Test and release → Setup → App integrity | Creating an OAuth client and reading the Play App Signing page both require the owner's Play/Cloud session | Google sign-in fails on Android with `DEVELOPER_ERROR` — for closed testers specifically, if only the upload key is registered |
| **B2** | **Supabase → Authentication → Providers → Google**: enable, Client IDs = web id first then iOS id | Dashboard credential entry | `signInWithIdToken` rejects every Google token; both platforms fail identically |
| **B3** | **Google Auth Platform → Audience → publishing status "In production"** | Owner's console | While in "Testing", only listed test users can sign in (100 cap) and everyone else sees a failure that looks exactly like a code bug |
| **B4** | **Supabase → Authentication → Providers → Apple**: enable, Client IDs containing `com.driftstop.app` (Services ID **first** if B5 happens) | Dashboard credential entry | Apple sign-in fails on every device |
| **B5** | *(only if Q1 = yes)* Apple **Services ID** + **`.p8` signing key**, and their values as Supabase function secrets. Plus a calendar reminder: the derived secret **expires every 6 months** | Apple Developer credential creation; the `.p8` downloads once and cannot be re-downloaded | Token revocation cannot be implemented; a deleted user keeps seeing DriftStop in their Apple ID settings |
| **B6** | A **Google account signed into the Android emulator**, and an **Apple ID signed into the iOS Simulator** | Real passwords | QA can still verify the cancel, no-network and not-configured paths, but every success path is reported not-verified |
| **B7** | Confirm the **Sign In with Apple capability** on `com.driftstop.app` and that the regenerated provisioning profile is the one EAS will use | Apple Developer session | The iOS build compiles but Apple sign-in fails at runtime |
| **B8** | Uploading any artifact to Play Console / App Store Connect | Credentials + a browser file upload larger than the tooling allows | Nothing ships |

---

## 11. Definition of done

Automated gates (from `OPERATIONS.md` §4):

- `npx tsc --noEmit` clean.
- `npx jest` green — the current baseline is **232 tests in 25 suites**; the locale parity suite must pass
  with the new keys included, not excluded.
- `npx expo lint` — only the documented pre-existing errors (`src/i18n/useTranslation.ts`,
  `src/hooks/useAuth.tsx`), **zero new ones**. Do not "fix" the baseline.

Observed gates:

- Every acceptance criterion in §6 signed off by `qa-tester` with a stated result. A criterion reported
  "not verified" leaves the feature **not done**; it does not pass by default.
- `eas env:list` output pasted for all three environments (AC 2).
- The store-build gate (AC 26) actually run, with the build-log line quoted.
- If Q1 = yes: an Apple-created account deleted for real, and its disappearance from Settings → Apple ID →
  Sign in with Apple observed (AC 24).
- Documentation updated in the same change: §9 items 1–7 here, plus the still-valid checklist in v1 §6
  (`OPERATIONS.md` §2 variable reference, §5 function secrets, §10 troubleshooting rows for `DEVELOPER_ERROR`
  and for revocation-fails-while-sign-in-works, and a `WORKLOG.md` entry).

**Not done because it type-checks. Not done because the buttons render.** Done when QA has watched a real
account chooser produce a signed-in DriftStop on an Android emulator **and** an iOS Simulator, and every
failure path behaved as specified above.
