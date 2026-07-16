const MONTH_FORMATTER = new Intl.DateTimeFormat('en', {
  month: 'long',
  year: 'numeric',
})

const DATE_FORMATTER = new Intl.DateTimeFormat('en', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

export const CALENDAR_WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

function padDatePart(value) {
  return String(value).padStart(2, '0')
}

export function formatDateKey(date) {
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join('-')
}

export function parseDateKey(dateKey) {
  const [year, month, day] = String(dateKey ?? '')
    .split('-')
    .map(Number)

  if (!year || !month || !day) {
    return null
  }

  const date = new Date(year, month - 1, day)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}

export function formatCalendarMonth(date) {
  return MONTH_FORMATTER.format(date)
}

export function formatCalendarDate(dateKey) {
  const date = parseDateKey(dateKey)
  return date ? DATE_FORMATTER.format(date) : 'Selected day'
}

export function shiftCalendarMonth(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

export function getCalendarMonthDays(viewDate) {
  const firstOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1)
  const gridStart = new Date(firstOfMonth)
  gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    return date
  })
}

export function isTodayDateKey(dateKey) {
  return dateKey === formatDateKey(new Date())
}

export function getTimeMinutes(time) {
  const [hours, minutes] = String(time ?? '')
    .split(':')
    .map(Number)

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null
  }

  return hours * 60 + minutes
}

export function formatCalendarTime(time) {
  const minutes = getTimeMinutes(time)

  if (minutes === null) {
    return ''
  }

  const date = new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60)
  return new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function sortCalendarEntries(entries) {
  return [...entries].sort((left, right) => {
    const dateDifference = String(left.dateKey ?? '').localeCompare(
      String(right.dateKey ?? ''),
    )

    if (dateDifference !== 0) {
      return dateDifference
    }

    const leftTime = left.time || left.reminderTime || '24:00'
    const rightTime = right.time || right.reminderTime || '24:00'
    return leftTime.localeCompare(rightTime)
  })
}

export function filterCalendarEntries(entries, filters) {
  const normalizedTitle = String(filters?.title ?? '')
    .trim()
    .toLowerCase()
  const dateTimeFrom = String(filters?.dateTimeFrom ?? '')
  const dateTimeTo = String(filters?.dateTimeTo ?? '')

  return entries.filter((entry) => {
    const entryTitle = String(entry.title ?? '').toLowerCase()
    const entryDate = String(entry.dateKey ?? '')
    const entryTime = String(entry.time ?? '')
    const entryDateTime = `${entryDate}T${entryTime || '00:00'}`
    const matchesTitle = !normalizedTitle || entryTitle.includes(normalizedTitle)
    const matchesDateTimeFrom =
      !dateTimeFrom || entryDateTime >= dateTimeFrom
    const matchesDateTimeTo = !dateTimeTo || entryDateTime <= dateTimeTo

    return Boolean(
      matchesTitle &&
        matchesDateTimeFrom &&
        matchesDateTimeTo,
    )
  })
}
