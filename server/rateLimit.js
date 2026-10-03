// Minimal in-memory sliding-window rate limiter for Vercel serverless routes.
//
// This is best-effort abuse control per function instance (serverless
// instances do not share memory). It raises the cost of anonymous and
// high-frequency abuse; it is NOT a replacement for authenticated quotas
// or backend usage accounting. Keys must always be derived server-side
// (verified UID, client IP from x-forwarded-for) — never from request bodies.

const buckets = new Map()
const MAX_KEYS = 5000

function evictIfNeeded() {
  if (buckets.size <= MAX_KEYS) return
  // Map preserves insertion order: drop the oldest quarter.
  const drop = Math.floor(MAX_KEYS / 4)
  let removed = 0
  for (const key of buckets.keys()) {
    buckets.delete(key)
    removed += 1
    if (removed >= drop) break
  }
}

export function checkRateLimit({ key, limit, windowMs, now = Date.now() }) {
  const safeKey = String(key ?? '').slice(0, 200) || 'global'
  const safeLimit = Math.max(1, Math.floor(Number(limit) || 1))
  const safeWindow = Math.max(1000, Math.floor(Number(windowMs) || 60000))

  evictIfNeeded()
  let hits = buckets.get(safeKey)
  if (!hits) {
    hits = []
    buckets.set(safeKey, hits)
  }

  const cutoff = now - safeWindow
  while (hits.length > 0 && hits[0] <= cutoff) hits.shift()

  if (hits.length >= safeLimit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: hits[0] + safeWindow - now,
    }
  }

  hits.push(now)
  return {
    allowed: true,
    remaining: safeLimit - hits.length,
    retryAfterMs: 0,
  }
}

export function clearRateLimitState() {
  buckets.clear()
}
