# Spec — Social sign-in (Google + Apple)

Status: **approved — all three blocking questions answered by the owner on 2026-07-25 (see §0). Ready to start.**
Author: project-manager, 2026-07-25.
Related: `.claude/docs/PRODUCT.md` §6, `.claude/docs/OPERATIONS.md` §2/§7, `.claude/docs/TODO.md` #2.

---

## Goal

A DriftStop user who does not want to invent yet another password can create or recover their account in
one tap. On the `/auth` screen they see, in addition to the existing email + password form, a "Continue
with Google" button (Android and iOS) and Apple's native "Sign in with Apple" button (iOS only). Tapping
either opens the OS account sheet, and on success the user lands back where they came from already signed
in — with the same Supabase user id, the same `profiles` row and therefore the same Pro entitlement they
would have had via email. Guests are unaffected: nothing about the free loop, notifications, widget or
history requires an account, and if the provider is not configured the buttons simply do not render.

---

## 0. Owner decisions (answered 2026-07-25)

All three blocking questions are answered. Nothing in this spec is conditional any more.

1. **Scope: both providers, both platforms, one release.** Google + Apple on Android + iOS together. The
   Apple Developer Sign-In-with-Apple capability, `ios.usesAppleSignIn`, the iOS Google OAuth client and iOS
   Simulator QA are all **in scope now**. There is no Android-only fallback path — do not plan for one.
   Apple guideline 4.8 is satisfied by construction, because Google never ships to iOS without Apple.
2. **Sign in with Apple token revocation on deletion: IN SCOPE.** T3 is a committed task, not a conditional
   one. The Apple **Services ID** and **`.p8` signing key** will be produced with the owner at the keyboard.
   Two consequences that must not get lost: the Services ID must be listed **first** in Supabase's Apple
   *Client IDs* field (native `signInWithIdToken` accepts any id in the list, but the web flow uses the
   first — see §1.6 row 8), and the `.p8`-derived client secret **must be rotated every 6 months** or Apple
   sign-in and revocation both start failing. T9 records that rotation chore durably in `OPERATIONS.md`.
3. **The three false "syncs across devices" strings: fix them.** `auth.subtitle`,
   `settings.account.guestHint` and `settings.account.deleteAccountConfirmMessage` are rewritten in all 6
   active locales to promise only what exists — an account that keeps your Pro purchase and lets you sign in
   on a new device. `ux-designer` writes the EN/TR source copy in T1; `frontend-dev` lands all 6 locales in
   T4 with the rest of the locale work. Building real cross-device sync remains **out of scope**, and
   `PRODUCT.md` §9 discrepancy #2 / `TODO.md` finding #2 get closed as "copy corrected, sync still not
   built" in T9.

Also decided, for the record: all **6 active locales** (tr, en, es, de, fr, it) ship day one because
`src/i18n/__tests__/locales.test.ts` fails otherwise; ar/ja stay excluded as today. **No new store products,
prices or SKUs** are involved. The **notification rotation is not touched** — it stays on the static 1000
free quotes.

---

## 1. Decisions already made (with the evidence)

### 1.1 Library per provider per platform

Verified against the Expo SDK 56 docs (`https://docs.expo.dev/versions/v56.0.0/sdk/apple-authentication/`,
`https://docs.expo.dev/guides/google-authentication.md`) and the Supabase Auth docs on 2026-07-25. This app
is a bare/CNG build (`android/` and `ios/` exist locally and are gitignored), so native modules are fine;
**none of this works in Expo Go**, which is why every gate below is device/emulator based.

| Provider | Platform | Approach | Supabase call |
|---|---|---|---|
| Apple | iOS | `expo-apple-authentication` — `AppleAuthentication.AppleAuthenticationButton` + `signInAsync({ requestedScopes: [FULL_NAME, EMAIL], nonce })` | `auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken, nonce })` |
| Apple | Android | **Not offered.** Guideline 4.8 is an App Store rule; Android only needs Google. Offering Apple on Android would mean the web OAuth flow (Services ID + `.p8` + 6-month secret rotation) for no user benefit. |
| Google | Android + iOS | `@react-native-google-signin/google-signin` (16.1.2, peer `expo >= 52`) native sheet → `idToken` | `auth.signInWithIdToken({ provider: 'google', token: idToken, nonce })` |

`signInWithIdToken`, **not** the browser redirect flow. Rejected alternatives and why:

- `supabase.auth.signInWithOAuth` + `expo-web-browser` (already a dependency, so it was the cheap option):
  puts a web browser and a Supabase-hosted `ftohdffebzhrthrpeuos.supabase.co` consent URL in front of the
  user, needs the redirect allowlist plus deep-link handling, and reads as phishing next to a native OS
  sheet. Keep it in mind only as an emergency fallback if the native module blocks a build.
- `react-native-nitro-google-signin` (1.0.2): Expo's guide lists it first and it uses Android Credential
  Manager, but it is at 1.0.x and pulls in a second native dependency (`react-native-nitro-modules`). Too
  new for an app already in store review.
- **Known debt, deliberately accepted:** the free tier of `@react-native-google-signin/google-signin` uses
  the legacy Google Sign-In SDK, which Google has deprecated in favour of Android Credential Manager;
  Credential Manager is that library's paid offering. It works today. Log it in `TODO.md` as a follow-up,
  do not let it block this release.

Extra dependencies: `expo-crypto` (SHA-256 for the nonce). Install every package with
`npx expo install <pkg>` so SDK-56-compatible versions are picked — npm `latest` for
`expo-apple-authentication` is `57.0.1`, which is the wrong major for this project (`~56.0.4` is right).

### 1.2 Nonce handling

Supabase's docs: *"Supabase Auth expects the provider to hash it (SHA-256, hexadecimal representation), you
need to provide a hashed version to Google and a non-hashed version to `signInWithIdToken`."* So: generate a
random raw nonce per attempt, pass `sha256hex(raw)` to the provider, pass `raw` to Supabase. This is the
single most likely thing to silently fail with a generic "invalid token" — frontend-dev must confirm it
empirically per provider, not by reading, and if Apple's audience/nonce claim disagrees, say so rather than
reaching for Supabase's `skip_nonce_check`.

### 1.3 Android release-build SHA-1 — yes, required, three of them

Google matches an Android OAuth client on **package name + signing-certificate SHA-1**. A build signed with
a fingerprint that is not registered gets a sign-in failure (typically `DEVELOPER_ERROR`) with no useful
message. Three separate certificates sign DriftStop artifacts, so all three fingerprints must be registered
in the Google Cloud Android OAuth client:

