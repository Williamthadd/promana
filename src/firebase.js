import { initializeApp } from 'firebase/app'
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)

// Deliberate session policy: browserLocalPersistence keeps the Firebase
// session (ID + refresh tokens) across restarts so the offline workspace
// survives reloads. This is required for offline mode. Tradeoff: an
// unattended device keeps access until explicit logout — see
// SECURITY_AUTH_AUDIT.md. Do NOT switch to session/none persistence without
// a deliberate offline-policy change.
void setPersistence(auth, browserLocalPersistence).catch(() => {
  // Persistence failures (e.g. blocked storage) must not break boot;
  // Firebase falls back to in-memory persistence for the tab lifetime.
})

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
})
