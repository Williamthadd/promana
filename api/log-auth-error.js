function readRequestBody(request) {
  if (request.body && typeof request.body === 'object') {
    return Promise.resolve(request.body)
  }

  return new Promise((resolve) => {
    let rawBody = ''

    request.on('data', (chunk) => {
      rawBody += chunk
    })

    request.on('end', () => {
      if (!rawBody) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(rawBody))
      } catch {
        resolve({ rawBody })
      }
    })
  })
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed' })
    return
  }

  const payload = await readRequestBody(request)
  const logPayload = {
    event: 'auth_failure',
    method: payload.method ?? 'unknown',
    authMode: payload.authMode ?? null,
    code: payload.code ?? 'unknown',
    message: payload.message ?? 'Unknown authentication error',
    ipAddress: payload.ipAddress ?? 'unknown',
    emailProvided: Boolean(payload.emailProvided),
    host: request.headers.host ?? null,
    path: request.url ?? '/api/log-auth-error',
    url: payload.url ?? null,
    userAgent: payload.userAgent ?? request.headers['user-agent'] ?? null,
    occurredAt: payload.occurredAt ?? new Date().toISOString(),
  }

  console.error('[AUTH_FAILURE]', JSON.stringify(logPayload))
  response.status(204).end()
}
