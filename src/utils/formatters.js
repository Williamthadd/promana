const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat('en', {
  numeric: 'auto',
})

function coerceToDate(value) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return value
  }

  if (typeof value?.toDate === 'function') {
    return value.toDate()
  }

  const parsedDate = new Date(value)
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
}

export function getTimeValue(value) {
  return coerceToDate(value)?.getTime() ?? 0
}

export function formatRelativeTime(value) {
  const date = coerceToDate(value)

  if (!date) {
    return 'just now'
  }

  const diffInSeconds = Math.round((date.getTime() - Date.now()) / 1000)
  const absoluteSeconds = Math.abs(diffInSeconds)

  if (absoluteSeconds < 30) {
    return 'just now'
  }

  const units = [
    ['year', 60 * 60 * 24 * 365],
    ['month', 60 * 60 * 24 * 30],
    ['week', 60 * 60 * 24 * 7],
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60],
  ]

  for (const [unit, seconds] of units) {
    if (absoluteSeconds >= seconds) {
      return RELATIVE_TIME_FORMATTER.format(
        Math.round(diffInSeconds / seconds),
        unit,
      )
    }
  }

  return RELATIVE_TIME_FORMATTER.format(diffInSeconds, 'second')
}

export function normalizeProjectPath(value) {
  let normalizedValue = (value ?? '').trim()

  if (!normalizedValue) {
    return ''
  }

  normalizedValue = normalizedValue.replace(
    /^(?:code|cursor)(?:\s+(?:-n|--new-window|-r|--reuse-window))*\s+/i,
    '',
  )
  normalizedValue = normalizedValue.replace(/^vscode:\/\/file\/+/i, '/')
  normalizedValue = normalizedValue.replace(/^cursor:\/\/file\/+/i, '/')
  normalizedValue = normalizedValue.replace(/^["']|["']$/g, '')

  return normalizedValue.trim()
}
