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
* **Offline QR Image Download**: Send a cached image directly to an Android phone over the same Wi-Fi or hotspot using a one-time local QR transfer.
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

### 6. Offline QR Image Download

The image transfer needs a small local Node.js companion because a browser tab cannot listen for an Android phone by itself. In a second terminal, run:

```bash
npm run offline-transfer
```

Keep ProMana open at `http://localhost:3000`, click `Check Offline QR service`, then use the QR action on an image in Docs & Images. Uploaded/cached images can transfer with WAN access disconnected; an older uncached Drive image needs one online preparation first. Offline copies expire after 30 days and are cleared on logout. The actual phone download stays on the local network and has no cloud fallback.

See [Offline QR Image Download](docs/OFFLINE_QR_DOWNLOAD.md) for the architecture, security model, firewall setup, limitations, and exact Windows/macOS-to-Android acceptance steps.
