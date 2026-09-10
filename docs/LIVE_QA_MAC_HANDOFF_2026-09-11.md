# Live Android QA and Mac handoff

Updated September 11, 2026. This is a development-test handoff, not a production
release approval. Pull both repositories' `main` branches: this frontend and
[the SHC backend](https://github.com/tsar-b/smart-homecare-backend-v2).
Keep any existing Mac changes; use a fast-forward-only pull or a separate clone
instead of resetting or overwriting a modified checkout.

## Included fixes and evidence

The booking calendar now keeps a stable native change callback across the
30-second clock tick. History's native calendar also keeps its callback stable
across unrelated loading updates and ignores dismissal events. Five focused
regression tests cover these handlers, including mocked iOS spinner behavior.
The native Android booking calendar retained and confirmed a selected date after
approximately 59 seconds in the September 9 test.

On September 9, the Android development client reached the real Express backend
and Supabase for email login, booking creation, and history persistence. Using
approved small test files, it selected and uploaded one image and one video,
reopened both after force-stop/relaunch, and played actual video frames through
the four-second clip again. Both attachment records were `ready`.

Independent readback verified a 101,986-byte JPEG and a 439,117-byte MP4 whose
SHA-256 matched the source video. Public object access and direct authenticated
table/Storage reads were denied; backend-authorized app access succeeded. These
were scoped checks, not a full security audit. The Android crash buffer was empty
at the final check.

On September 11, `npm test` passed all **60 tests** and `npm run typecheck`
passed again before publishing this handoff. Native Android was not rerun on
September 11. Unit tests with mocked native hosts are not iOS runtime proof.

No credentials, signed URLs, private QA account details, screenshots, test media,
or laptop-specific environment files are included in this handoff.

## Backend first

Use Node.js 22 or newer. In the backend checkout, follow its
[matching handoff](https://github.com/tsar-b/smart-homecare-backend-v2/blob/main/docs/LIVE_QA_MAC_HANDOFF_2026-09-11.md)
to configure a private `.env`, install dependencies and start the API.

The shared Supabase project's migration 007 and two private media buckets were
provisioned on September 9. A fresh code clone is not a reason to reapply them.
Verify the selected project and `/ready` before changing infrastructure. A new,
different Supabase project requires its own migrations, catalog and Storage setup.

## Run the iOS development app on the Mac

1. Install the frontend dependencies with `npm ci`.
2. Create `.env.local` from `.env.example` only if it does not already exist;
   otherwise edit the existing file without overwriting unrelated settings.
3. Set `EXPO_PUBLIC_API_URL` to the running backend's origin. For an iOS simulator
   with the backend on the same Mac, use `http://localhost:5050`. A physical phone
   needs a reachable API address; its `localhost` is the phone, not the Mac.
4. With Xcode and the required native build tooling installed, run `npm run ios`.
   This uses `expo run:ios`; it is a development build, not an App Store release.

Use these settings only for the trusted private video test:

```dotenv
# Frontend .env.local
EXPO_PUBLIC_BOOKING_MEDIA_PILOT_UPLOADS=true
```

```dotenv
# Backend .env
ENABLE_BOOKING_MEDIA_PILOT_UPLOADS=true
```

Both flags default to false. Restart the API and Metro after changing them.
Never put a Supabase secret/service-role key, Management token or database
password in `EXPO_PUBLIC_*`, `VITE_*`, client source, or Git.

For a read-only connection check from the frontend folder on the Mac:

```bash
EXPO_PUBLIC_API_URL=http://localhost:5050 npm run check:backend
```

This script reads the shell environment; unlike Expo, it does not automatically
load `.env.local`. Adjust the address to the actual API. A passing connection
check does not replace native login, booking or media tests.

## Optional React website V1

The website is a separate package in `website-v1`. Run `npm ci` there, preserve or
create its own `.env.local`, and set:

```dotenv
VITE_API_BASE_URL=http://localhost:5050
VITE_API_MODE=live
```

Run `npm run dev` in that folder. Match the browser origin in the backend's
`CORS_ORIGINS`. The default auto/preview fallback must not be mistaken for a live
database connection. Android media success does not certify the website's media
flow; test the website separately if it is part of the Mac handoff.

## What to test next, and what to preserve

- On iOS: confirmed email login, session restoration, booking date selection,
  booking/history persistence, native photo/video selection, upload, image
  display and video playback after restarting the app.
- The September 9 files were small signed-PUT uploads. Large/resumable TUS,
  cross-user authorization, token/link expiry, quotas/load, malformed files,
  destructive lifecycles, and standalone release builds remain separate checks.
- Keep video pilot flags off for public builds until the remaining release
  work is approved and verified.
- Existing QA records are labelled **DO NOT DISPATCH**. They are not paid
  appointments. Preserve records and uploaded files; no cleanup or deletion is
  authorized by this handoff. Use only approved test media, not customer data.
- Do not blindly run the backend's live smoke, database-border verifier or
  reconciler: those tools can write/delete test rows or Storage objects. Review
  their effects and obtain deletion approval first. Normal `npm test` is separate.
- The laptop's test services were stopped after the September 9 run. GitHub
  contains source code, not a running backend or the private environment setup.
