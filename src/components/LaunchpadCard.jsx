import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bookmark,
  ExternalLink,
  Globe,
  MoreVertical,
  StickyNote,
} from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import {
  getLaunchpadCategoryLabel,
  getLaunchpadCategoryOptions,
  normalizeLaunchpadCategoryInput,
} from '../constants/launchpadCategories'
import { formatRelativeTime } from '../utils/formatters'
import { getDomainFromUrl, isValidUrl } from '../utils/faviconUtils'
import ConfirmDialog from './ConfirmDialog'
import LaunchpadFavicon from './LaunchpadFavicon'

const CATEGORY_COLOR_CLASSES = {
  code: 'bg-[#3178C6]/10 text-[#3178C6] dark:bg-[#3178C6]/20 dark:text-[#9fc4f5]',
  design: 'bg-[#D4537E]/10 text-[#D4537E] dark:bg-[#D4537E]/20 dark:text-[#f1a5bf]',
  docs: 'bg-[#1D9E75]/10 text-[#1D9E75] dark:bg-[#1D9E75]/20 dark:text-[#8ae3c7]',
  devops: 'bg-[#E34C26]/10 text-[#E34C26] dark:bg-[#E34C26]/20 dark:text-[#ffb39f]',
  communication:
    'bg-[#7F77DD]/10 text-[#7F77DD] dark:bg-[#7F77DD]/20 dark:text-[#c7c3fb]',
  ai: 'bg-[#BA7517]/10 text-[#BA7517] dark:bg-[#BA7517]/20 dark:text-[#f0cb92]',
  other: 'bg-[#888780]/10 text-[#6b7280] dark:bg-[#888780]/20 dark:text-[#d4d4cf]',
}

