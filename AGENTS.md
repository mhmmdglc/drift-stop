# DriftStop — start here

A live Expo/React Native app: in the Google Play Store (closed testing) and preparing for the App Store. Treat it as production.

## Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code. Do not rely on remembered Expo APIs.

## Answer questions from the docs, not by grepping

These are the source of truth. Read the relevant one **before** exploring code, and update it in the same change whenever you make it wrong.

| Doc | Read it for |
|---|---|
| [`.claude/docs/PRODUCT.md`](.claude/docs/PRODUCT.md) | What the app does, every screen/route, the notification loop, content catalog, free-vs-Pro matrix, product gaps |
| [`.claude/docs/ARCHITECTURE.md`](.claude/docs/ARCHITECTURE.md) | Code map, boot sequence, providers/hooks, data flow, backend shape, test coverage |
| [`.claude/docs/OPERATIONS.md`](.claude/docs/OPERATIONS.md) | Accounts, env vars, local dev, quality gates, DB/edge-function ops, release process, gotchas |
| [`.claude/docs/WORKFLOW.md`](.claude/docs/WORKFLOW.md) | The agent pipeline and the rules binding it |
| [`.claude/docs/TODO.md`](.claude/docs/TODO.md) | What is outstanding right now, and who it is blocked on |

If a doc contradicts the code, raise it as a finding. Do not quietly trust one side.

## The three rules this project learned the hard way

1. **⚠️ A new `EXPO_PUBLIC_*` var must be registered in EAS cloud env, not just `.env`.** `.env` is gitignored and never reaches EAS's builders. Three Play Store builds shipped with no Supabase or RevenueCat config at all — nothing crashed, the features just silently did nothing. See the env section of `OPERATIONS.md`.
2. **Compiling is not working.** Type-checks and unit tests have repeatedly passed on features that were broken or invisible on screen. UI and flows are verified by running the app on a simulator/emulator and looking at it.
3. **Say what you did not verify.** Separate observed from assumed in every report. "Not verified" is fine; a false "done" is not.

## Quality gates

```bash
npx tsc --noEmit
```

```bash
npx jest
```

```bash
npx expo lint
```

Lint has known pre-existing errors (React Compiler false positives in `src/i18n/useTranslation.ts` and `src/hooks/useAuth.tsx`) — leave them; add no new ones.

## Conventions

Turkish code comments explaining *why*; `@/` import alias; `StyleSheet.create` at file bottom; colours from `useTheme()` and spacing from `@/constants/layout`, never hardcoded; the hand-drawn `Sketch*`/`Wobbly*` component family is the UI vocabulary; accessibility props on every interactive element; new strings go into all six locale files or the parity test fails.
