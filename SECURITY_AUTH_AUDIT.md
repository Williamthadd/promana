# ProMana Authentication Security Audit

Date: 2026-10-03. Scope: login/registration/session/OAuth/Drive token/audit
logging/Firestore authorization/offline auth. Method: repository inspection +
static regression tests. No live Firebase Console access; console-side claims
are marked REQUIRES-CONFIG and verified only by code/tests where possible.

## 1. Architecture (as found)

- `src/firebase.js`: `initializeApp` with `VITE_*` public web config,
  `getAuth(app)` (implicit local persistence), Firestore with
  `persistentLocalCache + persistentMultipleTabManager` (offline cache).
- `src/pages/LoginPage.jsx`: single component for login + signup
  (`authMode`), plus Google `signInWithPopup` with full Drive scope. No
  password reset, no email verification, no redirect fallback, no MFA handling.
- `src/hooks/useAuth.js`: `onAuthStateChanged` -> `{user, loading}`.
- `src/components/ProtectedRoute.jsx`: UX-only gate (`user != null`),
  spinner while loading. Real authorization is Firestore rules (correct).
- `src/utils/googleDriveAuth.js`: Drive OAuth access token in
  `sessionStorage` key `promana-google-drive-token:{uid}`, cleared on logout
  (`clearAllGoogleDriveAccessTokens`) and account switch. Good.
- `src/utils/ipFetcher.js`: `GET https://api.ipify.org?format=json` during
  every auth attempt. Third-party dependency inside sign-in; value then sent
  as `ipAddress` to both Firestore and `/api/log-auth-error`.
- `api/log-auth-error.js`: server derives IP from `x-forwarded-for`/socket
  and ignores client `ipAddress` (good), rate-limits 30/min/IP, sanitizes
  fields, logs to console. No ID-token verification (no Admin SDK).
- Client also writes `users/{uid}/loginLogs/{logId}` directly with
  client-chosen `method/success/userAgent/ipAddress` + `Timestamp.now()`.
  Per-UID isolated and append-only per `firestore.rules` (good), but content
  is self-asserted by the authenticated client — non-authoritative.
- `api/drive-files.js`: verifies Firebase ID token via
  `identitytoolkit accounts:lookup`, rejects disabled accounts, REQUIRES
  `emailVerified` for Drive, binds Drive token email to Firebase email, binds
  files via `appProperties {promanUserId, promanDocumentId}`. Strongest part
  of the codebase.
- `vercel.json` CSP (as found): `script-src 'self'`,
  `connect-src 'self' https://*.googleapis.com ...` WITHOUT
  `*.firebaseapp.com` or `accounts.google.com`,
  `frame-src https://drive.google.com` only, plus `api.ipify.org` allowlisted.
  `Cross-Origin-Opener-Policy: same-origin-allow-popups` (correct for popup).

## 2. Google `auth/internal-error` diagnosis

`auth/internal-error` from `signInWithPopup` is the SDK's generic wrapper for
"the OAuth handshake failed before Firebase could mint a session". Plausible
causes ranked for this repo:

1. **OAuth consent / sensitive scope friction (likely contributor).** The app
   requests full `https://www.googleapis.com/auth/drive` at sign-in time.
   Full Drive is a restricted scope; unverified/changed consent configuration
   surfaces inside the popup and Firebase collapses it to `internal-error`.
2. **Production CSP blocking the handshake (likely contributor in prod).**
   `connect-src` lacked `https://*.firebaseapp.com` (auth handler domain
   `proman-f3b9c.firebaseapp.com`) and `https://accounts.google.com`;
   `frame-src` allowed only `drive.google.com`. Local `vite dev` has no such
   CSP, so the bug reproduces primarily on the deployed domain.
3. **Firebase Console mismatch:** unauthorized domain, Google provider
   disabled, or API-key HTTP/API restrictions blocking Identity Toolkit.
   These usually map to `unauthorized-domain` / `operation-not-allowed`, but
   key-restriction failures present as `internal-error`.
4. **Browser posture:** third-party-cookie blocking, popup blockers, in-app
   webviews. These abort the popup and also surface as `internal-error` /
   `popup-closed` / `popup-blocked` depending on timing.

Fixes applied (code): CSP now allows `*.firebaseapp.com`,
`accounts.google.com`, `oauth2.googleapis.com`, `www.googleapis.com` for
`connect-src` and `accounts.google.com + *.firebaseapp.com` for `frame-src`;
removed `api.ipify.org`; popup failures now surface a redirect fallback
(`signInWithRedirect` + `getRedirectResult`); `internal-error` /
`unauthorized-domain` / `operation-not-allowed` map to a generic UI message
with console diagnostics (origin, authDomain, projectId — no secrets).
REQUIRES-CONFIG items are listed in
`FIREBASE_AUTH_SECURITY_CONFIGURATION.md`.

## 3. Findings

### Critical

- **C1 — Production CSP broke Google/Firebase Auth.** `connect-src`/`frame-src`
  omitted the auth handler + Google OAuth origins. File: `vercel.json`.
  Fixed in code; redeploy required.

### High

- **H1 — Account enumeration via distinct error messages.** Login
  distinguished `user-not-found` vs `wrong-password` vs `invalid-credential`;
  signup confirmed `email-already-in-use`. File: `LoginPage.jsx`. Fixed:
  generic `Unable to sign in with those credentials.` for all login failures;
  generic signup/reset responses.
- **H2 — No email verification lifecycle.** Accounts were created and given
  full access with zero verification; no resend/refresh/reset. Drive API
  already required verified email, but Firestore did not. Fixed (soft):
  verification sent on signup, unverified-password-user banner with
  resend (60s cooldown) + refresh, password-reset flow with generic response.
  Hard Firestore `email_verified` enforcement left as opt-in config because it
  would lock out existing unverified sessions — documented.
