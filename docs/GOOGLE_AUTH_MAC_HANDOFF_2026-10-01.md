# Google login on Mac - October 1, 2026

The shared Supabase project now has Google configured and migration 008 applied.
Kakao and Apple remain disabled. This handoff prepares an iOS development test;
it is not evidence of a completed iOS Google login or an App Store release.

Pull both repositories' `main` branches, preserving any Mac changes:

- This frontend: `smart-homecare-frontend-v2`
- [Backend and current setup](https://github.com/tsar-b/smart-homecare-backend-v2/blob/main/docs/GOOGLE_AUTH_MAC_HANDOFF_2026-10-01.md)

The backend setup/code checkpoint is commit `969a95b`. Pull that commit or a
later compatible `main` revision; the older September checkout lacks this flow.

Use `git pull --ff-only`. If it cannot fast-forward, inspect the divergence or
make a separate clone; do not reset/delete a working checkout.

## Start the backend first

Use Node.js 22 or newer. Preserve the backend's existing private Supabase `.env`
settings and add:

```dotenv
SUPABASE_OAUTH_PROVIDERS=google
AUTH_REDIRECT_URLS=smarthomecareapplication://auth/callback
```

Run `npm ci`, `npm run build`, `npm test`, then `npm run dev` in the backend.
`GET /ready` must pass. `GET /api/auth/browser/config` must include `google`.
Do not repeat the shared database migrations just to set up this Mac checkout.

## Rebuild the iOS development app

1. Run `npm ci` in the frontend using Node.js 22 or newer.
2. Preserve/create `.env.local` and set the API origin. For the iOS simulator
   with the backend running on the same Mac:

   ```dotenv
   EXPO_PUBLIC_API_URL=http://localhost:5050
   ```

   A physical iPhone needs a reachable API origin; its localhost is the phone,
   not your Mac. Restart Metro after changing environment configuration.
3. With Xcode and native build tooling installed, run `npm run ios`.
   **A new native build is required**, not just reloading JavaScript, because
   `expo-web-browser` and its native config plugin were added.
4. Open the login screen. Google should be visible; Kakao and Apple should not
   be offered while their backend/Supabase providers are disabled.

Google currently uses Supabase's browser-based OAuth flow with PKCE. No native
Google SDK is installed, and a separate Google iOS client is not required for
this implemented flow. The return URI is
`smarthomecareapplication://auth/callback`.

Do not put Google client secrets, Supabase secret/service-role keys, or the
private credential notebook in frontend environment files or Git. Google
provider credentials already live in the shared Supabase configuration.

## Acceptance checklist

- Email/password login still reaches the signed-in app and survives relaunch.
- Google opens its actual account/consent page, then returns to SHC signed in.
- A profile is resolved/created and the session survives a full app restart.
- Sign-out followed by another Google login works without changing ownership.
- Closing the browser, denying consent, or returning after an expired flow
  produces a safe recoverable message, not a stuck spinner or partial session.
- Warm and cold app returns both work; repeated callbacks do not duplicate work.
- Member-only booking still asks for required profile data before submission.
  Do not submit a real appointment merely to validate login.
- Korean/English switching works. The included language mode is not a claim of
  complete translation of every dynamic or administrator-provided string.

Windows verification included 84 frontend tests/typecheck, 82 backend tests/build,
live standard login/profile/refresh, Google authorization start, and a simulated
denial returning to the native callback with state intact. The actual denial URL
passed the frontend parser as `AUTH_PROVIDER_CANCELLED`, including Supabase's
matching query/fragment error fields and empty `sb` marker. Duplicate callback
and session-race regressions passed. This did not include a real Google account
sign-in, native iOS callback execution, or release signing.

The final iOS JavaScript/Hermes export also passed with 1,047 modules and 49
assets. The 3,452,450-byte bundle has SHA-256
`A9C230D6CFBFFD0A42E23825D7A76F1B67F605A836C06B2F9C9A6E0BBEAFEC5F`.
This validates bundling for iOS, not an Xcode build or execution on an iPhone.

The backend handoff records the existing leaked-password-protection warning.
No test records or media were deleted. Earlier September handoffs remain
historical evidence; use this document for the current Google setup.
