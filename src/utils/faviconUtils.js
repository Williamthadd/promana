export function getDomainFromUrl(url) {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return ''
  }
}

export function getFaviconUrl(url, size = 128) {
  const domain = getDomainFromUrl(url)

  if (!domain) {
    return null
  }

  return `/api/favicon?domain=${domain}&size=${size}`
}

export function getFaviconFallbackUrl(url) {
  const domain = getDomainFromUrl(url)

  if (!domain) {
    return null
  }

  return `/api/favicon?domain=${domain}&size=128`
}

export function isValidUrl(url) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}
