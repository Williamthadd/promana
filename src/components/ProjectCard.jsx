import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Bookmark,
  Copy,
  FolderOpen,
  MoreVertical,
  StickyNote,
} from 'lucide-react'
import { Timestamp, doc, updateDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { EDITORS } from '../constants/editorSchemes'
import {
  normalizeProjectPath,
  formatRelativeTime,
} from '../utils/formatters'
import {
  getPrimaryProjectLanguage,
  getProjectLanguages,
} from '../utils/projectLanguages'
import ConfirmDialog from './ConfirmDialog'
import LanguageBadge from './LanguageBadge'
import LanguageBar from './LanguageBar'

const TAG_COLOR_CLASSES = [
  'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200',
  'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200',
]

function getTagClass(tag) {
  const hash = [...tag].reduce((sum, character) => sum + character.charCodeAt(0), 0)
  return TAG_COLOR_CLASSES[hash % TAG_COLOR_CLASSES.length]
}

function arraysMatch(left = [], right = []) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function openEditorInNewBrowserContext(url) {
  const link = document.createElement('a')
  link.href = url
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function getEditorCommandName(editor) {
  return editor.scheme === 'cursor://file/' ? 'cursor' : 'code'
}

function getOperatingSystem() {
  const platform =
    navigator.userAgentData?.platform ||
    navigator.platform ||
    navigator.userAgent ||
    ''

  return /win/i.test(platform) ? 'windows' : 'posix'
}

function getOperatingSystemLabel(operatingSystem) {
  return operatingSystem === 'windows' ? 'Windows' : 'macOS/Linux'
}

function quoteCommandPath(path, operatingSystem) {
  if (operatingSystem === 'windows') {
    return `"${path.replace(/"/g, '""')}"`
  }

  return `"${path.replace(/(["\\$`])/g, '\\$1')}"`
}

function getNewWindowCommand(editor, targetPath, operatingSystem) {
  return `${getEditorCommandName(editor)} --new-window ${quoteCommandPath(targetPath, operatingSystem)}`
}

