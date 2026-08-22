import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ClipboardPaste,
  FileUp,
  ImagePlus,
  LoaderCircle,
  UploadCloud,
  X,
} from 'lucide-react'
import {
  DOCUMENT_FILE_ACCEPT,
  formatFileSize,
  getDefaultDocumentTitle,
  getDocumentExtension,
  getDocumentTypeLabel,
  getDocumentValidationError,
} from '../constants/documentFiles'

const PASTED_IMAGE_EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

function normalizePastedImage(file) {
  if (getDocumentExtension(file.name)) {
    return file
  }

  const extension = PASTED_IMAGE_EXTENSIONS[file.type] ?? 'png'
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

  return new File([file], `screenshot-${timestamp}.${extension}`, {
    type: file.type || 'image/png',
  })
}

function DocumentUploadForm({
  onClose,
  onUpload,
  isUploading,
  uploadProgress,
}) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const pasteAreaRef = useRef(null)
  const imagePreviewUrl =
    selectedFile?.type.startsWith('image/') && selectedFile
      ? URL.createObjectURL(selectedFile)
      : ''

  useEffect(() => {
    pasteAreaRef.current?.focus()
  }, [])

  useEffect(
    () => () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl)
      }
    },
    [imagePreviewUrl],
  )

  function selectFile(file) {
    const validationError = getDocumentValidationError(file)

    if (validationError) {
      setSelectedFile(null)
      setError(validationError)
      return
    }

    setSelectedFile(file)
    setTitle((currentTitle) => currentTitle || getDefaultDocumentTitle(file.name))
    setError('')
  }

  function handlePaste(event) {
    const imageItem = Array.from(event.clipboardData?.items ?? []).find(
      (item) => item.kind === 'file' && item.type.startsWith('image/'),
    )

    if (!imageItem) {
      return
    }

    event.preventDefault()
    const pastedFile = imageItem.getAsFile()

    if (pastedFile) {
      selectFile(normalizePastedImage(pastedFile))
    }
  }

  function handleDrop(event) {
    event.preventDefault()
    selectFile(event.dataTransfer.files?.[0])
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const validationError = getDocumentValidationError(selectedFile)

    if (validationError) {
      setError(validationError)
      return
    }

    const didUpload = await onUpload?.({
      file: selectedFile,
      title: title.trim() || getDefaultDocumentTitle(selectedFile.name),
    })

    if (didUpload) {
      onClose()
    }
  }

  return (
    <div
      className="calendar-modal-backdrop fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 px-3 py-3 backdrop-blur-md sm:items-center sm:px-4 sm:py-6"
      onClick={isUploading ? undefined : onClose}
      onPaste={handlePaste}
    >
      <div
        className="calendar-modal-panel relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/40 p-5 shadow-2xl glass-panel-light dark:border-white/10 dark:glass-panel-dark sm:max-h-[calc(100dvh-3rem)] sm:p-7"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
              <FileUp className="h-4 w-4" />
              Docs workspace
            </div>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
              Add a document or image
            </h2>
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">
              Upload a file, drag it here, or paste a screenshot directly from
              your clipboard.
            </p>
          </div>

          <button
            type="button"
            disabled={isUploading}
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/40 text-slate-500 transition hover:bg-white/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
            aria-label="Close upload modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          className="mt-6 flex min-h-0 flex-1 flex-col"
          onSubmit={handleSubmit}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1">
            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Display title
              </span>
              <input
                type="text"
                value={title}
                disabled={isUploading}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Defaults to the file name"
                className="rounded-2xl border border-white/40 bg-white/80 px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-60 dark:border-white/10 dark:bg-slate-950/80 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-400"
              />
            </label>

            <div
              ref={pasteAreaRef}
              tabIndex={0}
              role="button"
              onClick={() =>
                document.getElementById('proman-document-file-input')?.click()
              }
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
              className="group relative grid min-h-64 cursor-pointer place-items-center overflow-hidden rounded-3xl border-2 border-dashed border-blue-300 bg-gradient-to-br from-blue-50 to-cyan-50 p-5 text-center outline-none transition hover:border-blue-500 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-blue-500/30 dark:from-blue-500/10 dark:to-cyan-500/5 dark:focus:border-blue-400"
            >
              {imagePreviewUrl ? (
                <>
                  <img
                    src={imagePreviewUrl}
                    alt="Selected upload preview"
                    className="absolute inset-0 h-full w-full object-cover opacity-25 transition group-hover:opacity-35"
                  />
                  <div className="absolute inset-0 bg-white/65 dark:bg-slate-950/65" />
                </>
              ) : null}

              <div className="relative">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-600 text-white shadow-lg shadow-blue-500/20">
                  {selectedFile ? (
                    <ImagePlus className="h-7 w-7" />
                  ) : (
                    <UploadCloud className="h-7 w-7" />
                  )}
                </div>
                <p className="mt-4 font-bold text-slate-900 dark:text-white">
                  {selectedFile
                    ? selectedFile.name
                    : 'Choose, drop, or paste your file'}
                </p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  {selectedFile
                    ? `${getDocumentTypeLabel(getDocumentExtension(selectedFile.name))} · ${formatFileSize(selectedFile.size)}`
                    : 'Press Ctrl+V or Cmd+V here after taking a screenshot'}
                </p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-3 py-1.5 text-xs font-bold text-blue-700 dark:border-blue-500/20 dark:bg-slate-950/60 dark:text-blue-200">
                  <ClipboardPaste className="h-3.5 w-3.5" />
                  PDF, DOCX, XLSX, CSV, PNG, JPG, JPEG, GIF, WEBP
                </div>
                <p className="mt-3 text-xs font-medium text-slate-400">
                  Maximum file size: 25 MB
                </p>
              </div>
            </div>

            <input
              id="proman-document-file-input"
              type="file"
              accept={DOCUMENT_FILE_ACCEPT}
              disabled={isUploading}
              className="hidden"
              onChange={(event) => selectFile(event.target.files?.[0])}
            />

            {error ? (
              <p
                role="alert"
                className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200"
              >
                {error}
              </p>
            ) : null}

            {isUploading ? (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-500/20 dark:bg-blue-500/10">
                <div className="flex items-center justify-between text-sm font-bold text-blue-700 dark:text-blue-200">
                  <span>Uploading securely...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-[width] duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex shrink-0 flex-wrap justify-end gap-3 border-t border-white/20 pt-4 dark:border-white/5">
            <button
              type="button"
              disabled={isUploading}
              onClick={onClose}
              className="rounded-2xl border border-white/40 bg-white/80 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading || !selectedFile}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/15 transition-all hover:scale-[1.01] hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUploading ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="h-4 w-4" />
              )}
              {isUploading ? 'Uploading...' : 'Save file'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function DocumentUploadModal({
  open,
  onClose,
  onUpload,
  isUploading = false,
  uploadProgress = 0,
}) {
  if (!open || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <DocumentUploadForm
      onClose={onClose}
      onUpload={onUpload}
      isUploading={isUploading}
      uploadProgress={uploadProgress}
    />,
    document.body,
  )
}
