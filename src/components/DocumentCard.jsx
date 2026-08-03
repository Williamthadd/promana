import { useState } from 'react'
import {
  Download,
  Eye,
  FileImage,
  FileSpreadsheet,
  FileText,
  Trash2,
} from 'lucide-react'
import {
  formatFileSize,
  getDocumentTypeLabel,
} from '../constants/documentFiles'
import { formatRelativeTime } from '../utils/formatters'
import ConfirmDialog from './ConfirmDialog'

export default function DocumentCard({
  document,
  onPreview,
  onDelete,
  isDeleting,
}) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  return (
    <>
      <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-3xl border border-white/50 shadow-md transition-all duration-300 glass-panel-light hover:-translate-y-1 hover:border-blue-500/30 hover:shadow-xl dark:border-white/10 dark:glass-panel-dark dark:hover:border-blue-400/30">
        <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-blue-100 via-white to-cyan-100 dark:from-blue-950 dark:via-slate-900 dark:to-cyan-950">
          <div className="grid h-full place-items-center">
            <div className="grid h-20 w-20 place-items-center rounded-3xl border border-white/60 bg-white/75 text-blue-600 shadow-lg backdrop-blur transition duration-300 group-hover:scale-105 dark:border-white/10 dark:bg-slate-950/60 dark:text-blue-300">
              {document.kind === 'image' ? (
                <FileImage className="h-9 w-9" />
              ) : document.extension === 'xlsx' ||
                document.extension === 'csv' ? (
                <FileSpreadsheet className="h-9 w-9" />
              ) : (
                <FileText className="h-9 w-9" />
              )}
            </div>
          </div>

          <span className="absolute left-4 top-4 rounded-full border border-white/60 bg-white/85 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-200">
            {document.extension}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-4 p-5">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-black tracking-tight text-slate-950 dark:text-white">
              {document.title || document.originalName}
            </h3>
            <p
              className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400"
              title={document.originalName}
            >
              {document.originalName}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-white/5">
              {getDocumentTypeLabel(document.extension)}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-white/5">
              {formatFileSize(document.size)}
            </span>
          </div>

          <p className="text-xs font-medium text-slate-400">
            Added {formatRelativeTime(document.createdAt)}
          </p>

          <div className="mt-auto grid grid-cols-[1fr_auto_auto] gap-2">
            <button
              type="button"
              onClick={() => onPreview(document)}
              className="inline-flex min-w-0 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
            >
              <Eye className="h-4 w-4 shrink-0" />
              Preview
            </button>
            {document.downloadUrl ? (
              <a
                href={document.downloadUrl}
                target="_blank"
                rel="noreferrer"
                download={document.originalName}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-500/30 dark:hover:bg-blue-500/10"
                aria-label={`Download ${document.originalName}`}
              >
                <Download className="h-4 w-4" />
              </a>
            ) : null}
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => setIsConfirmOpen(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-red-500/30 dark:hover:bg-red-500/10"
              aria-label={`Remove ${document.title || document.originalName}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </article>

      <ConfirmDialog
        open={isConfirmOpen}
        title="Remove file?"
        message={`Are you sure you want to remove ${document.title || document.originalName}? The stored file will be deleted permanently.`}
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={() => {
          setIsConfirmOpen(false)
          void onDelete(document)
        }}
      />
    </>
  )
}
