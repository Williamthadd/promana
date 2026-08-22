# ProMana — Personal Workspace & Project Manager

ProMana is a modern, lightweight, web-based project management and launcher dashboard designed specifically for developers who juggle multiple code repositories, tasks, shortcuts, snippets, and calendars on their local machine.

Instead of navigating directories or digging through browser bookmarks, ProMana aggregates your local developer resources into a unified, secure dashboard.

---

## 🚀 Key Workspaces & Features

### 📁 Projects Workspace
* **Import Local Folders**: Register local projects to launch them instantly in VS Code, Cursor, or Antigravity with one click.
* **Auto Code Analysis**: Automatically analyzes codebases to count lines of code, detect programming languages, and show breakdown ratios.
* **Smart Search & Tags**: Filter and group your repositories by name, tag, or programming language.

### ⚡ Launchpad (Shortcuts) Workspace
* **Fast Navigation**: Keep your primary web platforms, documentation links, and design tools organized.
* **Custom Categories**: Sort and group shortcuts for quick access, and pin your most-visited websites.

### 📝 Notes, Docs & Images Workspace
* **Code Snippets**: Save reusable boilerplate, SQL scripts, shell commands, and configs with language labels.
* **Document Shelf**: Store and preview PDF, DOCX, XLSX, CSV, PNG, JPG, JPEG, GIF, and WebP files.
* **Optical QR Image Transfer**: Send a cached image to an Android phone through animated QR frames containing the actual bytes—no network, companion server, or cloud relay.
* **Clipboard Capture**: Paste screenshots directly into the upload area with `Ctrl+V` or `Cmd+V`.

### 📋 Tasks Workspace
* **Focused Checklists**: Break down complex objectives into dedicated task groups.
* **Interactive Statuses**: Easily manage individual checklist items and track completion progress.

### 📅 Calendar Workspace
* **Daily Planner**: Schedule target milestones, set up reminders, and link daily activities.
* **Integrated Connections**: Link calendar schedules to specific Projects or Task Groups.

### 🤖 Ask AI (AI Workspace)
* **Intelligent Assistant**: Powered by the Gemini API (via Google Gen AI SDK). Ask questions about your projects, task lists, links, notes, and calendar timeline using natural language.
* **Concise Workspace Queries**: Instantly search, summarize, filter, and extract items directly from your local context.
* **Privacy Firewall**: Strict firewall rules keep the assistant securely locked to your local database context.

---

## 🛠️ Tech Stack & Architecture
* **Frontend**: React 19, Vite 8, Tailwind CSS, Lucide React icons.
* **Database & Auth**: Firebase Authentication and Firestore.
* **File Storage**: Google Drive API authorized by each user's Firebase Google Sign-In session.
* **AI Engine**: Node.js serverless API routes using `@google/genai` (targeting `gemini-3.5-flash` and `gemini-3.1-flash-lite`).

---

## 💻 Getting Started Locally

### 1. Prerequisites
Ensure you have **Node.js (v20.19+ or v22.12+)** and **npm** installed.

### 2. Install Dependencies
Clone the repository and install packages:
```bash
npm install
```

### 3. Environment Setup
Copy `.env.example` to `.env` and configure Firebase plus the server-only API values. The app does not require a Google Drive client secret or refresh token.

### 4. Google Drive Setup
The Docs & Images workspace stores Firestore metadata and Drive folder settings under each user. Binary files are uploaded to the private Google Drive folder selected by that user.

1. In Google Cloud Console, enable **Google Drive API**.
2. Enable **Google** in Firebase Authentication and add every local/production app domain under Firebase Authentication's **Authorized domains**.
3. Configure the Google Cloud OAuth consent screen for the Firebase project's OAuth client and include `https://www.googleapis.com/auth/drive`.
4. Add `FIREBASE_WEB_API_KEY` to the local and Vercel server environments.
5. In Docs & Images, paste a private Drive folder ID or folder URL and click **Save folder**. The Google account used by ProMana must own the folder or have **Editor** access.
6. Add test users while OAuth is in **Testing**. The Drive scope is restricted, so complete Google's OAuth verification requirements before a public release.

The selected folder ID is stored at `users/{uid}/settings/googleDrive`. Google Sign-In returns a temporary Drive access token to the browser. ProMana keeps it only in the current tab's `sessionStorage`, verifies that its Google email matches the Firebase email, and asks the user to reconnect after the token expires or the folder setting changes. No Drive token is stored in Firestore or in the server environment.

### 5. Running the Development Server
Launch the app and its local API middleware with Vite:
```bash
npm run dev
```
Open **`http://localhost:3000`** in your browser to access the dashboard.
Use the dummy credentials `user@gmail.com` with password `password` to sign in.

The production build is an installable PWA. After one complete online visit, its versioned app shell can reopen without internet and display Firestore data already available in that browser's persistent cache. The dashboard reports **online**, **checking connection**, **offline**, and pending-sync states. Firestore edits made offline are applied locally and queued for synchronization; Google Drive and Ask AI remain unavailable until the connection returns.

Development mode intentionally does not register the service worker, which avoids stale development bundles. Use `npm run build` followed by `npm run preview`, or a stable Vercel deployment, to test a true offline reload. No Firebase Console flag is required. Users must first open ProMana online, sign in, let their workspaces load, and then keep the same browser profile and origin. Private browsing, clearing site data, storage blocking, or browser storage eviction removes offline availability.

See [Offline Application Mode](docs/OFFLINE_MODE.md) for deployment requirements, limitations, privacy notes, and the online-to-offline acceptance test.

### 6. Offline Application Mode

Nothing extra needs to run beside the deployed application. Vercel supplies the required HTTPS, the generated service worker caches the application shell, and Firestore stores previously loaded user records in IndexedDB. Use a stable production/custom domain because cache storage is isolated per origin; every changing Vercel preview URL gets a different cache.

Cloud-only operations are deliberately separated from cached application data. A user can browse cached projects, shortcuts, notes, tasks, calendar entries, document metadata, settings, and limits, and can queue ordinary Firestore edits. They cannot start a new login, call Ask AI, fetch an uncached Drive file, upload to Drive, or open an external website without internet. A queued edit can still be rejected by Firestore security rules after reconnection. ProMana surfaces a detailed sync error while the page that created the edit remains open; after a reload, verify queued edits once the dashboard reconnects because Firestore exposes only aggregate pending state.

### 7. Network-Independent Optical QR Transfer

No companion process or second terminal is needed. Open the QR action on a cached
image in Docs & Images, then scan the animated frames with ProMana's public
`/receiver` page on the phone. The frames carry the original file bytes from the
desktop display to the phone camera. There is no URL payload, Wi-Fi/hotspot/LAN
requirement, Bluetooth step, cloud relay, or hidden network fallback.

The phone must visit `/receiver` online once and preferably install the production
PWA before it goes offline. The bundled receiver, protocol, and camera decoder are
then available from the service-worker cache. An older uncached Drive image still
needs one connected desktop preparation; cached copies expire after 30 days and
are cleared on logout. JPEG, PNG, WebP, and GIF images up to 10 MiB are accepted,
although files below roughly 1 MiB are far more practical for optical transfer.

See [Optical QR Image Transfer](docs/OPTICAL_QR_TRANSFER.md) for the packet format,
security model, PWA setup, performance estimates, tests, limitations, and exact
laptop-to-Android acceptance steps.
