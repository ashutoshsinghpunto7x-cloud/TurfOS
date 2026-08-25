-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Adds idempotency support to razorpay_payments so that retrying a payment
-- (double-tap, network drop after charge, "Try Again" after a false failure,
-- reopening the booking modal, etc.) can never charge the same customer twice
-- for the same slot/booking.

-- 1. New column: a stable key the client sends with every create-order call for
--    a given booking attempt (see src/screens/BookingRequestModal.tsx). The same
--    key is reused across retries of the SAME attempt, so the backend can detect
--    "this is the same payment being retried" instead of creating a brand-new
--    Razorpay order every time.
alter table public.razorpay_payments
  add column if not exists idempotency_key text;

-- 2. Fast lookup by key (create-razorpay-order queries this on every call).
create index if not exists idx_razorpay_payments_idem
  on public.razorpay_payments (idempotency_key);

-- 3. Hard safety net at the database level: even if application logic has a bug
--    or two requests race each other, Postgres will physically refuse to let a
--    second row for the same idempotency_key ever reach status = 'paid'.
--    (Partial unique index — rows with idempotency_key IS NULL or status <> 'paid'
--    are unaffected.)
create unique index if not exists ux_razorpay_payments_idem_paid
  on public.razorpay_payments (idempotency_key)
  where status = 'paid' and idempotency_key is not null;
