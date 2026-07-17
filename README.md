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

### 📝 Notes & Snippets Workspace
* **Code Snippets**: Save reusable boilerplate, SQL scripts, shell commands, and configs with language labels.
* **Markdown Reference**: Create syntax-highlighted notes to keep reference guides and deployment wikis at hand.

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
* **Database & Auth**: Firebase / Firestore integration with local mock fallbacks when keys are unconfigured.
* **AI Engine**: Node.js serverless API routes using `@google/genai` (targeting `gemini-3.5-flash` and `gemini-3.1-flash-lite`).

---

## 💻 Getting Started Locally

### 1. Prerequisites
Ensure you have **Node.js (v18+)** and **npm** installed.

### 2. Install Dependencies
Clone the repository and install packages:
```bash
npm install
```

### 3. Environment Setup
Configure your local environment variables by copying `.env.example` or editing `.env`:
```env
# Firebase Configuration (Optional, falls back to local mocks if empty)
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id

# Gemini API Key (Required for AI Workspace features)
GEMINI_API_KEY=your_gemini_api_key
```

### 4. Running the Development Server
Launch the local dev server:
```bash
npm run dev
```
Open **`http://localhost:3000`** in your browser to access the dashboard.
Use the dummy credentials `user@gmail.com` with password `password` to sign in.