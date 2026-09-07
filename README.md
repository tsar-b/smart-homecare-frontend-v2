# Smart HomeCare 2.0 frontend

The V2 client is an Expo/React Native application for iOS and Android, with a
browser build for portfolio and interface review. Its
visual system is deliberately restrained: an off-white canvas, white content
surfaces, a single blue brand/action color, compact typography, and one primary
action per screen.

## React website

The standalone React/Vite website is versioned as
[Smart HomeCare Website v1](website-v1/README.md), with its own package and build
commands. Both clients use the same SHC V2 Express/Supabase API.

```powershell
cd website-v1
npm ci
npm run dev
```

The website uses `http://localhost:5050` for the SHC API by default. Copy its
`.env.example` to `.env.local` and set `VITE_API_MODE=live` to require the real
API. Its default preview fallback cannot submit real bookings.

## Run the interface preview

The app can open without credentials or an API environment file. From the
login screen, select **디자인 데모 화면 보기** to review the customer
flow. Preview availability data is clearly labelled and cannot submit a real
request.

```powershell
npm install
npm run start
# or open the browser showcase
npm run web
```

## Connect the V2 backend

Copy `.env.example` to `.env.local` and set `EXPO_PUBLIC_API_URL` to the
backend origin. An exact `/api` suffix is accepted and normalized, so both
forms below are equivalent. This value is public application configuration,
not a Supabase service-role key or database password.

```text
EXPO_PUBLIC_API_URL=https://api.example.com
# Equivalent: https://api.example.com/api
EXPO_PUBLIC_API_TIMEOUT_MS=15000
# Match the backend pilot flag. Leave false for a public build.
EXPO_PUBLIC_BOOKING_MEDIA_PILOT_UPLOADS=false
```

The public build presents photo attachment only. To test video and resumable
uploads in a trusted closed pilot, set this frontend flag and the backend's
`ENABLE_BOOKING_MEDIA_PILOT_UPLOADS` to `true`; the backend remains the
authorization boundary if the two build/deployment settings ever differ.

All screens use the typed boundary under `src/api` and camelCase models under
`src/domain`. Supabase/PostgreSQL wire names are decoded once at that boundary.

## Verification

```powershell
npm run typecheck
npm run check:backend
npm run build:android-bundle
npm run build:web-preview
```

The Expo browser build demonstrates the responsive product interface. It is
not a replacement for a separate SEO-oriented marketing/lead-generation site.

The brand PNGs in `asset/brand` are generated from Pretendard by
`scripts/generate_brand_assets.py`, keeping the simple SHC wordmark
reproducible.

See `docs/FRONTEND_V2_DESIGN.md` for design rules, component roles, and known
backend capability gaps. See `docs/BACKEND_CONNECTION.md` for the verified
Mac-backend commit, live read-only results, authentication state, and remaining
production-cutover limits.
