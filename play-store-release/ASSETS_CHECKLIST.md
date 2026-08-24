# Required Store Assets Checklist — Playbox

## Assets Already Present in Repo (`TurfOS/assets/`)
| Asset | File | Actual Dimensions | Status |
|---|---|---|---|
| App Icon (adaptive foreground source) | `icon.png` | 1024×1024 | ✅ Correct source size for EAS build |
| Adaptive Icon | `adaptive-icon.png` | 1024×1024 | ✅ Correct source size |
| Splash source | `splash.png` | 1024×1024 | ⚠️ Present but **not referenced** in `app.json`'s current splash config (only a background color is set) — see [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) |
| Favicon (web) | `favicon.png` | Not verified | ✅ Used for web build only, not Play Store |

## Assets Still Required for Play Console (Manual Input Required — none of these exist in the repo yet)

| Asset | Required Dimensions | Format | Notes |
|---|---|---|---|
| **Hi-res App Icon** | 512 × 512 px | 32-bit PNG (with alpha) | Play Console store listing icon — separate from the in-app adaptive icon; generate by resizing/re-exporting `icon.png` |
| **Feature Graphic** | 1024 × 500 px | PNG or JPEG, no alpha | Required. Suggested copy in [PLAY_STORE_LISTING.md](PLAY_STORE_LISTING.md) |
| **Phone Screenshots** | Min 2, max 8. Each side 320–3840 px, 16:9 or 9:16 aspect ratio | PNG or JPEG | Capture from: Dashboard, Booking flow, Calendar, POS, and Customer booking screens for a representative set |
| **7-inch Tablet Screenshots** | Min 1 if supporting tablets, same size rules as phone | PNG/JPEG | Optional if you declare tablet support; app is currently portrait-locked with no tablet-specific layout — **recommend declaring phone-only support** to skip this requirement unless tablet UI has been tested |
| **10-inch Tablet Screenshots** | Same as above | PNG/JPEG | Same note as 7-inch |
| **Promo Video** | YouTube URL | — | Optional, not required for submission |
| **TV Banner** | 1280 × 720 px | PNG/JPEG | **Not applicable** — Playbox is not an Android TV app |

## Recommendation on Device Support Declaration
Since the app has no tablet-optimized layouts evident in the codebase (single responsive layout, portrait-locked), declare **"Phone only"** (or explicitly exclude tablet form factors) in Play Console's device catalog settings to avoid a tablet-screenshot requirement and to prevent Play from surfacing the app to tablet users where the UI may not be optimized. **Manual Input Required** — confirm this decision.

## How to Produce Screenshots
1. Build and run the production (or preview) app on a real device or emulator (`eas build --profile preview --platform android`, install the `.apk`).
2. Log in with each role's demo account (see [APP_ACCESS.md](APP_ACCESS.md)).
3. Capture at minimum: Login/Welcome, Owner Dashboard, Booking Calendar, New Booking flow, Customer booking screen.
4. Ensure no real customer data, phone numbers, or payment details are visible in any captured screenshot — use demo/test data only.