| Build | Certificate | Where the SHA-1 comes from |
|---|---|---|
| Local `npx expo run:android`, dev builds | Expo template debug keystore `android/app/debug.keystore`, alias `androiddebugkey`, password `android` | Already read for this spec: **`5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`** (the standard Android debug key). Regenerate with `keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android` |
| EAS `preview` / `production` artifacts before Play re-signs them | Upload key `credentials/driftstop-upload.keystore`, alias `driftstop` (per `credentials.json`; both gitignored, see OPERATIONS §1) | `keytool -list -v -keystore credentials/driftstop-upload.keystore -alias driftstop` — needs `keystorePassword` from `credentials.json`, which is on the owner's machine. Also available in Play Console → Test and release → Setup → **App integrity → Upload key certificate** |
| What testers actually install from Play (Play App Signing re-signs the AAB) | Google's app signing key | Play Console → Test and release → Setup → **App integrity → App signing key certificate**. **This is the one that decides whether Google sign-in works for a real closed-testing tester** — the upload key alone is not enough |

Use the JBR JDK for `keytool`: `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`.

### 1.4 Identity linking — what happens to an existing email+password account

Supabase Auth automatically links a new OAuth identity to an existing user **when the email matches and is
verified**, and *"when a new identity can be linked to an existing user, Supabase Auth will remove any other
unconfirmed identities linked to an existing user"* (Supabase → Auth → Identity Linking). Decided behaviour:

| Case | Outcome | Decision |
|---|---|---|
| Confirmed email+password account, later signs in with Google on the same address | Same `auth.users.id`. Google identity linked. Same `profiles` row → same `is_premium`; same RevenueCat `app_user_id` because `Purchases.logIn(user.id)` gets the same UUID → **Pro is preserved**. Password still works. | **Desired. Rely on Supabase's default; write no linking code.** Must be QA-verified (AC 9), not assumed. |
| Signed up with email+password but **never confirmed**, then signs in with Google on the same address | Supabase drops the unconfirmed identity. The user becomes a Google-only user on that email; the old password stops working. | **Accept** — it is Supabase's anti-pre-account-takeover behaviour and we will not fight it. Mitigate with copy only. QA must observe it (AC 10) so we know the shape of the support question. |
| Apple sign-in with **Hide My Email** | Apple returns an `@privaterelay.appleid.com` address, which never matches their real email → a **separate** Supabase user with separate entitlement. | **Accept and document.** Unavoidable with any provider-side relay. UX copy should not promise "we'll find your existing account". |
| Anything else | — | **No `linkIdentity()` / `unlinkIdentity()` UI in this release.** Out of scope. |

Email confirmation: OAuth sign-ups bypass it entirely and arrive pre-verified. Supabase's "Confirm email"
setting stays **ON** for email+password (turning it off is a separate product decision and would invalidate
the mailinator QA procedure in OPERATIONS §9). Consequence to verify: a social sign-in must never show the
`auth.signUpSuccess` "check your inbox" notice (AC 6).

### 1.5 Account deletion for OAuth users

`supabase/functions/delete-account/index.ts` verifies the caller's own JWT and then calls
`auth.admin.deleteUser(user.id)`; `profiles` / `favorites` / `reflections` / `user_settings` cascade off
`auth.users`. That is **provider-agnostic — no code change is needed for the Supabase side** of Google/Apple
users, and the existing function must keep working unchanged.

What Supabase does *not* do is tell Apple. Per owner decision 2, **Apple token revocation is in scope**:
deleting an account that has an `apple` identity must also call
`POST https://appleid.apple.com/auth/revoke` with a client secret JWT signed by the `.p8` key, so the user
genuinely disappears from "Sign in with Apple" in their Apple ID settings. That is T3. Deletion of a
Google-created **and** an Apple-created account must be observed end to end (AC 11, AC 19), including that a
subsequent sign-in with the same provider produces a **new** user id rather than resurrecting the old row.

### 1.6 Configuration values — who produces each one

Owner has offered to leave authenticated console sessions open; treat creation as *available with their help*,
not blocked. "Agent, with owner at the keyboard" = an agent drives the on-screen steps but the owner must be
signed in and must click anything that creates a credential or grants a permission.

