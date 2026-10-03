# ProMana Security Audit (OWASP ASVS 5.0 baseline)

Date: 2026-10-03. Scope: full repository (`src/`, `api/`, `server/`, `scripts/`,
`firestore.rules`, `firebase.json`, `vercel.json`, `vite.config.js`, `package.json`,
`package-lock.json`), live static analysis + dependency scan + git-history secret
scan. No production data was attacked; no destructive tests were run against
production Firestore.

No real secrets are included in this report.

## 1. Threat model

### Assets (all treated as confidential, personal workspace)
- Project metadata incl. local absolute paths, notes, tags, languages.
- Notes/snippets incl. SQL, shell commands, configs, hidden notes.
- Tasks, calendar entries + reminders, launchpad shortcuts + notes.
- Document metadata + Google-Drive-backed file contents (PDF/DOCX/XLSX/CSV/images).
- Drive folder ID (`users/{uid}/settings/googleDrive`), Drive OAuth access token
  (short-lived, sessionStorage only), Firebase identity.
- AI chat history (per-user localStorage), offline Firestore cache (IndexedDB).

### Actors
- A1: Unauthenticated network attacker (can call public Vercel endpoints).
- A2: Authenticated user A attacking user B (cross-account).
- A3: Stored-content attacker: any string the user pastes/imports (note, snippet,
  AI output, QR frame, filename, URL) is untrusted data.
- A4: Network observer of QR optical transfer (camera can record screen).
- A5: Local-device user (shared browser profile) reading residual cache/storage.
- A6: Malicious/compromised npm dependency (supply chain).

### Trust boundaries
1. Firebase Auth (verified ID token) -> Firestore rules + server APIs. Client UID
   is NEVER authoritative.
2. Firestore security rules = primary data boundary (deny by default).
3. Server APIs (`/api/*`) must independently verify identity (Firebase lookup),
   validate input, enforce quotas. Client-side checks are UX only.
4. Gemini model = untrusted inference; prompt text is NOT a security control.
5. Browser storage (sessionStorage/localStorage/IndexedDB/Cache Storage) = NOT a
   secret vault; XSS anywhere readable => token theft, so XSS prevention is P0.
6. Google Drive: OAuth token (least privilege), email-match check, folder
   capability check, per-file ownership via `appProperties`.

## 2. Attack surface inventory

| Area | Entry points |
|---|---|
| Auth | Email/password + Google popup (`LoginPage.jsx`), `useAuth`, `ProtectedRoute` (client-side redirect only) |
| Firestore | 7 collections + settings/usage/loginLogs subcollections, offline persistence on |
| APIs | `POST /api/gemini`, `GET/POST/DELETE /api/drive-files`, `GET/HEAD /api/connectivity`, `POST /api/log-auth-error`, `GET /api/favicon` |
| Rendering | React text (safe) + ONE `dangerouslySetInnerHTML` (AiWorkspace code highlighter) |
| URLs | Shortcut URLs, repository URLs, Drive preview/download links, favicon proxy, editor custom-schemes (`vscode://` etc.) |
| Uploads | Drive resumable upload via `/api/drive-files` (chunked base64), clipboard paste, drag-drop |
| Preview | Drive `preview` iframe, Drive `downloadUrl` anchor, local `blob:` `<img>` |
| QR | `OfflineReceiver` camera scanner + `protocol/*` parser (CRC, SHA-256, magic bytes) |
| PWA | Generated `sw.js` (precache app shell only, skips `/api/`) |
| Paths | Project absolute paths used ONLY to build `vscode://file/...` navigation URLs + copyable shell commands (no server exec) |

## 3. Findings

### CRITICAL-1: `/api/gemini` has no authentication — open Gemini proxy + cost abuse
- File: `api/gemini.js`. No Firebase token check; anyone on the internet can POST
  `{prompt, workspaceData}` and burn the server Gemini quota. No rate limit, no
  body-size cap (`request.body` parsed by platform/Vite dev plugin unbounded),
  `workspaceData` arrays unbounded (a caller can stuff MBs of context per request).