export default function ProjectCard({
  project,
  onDelete,
  onTagClick,
  addToast,
}) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(project.displayName ?? 'Untitled project')
  const [isEditingPath, setIsEditingPath] = useState(false)
  const [pathDraft, setPathDraft] = useState(project.absolutePath ?? '')
  const [isNotesOpen, setIsNotesOpen] = useState(false)
  const [notesDraft, setNotesDraft] = useState(project.notes ?? '')
  const [isTagEditorOpen, setIsTagEditorOpen] = useState(false)
  const [tagDraft, setTagDraft] = useState((project.tags ?? []).join(', '))
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const menuRef = useRef(null)
  const operatingSystem = getOperatingSystem()
  const operatingSystemLabel = getOperatingSystemLabel(operatingSystem)

  useEffect(() => {
    setNameDraft(project.displayName ?? 'Untitled project')
  }, [project.displayName])

  useEffect(() => {
    setPathDraft(project.absolutePath ?? '')
  }, [project.absolutePath])

  useEffect(() => {
    setNotesDraft(project.notes ?? '')
  }, [project.notes])

  useEffect(() => {
    setTagDraft((project.tags ?? []).join(', '))
  }, [project.tags])

  useEffect(() => {
    if (!isMenuOpen) {
      return undefined
    }

    function handlePointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [isMenuOpen])

  async function saveProjectUpdate(
    patch,
    {
      successMessage,
      errorMessage = 'Unable to save that change right now.',
      touchUpdatedAt = true,
    } = {},
  ) {
    const uid = auth.currentUser?.uid

    if (!uid) {
      addToast('You need to be signed in to update projects.', 'error')
      return false
    }

    try {
      const nextPatch = touchUpdatedAt
        ? { ...patch, lastUpdatedAt: patch.lastUpdatedAt ?? Timestamp.now() }
        : patch

      await updateDoc(doc(db, 'users', uid, 'projects', project.id), nextPatch)

      if (successMessage) {
        addToast(successMessage, 'success')
      }

      return true
    } catch {
      addToast(errorMessage, 'error')
      return false
    }
  }

  async function commitName() {
    const nextName = nameDraft.trim()
    setIsEditingName(false)

    if (!nextName) {
      setNameDraft(project.displayName ?? 'Untitled project')
      return
    }

    if (nextName === project.displayName) {
      return
    }

    await saveProjectUpdate(
      { displayName: nextName },
      { successMessage: 'Project name updated.' },
    )
  }

  async function commitNotes() {
    const nextNotes = notesDraft.trim()
    const currentNotes = (project.notes ?? '').trim()
    setIsNotesOpen(false)

    if (nextNotes === currentNotes) {
      return
    }

    await saveProjectUpdate(
      { notes: nextNotes },
      {
        successMessage: nextNotes ? 'Notes updated.' : 'Notes cleared.',
      },
    )
  }

  async function commitTags() {
    const nextTags = Array.from(
      new Set(
        tagDraft
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      ),
    )

    setIsTagEditorOpen(false)

    if (arraysMatch(nextTags, project.tags ?? [])) {
      return
    }

    await saveProjectUpdate(
      { tags: nextTags },
      { successMessage: 'Project tags updated.' },
    )
  }

  async function handleTogglePin() {
    await saveProjectUpdate(
      { isPinned: !project.isPinned },
      {
        successMessage: project.isPinned
          ? 'Removed from pinned projects.'
          : 'Pinned project.',
      },
    )
  }

  async function handleOpenEditor(editor) {
    const targetPath = normalizeProjectPath(project.absolutePath)

    if (project.isBroken || !targetPath) {
      setIsEditingPath(true)
      addToast(
        'Set the correct local project path before opening this project in your editor.',
        'info',
      )
      return
    }

    try {
      openEditorInNewBrowserContext(`${editor.scheme}${encodeURI(targetPath)}`)

      await saveProjectUpdate(
        {
          lastOpenedAt: Timestamp.now(),
          isBroken: false,
        },
        {
          successMessage: `Sent ${project.displayName} to ${editor.label.replace('Open in ', '')}. If your editor reuses the current window, use the new-window command in the menu.`,
          errorMessage: 'Unable to update the last opened timestamp.',
          touchUpdatedAt: false,
        },
      )
    } catch {
      addToast('Unable to open that editor right now.', 'error')
    } finally {
      setIsMenuOpen(false)
    }
  }

  async function handleCopyNewWindowCommand(editor) {
    const targetPath = normalizeProjectPath(project.absolutePath)

    if (project.isBroken || !targetPath) {
      setIsEditingPath(true)
      addToast(
        'Set the correct local project path before copying a launch command.',
        'info',
      )
      return
    }

    try {
      await navigator.clipboard.writeText(
        getNewWindowCommand(editor, targetPath, operatingSystem),
      )
      addToast(
        `${editor.label.replace('Open in ', '')} ${operatingSystemLabel}-compatible new-window command copied to clipboard.`,
        'success',
      )
    } catch {
      addToast('Unable to copy the launch command right now.', 'error')
    } finally {
      setIsMenuOpen(false)
    }
  }

  async function commitPath() {
    const nextPath = normalizeProjectPath(pathDraft)
    const currentPath = normalizeProjectPath(project.absolutePath)
    setIsEditingPath(false)

    if (nextPath === currentPath) {
      setPathDraft(project.absolutePath ?? '')
      return
    }

    await saveProjectUpdate(
      {
        absolutePath: nextPath,
        isBroken: !nextPath,
      },
      {
        successMessage: nextPath
          ? 'Project path updated.'
          : 'Project path cleared. Add a local path to re-enable IDE shortcuts.',
        errorMessage: 'Unable to update that project path right now.',
      },
    )
  }

  async function handleDeleteConfirm() {
    setIsConfirmOpen(false)
    await onDelete?.(project)
  }

  return (
    <>
      <article className="relative flex h-full flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <LanguageBadge language={getPrimaryProjectLanguage(project)} />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTogglePin}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/10 dark:hover:text-blue-200"
              aria-label={project.isPinned ? 'Unpin project' : 'Pin project'}
            >
              <Bookmark
                className="h-4.5 w-4.5"
                fill={project.isPinned ? 'currentColor' : 'none'}
              />
            </button>

            <button
              type="button"
              onClick={() => {
                setIsTagEditorOpen(false)
                setIsMenuOpen(false)
                setIsNotesOpen((current) => !current)
              }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/10 dark:hover:text-blue-200"
              aria-label="Edit notes"
            >
              <StickyNote
                className="h-4.5 w-4.5"
                fill={project.notes ? 'currentColor' : 'none'}
              />
            </button>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setIsMenuOpen((current) => !current)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-slate-500 transition hover:border-gray-300 hover:bg-gray-50 hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                aria-label="Open project actions"
              >
                <MoreVertical className="h-4.5 w-4.5" />
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 top-12 z-20 max-h-72 w-56 overflow-y-auto rounded-2xl border border-gray-100 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-950">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false)
                      setIsEditingName(true)
                    }}
                    className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Edit name
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false)
                      setIsTagEditorOpen(true)
                    }}
                    className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Add/edit tags
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false)
                      setIsEditingPath(true)
                    }}
                    className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Edit project path
                  </button>
                  {EDITORS.map((editor) => (
                    <div key={editor.scheme} className="grid gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditor(editor)}
                        className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        {editor.label}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyNewWindowCommand(editor)}
                        className="inline-flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                        title={`Copy a ${operatingSystemLabel}-compatible command`}
                      >
                        <Copy className="h-4 w-4" />
                        {`Copy ${editor.label.replace('Open in ', '')} new-window command`}
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false)
                      setIsConfirmOpen(true)
                    }}
                    className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    Remove project
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          {isEditingName ? (
            <input
              autoFocus
              type="text"
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              onBlur={commitName}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void commitName()
                }

                if (event.key === 'Escape') {
                  setIsEditingName(false)
                  setNameDraft(project.displayName ?? 'Untitled project')
                }
              }}
              className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xl font-semibold text-slate-900 outline-none focus:border-blue-400 dark:border-blue-500/40 dark:bg-slate-800 dark:text-white"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingName(true)}
              className="text-left text-xl font-semibold tracking-tight text-slate-900 transition hover:text-blue-700 dark:text-white dark:hover:text-blue-200"
            >
              {project.displayName ?? 'Untitled project'}
            </button>
          )}

          {isEditingPath ? (
            <div className="grid gap-2">
              <input
                autoFocus
                type="text"
                value={pathDraft}
                onChange={(event) => setPathDraft(event.target.value)}
                onBlur={commitPath}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void commitPath()
                  }

                  if (event.key === 'Escape') {
                    setIsEditingPath(false)
                    setPathDraft(project.absolutePath ?? '')
                  }
                }}
                placeholder="/Users/... or code /Users/..."
                className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 dark:border-blue-500/40 dark:bg-slate-800 dark:text-white"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Paste the local folder path you want VS Code or Cursor to open.
                ProMan will clean `code /Users/...` or `vscode://file/...`
                into the stored path automatically.
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingPath(true)}
              className="truncate text-left text-sm text-slate-500 transition hover:text-blue-700 dark:text-slate-400 dark:hover:text-blue-200"
              title={project.absolutePath || 'Set project path'}
            >
              {project.absolutePath || 'Set local project path to enable IDE shortcuts'}
            </button>
          )}
        </div>

        {isTagEditorOpen && (
          <input
            autoFocus
            type="text"
            value={tagDraft}
            onChange={(event) => setTagDraft(event.target.value)}
            onBlur={commitTags}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void commitTags()
              }

              if (event.key === 'Escape') {
                setIsTagEditorOpen(false)
                setTagDraft((project.tags ?? []).join(', '))
              }
            }}
            placeholder="frontend, client, firebase"
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
          />
        )}

        {isNotesOpen && (
          <textarea
            autoFocus
            rows={4}
            value={notesDraft}
            onChange={(event) => setNotesDraft(event.target.value)}
            onBlur={commitNotes}
            placeholder="Capture project notes, repo reminders, or local setup steps..."
            className="resize-none rounded-2xl border border-gray-200 px-3 py-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
          />
        )}

        {project.isBroken && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            <span className="inline-flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" />
              ⚠ Path may be broken
            </span>
            <button
              type="button"
              onClick={() => setIsEditingPath(true)}
              className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
            >
              Edit path
            </button>
          </div>
        )}

        <LanguageBar languages={project.languagesList ?? project.languages} />

        <div className="grid gap-1 text-sm text-slate-500 dark:text-slate-400">
          <p>{`Updated ${formatRelativeTime(project.lastUpdatedAt)}`}</p>
          {project.lastOpenedAt ? (
            <p>{`Last opened ${formatRelativeTime(project.lastOpenedAt)}`}</p>
          ) : null}
        </div>

        {!getProjectLanguages(project).length ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No programming languages selected yet.
          </p>
        ) : null}

        {!!project.tags?.length && (
          <div className="flex flex-wrap gap-2">
            {project.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onTagClick?.(tag)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition hover:opacity-85 ${getTagClass(tag)}`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        <div className="mt-auto flex justify-end">
          <button
            type="button"
            onClick={() => {
              if (project.isBroken || !project.absolutePath) {
                setIsEditingPath(true)
                return
              }

              void handleOpenEditor(EDITORS[0])
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <FolderOpen className="h-4 w-4" />
            {project.isBroken || !project.absolutePath
              ? 'Set project path'
              : 'Open in VS Code'}
          </button>
        </div>
      </article>

      <ConfirmDialog
        open={isConfirmOpen}
        title="Remove Project"
        message={`Are you sure you want to remove ${project.displayName}? This removes the saved project entry from ProMan.`}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </>
  )
}