| # | Value / action | Where | Produced by |
|---|---|---|---|
| 1 | OAuth client, type **Web application** → **Client ID** + **Client secret** | Google Cloud project `extreme-lattice-470518-d8` → Google Auth Platform → Clients | Owner (agent-driven). The Client ID is the audience Supabase validates and the `webClientId` the library needs |
| 2 | OAuth client, type **iOS**, bundle id `com.driftstop.app` → **iOS client ID** (+ its reversed form for the URL scheme) | same | Owner (agent-driven) |
| 3 | OAuth client, type **Android**, package `com.driftstop.app`, **all three SHA-1s from §1.3** | same | Owner (agent-driven). No client id is consumed by the app; the client just has to exist and list the fingerprints |
| 4 | Data Access scopes: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` | Google Auth Platform → Data Access | Owner (agent-driven). Nothing sensitive/restricted → no Google verification review |
| 5 | Publishing status set to **In production** | Google Auth Platform → Audience | **Owner action.** While it is "Testing", only explicitly listed test users can sign in (100 cap) — this will look like a code bug to QA if missed |
| 6 | Google provider **enabled**; **Client IDs** = web client id **first**, then the iOS client id, comma-separated; **Client Secret** = the web client's secret | Supabase dashboard → Authentication → Providers → Google (project `ftohdffebzhrthrpeuos`) | Owner (agent-driven). Web-first ordering is Supabase's documented requirement |
| 7 | **Sign In with Apple** capability enabled on App ID `com.driftstop.app` | Apple Developer → Certificates, Identifiers & Profiles → Identifiers | **Owner action** (paid membership required; they have one). Leave server-to-server notification endpoints blank — Supabase does not support them |
| 7b | **Services ID** (e.g. `com.driftstop.app.web`), Website URLs → domain `ftohdffebzhrthrpeuos.supabase.co`, return URL `https://ftohdffebzhrthrpeuos.supabase.co/auth/v1/callback` | Apple Developer → Identifiers | **Owner action.** Required because token revocation (decision 2) is in scope |
| 7c | **Signing key `.p8`** (`AuthKey_XXXXXXXXXX.p8`), used to generate the Apple client secret | Apple Developer → Keys | **Owner action.** Store the `.p8` off-machine; if it leaks, revoke it in the Apple console immediately. ⚠️ The derived secret **expires and must be rotated every 6 months** — T9 records this in `OPERATIONS.md` |
| 8 | Apple provider **enabled**; **Client IDs** = the **Services ID first**, then `com.driftstop.app`; **Secret Key** = the secret generated from the `.p8` | Supabase dashboard → Authentication → Providers → Apple | Owner (agent-driven). Native `signInWithIdToken` accepts any client id in the list as a valid audience, but the web/REST side uses the **first** one — so Services-ID-first is required or revocation breaks while native sign-in keeps working (a silent half-failure) |
| 9 | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` in `.env` | repo root | Agent, once values 1–2 exist |
| 10 | Same two vars registered in **EAS cloud env** for `production`, `preview` **and** `development` | `npx eas env:create --environment <env> --name … --value … --visibility plaintext --scope project` | Agent, **if** `npx eas whoami` already reports `evolaroa.app`; `eas login` is an owner action |
| 11 | Reversed iOS client id written literally into `app.json` (`iosUrlScheme` for the Google plugin) | `app.json` | Agent. It is a public identifier that ships in the binary regardless — but note the duplication risk in §7 |
| 12 | A Google account added to the Android emulator (`Medium_Phone_API_36.1`, image `google_apis_playstore`, Play Services present) | emulator Settings → Passwords & accounts | **Owner action** — needs a real Google password. Without it QA can reach the sheet but cannot complete a success path |
| 13 | An Apple ID signed into the iOS Simulator | Simulator Settings → Sign in to your iPhone | **Owner action** — needs a real Apple ID password |

### 1.7 Design delivered by T1 (ux-designer, complete 2026-07-25)

T1 (#16) is closed. The three corrected sync strings shipped in commit `3e89b75` across all six active
locales — verified: `auth.subtitle`, `settings.account.guestHint` and
`settings.account.deleteAccountConfirmMessage` in `tr/en/es/de/fr/it`, 60/60 tests green, parity unaffected
(ar/ja carry no `auth` or `settings.account` objects). `frontend-dev` implements the rest of T1's design as
described here; this section is the single source for T4.

**New components** (all in `src/components/`, following the house rules: `StyleSheet.create` at file bottom,
colours from `useTheme()`, spacing from `@/constants/layout`, accessibility props on every touchable):

| Component | Responsibility | Hard constraints |
|---|---|---|
| `GoogleGlyph` | The Google "G" mark as `react-native-svg` paths | Google's four brand colours, fixed proportions. **Never apply `opacity` to it** — not on press, not on disabled, not on loading. Google's branding rules forbid altering the mark, and a faded G is the most likely way this ships non-compliant. Dim the surrounding button surface and label instead |
| `GoogleSignInButton` | Google's button per their branding guidelines: glyph + label, correct minimum height and padding | Label comes from i18n, never hardcoded. Press/disabled/loading states affect the container and text only (see the glyph rule above) |
| `AppleSignInButton` | Thin wrapper over `expo-apple-authentication`'s `AppleAuthenticationButton` | Renders `null` unless `appleAuthAvailable`. Only `buttonType`, `buttonStyle` and `cornerRadius` may be set — **no `backgroundColor`, no `borderRadius`**, and `height`/`width` must be supplied via `style` or the native button does not appear at all. `buttonType` = `CONTINUE` |
| `SketchDivider` | The "or" separator between the social buttons and the email form, in the hand-drawn vocabulary | Deterministic geometry via `src/utils/sketch.ts` (`wavyLinePath`) — no randomness, so it does not jitter on re-render. Label from i18n |

**`/auth` structural changes.** The screen currently renders a `KeyboardAvoidingView` wrapping a single
`View` with `justifyContent: 'center'` and **no `ScrollView`** (`src/app/auth.tsx:57-68`, styles at `:171`).
ux-designer identified this as the mechanism by which AC 13 fails: adding two buttons plus a divider to a
fixed-height centred column overflows in German at large system font scale, and the submit button becomes
unreachable. T4 must introduce a `ScrollView` inside the `KeyboardAvoidingView` with
`contentContainerStyle` carrying the existing padding and gap, replacing `justifyContent: 'center'` with
`flexGrow: 1` + centring so short content still centres while long content scrolls. This is a required part
of the work, not an optional polish item — AC 13 tests it directly.

**State table.** Every row is observable and several map to acceptance criteria:

| State | Google button | Apple button | Rest of screen |
|---|---|---|---|
| Idle | Full colour, enabled | Native idle | Email form enabled |
| Pressed | Container darkens; **glyph unchanged** | Native press handling (do not intercept) | — |
| In flight | Container dimmed, label → loading text, disabled; **glyph unchanged** | Disabled | Email submit disabled, other provider disabled — only one auth attempt at a time |
| Provider unavailable (`googleAuthAvailable` / `appleAuthAvailable` false) | Not rendered at all | Not rendered at all | Divider also hidden when **no** social button renders, so there is no orphan "or" and no empty gap (AC 8) |
| **User cancelled** | Returns to idle. **Completely silent** — no error text, no toast, no notice line, no layout shift | Same (`ERR_REQUEST_CANCELED` must never reach the user) | Unchanged (AC 5, AC 16) |
| Provider/network error | Returns to idle | Returns to idle | One localized line in the existing error slot, styled like the current email errors (AC 7) |

**i18n keys — supplied by ux-designer, transcribed verbatim by the orchestrator 2026-07-25.** These are
ux-designer's own strings, not invented. `frontend-dev` adds all eight keys to all six active locale files
(tr/en/es/de/fr/it) exactly as written; `ar.json`/`ja.json` have no `auth` object and are left alone. The
parity test compares against `tr`, so `tr` is the structural source of truth.

| Key | en | tr |
|---|---|---|
| `auth.social.googleButton` | Continue with Google | Google ile devam et |
| `auth.social.appleButton` | Continue with Apple | Apple ile devam et |
| `auth.social.orEmail` | or use email | ya da e-posta ile |
| `auth.social.connecting` | Signing you in… | Giriş yapılıyor… |
| `auth.social.emailMatchHint` | Signing in with the same email address keeps you in the same account. | Aynı e-posta adresiyle giriş yaparsan aynı hesapta kalırsın. |
| `auth.social.appleRelayHint` | If you hide your email, Apple gives us a different address — that creates a separate account. | E-postanı gizlersen Apple bize farklı bir adres verir; bu ayrı bir hesap oluşturur. |
| `auth.errors.socialFailed` | Couldn't finish signing in. Please try again. | Giriş tamamlanamadı. Tekrar dene. |
| `auth.errors.playServices` | Google Play services needs an update on this device. | Bu cihazdaki Google Play Hizmetleri güncellenmeli. |

| Key | es | de | fr | it |
|---|---|---|---|---|
| `auth.social.googleButton` | Continuar con Google | Weiter mit Google | Continuer avec Google | Continua con Google |
| `auth.social.appleButton` | Continuar con Apple | Weiter mit Apple | Continuer avec Apple | Continua con Apple |
| `auth.social.orEmail` | o con tu correo | oder mit E-Mail | ou par e-mail | o con l'email |
| `auth.social.connecting` | Iniciando sesión… | Anmeldung läuft… | Connexion en cours… | Accesso in corso… |
| `auth.social.emailMatchHint` | Si inicias sesión con la misma dirección de correo, sigues en la misma cuenta. | Mit derselben E-Mail-Adresse bleibst du im selben Konto. | En te connectant avec la même adresse e-mail, tu restes dans le même compte. | Accedendo con lo stesso indirizzo email resti nello stesso account. |
| `auth.social.appleRelayHint` | Si ocultas tu correo, Apple nos da otra dirección y se crea una cuenta aparte. | Wenn du deine E-Mail verbirgst, erhalten wir von Apple eine andere Adresse — das erzeugt ein separates Konto. | Si tu masques ton e-mail, Apple nous transmet une autre adresse : cela crée un compte distinct. | Se nascondi la tua email, Apple ci fornisce un altro indirizzo e viene creato un account separato. |
| `auth.errors.socialFailed` | No se pudo completar el inicio de sesión. Inténtalo de nuevo. | Anmeldung konnte nicht abgeschlossen werden. Bitte erneut versuchen. | Impossible de terminer la connexion. Réessaie. | Non è stato possibile completare l'accesso. Riprova. |
| `auth.errors.playServices` | Los servicios de Google Play necesitan actualizarse en este dispositivo. | Die Google Play-Dienste müssen auf diesem Gerät aktualisiert werden. | Les services Google Play doivent être mis à jour sur cet appareil. | I servizi Google Play devono essere aggiornati su questo dispositivo. |

Constraints that come with these strings:
- `orEmail` is ≤ 18 characters in all six so the divider stays on one line and the flex rules never collapse.
- `connecting` replaces the Google button label in place, so it must stay ≤ ~22 characters — the longest is `fr` at 20.
- The two social error keys live under `auth.errors.*` so `mapAuthError` keeps its existing "returns an i18n
  key" contract. `auth.errors.network` and `auth.errors.notConfigured` are **reused, not duplicated**.
- **There is no key for the cancelled case, by design** — cancelling renders nothing at all.

**`frontend-dev`: do not invent or "improve" any of these strings.** Fabricated es/de/fr/it copy passes the
parity test (it only checks structure and non-emptiness) and would ship as if professionally translated.

**Known-failing contrast, inherited deliberately — tracked as task #25, not a QA miss.** ux-designer measured
two existing palette entries below WCAG AA 4.5:1: `DarkColors.fire` at **3.77:1** and
`LightColors.textMuted` at **4.14:1**. Both are app-wide, and the new social error line (`fire`) and the new
hint line (`textMuted`) inherit them. Fixing them is a global palette change requiring visual QA on every
screen, so it is **explicitly out of scope here** and tracked separately as **#25**. QA should not raise the
new lines as a contrast defect, and **T9 must not close #25 or let it disappear** — it survives this feature.

---

## 2. Scope

- Add `expo-apple-authentication`, `@react-native-google-signin/google-signin`, `expo-crypto` and their
  `app.json` config (`ios.usesAppleSignIn: true`, `expo-apple-authentication` plugin, the Google plugin with
  `iosUrlScheme`). Keep `./plugins/withGradleVersion` in place — Gradle stays pinned to 8.13.
- Extend `useAuth` with `signInWithGoogle()` and `signInWithApple()` returning the existing
  `{ error: string | null }` shape and the existing i18n error-key convention (`mapAuthError` gains cases for
  user-cancelled, provider-not-configured, no Play Services, network).
- Expose `googleAuthAvailable` / `appleAuthAvailable` booleans following the established `configured` pattern
  (`supabase.ts:12`, `purchases.ts:15`): Google requires a Supabase client **and** a web client id; Apple
  requires `Platform.OS === 'ios'` **and** `AppleAuthentication.isAvailableAsync()`. False ⇒ the button is
  not rendered at all, no error, no dead button.
- Render both buttons on `/auth`, and in Settings → Account's guest state if ux-designer decides they belong
  there.
- The four new components, the `/auth` `ScrollView` restructure and the state table from §1.7.
- New i18n keys in all 6 active locale files (tr/en/es/de/fr/it), plus the ar/ja files left as they are —
  **using ux-designer's supplied strings, which must be in §1.7 before T4 starts.**
- Console + Supabase + EAS configuration per §1.6, including the Apple Services ID and `.p8` signing key.
- **Truthful rewrite of the three sync strings** in all 6 locales: `auth.subtitle`,
  `settings.account.guestHint`, `settings.account.deleteAccountConfirmMessage` (owner decision 3).
- **Apple token revocation** on account deletion — new edge function, plus the Supabase Apple provider
  configured Services-ID-first with a `.p8`-derived secret (owner decision 2).
- A guard that fails loudly when `app.json`'s `iosUrlScheme` and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` diverge
  (see the duplication risk in §5).

