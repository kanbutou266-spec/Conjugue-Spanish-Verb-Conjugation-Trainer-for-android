<h1 align="center">BianWeiJun · Spanish Verb Conjugation Trainer</h1>

<p align="center">
  <img src="assets/images/icon.png" width="96" alt="App icon" />
</p>

<p align="center">
  <b>Offline · No ads · No account</b>&nbsp;|&nbsp;487 verbs × 15 tenses × 4 drill modes<br/>
  Android (React Native) · feature-parity with the web edition
</p>

<p align="center">
  <a href="https://github.com/kanbutou266-spec/Spanish-Verb-Conjugation-Trainer">
    <img src="https://img.shields.io/badge/GitHub-Web_Edition-2f6df6?style=for-the-badge&logo=github&logoColor=white" alt="Web edition repo (single-file HTML, just open and drill)" />
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/English-Current-2f6df6?style=for-the-badge" alt="English (current language)" />
  &nbsp;
  <a href="README.md">
    <img src="https://img.shields.io/badge/%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-Switch-6b7280?style=for-the-badge" alt="切换到中文" />
  </a>
</p>

**BianWeiJun** (变位君, "Conjugation Buddy") is an offline Spanish verb conjugation trainer for
learners who have moved past the basics and are wrestling with the conjugation tables:
487 verbs × 15 common tenses, four drill modes, character-level grading with highlights,
and an 8-page grammar guide.

