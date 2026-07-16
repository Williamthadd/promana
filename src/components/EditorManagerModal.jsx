import { useState } from 'react'
import { createPortal } from 'react-dom'
import { LoaderCircle, Plus, Settings2, Trash2, X } from 'lucide-react'
import {
  EDITORS,
  normalizeEditorSchemePrefix,
} from '../constants/editorSchemes'

function createEditorId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `custom-editor-${Date.now()}`
}

export default function EditorManagerModal({
  open,
  editors,
  onClose,
  onSave,
  isSaving = false,
}) {
  const [draftEditors, setDraftEditors] = useState(() => editors)
  const [nameDraft, setNameDraft] = useState('')
  const [schemeDraft, setSchemeDraft] = useState('')
  const [formError, setFormError] = useState('')
  const normalizedScheme = normalizeEditorSchemePrefix(schemeDraft)
  const previewScheme = normalizedScheme || schemeDraft.trim() || 'trae://file/'

  if (!open || typeof document === 'undefined') {
    return null
  }

  function handleAddEditor(event) {
    event.preventDefault()

    const name = nameDraft.trim()
    const scheme = normalizeEditorSchemePrefix(schemeDraft)

    if (!name) {
      setFormError('Add the IDE name before continuing.')
      return
    }

    if (!scheme) {
      setFormError('Use an IDE protocol like trae or a full prefix like trae://file/.')
      return
    }

    const schemeAlreadyExists = [...EDITORS, ...draftEditors].some(
      (editor) => editor.scheme.toLowerCase() === scheme.toLowerCase(),
    )

    if (schemeAlreadyExists) {
      setFormError('That IDE prefix is already available in the editor menu.')
      return
    }

    setDraftEditors((currentEditors) => [
      ...currentEditors,
      {
        id: createEditorId(),
        name,
        label: `Open in ${name}`,
        scheme,
        command: '',
        isCustom: true,
      },
    ])
    setNameDraft('')
    setSchemeDraft('')
    setFormError('')
  }

  async function handleSave() {
    const didSave = await onSave?.(draftEditors)

    if (didSave !== false) {
      onClose?.()
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 px-4 py-6"
      onClick={onClose}
    >
      <section
        className="w-full max-w-2xl overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-6 dark:border-slate-800">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
              Project launchers
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Manage IDEs
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Add a custom application URI prefix once and use it from every project
              card on this account.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 text-slate-500 transition hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Close IDE manager"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(100vh-12rem)] overflow-y-auto p-6">
          <div className="rounded-2xl bg-blue-50 p-4 text-sm leading-6 text-blue-900 dark:bg-blue-500/10 dark:text-blue-100">
            ProMana appends the selected project path to your prefix. For example,
            <code className="mx-1 rounded bg-white/70 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-950/50">
              trae://file/
            </code>
            becomes
            <code className="ml-1 rounded bg-white/70 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-950/50">
              trae://file//Users/you/code/project
            </code>
            . The IDE must be installed and registered for that protocol.
          </div>

          <form className="mt-5 grid gap-4" onSubmit={handleAddEditor}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  IDE name
                </span>
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(event) => {
                    setNameDraft(event.target.value)
                    setFormError('')
                  }}
                  placeholder="Trae"
                  className="rounded-2xl border border-gray-200 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  URI prefix
                </span>
                <input
                  type="text"
                  value={schemeDraft}
                  onChange={(event) => {
                    setSchemeDraft(event.target.value)
                    setFormError('')
                  }}
                  placeholder="trae://file/"
                  className="rounded-2xl border border-gray-200 px-4 py-3 font-mono text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
                />
              </label>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  URL preview
                </p>
                <p className="mt-2 truncate font-mono text-xs text-slate-700 dark:text-slate-200">
                  {`${previewScheme}/Users/you/code/project`}
                </p>
              </div>
              <button
                type="submit"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                <Plus className="h-4 w-4" />
                Add IDE
              </button>
            </div>

            {formError ? (
              <p className="text-sm font-medium text-red-600 dark:text-red-300">
                {formError}
              </p>
            ) : null}
          </form>

          <div className="mt-6 grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  Custom IDEs
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  VS Code, Cursor, and Antigravity remain available automatically.
                </p>
              </div>
              <Settings2 className="h-5 w-5 text-slate-400" />
            </div>

            {draftEditors.length ? (
              draftEditors.map((editor) => (
                <div
                  key={editor.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 px-4 py-3 dark:border-slate-700"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {editor.name}
                    </p>
                    <p className="mt-1 truncate font-mono text-xs text-slate-500 dark:text-slate-400">
                      {editor.scheme}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setDraftEditors((currentEditors) =>
                        currentEditors.filter(
                          (currentEditor) => currentEditor.id !== editor.id,
                        ),
                      )
                    }
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                    aria-label={`Remove ${editor.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                No custom IDEs yet. Add Trae, Qoder, or any app with a registered URI
                protocol above.
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 p-6 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void handleSave()}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-80"
          >
            {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {isSaving ? 'Saving IDEs...' : 'Save IDEs'}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  )
}
