import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { sortCalendarEntries } from '../utils/calendar'

function normalizeIdList(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return Array.from(
    new Set(value.map((item) => String(item ?? '').trim()).filter(Boolean)),
  )
}

function normalizeCalendarEntry(documentSnapshot) {
  const data = documentSnapshot.data()

  return {
    id: documentSnapshot.id,
    ...data,
    title: String(data.title ?? ''),
    note: String(data.note ?? ''),
    dateKey: String(data.dateKey ?? ''),
    time: String(data.time ?? ''),
    reminderEnabled: Boolean(data.reminderEnabled),
    reminderTime: String(data.reminderTime ?? ''),
    projectIds: normalizeIdList(data.projectIds),
    launchpadItemIds: normalizeIdList(data.launchpadItemIds),
    taskGroupIds: normalizeIdList(data.taskGroupIds),
  }
}

export default function useCalendarEntries(uid) {
  const [state, setState] = useState(() => ({
    uid,
    entries: [],
    loading: Boolean(uid),
    error: null,
  }))

  useEffect(() => {
    if (!uid) {
      return undefined
    }

    const unsubscribe = onSnapshot(
      collection(db, 'users', uid, 'calendarEntries'),
      (snapshot) => {
        setState({
          uid,
          entries: sortCalendarEntries(
            snapshot.docs.map(normalizeCalendarEntry),
          ),
          loading: false,
          error: null,
        })
      },
      (nextError) => {
        setState({ uid, entries: [], loading: false, error: nextError })
      },
    )

    return unsubscribe
  }, [uid])

  if (!uid) {
    return { entries: [], loading: false, error: null }
  }

  const isCurrentUserState = state.uid === uid

  return {
    entries: isCurrentUserState ? state.entries : [],
    loading: isCurrentUserState ? state.loading : true,
    error: isCurrentUserState ? state.error : null,
  }
}
