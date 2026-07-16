import { useMemo, useState } from 'react'
import { addDoc, collection, Timestamp } from 'firebase/firestore'
import { FolderPlus, X } from 'lucide-react'
import {
  getLaunchpadCategoryLabel,
  getLaunchpadCategoryOptions,
  normalizeLaunchpadCategoryInput,
} from '../constants/launchpadCategories'
import { SUGGESTED_PLATFORMS } from '../constants/launchpadSuggestions'
import { auth, db } from '../firebase'
import LaunchpadFavicon from './LaunchpadFavicon'
import { isValidUrl } from '../utils/faviconUtils'

export default function AddLaunchpadModal({
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

  function handleCustomCategoryApply() {
    const nextCategory = normalizeLaunchpadCategoryInput(formState.customCategory)

    if (!nextCategory) {
      addToast('Type a category name before adding it.', 'info')
      return
    }

    setFormState((currentState) => ({
      ...currentState,
      category: nextCategory,
      customCategory: '',
    }))
    addToast(`Using ${nextCategory} as the category.`, 'success')
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const uid = auth.currentUser?.uid
    const name = formState.name.trim()
    const url = formState.url.trim()
    const category = normalizeLaunchpadCategoryInput(formState.category) || 'other'

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

    setIsSaving(true)

    try {
      await addDoc(collection(db, 'users', uid, 'launchpad'), {
        name,
        url,
        category,
        notes: formState.notes.trim(),
        isPinned: false,
        lastVisitedAt: null,
        order: 0,
        createdAt: Timestamp.now(),
      })

      addToast(`${name} added to Launchpad`, 'success')
      handleClose()
    } catch {
      addToast('Unable to add that shortcut right now.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
            Launchpad Shortcut
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Add a website shortcut
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Save a web platform you use often, choose or create its category,
            and keep it ready inside Launchpad.
          </p>
        </div>

        <button
          type="button"
          onClick={handleClose}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-slate-500 transition hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Close add shortcut panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form className="mt-6 grid gap-5" onSubmit={handleSubmit}>
        <div className="grid gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Quick add popular platforms
          </p>
          <div className="grid grid-cols-3 gap-2 lg:grid-cols-4">
            {SUGGESTED_PLATFORMS.map((platform) => (
              <button
                key={platform.url}
                type="button"
                onClick={() => handleSuggestionClick(platform)}
                className="flex min-h-20 flex-col items-center gap-2 rounded-2xl border border-gray-200 px-3 py-3 text-center text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-blue-500/30 dark:hover:bg-blue-500/10"
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
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
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
              className="rounded-2xl border border-gray-200 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
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
                <div className="h-10 w-10 shrink-0 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700" />
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
                className="min-w-0 flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
              />
            </div>
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Category
            </span>
            <select
              value={formState.category}
              onChange={(event) =>
                setFormState((currentState) => ({
                  ...currentState,
                  category: event.target.value,
                }))
              }
              className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
            >
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {getLaunchpadCategoryLabel(category)}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Add custom category
            </span>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={formState.customCategory}
                onChange={(event) =>
                  setFormState((currentState) => ({
                    ...currentState,
                    customCategory: event.target.value,
                  }))
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    handleCustomCategoryApply()
                  }
                }}
                placeholder="e.g. CRM, Finance, Monitoring"
                className="min-w-0 flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
              />
              <button
                type="button"
                onClick={handleCustomCategoryApply}
                className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Use category
              </button>
            </div>
          </div>
        </div>

        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
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
            className="resize-none rounded-2xl border border-gray-200 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
          />
        </label>

        {!isUnlimited ? (
          <div className="grid gap-2">
            <p className="text-sm font-medium text-blue-700 dark:text-blue-200">
              {`${usedWebsites}/${maxWebsites} websites used. ${remainingWebsiteSlots} slot${remainingWebsiteSlots === 1 ? '' : 's'} left.`}
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving || hasEffectiveLimit}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-80"
          >
            {isSaving ? (
              'Saving shortcut...'
            ) : (
              <>
                <FolderPlus className="h-4 w-4" />
                {hasEffectiveLimit ? 'Website limit reached' : 'Add shortcut'}
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  )
}
