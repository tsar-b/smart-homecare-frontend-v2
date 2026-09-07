# Smart HomeCare Website v1

A standalone React/Vite website, version 1.0.0, for Smart HomeCare. It translates the legacy white-and-blue Korean service-site brief into a responsive bilingual product and uses the shared SHC V2 Express/Supabase API. The website has its own version; the mobile app and backend remain V2.

## Run locally

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

The website runs at `http://localhost:5173`. The current backend defaults to `http://localhost:5050` and already allows the Vite origin through its default CORS configuration.

## Data modes

- `auto` attempts `/api/app/initialize`, then falls back to labeled preview catalog content.
- `live` requires the backend and exposes errors instead of substituting preview data.
- `preview` makes no backend request.

Preview IDs are never submitted to the booking API. A real booking requires a live catalog plus an authenticated session. Access tokens are kept in memory only; production web session persistence should use a dedicated server-side/HttpOnly-cookie design rather than local storage.

## Current routes

- `/` — service-led landing page
- `/services` and `/services/:serviceSlug` — data-driven service discovery
- `/book` — live-catalog booking and private photo/video attachment flow
- `/about` — product promise and process
- `/support` — FAQ and booking support path
- `/account` — email registration/login bridge to V2 auth

The route and content model reserve clean boundaries for a private booking history, work gallery, shop, payments, technician dispatch, partner inquiries, and administration without exposing empty features in the current navigation.

## Verification

```powershell
npm run typecheck
npm test
npm run build
```

With the development server running, browser QA is also available:

```powershell
npm run qa:smoke
npm run qa:capture
```

The capture script renders Korean desktop/mobile home and booking routes plus the English service page into `.qa/`. It uses the locally installed Chrome executable and reports horizontal overflow, unlabeled empty buttons, console errors, and page errors.
