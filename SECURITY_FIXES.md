# ProMana Security Fixes (2026-10-03)

Root-cause fixes for `SECURITY_AUDIT.md`. Every fix was re-tested
(§Verification). No production data was touched. No secrets in this report.

## F1. CRITICAL — `/api/gemini` open proxy → authenticated, capped, rate-limited
- Files: `api/gemini.js` (rewritten), `server/firebaseAuth.js` (new),
  `server/rateLimit.js` (new), `src/components/AiWorkspace.jsx` (sends token).
- Fix: Firebase ID token verified server-side via Identity-Toolkit lookup
  (signature/expiry/revocation/disabled enforced by Google); UID derived from
  verified claims only; per-UID (40/10 min) + per-IP (120/10 min) sliding
  windows → 429; 200 KB body cap → 413; workspace context rebuilt from a field
  allowlist with truncation (notes ≤300 × 8k chars, etc.); `no-store`; generic
  errors; no request content in logs; client attaches `Authorization: Bearer`
  ID token and handles 401/429/413. Blocklist kept as defense-in-depth and
  exported (`DANGEROUS_PROMPT_PATTERNS`) for tests.
- Tests: 24-test suite (auth rejection, caps, patterns, hidden-note exclusion);
  live: no-token 401, forged 401, GET 405.
- Residual: per-instance memory limiter (serverless); true daily quota needs a
  privileged backend (documented); model output still untrusted (rendered as
  text/React elements only).

## F2. HIGH — Firestore rules blanket allow → per-collection validated rules
- File: `firestore.rules` (8 → ~330 lines).
- Fix: replaced `/{document=**}` allow with `isOwner()` + schemas for
  projects/launchpad/notes/taskGroups/calendarEntries/documents,
  `settings/googleDrive|editors`, read-only `settings/limits` (kills
  self-granted pro plans), schema-locked `usage/aiDaily`, append-only
  `loginLogs`, explicit deny-all fallback. Type checks, regex IDs/URLs/dates,
  allowlisted enums/MIMEs, size caps (note 200k, doc 25 MB, tags ≤30…).
- Tests: `tests/firestore-rules-static.test.js` (8 tests). Emulator A-vs-B
  matrix specified in `SECURITY_TEST_PLAN.md` §B (needs Java; not runnable in
  this environment).
- Residual: quota monotonicity needs backend enforcement (rules bound
  shape/range only).

## F3. HIGH — `/api/favicon` unvalidated proxy + SVG reflection → hardened
- File: `api/favicon.js` (rewritten).
- Fix: strict hostname validation + `encodeURIComponent`, size allowlist
  (16–256, default 128), SVG-escaped fallback char, 5 s upstream timeout,
  upstream content-type/size checks, GET/HEAD-only, per-IP limit (120/min),
  `nosniff`, no-store on errors.
- Tests: unit (domains/sizes/escaping) + live (evil domain 400, traversal 404).

## F4. HIGH — Missing security headers → baseline in `vercel.json`
- File: `vercel.json`.
- Fix: CSP (no `unsafe-eval`, styles `unsafe-inline` only, Drive preview
  frame-src, Firebase/Google/ipify/analytics connect-src, `frame-ancestors
  'self'`, `object-src 'none'`), HSTS preload, nosniff, Referrer-Policy,
  Permissions-Policy (camera=self for QR scanner), kept
  COOP `same-origin-allow-popups` for Google sign-in, `no-store` on `/api/*`.
- Tests: static header assertions; prod/preview `curl -sI` in test plan §C/D.

## F5. MEDIUM — `/api/log-auth-error` unbounded log sink → allowlisted/capped
- File: `api/log-auth-error.js` (rewritten).
- Fix: 4 KB body cap → 413, field allowlist + length caps, CR/LF stripping,
  server-observed IP (client `ipAddress` ignored), per-IP limit (30/min),
  `no-store`.
- Tests: unit (sanitization) + live (9 KB → 413, CRLF → 204).

## F6. MEDIUM — `dangerouslySetInnerHTML` highlighter → safe tokenizer
- Files: `src/utils/codeHighlight.js` (new), `src/components/AiWorkspace.jsx`.
- Fix: regex-HTML-string highlighting replaced by raw-text tokenizer rendered
  as React elements (auto-escaped); linear-time pattern (perf-tested);
  strings no longer mis-highlight keywords inside them (old bug removed).
