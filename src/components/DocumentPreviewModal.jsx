import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, ExternalLink, LoaderCircle, X } from 'lucide-react'
import {
  formatFileSize,
  getDocumentTypeLabel,
} from '../constants/documentFiles'

function getPreviewUrl(fileRecord) {
  if (fileRecord.previewUrl) {
    return fileRecord.previewUrl
  }

  if (fileRecord.driveFileId) {
    return `https://drive.google.com/file/d/${encodeURIComponent(fileRecord.driveFileId)}/preview`
  }

  return fileRecord.webViewLink || fileRecord.downloadUrl || ''
}

function getViewUrl(fileRecord) {
  if (fileRecord.webViewLink) {
    return fileRecord.webViewLink
  }

  if (fileRecord.driveFileId) {
    return `https://drive.google.com/file/d/${encodeURIComponent(fileRecord.driveFileId)}/view`
  }

  return fileRecord.downloadUrl || ''
}

function DocumentPreviewPanel({ fileRecord, onClose }) {
  const [isLoading, setIsLoading] = useState(true)
  const previewUrl = getPreviewUrl(fileRecord)
  const viewUrl = getViewUrl(fileRecord)

  return (
    <div
      className="calendar-modal-backdrop fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 px-3 py-3 backdrop-blur-md sm:items-center sm:px-4 sm:py-6"
      onClick={onClose}
    >
      <div
        className="calendar-modal-panel flex max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/40 p-5 shadow-2xl glass-panel-light dark:border-white/10 dark:glass-panel-dark sm:max-h-[calc(100dvh-3rem)] sm:p-7"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
              Google Drive preview
            </p>
            <h2 className="mt-2 truncate text-2xl font-black tracking-tight text-slate-950 dark:text-white">
              {fileRecord.title || fileRecord.originalName}
            </h2>
            <p className="mt-2 flex flex-wrap gap-x-2 text-sm text-slate-500 dark:text-slate-400">
              <span>{getDocumentTypeLabel(fileRecord.extension)}</span>
              <span aria-hidden="true">·</span>
              <span>{formatFileSize(fileRecord.size)}</span>
              <span aria-hidden="true">·</span>
              <span>Stored in Google Drive</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/40 text-slate-500 transition hover:bg-white/40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
            aria-label="Close file preview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative mt-5 min-h-0 flex-1 overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
          {isLoading && previewUrl ? (
            <div className="absolute inset-0 z-10 grid place-items-center bg-white dark:bg-slate-950">
              <div className="text-center">
                <LoaderCircle className="mx-auto h-9 w-9 animate-spin text-blue-600" />
                <p className="mt-3 text-sm font-bold text-slate-600 dark:text-slate-300">
                  Loading preview from Google Drive...
                </p>
              </div>
            </div>
          ) : null}

          {previewUrl ? (
            <iframe
              src={previewUrl}
              title={fileRecord.title || fileRecord.originalName}
              onLoad={() => setIsLoading(false)}
              className="h-[65vh] w-full bg-white"
              allow="fullscreen"
            />
          ) : (
            <div className="grid h-[65vh] place-items-center p-6 text-center">
              <div>
                <p className="font-bold text-slate-700 dark:text-slate-200">
                  Preview link is unavailable.
                </p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Re-upload this file to Google Drive to restore preview access.
                </p>
              </div>
            </div>
          )}
        </div>

        <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">
          Google Drive may ask you to sign in with the same email used by your
          ProMana account.
        </p>

        <div className="mt-5 flex shrink-0 flex-wrap justify-end gap-3 border-t border-white/20 pt-4 dark:border-white/5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/40 bg-white/80 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-white dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-200"
          >
            Close
          </button>
          {viewUrl ? (
            <a
              href={viewUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-100 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200"
            >
              <ExternalLink className="h-4 w-4" />
              Open in Drive
            </a>
          ) : null}
          {fileRecord.downloadUrl ? (
            <a
              href={fileRecord.downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
            >
              <Download className="h-4 w-4" />
              Download original
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function DocumentPreviewModal({
  document: fileRecord,
  open,
  onClose,
}) {
  if (!open || !fileRecord || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <DocumentPreviewPanel
      key={fileRecord.id}
      fileRecord={fileRecord}
      onClose={onClose}
    />,
    document.body,
  )
}
