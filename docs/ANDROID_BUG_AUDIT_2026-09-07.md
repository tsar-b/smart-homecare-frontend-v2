# Android bug audit — 2026-09-07

Smart HomeCare 2.0 was audited after the first Android emulator smoke test. The fixes below are applied locally. They address reproduced failures and concrete source-level defects; this report does not claim that every defect has been found or that production deployment is ready.

No files were deleted. The earlier `outputs/android-app-test/TEST-REPORT.md` remains unchanged as the historical pre-fix report. No app source was pushed during this audit. Source paths below are relative to this frontend repository; test filenames are under `tests/`.

## Fixes applied

### Authentication and network requests

| # | Defect and resulting behavior | Source / evidence |
| --- | --- | --- |
| 1 | Two empty registration passwords previously reached the API layer. Password and confirmation are now required; malformed repeated-`@` emails and values exceeding the backend's name/password limits are rejected locally. | `src/auth/validation.ts`, `src/screens/RegisterScreen.tsx`; `auth-validation.test.cjs`; emulator `audit-05-password-fixed.xml/png` |
| 2 | Keyboard and button events could start overlapping auth requests before the pending UI rendered. An immediate submission lock covers login and registration. Editing registration fields clears stale request/mismatch errors, and Login displays sanitized session-expiry feedback. | `src/auth/submissionLock.ts`, `LoginScreen.tsx`, `RegisterScreen.tsx`; `auth-validation.test.cjs` |
| 3 | A cached customer/admin profile could become active despite missing API configuration. Preview now remains unauthenticated while the saved credentials remain untouched. Replacing a legacy token also drops the previous user's profile and admin state. | `src/context/AuthContext.tsx`; `auth-session.test.cjs` |
| 4 | Delayed login/profile responses could overwrite a newer account or repopulate state after logout. Session generations now reject those stale completions. | `src/context/AuthContext.tsx`; `auth-session.test.cjs` |
| 5 | Slow native session saves could race logout cleanup, or a profile save could overwrite newly refreshed credentials. Storage operations are serialized, activation commits inside that queue, and profile updates read the current credentials when their turn starts. Failed saves do not block later operations. | `src/auth/sessionTaskQueue.ts`, `src/context/AuthContext.tsx`; `auth-session.test.cjs` |
| 6 | A late 401/refresh from account A could affect account B; B could also join A's pending refresh. Requests now verify the active credentials, refresh results verify their starting refresh token, and concurrent refresh coordination is keyed by the request's starting authorization value. | `src/api/http.ts`, `src/api/v2Api.ts`; `http-session.test.cjs` |
| 7 | Transient refresh failures previously cleared usable sessions, and cancelled requests could be replayed. Network/server/rate-limit refresh failures preserve the session; invalid-refresh 401 still clears the matching session; aborted requests stop before replay. | `src/api/http.ts`; `http-session.test.cjs` |

### Booking and catalog

