import {
  getDefaultTaskStatus,
  normalizeTaskStatus,
} from "../constants/taskStatuses"

export function createTaskId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `task-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function createTaskItem(text = "", index = 0) {
  const status = getDefaultTaskStatus(index)

  return {
    id: createTaskId(),
    text,
    status,
    isCompleted: false,
    previousStatus: status,
  }
}

export function normalizeTaskItem(task, index = 0) {
  const fallbackStatus = getDefaultTaskStatus(index)
  const isCompleted = Boolean(task?.isCompleted) || task?.status === "done"
  const status = isCompleted
    ? "done"
    : normalizeTaskStatus(task?.status, fallbackStatus)
  const previousStatus = normalizeTaskStatus(
    task?.previousStatus,
    status === "done" ? fallbackStatus : status,
  )

  return {
    id: String(task?.id || createTaskId()),
    text: String(task?.text ?? ""),
    status,
    isCompleted: status === "done",
    previousStatus: previousStatus === "done" ? fallbackStatus : previousStatus,
  }
}

export function normalizeTaskItems(tasks) {
  if (!Array.isArray(tasks)) {
    return []
  }

  return tasks.map(normalizeTaskItem)
}

export function setTaskCompletion(tasks, taskId, isCompleted) {
  return normalizeTaskItems(tasks).map((task, index) => {
    if (task.id !== taskId) {
      return task
    }

    if (isCompleted) {
      return {
        ...task,
        isCompleted: true,
        previousStatus:
          task.status === "done" ? task.previousStatus : task.status,
        status: "done",
      }
    }

    const fallbackStatus = getDefaultTaskStatus(index)
    const restoredStatus = normalizeTaskStatus(
      task.previousStatus,
      fallbackStatus,
    )

    return {
      ...task,
      isCompleted: false,
      status: restoredStatus === "done" ? fallbackStatus : restoredStatus,
    }
  })
}

export function setTaskStatus(tasks, taskId, nextStatus) {
  const normalizedStatus = normalizeTaskStatus(nextStatus)

  return normalizeTaskItems(tasks).map((task) => {
    if (task.id !== taskId) {
      return task
    }

    if (normalizedStatus === "done") {
      return {
        ...task,
        isCompleted: true,
        previousStatus:
          task.status === "done" ? task.previousStatus : task.status,
        status: "done",
      }
    }

    return {
      ...task,
      isCompleted: false,
      previousStatus: normalizedStatus,
      status: normalizedStatus,
    }
  })
}
