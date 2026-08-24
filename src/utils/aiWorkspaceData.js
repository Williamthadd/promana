const HIDDEN_NOTE_VISIBILITY = 'hidden'

export function canShareNoteWithAi(note) {
  if (!note || typeof note !== 'object') {
    return false
  }

  const visibility = String(note.visibility ?? '')
    .trim()
    .toLowerCase()

  return visibility !== HIDDEN_NOTE_VISIBILITY
}

export function filterNotesForAi(notes) {
  return Array.isArray(notes) ? notes.filter(canShareNoteWithAi) : []
}
