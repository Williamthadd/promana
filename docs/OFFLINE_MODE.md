# ProMana Offline Application Mode

ProMana combines two browser storage layers:

- A generated service worker precaches the production application shell (HTML, JavaScript, CSS, icons, manifest, and the offline fallback page).
- Firebase Firestore's persistent local cache stores records that the signed-in browser has already loaded. Multi-tab persistence lets open ProMana tabs share the same local Firestore cache.

The connection indicator treats `navigator.onLine` only as an early hint. It verifies access to a non-cacheable same-origin `/api/connectivity` endpoint so a Wi-Fi connection with no working internet is still reported as offline. The service worker never intercepts `/api/*` or cross-origin requests.

## What works offline

- Reopening the production dashboard after it has been loaded online at least once.
- Reading previously synchronized projects, Launchpad shortcuts, notes, task groups, calendar entries, document metadata, custom editors, and account limits.
- Switching classic/city design, dark/light appearance, searching, sorting, and filtering cached records.
- Creating, editing, pinning, and deleting ordinary Firestore-backed records. These changes appear locally and wait for cloud confirmation after reconnection.
- Starting an offline QR transfer for an image that was already cached by the separate local transfer feature and whose companion service is running on the same LAN.

## What still requires internet

- A first visit, a new login, registration, Google Sign-In, or restoring data that this browser never loaded.
- Ask AI, because Gemini and the daily-credit transaction are server-backed.
- Google Drive connection, upload, remote preview/download/copy/delete, and retrieving an uncached Drive image.
- External Launchpad sites and remote decorative assets that the browser has not cached independently.

Document binaries remain in the user's Google Drive; Firestore only caches their metadata. Offline application mode does not silently duplicate every Drive file onto the device.

## Deployment and user setup

No Firebase Console persistence switch or additional Vercel service is needed.

1. Deploy the current production build to Vercel or another HTTPS origin. Prefer one stable production/custom domain; browser caches do not transfer between preview URLs or domains.
2. Open ProMana online in the browser/profile that will be used offline and sign in.
3. Wait for the dashboard data to load. Open Docs & Images once if the saved Drive-folder setting must also be cached.
4. Installing ProMana from Chrome or Edge is recommended for an app-like launch experience, but a normal browser tab also works.
5. Keep site storage enabled. Do not use private browsing or clear ProMana's site data if offline access is required.

Cached Firestore records persist on the device. Use offline mode only in a trusted browser profile; on a shared device, sign out and clear the site's stored data when local retention is not acceptable. Clearing browser site data also removes the service worker, cached records, queued writes, and cached QR images.

## Reconnection and queued edits

While disconnected, Firestore-backed edits are saved locally and the dashboard shows that changes are waiting. Firestore sends them when connectivity returns. Do not clear site data while changes are pending. A change may still be rejected after reconnection—for example, if security rules or server-side limits reject it. ProMana shows the detailed synchronization error while the page that created the change remains open. If the page was closed or reloaded, Firestore restores the queued mutation but exposes only aggregate pending state to the UI, so verify the edited record after reconnection.

Google Drive and Ask AI controls are disabled offline instead of being queued because those operations require an immediate remote response.

## Acceptance test

1. Run `npm run build` and `npm run preview`, or use the deployed HTTPS site. Development mode intentionally does not register a service worker.
2. Sign in online and visit each workspace whose records should be available offline. Confirm the connection banner disappears and wait for data to render.
3. In browser developer tools, verify the service worker controls the page. Then switch the browser network to **Offline**.
4. Close the tab and reopen `/dashboard` on exactly the same origin and browser profile.
5. Confirm cached workspaces and city counts render, the offline banner appears, and search/filter/theme controls still work.
6. Make a small Firestore edit and confirm the UI does not remain stuck; it should show as waiting to sync. Confirm Ask AI and remote Drive actions explain that they need internet.
7. Restore the network, click **Retry** if needed, and confirm the banner changes through checking/syncing to online and the edit appears from the server.
8. Repeat once with an empty/private browser profile while offline. The app must explain that only previously loaded data is available; it cannot invent or retrieve an uncached account.
