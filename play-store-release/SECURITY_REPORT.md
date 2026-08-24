# App Security Review — Playbox

## Scope
Static review of `src/`, `App.tsx`, `supabase/functions/`, `app.json`, `eas.json`, and `.env` (contents redacted from this report) for hardcoded secrets, unsafe storage, and unsafe logging.

## Findings

### ✅ No hardcoded secrets found in application source
- Searched `src/` for API key patterns, hardcoded passwords, and tokens: no matches.
- Supabase URL/anon key are loaded from environment variables (`process.env.EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`) in `src/lib/supabase.ts`, not hardcoded in source.
  - Note: the Supabase **anon key** is a public, publishable key by design (protected by Supabase Row-Level Security policies on the backend) — its presence in a client build is expected and not a vulnerability, provided RLS policies are correctly configured. **Manual Input Required — confirm RLS is enabled and correctly scoped on all tables** (`profiles`, `bookings`, `turfs`, `staff_attendance`, `account_requests`, etc.) since this is the actual security boundary for a public anon key.

### ⚠️ `eas.json` contains the Supabase URL and anon key in plaintext
`eas.json` (`build.preview.env` and `build.production.env`) hardcodes `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` directly in the committed file.
- **Risk:** Low, since this is the public anon key (see above), but best practice is to use [EAS Secrets](https://docs.expo.dev/build-reference/variables/) instead of committing any env values to version control, so key rotation doesn't require a source change and so reviewers of the repo don't need to reason about which keys are "safe" to expose.
- **Recommendation:** Move `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` to `eas secret:create` and reference via `env` lookup, keeping `eas.json` free of any values.

### ✅ Razorpay secret key never exposed to the client
`RAZORPAY_KEY_SECRET` only appears (commented out, unused) in the local `.env` file, which is git-ignored. The actual secret is correctly kept server-side in Supabase Edge Function secrets (`supabase/functions/create-razorpay-order/index.ts` reads it via `Deno.env.get('RAZORPAY_KEY_SECRET')`), and only the public `RAZORPAY_KEY_ID` and order ID are returned to the app. This is the correct pattern.

### ✅ `.env` is git-ignored
Confirmed in `.gitignore` (`.env` is listed). No `.env` file is tracked in git history was verified as part of this review at the file-listing level — **Manual Input Required: run `git log --all --full-history -- .env` to confirm it was never committed in an earlier commit**, since a `.gitignore` entry only prevents *future* commits, not historical ones.

### ✅ No debug console logging in application source
`grep` for `console.log|console.warn|console.error|console.debug` across `src/` returned zero matches — no risk of leaking sensitive data (tokens, user data) via device logs in production builds.

### ✅ Session token storage uses platform-secure storage
`src/lib/supabase.ts` stores auth session tokens in `expo-secure-store` (Android Keystore-backed) for small values, falling back to `AsyncStorage` (unencrypted) only for values ≥2KB. Supabase session JWTs are typically well under 2KB, so this should route through SecureStore in practice — **Manual Input Required: verify actual token size in your Supabase project (custom claims can enlarge JWTs) to confirm SecureStore is actually being used, not the AsyncStorage fallback.**

### ℹ️ CORS wildcard in Edge Functions
`supabase/functions/create-razorpay-order/index.ts` sets `'Access-Control-Allow-Origin': '*'`. This is standard for a mobile-app-only backend (mobile apps aren't subject to browser CORS), but if a web build of this app is ever exposed publicly, consider restricting this to your specific web origin.

### ✅ Payment authenticity verified server-side
`verify-razorpay-payment` Edge Function exists and is called after checkout completes (`src/components/RazorpayPaymentSheet.tsx`), rather than trusting the client-reported payment success — correct pattern to prevent payment-status spoofing.

## Summary
| Severity | Count | Notes |
|---|---|---|
| Critical | 0 | |
| High | 0 | |
| Medium | 1 | Supabase URL/anon key committed in `eas.json` — move to EAS Secrets |
| Low / Informational | 3 | RLS policy verification, JWT size verification, `.env` git-history check |

No hardcoded API secrets, passwords, or private keys were found in application source code. The one medium finding is a best-practice hygiene issue, not an active vulnerability, since the exposed value is a public anon key by design.