### Out of scope

- Cross-device sync of favorites/settings/history (Phase 5). Only the *copy* about it is touched.
- Password reset / "forgot password".
- `linkIdentity()` / `unlinkIdentity()` UI, or any in-app account-merge flow.
- Facebook, X, or any third provider.
- Showing the user's Google/Apple display name or avatar anywhere. Settings → Account keeps showing the email.
  (Apple's identity token carries no full name, and the name arrives only on first sign-in; capturing it via
  `updateUser` is a follow-up, not this release.)
- Android Credential Manager migration.
- **Fixing `DarkColors.fire` (3.77:1) and `LightColors.textMuted` (4.14:1)** to WCAG AA. App-wide palette
  change, needs visual QA on every screen. Tracked as **#25**; the new error and hint lines knowingly inherit
  the failing contrast (§1.7).
- An iOS widget, iOS AdMob ids, `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`, or the App Store Connect app record —
  all still open (TODO #1, #9) and all unrelated to auth.
- Uploading anything to Play Console or App Store Connect.

---

## 3. Acceptance criteria

QA verifies each on a real emulator/simulator and reports observed vs not-observed per item. "Signed in"
means Settings → Account shows the email address and a "Sign out" row.

**Android emulator (`Medium_Phone_API_36.1`, dev build via `npx expo run:android`)**

1. Fresh install → onboarding → Settings → Account (guest) shows the existing "Sign in / Create account"
   entry. Tapping it opens `/auth`, which now shows a "Continue with Google" button in addition to the email
   and password fields. **No Apple button appears anywhere on Android.**
2. Tapping "Continue with Google" opens the Google account-chooser sheet (a native dialog — get its tap
   coordinates from `adb shell uiautomator dump`, not from a screenshot). Choosing an account dismisses the
   sheet, `/auth` closes, and Settings → Account shows that Google account's email address.
3. Force-quit and relaunch: still signed in, no re-auth prompt, and the app reaches Home without a visible
   extra delay at boot.
4. Sign out from Settings → Account → confirm dialog → the section returns to the guest state and the
   guest hint. Signing in with Google again returns the same email.
5. **Cancel path:** tap "Continue with Google", then dismiss the sheet with Back / tapping outside. The app
   returns to `/auth` with **no error message**, no spinner stuck on, and the button tappable again.
6. A Google sign-in never shows the "check your email" notice, and never leaves the user on `/auth` in a
   half-signed-in state.
7. **No-network path:** enable airplane mode, tap "Continue with Google". A single localized human-readable
   error appears on `/auth` (no raw SDK text, no stack trace, no silent nothing), and the app does not crash.
   Disable airplane mode, retry, sign-in succeeds.
8. **Not-configured path:** relaunch with `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` removed from the environment.
   `/auth` renders the email form with **no Google button and no empty gap**; email sign-in still works.
   (This is the `purchasesConfigured` pattern and the thing that has silently no-opped in three shipped
   builds — verify it explicitly.)
9. **Linking, confirmed account:** sign in with the email+password QA account
   (`driftstop.qa.test1@mailinator.com` per OPERATIONS §9), note the email shown; sign out; sign in with
   Google using **the same address**. Settings → Account shows the same email, and — with a RevenueCat grant
   active on that account — the Pro/entitlement state shown in Settings is the same before and after. Sign
   out and sign in with the password again: it still works.
10. **Linking, unconfirmed account:** create a brand-new email+password account and do **not** confirm it,
    then sign in with Google on that same address. Record what happens (expected: Google sign-in succeeds and
    the password no longer works). Report the observed behaviour verbatim — this criterion is about knowing
    the truth, not about a specific outcome.
11. **Deletion:** as a Google-signed-in user, Settings → Account → Delete account → confirm. The user is
    signed out, the Account section returns to the guest state, and the Supabase `auth.users` row is gone
    (confirm from the Supabase dashboard). Signing in with the same Google account afterwards creates a
    **new** user id.
12. **No regression in the core loop:** notifications still fire and still land in history; the Android
    home-screen widget still appears in the widget picker and still renders the latest quote after the
    prebuild that added the native modules; frequency 7/10 still shows the lock badge for a non-Pro user;
    the Home banner ad still renders for a free user.
13. `/auth` and the new buttons render correctly in all 6 UI languages — no clipped labels, no `[missing …]`
    placeholder text — and in both light and dark theme.

**iOS Simulator (`npx expo run:ios`) — in scope for this release**

14. `/auth` shows Apple's native `AppleAuthenticationButton` **and** the Google button. The Apple button uses
    one of Apple's three approved button texts (the design specifies
    `AppleAuthenticationButtonType.CONTINUE` → "Continue with Apple", which stays truthful in sign-up mode and
    mirrors "Continue with Google"), is **unrestyled apart from `buttonStyle` and `cornerRadius`**, renders
    full-width, and is at least as visually prominent as the Google button.
    **Do not fail this criterion because the label is not the literal words "Sign in with Apple"** — any of
    Apple's approved types passes; what fails is a restyled or custom-drawn Apple button, a `backgroundColor`
    or `borderRadius` override, or an Apple button less prominent than Google's.
