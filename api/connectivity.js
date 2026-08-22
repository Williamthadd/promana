const CONNECTIVITY_HEADER = 'X-ProMana-Connectivity'

export default function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
  response.setHeader(CONNECTIVITY_HEADER, 'online')

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  return response.status(204).end()
}
