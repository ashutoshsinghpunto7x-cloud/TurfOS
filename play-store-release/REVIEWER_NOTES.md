# Reviewer Notes — Playbox

## Purpose of the App
Playbox is a role-based booking and management platform for sports turf/ground facilities. It serves three types of users in one app:
- **Customers** who want to browse and book available time slots for a turf.
- **Staff** who manage day-to-day bookings and point-of-sale at a specific turf.
- **Owners/Admins** who manage the full business: turfs, bookings, staff, inventory, customer credit, coupons, internal match/league scheduling, and reports.

## How to Test
1. See [APP_ACCESS.md](APP_ACCESS.md) for demo credentials for all three roles — please use these rather than creating a new account, since new signups default to the `customer` role only and staff/owner roles require manual approval inside the app.
2. Sign in as **Owner** first to see the full feature set: Dashboard → Bookings/Calendar → POS → Inventory → Credit → Reports → Match Scheduling → Coupon Management → Settings.
3. Sign out, sign in as **Staff** to see the scoped-down Bookings/Sales/Attendance experience.
4. Sign out, sign in as **Customer** to see the booking-only experience: browse slots on the calendar, submit a booking request, and (optionally) test payment.

## Special Features to Note
- **Real-time slot availability**: bookings and holds update live via Supabase realtime subscriptions — two devices/sessions viewing the same date will see slot status change as bookings are made.
- **Booking approval workflow**: online customer bookings can be configured to require manual owner/staff approval before confirmation (`fetchOnlineApprovalMode` in `bookingRequestService`), rather than always auto-confirming.
- **Dual payment paths**: online payment via Razorpay checkout, or offline "pay at venue" with optional photo upload of proof.
- **Local notifications**: the app requests notification permission to alert users about booking confirmations directly on-device — this does not use a push notification service and does not collect a device token.

## Required Credentials
See the table in [APP_ACCESS.md](APP_ACCESS.md). **Manual Input Required** — fill in actual demo account emails/passwords before submitting for review.

## Important Workflows for Review
1. **Booking request → approval → payment**: Customer submits a request → Owner/Staff approves (if approval mode is on) → Customer or Staff completes payment (online or at-venue).
2. **Staff attendance**: Staff taps a single "Mark Attendance" action once per day; Owner views a daily attendance roster.
3. **POS sale**: Staff/Owner can process an on-site sale (e.g., equipment rental, food/beverage) independent of a turf booking.

## Things Reviewers Should NOT Expect
- No camera capture anywhere in the app (only gallery/photo-library selection for payment proof).
- No location/GPS access at any point.
- No ads, no third-party analytics or tracking SDKs.
- No chat/messaging between users.

## Contact for Review Questions
**[Manual Input Required — support email for expedited reviewer communication]**
