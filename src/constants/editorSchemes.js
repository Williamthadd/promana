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
  'vbscript',
  'blob',
  'filesystem',
  'about',
  'ftp',
  'ftps',
  'ws',
  'wss',
  'tel',
  'callto',
  'sms',
  'mailto',
  'ssh',
  'telnet',
  'sftp',
  'ldap',
  'dict',
  'gopher',
])

const MAX_EDITOR_SCHEME_LENGTH = 64
const MAX_EDITOR_PROTOCOL_LENGTH = 24
export const MAX_EDITOR_NAME_LENGTH = 60
const MAX_EDITOR_ID_LENGTH = 80

export function normalizeEditorSchemePrefix(value) {
  const trimmedValue = String(value ?? '').trim()

  if (!trimmedValue || trimmedValue.length > MAX_EDITOR_SCHEME_LENGTH) {
    return ''
  }

  if (/^[a-z][a-z0-9+.-]*$/i.test(trimmedValue)) {
    const protocol = trimmedValue.toLowerCase()

    if (
      protocol.length > MAX_EDITOR_PROTOCOL_LENGTH ||
      BLOCKED_EDITOR_PROTOCOLS.has(protocol)
    ) {
      return ''
    }

    return `${protocol}://file/`
  }

  const schemeMatch = trimmedValue.match(
    /^([a-z][a-z0-9+.-]*):\/\/([^\s"'<>`]*)$/i,
  )

  if (!schemeMatch) {
    return ''
  }

  const protocol = schemeMatch[1].toLowerCase()

  if (
    protocol.length > MAX_EDITOR_PROTOCOL_LENGTH ||
    BLOCKED_EDITOR_PROTOCOLS.has(protocol)
  ) {
    return ''
  }

  return `${protocol}://${schemeMatch[2]}`
}

export function normalizeCustomEditor(editor, fallbackId = '') {
  const name = String(editor?.name ?? '').trim()
  const scheme = normalizeEditorSchemePrefix(editor?.scheme)
  const id = String(editor?.id ?? fallbackId).trim()

  if (
    !id || id.length > MAX_EDITOR_ID_LENGTH ||
    !name || name.length > MAX_EDITOR_NAME_LENGTH ||
    !scheme
  ) {
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
