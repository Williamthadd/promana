import { useState, useEffect, useRef } from 'react'
import {
  Sparkles,
  Send,
  LoaderCircle,
  HelpCircle,
  AlertCircle,
  Clock,
  Calendar,
  Folder,
  StickyNote,
  ListTodo,
  ExternalLink,
} from 'lucide-react'
import ProjectCard from './ProjectCard'
import NoteCard from './NoteCard'
import TaskGroupCard from './TaskGroupCard'
import LaunchpadCard from './LaunchpadCard'

// Daily credits limit definition
const DAILY_LIMIT = 15

export default function AiWorkspace({
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
}) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('proman-ai-chat-history')
    return saved ? JSON.parse(saved) : []
  })
  const [creditsUsed, setCreditsUsed] = useState(0)
  const [isRestoring, setIsRestoring] = useState(false)
  const chatEndRef = useRef(null)

  // Initialize and check credits limit from localStorage
  useEffect(() => {
    const todayStr = new Date().toLocaleDateString()
    const stored = localStorage.getItem('proman-ai-credits')
    if (stored) {
      const { date, count } = JSON.parse(stored)
      if (date === todayStr) {
        setCreditsUsed(count)
        if (count >= DAILY_LIMIT) {
          setIsRestoring(true)
        }
      } else {
        localStorage.setItem('proman-ai-credits', JSON.stringify({ date: todayStr, count: 0 }))
        setCreditsUsed(0)
      }
    } else {
      localStorage.setItem('proman-ai-credits', JSON.stringify({ date: todayStr, count: 0 }))
      setCreditsUsed(0)
    }
  }, [])

  // Auto-scroll chat history
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Save chat history
  useEffect(() => {
    localStorage.setItem('proman-ai-chat-history', JSON.stringify(messages))
  }, [messages])

  // Clear chat history
  const clearChat = () => {
    setMessages([])
    localStorage.removeItem('proman-ai-chat-history')
  }

  // Handle credits increments
  const incrementCredits = () => {
    const todayStr = new Date().toLocaleDateString()
    const nextCount = creditsUsed + 1
    setCreditsUsed(nextCount)
    localStorage.setItem('proman-ai-credits', JSON.stringify({ date: todayStr, count: nextCount }))
    if (nextCount >= DAILY_LIMIT) {
      setIsRestoring(true)
    }
  }

  const handleSubmit = async (e, customPrompt = '') => {
    if (e) e.preventDefault()
    const activePrompt = customPrompt || prompt
    if (!activePrompt.trim()) return

    if (creditsUsed >= DAILY_LIMIT) {
      addToast('Daily free AI limits reached. Please wait for credit restoration.', 'info')
      setIsRestoring(true)
      return
    }

    setPrompt('')
    const userMessage = { id: Date.now().toString(), sender: 'user', text: activePrompt }
    setMessages(prev => [...prev, userMessage])
    setLoading(true)

    try {
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
            notes,
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
      incrementCredits()

      const aiMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: data.message,
        unrelated: data.unrelated,
        results: data.results || []
      }
      setMessages(prev => [...prev, aiMessage])
    } catch (err) {
      addToast(err.message, 'error')
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: `⚠️ Error: ${err.message || 'Unable to fetch response from Gemini.'}`,
          isError: true
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  // Quick prompt suggestions
  const suggestions = [
    { label: 'Summarize tasks today', prompt: 'What are my tasks for Today?' },
    { label: 'Search note', prompt: 'How many notes i save in my ProMana?' },
    { label: 'Find project', prompt: 'What is the recent project i just saved in muy pOomNna?' },
    { label: 'List shortcuts/links', prompt: 'which design tool launchpad or link shortcuts do I have saved?' }
  ]

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:h-[calc(100vh-210px)] min-h-[580px]">
      {/* Sidebar: AI Information and Credit Limits */}
      <aside className="flex flex-col gap-5 lg:w-80 shrink-0">
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">ProMana Assistant</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Powered by Gemini 2.5</p>
            </div>
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-600 dark:text-slate-300">
            Ask anything about your ProMana workspace! It searches, summarizes, and extracts live details about your Projects, Notes, Tasks, Launchpad, and Calendar automatically.
          </p>
        </section>

        {/* Credit Limits Dashboard Section */}
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex-1 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Daily API Credits</h3>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                {DAILY_LIMIT - creditsUsed}
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400">/ {DAILY_LIMIT} remaining</span>
            </div>

            {/* Progress Bar */}
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  creditsUsed >= DAILY_LIMIT
                    ? 'bg-rose-500'
                    : creditsUsed > DAILY_LIMIT * 0.7
                    ? 'bg-amber-500'
                    : 'bg-blue-600'
                }`}
                style={{ width: `${Math.min(100, (creditsUsed / DAILY_LIMIT) * 100)}%` }}
              />
            </div>

            {isRestoring ? (
              <div className="mt-4 flex gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                <Clock className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Credit is restoring...</strong> Please try again tomorrow. Your daily credits refresh in 24 hours.
                </span>
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                You have free access to the smart Gemini workspace assistant. Use responsibly!!
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={clearChat}
            className="mt-6 w-full rounded-xl border border-gray-200 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-gray-50 hover:text-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            Clear Conversation
          </button>
        </section>
      </aside>

      {/* Main Chat/Workspace Area */}
      <main className="flex-1 flex flex-col rounded-3xl border border-gray-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {/* Chat History Header */}
        <header className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">AI Interactive Shell</span>
          </div>
        </header>

        {/* Conversation Box */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center max-w-lg mx-auto py-10">
              <div className="flex h-16 w-16 items-center justify-center rounded-[2rem] bg-gradient-to-br from-blue-600 to-cyan-400 text-white shadow-lg shadow-blue-200 dark:shadow-none mb-6">
                <Sparkles className="h-8 w-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Ask your ProMana Assistant</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Type an organic query or pick one of the sample prompt cards below to immediately lookup projects, task status, notes, or summarize calendar intervals.
              </p>

              {/* Suggestions Cards Grid */}
              <div className="mt-8 grid gap-3 sm:grid-cols-2 w-full">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSubmit(null, s.prompt)}
                    className="flex flex-col text-left p-4 rounded-2xl border border-gray-100 hover:border-blue-300 hover:bg-blue-50/20 dark:border-slate-800 dark:hover:border-blue-500/30 dark:hover:bg-blue-500/5 transition group"
                  >
                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 group-hover:underline">
                      {s.label}
                    </span>
                    <span className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      "{s.prompt}"
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((m) => {
                const isUser = m.sender === 'user'
                return (
                  <div key={m.id} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    {!isUser && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
                        <Sparkles className="h-4 w-4" />
                      </div>
                    )}
                    <div className="max-w-[85%] space-y-4">
                      <div
                        className={`rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm break-words ${
                          isUser
                            ? 'bg-blue-600 text-white'
                            : m.isError
                            ? 'bg-rose-50 text-rose-800 border border-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20'
                            : m.unrelated
                            ? 'bg-amber-50 text-amber-800 border border-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20'
                            : 'bg-gray-50 text-slate-800 dark:bg-slate-800 dark:text-slate-100'
                        }`}
                      >
                        {m.text}
                      </div>

                      {/* Visual Results Cards Render Block */}
                      {!isUser && m.results && m.results.length > 0 && (
                        <div className="grid gap-4 mt-4 w-full">
                          {m.results.map((result, rIdx) => {
                            if (result.type === 'calendar_date') {
                              // Find matching entries
                              const matchedEntries = calendarEntries.filter(entry => 
                                result.matchedIds?.includes(entry.id) || entry.dateKey === result.date
                              )
                              return (
                                <div key={rIdx} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
                                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
                                    <Calendar className="h-4 w-4" />
                                    <span>Schedule: {result.date}</span>
                                  </div>
                                  {matchedEntries.length === 0 ? (
                                    <p className="text-xs text-slate-500 dark:text-slate-400">No scheduled tasks saved on this date.</p>
                                  ) : (
                                    <div className="space-y-2">
                                      {matchedEntries.map(entry => (
                                        <div key={entry.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800">
                                          <div className="flex flex-col gap-1">
                                            <span className="font-semibold text-slate-900 dark:text-white">{entry.title}</span>
                                            {entry.notes && <span className="text-[11px] text-slate-500 dark:text-slate-400">{entry.notes}</span>}
                                          </div>
                                          <span className="shrink-0 rounded-md bg-blue-100 px-2 py-1 text-[10px] font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                                            {entry.startTime || 'All day'}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )
                            }

                            if (result.type === 'project') {
                              const proj = projects.find(p => p.id === result.id)
                              if (!proj) return null
                              return (
                                <div key={rIdx} className="w-full max-w-md">
                                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
                                    <Folder className="h-3.5 w-3.5" />
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
                              const nt = notes.find(n => n.id === result.id)
                              if (!nt) return null
                              return (
                                <div key={rIdx} className="w-full max-w-md">
                                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
                                    <StickyNote className="h-3.5 w-3.5" />
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
                                <div key={rIdx} className="w-full max-w-md">
                                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
                                    <ListTodo className="h-3.5 w-3.5" />
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
                                <div key={rIdx} className="w-full max-w-md">
                                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-purple-600 dark:text-purple-400">
                                    <ExternalLink className="h-3.5 w-3.5" />
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
                  </div>
                )
              })}
            </div>
          )}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-gray-50 px-4 py-3 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <LoaderCircle className="h-4 w-4 animate-spin text-blue-600" />
                <span>Thinking... reading your ProMana database...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSubmit} className="border-t border-gray-100 p-4 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50">
          <div className="relative flex items-center">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={loading || isRestoring}
              placeholder={
                isRestoring
                  ? "AI limits reached... wait for restoration"
                  : "Ask about your projects, notes, task timeline or links..."
              }
              className="w-full rounded-2xl border border-gray-200 bg-white pl-5 pr-14 py-3.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-400 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
            />
            <button
              type="submit"
              disabled={loading || isRestoring || !prompt.trim()}
              className="absolute right-2 top-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:bg-gray-100 disabled:text-gray-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
