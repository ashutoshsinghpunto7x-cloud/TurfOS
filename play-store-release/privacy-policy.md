# Privacy Policy for Playbox

**Last updated: [Manual Input Required — insert publish date]**

This Privacy Policy explains how Playbox ("the App", "we", "us", "our") collects, uses, and protects information when you use our mobile application for turf/sports ground booking and management.

Playbox is operated by **[Manual Input Required — legal entity / developer name]**, contactable at **[Manual Input Required — support email, e.g. support@playbox.app]**.

## 1. Information We Collect

### 1.1 Account Information
When you create an account, we collect:
- Full name
- Email address
- Password (stored securely and hashed by our authentication provider, Supabase Auth — we never see or store your plaintext password)

### 1.2 Booking & Contact Information
When you book a turf/ground slot, we collect:
- Phone number (used to contact you about your booking)
- Booking details (date, time slot, sport, turf selected, price)

### 1.3 Payment Information
When you pay for a booking online, payment is processed by **Razorpay**, a third-party PCI-DSS compliant payment gateway.
- Card numbers, UPI IDs, and other sensitive payment credentials are entered directly into Razorpay's secure checkout and are **never transmitted to, or stored by, Playbox's servers or app**.
- We store only the payment outcome (order ID, payment ID, and status) to reconcile your booking.
- If you choose manual/offline payment, you may optionally upload a screenshot of your payment as proof, which is stored in our secure cloud storage (see Section 1.4).

### 1.4 Photos
The App allows you to optionally select an image from your device's photo gallery (e.g., a payment confirmation screenshot) to attach to a booking request. The App does **not** access your camera directly and does not access your photo library except when you actively choose to pick an image.

### 1.5 Notifications
The App requests permission to send local notifications (e.g., booking confirmations, slot availability alerts) directly on your device. These are generated on-device and are **not** sent via a third-party push notification service, and we do not collect a device push token.

### 1.6 Staff Attendance Data (Staff/Owner Accounts Only)
For users operating in a Staff role, the App records the date and time attendance is marked. No location data is collected as part of attendance.

### 1.7 Automatically Collected Information
Our backend infrastructure provider (Supabase) may automatically log technical information such as IP address and request timestamps for security and abuse-prevention purposes, consistent with standard cloud-hosting practices.

## 2. Information We Do NOT Collect
- We do **not** access your device's precise or approximate location (GPS).
- We do **not** access your camera directly.
- We do **not** use advertising SDKs.
- We do **not** use third-party analytics or behavioral-tracking SDKs.
- We do **not** collect contacts, call logs, or SMS data.

## 3. How We Use Your Information
We use the information above to:
- Create and manage your account
- Process and confirm turf/ground bookings
- Facilitate payments via Razorpay
- Send you booking-related notifications
- Allow turf owners/staff to manage bookings, customers, and attendance
- Maintain the security and integrity of the App

## 4. Data Storage & Security
- Account, booking, and profile data is stored in **Supabase** (PostgreSQL database with row-level security policies restricting access based on your role).
- Data in transit is encrypted using HTTPS/TLS.
- Session tokens are stored on-device using secure, OS-level encrypted storage (`expo-secure-store`) where available.
- Payment card/UPI data is handled entirely by Razorpay and is never stored by us.

## 5. Data Sharing
We do not sell your personal information. We share data only with:
- **Supabase** — our backend database, authentication, and file storage provider.
- **Razorpay** — our payment processor, to complete transactions.
- Turf owners/staff, as necessary, to fulfil and manage your bookings (e.g., your name, phone number, and booking details are visible to the turf's staff/owner).

We do not share your data with advertisers or data brokers.

## 6. Data Retention
We retain your account and booking data for as long as your account is active, or as needed to provide the service, comply with legal obligations, resolve disputes, and enforce our agreements.

## 7. Account & Data Deletion
You may request deletion of your account and associated personal data at any time by contacting us at **[Manual Input Required — support email]**. We will delete or anonymize your data within a reasonable period, except where retention is required by law (e.g., financial transaction records).

*[Manual Input Required: If you add an in-app "Delete my account" option before launch, describe the exact in-app steps here — Google Play increasingly expects an in-app deletion path for apps with account creation.]*

## 8. Children's Privacy
Playbox is not directed at children under 13 (or the minimum age required in your jurisdiction), and we do not knowingly collect personal information from children.

## 9. Your Rights
Depending on your location, you may have rights to access, correct, export, or delete your personal data. Contact us at **[Manual Input Required — support email]** to exercise these rights.

## 10. Changes to This Policy
We may update this Privacy Policy from time to time. We will notify you of material changes by updating the "Last updated" date above.

## 11. Contact Us
If you have questions about this Privacy Policy, contact us at:
**[Manual Input Required — support email]**
**[Manual Input Required — postal address, if required by your jurisdiction]**