| # | Defect and resulting behavior | Source / evidence |
| --- | --- | --- |
| 8 | Appointment expiry checks used the device timezone and missed previous days. Booking-day and time comparisons now use Asia/Seoul, reject invalid/past slots, refresh visible expiry state, and recheck availability immediately before submission. | `src/utils/bookingTime.ts`, `src/screens/BookingConfirm.tsx`; `booking-time.test.cjs` |
| 9 | Dismissing the Android calendar could replace the date and clear a selected time. Only an accepted, changed calendar day updates the booking date. In native preview, September 7 and 09:00 remained selected after opening the picker, tapping September 8, and pressing Cancel. | `src/screens/BookingConfirm.tsx`; post-fix emulator `audit-18-time-selected.xml`, `audit-19-calendar.xml`, `audit-20-calendar-cancel-fixed.xml/png` |
| 10 | Rapid submission events could enter creation twice, and leaving during processing could interrupt the operation without a clear result. An immediate submit guard and temporary navigation guard cover active processing; an already-created booking keeps its media-retry path. Consultation quotes are displayed as consultation pricing rather than negative won. | `src/screens/BookingConfirm.tsx`; `booking-time.test.cjs`; local HTTP fixture verified idempotent creation/retry, not native navigation during a live upload |
| 11 | Live service/subtype pairs without a canonical pricing ID were turned into synthetic tiers that could never submit. They are now excluded, real consultation tiers preserve their IDs, and selection accepts the canonical service ID as well as its name/label. | `src/screens/BookingSubtypeSelect.tsx`; `catalog-bookability.test.cjs` |
| 12 | Header Back reset the service/product stack and could discard the route back to Home. Existing history is now preserved, with a replacement fallback only when no back route exists. Catalog retry responses also use request ownership so a superseded read cannot overwrite the latest selection. | `BookingServiceSelect.tsx`, `BookingSubtypeSelect.tsx`, `src/utils/latestRequest.ts`; emulator `audit-10-header-back.xml` → `audit-11-back-home.xml/png`; request-ownership tests |

### Media

| # | Defect and resulting behavior | Source / evidence |
| --- | --- | --- |
| 13 | A broad photo-library permission check blocked the system picker unnecessarily. The picker now uses the system's selected-asset access and ignores rapid duplicate launch events. | `src/components/BookingMediaPicker.tsx`; `media-components.test.cjs` with native picker mocks |
| 14 | Image normalization changed URIs and defeated duplicate detection; delayed selection could overwrite newer parent state or update an unmounted booking. Selection tracks original asset identity, merges current state, and stops after unmount or a change to disabled/preview state. | `src/components/BookingMediaPicker.tsx`; `media-components.test.cjs` |
| 15 | Stale picker size metadata could disagree with uploaded bytes or bypass limits. Native preparation stats the actual file; invalid sizes fail closed, changed/evicted files require reselection before transfer, and private device-path errors are replaced with user-facing messages. | `src/media/prepareMedia.ts`, `src/media/uploadBookingAttachment.ts`; `media-preparation.test.cjs`, `media-upload.test.cjs` |
| 16 | Native cancellation could wait forever for an upload promise and cleanup rejection could escape. Cancellation now settles the caller immediately. Completion recovery can finish an accepted transfer without uploading bytes again, including when the cached file has been evicted. | `src/media/uploadBookingAttachment.ts`; `media-upload.test.cjs` |
| 17 | Closing a viewer could retain its video player; failed/expired images could leave a blank view. Closed content unmounts, video listeners are released, and loading/error feedback is visible. Booking-detail reuse resets local selections and aborts old viewer/upload work so files are not carried into another booking. | `BookingMediaViewer.tsx`, `BookingMediaGallery.tsx`, `BookingDetailScreen.tsx`; `media-components.test.cjs`; detail lifecycle changes also reviewed in source |

### Profile and administration

| # | Defect and resulting behavior | Source / evidence |
| --- | --- | --- |
| 18 | A slower history/admin read could overwrite a newer refresh or clear its loading indicator after navigation. Request ownership and cancellation now guard history, dashboard, users, admin bookings, and admin profile reads, including pagination. | `src/utils/latestRequest.ts`, `HistoryScreen.tsx`, `src/screens/admin/*`; `android-screen-state.test.cjs` exercises the production request-ownership utility |
| 19 | Changing an address could retain an apartment/detail string from the previous selection; blank admin detail could be omitted from the update. Search/selection clears stale detail, and the admin address patch explicitly sends an empty detail when appropriate. | `AddressSearchScreen.tsx`, `src/screens/admin/adminInput.ts`, `AdminSettings.tsx`; `android-screen-state.test.cjs`; local fixture clear-detail check |
| 20 | Profile edits could overlap or be overwritten by stale reads, and customer edits left shared booking defaults stale. Editing/saving controls now guard active operations; customer saves refresh the shared profile; admin saves invalidate older reads. | `SettingsScreen.tsx`, `AdminSettings.tsx`; source review and related request/session tests; local fixture profile-update check |
| 21 | Admin quote parsing silently truncated malformed values such as decimals or partial numbers. It now accepts only whole, safe, non-negative amounts or a blank unchanged quote. Clipboard/logout failures also receive handled feedback. | `src/screens/admin/adminInput.ts`, `AdminBookingList.tsx`, `AdminSettings.tsx`; `android-screen-state.test.cjs` covers strict amount parsing |

