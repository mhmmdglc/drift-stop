# Google Play Store App Publishing Guide

> The **reusable playbook** we worked out while publishing DriftStop.
> Follow this same order for the next app. Play Console's UI is assumed to be in **Turkish** (as configured on this account) — button/menu labels below are quoted verbatim in Turkish so you can match them on screen; an English gloss follows each one in parentheses.

---

## 0) The big picture — flow

```
Prepare a signed AAB
   ↓
Create the app in Play Console
   ↓
Upload an internal-testing release (app is live for testers right away)
   ↓
App content declarations (9-10 forms)
   ↓
Store listing (description + 6 graphics)
   ↓
Store settings (category + contact)   ← brings the dashboard checklist to 11/11
   ↓
[PERSONAL ACCOUNT] Closed testing + 12 testers × 14 days
   ↓
"Apply for production" → Google reviews
   ↓
Production release → submit for review → LIVE
```

**The most critical distinction — account type:**
| Account type | Path to production |
|---|---|
| **Personal** (ours) | ⚠️ **12 testers × 14 days closed testing** required first (November 2023 rule) |
| **Organization** (company) | ✅ Straight to production — no 12-tester requirement. But needs a **D-U-N-S number**. |

If you don't want to deal with the 12-tester hassle for a new app, open an **organization account**. Google generally doesn't allow converting personal → organization; you need a new account.

---

## 1) Prerequisites (prepare before starting)

- [ ] **Google Play Console developer account** ($25 one-time)
- [ ] **Signed release AAB** (signed with a keystore). Via Expo/EAS:
  - `eas build -p android --profile production` (cloud, EAS manages the keystore — **recommended**), or
  - Local: `cd android && ./gradlew bundleRelease` (you manage the keystore yourself)
  - ⚠️ **Never lose the keystore** — it's your upload key. Lose it and you can't update the app. Back it up. (ours: `credentials/`)
- [ ] **Package name** finalized — it **CANNOT change** later (ours: `com.driftstop.app`)
- [ ] **AdMob** (if you have ads): create the app + ad units in AdMob, put the **real IDs** in the code. `TestIds` in dev, real IDs in prod.
- [ ] **Privacy policy** — must be live at a URL (ours, on our own site: `https://mgulcu.me/driftstop/privacy`)
- [ ] **Graphics** (details below): 512×512 icon, 1024×500 feature graphic, at least 2 phone screenshots
- [ ] **Copy**: short description (≤80 chars) + full description

---

## 2) Create the app

Play Console → **"Uygulama oluştur"** (Create app) → name, default language, "App or Game," "Free or Paid," declaration checkboxes.

---

## 3) Internal testing release (upload the AAB)

**"Test edin ve yayınlayın" (Test and release) → "Dahili test" (Internal testing) → "Yeni sürüm oluştur" (Create new release)**
1. **Drag-and-drop** the AAB into the box (or upload it)
2. Release name + release notes (`<en-US> ... </en-US>` format)
3. **"İleri"** (Next) → **"Kaydet ve yayınla"** (Save and publish) → confirm again with **"Kaydet ve yayınla"** in the dialog

