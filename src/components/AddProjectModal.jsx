import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, FolderPlus, LoaderCircle } from 'lucide-react'
import { addDoc, collection, Timestamp } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { queueFirestoreWrite } from '../features/offline-mode/firestoreSyncStore'
import { LANGUAGE_COLORS } from '../constants/languageColors'
import { normalizeProjectPath, normalizeRepositoryUrl } from '../utils/formatters'
import { buildProjectEnvironments } from '../utils/projectEnvironments'

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

function AddProjectModalForm({
  onClose,
  addToast,
  maxProjects,
  usedProjects,
  hasReachedLimit,
  isUnlimited = false,
  planLabel,
}) {
  const [projectDraft, setProjectDraft] = useState({
    displayName: '',
    absolutePath: '',
    repositoryUrl: '',
    languagesList: [],
    customLanguage: '',
  })
  const [isSaving, setIsSaving] = useState(false)

  const remainingProjectSlots = Math.max(0, maxProjects - usedProjects)

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

  async function handleManualImportSubmit(event) {
    event.preventDefault()

    const user = auth.currentUser
    if (!user) {
      addToast('You need to be signed in to add projects.', 'error')
      return
    }

    if (!isUnlimited && hasReachedLimit) {
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
      projectDraft.displayName.trim() ||
      absolutePath.split('/').filter(Boolean).pop() ||
      'Unnamed Project'
    const timestamp = Timestamp.now()
    const environments = buildProjectEnvironments({
      absolutePath,
      notes: '',
      isBroken: false,
      lastOpenedAt: null,
    })

    setIsSaving(true)

    try {
      const writeResult = await queueFirestoreWrite(
        () =>
          addDoc(collection(db, 'users', user.uid, 'projects'), {
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
          }),
        `add ${displayName} project`,
      )

      addToast(
        writeResult.queued
          ? `Added ${displayName} locally. It will sync when ProMana is online.`
          : `Added ${displayName}.`,
        'success',
      )
      onClose()
    } catch (error) {
      addToast(getImportErrorMessage(error), 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className="calendar-modal-backdrop fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 px-3 py-3 backdrop-blur-md sm:items-center sm:px-4 sm:py-6"
      onClick={onClose}
    >
      <div
        className="calendar-modal-panel relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/40 dark:border-white/10 glass-panel-light dark:glass-panel-dark p-5 shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:p-7"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
              Projects workspace
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
              Add a local project
            </h2>
            <p className="mt-2 text-sm leading-relaxed font-medium text-slate-600 dark:text-slate-300">
              Enter the local project path, optionally rename the card, and
              choose the programming languages you want displayed.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/40 text-slate-500 transition hover:bg-white/40 disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5 cursor-pointer"
            aria-label="Close manual import"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="mt-6 flex min-h-0 flex-1 flex-col" onSubmit={handleManualImportSubmit}>
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
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
                  placeholder="Optional, folder name will be used if blank"
                  className="rounded-2xl border border-white/40 bg-white/80 px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-slate-950/80 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
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
                  placeholder="e.g. /Users/username/projects/my-app"
                  className="rounded-2xl border border-white/40 bg-white/80 px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-slate-950/80 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                />
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
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
                placeholder="Optional, e.g. github.com/owner/repository"
                className="rounded-2xl border border-white/40 bg-white/80 px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-slate-950/80 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
              />
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Add a repository URL so the card can open the repo directly in a browser tab.
              </p>
            </label>

            <div className="grid gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Programming languages
              </p>
              <div className="flex flex-wrap gap-2">
                {MANUAL_LANGUAGE_OPTIONS.map((language) => {
                  const isSelected = projectDraft.languagesList.includes(language)

                  return (
                    <button
                      key={language}
                      type="button"
                      onClick={() => handleLanguageToggle(language)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition border cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-500/15'
                          : 'border-white/40 bg-white/80 text-slate-700 hover:bg-white dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-200 dark:hover:bg-slate-950'
                      }`}
                    >
                      {language}
                    </button>
                  )
                })}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row mt-1">
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
                  className="min-w-0 flex-1 rounded-2xl border border-white/40 bg-white/80 px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-slate-950/80 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                />
                <button
                  type="button"
                  onClick={handleCustomLanguageAdd}
                  className="rounded-2xl border border-white/40 px-4 py-3 text-sm font-bold text-slate-700 bg-white/80 transition hover:bg-white dark:border-white/10 dark:text-slate-200 dark:bg-slate-950/80 dark:hover:bg-slate-950 cursor-pointer"
                >
                  Add custom language
                </button>
              </div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                The project card will show these as a language list.
              </p>
              {!isUnlimited ? (
                <p className="text-xs font-bold text-blue-700 dark:text-blue-300">
                  {`${planLabel}: ${usedProjects}/${maxProjects} projects used. ${remainingProjectSlots} slot${remainingProjectSlots === 1 ? '' : 's'} left.`}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-6 flex shrink-0 flex-wrap justify-end gap-3 border-t border-white/20 pt-4 dark:border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/40 px-4 py-3 text-sm font-bold text-slate-700 bg-white/80 transition hover:bg-white dark:border-white/10 dark:text-slate-200 dark:bg-slate-950/80 dark:hover:bg-slate-950 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || (!isUnlimited && hasReachedLimit)}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/15 transition-all hover:brightness-110 hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-80 cursor-pointer"
            >
              {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {isSaving
                ? 'Saving project...'
                : !isUnlimited && hasReachedLimit
                  ? 'Project limit reached'
                  : 'Add project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AddProjectModal({
  open,
  onClose,
  addToast,
  maxProjects,
  usedProjects,
  hasReachedLimit,
  isUnlimited = false,
  planLabel,
}) {
  if (!open || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <AddProjectModalForm
      onClose={onClose}
      addToast={addToast}
      maxProjects={maxProjects}
      usedProjects={usedProjects}
      hasReachedLimit={hasReachedLimit}
      isUnlimited={isUnlimited}
      planLabel={planLabel}
    />,
    document.body,
  )
}
