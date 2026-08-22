import {
  AlertTriangle,
  CloudCheck,
  CloudOff,
  CloudUpload,
  RefreshCw,
  X,
} from 'lucide-react'
import useConnectivity, { CONNECTIVITY_STATUS } from './useConnectivity'
import { useFirestoreSyncStatus } from './firestoreSyncStore'
import useOfflineStorageStatus from './useOfflineStorageStatus'

const STATUS_CONTENT = {
  [CONNECTIVITY_STATUS.ONLINE]: {
    title: 'Online',
    message: 'ProMana can reach its web service.',
    Icon: CloudCheck,
    containerClass:
      'border-emerald-200/80 bg-emerald-50/90 text-emerald-950 dark:border-emerald-800/70 dark:bg-emerald-950/80 dark:text-emerald-100',
    iconClass: 'text-emerald-600 dark:text-emerald-300',
  },
  [CONNECTIVITY_STATUS.OFFLINE]: {
    title: 'Offline mode',
    message:
      'Only data previously loaded on this device is shown. Cloud features will resume when your connection returns.',
    Icon: CloudOff,
    containerClass:
      'border-amber-200/90 bg-amber-50/95 text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/85 dark:text-amber-100',
    iconClass: 'text-amber-600 dark:text-amber-300',
  },
  [CONNECTIVITY_STATUS.RECONNECTING]: {
    title: 'Checking connection',
    message: 'ProMana is checking whether its web service is reachable.',
    Icon: RefreshCw,
    containerClass:
      'border-blue-200/90 bg-blue-50/95 text-blue-950 dark:border-blue-800/70 dark:bg-blue-950/85 dark:text-blue-100',
    iconClass: 'animate-spin text-blue-600 dark:text-blue-300',
  },
}

export default function OfflineStatusBanner({
  className = '',
  showOnline = false,
}) {
  const connectivity = useConnectivity()
  const firestoreSync = useFirestoreSyncStatus()
  const offlineStorage = useOfflineStorageStatus()
  const storageUnavailable =
    !offlineStorage.isChecking && !offlineStorage.isAvailable

  const isQuietlyOnline =
    connectivity.status === CONNECTIVITY_STATUS.ONLINE &&
    !firestoreSync.hasPendingWrites &&
    !firestoreSync.hasSyncError &&
    !firestoreSync.usingCachedData &&
    offlineStorage.isAvailable

  if (isQuietlyOnline && !showOnline) {
    return null
  }

  let content = STATUS_CONTENT[connectivity.status]

  if (storageUnavailable) {
    content = {
      title: 'Offline storage unavailable',
      message:
        'This browser blocked durable local storage. The current tab can work online, but an offline reload is not guaranteed.',
      Icon: AlertTriangle,
      containerClass:
        'border-rose-200/90 bg-rose-50/95 text-rose-950 dark:border-rose-800/70 dark:bg-rose-950/85 dark:text-rose-100',
      iconClass: 'text-rose-600 dark:text-rose-300',
    }
  } else if (firestoreSync.hasSyncError) {
    content = {
      title: 'Sync needs attention',
      message: `ProMana could not sync your ${firestoreSync.syncError.description}. Your cached data remains available.`,
      Icon: AlertTriangle,
      containerClass:
        'border-rose-200/90 bg-rose-50/95 text-rose-950 dark:border-rose-800/70 dark:bg-rose-950/85 dark:text-rose-100',
      iconClass: 'text-rose-600 dark:text-rose-300',
    }
  } else if (
    connectivity.status === CONNECTIVITY_STATUS.ONLINE &&
    firestoreSync.hasPendingWrites
  ) {
    content = {
      title: 'Syncing',
      message: 'Changes are waiting for Firebase confirmation.',
      Icon: CloudUpload,
      containerClass:
        'border-blue-200/90 bg-blue-50/95 text-blue-950 dark:border-blue-800/70 dark:bg-blue-950/85 dark:text-blue-100',
      iconClass: 'animate-pulse text-blue-600 dark:text-blue-300',
    }
  } else if (
    connectivity.status === CONNECTIVITY_STATUS.OFFLINE &&
    firestoreSync.hasPendingWrites
  ) {
    content = {
      ...content,
      message:
        'Showing previously loaded data. Your local changes are waiting to sync.',
    }
  } else if (
    connectivity.status === CONNECTIVITY_STATUS.OFFLINE &&
    firestoreSync.missingCachedData
  ) {
    content = {
      ...content,
      message:
        'No confirmed offline copy exists for one or more empty workspaces. Other previously loaded data is still available.',
    }
  } else if (
    connectivity.status === CONNECTIVITY_STATUS.ONLINE &&
    firestoreSync.usingCachedData
  ) {
    content = {
      title: 'Using cached data',
      message:
        firestoreSync.missingCachedData
          ? 'The web service is reachable, but one or more workspaces have no confirmed cached copy yet. Waiting for Firebase.'
          : 'The web service is reachable, but Firebase has not confirmed the latest data yet. Drive and Ask AI are paused.',
      Icon: RefreshCw,
      containerClass:
        'border-blue-200/90 bg-blue-50/95 text-blue-950 dark:border-blue-800/70 dark:bg-blue-950/85 dark:text-blue-100',
      iconClass: 'animate-spin text-blue-600 dark:text-blue-300',
    }
  }

  const Icon = content.Icon

  return (
    <div
      className={`rounded-2xl border px-3 py-2 shadow-sm backdrop-blur sm:px-4 ${content.containerClass} ${className}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex items-center gap-3">
        <Icon
          className={`h-4 w-4 shrink-0 ${content.iconClass}`}
          aria-hidden="true"
        />
        <p className="min-w-0 flex-1 text-xs sm:text-sm">
          <span className="font-semibold">{content.title}.</span>{' '}
          <span>{content.message}</span>
        </p>

        {!storageUnavailable && firestoreSync.hasSyncError ? (
          <button
            type="button"
            onClick={firestoreSync.dismissError}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:hover:bg-white/10"
            aria-label="Dismiss synchronization error"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : !storageUnavailable &&
          connectivity.status === CONNECTIVITY_STATUS.OFFLINE ? (
          <button
            type="button"
            onClick={connectivity.retry}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-current/20 px-2.5 py-1.5 text-xs font-semibold transition hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:hover:bg-white/10"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </button>
        ) : null}
      </div>
    </div>
  )
}
