// Shared client-side input limits. These mirror the Firestore security rules
// caps (see firestore.rules) so oversized input is rejected in the UI before
// a write is attempted. Client checks are UX only — the rules are the real
// enforcement. Keep the two in sync when changing either side.

export const INPUT_LIMITS = Object.freeze({
  // Notes / snippets (note content is intentionally uncapped — Firestore's
  // ~1 MiB per-document hard limit still applies)
  noteTitle: 200,
  noteTags: 30,
  noteTagLength: 60,
  // Projects
  projectName: 200,
  projectPath: 2000,
  projectNotes: 20000,
  projectTags: 30,
  projectLanguages: 20,
  // Launchpad shortcuts
  shortcutName: 200,
  shortcutUrl: 2000,
  shortcutNotes: 10000,
  // Tasks
  taskGroupTitle: 200,
  taskGroupNote: 10000,
  taskGroupsTasks: 500,
  taskText: 500,
  // Calendar
  calendarTitle: 200,
  calendarNote: 10000,
  // Documents
  documentTitle: 300,
  // AI
  aiPrompt: 1000,
})

export function truncateText(value, maxLength) {
  return String(value ?? '').slice(0, Math.max(0, maxLength))
}

function checkLength(label, value, maxLength) {
  if (String(value ?? '').length > maxLength) {
    return `${label} must be ${maxLength} characters or fewer.`
  }
  return ''
}

// Returns '' when the draft is acceptable, otherwise a user-facing message.
// Note content is intentionally uncapped.
export function validateNoteDraft(draft) {
  if (!draft || typeof draft !== 'object') {
    return 'That note could not be read. Please try again.'
  }

  return (
    checkLength('Note title', draft.title, INPUT_LIMITS.noteTitle) ||
    (Array.isArray(draft.tags) && draft.tags.length > INPUT_LIMITS.noteTags
      ? `Notes support up to ${INPUT_LIMITS.noteTags} tags.`
      : '')
  )
}

export function validateTaskGroupDraft(draft) {
  if (!draft || typeof draft !== 'object') {
    return 'That task group could not be read. Please try again.'
  }

  if (String(draft.title ?? '').trim().length === 0) {
    return 'Add a title for this task group.'
  }

  return (
    checkLength('Task group title', draft.title, INPUT_LIMITS.taskGroupTitle) ||
    checkLength('Task group note', draft.note, INPUT_LIMITS.taskGroupNote) ||
    (Array.isArray(draft.tasks) && draft.tasks.length > INPUT_LIMITS.taskGroupsTasks
      ? `Task groups support up to ${INPUT_LIMITS.taskGroupsTasks} tasks.`
      : '')
  )
}
