// Safe code tokenizer for rendering AI/note code blocks as React elements.
//
// Security contract: this module NEVER builds HTML strings. Callers render
// the returned segments as React text children (React escapes them), so
// untrusted code content (stored notes, model output) cannot become markup.
// Do not add dangerouslySetInnerHTML, innerHTML, or HTML-string assembly here.

export const CODE_KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'import', 'export',
  'default', 'class', 'extends', 'if', 'else', 'for', 'while', 'try',
  'catch',
])

export const CODE_OBJECTS = new Set([
  'db', 'auth', 'user', 'projects', 'notes', 'taskGroups',
  'calendarEntries', 'Timestamp',
])

export const CODE_KEYWORD_CLASS = 'text-[#f92672] font-semibold'
export const CODE_STRING_CLASS = 'text-[#e6db74]'
export const CODE_COMMENT_CLASS = 'text-[#75715e] italic'
export const CODE_OBJECT_CLASS = 'text-[#66d9ef]'

// Linear-time token pattern: comments, quoted strings (with escapes, no
// newlines except backticks), and identifiers. No nested quantifiers, so no
// catastrophic backtracking on adversarial input.
const CODE_TOKEN_PATTERN =
  /(\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b([A-Za-z_$][\w$]*)/g

export function tokenizeCode(code) {
  const input = String(code ?? '')
  const pattern = new RegExp(CODE_TOKEN_PATTERN)
  const segments = []
  let lastIndex = 0
  let match
  let key = 0

  while ((match = pattern.exec(input)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        key: key++,
        text: input.slice(lastIndex, match.index),
        className: null,
      })
    }

    const [full, comment, str, word] = match
    let className = null

    if (comment) {
      className = CODE_COMMENT_CLASS
    } else if (str) {
      className = CODE_STRING_CLASS
    } else if (word && CODE_KEYWORDS.has(word)) {
      className = CODE_KEYWORD_CLASS
    } else if (word && CODE_OBJECTS.has(word)) {
      className = CODE_OBJECT_CLASS
    }

    segments.push({ key: key++, text: full, className })
    lastIndex = match.index + full.length

    if (full.length === 0) {
      break
    }
  }

  if (lastIndex < input.length) {
    segments.push({ key: key++, text: input.slice(lastIndex), className: null })
  }

  return segments
}