15. Tapping the Apple button presents the system Apple sign-in sheet; completing it returns to the app
    signed in, with Settings → Account showing the Apple-provided (or private-relay) email address.
16. **Apple cancel path:** dismiss the Apple sheet → back on `/auth`, no error shown, button tappable again
    (the library reports `ERR_REQUEST_CANCELED`; the user must not see it).
17. Google sign-in on iOS behaves as criteria 2, 5, 7 do on Android.
18. Sign out, sign back in with Apple: the same user, same email.
19. Delete account as an Apple-created user: the same outcome as criterion 11, **and** the app no longer
    appears under iOS Settings → Apple ID → Sign in with Apple for that Apple ID (this is what proves the
    revocation call in T3 actually ran, and it is only observable here — not from Supabase).
20. On a hypothetical Apple-unsupported OS version, `appleAuthAvailable` is false and the button is absent
    rather than present-and-broken — verify at minimum that the code path is exercised by rendering with
    `isAvailableAsync()` forced false.

**Store-build gate (not an emulator check, but part of done)**

21. An EAS `preview`-profile APK is built and its build log contains the
    `Environment variables with visibility "Plain text" … loaded from the "preview" environment on EAS:`
    line **listing both new `EXPO_PUBLIC_GOOGLE_*` vars**. Installed on a real device, "Continue with
    Google" completes a sign-in there. Without this, per OPERATIONS §2, we have not verified anything about
    the shipped binary — only about the dev server.

---

## 4. Work split

| Agent | Task | Depends on |
|---|---|---|
Task board ids in brackets. **T1 is the only task that can start before the owner opens their consoles** —
it is pure design and copy. T2 needs Google Cloud + Apple Developer + Supabase sessions; everything else is
downstream of T1/T2.

