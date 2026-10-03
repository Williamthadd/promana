# Firebase / Google Cloud / Vercel Configuration Checklist

Code changes are deployed; the items below CANNOT be done in code and must
be set in consoles. Verify each before calling Google sign-in healthy.

## A. Firebase Console — Authentication (REQUIRED)

1. **Providers.** Enable `Email/Password` AND `Google`. If either shows
   `operation-not-allowed`, the login UI now shows a generic message — this
   checklist is the fix.
2. **Authorized domains.** Add every serving origin, e.g. `localhost`,
   `127.0.0.1`, your Vercel domain(s), and any custom domain. Missing
   entries cause `unauthorized-domain` (now generic in UI; details in
   `console.debug [AUTH_DIAGNOSTICS]`).
3. **Email enumeration protection.** Enable it (Authentication → Settings).
   The UI no longer distinguishes missing vs wrong passwords, but this
   console toggle is the real control — verify it is ON.
4. **Password policy.** Set minimum length **12**, require the strongest
   preset your plan allows. App code enforces 12 on signup; Firebase must
   agree server-side.
5. **Email templates.** Confirm sender, action-URL domain, and that
   verification/reset links land on an authorized domain. Test signup →
   inbox → link → `handleRefreshVerification`.
6. **Users.** Confirm the test account exists, is enabled (not disabled/
   deleted), and its provider list matches the sign-in method used.

## B. Google Cloud / OAuth consent (REQUIRED for Google + Drive)

1. **OAuth consent screen.** App requests full Drive scope
   (`.../auth/drive`, restricted). Consent must be published/verified for
   the production audience; otherwise the popup fails and Firebase reports
   `auth/internal-error`.
2. **Scopes.** Keep `.../auth/drive` unless folder selection migrates to a
   Drive picker (then re-test everything and downgrade to `drive.file`).
3. **API key restrictions.** The `VITE_FIREBASE_API_KEY` key MUST still allow:
   Identity Toolkit API, Secure Token API, and Token Service. Overly tight
   HTTP-referrer or API restrictions are the #1 cause of
   `auth/internal-error` with an otherwise correct app. Allow the deployed
   origins AND localhost for development.
4. **Test users (if consent is in testing mode).** Add every Google account
   used to sign in, or unverified-mode logins fail.

## C. Vercel (REQUIRED)

1. **Redeploy** so the new `vercel.json` CSP/COOP headers take effect.
2. **Env parity:** `FIREBASE_WEB_API_KEY` (server) must equal the Firebase
   web API key; `VITE_FIREBASE_*` must match the same project
   (`proman-f3b9c`). Mismatched projects between client and `/api/*`
   verification cause 401s.
3. **Do NOT** add secrets with a `VITE_` prefix. `GEMINI_API_KEY` stays
   unprefixed (server-only) — verified absent from `dist/`.

## D. Firestore rules — optional hard-gate (NOT enabled)

To require verified email for data access, add
`request.auth.token.email_verified == true` to collections — BUT this locks
out existing unverified password sessions immediately. Recommended rollout:
announce → verify users → enable → monitor `permission-denied`. Drive
endpoints already enforce verification server-side.

## E. Identity Platform upgrades (FOLLOW-UP, not configured here)

MFA/TOTP, App Check enforcement, blocking functions for closed registration,
advanced quotas/abuse controls. Each needs console enablement + client UX
(enrollment, challenge, re-auth) + emulator/E2E tests before claiming it.

## F. Smoke test after configuration

1. Email signup (12+ char pw) → verification email arrives → link works.
2. Login wrong password AND unknown email → identical generic message.
3. Password reset for unknown address → same generic message, no email sent.
4. Google popup success; with popup blocker → redirect fallback succeeds.
5. `console.debug [AUTH_DIAGNOSTICS]` shows no config errors.
6. `/dashboard` reachable; logout → `/login`; Firestore cross-user read
   denied (see SECURITY_TEST_PLAN.md emulator matrix).
