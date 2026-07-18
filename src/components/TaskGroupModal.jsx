import { useState } from "react"
import { createPortal } from "react-dom"
import {
  ArrowDown,
  ArrowUp,
  Check,
  GripVertical,
  ListPlus,
  LoaderCircle,
  Plus,
  Tags,
  Trash2,
  X,
} from "lucide-react"
import { TASK_STATUS_OPTIONS } from "../constants/taskStatuses"
import {
  createTaskItem,
  moveTaskItem,
  normalizeTaskItems,
  reorderTaskItems,
  setTaskCompletion,
  setTaskStatus,
} from "../utils/taskUtils"

function parseTags(value) {
  return Array.from(
    new Set(
      String(value ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  )
}

function getDefaultDraft(taskGroup) {
  const tasks = normalizeTaskItems(taskGroup?.tasks)

  return {
    title: taskGroup?.title ?? "",
    note: taskGroup?.note ?? "",
    tagsText: (taskGroup?.tags ?? []).join(", "),
    tasks: tasks.length > 0 ? tasks : [createTaskItem("", 0)],
  }
}

function TaskGroupModalForm({ taskGroup, onClose, onSubmit, isSaving }) {
  const [draft, setDraft] = useState(() => getDefaultDraft(taskGroup))
  const [formError, setFormError] = useState("")
  const [draggedTaskId, setDraggedTaskId] = useState(null)
  const [dragOverTaskId, setDragOverTaskId] = useState(null)
  const isEditing = Boolean(taskGroup?.id)

  function updateTaskText(taskId, text) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      tasks: currentDraft.tasks.map((task) =>
        task.id === taskId ? { ...task, text } : task,
      ),
    }))
  }

  // Completes a task item
  function updateTaskCompletion(taskId, isCompleted) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      tasks: setTaskCompletion(currentDraft.tasks, taskId, isCompleted),
    }))
  }

  function updateTaskStatus(taskId, status) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      tasks: setTaskStatus(currentDraft.tasks, taskId, status),
    }))
  }

  function addTask() {
    setDraft((currentDraft) => ({
      ...currentDraft,
      tasks: [
        ...currentDraft.tasks,
        createTaskItem("", currentDraft.tasks.length),
      ],
    }))
  }

  // Removes a task item
  function removeTask(taskId) {
    setDraft((currentDraft) => {
      const nextTasks = currentDraft.tasks.filter((task) => task.id !== taskId)

      return {
        ...currentDraft,
        tasks: nextTasks.length > 0 ? nextTasks : [createTaskItem("", 0)],
      }
    })
  }

  function moveTask(taskId, offset) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      tasks: moveTaskItem(currentDraft.tasks, taskId, offset),
    }))
  }

  function reorderTask(sourceTaskId, targetTaskId) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      tasks: reorderTaskItems(
        currentDraft.tasks,
        sourceTaskId,
        targetTaskId,
      ),
    }))
  }

  function handleTaskDragStart(event, taskId) {
    setDraggedTaskId(taskId)
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", taskId)
  }

  function handleTaskDrop(event, targetTaskId) {
    event.preventDefault()
    const sourceTaskId =
      event.dataTransfer.getData("text/plain") || draggedTaskId

    if (sourceTaskId) {
      reorderTask(sourceTaskId, targetTaskId)
    }

    setDraggedTaskId(null)
    setDragOverTaskId(null)
  }

  function finishTaskDrag() {
    setDraggedTaskId(null)
    setDragOverTaskId(null)
  }

  function handleSubmit(event) {
    event.preventDefault()
    const title = draft.title.trim()
    const tasks = normalizeTaskItems(draft.tasks).filter((task) =>
      task.text.trim(),
    )

    if (!title) {
      setFormError("Add a title for this task group.")
      return
    }

    if (tasks.length === 0) {
      setFormError("Add at least one to-do point before saving.")
      return
    }

    setFormError("")
    void onSubmit?.({
      title,
      note: draft.note.trim(),
      tags: parseTags(draft.tagsText),
      tasks: tasks.map((task) => ({ ...task, text: task.text.trim() })),
    })
  }

  return (
    <div
      className="calendar-modal-backdrop fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 px-3 py-3 backdrop-blur-md sm:items-center sm:px-4 sm:py-6"
      onClick={isSaving ? undefined : onClose}
    >
      <div
        className="calendar-modal-panel relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/40 dark:border-white/10 glass-panel-light dark:glass-panel-dark p-5 shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:p-7"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
              Tasks workspace
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
              {isEditing ? "Edit task group" : "Create a task group"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed font-medium text-slate-600 dark:text-slate-300">
              Keep related work together, track every point, and update its
              progress as you go.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/40 text-slate-500 transition hover:bg-white/40 disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5 cursor-pointer"
            aria-label="Close task group modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          className="mt-6 flex min-h-0 flex-1 flex-col"
          onSubmit={handleSubmit}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Group title
                </span>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(event) =>
                    setDraft((currentDraft) => ({
                      ...currentDraft,
                      title: event.target.value,
                    }))
                  }
                  placeholder="For example, Release checklist"
                  autoFocus
                  className="rounded-2xl border border-white/40 bg-white/80 px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-slate-950/80 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Tags
                </span>
                <div className="relative">
                  <Tags className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={draft.tagsText}
                    onChange={(event) =>
                      setDraft((currentDraft) => ({
                        ...currentDraft,
                        tagsText: event.target.value,
                      }))
                    }
                    placeholder="release, backend, urgent"
                    className="w-full rounded-2xl border border-white/40 bg-white/80 py-3 pl-11 pr-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-slate-950/80 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                  />
                </div>
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Group note
              </span>
              <textarea
                value={draft.note}
                onChange={(event) =>
                  setDraft((currentDraft) => ({
                    ...currentDraft,
                    note: event.target.value,
                  }))
                }
                placeholder="Add context, dependencies, or a useful reminder for this group..."
                rows={3}
                className="min-h-24 resize-y rounded-2xl border border-white/40 bg-white/80 px-4 py-3 text-sm leading-relaxed text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-slate-950/80 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
              />
            </label>

            <section className="rounded-3xl border border-white/40 bg-white/30 p-4 dark:border-white/10 dark:bg-slate-950/30 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">
                    <ListPlus className="h-4 w-4" />
                    To-do points
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                    The first point starts in progress; later points start not
                    started. Drag points or use the arrows to reprioritize them.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addTask}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/40 bg-white/80 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-white dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-200 dark:hover:bg-slate-950 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  Add point
                </button>
              </div>

              <div className="mt-4 grid gap-3">
                {draft.tasks.map((task, index) => (
                  <div
                    key={task.id}
                    onDragEnter={() => setDragOverTaskId(task.id)}
                    onDragOver={(event) => {
                      event.preventDefault()
                      event.dataTransfer.dropEffect = "move"
                    }}
                    onDrop={(event) => handleTaskDrop(event, task.id)}
                    className={`grid gap-3 rounded-2xl border bg-white/60 p-3 shadow-sm transition dark:bg-slate-950/60 sm:grid-cols-[auto_minmax(0,1fr)_10rem_auto] sm:items-center ${
                      dragOverTaskId === task.id && draggedTaskId !== task.id
                        ? "border-blue-400 ring-4 ring-blue-500/10 dark:border-blue-500 dark:ring-blue-500/20"
                        : "border-white/40 dark:border-white/10"
                    } ${draggedTaskId === task.id ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-center gap-1">
                      <span
                        draggable
                        role="button"
                        tabIndex={0}
                        onDragStart={(event) =>
                          handleTaskDragStart(event, task.id)
                        }
                        onDragEnd={finishTaskDrag}
                        onKeyDown={(event) => {
                          if (event.key === "ArrowUp") {
                            event.preventDefault()
                            moveTask(task.id, -1)
                          } else if (event.key === "ArrowDown") {
                            event.preventDefault()
                            moveTask(task.id, 1)
                          }
                        }}
                        className="inline-flex h-8 w-7 cursor-grab items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/40 hover:text-blue-600 active:cursor-grabbing dark:hover:bg-slate-800/40 dark:hover:text-blue-300"
                        aria-label={`Drag to reorder point ${index + 1}. Use arrow keys to move it.`}
                        title="Drag to reorder"
                      >
                        <GripVertical className="h-4 w-4" />
                      </span>
                      <button
                        type="button"
                        onClick={() => moveTask(task.id, -1)}
                        disabled={index === 0}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/40 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-25 dark:hover:bg-slate-800/40 dark:hover:text-blue-300"
                        aria-label={`Move point ${index + 1} up`}
                        title="Move up"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveTask(task.id, 1)}
                        disabled={index === draft.tasks.length - 1}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/40 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-25 dark:hover:bg-slate-800/40 dark:hover:text-blue-300"
                        aria-label={`Move point ${index + 1} down`}
                        title="Move down"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateTaskCompletion(task.id, !task.isCompleted)
                        }
                        className={`ml-1 inline-flex h-7 w-7 items-center justify-center rounded-lg border transition cursor-pointer ${
                          task.isCompleted
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-slate-300 bg-white/80 text-transparent hover:border-blue-400 dark:border-slate-600 dark:bg-slate-950"
                        }`}
                        aria-label={`${task.isCompleted ? "Mark incomplete" : "Mark complete"}: ${task.text || `point ${index + 1}`}`}
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    </div>

                    <input
                      type="text"
                      value={task.text}
                      onChange={(event) =>
                        updateTaskText(task.id, event.target.value)
                      }
                      placeholder={`To-do point ${index + 1}`}
                      className={`min-w-0 rounded-xl border border-white/40 bg-white/80 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-slate-950/80 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400/20 ${
                        task.isCompleted
                          ? "text-slate-400 line-through dark:text-slate-500"
                          : "text-slate-950"
                      }`}
                    />

                    <select
                      value={task.status}
                      onChange={(event) =>
                        updateTaskStatus(task.id, event.target.value)
                      }
                      className="rounded-xl border border-white/40 bg-white/80 px-3 py-2.5 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-200 dark:focus:border-blue-400 dark:focus:ring-blue-400/20 cursor-pointer"
                      aria-label={`Status for point ${index + 1}`}
                    >
                      {TASK_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => removeTask(task.id)}
                      className="inline-flex h-10 w-10 items-center justify-center justify-self-end rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-300 cursor-pointer"
                      aria-label={`Remove point ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {formError ? (
              <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-950/50 dark:text-red-200">
                {formError}
              </p>
            ) : null}
          </div>

          <div className="mt-6 flex shrink-0 flex-wrap justify-end gap-3 border-t border-white/20 pt-4 dark:border-white/5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-2xl border border-white/40 px-4 py-3 text-sm font-bold text-slate-700 bg-white/80 transition hover:bg-white dark:border-white/10 dark:text-slate-200 dark:bg-slate-950/80 dark:hover:bg-slate-950 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/15 transition-all hover:brightness-110 hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-80 cursor-pointer"
            >
              {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {isSaving
                ? "Saving task group..."
                : isEditing
                  ? "Save task group"
                  : "Create task group"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function TaskGroupModal({
  open,
  taskGroup,
  onClose,
  onSubmit,
  isSaving = false,
}) {
  if (!open || typeof document === "undefined") {
    return null
  }

  return createPortal(
    <TaskGroupModalForm
      key={taskGroup?.id ?? "new-task-group"}
      taskGroup={taskGroup}
      onClose={onClose}
      onSubmit={onSubmit}
      isSaving={isSaving}
    />,
    document.body,
  )
}
