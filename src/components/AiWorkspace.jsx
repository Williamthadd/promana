import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Sparkles,
  Send,
  LoaderCircle,
  Clock,
  Calendar,
  Folder,
  StickyNote,
  ListTodo,
  ExternalLink,
  Trash2,
  Copy,
  Check,
  WifiOff,
} from 'lucide-react'
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'motion/react'
import ProjectCard from './ProjectCard'
import NoteCard from './NoteCard'
import TaskGroupCard from './TaskGroupCard'
import LaunchpadCard from './LaunchpadCard'
import useAiDailyUsage from '../hooks/useAiDailyUsage'
import { filterNotesForAi } from '../utils/aiWorkspaceData'

// Daily credits limit definition
const DAILY_LIMIT = 15
const LEGACY_CHAT_HISTORY_KEY = 'proman-ai-chat-history'

function getChatHistoryStorageKey(userId) {
  return userId ? `${LEGACY_CHAT_HISTORY_KEY}:${userId}` : null
}

function readChatHistory(storageKey) {
  if (!storageKey) {
    return []
  }

  try {
    const saved = localStorage.getItem(storageKey)
    const parsed = saved ? JSON.parse(saved) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// Code block copy button sub-component to handle state locally
function CodeBlockHeader({ language, code, addToast }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      addToast('Code snippet copied to clipboard!', 'success')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      addToast('Failed to copy code snippet.', 'error')
    }
  }

  return (
    <div className="flex items-center justify-between bg-[#1b1c19] px-4 py-2 border-b border-[#272822]/40 text-[10px] uppercase font-mono tracking-wider text-slate-400">
      <span className="flex items-center gap-1.5 font-bold">
        <span className="h-2 w-2 rounded-full bg-[#a6e22e]" />
        {language}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        className="flex items-center gap-1 hover:text-white transition-colors"
      >
        {copied ? (
          <>
            <Check className="h-3 w-3 text-[#a6e22e]" />
            <span className="text-[#a6e22e]">Copied</span>
          </>
        ) : (
          <>
            <Copy className="h-3 w-3" />
            <span>Copy</span>
          </>
        )}
      </button>
    </div>
  )
}