> Fully offline: no ads, no account, no network. The verb database and the grammar guide
> are bundled into the APK. There is also a feature-matched
> [web edition](https://github.com/kanbutou266-spec/Spanish-Verb-Conjugation-Trainer)
> (a single HTML file — download, double-click, drill).

<p align="center">
  <img src="docs/screenshots/01-practice-home.png" width="180" alt="Practice home" />
  <img src="docs/screenshots/02-practice.png" width="180" alt="Answering" />
  <img src="docs/screenshots/09-practice-dark.png" width="180" alt="Dark mode" />
</p>
<p align="center">
  <img src="docs/screenshots/05-conj-table.png" width="180" alt="Conjugation table" />
  <img src="docs/screenshots/03-guide.png" width="180" alt="Grammar guide index" />
  <img src="docs/screenshots/04-guide-detail.png" width="180" alt="Grammar guide article" />
</p>
<p align="center">
  <img src="docs/screenshots/06-me.png" width="180" alt="Profile" />
  <img src="docs/screenshots/07-settings.png" width="180" alt="Settings" />
  <img src="docs/screenshots/08-about.png" width="180" alt="About" />
</p>

---

## 💝 Support this project

If this project helps you, feel free to treat the author's big fat fish to some premium fish
food — all donations go toward maintaining the project.

> Donations are entirely voluntary. The app itself is completely free, and **no feature is
> ever locked behind a donation**.

<p align="center">
  <img src="assets/images/donation.png" width="220" alt="WeChat appreciation QR code" />
</p>

---

## Features

### Four drill modes
| Mode | What you do |
|---|---|
| **Recognition** | Given a conjugated form, pick its person + tense |
| **Production** | Given a person and a tense, write the form (core mode) |
| **Tense shift** | Given a form, write the same tense in another person |
| **Verb transfer** | Carry a whole person set over between two tenses |

### Grading & feedback
- **Character-level highlighting**: when you get one wrong, the exact differing letters are
  marked instead of a blanket red cross. Accents (á é í ó ú ñ) can be graded strictly,
  per your settings.
- **Multiple valid readings**: beyond single-reading answers like `hablé`, any form that maps
  to more than one rule counts as correct (e.g. `-amos` is both present-tense *nosotros*
  and imperative *nosotros*).
- Wrong answers feed into **study stats**: accuracy trends and your most-missed verbs.

### Conjugation table
Look up all tenses of any verb. Tense pairs that are commonly studied together
(present / present perfect, preterite / pluperfect…) sit side by side on one card for easy
comparison. Search by infinitive, conjugated form, or Chinese gloss.

### Also
- **Bilingual UI** (中文 / English): follows the system language, switchable in settings;
- **Three theme modes** (follow system / light / dark), every color value aligned across both palettes;
- **Difficulty carousel**: A1/A2/B1 verb-library presets plus custom slots
  (pick your own library, tenses and input mode);
- Progress and settings are stored locally (zustand persist) and can be exported as a JSON backup.

---

## Tech stack

- **React Native 0.86 + Expo SDK 57** (expo-router file-based routing, TypeScript)
- State: **zustand** + persist (AsyncStorage)
- Icons: **lucide-react-native**, rasterized to PNG (`scripts/gen-tab-icons.mjs`)
- Testing: **jest + jest-expo + RNTL v14**, 746 tests / 35 suites
- The engine layer `src/engine/` is a set of **pure functions — zero UI, zero globals**,
  fully covered by unit tests

```
src/
├── app/            # expo-router routes: (tabs) + practice / settings / about ...
├── components/     # cross-page components (bottom tabs, splash brand page)
├── config/         # brand constants (repo URL, version — change in one place)
├── data/           # verbs.json (487 verbs, compact format) + guide.ts (generated)
├── engine/         # question generation / grading / highlighting / search / guide parsing
├── i18n/           # bilingual strings (271 keys each, enforced by tests)
├── store/          # zustand: settings / stats / custom slots
├── ui/             # theme tokens (dual palettes) + base component library
└── utils/
```

### Relationship with the web edition
This repo is the [Android edition of the same project](https://github.com/kanbutou266-spec/Spanish-Verb-Conjugation-Trainer).
Two hard rules:

1. **Verbs and the guide are byte-identical to the web edition** — `src/data/verbs.json`
   comes straight from the web pipeline; `src/data/guide.ts` is generated by
   `node scripts/extract-guide.mjs` from the web template, **never hand-edit it**.
2. **UI values copy the web CSS** — theme tokens, spacing and font sizes all follow the web
   edition; `__tests__/ui/no-hardcoded-colors.test.ts` scans the whole repo and forbids
   hard-coded colors.

---

## Running locally

Requires **Node 18+**, **JDK 17** and the Android SDK (a working Android Studio install).

```bash
npm install
npm start            # start Metro, press 'a' for the Android emulator
```

Other common commands:

```bash
npm run android      # build & install to emulator/device (dev build)
npm test             # full jest regression (746 tests)
npm run typecheck    # tsc --noEmit
npm run lint         # expo lint
```

## Building the APK

```bash
build-apk.cmd        # on Windows, just double-click
npm run android:apk  # CLI equivalent: cd android && gradlew assembleRelease
```

Outputs:

- `android/app/build/outputs/apk/release/app-release.apk`
- `BianWeiJun-release.apk` (a copy in the repo root)

The release build **embeds the JS bundle**, so once installed on a phone it runs fully
offline without Metro. Install with `adb install -r BianWeiJun-release.apk`.

**Signing**: the app is currently signed with the public debug keystore from the RN template
(password is `android`, committed to the repo so a fresh clone builds right away). That is
fine for personal use / sideloading. For Google Play, swap in your own release keystore in
`android/app/build.gradle` → `signingConfigs`, and **never commit** the new keystore
(`.gitignore` already blocks `*.jks` / `*.keystore`).

> ⚠️ **After editing any JS under `src/`, you must clear the two bundle cache directories
> before rebuilding**, or Gradle silently reuses the stale bundle
> (`createBundleReleaseJsAndAssets` does not track JS source changes):
>
> ```bash
> rm -rf android/app/build/generated/assets/react android/app/build/intermediates/assets
> ```
>
> `build-apk.cmd` already does this for you.

### APK size (2026-10-08 optimization, 108.9 MB → 16.7 MB)

The default config used to produce a 109 MB APK; after trimming, it's down to **16.7 MB**
(arm64-v8a):

| Measure | Where | Gain |
|---|---|---|
| Keep only `arm64-v8a` | `reactNativeArchitectures` in `android/gradle.properties` | -61 MB (four ABIs each shipped an identical copy of RN/Hermes; x86/x86_64 are emulator-only, armeabi-v7a is 32-bit pre-2017 hardware) |
| R8 code + resource shrinking | `android.enableMinifyInReleaseBuilds` / `android.enableShrinkResourcesInReleaseBuilds` | dex 15 → 6 MB |
| Deflate-compress native libs | `expo.useLegacyPackaging=true` | .so 22 → 7 MB (trade-off: slightly larger on-disk footprint after install) |
| Keep only zh/en resources | `resourceConfigurations` in `android/app/build.gradle` | resources.arsc 1.6 → 0.6 MB |
| Disable GIF/WebP decoders, compress the JS bundle, drop unused deps | `expo.gif.enabled=false`, `expo.webp.enabled=false`, `android.enableBundleCompression=true`, removed `@react-native-community/slider` | -3.5 MB |

Notes:

- **When verifying on an emulator, override the ABI** (emulators are x86_64):
  `cd android && gradlew assembleRelease -PreactNativeArchitectures=x86_64`
- If R8 minification causes "class not found / native module method not found" crashes,
  set `android.enableMinifyInReleaseBuilds` back to `false` to isolate, then add keep rules
  in `android/app/proguard-rules.pro` (the full flow passed acceptance after enabling it).
- `expo-symbols` was only used once in the web build and has been replaced with a lucide icon —
  its Android implementation bundles a 966 KB Material Symbols font.

## Icon & splash screen

All icons (adaptive foreground/monochrome layers, 5 mipmap densities, system splash logo)
are generated by a single script — **never hand-edit the PNGs in `res/`**:

```bash
node scripts/gen-app-icon.mjs
```

It reads the `assets/brand/*.svg` vector masters, renders `assets/images/*`, and writes
straight into `android/app/src/main/res/`. To change the design, edit the script and re-run it.
The app name「变位君」lives in **two places**: `expo.name` in `app.json` and `app_name` in
`android/app/src/main/res/values/strings.xml` — change them together.

## Project conventions

- **The engine layer has zero UI**: `src/engine/` contains only pure functions with explicit
  parameters and imports no components — that's what keeps 746 tests fast.
- **No hard-coded strings**: everything goes through `src/i18n/` (zh/en key counts must be
  equal, enforced by a test).
- **No hard-coded colors**: everything goes through the palette in `src/ui/theme.ts`
  (enforced by a scanning test).
- Bottom tab labels must be ≤ 12 characters, or the native bottom bar drops tabs.

## License

[MIT](LICENSE)

---

*¡Ánimo y a conjugar!* 🇪🇸
