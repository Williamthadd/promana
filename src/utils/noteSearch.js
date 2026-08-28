export function noteTitleMatchesSearch(note, searchQuery) {
  const normalizedSearch = String(searchQuery ?? '')
    .trim()
    .toLowerCase()

  if (!normalizedSearch) {
    return true
  }

  return String(note?.title ?? '').toLowerCase().includes(normalizedSearch)
}
