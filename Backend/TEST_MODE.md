# Free onboarding for testing

A single environment variable lets testers walk the full applicant journey
without spending money on NIN lookups or a real Paystack charge.

```
TEST_MODE_FREE_ONBOARDING=true
```

Set it to `false` — or delete the line — and everything goes straight back to
live behaviour. Nothing was removed from the codebase to make this work.

## What changes while it is on

| Step | Normally | With the flag on |
|------|----------|------------------|
| `POST /profile/verify-nin` | Dojah NIN lookup | The 11-digit NIN is accepted without the lookup. No biodata is invented — the fields Dojah would have supplied stay empty. |
| `POST /payments/session/initialize` | Redirect to Paystack | The payment row settles immediately and the applicant is sent to the normal `/payment/callback` screen. |

Everything else runs exactly as it does in production: the same rows are
written, the same session statuses are set (`pending_payment → paid`), the same
emails go out, and the same screens appear. The callback screen and the
verification step that follows are still exercised.

The applicant's checkout shows a green "Test mode — no money will be taken"
notice and the button reads **Continue** instead of **Proceed to Payment**, so a
tester is never left wondering whether they were charged.

## Telling test data apart afterwards

Records created while the flag was on are tagged, so they can be found and
cleaned up:

```sql
-- Payments that never went through Paystack
SELECT * FROM payments WHERE channel = 'test_mode';

-- Profiles whose NIN was accepted without a Dojah lookup
SELECT user_id, nin FROM applicant_profiles WHERE nin_data->>'simulated' = 'true';
```

To clear them out before going live:

```sql
BEGIN;
UPDATE applicant_profiles
   SET nin_verified = FALSE, nin_data = NULL
 WHERE nin_data->>'simulated' = 'true';

DELETE FROM application_sessions
 WHERE payment_id IN (SELECT id FROM payments WHERE channel = 'test_mode');

DELETE FROM payments WHERE channel = 'test_mode';
COMMIT;
```

## Where the code lives

Three places, each with a comment pointing back here:

- `src/config/index.js` — reads the flag and logs a warning at boot when it is on
- `src/services/nin.service.js` — `validateNin()` returns early instead of calling Dojah
- `src/modules/payments/payment.service.js` — `initializeSession()` settles without Paystack

## Going live again

1. Set `TEST_MODE_FREE_ONBOARDING=false` (or remove it) in the environment.
2. Redeploy.
3. Confirm the boot log no longer prints the `TEST_MODE_FREE_ONBOARDING is ON` warning.
4. Run the clean-up SQL above if any test accounts need resetting.
