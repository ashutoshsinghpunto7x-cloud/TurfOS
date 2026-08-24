# Google Play Developer Policy Compliance — Playbox

## User Data Policy
- ✅ App discloses data collection accurately (see [privacy-policy.md](privacy-policy.md), [DATA_SAFETY.md](DATA_SAFETY.md)).
- ✅ No data is collected beyond what's disclosed and necessary for app functionality (auth, bookings, payments).
- ⚠️ **Action needed**: Privacy Policy must be hosted at a publicly accessible URL and linked in both the Play Console listing and (recommended) within the app itself (e.g., a link on the Login/Signup screen). **Manual Input Required.**
- ⚠️ Recommend adding an in-app account/data deletion option ahead of Play's increasing expectations for apps with account creation — currently deletion is support-email-based only, which is compliant but not best-in-class.

## Permissions Policy
- ✅ Only two runtime-sensitive permissions used (`POST_NOTIFICATIONS`, media/photos access), both directly tied to disclosed, user-facing features. See [PERMISSIONS_REPORT.md](PERMISSIONS_REPORT.md).
- ✅ No broad/undeclared permissions requested.

## Families Policy
- **Not applicable.** Playbox is not designed for, directed at, or likely to primarily attract children. Do not opt into the Families program in Play Console. Target audience should be set to an adult/general audience (see [CONTENT_RATING.md](CONTENT_RATING.md)).

## Sensitive Permissions
- No "restricted" or "dangerous" permission groups beyond standard, well-justified `POST_NOTIFICATIONS` and photo access are used. No location, SMS, call log, or accessibility-service permissions are requested — these are the categories Play scrutinizes most heavily, and Playbox uses none of them.

## Foreground Service Rules
- **Not applicable.** No foreground services are declared or used anywhere in the codebase.

## Background Location
- **Not applicable.** No location permission of any kind (foreground or background) is requested by the app.

## Photo & Video Permissions Policy
- ✅ Compliant. Gallery access is scoped, user-initiated (tapping "attach payment proof"), and used strictly for the disclosed purpose. The app does not request `MANAGE_EXTERNAL_STORAGE` or broad file-system access.

## Financial Services / Payments Policy
- Playbox facilitates payment for a real-world service (turf slot rental) via **Razorpay**, a licensed Indian payment aggregator. This is standard e-commerce/booking payment functionality, not a restricted financial product (not a lending, crypto, or gambling app) — should not trigger Play's Financial Apps policy requirements for loan apps.
- **Manual Input Required**: If Playbox will process real transactions at launch, confirm Razorpay production KYC/merchant account is fully activated, and that refund/cancellation terms are clearly stated in [terms-and-conditions.md](terms-and-conditions.md) (currently marked as Manual Input Required there).

## Restricted Content
- No gambling, adult content, violence, or other restricted content categories apply to this app.

## Ads Policy
- **Not applicable.** No ad SDKs are integrated (see [SDK_REPORT.md](SDK_REPORT.md)).

## Impersonation / Intellectual Property
- **Manual Input Required**: confirm "Playbox" and the `com.playbox.turf` package/branding do not conflict with any existing trademark before publishing, and that the developer account name used to publish matches the legal entity referenced in the Privacy Policy / Terms.

## Deceptive Behavior / Metadata Policy
- Ensure the store listing (title, description, screenshots — see [PLAY_STORE_LISTING.md](PLAY_STORE_LISTING.md), [ASSETS_CHECKLIST.md](ASSETS_CHECKLIST.md)) accurately represents actual app functionality with no misleading claims. The draft listing in this package was written to describe only features verified present in the codebase.

## Overall Compliance Summary
No functional changes to the app are required for baseline Google Play policy compliance. Outstanding items are all **process/configuration** tasks (hosting the privacy policy, completing Play Console forms, producing store graphics) rather than code changes — tracked in [PLAY_STORE_READINESS_REPORT.md](PLAY_STORE_READINESS_REPORT.md).
