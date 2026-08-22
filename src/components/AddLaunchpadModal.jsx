import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { addDoc, collection, Timestamp } from 'firebase/firestore'
import { FolderPlus, X, LoaderCircle } from 'lucide-react'
import {
  getLaunchpadCategoryLabel,
  getLaunchpadCategoryOptions,
  normalizeLaunchpadCategoryInput,
} from '../constants/launchpadCategories'
import { SUGGESTED_PLATFORMS } from '../constants/launchpadSuggestions'
import { auth, db } from '../firebase'
import { queueFirestoreWrite } from '../features/offline-mode/firestoreSyncStore'
import LaunchpadFavicon from './LaunchpadFavicon'
import { isValidUrl } from '../utils/faviconUtils'

function AddLaunchpadModalForm({
  onClose,
  addToast,
  maxWebsites,
  usedWebsites,
  hasReachedLimit,
  isUnlimited = false,
}) {
  const [formState, setFormState] = useState({
    name: '',
    url: '',
    category: 'code',
    customCategory: '',
    notes: '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const isUrlValid = useMemo(() => isValidUrl(formState.url), [formState.url])
  const categoryOptions = useMemo(
    () => getLaunchpadCategoryOptions([formState.category]),
    [formState.category],
  )
  const hasEffectiveLimit = !isUnlimited && hasReachedLimit
  const remainingWebsiteSlots = Math.max(0, maxWebsites - usedWebsites)

  function resetForm() {
    setFormState({
      name: '',
      url: '',
      category: 'code',
      customCategory: '',
      notes: '',
    })
  }

  function handleClose() {
    resetForm()
    onClose?.()
  }

  function handleSuggestionClick(platform) {
    setFormState((currentState) => ({
      ...currentState,
      name: platform.name,
      url: platform.url,
      category: platform.category,
      customCategory: '',
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const uid = auth.currentUser?.uid
    const name = formState.name.trim()
    const url = formState.url.trim()
    const selectedCategory =
      normalizeLaunchpadCategoryInput(formState.category) || 'other'
    const customCategory = normalizeLaunchpadCategoryInput(
      formState.customCategory,
    )
    const category =
      selectedCategory === 'other' ? customCategory : selectedCategory

    if (!uid) {
      addToast('You need to be signed in to add shortcuts.', 'error')
      return
    }

    if (hasEffectiveLimit) {
      addToast(
        `You can only save ${maxWebsites} website shortcuts here. Remove one before adding another.`,
        'error',
      )
      return
    }

    if (!name) {
      addToast('Web name is required.', 'error')
      return
    }

    if (!url || !isValidUrl(url)) {
      addToast('Add a valid http or https URL before saving.', 'error')
      return
    }

    if (!category) {
      addToast('Type a custom category name before saving.', 'error')
      return
    }

    setIsSaving(true)

    try {
      const writeResult = await queueFirestoreWrite(
        () =>
          addDoc(collection(db, 'users', uid, 'launchpad'), {
            name,
            url,
            category,
            notes: formState.notes.trim(),
            isPinned: false,
            lastVisitedAt: null,
            order: 0,
            createdAt: Timestamp.now(),
          }),
        `add ${name} launchpad shortcut`,
      )

      addToast(
        writeResult.queued
          ? `${name} was added locally and will sync when ProMana is online.`
          : `${name} added to Launchpad`,
        'success',
      )
      handleClose()
    } catch {
      addToast('Unable to add that shortcut right now.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className="calendar-modal-backdrop fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 px-3 py-3 backdrop-blur-md sm:items-center sm:px-4 sm:py-6"
      onClick={handleClose}
    >
      <div
        className="calendar-modal-panel relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/40 dark:border-white/10 glass-panel-light dark:glass-panel-dark p-5 shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:p-7"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
              Launchpad Shortcut
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
              Add a website shortcut
            </h2>
            <p className="mt-2 text-sm leading-relaxed font-medium text-slate-600 dark:text-slate-300">
              Save a web platform you use often, choose or create its category,
              and keep it ready inside Launchpad.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/40 text-slate-500 transition hover:bg-white/40 disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5 cursor-pointer"
            aria-label="Close add shortcut panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="mt-6 flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1">
            <div className="grid gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Quick add popular platforms
              </p>
              <div className="grid grid-cols-3 gap-2 lg:grid-cols-4">
                {SUGGESTED_PLATFORMS.map((platform) => (
                  <button
                    key={platform.url}
                    type="button"
                    onClick={() => handleSuggestionClick(platform)}
                    className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border border-white/40 bg-white/40 px-3 py-3 text-center text-xs font-bold text-slate-700 transition hover:border-blue-500/20 hover:bg-white dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:border-blue-500/20 dark:hover:bg-slate-950 cursor-pointer"
                  >
                    <LaunchpadFavicon
                      url={platform.url}
                      name={platform.name}
                      size={24}
                    />
                    <span>{platform.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Web name
                </span>
                <input
                  type="text"
                  required
                  value={formState.name}
                  onChange={(event) =>
                    setFormState((currentState) => ({
                      ...currentState,
                      name: event.target.value,
                    }))
                  }
                  placeholder="e.g. GitHub"
                  className="rounded-2xl border border-white/40 bg-white/80 px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-slate-950/80 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  URL
                </span>
                <div className="flex items-center gap-3">
                  {isUrlValid ? (
                    <LaunchpadFavicon
                      url={formState.url}
                      name={formState.name || formState.url}
                      size={40}
                    />
                  ) : (
                    <div className="h-10 w-10 shrink-0 rounded-2xl border border-dashed border-white/40 dark:border-white/10 bg-white/40 dark:bg-slate-950/40" />
                  )}
                  <input
                    type="text"
                    required
                    value={formState.url}
                    onChange={(event) =>
                      setFormState((currentState) => ({
                        ...currentState,
                        url: event.target.value,
                      }))
                    }
                    placeholder="https://github.com"
                    className="min-w-0 flex-1 rounded-2xl border border-white/40 bg-white/80 px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-slate-950/80 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                  />
                </div>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Category
                </span>
                <select
                  value={formState.category}
                  onChange={(event) => {
                    const nextCategory = event.target.value

                    setFormState((currentState) => ({
                      ...currentState,
                      category: nextCategory,
                      customCategory:
                        nextCategory === 'other'
                          ? currentState.customCategory
                          : '',
                    }))
                  }}
                  className="rounded-2xl border border-white/40 bg-white/80 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-slate-950/80 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400/20 cursor-pointer"
                >
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {getLaunchpadCategoryLabel(category)}
                    </option>
                  ))}
                </select>
              </label>

              {formState.category === 'other' ? (
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    Custom category
                  </span>
                  <input
                    type="text"
                    required
                    value={formState.customCategory}
                    onChange={(event) =>
                      setFormState((currentState) => ({
                        ...currentState,
                        customCategory: event.target.value,
                      }))
                    }
                    placeholder="e.g. CRM, Finance, Monitoring"
                    autoFocus
                    className="min-w-0 rounded-2xl border border-white/40 bg-white/80 px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-slate-950/80 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                  />
                </label>
              ) : null}
            </div>

            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Notes
              </span>
              <textarea
                rows={4}
                value={formState.notes}
                onChange={(event) =>
                  setFormState((currentState) => ({
                    ...currentState,
                    notes: event.target.value,
                  }))
                }
                placeholder="Add any notes about this website..."
                className="resize-none rounded-2xl border border-white/40 bg-white/80 px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-slate-950/80 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
              />
            </label>

            {!isUnlimited ? (
              <div className="grid gap-2">
                <p className="text-xs font-bold text-blue-700 dark:text-blue-300">
                  {`Free plan: ${usedWebsites}/${maxWebsites} websites used. ${remainingWebsiteSlots} slot${remainingWebsiteSlots === 1 ? '' : 's'} left.`}
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex shrink-0 flex-wrap justify-end gap-3 border-t border-white/20 pt-4 dark:border-white/5">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-2xl border border-white/40 px-4 py-3 text-sm font-bold text-slate-700 bg-white/80 transition hover:bg-white dark:border-white/10 dark:text-slate-200 dark:bg-slate-950/80 dark:hover:bg-slate-950 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || hasEffectiveLimit}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/15 transition-all hover:brightness-110 hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-80 cursor-pointer"
            >
              {isSaving ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <FolderPlus className="h-4 w-4" />
              )}
              {isSaving
                ? 'Saving shortcut...'
                : hasEffectiveLimit
                  ? 'Website limit reached'
                  : 'Add shortcut'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AddLaunchpadModal({
  open,
  onClose,
  addToast,
  maxWebsites,
  usedWebsites,
  hasReachedLimit,
  isUnlimited = false,
}) {
  if (!open || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <AddLaunchpadModalForm
      onClose={onClose}
      addToast={addToast}
      maxWebsites={maxWebsites}
      usedWebsites={usedWebsites}
      hasReachedLimit={hasReachedLimit}
      isUnlimited={isUnlimited}
    />,
    document.body,
  )
}
