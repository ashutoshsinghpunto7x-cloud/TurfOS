# Release Readiness Checklist — Playbox

Status column: ✅ Ready | ⚠️ Needs attention | ❌ Missing

| Item | Current State (from `app.json` / `eas.json`) | Status | Notes |
|---|---|---|---|
| **App Name** | "Playbox" | ✅ | Consistent across `app.json`, `android.package`, `ios.bundleIdentifier` |
| **Version Name** | `1.0.0` | ✅ | First release — fine as-is |
| **Version Code (Android)** | Not set in `app.json`; `eas.json` production build has `"autoIncrement": true` | ✅ | EAS will auto-manage `versionCode` on each production build — no action needed, but confirm via `"appVersionSource": "remote"` (set in `eas.json` `cli`) that this is intentional |
| **Package Name** | `com.playbox.turf` | ✅ | Set and consistent |
| **Release Build Type** | `eas.json` production → `"buildType": "app-bundle"` | ✅ | Correct — Google Play requires **Android App Bundle (.aab)**, not raw APK, for new apps |
| **Signing** | Not configured in repo (expected — EAS manages signing credentials remotely) | ⚠️ | **Manual Input Required**: run `eas credentials` to confirm an Android upload keystore is generated/attached to this project before your first production build |
| **ProGuard / R8 (code shrinking)** | Not explicitly configured; Expo/EAS enables R8 by default for release builds on modern SDKs | ⚠️ | **Manual Input Required**: verify via EAS build logs that R8 minification ran on the production build; test the built `.aab` thoroughly since minification can occasionally break dynamic requires |
| **Min SDK / Target SDK** | Not explicitly set in `app.json`; determined by installed `expo` SDK 54 defaults | ⚠️ | **Manual Input Required**: confirm the resolved `targetSdkVersion` meets Google Play's current minimum (Play requires targeting a recent Android API level, updated annually — verify SDK 54's default satisfies the requirement in effect at your submission date) |
| **App Icon** | `assets/icon.png` — 1024×1024 ✅ correct source size | ✅ | Also referenced as `web.favicon` |
| **Adaptive Icon (Android)** | `assets/adaptive-icon.png` — 1024×1024, background `#1A6B45` | ✅ | Correctly configured under `android.adaptiveIcon` |
| **Splash Screen** | Configured via legacy top-level `"splash": { "backgroundColor": "#1A1916" }` key, no image specified | ⚠️ | This top-level `splash` key format is **deprecated as of recent Expo SDKs** (SDK 53+ expects the `expo-splash-screen` config plugin instead). It currently sets only a background color with no splash image. **Recommend**: add the `expo-splash-screen` plugin with an explicit image for a polished launch screen, and verify splash still renders correctly at runtime — see `preview_tools` verification note below. |
| **App Name (display)** | "Playbox" | ✅ | |
| **Orientation** | `"portrait"` | ✅ | Locked to portrait — appropriate for this app's UI |
| **Backup Rules (Android)** | Not explicitly configured (`android:allowBackup` defaults apply) | ⚠️ | **Manual Input Required**: since the app stores auth tokens via `expo-secure-store`, confirm default Android auto-backup behavior doesn't inadvertently back up sensitive `AsyncStorage` fallback data to Google Drive. Consider adding a custom backup rules XML via a config plugin if data sensitivity requires it (likely not necessary given SecureStore is Keystore-backed and excluded from backup by default). |
| **Deep Links** | None configured in `app.json` (no `scheme` key) | ℹ️ | Not required unless you want to support links like sharing a specific turf's public booking page (`fetchPublicTurfStatus` in `customerService.ts` suggests a public web page per turf slug exists) — optional enhancement, not a blocker |
| **Network Security Config** | Not customized — default Android network security (blocks cleartext HTTP by default on API 28+) | ✅ | All app network calls use HTTPS (Supabase, Razorpay) — no cleartext traffic exception needed |
| **Crash Handling** | No crash reporting SDK integrated (see [SDK_REPORT.md](SDK_REPORT.md)) | ⚠️ | Not a Play Store submission blocker, but recommended to add before/soon after launch for visibility into production issues |
| **EAS Update / OTA** | `expo-updates` configured, channel-based (`preview` / `production`) | ✅ | Correctly set up for post-launch JS-only updates without a new Play Store submission |
| **Environment Secrets** | Supabase URL/anon key hardcoded in `eas.json` (see [SECURITY_REPORT.md](SECURITY_REPORT.md)) | ⚠️ | Move to EAS Secrets before your next credential rotation |
| **Privacy Policy Hosted** | Not yet hosted | ❌ | **Manual Input Required**: host `privacy-policy.html` at a public URL and add it to the Play Console listing (required field) |
| **Data Safety Form Submitted** | Not yet submitted | ❌ | Use [DATA_SAFETY.md](DATA_SAFETY.md) as the answer key |
| **Content Rating Submitted** | Not yet submitted | ❌ | Use [CONTENT_RATING.md](CONTENT_RATING.md) as the answer key |
| **Store Listing Assets** | Icon/adaptive icon present; feature graphic, screenshots not found in repo | ❌ | See [ASSETS_CHECKLIST.md](ASSETS_CHECKLIST.md) |
| **App Access / Demo Credentials** | Not yet created | ❌ | See [APP_ACCESS.md](APP_ACCESS.md) |

## Pre-Submission Test Pass (Manual Input Required — perform before upload)
- [ ] Fresh install → signup → login → booking flow (all 3 roles) tested on a real Android device or emulator
- [ ] Production `.aab` built via `eas build --platform android --profile production` and installed/tested (not just Expo Go)
- [ ] Razorpay live-mode payment tested end-to-end with a small real transaction (or confirmed test-mode is intentional for review)
- [ ] Notification permission prompt appears at the correct contextual moment, not on cold start
- [ ] Image picker (payment proof) tested on Android 13+ and Android ≤12 (different permission models)
- [ ] App does not crash on rotation, backgrounding, or poor network conditions
