# Play Store Readiness Report — Playbox

Generated from a full static analysis of the TurfOS/Playbox codebase (`src/`, `App.tsx`, `app.json`, `eas.json`, `package.json`, `supabase/functions/`). No application functionality was modified as part of this audit — only documentation was added under `play-store-release/`.

## ✔ Completed / Ready
- [x] Privacy Policy drafted, accurately reflecting actual data collection ([privacy-policy.md](privacy-policy.md) / `.html`)
- [x] Terms & Conditions drafted ([terms-and-conditions.md](terms-and-conditions.md) / `.html`)
- [x] Data Safety form answer key prepared ([DATA_SAFETY.md](DATA_SAFETY.md))
- [x] Play Store listing copy drafted (title, descriptions, keywords) ([PLAY_STORE_LISTING.md](PLAY_STORE_LISTING.md))
- [x] Content rating questionnaire answer key prepared ([CONTENT_RATING.md](CONTENT_RATING.md))
- [x] App access / reviewer instructions template prepared ([APP_ACCESS.md](APP_ACCESS.md))
- [x] Permissions fully audited — only 2 sensitive permissions in use, both justified ([PERMISSIONS_REPORT.md](PERMISSIONS_REPORT.md))
- [x] SDK audit complete — no ads/analytics/crash SDKs present ([SDK_REPORT.md](SDK_REPORT.md))
- [x] Third-party license list generated from verified `node_modules` metadata ([THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md))
- [x] Export compliance declaration guidance prepared ([EXPORT_COMPLIANCE.md](EXPORT_COMPLIANCE.md))
- [x] Security review complete — no hardcoded secrets in application source ([SECURITY_REPORT.md](SECURITY_REPORT.md))
- [x] Release readiness checklist compiled against actual `app.json`/`eas.json` config ([RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md))
- [x] Google Play policy compliance mapped ([GOOGLE_PLAY_COMPLIANCE.md](GOOGLE_PLAY_COMPLIANCE.md))
- [x] Required visual assets checklist with exact dimensions ([ASSETS_CHECKLIST.md](ASSETS_CHECKLIST.md))
- [x] Reviewer notes drafted ([REVIEWER_NOTES.md](REVIEWER_NOTES.md))

## ❌ Missing / Blocking Items (must be done before submission)
1. **Privacy Policy is not hosted publicly.** Google Play requires a live URL. Host `privacy-policy.html` (e.g., GitHub Pages, Vercel — a `vercel.json` already exists in the repo, suggesting Vercel is already used for something) and paste the URL into Play Console.
2. **Demo/reviewer credentials do not exist yet.** Create dedicated Owner/Staff/Customer test accounts in Supabase and fill in [APP_ACCESS.md](APP_ACCESS.md).
3. **Store graphics do not exist.** Feature graphic (1024×500), hi-res icon (512×512), and phone screenshots must be produced — see [ASSETS_CHECKLIST.md](ASSETS_CHECKLIST.md).
4. **Data Safety and Content Rating forms have not been submitted** in Play Console — this audit provides the answers, but a human must enter them in the console.
5. **Legal entity, support email, jurisdiction, and refund policy placeholders** throughout the generated documents are marked "Manual Input Required" and must be filled in with real values before publishing (search all files in this folder for that exact phrase).

## ⚠️ Risks Before Publishing
| Risk | Detail | Recommended Action |
|---|---|---|
| Splash screen misconfiguration | `app.json` uses the deprecated top-level `splash` key with only a background color, no image, and no `expo-splash-screen` plugin | Verify actual splash rendering on a real build; migrate to the plugin-based config if the current splash doesn't render as intended |
| Supabase keys committed in `eas.json` | Public anon key only (not the secret key), so low risk, but poor hygiene | Migrate to EAS Secrets |
| No crash reporting | Zero production crash visibility post-launch | Optional: add Sentry/Crashlytics post-launch (would require a Data Safety form update) |
| No in-app account deletion | Deletion is currently support-email-only | Consider adding a self-service "Delete my account" flow to align with evolving Play expectations for apps with account creation |
| Target/Min SDK not explicitly pinned | Relies on Expo SDK 54 defaults | Confirm the resolved `targetSdkVersion` meets Google Play's current minimum at time of submission (this threshold changes yearly) |
| Refund/cancellation and jurisdiction terms undefined | Terms & Conditions has open placeholders for these business-decision fields | Legal/business decision required from the developer, not something derivable from code |
| Payment review mode unclear | Reviewers must not be charged real money during Play review | Confirm Razorpay test keys are used for the review build, or clearly instruct reviewers to use the offline "Pay at Venue" path |

## Estimated Approval Readiness: **70%**
The application code itself is in solid shape from a policy-compliance perspective — minimal, well-justified permissions; no ad/tracking SDKs; no hardcoded secrets; secure payment handling with server-side verification. What remains is entirely **process and asset production work** (hosting the privacy policy, producing store graphics, creating demo accounts, and filling in business/legal placeholders), not code changes. None of the outstanding items require touching the app's functionality.

## Exact Steps Remaining Before Uploading to Google Play
1. Fill in every "Manual Input Required" placeholder across the files in this `play-store-release/` folder (legal entity name, support email, jurisdiction, refund policy, publish date).
2. Host `privacy-policy.html` and `terms-and-conditions.html` at public URLs.
3. Create Owner/Staff/Customer demo accounts in Supabase; record credentials in `APP_ACCESS.md`.
4. Design and export: hi-res icon (512×512), feature graphic (1024×500), and 2–8 phone screenshots.
5. (Optional but recommended) Add `expo-image-picker` and `expo-notifications` config plugins to `app.json` per `PERMISSIONS_REPORT.md`, and address the splash screen config per `RELEASE_CHECKLIST.md`.
6. Move Supabase URL/anon key from `eas.json` into `eas secret:create`.
7. Build the production `.aab`: `eas build --platform android --profile production`.
8. Install and manually test the built `.aab` on a real device across all three roles and the payment flow.
9. In Google Play Console: create the app listing, paste in copy from `PLAY_STORE_LISTING.md`, upload graphics, complete Data Safety (`DATA_SAFETY.md`) and Content Rating (`CONTENT_RATING.md`) questionnaires, fill App Access (`APP_ACCESS.md`), and upload the `.aab`.
10. Submit for review.