- The client (`AiWorkspace.jsx:286`) sends no `Authorization` header at all.
- Server-side "single-user scope" is fiction: the server never queries Firestore;
  it trusts client-supplied `workspaceData` and only filters result IDs against
  that same client data (good hygiene, but NOT authorization).
- Injection blocklist is regex-based and bypassable (homoglyphs, leetspeak,
  spacing tricks, other languages, indirect injection via stored notes — stored
  note content is concatenated into `systemInstruction` context with no
  delimiting/escaping, so a stored note can attempt instruction override; the
  model is instructed to refuse, but the model is not a boundary).
- ASVS: 4.1/4.2 (access control), 11.1 (business logic / anti-automation).
- Fix: require + verify Firebase ID token (same Identity-Toolkit lookup pattern
  already used by `drive-files.js`), derive UID server-side, per-UID rate limit,
  hard body/context caps, `Cache-Control: no-store`, generic errors, client sends
  `Bearer` ID token. Treat blocklist + result-ID filtering as defense-in-depth.

### HIGH-1: Firestore rules are a single recursive allow — no validation, privilege escalation
- File: `firestore.rules`: `match /users/{userId}/{document=**} { allow read, write:
  if auth.uid == userId }`. Per-UID isolation exists, but:
  - `settings/limits` is client-writable: `useUserLimits` trusts `plan`,
    `maxProjects`, etc. from Firestore, so a user can self-grant `plan: "pro"`
    and huge quotas (client-enforced limits bypass). Integrity issue; also any
    other user cannot touch it (isolation holds) — severity HIGH for integrity,
    not cross-user disclosure.
  - `usage/aiDaily` is client-writable with no schema: daily AI quota
    (`useAiDailyUsage` transaction) can be reset by direct write; quota is
    client-enforced only.
  - `loginLogs` accepts arbitrary fields/sizes; no create-only restriction.
  - No field allowlists, type checks, string-length caps, or array bounds on ANY
    collection (notes content, tags, calendar, documents metadata, Drive folder
    ID, custom editors) => oversized/nested payload DoS + stored-payload abuse.
- ASVS: 4.1, 5.1/5.5 (input validation), 11.1.
- Fix: replace recursive allow with per-collection rules + `isOwner()` +
  schema/size validation; `settings/limits` read-only from client; `usage/aiDaily`
  schema-locked; `loginLogs` create-only with caps. True quota enforcement still
  needs a backend (Admin SDK / Cloud Function) — recorded as residual risk.

### HIGH-2: `/api/favicon` — unvalidated proxy input + reflected SVG XSS
- File: `api/favicon.js`. `domain` is interpolated raw into the upstream URL (no
  validation/encoding/length cap), `size` unvalidated, no upstream timeout, any
  method accepted, no rate limit. The SVG fallback embeds `domain.charAt(0)`
  unescaped into `image/svg+xml`; a domain starting with `<`, `&`, `"`, or
  full-width variants yields reflected markup when the URL is opened directly.
  `Cache-Control: public` on a per-input URL is fine, but error paths must not
  reflect input.
- ASVS: 5.1.3 (output encoding), 5.2 (SSRF-ish server fetch), 14.4 (headers).
- Fix: strict hostname validation, `encodeURIComponent`, size allowlist, SVG
  escape, method allowlist, upstream timeout, `X-Content-Type-Options: nosniff`,
  no-store on errors.

### HIGH-3: No CSP / missing security headers
- File: `vercel.json` sets only `COOP` (+ SW cache headers). No CSP, HSTS,
  `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`,
  `frame-ancestors`. Any future missed XSS sink becomes fully exploitable
  (no second barrier); clickjacking of dashboard possible if framed.
