/* global Buffer */
import { sendJson } from '../server/apiResponse.js'

export default async function handler(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`)
  const domain = url.searchParams.get('domain')
  const size = url.searchParams.get('size') || '128'

  if (!domain) {
    sendJson(response, 400, { error: 'Domain is required' })
    return
  }

  try {
    const googleFaviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`
    const res = await fetch(googleFaviconUrl)
    
    if (res.ok) {
      const buffer = await res.arrayBuffer()
      response.setHeader('Content-Type', res.headers.get('Content-Type') || 'image/png')
      response.setHeader('Cache-Control', 'public, max-age=86400') // cache for 1 day
      response.status(200).send(Buffer.from(buffer))
      return
    }
  } catch {
    // Fail silently, fall through to SVG generator
  }

  // If the favicon load failed or returned non-200, return an SVG with the first letter
  const firstLetter = domain.charAt(0) || '?'
  const char = firstLetter.toUpperCase()
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
      <rect width="48" height="48" rx="16" fill="#eff6ff"/>
      <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="22" fill="#1d4ed8">${char}</text>
    </svg>
  `.trim()

  response.setHeader('Content-Type', 'image/svg+xml')
  response.setHeader('Cache-Control', 'public, max-age=3600') // cache SVG fallback for 1 hour
  response.status(200).send(svg)
}