export default function LaunchpadCard({
  item,
  onDelete,
  onUpdate,
  onTogglePin,
  addToast,
}) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [isEditingUrl, setIsEditingUrl] = useState(false)
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [isCategoryEditorOpen, setIsCategoryEditorOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [nameDraft, setNameDraft] = useState(item.name ?? '')
  const [urlDraft, setUrlDraft] = useState(item.url ?? '')
  const [notesDraft, setNotesDraft] = useState(item.notes ?? '')
  const [categoryDraft, setCategoryDraft] = useState(item.category ?? 'other')
  const [customCategoryDraft, setCustomCategoryDraft] = useState('')
  const [notesMenuState, setNotesMenuState] = useState({
    isOpen: false,
    x: 0,
    y: 0,
    selectedText: '',
  })
  const menuRef = useRef(null)
  const notesMenuRef = useRef(null)
  const domain = useMemo(() => getDomainFromUrl(item.url), [item.url])
  const categoryOptions = useMemo(
    () => getLaunchpadCategoryOptions([item.category]),
    [item.category],
  )
  const categoryClass =
    CATEGORY_COLOR_CLASSES[item.category] ?? CATEGORY_COLOR_CLASSES.other
  const categoryLabel = getLaunchpadCategoryLabel(item.category)

  useEffect(() => {
    if (!isMenuOpen && !isCategoryEditorOpen && !notesMenuState.isOpen) {
      return undefined
    }

    function handlePointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false)
        setIsCategoryEditorOpen(false)
        setCategoryDraft(item.category ?? 'other')
        setCustomCategoryDraft('')
      }

      if (
        notesMenuRef.current &&
        !notesMenuRef.current.contains(event.target)
      ) {
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
  }, [isCategoryEditorOpen, isMenuOpen, item.category, notesMenuState.isOpen])

  async function commitName() {
    const nextName = nameDraft.trim()
    setIsEditingName(false)

    if (!nextName) {
      setNameDraft(item.name ?? '')
      addToast('Shortcut name cannot be empty.', 'error')
      return
    }

    if (nextName === item.name) {
      return
    }

    const didUpdate = await onUpdate?.(item, { name: nextName })

    if (didUpdate === false) {
      return
    }

    addToast('Shortcut name updated.', 'success')
  }

  async function commitUrl() {
    const nextUrl = urlDraft.trim()
    setIsEditingUrl(false)

    if (!isValidUrl(nextUrl)) {
      setUrlDraft(item.url ?? '')
      addToast('Add a valid website URL that starts with http or https.', 'error')
      return
    }

    if (nextUrl === item.url) {
      return
    }

    const didUpdate = await onUpdate?.(item, { url: nextUrl })

    if (didUpdate === false) {
      return
    }

    addToast('Shortcut URL updated.', 'success')
  }

  async function commitNotes() {
    const nextNotes = notesDraft.trim()
    setIsEditingNotes(false)

    if (nextNotes === (item.notes ?? '').trim()) {
      return
    }

    const didUpdate = await onUpdate?.(item, { notes: nextNotes })

    if (didUpdate === false) {
      return
    }

    addToast(nextNotes ? 'Notes updated.' : 'Notes cleared.', 'success')
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
      item.notes
        ? 'Right-click the notes area and choose Edit Notes to update this note.'
        : 'Right-click the notes button and choose Edit Notes to add a note.',
      'info',
    )
  }

  function startEditingNotes() {
    setNotesMenuState((currentState) => ({
      ...currentState,
      isOpen: false,
    }))
    setNotesDraft(item.notes ?? '')
    setIsEditingNotes(true)
  }

  async function handleCopyNotesText() {
    const nextText = notesMenuState.selectedText || (item.notes ?? '')

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

  async function handleCategoryChange(nextCategory) {
    const normalizedCategory = normalizeLaunchpadCategoryInput(nextCategory)

    if (!normalizedCategory) {
      addToast('Category cannot be empty.', 'error')
      return
    }

    if (normalizedCategory === item.category) {
      setIsCategoryEditorOpen(false)
      setCategoryDraft(normalizedCategory)
      setCustomCategoryDraft('')
      return
    }

    const didUpdate = await onUpdate?.(item, { category: normalizedCategory })

    if (didUpdate === false) {
      return
    }

    setIsCategoryEditorOpen(false)
    setCategoryDraft(normalizedCategory)
    setCustomCategoryDraft('')
    addToast('Category updated.', 'success')
  }

  function handleCustomCategoryApply() {
    void handleCategoryChange(customCategoryDraft)
  }

  async function handleOpenWebsite() {
    window.open(item.url, '_blank', 'noopener,noreferrer')
    await onUpdate?.(item, { lastVisitedAt: Timestamp.now() })
    addToast(`Opened ${item.name}`, 'success')
  }

  async function handleDeleteConfirm() {
    setIsConfirmOpen(false)
    await onDelete?.(item)
  }

  return (
    <>
      <article className="relative flex h-full flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <LaunchpadFavicon url={item.url} name={item.name} size={48} />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void onTogglePin?.(item)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/10 dark:hover:text-blue-200"
              aria-label={item.isPinned ? 'Unpin shortcut' : 'Pin shortcut'}
            >
              <Bookmark
                className="h-4.5 w-4.5"
                fill={item.isPinned ? 'currentColor' : 'none'}
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
                fill={item.notes ? 'currentColor' : 'none'}
              />
            </button>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setIsMenuOpen((currentState) => !currentState)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-slate-500 transition hover:border-gray-300 hover:bg-gray-50 hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                aria-label="Open shortcut actions"
              >
                <MoreVertical className="h-4.5 w-4.5" />
              </button>

              {isMenuOpen ? (
                <div className="absolute right-0 top-12 z-20 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-100 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-950">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false)
                      setNameDraft(item.name ?? '')
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
                      setUrlDraft(item.url ?? '')
                      setIsEditingUrl(true)
                    }}
                    className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Edit URL
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCategoryEditorOpen((currentState) => !currentState)
                      setCategoryDraft(item.category ?? 'other')
                      setCustomCategoryDraft('')
                    }}
                    className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Change category
                  </button>
                  {isCategoryEditorOpen ? (
                    <div className="mt-2 grid max-w-full gap-2">
                      <select
                        autoFocus
                        value={categoryDraft}
                        onChange={(event) => {
                          const nextCategory = event.target.value
                          setCategoryDraft(nextCategory)

                          if (nextCategory !== 'other') {
                            void handleCategoryChange(nextCategory)
                          }
                        }}
                        className="w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      >
                        {categoryOptions.map((categoryValue) => (
                          <option key={categoryValue} value={categoryValue}>
                            {getLaunchpadCategoryLabel(categoryValue)}
                          </option>
                        ))}
                      </select>
                      {categoryDraft === 'other' ? (
                        <>
                          <input
                            type="text"
                            value={customCategoryDraft}
                            onChange={(event) =>
                              setCustomCategoryDraft(event.target.value)
                            }
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault()
                                handleCustomCategoryApply()
                              }
                            }}
                            placeholder="Custom category"
                            className="w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={handleCustomCategoryApply}
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            Save custom category
                          </button>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false)
                      setNotesDraft(item.notes ?? '')
                      setIsEditingNotes(true)
                    }}
                    className="mt-1 w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Edit notes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false)
                      setIsConfirmOpen(true)
                    }}
                    className="mt-1 w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    Remove shortcut
                  </button>
                </div>
              ) : null}
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
              onBlur={() => void commitName()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void commitName()
                }

                if (event.key === 'Escape') {
                  setIsEditingName(false)
                  setNameDraft(item.name ?? '')
                }
              }}
              className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xl font-semibold text-slate-900 outline-none focus:border-blue-400 dark:border-blue-500/40 dark:bg-slate-800 dark:text-white"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setNameDraft(item.name ?? '')
                setIsEditingName(true)
              }}
              className="text-left text-xl font-semibold tracking-tight text-slate-900 transition hover:text-blue-700 dark:text-white dark:hover:text-blue-200"
            >
              {item.name}
            </button>
          )}

          {isEditingUrl ? (
            <input
              autoFocus
              type="text"
              value={urlDraft}
              onChange={(event) => setUrlDraft(event.target.value)}
              onBlur={() => void commitUrl()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void commitUrl()
                }

                if (event.key === 'Escape') {
                  setIsEditingUrl(false)
                  setUrlDraft(item.url ?? '')
                }
              }}
              placeholder="https://github.com"
              className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 dark:border-blue-500/40 dark:bg-slate-800 dark:text-white"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setUrlDraft(item.url ?? '')
                setIsEditingUrl(true)
              }}
              className="truncate text-left text-sm text-slate-500 transition hover:text-blue-700 dark:text-slate-400 dark:hover:text-blue-200"
              title={item.url}
            >
              {domain || item.url}
            </button>
          )}

          <div>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${categoryClass}`}
            >
              {categoryLabel}
            </span>
          </div>

          {isEditingNotes ? (
            <textarea
              autoFocus
              rows={4}
              value={notesDraft}
              onChange={(event) => setNotesDraft(event.target.value)}
              onBlur={() => void commitNotes()}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setIsEditingNotes(false)
                  setNotesDraft(item.notes ?? '')
                }
              }}
              placeholder="Add any notes about this website..."
              className="resize-none rounded-2xl border border-gray-200 px-3 py-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
            />
          ) : item.notes ? (
            <div
              onContextMenu={openNotesContextMenu}
              className="cursor-text select-text overflow-hidden rounded-2xl border border-blue-200 bg-blue-50 px-3 py-3 text-left text-sm leading-6 text-slate-700 transition hover:border-blue-300 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-slate-200 dark:hover:border-blue-400/40"
              title={item.notes}
            >
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                Notes
              </span>
              <span className="line-clamp-4 block whitespace-pre-wrap break-words">
                {item.notes}
              </span>
            </div>
          ) : null}
        </div>

        {item.lastVisitedAt ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {`Last visited ${formatRelativeTime(item.lastVisitedAt)}`}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => void handleOpenWebsite()}
          className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          <Globe className="h-4 w-4" />
          Open website
          <ExternalLink className="h-4 w-4" />
        </button>
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

      <ConfirmDialog
        open={isConfirmOpen}
        title="Remove Shortcut"
        message={`Are you sure you want to remove ${item.name} from Launchpad?`}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </>
  )
}
