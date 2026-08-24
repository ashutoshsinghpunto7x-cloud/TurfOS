# App Access — Reviewer Login Instructions

Playbox requires a login (email + password) to access any functionality beyond the Welcome screen. Google Play reviewers need working credentials for **all distinct roles** so the full app can be reviewed.

## All Functionality Behind Login?
**Yes.** Provide full, working demo credentials for each role below in the Play Console "App content → App access" section.

## Demo Credentials Required (Manual Input Required)

Create dedicated, non-production test accounts in your Supabase project (do not use a real owner/staff/customer account) and fill in below:

| Role | Email | Password | Notes |
|---|---|---|---|
| Owner | `[Manual Input Required]` | `[Manual Input Required]` | Full access: dashboard, bookings, POS, inventory, credit, reports, tournaments, coupons, staff management |
| Staff | `[Manual Input Required]` | `[Manual Input Required]` | Bookings, sales, attendance |
| Customer | `[Manual Input Required]` | `[Manual Input Required]` | Booking + booking history |

## Special Instructions for Reviewers

```
1. Launch the app — you will land on the Welcome screen.
2. Tap "Sign In".
3. Use the Owner credentials above to review the full owner/admin experience
   (Dashboard, Bookings, Calendar, POS, Inventory, Credit, Reports, Tournaments).
4. Sign out and sign back in with the Staff credentials to review the staff
   booking/sales/attendance experience.
5. Sign out and sign back in with the Customer credentials to review the
   customer booking flow.
6. To test the online payment flow, select "Pay Online" during a booking
   request. Use Razorpay TEST MODE credentials if the build is pointed at a
   test Razorpay key: [Manual Input Required — provide Razorpay test card/UPI
   details, e.g. card 4111 1111 1111 1111, any future expiry, any CVV].
   If the production build uses live Razorpay keys, instruct reviewers to
   use the "Pay at Venue" / offline option instead to avoid real charges.
7. No location, camera, or contacts permissions are required to use any part
   of the app.
```

## Account Creation Note
Reviewers can alternatively self-register via "Create Account" on the Welcome/Login screen; however, new signups default to the `customer` role and staff/owner roles require manual approval (see `src/services/authService.ts` — `submitAccountRequest` / `approveAccountRequest`). **Providing pre-approved demo credentials directly (table above) is strongly recommended** so reviewers are not blocked waiting on approval.

## Sensitive Actions During Review
- Payments: Ensure the build submitted for review is either pointed at Razorpay **test** keys, or reviewers are clearly instructed to use "Pay at Venue" to avoid real monetary charges during review.
- Account deletion: If asked, direct reviewers to the process described in [privacy-policy.md](privacy-policy.md) §7.
