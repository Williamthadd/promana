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
  CalendarDays,
  Files,
  FolderPlus,
  Images,
  ListTodo,
  LoaderCircle,
  SearchX,
  StickyNote,
  Sparkles,
  X,
} from 'lucide-react'
import AddLaunchpadModal from '../components/AddLaunchpadModal'
import AddProjectModal from '../components/AddProjectModal'
import AiWorkspace from '../components/AiWorkspace'
import CalendarEntryModal from '../components/CalendarEntryModal'
import CalendarWorkspace from '../components/CalendarWorkspace'
import CityDashboard from '../components/CityDashboard'
import ConfirmDialog from '../components/ConfirmDialog'
import DocumentsWorkspace from '../components/DocumentsWorkspace'
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
import useCalendarEntries from '../hooks/useCalendarEntries'
import useCustomEditors from '../hooks/useCustomEditors'
import useDocuments from '../hooks/useDocuments'
import useLightBackgroundColor from '../hooks/useLightBackgroundColor'
import useLaunchpad from '../hooks/useLaunchpad'
import useNotes from '../hooks/useNotes'
import useProjects from '../hooks/useProjects'
import useTaskGroups from '../hooks/useTaskGroups'
import useToast from '../hooks/useToast'
import useUserLimits from '../hooks/useUserLimits'
import {
  getTimeValue,
} from '../utils/formatters'
import {
  formatCalendarTime,
  formatDateKey,
  getTimeMinutes,
} from '../utils/calendar'
import { getStoredLightBackgroundColor } from '../utils/lightBackground'
import {
  getPrimaryProjectLanguage,
  getProjectLanguages,
} from '../utils/projectLanguages'
import {
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

const MANUAL_LANGUAGE_OPTIONS = Object.keys(LANGUAGE_COLORS).filter(
  (language) => language !== 'Other',
)

const DASHBOARD_MODES = new Set([
  'projects',
  'launchpad',
  'notes',
  'tasks',
  'calendar',
  'ai',
])

function getInitialDashboardMode() {
  const storedMode = window.localStorage.getItem('proman-dashboard-mode')
  return DASHBOARD_MODES.has(storedMode) ? storedMode : 'projects'
}

function getInitialDesignMode() {
  return window.localStorage.getItem('proman-design-mode') === 'city'
    ? 'city'
    : 'classic'
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
    documents,
    loading: documentsLoading,
    error: documentsError,
  } = useDocuments(user?.uid)
  const {
    taskGroups,
    loading: taskGroupsLoading,
    error: taskGroupsError,
  } = useTaskGroups(user?.uid)
  const {
    entries: calendarEntries,
    loading: calendarEntriesLoading,
    error: calendarEntriesError,
  } = useCalendarEntries(user?.uid)
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
  const [dashboardMode, setDashboardMode] = useState(getInitialDashboardMode)
  const [designMode, setDesignMode] = useState(getInitialDesignMode)
  const [search, setSearch] = useState('')
  const [launchpadSearch, setLaunchpadSearch] = useState('')
  const [launchpadFilterCategory, setLaunchpadFilterCategory] = useState('all')
  const [notesSearch, setNotesSearch] = useState('')
  const [notesFilterType, setNotesFilterType] = useState('all')
  const [notesFilterLanguage, setNotesFilterLanguage] = useState('all')
  const [notesFilterTag, setNotesFilterTag] = useState('all')
  const [notesWorkspaceView, setNotesWorkspaceView] = useState('notes')
  const [documentUploadRequest, setDocumentUploadRequest] = useState(0)
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
  const [isCalendarEntryModalOpen, setIsCalendarEntryModalOpen] = useState(false)
  const [activeCalendarEntry, setActiveCalendarEntry] = useState(null)
  const [calendarInitialDateKey, setCalendarInitialDateKey] = useState(() =>
    formatDateKey(new Date()),
  )
  const [isSavingCalendarEntry, setIsSavingCalendarEntry] = useState(false)
  const [calendarEntryToDelete, setCalendarEntryToDelete] = useState(null)
  const [workspaceFocusTarget, setWorkspaceFocusTarget] = useState(null)

  const searchInputRef = useRef(null)
  const launchpadSearchInputRef = useRef(null)
  const notesSearchInputRef = useRef(null)
  const documentsSearchInputRef = useRef(null)
  const tasksSearchInputRef = useRef(null)
  const workspaceContentRef = useRef(null)
  const maxProjects = limits.maxProjects
  const maxWebsites = limits.maxWebsites
  const maxNotes = limits.maxNotes
  const maxTasks = limits.maxTasks
  const maxSchedules = limits.maxSchedules
  const isProPlan = limits.plan === 'pro'
  const planLabel = isProPlan ? 'Pro plan' : 'Free plan'
  const usedProjectCount = projects.length
  const usedWebsiteCount = launchpadItems.length
  const usedNoteCount = notes.length
  const usedDocumentCount = documents.length
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
  const todayDateKey = formatDateKey(new Date())
  const todayCalendarEntryCount = calendarEntries.filter(
    (entry) => entry.dateKey === todayDateKey,
  ).length
  const calendarReminderCount = calendarEntries.filter(
    (entry) => entry.reminderEnabled,
  ).length
  const hasReachedProjectLimit = !isProPlan && usedProjectCount >= maxProjects
  const hasReachedWebsiteLimit = !isProPlan && usedWebsiteCount >= maxWebsites
  const hasReachedNoteLimit = !isProPlan && usedNoteCount >= maxNotes
  const hasReachedTaskLimit = !isProPlan && usedTaskGroupCount >= maxTasks
  const hasReachedScheduleLimit =
    !isProPlan && calendarEntries.length >= maxSchedules
  const remainingProjectSlots = Math.max(0, maxProjects - usedProjectCount)
  const remainingWebsiteSlots = Math.max(0, maxWebsites - usedWebsiteCount)
  const remainingNoteSlots = Math.max(0, maxNotes - usedNoteCount)
  const remainingTaskSlots = Math.max(0, maxTasks - usedTaskGroupCount)
  const remainingScheduleSlots = Math.max(
    0,
    maxSchedules - calendarEntries.length,
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    window.localStorage.setItem('proman-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    window.localStorage.setItem('proman-dashboard-mode', dashboardMode)
  }, [dashboardMode])

  useEffect(() => {
    window.localStorage.setItem('proman-design-mode', designMode)
  }, [designMode])

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
        if (notesWorkspaceView === 'documents') {
          documentsSearchInputRef.current?.focus()
        } else {
          notesSearchInputRef.current?.focus()
        }
      } else if (dashboardMode === 'tasks') {
        tasksSearchInputRef.current?.focus()
      } else if (dashboardMode === 'calendar') {
        return
      } else {
        searchInputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [dashboardMode, notesWorkspaceView])

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
    if (calendarEntriesError) {
      addToast('Calendar sync hit an issue. Please try refreshing.', 'error')
    }
  }, [addToast, calendarEntriesError])

  useEffect(() => {
    if (!user?.uid || calendarEntriesLoading) {
      return undefined
    }

    function checkCalendarReminders() {
      const now = new Date()
      const currentDateKey = formatDateKey(now)
      const currentMinutes = now.getHours() * 60 + now.getMinutes()
      const storageKey = `proman-calendar-reminders-${user.uid}-${currentDateKey}`
      let shownReminderIds = []

      try {
        shownReminderIds = JSON.parse(
          window.localStorage.getItem(storageKey) || '[]',
        )
      } catch {
        shownReminderIds = []
      }

      const shownReminderSet = new Set(shownReminderIds)
      const dueEntries = calendarEntries.filter((entry) => {
        const reminderMinutes = getTimeMinutes(entry.reminderTime)

        return (
          entry.reminderEnabled &&
          entry.dateKey === currentDateKey &&
          reminderMinutes !== null &&
          reminderMinutes <= currentMinutes &&
          !shownReminderSet.has(entry.id)
        )
      })

      dueEntries.forEach((entry) => {
        addToast(
          `Calendar reminder: ${entry.title} (${formatCalendarTime(entry.reminderTime)})`,
          'info',
        )
        shownReminderSet.add(entry.id)
      })

      if (dueEntries.length > 0) {
        window.localStorage.setItem(
          storageKey,
          JSON.stringify(Array.from(shownReminderSet)),
        )
      }
    }

    checkCalendarReminders()
    const reminderInterval = window.setInterval(checkCalendarReminders, 30_000)

    return () => window.clearInterval(reminderInterval)
  }, [addToast, calendarEntries, calendarEntriesLoading, user?.uid])

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

  useEffect(() => {
    if (hasReachedTaskLimit && isTaskGroupModalOpen && !activeTaskGroup?.id) {
      setIsTaskGroupModalOpen(false)
      setActiveTaskGroup(null)
    }
  }, [activeTaskGroup?.id, hasReachedTaskLimit, isTaskGroupModalOpen])

  useEffect(() => {
    if (
      hasReachedScheduleLimit &&
      isCalendarEntryModalOpen &&
      !activeCalendarEntry?.id
    ) {
      setIsCalendarEntryModalOpen(false)
      setActiveCalendarEntry(null)
    }
  }, [
    activeCalendarEntry?.id,
    hasReachedScheduleLimit,
    isCalendarEntryModalOpen,
  ])

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
  const pinnedTaskGroups = visibleTaskGroups.filter(
    (taskGroup) => taskGroup.isPinned,
  )
  const regularTaskGroups = visibleTaskGroups.filter(
    (taskGroup) => !taskGroup.isPinned,
  )

  useEffect(() => {
    if (!workspaceFocusTarget || dashboardMode !== workspaceFocusTarget.mode) {
      return undefined
    }

    const focusTimeout = window.setTimeout(() => {
      const targetElement = document.getElementById(workspaceFocusTarget.elementId)

      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        targetElement.animate?.(
          [
            { boxShadow: '0 0 0 0 rgba(37, 99, 235, 0)' },
            { boxShadow: '0 0 0 6px rgba(37, 99, 235, 0.28)' },
            { boxShadow: '0 0 0 0 rgba(37, 99, 235, 0)' },
          ],
          { duration: 1600, easing: 'ease-out' },
        )
      }

      setWorkspaceFocusTarget(null)
    }, 120)

    return () => window.clearTimeout(focusTimeout)
  }, [dashboardMode, workspaceFocusTarget])

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
    if (!taskGroup?.id && hasReachedTaskLimit) {
      addToast(
        `You can only save ${maxTasks} task groups here. Remove one before adding another.`,
        'error',
      )
      return
    }

    setActiveTaskGroup(taskGroup)
    setIsTaskGroupModalOpen(true)
  }

  async function handleSaveTaskGroup(taskGroupDraft) {
    if (!user) {
      addToast('You need to be signed in to save task groups.', 'error')
      return
    }

    if (!activeTaskGroup?.id && hasReachedTaskLimit) {
      addToast(
        `You can only save ${maxTasks} task groups here. Remove one before adding another.`,
        'error',
      )
      return
    }

    setIsSavingTaskGroup(true)
    const timestamp = Timestamp.now()
    const payload = {
      title: taskGroupDraft.title,
      note: taskGroupDraft.note,
      tags: taskGroupDraft.tags ?? [],
      tasks: taskGroupDraft.tasks,
      isPinned: activeTaskGroup?.isPinned ?? false,
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

  async function handleToggleTaskGroupPin(taskGroup) {
    if (!user) {
      addToast('You need to be signed in to update task groups.', 'error')
      return
    }

    try {
      await updateDoc(
        doc(db, 'users', user.uid, 'taskGroups', taskGroup.id),
        { isPinned: !taskGroup.isPinned },
      )
      addToast(
        taskGroup.isPinned
          ? 'Task group unpinned.'
          : 'Task group pinned to top.',
        'success',
      )
    } catch {
      addToast('Unable to update that task group right now.', 'error')
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

  function openCalendarEntryComposer(dateKey = formatDateKey(new Date())) {
    if (hasReachedScheduleLimit) {
      addToast(
        `You can only save ${maxSchedules} calendar schedules here. Remove one before adding another.`,
        'error',
      )
      return
    }

    setActiveCalendarEntry(null)
    setCalendarInitialDateKey(dateKey)
    setIsCalendarEntryModalOpen(true)
  }

  function openCalendarEntryEditor(entry) {
    setActiveCalendarEntry(entry)
    setCalendarInitialDateKey(entry.dateKey)
    setIsCalendarEntryModalOpen(true)
  }

  function closeCalendarEntryModal() {
    setIsCalendarEntryModalOpen(false)
    setActiveCalendarEntry(null)
  }

  async function handleSaveCalendarEntry(entryDraft) {
    if (!user) {
      addToast('You need to be signed in to save calendar targets.', 'error')
      return
    }

    if (!activeCalendarEntry?.id && hasReachedScheduleLimit) {
      addToast(
        `You can only save ${maxSchedules} calendar schedules here. Remove one before adding another.`,
        'error',
      )
      return
    }

    setIsSavingCalendarEntry(true)
    const timestamp = Timestamp.now()
    const payload = {
      ...entryDraft,
      lastUpdatedAt: timestamp,
    }

    try {
      if (activeCalendarEntry?.id) {
        await updateDoc(
          doc(
            db,
            'users',
            user.uid,
            'calendarEntries',
            activeCalendarEntry.id,
          ),
          payload,
        )
        addToast('Calendar target updated.', 'success')
      } else {
        await addDoc(collection(db, 'users', user.uid, 'calendarEntries'), {
          ...payload,
          createdAt: timestamp,
        })
        addToast(`${entryDraft.title} scheduled.`, 'success')
      }

      closeCalendarEntryModal()
    } catch {
      addToast('Unable to save that calendar target right now.', 'error')
    } finally {
      setIsSavingCalendarEntry(false)
    }
  }

  async function handleDeleteCalendarEntry() {
    if (!user || !calendarEntryToDelete) {
      return
    }

    try {
      await deleteDoc(
        doc(
          db,
          'users',
          user.uid,
          'calendarEntries',
          calendarEntryToDelete.id,
        ),
      )
      addToast(`${calendarEntryToDelete.title} removed from Calendar.`, 'success')
      setCalendarEntryToDelete(null)
    } catch {
      addToast('Unable to remove that calendar target right now.', 'error')
    }
  }

  function openCalendarLinkedProject(project) {
    setFilterLang('all')
    setFilterTag('all')
    setSearch(project.displayName || '')
    setDashboardMode('projects')
    setWorkspaceFocusTarget({
      mode: 'projects',
      elementId: `project-card-${project.id}`,
    })
  }

  function openCalendarLinkedTaskGroup(taskGroup) {
    setTasksFilterStatus('all')
    setTasksFilterTag('all')
    setTasksSearch(taskGroup.title || '')
    setDashboardMode('tasks')
    setWorkspaceFocusTarget({
      mode: 'tasks',
      elementId: `task-group-card-${taskGroup.id}`,
    })
  }

  function openCityWorkspace(workspaceMode) {
    setDashboardMode(workspaceMode)

    window.setTimeout(() => {
      workspaceContentRef.current?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
        block: 'start',
      })
    }, 80)
  }

  if (authLoading || limitsLoading) {
    return (
      <div
        className={`flex min-h-screen items-center justify-center transition-all duration-300 ${darkMode ? 'bg-mesh-dark' : 'bg-mesh-light'}`}
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
      className={`min-h-screen pb-10 transition-all duration-300 ${darkMode ? 'bg-mesh-dark' : 'bg-mesh-light'}`}
      style={darkMode ? undefined : { backgroundColor: lightBackgroundColor }}
    >
      <div className="pointer-events-none absolute left-0 top-0 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-32 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />

      <Header
        user={user}
        darkMode={darkMode}
        onToggleDark={() => setDarkMode((current) => !current)}
        addToast={addToast}
        lightBackgroundColor={lightBackgroundColor}
        onChangeLightBackgroundColor={setLightBackgroundColor}
        onResetLightBackgroundColor={resetLightBackgroundColor}
        designMode={designMode}
        onChangeDesignMode={setDesignMode}
      />

      <main className="relative mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        {designMode === 'city' ? (
          <CityDashboard
            activeWorkspace={dashboardMode}
            onSelectWorkspace={openCityWorkspace}
            darkMode={darkMode}
            lightBackgroundColor={lightBackgroundColor}
            projectCount={usedProjectCount}
            launchpadCount={usedWebsiteCount}
            noteCount={usedNoteCount}
            taskGroupCount={usedTaskGroupCount}
            calendarCount={calendarEntries.length}
          />
        ) : null}

        <section className={`${designMode === 'city' ? 'hidden' : ''} rounded-3xl border border-white/40 dark:border-white/10 glass-panel-light dark:glass-panel-dark p-8 shadow-xl`}>
          {dashboardMode === 'projects' ? (
            <>
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                    Projects workspace
                  </p>
                  <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                    Open local coding projects faster than your dock can keep up.
                  </h1>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300 font-medium">
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
                  <div className="rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 dark:from-blue-500/20 dark:to-cyan-500/5 px-4 py-3 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-blue-700 dark:text-blue-200">
                      Projects
                    </p>
                    <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                      {usedProjectCount}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/50 dark:border-white/5 glass-panel-light dark:glass-panel-dark px-4 py-3 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">
                      Pinned
                    </p>
                    <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                      {projects.filter((project) => project.isPinned).length}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/50 dark:border-white/5 glass-panel-light dark:glass-panel-dark px-4 py-3 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">
                      Lang
                    </p>
                    <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                      {availableLangs.length}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={hasReachedProjectLimit}
                    onClick={openManualImport}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 text-sm font-bold text-white transition-all hover:brightness-110 shadow-md shadow-blue-500/15 cursor-pointer hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-85"
                  >
                    <FolderPlus className="h-4 w-4" />
                    {hasReachedProjectLimit ? 'Limit reached' : 'Add project'}
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
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                    Launchpad workspace
                  </p>
                  <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                    Open your go-to web platforms without digging through bookmarks.
                  </h1>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300 font-medium">
                    Save the tools you use every day, organize them with categories,
                    and jump into the right website from one Launchpad.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[18rem]">
                  <div className="rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 dark:from-blue-500/20 dark:to-cyan-500/5 px-4 py-3 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-blue-700 dark:text-blue-200">
                      Websites
                    </p>
                    <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                      {usedWebsiteCount}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={hasReachedWebsiteLimit}
                    onClick={openLaunchpadImport}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 text-sm font-bold text-white transition-all hover:brightness-110 shadow-md shadow-blue-500/15 cursor-pointer hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-85"
                  >
                    <FolderPlus className="h-4 w-4" />
                    {hasReachedWebsiteLimit ? 'Limit reached' : 'Add shortcut'}
                  </button>
                </div>
              </div>
              {!isProPlan ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 font-medium">
                  {hasReachedWebsiteLimit
                    ? `${planLabel}: Website limit reached. Each account can only save ${maxWebsites} shortcuts here.`
                    : `Free plan: ${usedWebsiteCount}/${maxWebsites} websites used. ${remainingWebsiteSlots} slot${remainingWebsiteSlots === 1 ? '' : 's'} left.`}
                </p>
              ) : null}
            </>
          ) : dashboardMode === 'notes' ? (
            <>
              {notesWorkspaceView === 'notes' ? (
                <>
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-2xl">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                        Notes workspace
                      </p>
                      <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                        Keep snippets, SQL, config blocks, and text notes one click away.
                      </h1>
                      <p className="mt-3 text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">
                        Save reusable code, important queries, deployment config, and
                        quick reference notes in cards that stay easy to scan.
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-4 lg:min-w-[26rem]">
                      <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 px-4 py-3 shadow-sm dark:from-blue-500/20 dark:to-cyan-500/5">
                        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-blue-700 dark:text-blue-200">
                          Notes
                        </p>
                        <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                          {usedNoteCount}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/50 px-4 py-3 shadow-sm glass-panel-light dark:border-white/5 dark:glass-panel-dark">
                        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">
                          Pinned
                        </p>
                        <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                          {notes.filter((note) => note.isPinned).length}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/50 px-4 py-3 shadow-sm glass-panel-light dark:border-white/5 dark:glass-panel-dark">
                        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">
                          Formats
                        </p>
                        <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                          {availableNoteLanguages.length}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={hasReachedNoteLimit}
                        onClick={() => openNoteComposer()}
                        className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/15 transition-all hover:scale-[1.02] hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-85"
                      >
                        <StickyNote className="h-4 w-4" />
                        {hasReachedNoteLimit ? 'Limit reached' : 'Add note'}
                      </button>
                    </div>
                  </div>
                  {!isProPlan ? (
                    <p className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-400">
                      {hasReachedNoteLimit
                        ? `${planLabel}: Note limit reached. Each account can only save ${maxNotes} notes here.`
                        : `${planLabel}: ${usedNoteCount}/${maxNotes} notes used. ${remainingNoteSlots} slot${remainingNoteSlots === 1 ? '' : 's'} left.`}
                    </p>
                  ) : null}
                </>
              ) : (
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                      Docs workspace
                    </p>
                    <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                      Keep documents, spreadsheets, and screenshots beside your notes.
                    </h1>
                    <p className="mt-3 text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">
                      Upload office files and images, paste fresh screenshots, and
                      preview important references without leaving ProMana.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-4 lg:min-w-[26rem]">
                    <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 px-4 py-3 shadow-sm dark:from-blue-500/20 dark:to-cyan-500/5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-blue-700 dark:text-blue-200">
                        Files
                      </p>
                      <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                        {usedDocumentCount}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/50 px-4 py-3 shadow-sm glass-panel-light dark:border-white/5 dark:glass-panel-dark">
                      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">
                        Images
                      </p>
                      <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                        {documents.filter((document) => document.kind === 'image').length}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/50 px-4 py-3 shadow-sm glass-panel-light dark:border-white/5 dark:glass-panel-dark">
                      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">
                        Documents
                      </p>
                      <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                        {documents.filter((document) => document.kind !== 'image').length}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setDocumentUploadRequest((current) => current + 1)
                      }
                      className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/15 transition-all hover:scale-[1.02] hover:brightness-110 active:scale-[0.98]"
                    >
                      <Files className="h-4 w-4" />
                      Add file
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : dashboardMode === 'tasks' ? (
            <>
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                    Tasks workspace
                  </p>
                  <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                    Turn bigger goals into focused, trackable to-do groups.
                  </h1>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300 font-medium">
                    Group related work, keep the context beside it, and move each
                    point from not started to done without losing the bigger picture.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-4 lg:min-w-[26rem]">
                  <div className="rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 dark:from-blue-500/20 dark:to-cyan-500/5 px-4 py-3 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-blue-700 dark:text-blue-200">
                      Groups
                    </p>
                    <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                      {usedTaskGroupCount}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/50 dark:border-white/5 glass-panel-light dark:glass-panel-dark px-4 py-3 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">
                      Points
                    </p>
                    <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                      {totalTaskPointCount}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/50 dark:border-white/5 glass-panel-light dark:glass-panel-dark px-4 py-3 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">
                      Done
                    </p>
                    <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                      {completedTaskPointCount}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={hasReachedTaskLimit}
                    onClick={() => openTaskGroupComposer()}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 text-sm font-bold text-white transition-all hover:brightness-110 shadow-md shadow-blue-500/15 cursor-pointer hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-85"
                  >
                    <ListTodo className="h-4 w-4" />
                    {hasReachedTaskLimit ? 'Limit reached' : 'Add group'}
                  </button>
                </div>
              </div>
              {!isProPlan ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 font-medium">
                  {hasReachedTaskLimit
                    ? `${planLabel}: Task limit reached. Each account can only save ${maxTasks} task groups here.`
                    : `${planLabel}: ${usedTaskGroupCount}/${maxTasks} task groups used. ${remainingTaskSlots} slot${remainingTaskSlots === 1 ? '' : 's'} left.`}
                </p>
              ) : null}
            </>
          ) : dashboardMode === 'calendar' ? (
            <>
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                    Calendar workspace
                  </p>
                  <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                    Put every target, tool, and checklist on the day it matters.
                  </h1>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300 font-medium">
                    Plan outcomes by month, attach the Projects, Launchpad links,
                    and Task groups needed to deliver them, and receive reminders
                    while ProMana is open.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-4 lg:min-w-[26rem]">
                  <div className="rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 dark:from-blue-500/20 dark:to-cyan-500/5 px-4 py-3 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-blue-700 dark:text-blue-200">
                      Targets
                    </p>
                    <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                      {calendarEntries.length}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/50 dark:border-white/5 glass-panel-light dark:glass-panel-dark px-4 py-3 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">
                      Today
                    </p>
                    <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                      {todayCalendarEntryCount}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/50 dark:border-white/5 glass-panel-light dark:glass-panel-dark px-4 py-3 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">
                      Reminders
                    </p>
                    <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                      {calendarReminderCount}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={hasReachedScheduleLimit}
                    onClick={() => openCalendarEntryComposer()}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 text-sm font-bold text-white transition-all hover:brightness-110 shadow-md shadow-blue-500/15 cursor-pointer hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-85"
                  >
                    <CalendarDays className="h-4 w-4" />
                    {hasReachedScheduleLimit
                      ? 'Limit reached'
                      : 'Add target'}
                  </button>
                </div>
              </div>
              {!isProPlan ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 font-medium">
                  {hasReachedScheduleLimit
                    ? `${planLabel}: Schedule limit reached. Each account can only save ${maxSchedules} schedules here.`
                    : `${planLabel}: ${calendarEntries.length}/${maxSchedules} schedules used. ${remainingScheduleSlots} slot${remainingScheduleSlots === 1 ? '' : 's'} left.`}
                </p>
              ) : null}
            </>
          ) : (
            <>
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                    Ask AI workspace
                  </p>
                  <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                    Supercharge your productivity with ProMana AI.
                  </h1>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300 font-medium">
                    Ask questions about your projects, notes, task timeline, or calendar schedules,
                    and get instant structured insights.
                  </p>
                </div>
              </div>
            </>
          )}
        </section>

        <div className={`${designMode === 'city' ? 'hidden' : 'flex'} w-fit max-w-full gap-1 overflow-x-auto rounded-2xl border border-white/40 dark:border-white/10 glass-panel-light dark:glass-panel-dark p-1.5 shadow-md`}>
          <button
            type="button"
            onClick={() => setDashboardMode('projects')}
            className={
              dashboardMode === 'projects'
                ? 'shrink-0 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition-all shadow-md shadow-blue-500/15 cursor-pointer'
                : 'shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-white/40 dark:text-slate-300 dark:hover:bg-white/5 cursor-pointer'
            }
          >
            Projects
          </button>
          <button
            type="button"
            onClick={() => setDashboardMode('launchpad')}
            className={
              dashboardMode === 'launchpad'
                ? 'shrink-0 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition-all shadow-md shadow-blue-500/15 cursor-pointer'
                : 'shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-white/40 dark:text-slate-300 dark:hover:bg-white/5 cursor-pointer'
            }
          >
            Launchpad
          </button>
          <button
            type="button"
            onClick={() => setDashboardMode('notes')}
            className={
              dashboardMode === 'notes'
                ? 'shrink-0 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition-all shadow-md shadow-blue-500/15 cursor-pointer'
                : 'shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-white/40 dark:text-slate-300 dark:hover:bg-white/5 cursor-pointer'
            }
          >
            Notes
          </button>
          <button
            type="button"
            onClick={() => setDashboardMode('tasks')}
            className={
              dashboardMode === 'tasks'
                ? 'shrink-0 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition-all shadow-md shadow-blue-500/15 cursor-pointer'
                : 'shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-white/40 dark:text-slate-300 dark:hover:bg-white/5 cursor-pointer'
            }
          >
            Tasks
          </button>
          <button
            type="button"
            onClick={() => setDashboardMode('calendar')}
            className={
              dashboardMode === 'calendar'
                ? 'shrink-0 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition-all shadow-md shadow-blue-500/15 cursor-pointer'
                : 'shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-white/40 dark:text-slate-300 dark:hover:bg-white/5 cursor-pointer'
            }
          >
            Calendar
          </button>
          <button
            type="button"
            onClick={() => setDashboardMode('ai')}
            className={
              dashboardMode === 'ai'
                ? 'shrink-0 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition-all shadow-md shadow-blue-500/15 cursor-pointer'
                : 'shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-white/40 dark:text-slate-300 dark:hover:bg-white/5 cursor-pointer'
            }
          >
            Ask AI
          </button>
        </div>

        {/* We moved manual project import form and launchpad add form to popup modals */}

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

        {isCalendarEntryModalOpen ? (
          <CalendarEntryModal
            open={isCalendarEntryModalOpen}
            entry={activeCalendarEntry}
            initialDateKey={calendarInitialDateKey}
            projects={projects}
            launchpadItems={launchpadItems}
            taskGroups={taskGroups}
            hasReachedLimit={hasReachedScheduleLimit}
            onClose={closeCalendarEntryModal}
            onSubmit={handleSaveCalendarEntry}
            isSaving={isSavingCalendarEntry}
          />
        ) : null}

        <ConfirmDialog
          open={Boolean(calendarEntryToDelete)}
          title="Remove calendar target?"
          message={`Are you sure you want to remove ${calendarEntryToDelete?.title ?? 'this target'} from your calendar?`}
          onConfirm={handleDeleteCalendarEntry}
          onCancel={() => setCalendarEntryToDelete(null)}
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

        <div
          id="active-workspace"
          ref={workspaceContentRef}
          className="grid scroll-mt-24 gap-8"
        >
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
                  disabled={hasReachedProjectLimit}
                  onClick={openManualImport}
                  className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-80"
                >
                  <FolderPlus className="h-4 w-4" />
                  {hasReachedProjectLimit
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
          <div className="grid gap-5">
            <section className="w-fit max-w-full overflow-x-auto rounded-2xl border border-white/50 p-1.5 shadow-md glass-panel-light dark:border-white/10 dark:glass-panel-dark">
              <div className="flex min-w-max gap-1">
                <button
                  type="button"
                  onClick={() => setNotesWorkspaceView('notes')}
                  className={
                    notesWorkspaceView === 'notes'
                      ? 'inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/15 transition'
                      : 'inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-white/50 dark:text-slate-300 dark:hover:bg-white/5'
                  }
                >
                  <StickyNote className="h-4 w-4" />
                  Notes
                </button>
                <button
                  type="button"
                  onClick={() => setNotesWorkspaceView('documents')}
                  className={
                    notesWorkspaceView === 'documents'
                      ? 'inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/15 transition'
                      : 'inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-white/50 dark:text-slate-300 dark:hover:bg-white/5'
                  }
                >
                  <Images className="h-4 w-4" />
                  Docs & Images
                </button>
              </div>
            </section>

            {notesWorkspaceView === 'notes' ? (
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
            ) : (
              <DocumentsWorkspace
                uid={user?.uid}
                documents={documents}
                loading={documentsLoading}
                error={documentsError}
                addToast={addToast}
                uploadRequest={documentUploadRequest}
                searchInputRef={documentsSearchInputRef}
              />
            )}
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
                <div className="grid gap-6">
                  {pinnedTaskGroups.length > 0 ? (
                    <section className="grid gap-3">
                      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                        📌 Pinned
                      </p>
                      <div className="grid items-start gap-6 lg:grid-cols-2">
                        {pinnedTaskGroups.map((taskGroup) => (
                          <TaskGroupCard
                            key={taskGroup.id}
                            taskGroup={taskGroup}
                            onEdit={openTaskGroupComposer}
                            onDelete={setTaskGroupToDelete}
                            onTogglePin={handleToggleTaskGroupPin}
                            onUpdateTasks={handleUpdateTaskGroupTasks}
                            onSelectTag={setTasksFilterTag}
                          />
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {regularTaskGroups.length > 0 ? (
                    <section className="grid gap-3">
                      {pinnedTaskGroups.length > 0 ? (
                        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                          All task groups
                        </p>
                      ) : null}
                      <div className="grid items-start gap-6 lg:grid-cols-2">
                        {regularTaskGroups.map((taskGroup) => (
                          <TaskGroupCard
                            key={taskGroup.id}
                            taskGroup={taskGroup}
                            onEdit={openTaskGroupComposer}
                            onDelete={setTaskGroupToDelete}
                            onTogglePin={handleToggleTaskGroupPin}
                            onUpdateTasks={handleUpdateTaskGroupTasks}
                            onSelectTag={setTasksFilterTag}
                          />
                        ))}
                      </div>
                    </section>
                  ) : null}
                </div>
              </section>
            ) : null}
          </div>
        ) : dashboardMode === 'calendar' ? (
          <CalendarWorkspace
            entries={calendarEntries}
            loading={calendarEntriesLoading}
            projects={projects}
            launchpadItems={launchpadItems}
            taskGroups={taskGroups}
            onCreate={openCalendarEntryComposer}
            onEdit={openCalendarEntryEditor}
            onDelete={setCalendarEntryToDelete}
            onOpenProject={openCalendarLinkedProject}
            onOpenTaskGroup={openCalendarLinkedTaskGroup}
          />
        ) : dashboardMode === 'ai' ? (
          <AiWorkspace
            userId={user?.uid}
            projects={projects}
            launchpadItems={launchpadItems}
            notes={notes}
            taskGroups={taskGroups}
            calendarEntries={calendarEntries}
            onDeleteProject={handleDeleteProject}
            onEditProject={() => {
              openManualImport()
            }}
            onDeleteNote={handleDeleteNote}
            onEditNote={openNoteComposer}
            onToggleNotePin={handleToggleNotePin}
            onDeleteTaskGroup={setTaskGroupToDelete}
            onEditTaskGroup={openTaskGroupComposer}
            onUpdateTaskGroupTasks={handleUpdateTaskGroupTasks}
            onDeleteLaunchpadItem={handleDeleteLaunchpadItem}
            onUpdateLaunchpadItem={handleUpdateLaunchpadItem}
            onToggleLaunchpadPin={handleToggleLaunchpadPin}
            addToast={addToast}
          />
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
        </div>
      </main>



      <MadeByFooter className="px-4 pb-6 sm:px-6 lg:px-8" />

      <AddProjectModal
        open={isManualImportOpen}
        onClose={() => setIsManualImportOpen(false)}
        addToast={addToast}
        maxProjects={maxProjects}
        usedProjects={usedProjectCount}
        hasReachedLimit={hasReachedProjectLimit}
        isUnlimited={isProPlan}
        planLabel={planLabel}
      />

      <AddLaunchpadModal
        open={isAddLaunchpadOpen}
        onClose={() => setIsAddLaunchpadOpen(false)}
        addToast={addToast}
        maxWebsites={maxWebsites}
        usedWebsites={usedWebsiteCount}
        hasReachedLimit={hasReachedWebsiteLimit}
        isUnlimited={isProPlan}
      />

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  )
}
