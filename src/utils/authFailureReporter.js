export default async function reportAuthFailure(payload) {
  try {
    await fetch('/api/log-auth-error', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        occurredAt: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      }),
      keepalive: true,
    })
  } catch {
    // Logging to Vercel is best-effort and should never block auth feedback.
  }
}
