export const EDITORS = [
  {
    id: 'vscode',
    name: 'VS Code',
    label: 'Open in VS Code',
    scheme: 'vscode://file/',
    command: 'code',
  },
  {
    id: 'cursor',
    name: 'Cursor',
    label: 'Open in Cursor',
    scheme: 'cursor://file/',
    command: 'cursor',
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    label: 'Open in Antigravity',
    scheme: 'antigravity://file/',
    command: 'antigravity',
  },
]

const BLOCKED_EDITOR_PROTOCOLS = new Set([
  'data',
  'file',
  'http',
  'https',
  'javascript',
])

export function normalizeEditorSchemePrefix(value) {
  const trimmedValue = String(value ?? '').trim()

  if (!trimmedValue) {
    return ''
  }

  if (/^[a-z][a-z0-9+.-]*$/i.test(trimmedValue)) {
    const protocol = trimmedValue.toLowerCase()
    return BLOCKED_EDITOR_PROTOCOLS.has(protocol) ? '' : `${protocol}://file/`
  }

  const schemeMatch = trimmedValue.match(
    /^([a-z][a-z0-9+.-]*):\/\/([^\s"'<>`]*)$/i,
  )

  if (!schemeMatch) {
    return ''
  }

  const protocol = schemeMatch[1].toLowerCase()

  if (BLOCKED_EDITOR_PROTOCOLS.has(protocol)) {
    return ''
  }

  return `${protocol}://${schemeMatch[2]}`
}

export function normalizeCustomEditor(editor, fallbackId = '') {
  const name = String(editor?.name ?? '').trim()
  const scheme = normalizeEditorSchemePrefix(editor?.scheme)
  const id = String(editor?.id ?? fallbackId).trim()

  if (!id || !name || !scheme) {
    return null
  }

  return {
    id,
    name,
    label: `Open in ${name}`,
    scheme,
    command: '',
    isCustom: true,
  }
}
