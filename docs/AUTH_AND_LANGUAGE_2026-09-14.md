# English mode and Supabase authentication - implementation checkpoint

## Implemented locally

- Persistent Korean / English control in the shared app shell; no navigation
  reset when changing language. Original assets, service availability states,
  canonical catalog identifiers and booking behavior remain in place.
- English resources wired into the customer login, registration, booking,
  history, account, address-search and media interfaces, plus shared UI controls.
- Kakao, Apple and Google browser authentication through the backend's new
  Supabase PKCE endpoints, using the existing authoritative AuthContext session.
- Password-recovery request, same-device callback, new-password form and return
  to sign-in. Passwords and tokens are never placed in redirect URLs.
- Reusable currency formatter; catalog prices remain actual KRW amounts. English
  formatting does not turn KRW 40,000 into USD 40,000. The formatter accepts a
  currency code only for amounts already denominated in that currency. No FX
  service, converted price cache or multi-currency checkout has been added.

## Evidence

- Frontend TypeScript check passed; 66 automated tests passed.
- Expo exports succeeded for web, Android and iOS (JavaScript/Hermes bundles,
  not signed native binaries). Local compiled-interface QA confirmed Korean and
  English login text, recovery form display, saved language after reload, and
  preservation of a typed dummy email when switching language.
- Recovery layout was inspected at narrow-phone and tablet widths; this is web
  rendering evidence, not a new native Android/iOS login or reset test.
- All three providers are disabled in the current live Supabase Auth settings.
  Provider buttons therefore remain unavailable until the backend opt-in and
  Supabase credentials/settings are configured. Email is enabled.
- No real provider authorization, recovery email, password change, shared DB
  migration, Git commit, push or deployment was performed in this run.

## Required before launch

1. Complete the provider/redirect/SMTP setup and migration 008 described in the
   backend's `docs/SUPABASE_BROWSER_AUTH_SETUP.md`.
2. Rebuild native clients for the added Expo browser module and test the new
   flows on Android and iOS. Prior Mac/device success is a baseline, not proof of
   these newly added authentication flows.
3. Finish the localization audit: administrator-specific screens, remaining
   interpolated media-result messages and dynamic catalog labels still need a
   complete English pass. Unknown user-authored/catalog content intentionally
   falls back to the original; do not describe this checkpoint as 100% translated.
4. Verify live booking selections, calendar focus, text-entry retention,
   attachment errors and accessibility with both locales in native builds.
5. Review dependency audit findings separately; installing Expo-compatible
   modules reported 40 vulnerabilities. No forced dependency upgrade was used.

## Safe to defer

- Real FX conversion / USD quoting until a client needs it. Keep the actual KRW
  values and explain that deployment-specific currency can be configured later.
- Translating customer-entered names, addresses and symptoms. Preserve these
  verbatim; do not treat private content as localization resources.
- Retiring legacy login endpoints until existing social identity ownership has
  been reconciled and V1 compatibility is no longer needed.
