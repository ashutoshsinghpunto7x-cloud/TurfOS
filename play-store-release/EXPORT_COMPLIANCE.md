# Export Compliance — Playbox

Google Play (and Apple, for reference) require a declaration about the app's use of encryption for export-control purposes (U.S. EAR / Wassenaar Arrangement).

## Does Playbox use encryption?
**Yes — standard, industry-default encryption only:**
- HTTPS/TLS for all network communication (Supabase, Razorpay) — provided by the OS/standard libraries, not custom cryptography.
- `expo-secure-store` uses the OS-level Android Keystore / iOS Keychain for storing session tokens — standard platform encryption, not custom cryptography.

## Does Playbox implement any proprietary or non-standard encryption algorithm?
**No.** No custom cryptographic code was found anywhere in `src/`. All encryption is delegated to:
- Standard TLS (network layer)
- Platform-provided secure storage (Android Keystore via `expo-secure-store`)
- Supabase's and Razorpay's own infrastructure-level encryption at rest

## Play Console Declaration (suggested answer)
When Play Console asks about encryption under **App content → Government apps / export compliance / US export laws**:
> "My app uses encryption, but only for the standard/default encryption used by the operating system (HTTPS/TLS, platform secure storage). It does not implement any proprietary or non-standard cryptographic algorithm."

This qualifies for the **mass-market / exempt** category typical of standard consumer apps using only HTTPS and OS-level secure storage — no ECCN classification request or export license is expected to be required.

## Action Required
**Manual Input Required** — this declaration must be confirmed and submitted by the account owner directly in Play Console; this document is guidance only, not a legal filing.
