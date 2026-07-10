# DriftStop — Play Store: remaining steps (things for you to do)

> Historical note: this was written for the first release round. By the time of the versionCode 7 release, the AAB-upload step below had already been completed manually; see [TODO.md](TODO.md) for what's actually still outstanding today.

Everything up to this point has been prepared. The steps below are left for you because they're closed off to automation.

## Why this couldn't be finished automatically (2 hard blockers)
1. **AAB upload** — browser automation for uploading a file to Play Console only accepts files *you've shared in chat*. It can't drag-and-drop the AAB itself. **You have to do this step.**
2. **Google review** — after submission, going live takes anywhere from a few hours to a few days (that part is in Google's hands).
3. Bonus: **disk was almost full** (~90% used, ~1.7GB free). Build caches were cleared; free up some more space yourself too.

## Ready ✅
- **Signed production AAB**: `store-assets/DriftStop-release.aab` (39.6 MB, signature verified, contains real AdMob IDs)
  - Note: built for **arm64-v8a only** to save space (covers almost all modern devices). If you want all architectures, free up disk and rebuild with `cd android && ./gradlew bundleRelease`.
- **AdMob**: app + Banner + Interstitial created, IDs are in app.json + src/constants/adUnits.ts
- **Play Console**: the DriftStop app was created (com.driftstop.app); an **Internal testing → New release** draft was left open
- **Privacy policy**: live → https://mgulcu.me/driftstop/privacy
- **Code**: pushed to github.com/mhmmdglc/drift-stop (main)
- **Keystore + password**: `credentials/KEYSTORE-INFO.txt` ← VERY IMPORTANT, don't lose it/back it up
- **Store graphics**: icon-512.png, 4 screenshots, feature-1024x500.png (the feature graphic is basic; polish it in Canva if you want)
- **Store copy + declaration answers**: `store-assets/STORE-LISTING.md`

## EAS is connected — the CLEANEST path (recommended)
The EAS project is linked: `@evolaroa.app/drift-stop`. No disk headaches, and EAS manages the keystore:
```bash
cd ~/workspace/MyWorkspace/drift-stop
eas build -p android --profile production    # "Generate a new Keystore?" → Yes (EAS stores it, no risk of losing it)
```
~15-20 min in the cloud → an AAB link. Then either:
- `eas submit -p android` (requires setting up a Google Play service account once — Play Console → Developer account → API access), OR
- Download the AAB from EAS → drag-and-drop it into Play Console.

> Note: if EAS generates its own keystore, do the first upload with the EAS AAB too (don't mix it with the local `DriftStop-release.aab` — keep the upload key consistent). The local AAB is just a backup; if you use it, its keystore is `credentials/driftstop-upload.keystore`.

## Your steps (~15-20 min) — manual/local path
1. **Free up disk space** (Settings > General > Storage). At least a few GB.
2. **Upload the AAB**: on the Play Console page for "Create internal testing release" (if it's not open: Test and release → Internal testing → Create new release), **drag-and-drop** `store-assets/DriftStop-release.aab` into the AAB box. Add a release note → Next → Save/Review.
3. **App content** — left menu "Policy status" / "App content":
   - Privacy policy: https://mgulcu.me/driftstop/privacy
   - Ads: **Yes**
   - App access: all functionality is free to use (no login)
   - Content rating questionnaire (no violence/sexual content)
   - Target audience: 13+
   - **Data safety**: "Device or other IDs" (advertising ID, for AdMob) — answers are in store-assets/STORE-LISTING.md
4. **Store listing**: paste the short + full description from store-assets/STORE-LISTING.md; upload icon-512 + at least 2 screenshots + feature-1024x500.
5. Once you've tested it and you're happy, **Production → Create release** (same AAB) → **Submit for review**.

Once Google approves it, it goes live. Good luck 🔥