### Startup

| # | Defect and resulting behavior | Source / evidence |
| --- | --- | --- |
| 22 | A font-load failure left the app indefinitely on its loading indicator. Startup now shows a readable failure message with restart guidance. | `App.tsx`; source review and TypeScript check; font failure was not injected on the emulator |

The rows group related changes; they are not a count of independently proven production incidents. Automated helper tests, simulated native-module tests, direct HTTP integration, and actual emulator interactions provide different levels of evidence.

## Verification

- **55/55 automated tests passed**, with **zero TypeScript diagnostics**, as reported by the final aggregate run in this audit session. Tests use the production TypeScript with explicit mocks where native modules are involved. No additional test-runtime dependency was installed.
- The app CI job now runs `npm test` after the existing typecheck. This is a local workflow change; no new GitHub CI result is claimed because source was not pushed.
- **12 local HTTP fixture checks passed:** login, profile, catalog, availability, consultation-quote creation, idempotent retry, history, booking detail, empty attachments, clearing address detail, cancellation, and logout. The fixture recorded **two creation attempts, one booking created, and one replay**. These checks exercised the client against a local test server, not Supabase.
- **Post-fix Android runtime:** `audit-05-password-fixed.xml/png` shows both required-password errors. `audit-10-header-back.xml` followed by `audit-11-back-home.xml/png` confirms that header Back retains the route to Home. The native preview calendar regression also passed: `audit-18-time-selected.xml` records September 7 with 09:00 selected; after opening the picker (`audit-19-calendar.xml`), tapping September 8, and pressing Cancel, `audit-20-calendar-cancel-fixed.xml/png` still records September 7 and 09:00 with `checked=true`. These are actual emulator observations, without live availability or booking submission.
- **Final Android/Hermes export passed after all source changes**, writing `.qa/android-audit-final-20260907`: 1,047 modules, 50 assets, and 52 generated files. The Hermes bytecode file is `index-b8a087386f08cf7df612c7610bc7c618.hbc`, 3,397,422 bytes, SHA-256 `B0516E080A8CC192DEBCC2CABCCEF7D9D0462351268E21915E87A19D836E87DD`. Source did not change after this export and the 55-test run.
- The existing native development APK ran the patched Metro JavaScript with unchanged native configuration. **A fresh native APK/Gradle build of the final audit revision was not verified** because of execution restrictions. The successful Hermes export is JavaScript/asset build evidence, not a new native APK build.
- Final `adb` crash-buffer and `ReactNativeJS:E` / `AndroidRuntime:E` checks were empty. This observation applies to the bounded emulator session and does not establish long-duration stability.
- A separate Metro instance for native testing against the fixture was blocked by execution policy. Therefore the local HTTP fixture pass is **not** a connected native end-to-end pass.

The emulator evidence is stored locally under `C:\Users\ALLAN\Documents\Codex\2026-08-26\che\outputs\android-app-test` and is separate from this repository's source. The pre-fix native build/test report remains preserved there.

## Remaining verification

Live Supabase connectivity and production policies, email/social OAuth, real photo/video selection and transfers, full staging booking flows, long-running/background behavior, physical-device testing, iOS compilation/runtime, and final native release packaging remain unverified. Media tests used mocked native transports, pickers, files, and players; they do not establish actual device upload or codec behavior.

This audit improves the tested paths and adds regression coverage. Its results should be used with the stated limits when deciding the next staging or release test.
