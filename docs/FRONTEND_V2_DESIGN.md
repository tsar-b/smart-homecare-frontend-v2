# Smart HomeCare 2.0 design system

## Product intent

The interface should help a customer complete one job at a time: identify the
appliance, select a service, understand the work, choose a visit time, and
confirm. Decoration is secondary to comprehension and completion.

The design applies the useful principles in the Seagull “Great Design” notes:
clear hierarchy, alignment, proximity, rhythm, negative space, controlled
contrast, consistent visual weight, and a distinct primary action.

## Brand

- Primary wordmark: horizontal blue `SHC`, followed by a light divider and the
  small `SMART HOMECARE` name when space permits.
- Compact wordmark: `SHC` only.
- App icon: blue `SHC` letters on a white field. The operating system supplies
  the final platform mask.
- Do not return to the house/snowflake/thermometer logo in V2 product surfaces.

## Colour and typography

- Canvas: `#F5F7FB`
- Surface: `#FFFFFF`
- Primary blue: `#175CD3`
- Dark blue: `#0B3B8F`
- Primary text: `#101828`
- Secondary text: `#475467`
- Borders: `#D0D5DD` and `#EAECF0`
- Success, warning, and danger colours are semantic; they are not decoration.
- Pretendard is the only application type family. Regular, Medium, SemiBold,
  and Bold are loaded.
- Normal page titles use 28–34 px rather than the previous oversized 44 px
  display treatment.

The authoritative values live in `src/theme/tokens.ts`.

## Icon and illustration roles

The existing AI-generated appliance drawings are not rejected simply because
they were generated. They form a reasonably consistent blue line-art family.
Their prior problem was presentation.

- Use the appliance and air-conditioner subtype artwork only as product
  illustrations inside a stable 70–96 px contained region.
- Preserve each illustration’s aspect ratio with `resizeMode="contain"`.
- Do not stretch tall and wide artwork into equal pixel dimensions.
- Use Ionicons for navigation, status, buttons, search, edit, delete, and other
  functional controls so those controls have consistent stroke weight.
- Blueprints are customer-created production assets, not generic icons. Keep
  them at useful inspection size. When an original is absent, show an explicit
  recovery placeholder instead of crashing Metro or substituting fake art.

## Layout rules

- Content is safe-area aware and constrained to 640 px for tablet/web reuse.
- The standard horizontal inset is 20 px.
- Tap targets are at least 44 px.
- Lists and choice grids wrap responsively instead of using giant horizontal
  carousels.
- A screen should have one visually dominant action.
- Repeated navigation comes from the shared bottom navigation component, not
  hand-built copies in each screen.
- Loading, empty, error, disabled, preview, and success states must be visually
  distinct and must not use invented data.

## Shared components

- `AppScreen`: safe area, width constraint, keyboard and scrolling behaviour.
- `AppHeader`: consistent title and back action.
- `Brand`: text-only V2 wordmark.
- `Button`: primary, secondary, ghost, and destructive actions.
- `Card`: surface and optional elevation.
- `FormField`: label, input, helper, and field error.
- `StateView`: loading, empty, unavailable, and retry states.
- `ProgressSteps`: five-stage reservation progress.
- `StatusBadge`: canonical request-state presentation.
- `CustomerBottomNav` / `AdminBottomNav`: stable role-specific navigation.

## Data and security boundary

- `EXPO_PUBLIC_API_URL` is the only required API-origin configuration.
- It must be an absolute HTTPS origin with no path, credentials, query, or
  fragment. Plain HTTP is accepted only for localhost and emulator loopback
  development.
- Access tokens are stored in SecureStore on native. Web preview uses session
  storage only; a production web deployment should move to an HttpOnly server
  session.
- Screens consume camelCase domain objects. Snake_case database/API fields are
  decoded and validated in `src/api`.
- The backend calculates the final request price.
- Each request carries a stable UUID and `Idempotency-Key`; retries cannot
  silently create a second request.
- Calendar dates are built from local year/month/day values, avoiding the UTC
  date shift caused by `toISOString()` in Korea.
- With no API origin configured, the booking flow uses an explicitly labelled
  design preview built from the existing service/subtype labels and local
  illustrations. Preview tiers are quote-only, time slots are marked as UI
  examples, and the preview route flag blocks submission before any API call.

## Explicit capability gaps

- Guest registration and booking are disabled until phone OTP ownership checks
  and server-side abuse controls exist. The no-API design demo is a separate,
  non-account preview and cannot submit a request. The vulnerable guest client
  route is not exposed by the V2 API wrapper; the backend endpoint must also be
  fixed or disabled before production cutover.
- Customer account deletion is disabled until the backend can transactionally
  delete or anonymize identity, booking, payment, and audit records. The UI does
  not claim that the current single endpoint provides complete erasure.
- Kakao, Apple, and Google sign-in require a V2 OAuth/backend exchange before
  those controls should be activated. The old native Kakao and Apple clients
  are not retained as dead production paths.
- Admin role changes, password changes, and email changes are not exposed by
  the current V2 backend contract. The UI does not call imaginary endpoints.
- The V2 request contract accepts option row IDs but not the selected nested
  choice values. Until the backend stores and prices the chosen values, a
  displayed choice estimate can differ from the server-confirmed price.
- The original manual blueprint files are not present in either checked-out V1
  or V2 repository. Existing blueprint identifiers remain supported, and the
  UI fails visibly and safely until the originals are restored or hosted.
