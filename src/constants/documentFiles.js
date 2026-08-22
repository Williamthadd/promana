export const MAX_DOCUMENT_FILE_SIZE = 25 * 1024 * 1024

export const DOCUMENT_FILE_EXTENSIONS = [
  'pdf',
  'docx',
  'xlsx',
  'csv',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
]

export const DOCUMENT_FILE_ACCEPT = DOCUMENT_FILE_EXTENSIONS.map(
  (extension) => `.${extension}`,
).join(',')

const MIME_TYPE_BY_EXTENSION = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
}

const LABEL_BY_EXTENSION = {
  pdf: 'PDF document',
  docx: 'Word document',
  xlsx: 'Excel workbook',
  csv: 'CSV spreadsheet',
  png: 'PNG image',
  jpg: 'JPG image',
  jpeg: 'JPEG image',
  gif: 'GIF image',
  webp: 'WebP image',
}

export function getDocumentExtension(fileName) {
  const match = String(fileName ?? '')
    .trim()
    .toLowerCase()
    .match(/\.([a-z0-9]+)$/)

  return match?.[1] ?? ''
}

export function getDocumentKind(extension) {
  return ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension)
    ? 'image'
    : 'document'
}

export function getDocumentMimeType(file) {
  const extension = getDocumentExtension(file?.name)
  return MIME_TYPE_BY_EXTENSION[extension] ?? file?.type ?? ''
}

export function getDocumentTypeLabel(extension) {
  return LABEL_BY_EXTENSION[extension] ?? 'Document'
}

export function getDefaultDocumentTitle(fileName) {
  return (
    String(fileName ?? '')
      .trim()
      .replace(/\.[^.]+$/, '') || 'Untitled file'
  )
}

export function isAllowedDocumentFile(file) {
  const extension = getDocumentExtension(file?.name)

  return (
    Boolean(file) &&
    DOCUMENT_FILE_EXTENSIONS.includes(extension) &&
    file.size > 0 &&
    file.size <= MAX_DOCUMENT_FILE_SIZE
  )
}

export function getDocumentValidationError(file) {
  if (!file) {
    return 'Choose a file or paste a screenshot first.'
  }

  if (!DOCUMENT_FILE_EXTENSIONS.includes(getDocumentExtension(file.name))) {
    return 'Use PDF, DOCX, XLSX, CSV, PNG, JPG, JPEG, GIF, or WEBP files only.'
  }

  if (file.size <= 0) {
    return 'That file is empty.'
  }

  if (file.size > MAX_DOCUMENT_FILE_SIZE) {
    return 'Files must be 25 MB or smaller.'
  }

  return ''
}


export function formatFileSize(bytes) {
  const size = Number(bytes) || 0

  if (size < 1024) {
    return `${size} B`
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(size < 10 * 1024 ? 1 : 0)} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}
