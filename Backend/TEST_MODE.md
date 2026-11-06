# Free onboarding for testing

One switch lets testers walk the full applicant journey without spending money
on NIN lookups or a real Paystack charge.

**Turn it on or off from the app:** Admin → Application fees → **Testing mode**.
No redeploy needed; the change applies within ~15 seconds. It starts **ON** so
the team can test end to end.

The old environment variable still works and **forces** it on:

```
TEST_MODE_FREE_ONBOARDING=true
```

While that variable is set, the admin toggle cannot switch it off — remove the
variable to control it from the app.

Nothing was removed from the codebase to make this work. The live NIN lookup
and the live Paystack checkout are untouched; each asks the switch once, at the
top, and returns early when it is on.

## What changes while it is on

| Step | Normally | With the switch on |
|------|----------|--------------------|
| `POST /profile/verify-nin` | Dojah NIN lookup | The 11-digit NIN is accepted without the lookup. No biodata is invented — the fields Dojah would have supplied stay empty. |
| One NIN per account | A NIN already used by another account is refused | Testers may reuse the same demo NIN across accounts. |
| `POST /payments/session/initialize` | Redirect to Paystack | The payment row settles immediately and the applicant is sent to the normal `/payment/callback` screen. |

Everything else runs exactly as it does in production: JAMB and O'Level checks
(against the records in Admin → Mock data), eligibility, applications and
admissions. The same rows are written, the same session statuses are set
(`pending_payment → paid`), the same emails go out, and the same screens appear.

The applicant's checkout shows a "Test mode — no money will be taken" notice and
the button reads **Continue** instead of **Proceed to Payment**.

## Testing the whole applicant flow

1. Admin → Mock data → **JAMB**: add a record with the applicant's JAMB number,
   score, state, and their institution + course choices (picked from the
   institutions and departments that exist on TruEntry).
2. Admin → Mock data → **O-Level**: add the result for the O'Level number the
   applicant will enter.
3. The applicant onboards with any 11-digit NIN, enters those two numbers, and
   continues through the free checkout. After verification their choices appear
   and they can apply.

## Telling test data apart afterwards

Records created while the switch was on are tagged, so they can be found and
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

- `src/services/testMode.service.js` — the switch itself (the only place that decides)
- `src/services/nin.service.js` — `validateNin()` returns early instead of calling Dojah
- `src/modules/profile/profile.service.js` — `verifyNin()` skips the one-NIN-per-account rule
- `src/modules/payments/payment.service.js` — `initializeSession()` settles without Paystack
- `src/modules/sessions/session.service.js` — `quote()` tells the checkout to show the notice
- `migrations/0009_app_settings.sql` — the settings table (also created automatically on first use)

## Going live again

1. Admin → Application fees → Testing mode → **Turn off**.
2. If `TEST_MODE_FREE_ONBOARDING` is set in the environment, remove it and redeploy.
3. Run the clean-up SQL above if any test accounts need resetting.
