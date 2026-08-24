import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { filterNotesForAi } from '../src/utils/aiWorkspaceData.js'

const aiWorkspaceSource = await readFile(
  new URL('../src/components/AiWorkspace.jsx', import.meta.url),
  'utf8',
)
const aiUsageSource = await readFile(
  new URL('../src/hooks/useAiDailyUsage.js', import.meta.url),
  'utf8',
)
const loginSource = await readFile(
  new URL('../src/pages/LoginPage.jsx', import.meta.url),
  'utf8',
)
const geminiApiSource = await readFile(
  new URL('../api/gemini.js', import.meta.url),
  'utf8',
)

test('Ask AI is visibly and programmatically disabled without cloud access', () => {
  assert.match(aiWorkspaceSource, /cloudAvailable = true/)
  assert.match(aiWorkspaceSource, /!cloudAvailable \|\| loading/)
  assert.match(aiWorkspaceSource, /Ask AI is unavailable offline/)
  assert.match(aiWorkspaceSource, /id="ai-offline-help"/)

  const offlineGuard = aiWorkspaceSource.indexOf('if (!cloudAvailable)')
  const geminiRequest = aiWorkspaceSource.indexOf("fetch('/api/gemini'")
  assert.ok(offlineGuard >= 0 && offlineGuard < geminiRequest)
})

test('AI credit transaction fails before Firestore is called offline', () => {
  assert.match(aiUsageSource, /getConnectivitySnapshot\(\)\.status/)
  assert.match(aiUsageSource, /error\.code = 'ai\/offline'/)

  const connectivityGuard = aiUsageSource.indexOf(
    'getConnectivitySnapshot().status',
  )
  const transaction = aiUsageSource.indexOf('runTransaction(db')
  assert.ok(connectivityGuard >= 0 && connectivityGuard < transaction)
})

test('AI chat history is scoped to the authenticated Firebase UID', () => {
  assert.match(
    aiWorkspaceSource,
    /`\$\{LEGACY_CHAT_HISTORY_KEY\}:\$\{userId\}`/,
  )
  assert.match(
    aiWorkspaceSource,
    /localStorage\.removeItem\(LEGACY_CHAT_HISTORY_KEY\)/,
  )
  assert.match(
    aiWorkspaceSource,
    /localStorage\.setItem\(chatStorageKey, JSON\.stringify\(messages\)\)/,
  )
})

test('Ask AI excludes hidden notes in both the browser and Gemini API', () => {
  const hiddenSecret = 'PRIVATE_NOTE_CONTENT_MUST_NOT_REACH_AI'
  const filteredNotes = filterNotesForAi([
    {
      id: 'visible-note',
      visibility: 'visible',
      content: 'Shareable content',
    },
    {
      id: 'legacy-note',
      content: 'Legacy notes without visibility remain available',
    },
    {
      id: 'hidden-note',
      visibility: 'hidden',
      content: hiddenSecret,
    },
    {
      id: 'normalized-hidden-note',
      visibility: ' HIDDEN ',
      content: hiddenSecret,
    },
  ])

  assert.deepEqual(
    filteredNotes.map((note) => note.id),
    ['visible-note', 'legacy-note'],
  )
  assert.doesNotMatch(JSON.stringify(filteredNotes), new RegExp(hiddenSecret))
  assert.deepEqual(filterNotesForAi(null), [])

  assert.match(
    aiWorkspaceSource,
    /const aiVisibleNotes = useMemo\(\(\) => filterNotesForAi\(notes\), \[notes\]\)/,
    'the browser must derive an AI-safe notes collection',
  )
  assert.match(
    aiWorkspaceSource,
    /notes:\s*aiVisibleNotes/,
    'the browser must remove hidden notes before sending the request',
  )
  assert.match(
    aiWorkspaceSource,
    /aiVisibleNotes\.find\(n => n\.id === result\.id\)/,
    'AI result cards must never resolve against the full notes collection',
  )
  assert.match(
    geminiApiSource,
    /notes:\s*filterNotesForAi\(workspaceData\?\.notes\)\.map/,
    'the API must remove hidden notes before building Gemini context',
  )
  assert.match(
    geminiApiSource,
    /\['note',\s*new Set\(contextSummary\.notes\.map\(n => n\.id\)\)\]/,
    'note results must be restricted to IDs from the filtered AI context',
  )
})

test('authentication audit logging is best-effort and offline auth is explained', () => {
  assert.match(loginSource, /void recordAuthAttempt\(/)
  assert.doesNotMatch(loginSource, /await recordAuthAttempt\(/)
  assert.match(loginSource, /disabled=\{loading \|\| isOffline\}/)
  assert.match(loginSource, /Offline mode cannot start a new sign-in/)
  assert.match(loginSource, /role="status"/)
})
