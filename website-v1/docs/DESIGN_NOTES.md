# Smart HomeCare website design notes

## Source interpretation

The build uses two local references for different purposes:

- `D:\Projects\Info\SHC-Website` is a flattened visual and feature brief. Its screenshots point to a Korean home-service company site with obvious categories, booking/quote access, company credibility, contact, and a possible future product shop. It contains no reusable website source.
- `D:\Projects\Seagull` supplies purpose-first interface principles: one dominant path, hierarchy through spacing and alignment, restrained color, purposeful imagery, consistent icons, and clear separation between content and controls. Its old `menu.html`, commerce/crypto synopsis, and Seagull logo are not SHC implementation sources.

No competitor logos, photographs, telephone numbers, bank details, product claims, customer records, reviews, or performance figures were copied.

## What the React design preserves

- White and blue Korean home-service identity.
- A strong service-company proposition instead of an abstract SaaS message.
- Air conditioner, washing machine, refrigerator, and TV discovery.
- Immediate movement from service discovery into a booking request.
- Company/process reassurance and a clear customer-support surface.
- A bilingual Korean/English component tree for Korean and western-client demonstrations.
- A clean boundary for a later shop, work gallery, partner route, and private account features.

## What the React design deliberately replaces

- Fixed desktop widths and tiny typography.
- Alert popups, side utility rails, and giant accidental whitespace.
- Public customer-name/reservation tables.
- Prominent bank-transfer details on the home page.
- Mixed clip-art icon styles and competitor assets.
- Fabricated testimonials, statistics, certifications, response-time promises, prices, and contact details.
- Several equal calls to action competing in the same region.

## Primary user path

```text
Home or service detail
  -> choose service
  -> describe product/symptom
  -> optionally attach private photo/video
  -> choose a live requestable time
  -> authenticate
  -> submit one idempotent booking request
  -> upload media against the created booking
  -> show requested state, not false confirmation
```

## Expansion boundaries

The public navigation exposes only usable routes. Future capability belongs behind these boundaries:

| Capability | Intended boundary |
|---|---|
| Booking history and cancellation | authenticated account route using `/api/bookings/history` |
| Work evidence and before/after gallery | approved media/content module, separate from private booking attachments |
| Product store | `/shop` domain and commerce API, separate from service bookings |
| Payments and deposits | booking/payment state machine; never a static bank-detail block |
| Technician dispatch | operations/admin surface with role checks |
| Reviews | verified booking-linked review model |
| Partners/franchise | feature-gated `/partners` route after business approval |
| CMS content | Supabase-backed content through an approved API/content boundary |

## Production dependencies still required

- Verified legal name, registration details, service region, hours, contact channels, and policies.
- Approved privacy/consent text plus server-side consent-version records.
- A production web-session approach, preferably same-origin HttpOnly cookies or a BFF.
- Live end-to-end checks for catalog relationships, registration confirmation, slot contention, booking submission, and attachment uploads.
- `ENABLE_BOOKING_MEDIA_PILOT_UPLOADS=true` only after the backend storage pilot is intentionally enabled and verified for video/TUS traffic.
- Real owned or licensed technician/work imagery if visual case studies are added.
