# ProMana Authentication Fixes (implemented in code)

Each item: affected file, remediation, test, residual risk.

## F1. Production CSP unblocked Firebase/Google Auth (Critical, C1)

- File: `vercel.json`.
- Change: `connect-src` += `https://*.firebaseapp.com`,
  `https://accounts.google.com`, `https://oauth2.googleapis.com`,
  `https://www.googleapis.com`; `frame-src` += `'self`,
  `https://accounts.google.com`, `https://*.firebaseapp.com`; removed
  `https://api.ipify.org`. `COOP: same-origin-allow-popups` kept.
- Test: `tests/auth-hardening.test.js` → CSP permits handshake.
- Residual: requires redeploy. `script-src 'self'` kept (no external JS
  needed by the SDK bundle); revisit if Google One-Tap is ever added.

## F2. Enumeration-safe error messages (High, H1)

- File: `src/utils/authErrors.js` (new), `src/pages/LoginPage.jsx`.
- Change: all credential failures → `Unable to sign in with those
  credentials.`; duplicate registration → non-confirming message; reset →
  generic "If an account matches…". Console-only diagnostics for
  `internal-error/unauthorized-domain/operation-not-allowed`.
- Test: enumeration + no-console-leak assertions.
- Residual: Firebase itself may still differentiate via timing; enable
  console-side enumeration protection (see config doc).

## F3. Email verification + password reset lifecycle (High, H2)

- File: `src/pages/LoginPage.jsx`.
- Change: `sendEmailVerification` on signup with notice; unverified banner
  with resend (60s cooldown) + reload-refresh; `sendPasswordResetEmail`
  mode with generic response; 12-char signup minimum with UI hint.
- Test: lifecycle-exists assertions.
- Residual: soft-gate only (workspace still opens). Hard `email_verified`
  Firestore enforcement intentionally not enabled (would lock existing
  sessions); Drive API already enforces it server-side.

## F4. Removed third-party IP from sign-in (High, H3)

- Files: `src/utils/ipFetcher.js` (stubbed DEPRECATED), `LoginPage.jsx`,
  `vercel.json`.
- Change: no `fetchIpAddress()` in auth; client `loginLogs` omit `ipAddress`;
  `/api/log-auth-error` was already server-authoritative for IP — unchanged.
- Test: no-ipify + no-client-IP assertions.
- Residual: client `loginLogs` remain self-asserted; authoritative audit
  needs an Admin-SDK endpoint (future).

## F5. Audit attribution fix

- File: `src/pages/LoginPage.jsx`.
- Change: failed attempts log `uid: null` (no longer attributes failures to
  a stale `auth.currentUser`); `emailProvided` is boolean-only, never the
  address.
- Test: static `uid: null` failure-path assertion (via code read).
- Residual: see F4.

## F6. Google popup reliability (Medium, M3)

- File: `src/pages/LoginPage.jsx`.
- Change: `signInWithRedirect` fallback button on popup failures,
  `getRedirectResult` consumption on mount, `select_account` retained,
  Drive token saved only when present.
- Test: redirect-fallback assertions.
- Residual: redirect needs authorized-domain + cookie support; in-app
  webviews may still fail — documented in config doc.

## F7. Input hygiene + race guards (Medium, M1/M5)

- File: `src/pages/LoginPage.jsx`.
- Change: `normalizeEmail` trim + plausibility cap (254), password cleared
  after every attempt, `autoComplete` set, `authInProgress` guard.
- Test: normalize + password-cleared + guard assertions.
- Residual: Firebase is the final identity authority (correct).

## F8. Explicit session persistence (Medium, M4)

- File: `src/firebase.js`.
- Change: explicit `browserLocalPersistence` with tradeoff comment. No
  behavior change (was the implicit default); required for offline cache.
- Test: persistence assertions.
- Residual: unattended-device access until logout; no idle lock yet.

## F9. Drive scope documented, not silently downgraded

- File: `src/utils/googleDriveAuth.js`.
- Change: comment recording why full `drive` scope is required (arbitrary
  pasted folder IDs) + what a `drive.file` migration would require.
- Test: scope + server-binding assertions.
- Residual: broad consent must stay verified on the consent screen.

## Not implemented in code (documented, require console/cloud)

MFA/Identity Platform, Firebase password policy, enumeration protection
toggle, App Check, quotas, authorized domains, OAuth consent verification,
`email_verified` Firestore hard-gate, Admin-SDK audit endpoint, idle lock.
See `FIREBASE_AUTH_SECURITY_CONFIGURATION.md`.