→ The app is now **live** in internal testing; testers can download it. (Product isn't dead while you wait out the 14 days.)

> 💡 When putting the AAB on another track (closed/production), **don't re-upload it** — use **"Kitaplıktan ekle"** (Add from library) on that track to select the existing package.

---

## 4) App content declarations (mandatory)

**"Politika ve programlar" (Policy and programs) → "Uygulama içeriği" (App content).** Each one says "Beyanı başlat" (Start declaration). Our DriftStop answers (a motivational-quotes app, no login, has AdMob ads):

| Declaration | Answer |
|---|---|
| **Privacy policy** | Paste the URL |
| **Login credentials** (App access) | "Hayır" (No — no restriction/login) |
| **Ads** | "Evet, reklam içeriyor" (Yes, contains ads) (AdMob) |
| **Content rating** (IARC questionnaire) | Email + category "Diğer Tüm Uygulama Türleri" (All Other App Types) + accept the IARC terms + answer everything per actual content (all "Hayır"/No for us) |
| **Target audience and content** | Age groups — **choosing 13+** skips the child-directed steps |
| **Data safety** | With AdMob: "Cihaz veya diğer kimlikler" (Device or other IDs) → collected **+ shared** → **not** ephemeral → **required** → purpose is **advertising or marketing** (both collection and sharing). Encryption "Yes." Account creation "doesn't allow." Data deletion method "No." |
| **Advertising ID** (AD_ID) | With AdMob: "**Evet**" (Yes) + purpose "advertising or marketing." (Because the manifest has the `AD_ID` permission.) |
| **Government app** | "Hayır" (No) |
| **Financial features** | "My app doesn't have financial features" |
| **Health** | "My app doesn't have health features" |

**Data safety note:** even if the app itself doesn't collect data, **AdMob collects an advertising ID** → Google requires you to declare this. Saying "I collect nothing at all" while shipping with AdMob gets you rejected. If you don't want ads, drop AdMob entirely — then you can say "no data."

---

## 5) Store listing

**"Play Store'daki varlığı" (Presence on Play Store) → "Mağaza girişleri" (Store listings).**
- **App name** (≤30)
- **Short description** (≤80)
- **Full description** (≤4000)
- **Graphics** (see section 8): app icon, feature graphic, phone screenshots (min 2)
- Tablet / Chromebook / Android XR → **optional**, can be left blank (only phone is mandatory)

> Enter the copy and save as draft (**"Taslak olarak kaydet"**) even without uploading a graphic yet, so the text is safe if your session drops.

---

## 6) Store settings (category + contact) — DON'T SKIP

**"Play Store'daki varlığı" (Presence on Play Store) → "Mağaza ayarları" (Store settings):**
- **App category**: App/Game + Category (ours: "Lifestyle")
- **Contact details**: email (required) + website (optional)

⚠️ This step is **the last piece that brings the dashboard setup to 11/11.** Until it's done, the **"Submit for review" button stays LOCKED** and closed testing won't open. This is the step that caught us out the most.

---

## 7) [Personal account] Closed testing — 12 testers × 14 days

**"Test edin ve yayınlayın" (Test and release) → "Kapalı test" (Closed testing) → (Alpha channel) "Kanalı yönet" (Manage channel).** 4 tasks:

1. **Create new release** → "**Kitaplıktan ekle**" (Add from library, existing AAB) → release notes → Next
2. **Select countries** → Countries/regions tab → **select all** from the header → Save
   - ⚠️ Not selecting any country gets you rejected with a "no country selected" error.
3. **Select testers** → create an email list → add 12+ Gmail addresses → check the list → (feedback email) → Save
4. **Review and roll out the release** → Save → in the **release summary**, **"N değişikliği incelemeye gönder"** (Submit N changes for review)

**Opt-in link** (to send friends): `https://play.google.com/apps/testing/YOUR.PACKAGE.NAME`
- e.g.: `https://play.google.com/apps/testing/com.driftstop.app`
- For it to work: **(a)** the review must be approved, **(b)** the person's email must be on the list.
- Tester flow: tap the link → "Become a tester" → a couple minutes → install from Play.

**Where to find 12 testers:**
- Friends/acquaintances (link in a WhatsApp group) — easiest
- **Tester-exchange communities** (everyone tests everyone else's app): testerscommunity.com (free mutual swaps + a ~$15 paid package), theclosedtest, Reddit r/androiddev / r/alphaandbetausers
- ⚠️ Emulators usually don't count; a **real device** is required. Faking 12 accounts on one phone is risky (can get rejected).

**After 14 days:** Dashboard → Production → **"Üretime başvur"** (Apply for production) button unlocks → Google reviews it.

---

## 8) Graphics

**Sizes:**
| Graphic | Size | Required |
|---|---|---|
| App icon | 512×512 PNG | ✅ |
| Feature graphic | 1024×500 | ✅ |
| Phone screenshots | 1080×2400 etc. (min 320, max 3840 px; 2-8 images) | ✅ (min 2) |
| Tablet/Chromebook/XR | — | optional |

**Tips (from our own experience):**
- Screenshots must **NOT show the "Test Ad" banner** — looks amateurish. Hide the ad or edit the banner out (PIL/Chrome).
- **Brand consistency**: same colors + motif throughout (ours: dark #1C1A16 + amber #C8923A + a hand-drawn flame). Icon, feature graphic, and hero image all in the same visual language.
- The first screenshot can be a **branded "hero" image** (a strong quote grabs attention).
- **Design in HTML → render a full-size PNG with headless Chrome:**
  ```bash
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    --headless=new --force-device-scale-factor=1 --hide-scrollbars \
    --window-size=1024,500 --virtual-time-budget=4000 \
    --screenshot=out.png "file:///.../design.html"
  ```
  (`--force-device-scale-factor=1` → exact pixels, avoids retina 2x. `--virtual-time-budget` for web fonts to load.)
- Verify size: `sips -g pixelWidth -g pixelHeight out.png`

---

## 9) Traps that got us (read this)

1. **Save → there's a confirmation dialog.** Most screens pop up "Publish this change to Google Play?"; if you navigate away **without confirming**, **nothing saves.** (Contact details got lost this way twice, exactly for this reason.)
2. **Radio/checkbox → Save delay:** right after selecting something, Save stays disabled for a moment; the first click can be a no-op — click again.
3. **The session can silently drop:** you'll get a **misleading** "fix the errors to save" message. Refresh the page → sign in again → it's fixed. (The form answers were correct, the session was the problem.)
4. **"Submit for review" lock:** dashboard setup steps (especially **category + contact**) must be complete or the submit button stays greyed out.
5. **Production lock (personal account):** "Apply for production" won't unlock until the 12-tester × 14-day period is over. The screen says so explicitly.
6. **Single-ABI warning:** we built only `arm64-v8a` to save disk space → you get a warning but it's **not blocking**. Normally build all ABIs (`bundleRelease` does this by default).
7. **The opt-in link** doesn't work before approval / if the email isn't on the list — it says "app not available."

---

## 10) QUICK CHECKLIST for a new app

```
PREP
[ ] Decide account type (personal = 12 testers / organization = exempt)
[ ] Produce a signed AAB (BACK UP the keystore)
[ ] Real AdMob IDs in the code (if any) — real in prod, TestIds in dev
[ ] Privacy policy URL live
[ ] 6 graphics ready (icon, feature, 4 screenshots) — brand-consistent, no test ads
[ ] Short (≤80) + full description written

PLAY CONSOLE
[ ] Create the app
[ ] Internal testing → upload AAB → roll out
[ ] App content: 10 declarations (privacy, app access, ads, IARC, target audience,
    data safety, advertising ID, government app, financial, health)
[ ] Store listing: name + descriptions + graphics
[ ] Store settings: category + contact  ← REQUIRED for 11/11
[ ] [Personal] Closed testing: release (from library) + countries (all) + 12 testers + submit
[ ] 12 testers × 14 days
[ ] Apply for production → Google reviews
[ ] Production release → submit for review → LIVE
```

---

## 11) Lasting notes / identifiers

- **Keystore = upload key.** Don't lose it, back it up. Losing it means you can't ship updates (requires a Google Play App Signing recovery request).
- **Package name never changes.** Get it right from the start.
- **Real AdMob prod IDs** only in prod builds; test IDs in dev (or your account can get suspended).
- Review time: usually **a few hours to a few days** (Google says "up to 7 days").
- **CNG (Expo):** the `android/` folder is gitignored; native changes go through a config plugin. Manual native edits are lost after prebuild → use a plugin instead.

---

### DriftStop reference values (example)
- Package: `com.driftstop.app` · Account: evolaroa.app (u/0, **personal**)
- Category: Lifestyle · Contact: muhammed.gulcu@gmail.com / mgulcu.me
- Privacy: https://mgulcu.me/driftstop/privacy
- Closed testing link: https://play.google.com/apps/testing/com.driftstop.app
- Graphics: `store-assets/` · Keystore: `credentials/` (gitignored)