- Fix: add baseline headers + CSP allowlist covering Firebase/Google/Drive/
  ipify/Vercel-analytics; no `unsafe-eval`; `unsafe-inline` styles only (Tailwind
  runtime); `frame-ancestors 'self'`; `object-src 'none'`; `frame-src` limited
  to Drive preview.

### MEDIUM-1: `/api/log-auth-error` — unauthenticated unbounded log sink
- File: `api/log-auth-error.js`. Accepts arbitrary JSON of any size, merges
  client fields, `console.error`s it (Vercel log injection / log spam / cost).
  `ipAddress`/`url`/`userAgent` are client-controlled. No rate limit.
- Fix: 4 KB body cap, field allowlist + length caps, CR/LF stripping, per-IP rate
  limit, `no-store`.

### MEDIUM-2: `dangerouslySetInnerHTML` code highlighter is fragile
- File: `src/components/AiWorkspace.jsx:385-402`. Chain of regex replaces over
  escaped text then injects `<span>`s. Current order escapes `&<>` first, so
  stored `<script>` does NOT execute today (verified by code reading + regression
  test), but the string-literal regex is buggy (`$1$&amp;$1` duplication) and
  keyword/string/comment passes can nest/break markup on adversarial input
  (e.g. backticks/quotes/keywords inside strings). One future edit (reorder,
  add a rule) = stored XSS from notes/AI output.
- Fix: remove `dangerouslySetInnerHTML`; render highlighted code as React
  elements from a small tokenizer (no HTML string at any stage).

### MEDIUM-3: Drive OAuth scope is full `.../auth/drive`
- File: `src/utils/googleDriveAuth.js:6`. Full-drive scope + token in
  sessionStorage means any same-origin XSS gets full Drive access until expiry.
  Mitigations present: per-UID session key, email-match + folder capability
  checks server-side, per-file `appProperties` ownership, token never in
  Firestore/logs/URLs (verified via grep). `drive.file` scope would be least
  privilege but requires a Drive picker UX change (current UX pastes a folder
  ID/URL), so not switched blindly.
- Fix: document; harden session handling (sweep all token keys on logout/account
  change, don't duplicate token into extra state), keep expiry/reconnect flow.

### MEDIUM-4: Cross-account residue on shared browser profile
- Firestore IndexedDB persistence is per-origin, not per-user. Logout
  (`Header.jsx`) clears current-UID Drive token + offline images + sync status,
  but: (a) other UIDs' `promana-google-drive-token:*` keys remain; (b) per-user
  `localStorage` (`proman-ai-chat-history:<uid>`, `proman-calendar-reminders-<uid>-*`)
  from user A stays readable via DevTools after B logs in; (c) Firestore cache
  still holds A's docs on disk (online rules still enforce isolation for queries,
  but stale `fromCache` snapshots can flash during account switch — hooks guard
  with `state.uid === uid` + `resetFirestoreSyncStatus`, verified).
- Fix: logout/account-change sweep of all app token/chat/reminder keys; document
  that IndexedDB is device-local sensitive data (lock screen / separate OS users
  for highly confidential notes).

### MEDIUM-5: Vite dev-only API path traversal
- File: `vite.config.js` `devApiPlugin`: `path.resolve(__dirname, '.'+apiPath+'.js')`
  with no sanitization — `/api/../vite.config` style paths resolve outside
  `api/` and get imported/executed in dev. Production Vercel routing unaffected.
- Fix: allowlist single-segment route names; verify resolved path stays in `api/`.

### MEDIUM-6: Custom editor schemes use blocklist, not allowlist
- File: `src/constants/editorSchemes.js`. Blocks 5 protocols but allows any other
  `scheme://file/...` (e.g. `vbscript:`, `blob:`, `filesystem:`, `ms-*`,
  `ssh:` handlers) to become clickable `Open in …` navigation from stored data.
  Self-XSS scope only (per-UID data), but a shared/imported config could carry it.
- Fix: extend blocked set + scheme/name length caps + strict shape validation.

