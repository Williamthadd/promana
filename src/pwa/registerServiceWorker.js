const SERVICE_WORKER_URL = '/sw.js'
const UPDATE_INTERVAL_MS = 60 * 60 * 1000

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

  window.addEventListener(
    'load',
    async () => {
      try {
        const registration = await navigator.serviceWorker.register(
          SERVICE_WORKER_URL,
          { scope: '/' },
        )

        window.setInterval(() => {
          registration.update().catch(() => {})
        }, UPDATE_INTERVAL_MS)
      } catch (error) {
        console.warn('ProMana offline app shell could not be registered.', error)
      }
    },
    { once: true },
  )
}