- Tests: rejoin-exactness on 7 attack payloads, class safety, 70 KB
  adversarial input <1 s, repo-wide sink scan, bundle contains only React
  internals' prop name.

## F7. MEDIUM — Drive session hygiene (scope documented, tokens swept)
- Files: `src/utils/googleDriveAuth.js` (+`clearAllGoogleDriveAccessTokens`),
  `src/components/Header.jsx`, `src/pages/DashboardPage.jsx`.
- Fix: logout and account-switch sweep ALL `promana-google-drive-token:*`
  sessionStorage keys (previously only current UID). Full `auth/drive` scope
  retained deliberately (folder-ID UX needs it; picker migration is future
  work) with email-match + capability + per-file ownership checks intact.
- Tests: source assertions on sweep call sites.

## F8. MEDIUM — Vite dev API path traversal → allowlisted routing
- File: `vite.config.js`.
- Fix: route must match `^/api/[A-Za-z0-9-]+$`, resolved path must stay in
  `api/`, else 404; dev POST bodies capped at 1 MB; dev server binds
  `127.0.0.1` by default (`VITE_DEV_HOST` override documented), dropped
  `allowedHosts: 'all'`.
- Tests: live — `/api/%2e%2e/vite.config` → 404, `/api/../vite.config` →
  SPA fallback (plugin never reached), unknown route → 404.

## F9. MEDIUM — Custom editor schemes blocklist → extended + bounded
- File: `src/constants/editorSchemes.js`.
- Fix: blocked set 5 → 22 protocols (vbscript/blob/filesystem/about/ftp/ws/
  tel/ssh/mailto/…), scheme ≤64 chars, protocol ≤24, name ≤60, id ≤80.
- Tests: 8 scheme/name assertions.

## F10. MEDIUM — No input caps → shared limits + UI + rules enforcement
- Files: `src/utils/inputLimits.js` (new), `src/components/NoteModal.jsx`
  (`maxLength`), `src/pages/DashboardPage.jsx` (note/task-group validation
  with toasts), `firestore.rules` (server-side caps).
- Tests: `validateNoteDraft/validateTaskGroupDraft` unit tests.

## F11. LOW — Login demo credentials removed; drive chunk/mgmt rate limits
- Files: `src/pages/LoginPage.jsx` (hint paragraphs deleted),
  `api/drive-files.js` (300 chunks / 120 mgmt per 10 min per UID → 429).
- Tests: live drive-files 401 path; lint/build pass.

## F12. Dependencies — targeted upgrades, no blind `audit fix --force`
- Files: `package.json`, `package-lock.json`.
- Changes: `firebase 12.11.0→12.19.0`, `@google/genai 2.12.0→2.27.0`,
  `vite 8.2.2→8.3.2`, `eslint/@eslint/js 9.39.4→9.39.5`, plus `npm audit fix`
  (non-force). Result: 7 → 4 findings; remaining 4 are the two `@grpc/grpc-js`
  advisories, fixable only by downgrading Firebase to v9 (breaking, wrong
  direction; the web app uses Firestore over HTTPS/WebChannel, not the
  affected Node gRPC server path). `jsqr@1.4.0` (pinned, unmaintained, pure-JS,
  bounded input) and `blueimp-md5` (Gravatar hashing only) intentionally kept.
- Tests: denylist check passes; full suite green; prod build succeeds.

## Verification results (2026-10-03)
- `npm run lint` → clean. `npm run build` → success, no `.map` files.
- All 7 suites: 20+4+9+5+3+24+8 = 73 tests pass (new suites 32/32; one
  pre-existing assertion updated to the refactored-but-equivalent server-side
  hidden-note filter, same security intent).
- Bundle grep: `GEMINI_API_KEY` absent; Gemini key value absent; only the
  public Firebase web config present (by design); no app
  `dangerouslySetInnerHTML` in bundle.
- Live dev-server probes: gemini 401/401/405, drive-files 401, favicon
  400/200, log-auth 413/204, traversal 404s, connectivity 204.
- `npm audit`: 7 → 4 (residual documented above). Git history: no secrets
  ever committed (`.env` untracked + gitignored).
