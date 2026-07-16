import { useEffect, useState } from "react"
import { doc, onSnapshot } from "firebase/firestore"
import { DEFAULT_USER_LIMITS } from "../constants/userLimits"
import { db } from "../firebase"

function toPositiveInteger(value) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null
  }

  return Math.floor(numericValue)
}

function normalizePlan(value) {
  const normalizedValue = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "")

  if (normalizedValue === "pro" || normalizedValue === "proplan") {
    return "pro"
  }

  if (normalizedValue === "free" || normalizedValue === "freeplan") {
    return "free"
  }

  return null
}

function normalizeLimits(data) {
  const maxProjects =
    toPositiveInteger(data?.maxProjects) ?? DEFAULT_USER_LIMITS.maxProjects
  const maxWebsites =
    toPositiveInteger(data?.maxWebsites) ?? DEFAULT_USER_LIMITS.maxWebsites
  const maxNotes =
    toPositiveInteger(data?.maxNotes) ?? DEFAULT_USER_LIMITS.maxNotes
  const maxTasks =
    toPositiveInteger(data?.maxTasks) ?? DEFAULT_USER_LIMITS.maxTasks
  const maxSchedules =
    toPositiveInteger(data?.maxSchedules) ?? DEFAULT_USER_LIMITS.maxSchedules
  const explicitPlan =
    typeof data?.isPro === "boolean"
      ? data.isPro
        ? "pro"
        : "free"
      : normalizePlan(
          data?.plan ?? data?.planType ?? data?.accountPlan ?? data?.tier,
        )
  const inferredPlan =
    maxProjects > DEFAULT_USER_LIMITS.maxProjects ||
    maxWebsites > DEFAULT_USER_LIMITS.maxWebsites ||
    maxNotes > DEFAULT_USER_LIMITS.maxNotes ||
    maxTasks > DEFAULT_USER_LIMITS.maxTasks ||
    maxSchedules > DEFAULT_USER_LIMITS.maxSchedules
      ? "pro"
      : "free"

  return {
    plan: explicitPlan ?? inferredPlan,
    maxProjects,
    maxWebsites,
    maxNotes,
    maxTasks,
    maxSchedules,
  }
}

export default function useUserLimits(user) {
  const uid = user?.uid ?? null
  const [state, setState] = useState(() => ({
    uid,
    limits: DEFAULT_USER_LIMITS,
    loading: Boolean(uid),
    error: null,
  }))

  useEffect(() => {
    if (!uid) {
      return undefined
    }

    const limitsRef = doc(db, "users", uid, "settings", "limits")

    const unsubscribe = onSnapshot(
      limitsRef,
      (snapshot) => {
        const nextLimits = normalizeLimits(snapshot.data())

        setState({
          uid,
          limits: nextLimits,
          loading: false,
          error: null,
        })
      },
      (nextError) => {
        setState({
          uid,
          limits: DEFAULT_USER_LIMITS,
          loading: false,
          error: nextError,
        })
      },
    )

    return unsubscribe
  }, [uid])

  if (!uid) {
    return { limits: DEFAULT_USER_LIMITS, loading: false, error: null }
  }

  const isCurrentUserState = state.uid === uid

  return {
    limits: isCurrentUserState ? state.limits : DEFAULT_USER_LIMITS,
    loading: isCurrentUserState ? state.loading : true,
    error: isCurrentUserState ? state.error : null,
  }
}
