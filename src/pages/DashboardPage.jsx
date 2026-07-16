import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import {
  FolderPlus,
  ListTodo,
  LoaderCircle,
  SearchX,
  StickyNote,
  X,
} from 'lucide-react'
import AddLaunchpadModal from '../components/AddLaunchpadModal'
import ConfirmDialog from '../components/ConfirmDialog'
import EditorManagerModal from '../components/EditorManagerModal'
import Header from '../components/Header'
import LaunchpadGrid from '../components/LaunchpadGrid'
import NoteModal from '../components/NoteModal'
import NotesGrid from '../components/NotesGrid'
import MadeByFooter from '../components/MadeByFooter'
import ProjectCard from '../components/ProjectCard'
import SearchBar from '../components/SearchBar'
import SkeletonCard from '../components/SkeletonCard'
import SortFilterBar from '../components/SortFilterBar'
import TaskGroupCard from '../components/TaskGroupCard'
import TaskGroupModal from '../components/TaskGroupModal'
import TaskGroupSkeletonCard from '../components/TaskGroupSkeletonCard'
import ToastContainer from '../components/ToastContainer'
import { LANGUAGE_COLORS } from '../constants/languageColors'
import {
  getLaunchpadCategoryLabel,
  getLaunchpadCategoryOptions,
} from '../constants/launchpadCategories'
import {
  NOTE_LANGUAGE_OPTIONS,
  NOTE_TYPE_OPTIONS,
  getNoteLanguageLabel,
  getNoteTypeLabel,
} from '../constants/noteOptions'
import { DEFAULT_PROJECT_ENVIRONMENTS } from '../constants/projectEnvironments'
import { TASK_STATUS_OPTIONS } from '../constants/taskStatuses'
import { auth, db } from '../firebase'
import useAuth from '../hooks/useAuth'
import useCustomEditors from '../hooks/useCustomEditors'
import useLightBackgroundColor from '../hooks/useLightBackgroundColor'
import useLaunchpad from '../hooks/useLaunchpad'
import useNotes from '../hooks/useNotes'
import useProjects from '../hooks/useProjects'
import useTaskGroups from '../hooks/useTaskGroups'
import useToast from '../hooks/useToast'
import useUserLimits from '../hooks/useUserLimits'
import {
  getTimeValue,
  normalizeProjectPath,
  normalizeRepositoryUrl,
} from '../utils/formatters'
import { getStoredLightBackgroundColor } from '../utils/lightBackground'
import {
  getPrimaryProjectLanguage,
  getProjectLanguages,
} from '../utils/projectLanguages'
import {
  buildProjectEnvironments,
  getProjectPathValues,
} from '../utils/projectEnvironments'

function isTypingTarget(element) {
  if (!element) {
    return false
  }

  const tagName = element.tagName
  return (
    element.isContentEditable ||
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT'
  )
}

function compareProjects(left, right, sort) {
  if (sort === 'name') {
    return (left.displayName ?? '').localeCompare(right.displayName ?? '')
  }

  if (sort === 'lastOpened') {
    return getTimeValue(right.lastOpenedAt) - getTimeValue(left.lastOpenedAt)
  }

  if (sort === 'language') {
    return getPrimaryProjectLanguage(left).localeCompare(
      getPrimaryProjectLanguage(right),
    )
  }

  return getTimeValue(right.lastUpdatedAt) - getTimeValue(left.lastUpdatedAt)
}

function getImportErrorMessage(error) {
  if (error?.code === 'permission-denied') {
    return 'Adding the project failed because Firestore denied the write. Check your Firestore rules and make sure you are signed in.'
  }

  if (error?.code === 'unavailable') {
    return 'Adding the project failed because Firestore is unavailable right now. Please try again in a moment.'
  }

  return 'Unable to add that project right now.'
}

const MANUAL_LANGUAGE_OPTIONS = Object.keys(LANGUAGE_COLORS).filter(
  (language) => language !== 'Other',
)

