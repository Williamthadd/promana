import { useEffect, useMemo, useRef, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, Timestamp } from 'firebase/firestore'
import { FolderPlus, LoaderCircle, SearchX, X } from 'lucide-react'
import Header from '../components/Header'
import MadeByFooter from '../components/MadeByFooter'
import ProjectCard from '../components/ProjectCard'
import SearchBar from '../components/SearchBar'
import SkeletonCard from '../components/SkeletonCard'
import SortFilterBar from '../components/SortFilterBar'
import ToastContainer from '../components/ToastContainer'
import { LANGUAGE_COLORS } from '../constants/languageColors'
import { db } from '../firebase'
import useAuth from '../hooks/useAuth'
import useProjects from '../hooks/useProjects'
import useToast from '../hooks/useToast'
import {
  getTimeValue,
  normalizeProjectPath,
} from '../utils/formatters'
import {
  getPrimaryProjectLanguage,
  getProjectLanguages,
} from '../utils/projectLanguages'

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

const MAX_PROJECTS = 10
const MANUAL_LANGUAGE_OPTIONS = Object.keys(LANGUAGE_COLORS).filter(
  (language) => language !== 'Other',
)

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const { projects, loading: projectsLoading, error } = useProjects(user?.uid)
  const { toasts, addToast, removeToast } = useToast()
  const [search, setSearch] = useState('')
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
  const [projectDraft, setProjectDraft] = useState({
    displayName: '',
    absolutePath: '',
    languagesList: [],
  })
  const searchInputRef = useRef(null)
  const hasReachedProjectLimit = projects.length >= MAX_PROJECTS
  const remainingProjectSlots = Math.max(0, MAX_PROJECTS - projects.length)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    window.localStorage.setItem('proman-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

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
      searchInputRef.current?.focus()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  useEffect(() => {
    if (error) {
      addToast('Realtime sync hit an issue. Please try refreshing.', 'error')
    }
  }, [addToast, error])

  useEffect(() => {
    if (hasReachedProjectLimit && isManualImportOpen) {
      setIsManualImportOpen(false)
      resetProjectDraft()
    }
  }, [hasReachedProjectLimit, isManualImportOpen])

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

  const visibleProjects = useMemo(() => {
    const searchTerm = search.trim().toLowerCase()

    return [...projects]
      .filter((project) => {
        const matchesSearch =
          !searchTerm ||
          (project.displayName ?? '').toLowerCase().includes(searchTerm) ||
          (project.absolutePath ?? '').toLowerCase().includes(searchTerm)

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
      languagesList: [],
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

  function openManualImport() {
    if (hasReachedProjectLimit) {
      addToast(
        `You can only import ${MAX_PROJECTS} projects here. Remove one before adding another.`,
        'error',
      )
      return
    }

    setIsManualImportOpen(true)
  }

  async function handleManualImportSubmit(event) {
    event.preventDefault()

    if (!user) {
      addToast('You need to be signed in to add projects.', 'error')
      return
    }

    if (hasReachedProjectLimit) {
      addToast(
        `You can only import ${MAX_PROJECTS} projects here. Remove one before adding another.`,
        'error',
      )
      return
    }

    const absolutePath = normalizeProjectPath(projectDraft.absolutePath)

    if (!absolutePath) {
      addToast('Add the local project path before saving.', 'error')
      return
    }

    const languagesList = projectDraft.languagesList.length
      ? projectDraft.languagesList
      : ['Other']
    const displayName =
      projectDraft.displayName.trim()
    const timestamp = Timestamp.now()

    setManualImportState({
      active: true,
      message: `Adding ${displayName} to your dashboard...`,
    })

    try {
      await addDoc(collection(db, 'users', user.uid, 'projects'), {
        displayName,
        absolutePath,
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

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#BFDBFE] dark:bg-slate-950">
        <LoaderCircle className="h-10 w-10 animate-spin text-blue-600 dark:text-blue-300" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#BFDBFE] pb-10 dark:bg-slate-950">
      <div className="pointer-events-none absolute left-0 top-0 h-72 w-72 rounded-full bg-white/40 blur-3xl dark:bg-blue-500/10" />
      <div className="pointer-events-none absolute right-0 top-32 h-80 w-80 rounded-full bg-cyan-200/50 blur-3xl dark:bg-cyan-500/10" />

      <Header
        user={user}
        darkMode={darkMode}
        onToggleDark={() => setDarkMode((current) => !current)}
        addToast={addToast}
      />

      <main className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                Workspace dashboard
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                Open local projects faster than your dock can keep up.
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Add your local projects manually, keep paths editable, and save
                a clean list of programming languages for each workspace. Free plan: You
                can only import {MAX_PROJECTS} projects here.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-4 lg:min-w-[26rem]">
              <div className="rounded-2xl bg-blue-50 px-4 py-3 dark:bg-blue-500/10">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-200">
                  Projects
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                  {projects.length}
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
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            {hasReachedProjectLimit
              ? `Free plan: Project limit reached. Each account can only import ${MAX_PROJECTS} projects here.`
              : `Free plan: ${remainingProjectSlots} of ${MAX_PROJECTS} project slot${remainingProjectSlots === 1 ? '' : 's'} remaining.`}
          </p>
        </section>

        {isManualImportOpen ? (
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
                  choose the programming languages you want displayed. Free plan: You can
                  only import {MAX_PROJECTS} projects here.
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
              <div className="grid gap-4 md:grid-cols-2">
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
                    placeholder="Optional, ProMan will use the folder name if blank"
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
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  The project card will show these as a language list. No file
                  scanning or percentage breakdown will be generated.
                </p>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-200">
                  {`${projects.length}/${MAX_PROJECTS} projects used.`}
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
              Bring your first local project into ProMan.
            </h2>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Add your first project manually by saving its local path and the
              programming languages you want shown on the card. Free plan: You can only
              import {MAX_PROJECTS} projects here.
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
                />
              ))}
            </div>
          </section>
        ) : null}
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
              ProMan is saving the new project card and preparing it for the
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