export default function AiWorkspace({
  userId,
  projects = [],
  launchpadItems = [],
  notes = [],
  taskGroups = [],
  calendarEntries = [],
  onDeleteProject,
  onEditProject,
  onDeleteNote,
  onEditNote,
  onToggleNotePin,
  onDeleteTaskGroup,
  onEditTaskGroup,
  onUpdateTaskGroupTasks,
  onDeleteLaunchpadItem,
  onUpdateLaunchpadItem,
  onToggleLaunchpadPin,
  addToast,
  cloudAvailable = true,
}) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const chatStorageKey = getChatHistoryStorageKey(userId)
  const [messagesByStorageKey, setMessagesByStorageKey] = useState(() =>
    chatStorageKey
      ? { [chatStorageKey]: readChatHistory(chatStorageKey) }
      : {},
  )
  const messages = useMemo(
    () =>
      chatStorageKey
        ? messagesByStorageKey[chatStorageKey] ??
          readChatHistory(chatStorageKey)
        : [],
    [chatStorageKey, messagesByStorageKey],
  )
  const aiVisibleNotes = useMemo(() => filterNotesForAi(notes), [notes])
  const setMessages = (updater) => {
    if (!chatStorageKey) {
      return
    }

    setMessagesByStorageKey((currentByKey) => {
      const currentMessages = Object.prototype.hasOwnProperty.call(
        currentByKey,
        chatStorageKey,
      )
        ? currentByKey[chatStorageKey]
        : readChatHistory(chatStorageKey)
      const nextMessages =
        typeof updater === 'function' ? updater(currentMessages) : updater

      return {
        ...currentByKey,
        [chatStorageKey]: nextMessages,
      }
    })
  }
  const {
    creditsUsed,
    loading: usageLoading,
    error: usageError,
    consumeCredit,
  } = useAiDailyUsage(userId, DAILY_LIMIT)
  const isRestoring = creditsUsed >= DAILY_LIMIT
  const remainingCredits = Math.max(0, DAILY_LIMIT - creditsUsed)
  const usageUnavailable = usageLoading || Boolean(usageError)
  const aiInteractionDisabled =
    !cloudAvailable || loading || usageUnavailable || isRestoring
  const chatEndRef = useRef(null)

  // Remove unscoped legacy values so one account cannot see another account's
  // locally stored chat after users switch in the same browser profile.
  useEffect(() => {
    localStorage.removeItem('proman-ai-credits')
    localStorage.removeItem(LEGACY_CHAT_HISTORY_KEY)
  }, [])

  // Auto-scroll chat history
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Save chat history
  useEffect(() => {
    if (!chatStorageKey) {
      return
    }

    try {
      localStorage.setItem(chatStorageKey, JSON.stringify(messages))
    } catch {
      // Chat history is a convenience cache; storage quota/privacy settings
      // must not interrupt the AI workspace.
    }
  }, [chatStorageKey, messages])

  // Clear chat history
  const clearChat = () => {
    setMessages([])
    if (chatStorageKey) {
      localStorage.removeItem(chatStorageKey)
    }
    addToast('Chat history cleared successfully.', 'info')
  }

  // Client-side security pre-filter patterns
  const blockedPatterns = [
    /ignore\s+(all\s+)?(previous|prior|above|system)\s+(instruction|prompt|rule)/i,
    /forget\s+(all\s+)?(previous|prior|above|your)\s+(instruction|prompt|rule)/i,
    /disregard\s+(all\s+)?(previous|prior|above|your)\s+(instruction|prompt|rule)/i,
    /override\s+(all\s+)?(previous|prior|your|system)\s+(instruction|prompt|rule)/i,
    /you\s+are\s+now\s+(a|an|the)\s+/i,
    /pretend\s+(you\s+are|to\s+be|you're)\s+/i,
    /act\s+as\s+(a|an|the|if)\s+/i,
    /enter\s+(developer|admin|debug|god|sudo|root)\s+mode/i,
    /what\s+(is|are)\s+your\s+(system|initial|original)\s+(prompt|instruction)/i,
    /show\s+(me\s+)?(your|the)\s+(system|initial|original)\s+(prompt|instruction)/i,
    /\bdelete\b.*\b(from|in)\s+(database|db|firestore|firebase)/i,
    /\bdrop\b.*\b(table|collection|database)/i,
    /other\s+(user|account|people)('?s)?\s+(data|project|note|task)/i,
    /all\s+users?\s+(data|project|note|task)/i,
    /\bapi[_\s]?key\b/i,
    /\bpassword\b/i,
    /\bcredential/i,
  ]

  const handleSubmit = async (e, customPrompt = '') => {
    if (e) e.preventDefault()
    const activePrompt = customPrompt || prompt
    if (!activePrompt.trim()) return

    if (!cloudAvailable) {
      addToast(
        'Ask AI needs an internet connection. Your cached workspace is still available offline.',
        'info',
      )
      return
    }

    // Client-side length limit
    if (activePrompt.length > 1000) {
      addToast('Prompt is too long. Please keep it under 1000 characters.', 'error')
      return
    }

    // Client-side injection pattern check
    const normalized = activePrompt
      .replace(/(?:\s|\u200B|\u200C|\u200D|\uFEFF)+/g, ' ')
      .trim()
    for (const pattern of blockedPatterns) {
      if (pattern.test(normalized)) {
        setPrompt('')
        const userMessage = { id: Date.now().toString(), sender: 'user', text: activePrompt }
        const blockedMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: '🛡️ This query was blocked by ProMana\'s security system. I can only help you search, filter, and summarize your own ProMana workspace data (projects, notes, tasks, launchpad shortcuts, and calendar entries).',
          unrelated: true
        }
        setMessages(prev => [...prev, userMessage, blockedMessage])
        return
      }
    }

    if (!userId) {
      addToast('You need to be signed in to use the AI assistant.', 'error')
      return
    }

    if (usageLoading) {
      addToast('Daily AI usage is still syncing. Please try again shortly.', 'info')
      return
    }

    if (usageError) {
      addToast('Unable to verify your daily AI usage right now.', 'error')
      return
    }

    if (creditsUsed >= DAILY_LIMIT) {
      addToast('Daily free AI limits reached. Please wait for credit restoration.', 'info')
      return
    }

    const userMessage = { id: Date.now().toString(), sender: 'user', text: activePrompt }
    let creditReserved = false
    setLoading(true)

    try {
      await consumeCredit()
      creditReserved = true
      setPrompt('')
      setMessages(prev => [...prev, userMessage])

      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: activePrompt,
          workspaceData: {
            projects,
            launchpadItems,
            notes: aiVisibleNotes,
            taskGroups,
            calendarEntries,
          }
        })
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.error || 'Server error occurred during request.')
      }

      const data = await response.json()

      const aiMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: data.message,
        unrelated: data.unrelated,
        results: data.results || []
      }
      setMessages(prev => [...prev, aiMessage])
    } catch (err) {
      if (err?.code === 'ai/offline') {
        addToast(err.message, 'info')
        return
      }

      if (err?.code === 'ai/daily-limit') {
        addToast(
          'Daily free AI limits reached. Please wait for credit restoration.',
          'info',
        )
        return
      }

      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Unable to fetch response from Gemini.'
      addToast(errorMessage, 'error')

      if (creditReserved) {
        setMessages(prev => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: 'ai',
            text: `⚠️ Error: ${errorMessage}`,
            isError: true
          }
        ])
      }
    } finally {
      setLoading(false)
    }
  }

  // Quick prompt suggestions
  const suggestions = [
    { label: 'Summarize tasks today', prompt: 'What are my tasks for Today?' },
    { label: 'Search note', prompt: 'How many notes i save in my ProMana?' },
    { label: 'Find project', prompt: 'What is the recent project i just saved in my ProMana?' },
    { label: 'List shortcuts/links', prompt: 'which design tool launchpad or link shortcuts do I have saved?' }
  ]

  // Beautiful monokai-style code text block highlighter
  const renderMessageText = (text) => {
    if (!text) return null

    // Split by ``` to extract block-level code blocks
    const parts = text.split(/(```[\s\S]*?```)/g)

    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const content = part.slice(3, -3).trim()
        const firstLineBreak = content.indexOf('\n')
        let language = 'code'
        let code = content

        if (firstLineBreak !== -1) {
          const potentialLang = content.slice(0, firstLineBreak).trim()
          if (potentialLang && potentialLang.length < 15) {
            language = potentialLang
            code = content.slice(firstLineBreak + 1)
          }
        }

        // Monokai-style colorizing helper
        const highlightedCode = code
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          // Highlight common keywords (pink)
          .replace(/\b(const|let|var|function|return|import|export|default|class|extends|if|else|for|while|try|catch)\b/g, '<span class="text-[#f92672] font-semibold">$1</span>')
          // Highlight string literals (yellowish green)
          .replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, '<span class="text-[#e6db74]">$1$&amp;$1</span>')
          // Highlight comments (grayish green)
          .replace(/(\/\/.*)/g, '<span class="text-[#75715e] italic">$1</span>')
          // Highlight custom objects/definitions (cyan)
          .replace(/\b(db|auth|user|projects|notes|taskGroups|calendarEntries|Timestamp)\b/g, '<span class="text-[#66d9ef]">$1</span>')

        return (
          <div key={index} className="my-4 overflow-hidden rounded-2xl border border-white/10 shadow-xl bg-[#272822] text-[#f8f8f2] font-mono text-xs">
            <CodeBlockHeader language={language} code={code} addToast={addToast} />
            <pre className="p-4 overflow-x-auto leading-relaxed">
              <code dangerouslySetInnerHTML={{ __html: highlightedCode }} />
            </pre>
          </div>
        )
      }

      // Inline backticks highlight
      const inlineParts = part.split(/(`[^`\n]+`)/g)
      return (
        <span key={index} className="whitespace-pre-wrap">
          {inlineParts.map((inlinePart, inlineIndex) => {
            if (inlinePart.startsWith('`') && inlinePart.endsWith('`')) {
              return (
                <code key={inlineIndex} className="mx-1 rounded-md bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 font-mono text-xs font-bold text-blue-600 dark:text-blue-300 border border-slate-200/40 dark:border-white/5">
                  {inlinePart.slice(1, -1)}
                </code>
              )
            }
            return inlinePart
          })}
        </span>
      )
    })
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:h-[calc(100vh-210px)] min-h-[580px]">
      {/* Sidebar: AI Information and Credit Limits */}
      <aside className="flex flex-col gap-5 lg:w-80 shrink-0">
        <section className="glass-panel-light dark:glass-panel-dark rounded-3xl p-6 border border-white/50 dark:border-white/10 shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 dark:from-blue-500/20 dark:to-cyan-500/5 border border-blue-500/20 text-blue-600 dark:text-blue-300 shadow-sm">
              <Sparkles className="h-5 w-5 animate-pulse text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">ProMana Assistant</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Powered by Gemini 3.5 Flash</p>
            </div>
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-600 dark:text-slate-300">
            Ask anything about your ProMana workspace! It searches, summarizes, and extracts live details about your Projects, Notes, Tasks, Launchpad, and Calendar automatically.
          </p>
          <p className="mt-4 text-xs leading-5 text-slate-600 dark:text-slate-300">
            This AI is <b>secured</b> by a daily API credit limit, firewall, and privacy controls.
          </p>
        </section>

        {/* Credit Limits Dashboard Section */}
        <section className="glass-panel-light dark:glass-panel-dark rounded-3xl p-6 border border-white/50 dark:border-white/10 shadow-md flex-1 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Daily API Credits</h3>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-black text-slate-900 dark:text-white">
                {usageLoading ? '—' : remainingCredits}
              </span>
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">/ {DAILY_LIMIT} remaining</span>
            </div>

            {/* Progress Bar */}
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  creditsUsed >= DAILY_LIMIT
                    ? 'bg-rose-500'
                    : creditsUsed > DAILY_LIMIT * 0.7
                    ? 'bg-amber-500'
                    : 'bg-blue-600'
                }`}
                style={{ width: `${usageLoading ? 0 : Math.min(100, (creditsUsed / DAILY_LIMIT) * 100)}%` }}
              />
            </div>

            {!cloudAvailable ? (
              <div
                className="mt-4 flex gap-2 rounded-2xl bg-amber-50 p-4 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200"
                role="status"
              >
                <WifiOff className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  <strong>AI is paused offline.</strong> Cached workspace data
                  remains available. Reconnect before sending a Gemini request.
                </span>
              </div>
            ) : usageError ? (
              <div className="mt-4 flex gap-2 rounded-2xl bg-rose-50 p-4 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                <Clock className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Credit sync unavailable.</strong> ProMana cannot verify your daily usage, so AI requests are temporarily paused.
                </span>
              </div>
            ) : usageLoading ? (
              <div className="mt-4 flex gap-2 rounded-2xl bg-blue-50 p-4 text-xs text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                <LoaderCircle className="h-4 w-4 shrink-0 mt-0.5 animate-spin" />
                <span>
                  <strong>Syncing daily credits...</strong> Checking your current usage in Firebase.
                </span>
              </div>
            ) : isRestoring ? (
              <div className="mt-4 flex gap-2 rounded-2xl bg-rose-50 p-4 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                <Clock className="h-4 w-4 shrink-0 mt-0.5 animate-pulse" />
                <span>
                  <strong>Credit is restoring...</strong> Please try again tomorrow. Your daily credits refresh in 24 hours.
                </span>
              </div>
            ) : (
              <p className="mt-3 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
                Usage is synced securely to your Firebase account across browsers and devices.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={clearChat}
            className="mt-6 inline-flex items-center justify-center gap-2 w-full rounded-2xl border border-slate-200/50 dark:border-white/5 py-3 text-xs font-bold text-slate-600 dark:text-slate-400 transition-all hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear Conversation
          </button>
        </section>
      </aside>

      {/* Main Chat/Workspace Area */}
      <main className="flex-1 flex flex-col rounded-3xl border border-white/50 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md shadow-xl overflow-hidden">
        {/* Chat History Header */}
        <header className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 px-6 py-4">
          <div
            className="flex items-center gap-2"
            role="status"
            aria-live="polite"
          >
            <span className="relative flex h-2.5 w-2.5">
              {cloudAvailable ? (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              ) : null}
              <span
                className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                  cloudAvailable ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              {cloudAvailable ? 'AI Interactive Shell' : 'AI Offline'}
            </span>
          </div>
        </header>

        {/* Conversation Box */}
        <div className="flex-1 p-6 overflow-y-auto space-y-8 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
          <AnimatePresence initial={false}>
            {messages.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="flex h-full flex-col items-center justify-center text-center max-w-xl mx-auto py-8"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-tr from-blue-600 to-blue-500 text-white shadow-xl shadow-blue-500/20 mb-6">
                  <Sparkles className="h-8 w-8" />
                </div>
                <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Workspace Shell</h2>
                <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Type an organic query or pick one of the sample prompt cards below to immediately lookup projects, task status, notes, or summarize calendar intervals.
                </p>

                {/* Suggestions Cards Grid */}
                <div className="mt-8 grid gap-4 sm:grid-cols-2 w-full">
                  {suggestions.map((s, idx) => (
                    <motion.button
                      key={idx}
                      type="button"
                      whileHover={
                        aiInteractionDisabled
                          ? undefined
                          : { scale: 1.025, y: -2 }
                      }
                      whileTap={aiInteractionDisabled ? undefined : { scale: 0.98 }}
                      onClick={() => handleSubmit(null, s.prompt)}
                      disabled={aiInteractionDisabled}
                      aria-describedby={
                        cloudAvailable ? undefined : 'ai-offline-help'
                      }
                      className="flex flex-col text-left p-5 rounded-2xl border border-slate-200/50 dark:border-white/5 bg-white/50 dark:bg-slate-950/20 hover:border-blue-500/30 dark:hover:border-blue-400/30 hover:bg-blue-50/10 dark:hover:bg-blue-500/5 transition duration-300 shadow-sm cursor-pointer group disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 group-hover:text-blue-500">
                        {s.label}
                      </span>
                      <span className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400 line-clamp-2 italic font-medium">
                        "{s.prompt}"
                      </span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <div className="space-y-8">
                {messages.map((m) => {
                  const isUser = m.sender === 'user'
                  return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isUser && (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-md shadow-blue-500/20">
                          <Sparkles className="h-4.5 w-4.5" />
                        </div>
                      )}
                      <div className="max-w-[85%] space-y-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${isUser ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>
                            {isUser ? 'You' : 'ProMana Assistant'}
                          </span>
                        </div>
                        <div
                          className={`text-sm leading-7 break-words ${
                            isUser
                              ? 'text-slate-800 dark:text-slate-100 font-medium bg-blue-500/5 dark:bg-blue-500/10 px-5 py-3.5 rounded-3xl rounded-tr-sm border border-blue-500/10'
                              : m.isError
                              ? 'bg-rose-500/5 text-rose-800 dark:bg-rose-500/10 dark:text-rose-300 px-5 py-3.5 rounded-3xl rounded-tl-sm border border-rose-500/15'
                              : m.unrelated
                              ? 'bg-amber-500/5 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300 px-5 py-3.5 rounded-3xl rounded-tl-sm border border-amber-500/15'
                              : 'text-slate-800 dark:text-slate-100'
                          }`}
                        >
                          {isUser ? m.text : renderMessageText(m.text)}
                        </div>

                        {/* Visual Results Cards Render Block */}
                        {!isUser && m.results && m.results.length > 0 && (
                          <div className="flex flex-col w-full mt-4">
                            {m.results.map((result, rIdx) => {
                              const separatorClass = rIdx > 0 ? 'pt-6 mt-4 border-t border-slate-200/50 dark:border-white/5' : ''

                              if (result.type === 'calendar_date') {
                                // Find matching entries
                                const matchedEntries = calendarEntries.filter(entry =>
                                  result.matchedIds?.includes(entry.id) || entry.dateKey === result.date
                                )
                                return (
                                  <div key={rIdx} className={separatorClass}>
                                    <div className="rounded-3xl border border-slate-200/50 dark:border-white/5 bg-white/40 dark:bg-slate-950/20 p-6 shadow-md space-y-4">
                                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
                                        <Calendar className="h-4 w-4" />
                                        <span>Schedule: {result.date}</span>
                                      </div>
                                      {matchedEntries.length === 0 ? (
                                        <p className="text-xs text-slate-400 dark:text-slate-500">No scheduled tasks saved on this date.</p>
                                      ) : (
                                        <div className="space-y-2">
                                          {matchedEntries.map(entry => (
                                            <div key={entry.id} className="flex items-center justify-between rounded-2xl bg-slate-100/50 p-4 text-xs dark:bg-slate-800/40 border border-slate-200/30 dark:border-white/5">
                                              <div className="flex flex-col gap-1">
                                                <span className="font-bold text-slate-900 dark:text-white">{entry.title}</span>
                                                {entry.notes && <span className="text-[11px] text-slate-400 dark:text-slate-500">{entry.notes}</span>}
                                              </div>
                                              <span className="shrink-0 rounded-lg bg-blue-100/60 px-2.5 py-1 text-[10px] font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                                                {entry.startTime || 'All day'}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )
                              }

                              if (result.type === 'project') {
                                const proj = projects.find(p => p.id === result.id)
                                if (!proj) return null
                                return (
                                  <div key={rIdx} className={`w-full max-w-md ${separatorClass}`}>
                                    <div className="mb-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
                                      <Folder className="h-4 w-4" />
                                      <span>Matched Project</span>
                                    </div>
                                    <ProjectCard
                                      project={proj}
                                      onDelete={onDeleteProject}
                                      onEdit={onEditProject}
                                    />
                                  </div>
                                )
                              }

                              if (result.type === 'note') {
                                const nt = aiVisibleNotes.find(n => n.id === result.id)
                                if (!nt) return null
                                return (
                                  <div key={rIdx} className={`w-full max-w-md ${separatorClass}`}>
                                    <div className="mb-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
                                      <StickyNote className="h-4 w-4" />
                                      <span>Matched Note / Code Snippet</span>
                                    </div>
                                    <NoteCard
                                      note={nt}
                                      onDelete={onDeleteNote}
                                      onEdit={onEditNote}
                                      onTogglePin={onToggleNotePin}
                                      addToast={addToast}
                                    />
                                  </div>
                                )
                              }

                              if (result.type === 'task_group') {
                                const tg = taskGroups.find(t => t.id === result.id)
                                if (!tg) return null
                                return (
                                  <div key={rIdx} className={`w-full max-w-md ${separatorClass}`}>
                                    <div className="mb-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
                                      <ListTodo className="h-4 w-4" />
                                      <span>Matched Tasks</span>
                                    </div>
                                    <TaskGroupCard
                                      taskGroup={tg}
                                      onEdit={onEditTaskGroup}
                                      onDelete={onDeleteTaskGroup}
                                      onUpdateTasks={onUpdateTaskGroupTasks}
                                    />
                                  </div>
                                )
                              }

                              if (result.type === 'launchpad') {
                                const lp = launchpadItems.find(l => l.id === result.id)
                                if (!lp) return null
                                return (
                                  <div key={rIdx} className={`w-full max-w-md ${separatorClass}`}>
                                    <div className="mb-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-purple-600 dark:text-purple-400">
                                      <ExternalLink className="h-4 w-4" />
                                      <span>Matched Launchpad Link</span>
                                    </div>
                                    <LaunchpadCard
                                      item={lp}
                                      onDelete={onDeleteLaunchpadItem}
                                      onUpdate={onUpdateLaunchpadItem}
                                      onTogglePin={onToggleLaunchpadPin}
                                      addToast={addToast}
                                    />
                                  </div>
                                )
                              }

                              return null
                            })}
                          </div>
                        )}
                      </div>
                      {isUser && (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-white/5 font-bold text-xs uppercase">
                          ME
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            )}
          </AnimatePresence>

          {loading && (
            <div className="flex gap-4 justify-start">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-md">
                <Sparkles className="h-4.5 w-4.5" />
              </div>
              <div className="flex items-center gap-2.5 rounded-3xl bg-slate-100/50 dark:bg-slate-800/40 border border-slate-200/30 dark:border-white/5 px-5 py-3.5 text-sm text-slate-500 dark:text-slate-400">
                <LoaderCircle className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                <span className="shimmer-text">Shell query active... inspecting local workspaces...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSubmit} className="border-t border-slate-100 dark:border-white/5 p-5 bg-white/40 dark:bg-slate-950/20">
          <div className="relative flex items-center max-w-4xl mx-auto">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={aiInteractionDisabled}
              aria-describedby={
                cloudAvailable ? undefined : 'ai-offline-help'
              }
              placeholder={
                !cloudAvailable
                  ? "Ask AI is unavailable offline"
                  : usageLoading
                  ? "Syncing daily AI usage..."
                  : usageError
                    ? "AI usage is temporarily unavailable"
                    : isRestoring
                      ? "AI limits reached... wait for credit reset"
                      : "Type standard query or search workspace components..."
              }
              className="w-full rounded-2xl border border-slate-200 bg-white/80 dark:bg-slate-950 dark:border-white/10 pl-6 pr-16 py-4 text-sm text-slate-900 placeholder:text-slate-400 focus:placeholder:text-slate-300 dark:text-white outline-none transition duration-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:text-slate-400 shadow-md"
            />
            <button
              type="submit"
              disabled={aiInteractionDisabled || !prompt.trim()}
              aria-label="Send message to ProMana Assistant"
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white transition duration-200 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600 cursor-pointer shadow-md shadow-blue-500/10 hover:scale-[1.03]"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          {!cloudAvailable ? (
            <p
              id="ai-offline-help"
              className="mx-auto mt-3 max-w-4xl text-xs text-amber-700 dark:text-amber-300"
              role="status"
            >
              Offline mode: you can still review cached workspace data and chat
              history, but Ask AI requires an internet connection.
            </p>
          ) : null}
        </form>
      </main>
    </div>
  )
}
