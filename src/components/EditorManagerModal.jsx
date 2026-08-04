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
      className="calendar-modal-backdrop fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 px-3 py-3 backdrop-blur-md sm:items-center sm:px-4 sm:py-6"
      onClick={onClose}
    >
      <section
        className="calendar-modal-panel relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/40 p-5 shadow-2xl glass-panel-light dark:border-white/10 dark:glass-panel-dark sm:max-h-[calc(100dvh-3rem)] sm:p-7"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-manager-title"
      >
        <div className="flex shrink-0 items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
              Projects workspace
            </p>
            <h2
              id="editor-manager-title"
              className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl"
            >
              Manage IDEs
            </h2>
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">
              Add custom project launchers once, then use them from every project
              card in your workspace.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/40 text-slate-500 transition hover:bg-white/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
            aria-label="Close IDE manager"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="rounded-2xl border border-blue-200/60 bg-blue-50/70 p-4 text-xs font-medium leading-5 text-blue-900 dark:border-blue-400/15 dark:bg-blue-500/10 dark:text-blue-100">
            <p className="mb-1 text-sm font-bold">How project launchers work</p>
            ProMana appends the selected project path to your prefix. For example,
            <code className="mx-1 rounded-md bg-white/80 px-1.5 py-0.5 font-mono text-[11px] dark:bg-slate-950/60">
              trae://file/
            </code>
            becomes
            <code className="ml-1 break-all rounded-md bg-white/80 px-1.5 py-0.5 font-mono text-[11px] dark:bg-slate-950/60">
              trae://file//Users/you/code/project
            </code>
            . The IDE must be installed and registered for that protocol.
          </div>

          <form
            className="mt-5 grid gap-4 rounded-3xl border border-white/40 bg-white/35 p-4 dark:border-white/10 dark:bg-slate-950/30 sm:p-5"
            onSubmit={handleAddEditor}
          >
            <div>
              <p className="text-sm font-black text-slate-950 dark:text-white">
                Add a custom IDE
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                Enter the app name and the URI prefix registered by your IDE.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
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
                  className="rounded-2xl border border-white/40 bg-white/80 px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-slate-950/80 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
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
                  className="rounded-2xl border border-white/40 bg-white/80 px-4 py-3 font-mono text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-slate-950/80 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                />
              </label>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-blue-200/70 bg-blue-50/50 p-4 dark:border-blue-400/15 dark:bg-blue-500/5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Launcher preview
                </p>
                <p className="mt-2 break-all font-mono text-xs font-medium text-slate-700 dark:text-slate-200">
                  {`${previewScheme}/Users/you/code/project`}
                </p>
              </div>
              <button
                type="submit"
                className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/15 transition-all hover:scale-[1.01] hover:brightness-110 active:scale-[0.99]"
              >
                <Plus className="h-4 w-4" />
                Add IDE
              </button>
            </div>

            {formError ? (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-600 dark:bg-red-500/10 dark:text-red-300" role="alert">
                {formError}
              </p>
            ) : null}
          </form>

          <div className="mt-6 grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-slate-950 dark:text-white">
                  Custom IDEs
                </p>
                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  VS Code, Cursor, and Antigravity remain available automatically.
                </p>
              </div>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/70 text-slate-400 shadow-sm dark:bg-slate-950/60">
                <Settings2 className="h-4 w-4" />
              </span>
            </div>

            {draftEditors.length ? (
              draftEditors.map((editor) => (
                <div
                  key={editor.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-white/40 bg-white/70 px-4 py-3 shadow-sm transition hover:bg-white dark:border-white/10 dark:bg-slate-950/60 dark:hover:bg-slate-950/80"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-950 dark:text-white">
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
                    className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                    aria-label={`Remove ${editor.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-white/50 bg-white/30 px-4 py-6 text-center dark:border-white/10 dark:bg-slate-950/20">
                <Settings2 className="mx-auto h-6 w-6 text-slate-400" />
                <p className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                  No custom IDEs yet
                </p>
                <p className="mx-auto mt-1 max-w-md text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                  Add Trae, Qoder, or any app with a registered URI protocol above.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex shrink-0 flex-wrap justify-end gap-3 border-t border-white/20 pt-4 dark:border-white/5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="cursor-pointer rounded-2xl border border-white/40 bg-white/80 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-200 dark:hover:bg-slate-950"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void handleSave()}
            className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/15 transition-all hover:scale-[1.01] hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-80"
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
