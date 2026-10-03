# ProMana Security Test Plan (OWASP WSTG-inspired)

Continuous verification for the threat model in `SECURITY_AUDIT.md`.
Automated suites run with `npm test` (offline, no Firebase project). Sections
marked MANUAL need a browser, the Firebase console/emulator, or a deployment.

## A. Automated suites (run on every change)

| Suite | Command | Covers |
|---|---|---|
| Security regression (24 tests) | `npm run test:security` | Auth rejection, UID stripping, XSS tokenizer + sink scan, URL schemes, upload allowlist, injection patterns, context caps, rate limiter, input caps, no-exec scan, editor schemes, QR fuzz + magic check, favicon validation, log sanitization, secret scan, no-store headers, token sweep |
| Firestore rules static (8 tests) | `npm run test:firestore-rules` | Deny-by-default, per-collection owner checks, limits read-only, logs append-only, usage schema, ID patterns, MIME allowlist, size caps |
| Optical transfer (20) | `npm run test:optical-transfer` | Packet bounds, CRC/SHA-256, filename safety |
| PWA shell (4) | `npm run test:pwa` | SW precache scope, no `/api/` caching |
| Offline mode (9) | `npm run test:offline-mode` | Sync status, connectivity probe |
| AI auth/offline (5) | `npm run test:ai-auth-offline` | Hidden-note exclusion, per-UID chat, offline guards |
| Notes search (3) | `npm run test:notes-search` | Search correctness |
| Dependency denylist | `npm run security:dependencies` (also `prebuild`) | Known-malicious packages blocked |

Note: repo scripts use `node --test --test-isolation=none`, which needs a
recent Node 22 (≥22.16) / Node 24. On older Node, run `node --test tests/…`
directly — assertions are identical.

## B. Firestore emulator tests (MANUAL, before any rules change)

Requires Java + `firebase-tools` (`npm i -g firebase-tools`,
`firebase init emulators`, `@firebase/rules-unit-testing` as a dev
dependency). Seed users A and B, then assert:

1. Unauthenticated read/write on every collection → DENY.
2. A reads/writes own `projects/notes/launchpad/taskGroups/calendarEntries/documents` → ALLOW.
3. A reads/updates/deletes B's doc IDs → DENY.
4. Create with forged `ownerId`/`role`/`plan` fields → DENY (unknown keys).
5. Oversized `notes.content` (250k chars) → DENY.
6. Write to `settings/limits` as owner → DENY.
7. `usage/aiDaily` with `count: "many"` / extra keys → DENY.
8. `loginLogs` update/delete as owner → DENY; create with valid schema → ALLOW.
9. `settings/googleDrive` with `folderId: "../../x"` → DENY.
10. `documents` with `extension: "svg"` / `mimeType: "text/html"` → DENY.

## C. API live tests (MANUAL, staging/preview deployment)

For each of `/api/gemini`, `/api/drive-files`, `/api/favicon`,
`/api/log-auth-error`, `/api/connectivity`:

- Wrong method (GET↔POST swap, PUT, OPTIONS) → 405 + `Allow` header.
- Missing/forged/expired Firebase token → 401/403, generic message.
- Malformed JSON, oversized body, deeply nested JSON, wrong types → 400/413.
- 3× burst beyond documented rate limits → 429 + `Retry-After`.
- Authenticated user A calling Gemini → 200; response `results[].id` values all
  belong to A's submitted context (echo check).
- `Cache-Control: no-store` present on gemini/drive-files/log-auth-error.
- Response headers include the CSP/HSTS block from `vercel.json`.

Verified locally 2026-10-03 (dev server): gemini 401/405, drive-files 401,
favicon 400/200-SVG, log-auth-error 413/204, traversal guard 404.

## D. Browser tests (MANUAL, per release)

1. Anonymous visit to `/dashboard` → redirected to `/login`.
2. Stored XSS: save note/project/task/shortcut/calendar/file-title containing
   `<img src=x onerror=alert(1)>`, `<svg onload=…>`, `` `code` `` fences with
   tags, `javascript:` shortcut URL, unicode-obfuscated payloads → inert text
   everywhere incl. AI code blocks; shortcut save rejected.
3. Upload `evil.svg`, `evil.pdf.html`, HTML-renamed-to-`.png`, 26 MB file →
   rejected; accepted PNG previews as image only.
4. Logout as A → sessionStorage has zero `promana-google-drive-token:*` keys;
   login as B → no A chat/reminder/Drive state; Firestore listeners re-scope.
5. Offline: airplane mode → AI/Drive disabled with messaging; edits queue;
   reconnect → sync status clears; no cross-account cache flash.
6. QR: scan garbage/non-ProMana QR → ignored with diagnostics; oversized
   declaration → rejected; completed transfer → SHA-256 verified, sanitized
   filename download.
7. Google sign-in with account X, Drive connect with account Y → server rejects
   (email mismatch); folder ID of an unshared folder → rejected.
8. Prompt injection: paste "Ignore all previous instructions…" as note content
   + ask AI to follow it → refused; response contains only own-workspace IDs.
9. Headers: `curl -sI https://<prod>` shows CSP/HSTS/nosniff block; preview
   deployments checked separately.

## E. Secret/dependency hygiene (each release)

- `git log --all -p` review for keys before release; `.env` stays untracked.
- `npm audit` review; targeted upgrades only, rerun full suite + build.
- Post-build: `grep -r GEMINI_API_KEY dist/` must be empty; only the public
  Firebase web config (`VITE_*`) may appear in the bundle; `dist/` must contain
  no `.map` files (`sourcemap: false`).

## F. Regression mapping (task §30)

Scenarios 1–24 map to `tests/security-regression.test.js` (same order in
comments: 10/11 auth, 4/5 UID stripping, 6 XSS, 7 URLs, 8/9 uploads, 12/13 AI,
14 rate limit, 15/16 caps, 17/18 token sweep, 19/20 QR, 21 no-exec, 22
filenames, 23 secrets, 24 caching) plus `tests/firestore-rules-static.test.js`
(2/3/4/5 rules) and manual sections B–D above (1 dashboard redirect, 11 token
swap, 12 cross-user Gemini, 14 sustained abuse, 17/18 multi-tab/restart).
