import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Bookmark,
  ChevronDown,
  Copy,
  Plus,
  ExternalLink,
  FolderOpen,
  Link2,
  MoreVertical,
  StickyNote,
} from 'lucide-react'
import { DEFAULT_PROJECT_ENVIRONMENTS } from '../constants/projectEnvironments'
import { Timestamp, deleteField, doc, updateDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { EDITORS } from '../constants/editorSchemes'
import {
  getRepositoryLabel,
  normalizeRepositoryUrl,
  normalizeProjectPath,
  formatRelativeTime,
} from '../utils/formatters'
import {
  getPrimaryProjectLanguage,
  getProjectLanguages,
} from '../utils/projectLanguages'
import {
  getProjectEnvironment,
  getProjectEnvironmentNames,
} from '../utils/projectEnvironments'
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

function toUniqueValues(values = []) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? '').trim())
        .filter(Boolean),
    ),
  )
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
  if (editor.scheme === 'cursor://file/') {
    return 'cursor'
  } else if (editor.scheme === 'antigravity://file/') {
    return 'antigravity'
  } else {
    return 'code'
  }
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
  const [pathDraft, setPathDraft] = useState('')
  const [isEditingRepository, setIsEditingRepository] = useState(false)
  const [repositoryDraft, setRepositoryDraft] = useState(project.repositoryUrl ?? '')
  const [activeEnvironment, setActiveEnvironment] = useState('DEV')
  const [isAddingEnvironment, setIsAddingEnvironment] = useState(false)
  const [environmentDraft, setEnvironmentDraft] = useState('')
  const [isNotesOpen, setIsNotesOpen] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')
  const [isTagEditorOpen, setIsTagEditorOpen] = useState(false)
  const [tagDraft, setTagDraft] = useState((project.tags ?? []).join(', '))
  const [isLanguageEditorOpen, setIsLanguageEditorOpen] = useState(false)
  const [languageDraft, setLanguageDraft] = useState(
    getProjectLanguages(project).join(', '),
  )
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isEditorPickerOpen, setIsEditorPickerOpen] = useState(false)
  const [isNotesExpanded, setIsNotesExpanded] = useState(false)
  const [hasExpandableNotes, setHasExpandableNotes] = useState(false)
  const [environmentMenuState, setEnvironmentMenuState] = useState({
    isOpen: false,
    x: 0,
    y: 0,
    environment: '',
  })
  const [notesMenuState, setNotesMenuState] = useState({
    isOpen: false,
    x: 0,
    y: 0,
    selectedText: '',
  })
  const [selectedEditorScheme, setSelectedEditorScheme] = useState(
    EDITORS[0]?.scheme ?? '',
  )
  const menuRef = useRef(null)
  const editorPickerRef = useRef(null)
  const environmentMenuRef = useRef(null)
  const notesMenuRef = useRef(null)
  const notesPreviewRef = useRef(null)
  const operatingSystem = getOperatingSystem()
  const operatingSystemLabel = getOperatingSystemLabel(operatingSystem)
  const selectedEditor =
    EDITORS.find((editor) => editor.scheme === selectedEditorScheme) ?? EDITORS[0]
  const environmentNames = getProjectEnvironmentNames(project)
  const environmentData = getProjectEnvironment(project, activeEnvironment)

  useEffect(() => {
    setNameDraft(project.displayName ?? 'Untitled project')
  }, [project.displayName])

  useEffect(() => {
    setPathDraft(environmentData.absolutePath ?? '')
  }, [environmentData.absolutePath])

  useEffect(() => {
    setRepositoryDraft(project.repositoryUrl ?? '')
  }, [project.repositoryUrl])

  useEffect(() => {
    setNotesDraft(environmentData.notes ?? '')
  }, [environmentData.notes])

  useEffect(() => {
    setTagDraft((project.tags ?? []).join(', '))
  }, [project.tags])

  useEffect(() => {
    setLanguageDraft(getProjectLanguages(project).join(', '))
  }, [project])

  useEffect(() => {
    if (!environmentNames.includes(activeEnvironment)) {
      setActiveEnvironment(DEFAULT_PROJECT_ENVIRONMENTS[0])
    }
  }, [activeEnvironment, environmentNames])

  useEffect(() => {
    setIsNotesExpanded(false)
  }, [activeEnvironment, environmentData.notes, project.id])

  useEffect(() => {
    if (!environmentData.notes) {
      setHasExpandableNotes(false)
      return
    }

    const previewElement = notesPreviewRef.current

    if (!previewElement) {
      return
    }

    setHasExpandableNotes(previewElement.scrollHeight > previewElement.clientHeight + 1)
  }, [environmentData.notes, activeEnvironment, isNotesExpanded])

  useEffect(() => {
    if (
      !isMenuOpen &&
      !isEditorPickerOpen &&
      !notesMenuState.isOpen &&
      !environmentMenuState.isOpen
    ) {
      return undefined
    }

    function handlePointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false)
      }

      if (
        editorPickerRef.current &&
        !editorPickerRef.current.contains(event.target)
      ) {
        setIsEditorPickerOpen(false)
      }

      if (
        environmentMenuRef.current &&
        !environmentMenuRef.current.contains(event.target)
      ) {
        setEnvironmentMenuState((currentState) => ({
          ...currentState,
          isOpen: false,
        }))
      }

      if (notesMenuRef.current && !notesMenuRef.current.contains(event.target)) {
        setNotesMenuState((currentState) => ({
          ...currentState,
          isOpen: false,
        }))
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [
    environmentMenuState.isOpen,
    isEditorPickerOpen,
    isMenuOpen,
    notesMenuState.isOpen,
  ])

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
    const currentNotes = (environmentData.notes ?? '').trim()
    setIsNotesOpen(false)

    if (nextNotes === currentNotes) {
      return
    }

    const nextPatch = {
      [`environments.${activeEnvironment}.notes`]: nextNotes,
    }

    if (activeEnvironment === 'DEV') {
      nextPatch.notes = nextNotes
    }

    await saveProjectUpdate(
      nextPatch,
      {
        successMessage: nextNotes
          ? `${activeEnvironment} notes updated.`
          : `${activeEnvironment} notes cleared.`,
      },
    )
  }

  function openNotesContextMenu(event) {
    event.preventDefault()

    const nextX = Math.min(event.clientX, window.innerWidth - 220)
    const nextY = Math.min(event.clientY, window.innerHeight - 120)
    const selectedText = window.getSelection?.().toString().trim() ?? ''

    setNotesMenuState({
      isOpen: true,
      x: Math.max(12, nextX),
      y: Math.max(12, nextY),
      selectedText,
    })
  }

  function handleNotesClick() {
    addToast(
      environmentData.notes
        ? `Right-click the notes area and choose Edit Notes to update the ${activeEnvironment} note.`
        : `Right-click the notes button and choose Edit Notes to add a ${activeEnvironment} note.`,
      'info',
    )
  }

  function startEditingNotes() {
    setNotesMenuState((currentState) => ({
      ...currentState,
      isOpen: false,
    }))
    setIsNotesOpen(true)
  }

  function handleEnvironmentSelect(environment) {
    setActiveEnvironment(environment)
    setIsEditingPath(false)
    setIsNotesOpen(false)
    setEnvironmentMenuState((currentState) => ({
      ...currentState,
      isOpen: false,
    }))
    setNotesMenuState((currentState) => ({
      ...currentState,
      isOpen: false,
    }))
  }

  async function handleCopyNotesText() {
    const nextText = notesMenuState.selectedText || (environmentData.notes ?? '')

    if (!nextText) {
      addToast('There is no notes text to copy yet.', 'info')
      setNotesMenuState((currentState) => ({
        ...currentState,
        isOpen: false,
      }))
      return
    }

    try {
      await navigator.clipboard.writeText(nextText)
      addToast(
        notesMenuState.selectedText
          ? 'Selected notes text copied.'
          : 'Notes text copied.',
        'success',
      )
    } catch {
      addToast('Unable to copy the notes text right now.', 'error')
    } finally {
      setNotesMenuState((currentState) => ({
        ...currentState,
        isOpen: false,
      }))
    }
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

  async function commitLanguages() {
    const nextLanguages = toUniqueValues(languageDraft.split(','))

    setIsLanguageEditorOpen(false)

    if (!nextLanguages.length) {
      addToast('Add at least one programming language for this project.', 'error')
      setLanguageDraft(getProjectLanguages(project).join(', '))
      return
    }

    const currentLanguages = getProjectLanguages(project)

    if (arraysMatch(nextLanguages, currentLanguages)) {
      return
    }

    await saveProjectUpdate(
      {
        languagesList: nextLanguages,
        primaryLanguage: nextLanguages[0] ?? 'Other',
      },
      { successMessage: 'Programming languages updated.' },
    )
  }

  async function handleAddEnvironment() {
    const nextEnvironment = environmentDraft.trim().toUpperCase()

    if (!nextEnvironment) {
      addToast('Type an environment name before adding it.', 'info')
      return
    }

    if (environmentNames.includes(nextEnvironment)) {
      addToast(`${nextEnvironment} already exists on this project.`, 'info')
      setActiveEnvironment(nextEnvironment)
      setEnvironmentDraft('')
      setIsAddingEnvironment(false)
      return
    }

    await saveProjectUpdate(
      {
        [`environments.${nextEnvironment}`]: {
          absolutePath: '',
          notes: '',
          isBroken: false,
          lastOpenedAt: null,
        },
      },
      { successMessage: `${nextEnvironment} environment added.` },
    )

    setActiveEnvironment(nextEnvironment)
    setEnvironmentDraft('')
    setIsAddingEnvironment(false)
  }

  function openEnvironmentContextMenu(event, environment) {
    if (DEFAULT_PROJECT_ENVIRONMENTS.includes(environment)) {
      return
    }

    event.preventDefault()

    const nextX = Math.min(event.clientX, window.innerWidth - 220)
    const nextY = Math.min(event.clientY, window.innerHeight - 120)

    setEnvironmentMenuState({
      isOpen: true,
      x: Math.max(12, nextX),
      y: Math.max(12, nextY),
      environment,
    })
  }

  async function handleRemoveEnvironment() {
    const targetEnvironment = environmentMenuState.environment

    if (
      !targetEnvironment ||
      DEFAULT_PROJECT_ENVIRONMENTS.includes(targetEnvironment)
    ) {
      setEnvironmentMenuState((currentState) => ({
        ...currentState,
        isOpen: false,
      }))
      return
    }

    const nextEnvironmentNames = environmentNames.filter(
      (environment) => environment !== targetEnvironment,
    )
    const nextActiveEnvironment = nextEnvironmentNames.includes(activeEnvironment)
      ? activeEnvironment
      : DEFAULT_PROJECT_ENVIRONMENTS[0]

    const didRemoveEnvironment = await saveProjectUpdate(
      { [`environments.${targetEnvironment}`]: deleteField() },
      { successMessage: `${targetEnvironment} environment removed.` },
    )

    if (!didRemoveEnvironment) {
      return
    }

    setActiveEnvironment(nextActiveEnvironment)
    setEnvironmentMenuState({
      isOpen: false,
      x: 0,
      y: 0,
      environment: '',
    })
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
    const targetPath = normalizeProjectPath(environmentData.absolutePath)

    if (environmentData.isBroken || !targetPath) {
      setIsEditingPath(true)
      addToast(
        `Set the correct ${activeEnvironment} project path before opening this project in your editor.`,
        'info',
      )
      return
    }

    try {
      openEditorInNewBrowserContext(`${editor.scheme}${encodeURI(targetPath)}`)

      await saveProjectUpdate(
        {
          [`environments.${activeEnvironment}.lastOpenedAt`]: Timestamp.now(),
          [`environments.${activeEnvironment}.isBroken`]: false,
          lastOpenedAt: Timestamp.now(),
        },
        {
          successMessage: `Sent ${project.displayName} ${activeEnvironment} to ${editor.label.replace('Open in ', '')}. If your editor reuses the current window, use the new-window command in the menu.`,
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
    const targetPath = normalizeProjectPath(environmentData.absolutePath)

    if (environmentData.isBroken || !targetPath) {
      setIsEditingPath(true)
      addToast(
        `Set the correct ${activeEnvironment} project path before copying a launch command.`,
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

  function handleOpenRepository() {
    const targetUrl = normalizeRepositoryUrl(project.repositoryUrl)

    if (!targetUrl) {
      setIsEditingRepository(true)
      addToast('Add a valid repository URL before opening the repository.', 'info')
      return
    }

    window.open(targetUrl, '_blank', 'noopener,noreferrer')
  }

  async function handleSelectEditor(editor) {
    setSelectedEditorScheme(editor.scheme)
    setIsEditorPickerOpen(false)
    await handleOpenEditor(editor)
  }

  async function commitPath() {
    const nextPath = normalizeProjectPath(pathDraft)
    const currentPath = normalizeProjectPath(environmentData.absolutePath)
    setIsEditingPath(false)

    if (nextPath === currentPath) {
      setPathDraft(environmentData.absolutePath ?? '')
      return
    }

    const nextPatch = {
      [`environments.${activeEnvironment}.absolutePath`]: nextPath,
      [`environments.${activeEnvironment}.isBroken`]: !nextPath,
    }

    if (activeEnvironment === 'DEV') {
      nextPatch.absolutePath = nextPath
      nextPatch.isBroken = !nextPath
    }

    await saveProjectUpdate(
      nextPatch,
      {
        successMessage: nextPath
          ? `${activeEnvironment} path updated.`
          : `${activeEnvironment} path cleared. Add a local path to re-enable IDE shortcuts.`,
        errorMessage: 'Unable to update that project path right now.',
      },
    )
  }

  async function commitRepository() {
    const hasTypedRepository = Boolean(repositoryDraft.trim())
    const nextRepositoryUrl = hasTypedRepository
      ? normalizeRepositoryUrl(repositoryDraft)
      : ''
    const currentRepositoryUrl = normalizeRepositoryUrl(project.repositoryUrl)
    setIsEditingRepository(false)

    if (hasTypedRepository && !nextRepositoryUrl) {
      addToast(
        'Add a valid repository URL like https://github.com/owner/repository.',
        'error',
      )
      setRepositoryDraft(project.repositoryUrl ?? '')
      return
    }

    if (nextRepositoryUrl === currentRepositoryUrl) {
      setRepositoryDraft(project.repositoryUrl ?? '')
      return
    }

    await saveProjectUpdate(
      { repositoryUrl: nextRepositoryUrl },
      {
        successMessage: nextRepositoryUrl
          ? currentRepositoryUrl
            ? 'Repository link updated.'
            : 'Repository link added.'
          : 'Repository link removed.',
        errorMessage: 'Unable to update that repository link right now.',
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
              onClick={handleNotesClick}
              onContextMenu={openNotesContextMenu}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/10 dark:hover:text-blue-200"
              aria-label="Notes actions"
              title="Right-click to edit notes"
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
                      setIsLanguageEditorOpen(true)
                    }}
                    className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Add/edit languages
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
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false)
                      setIsEditingRepository(true)
                    }}
                    className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Edit repository link
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

          <div className="flex flex-wrap gap-2">
            {environmentNames.map((environment) => {
              const isActive = environment === activeEnvironment
              const hasEnvironmentPath = Boolean(
                getProjectEnvironment(project, environment).absolutePath,
              )

              return (
                <button
                  key={environment}
                  type="button"
                  onClick={() => handleEnvironmentSelect(environment)}
                  onContextMenu={(event) =>
                    openEnvironmentContextMenu(event, environment)
                  }
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : hasEnvironmentPath
                        ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/20'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                  title={
                    DEFAULT_PROJECT_ENVIRONMENTS.includes(environment)
                      ? environment
                      : `${environment} (right-click for actions)`
                  }
                >
                  {environment}
                </button>
              )
            })}
            {isAddingEnvironment ? (
              <input
                autoFocus
                type="text"
                value={environmentDraft}
                onChange={(event) => setEnvironmentDraft(event.target.value)}
                onBlur={() => {
                  if (!environmentDraft.trim()) {
                    setIsAddingEnvironment(false)
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void handleAddEnvironment()
                  }

                  if (event.key === 'Escape') {
                    setIsAddingEnvironment(false)
                    setEnvironmentDraft('')
                  }
                }}
                placeholder="QA"
                className="w-24 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase text-slate-900 outline-none focus:border-blue-400 dark:border-blue-500/40 dark:bg-slate-800 dark:text-white"
              />
            ) : (
              <button
                type="button"
                onClick={() => setIsAddingEnvironment(true)}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-blue-200 px-3 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 dark:border-blue-500/30 dark:text-blue-200 dark:hover:bg-blue-500/10"
              >
                <Plus className="h-3.5 w-3.5" />
                Add env
              </button>
            )}
          </div>

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
                    setPathDraft(environmentData.absolutePath ?? '')
                  }
                }}
                placeholder={`Add the ${activeEnvironment} path, for example /Users/...`}
                className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 dark:border-blue-500/40 dark:bg-slate-800 dark:text-white"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Paste the local folder path you want VS Code or Cursor or Antigravity to open
                for the {activeEnvironment} environment. ProMana will clean
                `code /Users/...` into the stored path
                automatically.
              </p>
            </div>
          ) : (
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => setIsEditingPath(true)}
                className="truncate text-left text-sm text-slate-500 transition hover:text-blue-700 dark:text-slate-400 dark:hover:text-blue-200"
                title={
                  environmentData.absolutePath || `Set ${activeEnvironment} path`
                }
              >
                {environmentData.absolutePath ||
                  `Set ${activeEnvironment} path to enable IDE shortcuts`}
              </button>

              {environmentData.notes ? (
                <div
                  onContextMenu={openNotesContextMenu}
                  className="mt-2 cursor-text select-text overflow-hidden rounded-2xl border border-blue-200 bg-blue-50 px-3 py-3 text-left text-sm leading-6 text-slate-700 transition hover:border-blue-300 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-slate-200 dark:hover:border-blue-400/40"
                  title={environmentData.notes}
                >
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                    {`${activeEnvironment} Notes`}
                  </span>
                  <span
                    ref={notesPreviewRef}
                    className={`block whitespace-pre-wrap break-words ${
                      isNotesExpanded ? '' : 'max-h-[4.5rem] overflow-hidden'
                    }`}
                  >
                    {environmentData.notes}
                  </span>
                  {hasExpandableNotes ? (
                    <button
                      type="button"
                      onClick={() =>
                        setIsNotesExpanded((currentState) => !currentState)
                      }
                      className="mt-3 text-xs font-semibold text-blue-700 transition hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
                    >
                      {isNotesExpanded ? 'View less' : 'View more'}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {isEditingRepository ? (
                <div className="grid gap-2">
                  <input
                    autoFocus
                    type="text"
                    value={repositoryDraft}
                    onChange={(event) => setRepositoryDraft(event.target.value)}
                    onBlur={commitRepository}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void commitRepository()
                      }

                      if (event.key === 'Escape') {
                        setIsEditingRepository(false)
                        setRepositoryDraft(project.repositoryUrl ?? '')
                      }
                    }}
                    placeholder="https://github.com/owner/repository"
                    className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 dark:border-blue-500/40 dark:bg-slate-800 dark:text-white"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Add a repository link so this card can open the repo in a
                    browser tab.
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (project.repositoryUrl) {
                      handleOpenRepository()
                      return
                    }

                    setIsEditingRepository(true)
                  }}
                  className={`inline-flex items-center gap-2 text-left text-xs font-semibold transition ${
                    project.repositoryUrl
                      ? 'text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200'
                      : 'text-slate-500 hover:text-blue-700 dark:text-slate-400 dark:hover:text-blue-200'
                  }`}
                  title={
                    project.repositoryUrl
                      ? project.repositoryUrl
                      : 'Add repository link'
                  }
                >
                  <Link2 className="h-3.5 w-3.5" />
                  <span className="max-w-[13rem] truncate">
                    {project.repositoryUrl
                      ? getRepositoryLabel(project.repositoryUrl)
                      : 'Add repository link'}
                  </span>
                  {project.repositoryUrl ? (
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  ) : null}
                </button>
              )}
            </div>
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

        {isLanguageEditorOpen && (
          <div className="grid gap-2">
            <input
              autoFocus
              type="text"
              value={languageDraft}
              onChange={(event) => setLanguageDraft(event.target.value)}
              onBlur={commitLanguages}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void commitLanguages()
                }

                if (event.key === 'Escape') {
                  setIsLanguageEditorOpen(false)
                  setLanguageDraft(getProjectLanguages(project).join(', '))
                }
              }}
              placeholder="TypeScript, Go, Kotlin"
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Separate multiple languages with commas. You can add custom
              languages even if they are not in ProMana&apos;s default list.
            </p>
          </div>
        )}

        {isNotesOpen && (
          <textarea
            autoFocus
            rows={4}
            value={notesDraft}
            onChange={(event) => setNotesDraft(event.target.value)}
            onBlur={commitNotes}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setIsNotesOpen(false)
                setNotesDraft(environmentData.notes ?? '')
              }
            }}
            placeholder={`Capture ${activeEnvironment} notes, repo reminders, or local setup steps...`}
            className="resize-none rounded-2xl border border-gray-200 px-3 py-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
          />
        )}

        <LanguageBar languages={project.languagesList ?? project.languages} />

        <div className="grid gap-1 text-sm text-slate-500 dark:text-slate-400">
          <p>{`Updated ${formatRelativeTime(project.lastUpdatedAt)}`}</p>
          {environmentData.lastOpenedAt ? (
            <p>{`Last opened ${formatRelativeTime(environmentData.lastOpenedAt)}`}</p>
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
          {environmentData.isBroken || !environmentData.absolutePath ? (
            <button
              type="button"
              onClick={() => setIsEditingPath(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <FolderOpen className="h-4 w-4" />
              {`Set ${activeEnvironment} path`}
            </button>
          ) : (
            <div className="relative inline-flex" ref={editorPickerRef}>
              <button
                type="button"
                onClick={() => {
                  if (selectedEditor) {
                    void handleOpenEditor(selectedEditor)
                  }
                }}
                className="inline-flex items-center justify-center gap-2 rounded-l-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                <FolderOpen className="h-4 w-4" />
                {selectedEditor?.label ?? 'Open project'}
              </button>

              <button
                type="button"
                onClick={() => setIsEditorPickerOpen((current) => !current)}
                className="inline-flex items-center justify-center rounded-r-xl border-l border-white/20 bg-blue-600 px-3 text-white transition hover:bg-blue-700"
                aria-label="Choose editor"
              >
                <ChevronDown className="h-4 w-4" />
              </button>

              {isEditorPickerOpen && (
                <div className="absolute bottom-14 right-0 z-20 min-w-56 rounded-2xl border border-gray-100 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-950">
                  {EDITORS.map((editor) => {
                    const isSelected = editor.scheme === selectedEditor?.scheme

                    return (
                      <button
                        key={editor.scheme}
                        type="button"
                        onClick={() => {
                          void handleSelectEditor(editor)
                        }}
                        className={`w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                          isSelected
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200'
                            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                        }`}
                      >
                        {editor.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </article>

      {notesMenuState.isOpen ? (
        <div
          ref={notesMenuRef}
          className="fixed z-40 min-w-44 rounded-2xl border border-gray-100 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-950"
          style={{ left: notesMenuState.x, top: notesMenuState.y }}
        >
          <button
            type="button"
            onClick={() => {
              void handleCopyNotesText()
            }}
            className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {notesMenuState.selectedText ? 'Copy selected text' : 'Copy notes text'}
          </button>
          <button
            type="button"
            onClick={startEditingNotes}
            className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Edit Notes
          </button>
        </div>
      ) : null}

      {environmentMenuState.isOpen ? (
        <div
          ref={environmentMenuRef}
          className="fixed z-40 min-w-44 rounded-2xl border border-gray-100 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-950"
          style={{ left: environmentMenuState.x, top: environmentMenuState.y }}
        >
          <button
            type="button"
            onClick={() => {
              void handleRemoveEnvironment()
            }}
            className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"
          >
            Remove env
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        open={isConfirmOpen}
        title="Remove Project"
        message={`Are you sure you want to remove ${project.displayName}? This removes the saved project entry from ProMana.`}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </>
  )
}
