# Data Safety Form — Answer Guide for Playbox

This document maps Playbox's actual data practices (derived from source code review: `src/services/`, `src/lib/supabase.ts`, `src/screens/BookingRequestModal.tsx`, `supabase/functions/`) to the Google Play Console **Data Safety** questionnaire. Use these answers directly when filling out the form in Play Console.

> Source note: no Android SDKs for ads, analytics, or crash reporting were found in `package.json` or `App.tsx`. Only Supabase (backend) and Razorpay (payments) are integrated.

## Does your app collect or share any of the required user data types?
**Yes.**

## Data Types Collected

| Category | Data type | Collected? | Shared? | Purpose | Optional/Required |
|---|---|---|---|---|---|
| Personal info | Name | Yes | No | Account management, App functionality | Required |
| Personal info | Email address | Yes | No | Account management, App functionality | Required |
| Personal info | Phone number | Yes | No | App functionality (booking contact) | Required (at booking) |
| Financial info | Payment info (transaction status/ID only — no card/UPI numbers) | Yes | Yes (Razorpay) | App functionality, Payment processing | Required (for online payment) |
| Photos & videos | Photos | Yes (only if user chooses to attach payment proof) | No | App functionality | Optional |
| App activity | App interactions / other actions | Yes (booking history, attendance marks) | No | App functionality, Analytics for the business owner (in-app only, not sent to Playbox developer or third parties) | Required |
| App info & performance | Crash logs | No | — | — | — |
| App info & performance | Diagnostics | No | — | — | — |
| Device or other IDs | Device ID | No | — | — | — |
| Location | Approximate/Precise location | **No** | — | — | — |

## Is all of the user data collected by your app encrypted in transit?
**Yes** — all traffic to Supabase and Razorpay is over HTTPS/TLS.

## Do you provide a way for users to request that their data is deleted?
**Yes, via support contact** (email request — see Privacy Policy §7).
> Manual Input Required: If you add an in-app self-service "Delete account" button before submission, change this answer to "Yes, users can request data deletion through in-app functionality" and provide the exact path (Settings → Delete Account).

## Data collection is required or optional for app functionality?
- Name, email, password: **Required** — cannot create an account or use the app without these.
- Phone number: **Required only when creating a booking.**
- Photo upload: **Optional** — only used for manual/offline payment proof.

## Purposes disclosed
- **App functionality** — account creation, authentication, bookings, attendance, POS/inventory management (owner/staff side).
- **Payment processing** — Razorpay online payments (financial info shared with Razorpay to complete the transaction).

Purposes **not** applicable to this app: Advertising or marketing, Analytics (third-party), Fraud prevention/security (beyond standard backend logging), Personalization, Account management by a third party.

## Third Parties Data Is Shared With
| Third party | Data shared | Purpose |
|---|---|---|
| Supabase (backend-as-a-service) | Name, email, phone, booking data, uploaded images, auth credentials (hashed) | Hosting/processing app data (service provider — not considered "sharing" with a third party for advertising under Play policy, but must still be disclosed as a data processor) |
| Razorpay | Payment amount, order/payment IDs, customer name/phone/email (for receipt), NOT card/UPI numbers | Payment processing |

## Security Practices
- Data encrypted in transit (HTTPS/TLS): **Yes**
- Data encrypted at rest: **Yes** (Supabase/Postgres encrypts data at rest by default; confirm in your Supabase project settings — **Manual Input Required** to verify current setting)
- You can request data be deleted: **Yes**
- Committed to Play Families Policy: **N/A** (app is not designed for children — see [CONTENT_RATING.md](CONTENT_RATING.md))
- Independent security review: **No** (Manual Input Required if you complete one)

## Account Creation
- The app **requires** account creation to function (Sign Up / Sign In screens are the app's entry point after Welcome).
- Note: `signUpCustomer` in `src/services/authService.ts` also supports a "confirm email" flow if Supabase email confirmation is enabled — verify current dashboard setting and reflect it in the reviewer notes.

## Summary Table for Quick Entry

| Question | Answer |
|---|---|
| Does the app collect data? | Yes |
| Does the app share data with third parties? | Yes (Razorpay, for payment processing only) |
| Is data encrypted in transit? | Yes |
| Can users request deletion? | Yes (via support email; upgrade to in-app flow recommended) |
| Data collected from children | No — app not directed at children |
| Financial data collected | Yes — payment status/IDs only, not card/bank numbers |
| Location data collected | No |
| Uses Advertising ID | No |