function toUniqueLanguages(languages = []) {
  return Array.from(
    new Set(
      languages
        .map((language) => String(language ?? '').trim())
        .filter(Boolean),
    ),
  )
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const {
    lightBackgroundColor,
    setLightBackgroundColor,
    resetLightBackgroundColor,
  } = useLightBackgroundColor()
  const { projects, loading: projectsLoading, error } = useProjects(user?.uid)
  const {
    items: launchpadItems,
    loading: launchpadLoading,
    error: launchpadError,
  } = useLaunchpad()
  const { notes, loading: notesLoading, error: notesError } = useNotes(user?.uid)
  const {
    taskGroups,
    loading: taskGroupsLoading,
    error: taskGroupsError,
  } = useTaskGroups(user?.uid)
  const {
    editors: customEditors,
    error: customEditorsError,
    saveCustomEditors,
  } = useCustomEditors(user?.uid)
  const {
    limits,
    loading: limitsLoading,
    error: limitsError,
  } = useUserLimits(user)
  const { toasts, addToast, removeToast } = useToast()
  const [dashboardMode, setDashboardMode] = useState(
    () => window.localStorage.getItem('proman-dashboard-mode') || 'projects',
  )
  const [search, setSearch] = useState('')
  const [launchpadSearch, setLaunchpadSearch] = useState('')
  const [launchpadFilterCategory, setLaunchpadFilterCategory] = useState('all')
  const [notesSearch, setNotesSearch] = useState('')
  const [notesFilterType, setNotesFilterType] = useState('all')
  const [notesFilterLanguage, setNotesFilterLanguage] = useState('all')
  const [notesFilterTag, setNotesFilterTag] = useState('all')
  const [tasksSearch, setTasksSearch] = useState('')
  const [tasksFilterStatus, setTasksFilterStatus] = useState('all')
  const [tasksFilterTag, setTasksFilterTag] = useState('all')
  const [sort, setSort] = useState('lastUpdated')
  const [filterLang, setFilterLang] = useState('all')
  const [filterTag, setFilterTag] = useState('all')
  const [darkMode, setDarkMode] = useState(
    () => window.localStorage.getItem('proman-theme') === 'dark',
  )
  const [isManualImportOpen, setIsManualImportOpen] = useState(false)
  const [manualImportState, setManualImportState] = useState({
    active: false,
    message: '',
  })
  const [isAddLaunchpadOpen, setIsAddLaunchpadOpen] = useState(false)
  const [isEditorManagerOpen, setIsEditorManagerOpen] = useState(false)
  const [isSavingCustomEditors, setIsSavingCustomEditors] = useState(false)
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false)
  const [activeNote, setActiveNote] = useState(null)
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [isTaskGroupModalOpen, setIsTaskGroupModalOpen] = useState(false)
  const [activeTaskGroup, setActiveTaskGroup] = useState(null)
  const [isSavingTaskGroup, setIsSavingTaskGroup] = useState(false)
  const [taskGroupToDelete, setTaskGroupToDelete] = useState(null)
  const [projectDraft, setProjectDraft] = useState({
    displayName: '',
    absolutePath: '',
    repositoryUrl: '',
    languagesList: [],
    customLanguage: '',
  })
  const searchInputRef = useRef(null)
  const launchpadSearchInputRef = useRef(null)
  const notesSearchInputRef = useRef(null)
  const tasksSearchInputRef = useRef(null)
  const maxProjects = limits.maxProjects
  const maxWebsites = limits.maxWebsites
  const maxNotes = limits.maxNotes
  const isProPlan = limits.plan === 'pro'
  const planLabel = isProPlan ? 'Pro plan' : 'Free plan'
  const usedProjectCount = projects.length
  const usedWebsiteCount = launchpadItems.length
  const usedNoteCount = notes.length
  const usedTaskGroupCount = taskGroups.length
  const totalTaskPointCount = taskGroups.reduce(
    (total, taskGroup) => total + taskGroup.tasks.length,
    0,
  )
  const completedTaskPointCount = taskGroups.reduce(
    (total, taskGroup) =>
      total + taskGroup.tasks.filter((task) => task.status === 'done').length,
    0,
  )
  const hasReachedProjectLimit = !isProPlan && usedProjectCount >= maxProjects
  const hasReachedWebsiteLimit = !isProPlan && usedWebsiteCount >= maxWebsites
  const hasReachedNoteLimit = !isProPlan && usedNoteCount >= maxNotes
  const remainingProjectSlots = Math.max(0, maxProjects - usedProjectCount)
  const remainingWebsiteSlots = Math.max(0, maxWebsites - usedWebsiteCount)
  const remainingNoteSlots = Math.max(0, maxNotes - usedNoteCount)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    window.localStorage.setItem('proman-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    window.localStorage.setItem('proman-dashboard-mode', dashboardMode)
  }, [dashboardMode])

  useEffect(() => {
    function handleKeyDown(event) {
      if (
        event.key !== '/' ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTypingTarget(document.activeElement)
      ) {
        return
      }

      event.preventDefault()
      if (dashboardMode === 'launchpad') {
        launchpadSearchInputRef.current?.focus()
      } else if (dashboardMode === 'notes') {
        notesSearchInputRef.current?.focus()
      } else if (dashboardMode === 'tasks') {
        tasksSearchInputRef.current?.focus()
      } else {
        searchInputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [dashboardMode])

  useEffect(() => {
    if (error) {
      addToast('Realtime sync hit an issue. Please try refreshing.', 'error')
    }
  }, [addToast, error])

  useEffect(() => {
    if (launchpadError) {
      addToast('Launchpad sync hit an issue. Please try refreshing.', 'error')
    }
  }, [addToast, launchpadError])

  useEffect(() => {
    if (notesError) {
      addToast('Notes sync hit an issue. Please try refreshing.', 'error')
    }
  }, [addToast, notesError])

  useEffect(() => {
    if (taskGroupsError) {
      addToast('Tasks sync hit an issue. Please try refreshing.', 'error')
    }
  }, [addToast, taskGroupsError])

  useEffect(() => {
    if (customEditorsError) {
      addToast('Custom IDE settings could not be synced. Please try refreshing.', 'error')
    }
  }, [addToast, customEditorsError])

  useEffect(() => {
    if (limitsError) {
      addToast('Account limits could not be loaded. Using default free-plan limits.', 'info')
    }
  }, [addToast, limitsError])

  useEffect(() => {
    if (hasReachedProjectLimit && isManualImportOpen) {
      setIsManualImportOpen(false)
      resetProjectDraft()
    }
  }, [hasReachedProjectLimit, isManualImportOpen])

  useEffect(() => {
    if (hasReachedWebsiteLimit && isAddLaunchpadOpen) {
      setIsAddLaunchpadOpen(false)
    }
  }, [hasReachedWebsiteLimit, isAddLaunchpadOpen])

  useEffect(() => {
    if (hasReachedNoteLimit && isNoteModalOpen && !activeNote?.id) {
      setIsNoteModalOpen(false)
      setActiveNote(null)
    }
  }, [activeNote?.id, hasReachedNoteLimit, isNoteModalOpen])

  const availableLangs = useMemo(
    () =>
      Array.from(
        new Set(projects.flatMap((project) => getProjectLanguages(project))),
      ).sort((left, right) => left.localeCompare(right)),
    [projects],
  )

  const availableTags = useMemo(
    () =>
      Array.from(
        new Set(projects.flatMap((project) => project.tags ?? []).filter(Boolean)),
      ).sort((left, right) => left.localeCompare(right)),
    [projects],
  )

  const availableNoteLanguages = useMemo(
    () =>
      Array.from(
        new Set(notes.map((note) => note.language).filter(Boolean)),
      ).sort((left, right) => left.localeCompare(right)),
    [notes],
  )

  const availableNoteTags = useMemo(
    () =>
      Array.from(
        new Set(notes.flatMap((note) => note.tags ?? []).filter(Boolean)),
      ).sort((left, right) => left.localeCompare(right)),
    [notes],
  )

  const availableTaskTags = useMemo(
    () =>
      Array.from(
        new Set(
          taskGroups
            .flatMap((taskGroup) => taskGroup.tags ?? [])
            .filter(Boolean),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [taskGroups],
  )

  const visibleTaskGroups = useMemo(() => {
    const searchTerm = tasksSearch.trim().toLowerCase()

    return taskGroups.filter((taskGroup) => {
      const searchableText = [
        taskGroup.title,
        taskGroup.note,
        ...(taskGroup.tags ?? []),
        ...taskGroup.tasks.map((task) => task.text),
      ]
        .join(' ')
        .toLowerCase()
      const matchesSearch = !searchTerm || searchableText.includes(searchTerm)
      const matchesTag =
        tasksFilterTag === 'all' ||
        (taskGroup.tags ?? []).some(
          (tag) => tag.toLowerCase() === tasksFilterTag.toLowerCase(),
        )
      const matchesStatus =
        tasksFilterStatus === 'all' ||
        taskGroup.tasks.some((task) => task.status === tasksFilterStatus)

      return matchesSearch && matchesTag && matchesStatus
    })
  }, [taskGroups, tasksFilterStatus, tasksFilterTag, tasksSearch])

  const launchpadCategoryOptions = useMemo(
    () =>
      getLaunchpadCategoryOptions([
        ...launchpadItems.map((item) => item.category),
        launchpadFilterCategory === 'all' ? '' : launchpadFilterCategory,
      ]),
    [launchpadFilterCategory, launchpadItems],
  )

  const visibleProjects = useMemo(() => {
    const searchTerm = search.trim().toLowerCase()

    return [...projects]
      .filter((project) => {
        const matchesSearch =
          !searchTerm ||
          (project.displayName ?? '').toLowerCase().includes(searchTerm) ||
          getProjectPathValues(project).some((path) =>
            path.toLowerCase().includes(searchTerm),
          )

        const matchesLanguage =
          filterLang === 'all' ||
          getProjectLanguages(project).includes(filterLang)

        const matchesTag =
          filterTag === 'all' ||
          (project.tags ?? []).some(
            (tag) => tag.toLowerCase() === filterTag.toLowerCase(),
          )

        return matchesSearch && matchesLanguage && matchesTag
      })
      .sort((left, right) => compareProjects(left, right, sort))
  }, [filterLang, filterTag, projects, search, sort])

  const pinnedProjects = visibleProjects.filter((project) => project.isPinned)
  const regularProjects = visibleProjects.filter((project) => !project.isPinned)

  function resetProjectDraft() {
    setProjectDraft({
      displayName: '',
      absolutePath: '',
      repositoryUrl: '',
      languagesList: [],
      customLanguage: '',
    })
  }

  function handleLanguageToggle(language) {
    setProjectDraft((currentDraft) => {
      const hasLanguage = currentDraft.languagesList.includes(language)

      return {
        ...currentDraft,
        languagesList: hasLanguage
          ? currentDraft.languagesList.filter(
              (currentLanguage) => currentLanguage !== language,
            )
          : [...currentDraft.languagesList, language],
      }
    })
  }

  function handleCustomLanguageAdd() {
    const nextLanguage = projectDraft.customLanguage.trim()

    if (!nextLanguage) {
      addToast('Type a programming language name before adding it.', 'info')
      return
    }

    setProjectDraft((currentDraft) => ({
      ...currentDraft,
      languagesList: toUniqueLanguages([
        ...currentDraft.languagesList,
        nextLanguage,
      ]),
      customLanguage: '',
    }))
  }

  function openManualImport() {
    if (hasReachedProjectLimit) {
      addToast(
        `You can only import ${maxProjects} projects here. Remove one before adding another.`,
        'error',
      )
      return
    }

    setIsManualImportOpen(true)
  }

  function openLaunchpadImport() {
    if (hasReachedWebsiteLimit) {
      addToast(
        `You can only save ${maxWebsites} website shortcuts here. Remove one before adding another.`,
        'error',
      )
      return
    }

    setIsAddLaunchpadOpen(true)
  }

  function openNoteComposer(note = null) {
    if (!note?.id && hasReachedNoteLimit) {
      addToast(
        `You can only save ${maxNotes} notes here. Remove one before adding another.`,
        'error',
      )
      return
    }

    setActiveNote(note)
    setIsNoteModalOpen(true)
  }

  async function handleManualImportSubmit(event) {
    event.preventDefault()

    if (!user) {
      addToast('You need to be signed in to add projects.', 'error')
      return
    }

    if (hasReachedProjectLimit) {
      addToast(
        `You can only import ${maxProjects} projects here. Remove one before adding another.`,
        'error',
      )
      return
    }

    const absolutePath = normalizeProjectPath(projectDraft.absolutePath)
    const repositoryUrl = projectDraft.repositoryUrl.trim()
      ? normalizeRepositoryUrl(projectDraft.repositoryUrl)
      : ''

    if (!absolutePath) {
      addToast('Add the local project path before saving.', 'error')
      return
    }

    if (projectDraft.repositoryUrl.trim() && !repositoryUrl) {
      addToast(
        'Add a valid repository URL like https://github.com/owner/repository.',
        'error',
      )
      return
    }

    const normalizedLanguagesList = toUniqueLanguages(projectDraft.languagesList)
    const languagesList = normalizedLanguagesList.length
      ? normalizedLanguagesList
      : ['Other']
    const displayName =
      projectDraft.displayName.trim()
    const timestamp = Timestamp.now()
    const environments = buildProjectEnvironments({
      absolutePath,
      notes: '',
      isBroken: false,
      lastOpenedAt: null,
    })

    setManualImportState({
      active: true,
      message: `Adding ${displayName} to your dashboard...`,
    })

    try {
      await addDoc(collection(db, 'users', user.uid, 'projects'), {
        displayName,
        absolutePath,
        repositoryUrl,
        environments,
        primaryLanguage: languagesList[0] ?? 'Other',
        languagesList,
        tags: [],
        notes: '',
        isPinned: false,
        isBroken: false,
        createdAt: timestamp,
        lastUpdatedAt: timestamp,
        lastOpenedAt: null,
      })

      resetProjectDraft()
      setIsManualImportOpen(false)
      addToast(`Added ${displayName}.`, 'success')
    } catch (error) {
      addToast(getImportErrorMessage(error), 'error')
    } finally {
      setManualImportState({ active: false, message: '' })
    }
  }

  async function handleDeleteProject(project) {
    if (!user) {
      addToast('You need to be signed in to remove projects.', 'error')
      return
    }

    try {
      await deleteDoc(doc(db, 'users', user.uid, 'projects', project.id))
      addToast(`Removed ${project.displayName}.`, 'success')
    } catch {
      addToast('Unable to remove that project right now.', 'error')
    }
  }

  async function handleDeleteLaunchpadItem(item) {
    const uid = auth.currentUser?.uid

    if (!uid) {
      addToast('You need to be signed in to remove shortcuts.', 'error')
      return false
    }

    try {
      await deleteDoc(doc(db, 'users', uid, 'launchpad', item.id))
      addToast('Shortcut removed.', 'success')
      return true
    } catch {
      addToast('Unable to remove that shortcut.', 'error')
      return false
    }
  }

  async function handleUpdateLaunchpadItem(item, patch) {
    const uid = auth.currentUser?.uid

    if (!uid) {
      addToast('You need to be signed in to update shortcuts.', 'error')
      return false
    }

    try {
      await updateDoc(doc(db, 'users', uid, 'launchpad', item.id), patch)
      return true
    } catch {
      addToast('Unable to update that shortcut.', 'error')
      return false
    }
  }

  async function handleToggleLaunchpadPin(item) {
    const didTogglePin = await handleUpdateLaunchpadItem(item, {
      isPinned: !item.isPinned,
    })

    if (!didTogglePin) {
      return
    }

    addToast(item.isPinned ? 'Unpinned.' : 'Pinned to top.', 'success')
  }

  async function handleSaveCustomEditors(nextEditors) {
    setIsSavingCustomEditors(true)

    try {
      await saveCustomEditors(nextEditors)
      addToast('Project IDEs updated.', 'success')
      return true
    } catch (error) {
      addToast(error?.message || 'Unable to save custom IDEs right now.', 'error')
      return false
    } finally {
      setIsSavingCustomEditors(false)
    }
  }

  async function handleSaveNote(noteDraft) {
    if (!user) {
      addToast('You need to be signed in to save notes.', 'error')
      return
    }

    if (!noteDraft.content.trim()) {
      addToast('Add note content before saving.', 'error')
      return
    }

    if (!activeNote?.id && hasReachedNoteLimit) {
      addToast(
        `You can only save ${maxNotes} notes here. Remove one before adding another.`,
        'error',
      )
      return
    }

    setIsSavingNote(true)

    const title = noteDraft.title || getNoteTypeLabel(noteDraft.type)
    const timestamp = Timestamp.now()
    const payload = {
      title,
      type: noteDraft.type,
      language: noteDraft.language,
      tags: noteDraft.tags ?? [],
      content: noteDraft.content.trimEnd(),
      isPinned: activeNote?.isPinned ?? false,
      lastUpdatedAt: timestamp,
    }

    try {
      if (activeNote?.id) {
        await updateDoc(doc(db, 'users', user.uid, 'notes', activeNote.id), payload)
        addToast('Note updated.', 'success')
      } else {
        await addDoc(collection(db, 'users', user.uid, 'notes'), {
          ...payload,
          createdAt: timestamp,
        })
        addToast(`${title} saved to Notes.`, 'success')
      }

      setIsNoteModalOpen(false)
      setActiveNote(null)
    } catch {
      addToast('Unable to save that note right now.', 'error')
    } finally {
      setIsSavingNote(false)
    }
  }

  async function handleDeleteNote(note) {
    if (!user) {
      addToast('You need to be signed in to remove notes.', 'error')
      return
    }

    try {
      await deleteDoc(doc(db, 'users', user.uid, 'notes', note.id))
      addToast('Note removed.', 'success')
    } catch {
      addToast('Unable to remove that note right now.', 'error')
    }
  }

  async function handleToggleNotePin(note) {
    if (!user) {
      addToast('You need to be signed in to update notes.', 'error')
      return
    }

    try {
      await updateDoc(doc(db, 'users', user.uid, 'notes', note.id), {
        isPinned: !note.isPinned,
        lastUpdatedAt: Timestamp.now(),
      })
      addToast(note.isPinned ? 'Note unpinned.' : 'Note pinned to top.', 'success')
    } catch {
      addToast('Unable to update that note right now.', 'error')
    }
  }

  function openTaskGroupComposer(taskGroup = null) {
    setActiveTaskGroup(taskGroup)
    setIsTaskGroupModalOpen(true)
  }

  async function handleSaveTaskGroup(taskGroupDraft) {
    if (!user) {
      addToast('You need to be signed in to save task groups.', 'error')
      return
    }

    setIsSavingTaskGroup(true)
    const timestamp = Timestamp.now()
    const payload = {
      title: taskGroupDraft.title,
      note: taskGroupDraft.note,
      tags: taskGroupDraft.tags ?? [],
      tasks: taskGroupDraft.tasks,
      lastUpdatedAt: timestamp,
    }

    try {
      if (activeTaskGroup?.id) {
        await updateDoc(
          doc(db, 'users', user.uid, 'taskGroups', activeTaskGroup.id),
          payload,
        )
        addToast('Task group updated.', 'success')
      } else {
        await addDoc(collection(db, 'users', user.uid, 'taskGroups'), {
          ...payload,
          createdAt: timestamp,
        })
        addToast(`${taskGroupDraft.title} added to Tasks.`, 'success')
      }

      setIsTaskGroupModalOpen(false)
      setActiveTaskGroup(null)
    } catch {
      addToast('Unable to save that task group right now.', 'error')
    } finally {
      setIsSavingTaskGroup(false)
    }
  }

  async function handleUpdateTaskGroupTasks(taskGroup, tasks) {
    if (!user) {
      addToast('You need to be signed in to update tasks.', 'error')
      throw new Error('Authentication required')
    }

    try {
      await updateDoc(
        doc(db, 'users', user.uid, 'taskGroups', taskGroup.id),
        {
          tasks,
          lastUpdatedAt: Timestamp.now(),
        },
      )
    } catch (error) {
      addToast('Unable to update that to-do point right now.', 'error')
      throw error
    }
  }

  async function handleDeleteTaskGroup() {
    if (!user || !taskGroupToDelete) {
      return
    }

    try {
      await deleteDoc(
        doc(db, 'users', user.uid, 'taskGroups', taskGroupToDelete.id),
      )
      addToast(`${taskGroupToDelete.title} removed.`, 'success')
      setTaskGroupToDelete(null)
    } catch {
      addToast('Unable to remove that task group right now.', 'error')
    }
  }

  if (authLoading || limitsLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center dark:bg-slate-950"
        style={
          darkMode ? undefined : { backgroundColor: getStoredLightBackgroundColor() }
        }
      >
        <LoaderCircle className="h-10 w-10 animate-spin text-blue-600 dark:text-blue-300" />
      </div>
    )
  }

  return (
    <div
      className="min-h-screen pb-10 dark:bg-slate-950"
      style={darkMode ? undefined : { backgroundColor: lightBackgroundColor }}
    >
      <div className="pointer-events-none absolute left-0 top-0 h-72 w-72 rounded-full bg-white/40 blur-3xl dark:bg-blue-500/10" />
      <div className="pointer-events-none absolute right-0 top-32 h-80 w-80 rounded-full bg-cyan-200/50 blur-3xl dark:bg-cyan-500/10" />

      <Header
        user={user}
        darkMode={darkMode}
        onToggleDark={() => setDarkMode((current) => !current)}
        addToast={addToast}
        lightBackgroundColor={lightBackgroundColor}
        onChangeLightBackgroundColor={setLightBackgroundColor}
        onResetLightBackgroundColor={resetLightBackgroundColor}
      />

      <main className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {dashboardMode === 'projects' ? (
            <>
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                    Projects workspace
                  </p>
                  <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                    Open local coding projects faster than your dock can keep up.
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Add your local projects manually, keep paths editable, and save
                    a clean list of programming languages for each workspace.
                    {!isProPlan ? (
                      <>
                        {' '}
                        {planLabel}: You can only import {maxProjects} projects here.
                      </>
                    ) : null}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-4 lg:min-w-[26rem]">
                  <div className="rounded-2xl bg-blue-50 px-4 py-3 dark:bg-blue-500/10">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-200">
                      Projects
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                      {usedProjectCount}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-inset ring-slate-200 dark:bg-slate-950 dark:ring-slate-800">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      Pinned
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                      {projects.filter((project) => project.isPinned).length}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-inset ring-slate-200 dark:bg-slate-950 dark:ring-slate-800">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      Lang
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                      {availableLangs.length}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={manualImportState.active || hasReachedProjectLimit}
                    onClick={openManualImport}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-80"
                  >
                    {manualImportState.active ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <FolderPlus className="h-4 w-4" />
                    )}
                    {manualImportState.active
                      ? 'Adding project...'
                      : hasReachedProjectLimit
                        ? 'Project limit reached'
                        : 'Add project'}
                  </button>
                </div>
              </div>
              {!isProPlan ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                  {hasReachedProjectLimit
                    ? `${planLabel}: Project limit reached. Each account can only import ${maxProjects} projects here.`
                    : `${planLabel}: ${usedProjectCount}/${maxProjects} projects used. ${remainingProjectSlots} slot${remainingProjectSlots === 1 ? '' : 's'} left.`}
                </p>
              ) : null}
            </>
          ) : dashboardMode === 'launchpad' ? (
            <>
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                    Launchpad workspace
                  </p>
                  <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                    Open your go-to web platforms without digging through bookmarks.
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Save the tools you use every day, organize them with categories,
                    and jump into the right website from one Launchpad.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[18rem]">
                  <div className="rounded-2xl bg-blue-50 px-4 py-3 dark:bg-blue-500/10">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-200">
                      Websites
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                      {usedWebsiteCount}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={hasReachedWebsiteLimit}
                    onClick={openLaunchpadImport}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-80"
                  >
                    <FolderPlus className="h-4 w-4" />
                    {hasReachedWebsiteLimit ? 'Website limit reached' : 'Add shortcut'}
                  </button>
                </div>
              </div>
              {!isProPlan ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                  {hasReachedWebsiteLimit
                    ? `${planLabel}: Website limit reached. Each account can only save ${maxWebsites} shortcuts here.`
                    : `${usedWebsiteCount}/${maxWebsites} websites used. ${remainingWebsiteSlots} slot${remainingWebsiteSlots === 1 ? '' : 's'} left.`}
                </p>
              ) : null}
            </>
          ) : dashboardMode === 'notes' ? (
            <>
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                    Notes workspace
                  </p>
                  <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                    Keep snippets, SQL, config blocks, and text notes one click away.
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Save reusable code, important queries, deployment config, and quick
                    reference notes with a language label so every box stays readable.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-4 lg:min-w-[26rem]">
                  <div className="rounded-2xl bg-blue-50 px-4 py-3 dark:bg-blue-500/10">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-200">
                      Notes
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                      {usedNoteCount}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-inset ring-slate-200 dark:bg-slate-950 dark:ring-slate-800">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      Pinned
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                      {notes.filter((note) => note.isPinned).length}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-inset ring-slate-200 dark:bg-slate-950 dark:ring-slate-800">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      Formats
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                      {availableNoteLanguages.length}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={hasReachedNoteLimit}
                    onClick={() => openNoteComposer()}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-80"
                  >
                    <StickyNote className="h-4 w-4" />
                    {hasReachedNoteLimit ? 'Note limit reached' : 'Add note'}
                  </button>
                </div>
              </div>
              {!isProPlan ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                  {hasReachedNoteLimit
                    ? `${planLabel}: Note limit reached. Each account can only save ${maxNotes} notes here.`
                    : `${planLabel}: ${usedNoteCount}/${maxNotes} notes used. ${remainingNoteSlots} slot${remainingNoteSlots === 1 ? '' : 's'} left.`}
                </p>
              ) : null}
            </>
          ) : (
            <>
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                    Tasks workspace
                  </p>
                  <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                    Turn bigger goals into focused, trackable to-do groups.
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Group related work, keep the context beside it, and move each
                    point from not started to done without losing the bigger picture.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-4 lg:min-w-[26rem]">
                  <div className="rounded-2xl bg-blue-50 px-4 py-3 dark:bg-blue-500/10">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-200">
                      Groups
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                      {usedTaskGroupCount}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-inset ring-slate-200 dark:bg-slate-950 dark:ring-slate-800">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      Points
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                      {totalTaskPointCount}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-inset ring-slate-200 dark:bg-slate-950 dark:ring-slate-800">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      Done
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                      {completedTaskPointCount}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openTaskGroupComposer()}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    <ListTodo className="h-4 w-4" />
                    Add group
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        <div className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-2xl border border-gray-100 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setDashboardMode('projects')}
            className={
              dashboardMode === 'projects'
                ? 'shrink-0 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition'
                : 'shrink-0 rounded-xl px-5 py-2 text-sm font-medium text-slate-600 transition hover:bg-gray-50 dark:text-slate-300 dark:hover:bg-slate-800'
            }
          >
            Projects
          </button>
          <button
            type="button"
            onClick={() => setDashboardMode('launchpad')}
            className={
              dashboardMode === 'launchpad'
                ? 'shrink-0 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition'
                : 'shrink-0 rounded-xl px-5 py-2 text-sm font-medium text-slate-600 transition hover:bg-gray-50 dark:text-slate-300 dark:hover:bg-slate-800'
            }
          >
            Launchpad
          </button>
          <button
            type="button"
            onClick={() => setDashboardMode('notes')}
            className={
              dashboardMode === 'notes'
                ? 'shrink-0 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition'
                : 'shrink-0 rounded-xl px-5 py-2 text-sm font-medium text-slate-600 transition hover:bg-gray-50 dark:text-slate-300 dark:hover:bg-slate-800'
            }
          >
            Notes
          </button>
          <button
            type="button"
            onClick={() => setDashboardMode('tasks')}
            className={
              dashboardMode === 'tasks'
                ? 'shrink-0 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition'
                : 'shrink-0 rounded-xl px-5 py-2 text-sm font-medium text-slate-600 transition hover:bg-gray-50 dark:text-slate-300 dark:hover:bg-slate-800'
            }
          >
            Tasks
          </button>
        </div>

        {dashboardMode === 'projects' && isManualImportOpen ? (
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                  Manual Import
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Add a local project by path
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Enter the local project path, optionally rename the card, and
                  choose the programming languages you want displayed.
                  {!isProPlan ? (
                    <>
                      {' '}
                      {planLabel}: You can only import {maxProjects} projects here.
                    </>
                  ) : null}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsManualImportOpen(false)
                  resetProjectDraft()
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-slate-500 transition hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Close manual import"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="mt-6 grid gap-4" onSubmit={handleManualImportSubmit}>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    Project name
                  </span>
                  <input
                    type="text"
                    value={projectDraft.displayName}
                    onChange={(event) =>
                      setProjectDraft((currentDraft) => ({
                        ...currentDraft,
                        displayName: event.target.value,
                      }))
                    }
                    placeholder="Optional, ProMana will use the folder name if blank"
                    className="rounded-2xl border border-gray-200 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
                  />
                </label>

                <label className="grid gap-2 md:col-span-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    Local project path
                  </span>
                  <input
                    type="text"
                    required
                    value={projectDraft.absolutePath}
                    onChange={(event) =>
                      setProjectDraft((currentDraft) => ({
                        ...currentDraft,
                        absolutePath: event.target.value,
                      }))
                    }
                    placeholder="/Users/..."
                    className="rounded-2xl border border-gray-200 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
                  />
                </label>
              </div>

              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Repository link
                </span>
                <input
                  type="text"
                  value={projectDraft.repositoryUrl}
                  onChange={(event) =>
                    setProjectDraft((currentDraft) => ({
                      ...currentDraft,
                      repositoryUrl: event.target.value,
                    }))
                  }
                  placeholder="Optional, for example github.com/owner/repository"
                  className="rounded-2xl border border-gray-200 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
                />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Optional. Add a repository URL so the card can open the repo
                  directly in a browser tab.
                </p>
              </label>

              <div className="grid gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Programming languages
                </p>
                <div className="flex flex-wrap gap-3">
                  {MANUAL_LANGUAGE_OPTIONS.map((language) => {
                    const isSelected =
                      projectDraft.languagesList.includes(language)

                    return (
                      <button
                        key={language}
                        type="button"
                        onClick={() => handleLanguageToggle(language)}
                        className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'border border-gray-200 bg-white text-slate-700 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800'
                        }`}
                      >
                        {language}
                      </button>
                    )
                  })}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="text"
                    value={projectDraft.customLanguage}
                    onChange={(event) =>
                      setProjectDraft((currentDraft) => ({
                        ...currentDraft,
                        customLanguage: event.target.value,
                      }))
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        handleCustomLanguageAdd()
                      }
                    }}
                    placeholder="Add another language, for example Kotlin"
                    className="min-w-0 flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
                  />
                  <button
                    type="button"
                    onClick={handleCustomLanguageAdd}
                    className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Add custom language
                  </button>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  The project card will show these as a language list. No file
                  scanning or percentage breakdown will be generated.
                </p>
                {!isProPlan ? (
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-200">
                    {`${usedProjectCount}/${maxProjects} projects used. ${remainingProjectSlots} slot${remainingProjectSlots === 1 ? '' : 's'} left.`}
                  </p>
                ) : null}
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {`Default env on add: ${DEFAULT_PROJECT_ENVIRONMENTS[0]}`}
                </p>
              </div>

              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsManualImportOpen(false)
                    resetProjectDraft()
                  }}
                  className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={manualImportState.active || hasReachedProjectLimit}
                  className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-80"
                >
                  {manualImportState.active ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <FolderPlus className="h-4 w-4" />
                  )}
                  {manualImportState.active
                    ? 'Saving project...'
                    : hasReachedProjectLimit
                      ? 'Project limit reached'
                      : 'Add project'}
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {dashboardMode === 'launchpad' && isAddLaunchpadOpen ? (
          <AddLaunchpadModal
            onClose={() => setIsAddLaunchpadOpen(false)}
            addToast={addToast}
            maxWebsites={maxWebsites}
            usedWebsites={usedWebsiteCount}
            hasReachedLimit={hasReachedWebsiteLimit}
            isUnlimited={isProPlan}
          />
        ) : null}

        {isNoteModalOpen ? (
          <NoteModal
            note={activeNote}
            open={isNoteModalOpen}
            onClose={() => {
              setIsNoteModalOpen(false)
              setActiveNote(null)
            }}
            onSubmit={handleSaveNote}
            isSaving={isSavingNote}
          />
        ) : null}

        {isTaskGroupModalOpen ? (
          <TaskGroupModal
            open={isTaskGroupModalOpen}
            taskGroup={activeTaskGroup}
            onClose={() => {
              setIsTaskGroupModalOpen(false)
              setActiveTaskGroup(null)
            }}
            onSubmit={handleSaveTaskGroup}
            isSaving={isSavingTaskGroup}
          />
        ) : null}

        <ConfirmDialog
          open={Boolean(taskGroupToDelete)}
          title="Remove task group?"
          message={`Are you sure you want to remove ${taskGroupToDelete?.title ?? 'this task group'}? This will also remove every to-do point inside it.`}
          onConfirm={handleDeleteTaskGroup}
          onCancel={() => setTaskGroupToDelete(null)}
        />

        {isEditorManagerOpen ? (
          <EditorManagerModal
            open={isEditorManagerOpen}
            editors={customEditors}
            onClose={() => setIsEditorManagerOpen(false)}
            onSave={handleSaveCustomEditors}
            isSaving={isSavingCustomEditors}
          />
        ) : null}

        {dashboardMode === 'projects' ? (
          <>
            <section className="grid gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <SearchBar
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                inputRef={searchInputRef}
              />

              <SortFilterBar
                sort={sort}
                onSort={(event) => setSort(event.target.value)}
                filterLang={filterLang}
                onFilterLang={(event) => setFilterLang(event.target.value)}
                filterTag={filterTag}
                onFilterTag={(event) => setFilterTag(event.target.value)}
                availableLangs={availableLangs}
                availableTags={availableTags}
              />
            </section>

            {projectsLoading ? (
              <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <SkeletonCard key={`skeleton-${index}`} />
                ))}
              </section>
            ) : null}

            {!projectsLoading && projects.length === 0 ? (
              <section className="rounded-2xl border border-dashed border-blue-200 bg-white p-10 text-center shadow-sm dark:border-blue-500/20 dark:bg-slate-900">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                  Nothing imported yet
                </p>
                <h2 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">
                  Bring your first local project into ProMana.
                </h2>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                  Add your first project manually by saving its local path and the
                  programming languages you want shown on the card.
                  {!isProPlan ? (
                    <>
                      {' '}
                      {planLabel}: You can only import {maxProjects} projects here.
                    </>
                  ) : null}
                </p>
                <button
                  type="button"
                  disabled={manualImportState.active || hasReachedProjectLimit}
                  onClick={openManualImport}
                  className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-80"
                >
                  {manualImportState.active ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <FolderPlus className="h-4 w-4" />
                  )}
                  {manualImportState.active
                    ? 'Adding project...'
                    : hasReachedProjectLimit
                      ? 'Project limit reached'
                      : 'Add your first project'}
                </button>
              </section>
            ) : null}

            {!projectsLoading && projects.length > 0 && visibleProjects.length === 0 ? (
              <section className="rounded-2xl border border-gray-100 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <SearchX className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-500" />
                <h2 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">
                  No projects match this search.
                </h2>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                  Try a different folder name, language, or tag filter.
                </p>
              </section>
            ) : null}

            {!projectsLoading && pinnedProjects.length > 0 ? (
              <section className="grid gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    📌 Pinned
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Your highest-priority workspaces
                  </p>
                </div>

                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {pinnedProjects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onDelete={handleDeleteProject}
                      onTagClick={setFilterTag}
                      addToast={addToast}
                      customEditors={customEditors}
                      onManageEditors={() => setIsEditorManagerOpen(true)}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {!projectsLoading && regularProjects.length > 0 ? (
              <section className="grid gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Projects
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {visibleProjects.length} workspace{visibleProjects.length === 1 ? '' : 's'} ready
                  </p>
                </div>

                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {regularProjects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onDelete={handleDeleteProject}
                      onTagClick={setFilterTag}
                      addToast={addToast}
                      customEditors={customEditors}
                      onManageEditors={() => setIsEditorManagerOpen(true)}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : dashboardMode === 'notes' ? (
          <div className="grid gap-4">
            <section className="grid gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <SearchBar
                value={notesSearch}
                onChange={(event) => setNotesSearch(event.target.value)}
                inputRef={notesSearchInputRef}
                placeholder="Search notes, snippets, or file types...."
              />

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    Filter by type
                  </span>
                  <select
                    value={notesFilterType}
                    onChange={(event) => setNotesFilterType(event.target.value)}
                    className="rounded-2xl border border-white/70 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
                  >
                    <option value="all">All note types</option>
                    {NOTE_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    Filter by language
                  </span>
                  <select
                    value={notesFilterLanguage}
                    onChange={(event) => setNotesFilterLanguage(event.target.value)}
                    className="rounded-2xl border border-white/70 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
                  >
                    <option value="all">All languages</option>
                    {NOTE_LANGUAGE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    Filter by tag
                  </span>
                  <select
                    value={notesFilterTag}
                    onChange={(event) => setNotesFilterTag(event.target.value)}
                    className="rounded-2xl border border-white/70 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
                  >
                    <option value="all">All tags</option>
                    {availableNoteTags.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <p className="text-sm text-slate-500 dark:text-slate-400">
                {availableNoteLanguages.length
                  ? `Formats in use: ${availableNoteLanguages.map((language) => getNoteLanguageLabel(language)).join(', ')}${availableNoteTags.length ? ` · Tags: ${availableNoteTags.join(', ')}` : ''}`
                  : 'Pick a language, file type, and tags for each note so the cards stay easy to scan.'}
              </p>
            </section>

            <NotesGrid
              notes={notes}
              loading={notesLoading}
              searchQuery={notesSearch}
              filterType={notesFilterType}
              filterLanguage={notesFilterLanguage}
              filterTag={notesFilterTag}
              onDelete={handleDeleteNote}
              onEdit={openNoteComposer}
              onTogglePin={handleToggleNotePin}
              onTagClick={setNotesFilterTag}
              addToast={addToast}
            />
          </div>
        ) : dashboardMode === 'tasks' ? (
          <div className="grid gap-5">
            <section className="grid gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <SearchBar
                value={tasksSearch}
                onChange={(event) => setTasksSearch(event.target.value)}
                inputRef={tasksSearchInputRef}
                placeholder="Search task groups, points, notes, or tags...."
              />

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    Filter by status
                  </span>
                  <select
                    value={tasksFilterStatus}
                    onChange={(event) => setTasksFilterStatus(event.target.value)}
                    className="rounded-2xl border border-white/70 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
                  >
                    <option value="all">All statuses</option>
                    {TASK_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    Filter by tag
                  </span>
                  <select
                    value={tasksFilterTag}
                    onChange={(event) => setTasksFilterTag(event.target.value)}
                    className="rounded-2xl border border-white/70 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
                  >
                    <option value="all">All tags</option>
                    {availableTaskTags.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            {taskGroupsLoading ? (
              <section className="grid gap-6 lg:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <TaskGroupSkeletonCard key={`task-skeleton-${index}`} />
                ))}
              </section>
            ) : null}

            {!taskGroupsLoading && taskGroups.length === 0 ? (
              <section className="overflow-hidden rounded-3xl border border-dashed border-blue-200 bg-white p-8 text-center shadow-sm dark:border-blue-500/20 dark:bg-slate-900 sm:p-12">
                <div className="mx-auto flex h-20 w-20 rotate-3 items-center justify-center rounded-[2rem] bg-gradient-to-br from-blue-600 to-cyan-400 text-white shadow-lg shadow-blue-200 dark:shadow-none">
                  <ListTodo className="h-10 w-10" />
                </div>
                <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                  A clear starting point
                </p>
                <h2 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">
                  Create your first task group.
                </h2>
                <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Add a title, context, tags, and the to-do points that will move
                  this piece of work forward.
                </p>
                <button
                  type="button"
                  onClick={() => openTaskGroupComposer()}
                  className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  <ListTodo className="h-4 w-4" />
                  Create first group
                </button>
              </section>
            ) : null}

            {!taskGroupsLoading &&
            taskGroups.length > 0 &&
            visibleTaskGroups.length === 0 ? (
              <section className="rounded-2xl border border-gray-100 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <SearchX className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-500" />
                <h2 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">
                  No task groups match these filters.
                </h2>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                  Try a different search, status, or tag.
                </p>
              </section>
            ) : null}

            {!taskGroupsLoading && visibleTaskGroups.length > 0 ? (
              <section className="grid gap-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Task groups
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {visibleTaskGroups.length} group
                    {visibleTaskGroups.length === 1 ? '' : 's'} in view
                  </p>
                </div>
                <div className="grid items-start gap-6 lg:grid-cols-2">
                  {visibleTaskGroups.map((taskGroup) => (
                    <TaskGroupCard
                      key={taskGroup.id}
                      taskGroup={taskGroup}
                      onEdit={openTaskGroupComposer}
                      onDelete={setTaskGroupToDelete}
                      onUpdateTasks={handleUpdateTaskGroupTasks}
                      onSelectTag={setTasksFilterTag}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-4">
            <section className="grid gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="flex-1">
                  <input
                    ref={launchpadSearchInputRef}
                    type="text"
                    value={launchpadSearch}
                    onChange={(event) => setLaunchpadSearch(event.target.value)}
                    placeholder="Search shortcuts..."
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-500/20"
                  />
                </div>
                <label className="grid gap-2 lg:min-w-56">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    Filter by category
                  </span>
                  <select
                    value={launchpadFilterCategory}
                    onChange={(event) =>
                      setLaunchpadFilterCategory(event.target.value)
                    }
                    className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-500/20"
                  >
                    <option value="all">All categories</option>
                    {launchpadCategoryOptions.map((category) => (
                      <option key={category} value={category}>
                        {getLaunchpadCategoryLabel(category)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <LaunchpadGrid
              items={launchpadItems}
              loading={launchpadLoading}
              searchQuery={launchpadSearch}
              filterCategory={launchpadFilterCategory}
              onDelete={handleDeleteLaunchpadItem}
              onUpdate={handleUpdateLaunchpadItem}
              onTogglePin={handleToggleLaunchpadPin}
              addToast={addToast}
            />

          </div>
        )}
      </main>

      {manualImportState.active ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-4">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">
                <LoaderCircle className="h-7 w-7 animate-spin" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                  Adding Project
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                  {manualImportState.message}
                </h2>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
              ProMana is saving the new project card and preparing it for the
              dashboard. Keep this tab open for a moment.
            </p>
          </div>
        </div>
      ) : null}

      <MadeByFooter className="px-4 pb-6 sm:px-6 lg:px-8" />
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  )
}
