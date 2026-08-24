# SDK / Third-Party Library Audit — Playbox

Derived from `package.json` and actual imports in `src/` and `App.tsx`.

## Backend / Data SDKs
| SDK | Version | Purpose | Data Access |
|---|---|---|---|
| `@supabase/supabase-js` | ^2.105.0 | Backend-as-a-service: Postgres database, Authentication, Storage (file uploads), Realtime subscriptions | Full app data (auth, bookings, customers, inventory, credit, etc.) |

## Payments SDK
| SDK | Version | Purpose | Data Access |
|---|---|---|---|
| `react-native-razorpay` | ^3.0.0 | Native Razorpay Checkout for in-app card/UPI/netbanking payments | Payment amount, customer name/email/phone (for receipt); card/UPI details are handled entirely within Razorpay's own UI and never passed through app code |

Razorpay checkout is invoked via `RazorpayCheckout.open()` in `src/components/RazorpayPaymentSheet.tsx` (native) and Razorpay's `checkout.js` script in `src/components/RazorpayPaymentSheet.web.tsx` (web build only, not part of the Android app).

## Expo SDK Modules (all first-party, published by Expo/Google-adjacent, not third-party trackers)
| Module | Purpose |
|---|---|
| `expo` (~54.0.33) | Core Expo runtime |
| `expo-blur` | Visual blur UI effect |
| `expo-dev-client` | Development builds |
| `expo-font` | Custom font loading |
| `expo-image-picker` | Gallery image selection (payment proof upload) |
| `expo-linear-gradient` | UI gradient backgrounds |
| `expo-notifications` | Local, on-device notifications only (no push token registration found in code) |
| `expo-secure-store` | Encrypted on-device storage for auth session tokens |
| `expo-status-bar` | Status bar styling |
| `expo-updates` | Over-the-air (OTA) JS bundle updates via EAS Update |
| `expo-file-system` (legacy import) | Reading local file URIs for upload (`src/utils/uploadHelper.ts`) |

## Navigation / UI (no data collection)
`@react-navigation/*`, `react-native-gesture-handler`, `react-native-reanimated`, `react-native-safe-area-context`, `react-native-screens`, `react-native-svg`, `react-native-worklets`, `lucide-react-native`, `@react-native-picker/picker`

## State Management
`zustand` (^5.0.12) — local in-memory app state, no network/telemetry component.

## Storage
`@react-native-async-storage/async-storage` — local device storage, used as a fallback/companion to `expo-secure-store` for session persistence (see `src/lib/supabase.ts`).

## SDKs Explicitly NOT Present
- ❌ No advertising SDK (AdMob, Meta Audience Network, Unity Ads, etc.)
- ❌ No analytics SDK (Firebase Analytics, Mixpanel, Amplitude, Segment)
- ❌ No crash reporting SDK (Firebase Crashlytics, Sentry, Bugsnag)
- ❌ No push notification service (Firebase Cloud Messaging / Expo Push) — notifications are local-only
- ❌ No Google Sign-In / social auth SDK — auth is email/password via Supabase only
- ❌ No Maps SDK

## Recommendation
Because there is currently **no crash reporting**, you will have limited visibility into production crashes post-launch. Consider adding Sentry or Firebase Crashlytics before/shortly after launch — but if you do, update [DATA_SAFETY.md](DATA_SAFETY.md) and [privacy-policy.md](privacy-policy.md) to disclose the new "Crash logs / Diagnostics" data collection accordingly. **This is a suggestion, not a current requirement** — do not add it just for this checklist.
