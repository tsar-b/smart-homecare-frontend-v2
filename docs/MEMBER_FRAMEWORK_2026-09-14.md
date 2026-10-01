# Member framework - local implementation

This pass continues the existing email/member app while external social-provider
credentials are being located. It does not enable guest registration or require
Kakao, Apple or Google to be configured before using ordinary email membership.

## Behavior

- New V2 bookings require an authenticated member profile, not a cached profile
  without a token. Both historical guest markers (`isGuest` and `provider=guest`)
  are rejected. The backend independently checks its authenticated profile.
- The app requires the existing booking-name prerequisite and links to account
  settings when it is missing. This pass does not introduce new mandatory phone
  or address rules. Those values remain editable using the existing settings.
- Existing booking history, detail, attachment and cancellation authorization
  are unchanged. No old guest records, media or files are removed.
- Settings address saves refresh the shared profile used by subsequent bookings,
  matching the existing name/phone behavior. A profile-read failure does not
  trigger a duplicate address update.
- Provider configuration has separate loading/error/retry state. Email sign-in
  remains independent. Recovery is offered only when the API advertises it.
- A late recovery-request response cannot reopen its modal after another sign-in.
  A successful password update is not reported as a failed update merely because
  local pending-link cleanup failed. Recovery never logs in an app session.
- Account headings, provider labels, empty values and email-confirmation notices
  follow the selected language. User-entered names, phone numbers and addresses
  remain verbatim. Assets and actual KRW prices are unchanged.

## Verification and outstanding work

- Frontend typecheck and 72 automated tests passed; backend build and 71 tests
  passed. The updated web export succeeded.
- Compiled web UI: verified provider-check retry while email registration remains
  available, disabled recovery while the backend is unavailable, empty-form
  registration validation without account submission, and English/Korean error
  switching. Inspected registration at 360, 768 and 1280 pixel widths.
- No native device, real email delivery or live booking write was exercised in
  this pass. Existing QA accounts/bookings/media were not changed.

Automated framework tests exercise actual provider handlers with mocked native
hosts, storage and HTTP: configuration failure/retry, late response after sign-in,
and recovery callback through password update without social login. Pure tests
cover the member eligibility states; backend tests cover its independent guard.
These are not live email-delivery or native-device evidence.

Required before launch: configure social providers when credentials are available,
review/apply migration 008, test real recovery email delivery and fresh Android/iOS
auth builds, and finish the remaining administrator/dynamic-message localization.
No live provider settings, shared database migration, commit, push or deployment
is part of this pass.

Safe to defer: guest onboarding/phone OTP, FX conversion and replacing old assets.
