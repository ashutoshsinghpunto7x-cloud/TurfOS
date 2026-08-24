# Permissions Audit — Playbox

## Methodology
This project uses the **Expo managed workflow** — there is no committed `android/` folder or literal `AndroidManifest.xml` in the repository (confirmed: `.gitignore` excludes `/android` and `/ios`; these are generated at build time by `expo prebuild` / EAS Build). Permissions were therefore audited by:
1. Inspecting `app.json` for explicit Android permission configuration (none present).
2. Inspecting `package.json` and source code (`src/`) for native modules that implicitly require Android permissions.

## Permissions Playbox Actually Needs

| Permission | Source | Why it's needed | Runtime prompt shown to user? |
|---|---|---|---|
| `INTERNET` | Implicit (all network calls: Supabase, Razorpay) | Required for the app to function at all | No (normal permission, not sensitive) |
| `POST_NOTIFICATIONS` (Android 13+) | `expo-notifications` (`src/hooks/useBookingScreen.ts`) | Local booking-confirmation / slot-reminder notifications | Yes |
| `READ_MEDIA_IMAGES` (Android 13+) / `READ_EXTERNAL_STORAGE` (Android ≤12) | `expo-image-picker` (`src/screens/BookingRequestModal.tsx` — `ImagePicker.launchImageLibraryAsync`) | Lets a user optionally attach a payment-proof screenshot from their gallery | Yes |

No other permission is required by any code in `src/`.

## Permissions Confirmed NOT Needed / NOT Present
- `CAMERA` — not used. The app only opens the photo **gallery** (`launchImageLibraryAsync`), never the camera (`launchCameraAsync` is not called anywhere in the codebase).
- `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` — not used. No `expo-location` dependency and no geolocation API calls found.
- `RECORD_AUDIO` — not used.
- `READ_CONTACTS` / `READ_CALL_LOG` / `READ_SMS` — not used.
- `ACCESS_BACKGROUND_LOCATION` — not used.
- Foreground service permissions — not used (no background services declared).

## Action Items Before Building
1. **Add config plugins** to `app.json` so Android correctly declares the two permissions above and shows proper rationale strings. Currently `"plugins": ["expo-font"]` — recommend adding:
   ```json
   "plugins": [
     "expo-font",
     [
       "expo-image-picker",
       { "photosPermission": "Playbox uses your photo library to attach a payment screenshot to a booking." }
     ],
     [
       "expo-notifications",
       { "icon": "./assets/notification-icon.png", "color": "#1A6B45" }
     ]
   ]
   ```
   *(Manual Input Required — create a notification icon asset if you add the `expo-notifications` plugin, or omit the `icon`/`color` options to use defaults.)*
2. Run `npx expo prebuild --platform android` (or let EAS Build generate it) and confirm the generated `AndroidManifest.xml` contains only the permissions listed above — no extras pulled in by a transitive dependency.
3. Re-verify this list after any new native dependency is added — Google Play's Permissions Policy requires every declared permission to be justified by an actual, disclosed use case (this matters especially for `POST_NOTIFICATIONS` and media permissions under the Photo and Video Permissions policy).

## Google Play Policy Alignment
- **Photo and Video Permissions Policy**: Playbox's use of gallery access is a one-off, user-initiated picker for a specific in-app purpose (payment proof) — this is compliant. Do **not** request `MANAGE_EXTERNAL_STORAGE` or broad file access; the current `expo-image-picker` usage is the correct minimal-scope approach.
- **Notifications Permission**: `POST_NOTIFICATIONS` is requested contextually via `registerForPushNotifications()` rather than unconditionally at launch — compliant with Play's runtime-permission best practices. Confirm the actual prompt is user-initiated (e.g., triggered when a user opens the booking screen) rather than shown immediately on first app open, to minimize denial rates.
