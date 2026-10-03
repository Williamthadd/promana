# Authentication Test Record

## Automated (all offline, `node --test`, run 2026-10-03)

| File | Tests | Result |
|---|---|---|
| `tests/auth-hardening.test.js` (new, 15 tests) | enumeration-safe login/signup/config messages, email normalize, 12-char policy, redirect fallback, concurrency guard, password cleared, ipify removed, no client IP assert, CSP handshake origins, explicit persistence, verification+reset lifecycle, Drive scope binding, loginLogs append-only | 15/15 pass |
| `tests/security-regression.test.js` | existing 24 incl. note/tag caps, rate limit, sanitizers | 24/24 pass |
| `tests/firestore-rules-static.test.js` | rules deny-by-default, per-UID isolation, note uncapped, Drive IDs | 9/9 pass |
| `tests/notes-search.test.js` | search behavior | 3/3 pass |
| `tests/offline-mode.test.js` | offline gate | pass |
| `tests/ai-auth-offline.test.js` | AI offline auth | pass |
| `tests/pwa-app-shell.test.js` | PWA shell | pass |
| `tests/optical-transfer-protocol.test.js` | QR/optical protocol | pass |
| **Total** | | **89/89 pass** |

Command used (explicit file list; bare `node --test tests/` is not
supported by the installed Node 22.15):

```
node --test tests/auth-hardening.test.js tests/security-regression.test.js \
  tests/firestore-rules-static.test.js tests/notes-search.test.js \
  tests/offline-mode.test.js tests/ai-auth-offline.test.js \
  tests/pwa-app-shell.test.js tests/optical-transfer-protocol.test.js
```

Note: `npm test` scripts use `--test-isolation=none`, which this Node
version rejects (`bad option`). That flag issue predates this change; direct
`node --test` above is the verified path.

## Build / lint / bundle

- `npm run build` → success (`dist/` emitted; LoginPage chunk rebuilt).
- `npx eslint` on touched files → 0 errors.
- Bundle secret scan (`private_key|PRIVATE KEY|service_account|
  GEMINI_API_KEY` in `dist/`) → no matches.
- Bundle message check → generic `Unable to sign in with those credentials.`
  present; `auth/internal-error` appears only in code comparisons, never as
  a user-facing string.

## Not run (require consoles/emulators/devices)

Firebase Emulator auth + rules matrix, Playwright Google popup/redirect E2E,
MFA flows, App Check, quota/abuse verification, multi-tab offline
User-A→User-B switching on real devices. Specified in
`SECURITY_TEST_PLAN.md` — must be executed after the console checklist in
`FIREBASE_AUTH_SECURITY_CONFIGURATION.md`.