| Agent | Task | Depends on |
|---|---|---|
| `ux-designer` | **T1** (#16) Button placement, treatment, new copy **and** the three corrected sync strings | — |
| `backend-dev` | **T2** (#17) Google Cloud + Apple Developer (incl. Services ID + `.p8`) + Supabase providers, `.env` + EAS env registration | needs owner's console sessions |
| `backend-dev` | **T3** (#18) Apple token-revocation edge function — **committed, not conditional** | T2 |
| `frontend-dev` | **T4** (#19) Dependencies, `app.json` config, `useAuth` extension, `/auth` UI, 6 locales, iOS-client-id divergence guard | T1, T2 |
| `qa-tester` | **T5** (#20) Android emulator verification (AC 1–13) | T4 |
| `qa-tester` | **T6** (#21) iOS Simulator verification (AC 14–20) | T4 |
| `backend-dev` | **T7** (#22) Verify `delete-account` + Apple revocation end-to-end (AC 11, 19) | T3, T4 |
| `release-manager` | **T8** (#23) EAS `preview` build + on-device store-build gate (AC 21) | T5 |
| `project-manager` | **T9** (#24) Triage QA failures, correct criteria if they were wrong, hand fix lists back, re-run until every criterion passes; then the doc-update checklist in §6 | T5, T6, T7, T8 |

### What each task must produce

**T1 — ux-designer.** Owns placement and copy; frontend-dev implements what T1 decides. Needs to resolve one
genuine conflict: Apple's `AppleAuthenticationButton` is a native `ASAuthorizationAppleIDButton` whose
`backgroundColor` and `borderRadius` **cannot** be restyled (doing so violates App Store guidelines), and
Google's branding rules similarly constrain their button — so two vendor-styled buttons must sit next to the
hand-drawn `Sketch*`/`Wobbly*` vocabulary without looking like a mistake. Deliver:
(a) where the buttons go on `/auth` (above or below the email form) and their order;
(b) whether Settings → Account's guest state gets buttons or keeps only the existing link;
(c) the visual treatment reconciling vendor buttons with the sketch aesthetic (only `buttonStyle` +
`cornerRadius` are available on the Apple button; state which);
(d) exact new i18n key names with EN and TR source strings — divider ("or"), Google button label, generic
social-error line, and any hint about Hide My Email creating a separate account;
(e) the replacement EN/TR text for `auth.subtitle`, `settings.account.guestHint` and
`settings.account.deleteAccountConfirmMessage` that promises only what exists — no "syncs across devices",
no "reflections" (that table has no client code at all). Owner decision 3 confirmed this; it is not optional;
(f) accessibility labels for both buttons (project convention: every touchable gets
`accessibilityLabel` + `accessibilityRole` + `hitSlop`).

**T2 — backend-dev.** Execute §1.6 rows 1–11 in order, with the owner at the keyboard for rows 1–3, 5, 7.
Read the three SHA-1s per §1.3 (including asking the owner for the Play Console App-integrity page, which
only they can open) and register **all three** in the Android OAuth client. Finish by pasting the actual
output of `npx eas env:list --environment production`, `--preview` and `--development` showing both new vars
— that observed output is the deliverable, not a claim that it was done.

**T3 — backend-dev.** Committed work, per owner decision 2. Revoke the Apple token **before**
`auth.admin.deleteUser` (after the delete you can no longer read the user's identities): read the caller's
identities, and if one has `provider === 'apple'`, build a client-secret JWT signed ES256 with the `.p8` key
(`iss` = Apple Team ID, `sub` = the Services ID, `aud` = `https://appleid.apple.com`) and
`POST https://appleid.apple.com/auth/revoke`. Store `APPLE_TEAM_ID`, `APPLE_SERVICES_ID`, `APPLE_KEY_ID` and
the `.p8` contents as Supabase function secrets (`supabase secrets set`) — never in `EXPO_PUBLIC_*`, never in
git. Decide and state whether this extends `delete-account` or lands as a sibling function; if it extends
`delete-account`, a revocation failure must **not** block the Supabase deletion (the user asked to be
deleted) but must be logged and reported. Deploy **with** JWT verification — `delete-account` must never get
`--no-verify-jwt`. `supabase/functions/**` is excluded from `tsc` (`tsconfig.json:22`) and has no tests, so
verification is a live `curl` plus an observed real deletion; deploy in the **foreground** and confirm with
`supabase functions list` (OPERATIONS §5: a backgrounded deploy once reported success and deployed nothing).
Also flag the 6-month secret rotation to T9 so it lands in `OPERATIONS.md`.

**T4 — frontend-dev.** `npx expo install` the three packages (never plain `npm i` — see §1.1 version trap).
`app.json`: `ios.usesAppleSignIn: true`, add the `expo-apple-authentication` plugin, add the Google plugin
with `iosUrlScheme`. Extend `useAuth` with the two methods plus the two availability booleans, keeping the
existing `{ error: i18nKey }` contract and the Turkish "why" comments the codebase uses. Nonce per §1.2.
Cancellation is **not** an error (mirror `usePurchases.purchasePackage`'s `userCancelled` handling at
`usePurchases.tsx:122`). Implement T1's design on `/auth`. Add every new key **and T1's three corrected sync
strings** to all 6 active locale files. Add the iOS-client-id divergence guard required by §5 (see that row
for what counts). After adding native modules you **must** kill and re-run `npx expo run:android` /
`run:ios` for a fresh prebuild — JS reload will not link them (OPERATIONS §3).

**T5 / T6 — qa-tester.** Work through the numbered criteria and report each as observed-pass,
observed-fail (with what you saw) or not-verified (with why). Use `adb shell uiautomator dump` for native
dialog coordinates and `sleep 1` between focus-tap and typing. Emulator prerequisites are AC-blocking owner
actions: a Google account on the AVD (§1.6 row 12) and an Apple ID in the Simulator (row 13). If those are
missing, the cancel/no-network/not-configured criteria are still fully testable — do those and report the
success paths as not-verified rather than assuming them.

**Do not assume the emulator cannot do Google.** The AVD in use (`Medium_Phone_API_36.1`, path
`~/.android/avd/Medium_Phone.avd`) runs the `google_apis_playstore` system image with
`PlayStore.enabled=true`, so Google Play Services **are** present and Google sign-in is fully testable there.
The `BILLING_UNAVAILABLE` limitation documented in OPERATIONS §3 applies to Play **Billing** only, not to
Play Services in general. A "can't test Google on the emulator" report will be sent back.

---

## 5. Risks

| Risk | Why it is plausible here | Mitigation / which AC covers it |
|---|---|---|
| **The feature silently no-ops in the store build** | Exactly the v7/8/9 failure: `.env` never reaches EAS builders, and our own `configured` pattern means a missing client id produces *no error at all* — just an absent button | §1.6 rows 9–10, AC 8 (absent-by-design) and AC 21 (present in a real EAS build log + working on a device) |
| **`DEVELOPER_ERROR` for real Play testers only** | Only the Play **app signing** SHA-1 governs store installs; registering just the debug/upload fingerprints makes it work everywhere except where it matters | §1.3 all three fingerprints; AC 21 on a real device |
| **Notification scheduler regression** | `applySchedule` is untested (TODO #10) and any `_layout.tsx` / provider-order churn is a silent break — the user just stops getting notifications | AC 12. Do not reorder providers; `AuthProvider` must stay above `PurchasesProvider` (`usePurchases` consumes `useAuth`) |
| **Android widget stops registering** | New native modules force a prebuild; `index.js` registers the widget task handler before the router and this has broken before | AC 12 (widget still in the picker and rendering) |
| **Entitlement/RevenueCat identity churn** | Signing in fires `Purchases.logIn(user.id)`. Social sign-in makes "guest bought Pro, then signs in" far more common than it was with email — RevenueCat may alias or transfer the anonymous purchaser | AC 9. If entitlement is lost across sign-in, that is a fix-now bug, not a RevenueCat quirk to accept |
| **Guest experience degraded** | Guest-first is a core product property; a modal, a nag, or a crash-on-boot from a new native module would break it | AC 1, 3, 8, 12 |
| **6-locale parity test fails** | `src/i18n/__tests__/locales.test.ts` asserts identical flattened key structure against `tr` for all 6 active locales and rejects empty strings | `npx jest` in Definition of done; AC 13 |
| **Nonce mismatch** | Hashed-vs-raw is easy to get backwards and surfaces as a generic invalid-token error | §1.2; AC 2 and 15 are the only proof |
| **Google OAuth app left in "Testing"** | Only listed test users can sign in; looks identical to a code bug | §1.6 row 5 |
| **Unconfirmed-account users lose their password** | Supabase deletes unconfirmed identities on link | AC 10 documents it; copy mitigates it |
| **One iOS Google client id, two places, no link between them** | `app.json` is static JSON and cannot read env vars, so the **reversed** iOS client id is hardcoded as the Google plugin's `iosUrlScheme` while the **same** client id also lives in `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`. If either is edited alone, Google sign-in on iOS breaks with an unhelpful error — or worse, the callback URL never fires and it just hangs. This is this project's characteristic failure mode (three Play builds shipped with silently-wrong config) | **`frontend-dev` must add a guard that fails loudly when the two diverge**, not a comment asking people to be careful. Either (a) a Jest test that reads `app.json` and `process.env`/`.env.example`, reverses the client id and asserts it equals `iosUrlScheme`, or (b) a dev-only runtime assertion in the Google init path that throws in `__DEV__` on mismatch. A test is preferred because it runs in CI. Converting `app.json` → `app.config.js` would remove the duplication entirely and is acceptable if frontend-dev judges the native-config churn safe on a shipping app — but doing nothing is not |
| **Apple secret expiry (silent, ~6 months out)** | The `.p8`-derived client secret Supabase holds for the Apple provider expires; when it does, Apple sign-in and token revocation both start failing on an app nobody is actively working on | §1.6 row 7c; T9 must write the rotation date and procedure into `OPERATIONS.md` where release work will trip over it |
| **Services-ID ordering half-failure** | If `com.driftstop.app` is listed before the Services ID in Supabase's Apple *Client IDs*, native sign-in keeps working and only revocation breaks — so QA on the happy path would show green | §1.6 row 8; AC 19 is the only criterion that catches it |
| **versionCode collision with the in-review v11** | `production` profile has `autoIncrement`, so the next build is 12 while 11 is still under Google review | release-manager (T8) uses the `preview` profile for the gate; no production build until v11's review resolves |
| **New lint errors land unnoticed** | CI runs `expo lint \|\| true`; baseline is 11 known false positives | Definition of done requires reading lint output and adding zero new errors |

---

## 6. Definition of done

Automated gates, from OPERATIONS §4:

- `npx tsc --noEmit` clean.
- `npx jest` — the existing 60 tests in 12 suites still pass, plus any new ones. The locale parity suite must
  pass without excluding new keys.
- `npx expo lint` — **exactly the 11 documented pre-existing errors**, zero new ones. Do not "fix" the
  baseline.
- Optional but cheap and historically useful: `npx expo export -p android`.

Observed gates:

- Every acceptance criterion in §3 signed off by `qa-tester` with a stated result. A criterion reported as
  "not verified" leaves the feature not done — it does not pass by default.
- `npx eas env:list` output pasted for all three environments showing both new vars (T2).
- AC 21: EAS `preview` build log line quoted, and a Google sign-in completed on a physical device from that
  APK.
- `delete-account` exercised for real against a Google-created **and** an Apple-created user, with the
  `auth.users` row confirmed gone and the Apple revocation confirmed via AC 19.
- ux-designer's eight i18n keys present in §1.7 and implemented verbatim — **not invented by frontend-dev**
  (§1.7 note; the parity test cannot catch fabricated copy).

### Documentation checklist for T9 (every item is a known defect, do not lose any)

Items 1–5 (with 3b/3c) are the doc contradictions found while writing this spec and during T1 (§7); items
6–12 are new facts this feature creates. **Nothing here may be closed silently** — in particular #25 (item
3c) and finding 6 in §7 survive this feature.

1. **`PRODUCT.md` §6** accounts table: the "Google / Apple sign-in — **No.** Not implemented anywhere" row and
   the capability table above it. Accurate today, wrong on merge.
2. **`PRODUCT.md` §8** "Auth" gaps: the "No Google or Apple social sign-in" bullet and its "deferred in
   backend-roadmap Phase 2 … deliberately not stubbed" rationale; also the Apple-requires-Apple-Sign-In
   sentence that currently says "currently moot".
3. **`PRODUCT.md` §9 discrepancy #2 and `TODO.md` finding #2** (the three false sync strings): close as
   "copy corrected in all 6 locales (commit `3e89b75`); cross-device sync still not built" — do **not** mark
   sync as done.
3b. **`PRODUCT.md` §6 "Sync: claimed but NOT implemented" quotes all three old strings verbatim** (the
   `guestHint` "sync favorites and settings across devices" line, `auth.subtitle`, and
   `deleteAccountConfirmMessage` with its "reflections" mention), as does §9 discrepancy #2. Those quotations
   are now **stale as of `3e89b75`** and will mislead the next reader into "fixing" copy that is already
   fixed. Replace the quotes with the new strings and keep the section's real point: the `favorites`,
   `user_settings` and `reflections` tables still have no client code.
3c. **Task #25 must be carried forward, not closed:** `DarkColors.fire` 3.77:1 and `LightColors.textMuted`
   4.14:1 are below AA 4.5:1 app-wide. Add them to `TODO.md` as an open accessibility finding with the
   measured ratios, and state that the social error/hint lines inherit them by decision.
4. **`ARCHITECTURE.md` §6 env-var list is already stale, independent of this work.** It lists
   `EXPO_PUBLIC_SENTRY_DSN` among the `.env` vars, but the actual `.env` on this machine contains only
   `SUPABASE_PASSWORD`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` and
   `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`. Correct it and add the two new Google vars.
5. **`OPERATIONS.md` §3 AVD note — correct a misleading implication.** The AVD in use
   (`Medium_Phone_API_36.1`, path `~/.android/avd/Medium_Phone.avd`) is `google_apis_playstore` with
   `PlayStore.enabled=true`, so it **does** have Google Play Services and **Google sign-in IS testable on
   this emulator**. Only Play **Billing** is unavailable (`BILLING_UNAVAILABLE`). State this explicitly so no
   future QA pass is told the emulator can't do Google either.
6. **`OPERATIONS.md` §7** iOS release process: rewrite the Apple 4.8 gotcha from "this does not bite" /
   "Google sign-in was deferred for lack of an OAuth client" to what actually shipped.
7. **`OPERATIONS.md` §2** variable reference: add `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and
   `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (both `.env` **and** EAS, all three environments), and record the
   `app.json` `iosUrlScheme` duplication plus whichever guard T4 implemented.
8. **`OPERATIONS.md` §5** edge-function secrets: add `APPLE_TEAM_ID`, `APPLE_SERVICES_ID`, `APPLE_KEY_ID`
   and the `.p8` contents to the secrets list.
9. **`OPERATIONS.md` — new durable entry for the 6-month Apple secret rotation** (owner decision 2): the
   rotation date, where the `.p8` is stored, and the symptom when it lapses. Put it where release work will
   hit it, not only in a table.
10. **`OPERATIONS.md` §10 troubleshooting**: new rows for Google `DEVELOPER_ERROR` → missing/wrong SHA-1
    (name all three certificates from §1.3), Google sign-in failing only for real Play testers → Play **app
    signing** key fingerprint not registered, and Apple revocation failing while native sign-in works →
    Services ID not first in Supabase's Client IDs.
11. **`TODO.md` new follow-ups**: Android Credential Manager migration (the free tier of
    `@react-native-google-signin/google-signin` uses the deprecated legacy GSI SDK), Apple full-name capture
    via `updateUser` on first sign-in, and no `linkIdentity()`/`unlinkIdentity()` UI.
12. **`WORKLOG.md`** appended with who did what, when, and the evidence.

**Not done because it type-checks.** Not done because the buttons render. Done when QA has watched a real
account-chooser sheet produce a signed-in DriftStop on both an Android emulator **and** an iOS Simulator, and
the failure paths behaved as specified.

---

## 7. Findings that contradict or outdate the docs

Raised per the AGENTS.md rule; none are introduced by this spec. **All five are on T9's checklist in §6
(items 1–5, 11 and risk-table rows) so none can be lost.**

1. **`OPERATIONS.md` §7 will become wrong the moment this ships.** It states the Apple 4.8 rule "does not
   bite" because the app is email/password only. That sentence, and the "Google sign-in was deferred for lack
   of an OAuth client" clause, both need rewriting as part of T9.
2. **`PRODUCT.md` §6 and §8 both assert Google/Apple sign-in is "not implemented anywhere"** — accurate today
   (verified: `useAuth.tsx` exposes only `signUpWithEmail`, `signInWithEmail`, `signOut`, `deleteAccount`;
   `auth.tsx` has no social buttons; no `signInWithIdToken` / `signInWithOAuth` anywhere in `src/`), and must
   be updated in the same change.
3. **`ARCHITECTURE.md` §6's env-var list is already incomplete.** It names five `.env` vars
   (`SUPABASE_PASSWORD`, the two Supabase publics, `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`,
   `EXPO_PUBLIC_SENTRY_DSN`); the actual `.env` on this machine has no `EXPO_PUBLIC_SENTRY_DSN` entry. Minor,
   but the doc reads as authoritative. Fold into T9.
4. **`app.json` cannot read env vars, so the reversed iOS Google client id must be hardcoded there** while
   the same client id also lives in `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`. One value, two places, no test
   linking them — precisely the shape of the bug class this project keeps hitting. **Escalated to a required
   work item:** see the corresponding row in §5 — `frontend-dev` must add a CI test (preferred) or a
   `__DEV__` runtime assertion that fails when the two diverge. Converting `app.json` → `app.config.js`
   removes the duplication entirely and is acceptable if frontend-dev judges the native-config churn safe;
   doing nothing is not.
6. **⚠️ The brand-new `deleteAccountConfirmMessage` may already be untrue, in the other direction.** Commit
   `3e89b75` now tells the user "premium pack access will stop" on account deletion. But `isPro` is derived
   client-side from RevenueCat `CustomerInfo` (`usePurchases.tsx:30-35`), not from `profiles`, and
   TODO.md finding **#8** records that premium quote rows already synced into local SQLite are **never
   purged** and that `getQuoteByIdAnySource` / `getPackQuotes` / `getAuthorQuotes` read that cache with **no
   entitlement check**. So after deletion a user may well keep reading previously-synced premium text via
   Favorites and `/quote/[id]`. I have **not** verified this on a device — it is an inference from the code
   and from finding #8. Action: `qa-tester` should observe what actually happens to premium pack access
   immediately after deletion (piggyback on AC 11), and if the copy is wrong, either soften the string or
   treat it as further evidence for fixing #8. Flagging rather than quietly shipping a second false claim in
   the same string we just corrected.
7. **OPERATIONS §3's AVD note can be sharpened.** The AVD in use (`Medium_Phone_API_36.1`, path
   `~/.android/avd/Medium_Phone.avd`) is `google_apis_playstore` with `PlayStore.enabled=true`, so it *does*
   have Play Services and Google sign-in is testable there — unlike Play **Billing**, which genuinely is not.
   Worth stating explicitly so nobody assumes "emulator can't do Google either".