- **H3 — Client-asserted audit log + third-party IP in sign-in path.**
  `fetchIpAddress()` added latency, a third-party dependency, PII collection,
  and a forgeable `ipAddress` field. Fixed: ipify removed from auth flow
  (stubbed file), client logs omit `ipAddress`, server remains the IP
  authority; client `loginLogs` documented as non-authoritative.
- **H4 — No brute-force/throttling story for Firebase Auth.** The 30/min
  `/api/log-auth-error` limit was log-endpoint abuse control, not sign-in
  protection. No client counter was added (bypassable; lockout-oracle risk).
  Mitigation is Firebase-side (enumeration protection, password policy, App
  Check, quotas) — REQUIRES-CONFIG, documented. Client adds deterministic
  in-flight guard + generic `too-many-requests` message.

### Medium

- **M1 — Raw email passed to SDK; password kept in state.** Leading/trailing
  spaces caused avoidable failures; password lingered after attempts. Fixed:
  `normalizeEmail` (trim) + plausibility check, password cleared after every
  attempt, `autoComplete` set (`username/current-password/new-password`),
  no password in logs/analytics/URLs/storage (verified by test).
- **M2 — Infrastructure details leaked to users.** UI told users to open
  Firebase Console and named providers/endpoints. Fixed: generic messages;
  details only in `console.debug`.
- **M3 — Popup-only Google flow with no fallback.** Blocked/failed popups
  dead-ended. Fixed: redirect fallback button + `getRedirectResult`
  consumption on mount.
- **M4 — Implicit session persistence.** `getAuth` default (local) was relied
  on silently while offline needs it. Fixed: explicit
  `browserLocalPersistence` with tradeoff documented; no behavior change.
- **M5 — Concurrent-submit races.** Double-click could fire parallel
  `signInWithPopup` calls (`cancelled-popup-request`). Fixed: `authInProgress`
  guard + disabled buttons.
- **M6 — Drive token scope confusion risk.** Token email vs Firebase email
  mismatch could go unnoticed client-side. Already enforced server-side
  (`verifyGoogleDriveUser`); client keeps token in `sessionStorage` only,
  never logs/transmits elsewhere. Scope decision documented (keep full
  `drive`, see §5).

### Low / defense-in-depth

- `ProtectedRoute` is UX-only (correct); Firestore rules remain the boundary.
  Verified no `dangerouslySetInnerHTML` in auth paths; errors render as React
  text. No open-redirect parameter (`Navigate('/dashboard')` fixed target; no
  `redirect=` / `continueUrl` accepted from URL). `window.open` uses
  `noopener,noreferrer` for user URLs. No `eval`/`new Function` in auth.
  Logout sweeps all Drive tokens + offline image cache + sync status before
  `signOut` (good).

## 4. User model decision

Multi-user architecture retained (per-UID isolation across all collections).
Public self-registration REMAINS ENABLED because the product supports multiple
independent users and Firestore rules already isolate `users/{uid}/...`.
Compensations: generic enumeration-safe messages, 12-char signup minimum,
verification lifecycle, reset flow, server-verified Drive binding. A
closed-registration (allowlist) model was NOT adopted: a client-side email
check would be bypassable, and proper allowlisting requires Identity Platform
blocking functions / custom claims (documented as future option). No fragile
`if (email === ...)` gate was added.

## 5. Drive scope decision

KEEP `https://www.googleapis.com/auth/drive`. The app lets users paste ANY
existing folder ID/URL and verifies editor access server-side
(`assertDriveFolderAccess`). `drive.file` covers only app-created files and
would break that flow. Downgrade requires migrating to a Drive picker/file
open flow + full re-test of verify/create/upload/complete/delete/image-chunk
paths. Consent-screen verification for the broad scope is a deployment
requirement (see config doc).

## 6. Session persistence decision

Explicit `browserLocalPersistence` (local). Required for the offline
workspace (cached Firestore + session survival across restarts). Tradeoff:
unattended devices retain access until logout. Mitigations in place: logout
sweeps Drive tokens + offline images; sensitive Drive ops re-verify ID token
per request; verification/reset lifecycle added. No app-level idle lock was
added in this pass (would need reauth UX that doesn't destroy offline data) —
recorded as residual risk / follow-up.

## 7. MFA decision

NOT implemented in code. Requires Identity Platform TOTP upgrade + console
configuration + enrollment/re-auth UX + `multi-factor-auth-required` handling
beyond a message. The error code is now surfaced generically instead of as
`internal-error`, and enrollment/removal protections are specified in the
config doc. Claiming MFA without the console half would be false assurance.

## 8. Residual risks (require non-code configuration or follow-ups)

- Firebase Console: enumeration protection, password policy (12+), providers,
  authorized domains, quotas, App Check, MFA/Identity Platform.
- Google Cloud: OAuth consent verification for full Drive scope, API-key
  restrictions must still allow Identity Toolkit + Secure Token.
- Vercel: redeploy for CSP headers; `FIREBASE_WEB_API_KEY` server env parity.
- Firestore `email_verified` hard enforcement intentionally not turned on
  (would break existing sessions); Drive endpoints already enforce it.
- `loginLogs` remains client-asserted/best-effort; authoritative auth audit
  awaits Admin-SDK ID-token-verified endpoint.
- No idle/app lock; device-profile compromise can read local cache +
  `sessionStorage` token (XSS impact). CSP + token hygiene reduce but do not
  eliminate this.
- Note content cap was removed per owner request (Firestore ~1 MiB hard limit
  remains); oversized-note writes fail at Firestore with a generic message.