### MEDIUM-7: No input length caps on notes/tasks/projects/calendar/shortcuts
 Files: `NoteModal.jsx`, `DashboardPage.jsx` save handlers, `useUserLimits`
  client caps only. Firestore accepts up to platform limits; huge strings/arrays
  hurt sync/perf (offline queue) and widen AI context + log volume.
- Fix: shared `src/utils/inputLimits.js` caps enforced in UI + Firestore rules.

### LOW-1: Login page shows demo credentials
- `LoginPage.jsx:337-356` renders `demo credentials: user@gmail.com / password`.
  Invites credential-stuffing confusion; remove.

### LOW-2: Dev server binds `0.0.0.0` + `allowedHosts: 'all'`
- `vite.config.js` dev only; DNS-rebinding exposure while developing. Documented;
  tightened to localhost by default with override comment.

### INFORMATIONAL (verified safe, keep as-is)
- Project "launch" never executes shell commands: builds `vscode://file/...`
  navigation URLs + copies a `code --new-window "path"` string to clipboard for
  the user to paste. No `child_process`/backend launcher exists (grep clean).
  `normalizeProjectPath` strips `code|cursor|antigravity` prefixes; `quoteCommandPath`
  quotes for display/copy only. `normalizeRepositoryUrl` enforces http/https.
- Shortcut open uses `window.open(url,'_blank','noopener,noreferrer')` after
  `isValidUrl` (http/https only). Preview iframe is Drive `preview` only
  (Google-sandboxed), `rel="noreferrer"` on Drive anchors, no `javascript:`/`data:`
  sinks found. `DocumentCard` download uses Drive `downloadUrl` + `download` attr.
- Upload allowlist excludes SVG/HTML; server re-validates extension+MIME+size+
  chunk framing; filenames sanitized server-side; `originalName` rendered as React
  text only; local `<img blob:>` preview cannot execute script.
- QR protocol: CRC per packet, SHA-256 + magic-byte check before `Blob`/
  download, filename sanitized twice (wire + receiver), 10 MB cap, chunk/payload
  bounds, session binding, duplicate/conflict detection. Optical channel is NOT
  confidential (screen-visible) — documented in receiver copy + this report.
- SW caches GET same-origin app-shell only, skips `/api/`, versioned cache with
  old-cache purge + hourly update. No authenticated responses cached.
- `.env` is gitignored and untracked (verified); git history contains no secrets;
  `GEMINI_API_KEY` has no `VITE_` prefix so Vite never bundles it (verified via
  build grep in verification step). Firebase web keys are public-by-design.
- `blueimp-md5` is used ONLY for Gravatar avatar hashing (non-security use).
  `jsqr@1.4.0` is pinned/unmaintained but has no known WASM/RCE sink here (pure
  JS decoder on camera frames, bounded `MAX_SCAN_PIXELS`); replacement tracked
  as future work, not a blind swap.

## 4. Dependency scan (2026-10-03, `npm audit`)
- 7 findings, all transitive: `@grpc/grpc-js` HIGH (x2, via firebase/firestore —
  fix requires firebase major downgrade; not applicable), `@humanfs/node`
  MODERATE (dev tooling), `brace-expansion` HIGH (x3, dev tooling),
  `js-yaml` HIGH (dev tooling). No direct dependency is vulnerable.
- Outdated direct deps: `firebase 12.11.0 -> 12.19.0`, `@google/genai
  2.12.0 -> 2.27.0`, `vite 8.2.2 -> 8.3.2`, `react 19.2.4 -> 19.3.0`, plus minor
  eslint/tailwind bumps. Targeted upgrades applied in `SECURITY_FIXES.md` with
  test/build verification (no blind `audit fix --force`).

## 5. Severity summary
- CRITICAL: 1 (open Gemini proxy). HIGH: 3 (rules, favicon, headers).
- MEDIUM: 7 (log sink, highlighter, Drive scope, account residue, dev traversal,
  editor schemes, input caps). LOW: 2. INFORMATIONAL: verified-safe list above.
