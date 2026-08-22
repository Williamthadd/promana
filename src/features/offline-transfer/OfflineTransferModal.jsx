import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CheckCircle2,
  Clock3,
  LoaderCircle,
  QrCode,
  Radio,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
  Wifi,
  X,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { formatFileSize } from '../../constants/documentFiles'
import {
  cancelOfflineTransfer,
  createOfflineTransfer,
  getOfflineTransferStatus,
} from './offlineTransferClient'

const TERMINAL_STATUSES = new Set([
  'completed',
  'expired',
  'cancelled',
  'error',
])

const STATUS_CONTENT = {
  'network-choice': {
    label: 'Choose a local network',
    detail: 'Choose the Wi-Fi or hotspot shared with your phone.',
    tone: 'blue',
  },
  preparing: {
    label: 'Preparing local transfer…',
    detail: 'The image is being staged only on this computer.',
    tone: 'blue',
  },
  ready: {
    label: 'Ready for scan',
    detail: 'Scan the QR code with your phone camera.',
    tone: 'emerald',
  },
  connecting: {
    label: 'Phone connected',
    detail: 'The receiving device is starting the download.',
    tone: 'blue',
  },
  transferring: {
    label: 'Downloading to phone…',
    detail: 'Keep ProMana and this dialog open until it finishes.',
    tone: 'blue',
  },
  completed: {
    label: 'Download complete',
    detail: 'The one-time transfer is no longer available.',
    tone: 'emerald',
  },
  expired: {
    label: 'Transfer expired',
    detail: 'Close this dialog and create a new QR code.',
    tone: 'amber',
  },
  cancelled: {
    label: 'Transfer cancelled',
    detail: 'The image is no longer available on the local network.',
    tone: 'amber',
  },
  error: {
    label: 'Transfer unavailable',
    detail: 'Check the local service and network, then try again.',
    tone: 'red',
  },
}

const STATUS_TONES = {
  amber:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200',
  blue: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200',
  emerald:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200',
  red: 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200',
}

function formatRemainingTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0)
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = safeSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function OfflineTransferPanel({
  fileRecord,
  imageBlob,
  service,
  source,
  onClose,
  onNotice,
}) {
  const initialAddress = service.preferredAddress || service.networks[0]?.address
  const shouldStartImmediately = service.networks.length === 1
  const [selectedAddress, setSelectedAddress] = useState(initialAddress || '')
  const [session, setSession] = useState(null)
  const [localStatus, setLocalStatus] = useState(
    shouldStartImmediately ? 'preparing' : 'network-choice',
  )
  const [error, setError] = useState('')
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [isClosing, setIsClosing] = useState(false)
  const isStartingRef = useRef(false)
  const sessionRef = useRef(null)
  const isMountedRef = useRef(false)
  const isClosingRef = useRef(false)
  const filename =
    fileRecord.originalName || fileRecord.title || `promana-image.${fileRecord.extension || 'png'}`

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  useEffect(() => {
    isMountedRef.current = true
    isClosingRef.current = false

    return () => {
      isMountedRef.current = false
      isClosingRef.current = true
      const activeSession = sessionRef.current

      if (activeSession && !TERMINAL_STATUSES.has(activeSession.status)) {
        void cancelOfflineTransfer(activeSession.id, { keepalive: true }).catch(
          () => {},
        )
      }
    }
  }, [])

  const startTransfer = useCallback(async () => {
    if (isStartingRef.current || !selectedAddress) {
      return
    }

    isStartingRef.current = true
    setError('')
    setLocalStatus('preparing')

    try {
      const nextSession = await createOfflineTransfer({
        blob: imageBlob,
        filename,
        mimeType: imageBlob.type || fileRecord.mimeType,
        networkAddress: selectedAddress,
      })
      if (isClosingRef.current || !isMountedRef.current) {
        await cancelOfflineTransfer(nextSession.id).catch(() => {})
        return
      }

      sessionRef.current = nextSession
      setSession(nextSession)
      setLocalStatus(nextSession.status)
    } catch (transferError) {
      if (isMountedRef.current && !isClosingRef.current) {
        setError(
          transferError?.message || 'The local transfer could not be created.',
        )
        setLocalStatus('error')
      }
    } finally {
      isStartingRef.current = false
    }
  }, [fileRecord.mimeType, filename, imageBlob, selectedAddress])

  useEffect(() => {
    if (shouldStartImmediately) {
      void startTransfer()
    }
  }, [shouldStartImmediately, startTransfer])

  useEffect(() => {
    if (!session || TERMINAL_STATUSES.has(session.status)) {
      return undefined
    }

    let isCancelled = false
    let isPolling = false

    const pollStatus = async () => {
      if (isPolling) {
        return
      }

      isPolling = true

      try {
        const nextSession = await getOfflineTransferStatus(session.id)

        if (!isCancelled) {
          sessionRef.current = nextSession
          setSession(nextSession)
          setLocalStatus(nextSession.status)
          setError('')
        }
      } catch (statusError) {
        if (!isCancelled) {
          setError(
            statusError?.message ||
              'The local transfer service stopped responding. Keep both devices on the same network and check your firewall.',
          )
          setLocalStatus('error')
        }
      } finally {
        isPolling = false
      }
    }

    const intervalId = window.setInterval(() => void pollStatus(), 1_000)

    return () => {
      isCancelled = true
      window.clearInterval(intervalId)
    }
  }, [session])

  useEffect(() => {
    if (!session?.expiresAt || TERMINAL_STATUSES.has(session.status)) {
      return undefined
    }

    const updateCountdown = () => {
      setRemainingSeconds(
        Math.max(0, Math.ceil((session.expiresAt - Date.now()) / 1_000)),
      )
    }

    updateCountdown()
    const intervalId = window.setInterval(updateCountdown, 1_000)

    return () => window.clearInterval(intervalId)
  }, [session?.expiresAt, session?.status])

  useEffect(() => {
    const handlePageHide = () => {
      const activeSession = sessionRef.current

      if (activeSession && !TERMINAL_STATUSES.has(activeSession.status)) {
        void cancelOfflineTransfer(activeSession.id, { keepalive: true }).catch(
          () => {},
        )
      }
    }

    window.addEventListener('pagehide', handlePageHide)
    return () => window.removeEventListener('pagehide', handlePageHide)
  }, [])

  const handleClose = useCallback(async () => {
    if (isClosing) {
      return
    }

    isClosingRef.current = true
    setIsClosing(true)
    const activeSession = sessionRef.current

    if (activeSession && !TERMINAL_STATUSES.has(activeSession.status)) {
      try {
        await cancelOfflineTransfer(activeSession.id)
        sessionRef.current = { ...activeSession, status: 'cancelled' }
      } catch {
        onNotice?.(
          'The local service did not confirm cancellation. The transfer will still expire automatically.',
          'info',
        )
      }
    }

    onClose()
  }, [isClosing, onClose, onNotice])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        void handleClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleClose])

  const displayedStatus =
    session &&
    session.expiresAt <= Date.now() &&
    !TERMINAL_STATUSES.has(session.status)
      ? 'expired'
      : localStatus
  const statusContent = STATUS_CONTENT[displayedStatus] || STATUS_CONTENT.error
  const transferredBytes = session?.bytesTransferred || 0
  const transferPercent = useMemo(() => {
    if (displayedStatus === 'completed') {
      return 100
    }

    if (!session?.size || transferredBytes <= 0) {
      return 0
    }

    return Math.min(100, Math.round((transferredBytes / session.size) * 100))
  }, [displayedStatus, session?.size, transferredBytes])
  const selectedNetwork = service.networks.find(
    (network) => network.address === selectedAddress,
  )

  return (
    <div
      className="calendar-modal-backdrop fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/55 px-3 py-3 backdrop-blur-md sm:items-center sm:px-4 sm:py-6"
      onClick={() => void handleClose()}
    >
      <div
        className="calendar-modal-panel relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/40 p-5 shadow-2xl glass-panel-light dark:border-white/10 dark:glass-panel-dark sm:max-h-[calc(100dvh-3rem)] sm:p-7"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="offline-transfer-title"
      >
        <div className="flex shrink-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
              <QrCode className="h-4 w-4" />
              Offline QR Download
            </div>
            <h2
              id="offline-transfer-title"
              className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl"
            >
              Send this image to your phone
            </h2>
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">
              Scan over your local Wi-Fi or hotspot. The image is never
              uploaded to a cloud transfer service.
            </p>
          </div>

          <button
            type="button"
            disabled={isClosing}
            onClick={() => void handleClose()}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/40 text-slate-500 transition hover:bg-white/40 disabled:cursor-wait disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
            aria-label="Cancel offline transfer"
          >
            {isClosing ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </button>
        </div>

        <div className="mt-6 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-3 rounded-3xl border border-blue-200/70 bg-gradient-to-br from-blue-50 to-cyan-50 p-4 dark:border-blue-500/20 dark:from-blue-500/10 dark:to-cyan-500/5 sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-600 text-white">
                <Wifi className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-600 dark:text-blue-300">
                  Local network
                </p>
                <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">
                  Same Wi-Fi or hotspot
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-500 text-white">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-300">
                  Internet
                </p>
                <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">
                  Not required
                </p>
              </div>
            </div>
          </div>

          <p className="rounded-2xl border border-white/50 bg-white/60 px-4 py-3 text-xs font-semibold leading-5 text-slate-600 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-300">
            {source === 'cache'
              ? 'This image was loaded from this browser’s offline cache. Creating the QR and downloading to your phone use only the local network.'
              : 'The image was fetched from Google Drive for this first preparation and cached when browser storage allowed it. From this point, the QR transfer uses only the local network.'}
          </p>

          {!session && service.networks.length > 1 ? (
            <label className="grid gap-2 rounded-2xl border border-white/50 bg-white/60 p-4 dark:border-white/10 dark:bg-slate-950/40">
              <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                Network shared with your phone
              </span>
              <select
                value={selectedAddress}
                onChange={(event) => setSelectedAddress(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                {service.networks.map((network) => (
                  <option key={network.address} value={network.address}>
                    {network.name} — {network.address}
                  </option>
                ))}
              </select>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Avoid VPN or virtual-machine adapters unless your phone is on
                that network too.
              </span>
            </label>
          ) : null}

          {session?.localUrl && !['completed', 'expired', 'cancelled'].includes(displayedStatus) ? (
            <div className="grid place-items-center rounded-3xl border border-slate-200 bg-white p-4 shadow-inner dark:border-slate-700 sm:p-5">
              <QRCodeSVG
                value={session.localUrl}
                title="One-time local image download QR code"
                level="M"
                marginSize={4}
                size={320}
                bgColor="#ffffff"
                fgColor="#0f172a"
                className="aspect-square h-auto w-full max-w-[18rem]"
              />
            </div>
          ) : null}

          <div
            className={`rounded-2xl border p-4 ${STATUS_TONES[statusContent.tone]}`}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              {displayedStatus === 'completed' ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              ) : displayedStatus === 'error' || displayedStatus === 'expired' ? (
                <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              ) : displayedStatus === 'ready' ? (
                <Radio className="mt-0.5 h-5 w-5 shrink-0 animate-pulse" />
              ) : displayedStatus === 'network-choice' ? (
                <Wifi className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <LoaderCircle className="mt-0.5 h-5 w-5 shrink-0 animate-spin" />
              )}
              <div>
                <p className="text-sm font-black">{statusContent.label}</p>
                <p className="mt-1 text-xs font-semibold opacity-80">
                  {error || statusContent.detail}
                </p>
              </div>
            </div>
          </div>

          {session && (transferPercent > 0 || displayedStatus === 'transferring') ? (
            <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-950/50">
              <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-600 dark:text-slate-300">
                <span>
                  {formatFileSize(transferredBytes)} / {formatFileSize(session.size)}
                </span>
                {transferPercent > 0 ? <span>{transferPercent}%</span> : null}
              </div>
              {transferPercent > 0 ? (
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-[width] duration-300"
                    style={{ width: `${transferPercent}%` }}
                  />
                </div>
              ) : (
                <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Waiting for the service to report transferred bytes.
                </p>
              )}
            </div>
          ) : null}

          <div className="grid gap-3 rounded-2xl border border-white/50 bg-white/60 p-4 dark:border-white/10 dark:bg-slate-950/40 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-950 dark:text-white">
                {filename}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                {formatFileSize(imageBlob.size)}
                {selectedNetwork ? ` · ${selectedNetwork.address}` : ''}
              </p>
            </div>
            {session && !TERMINAL_STATUSES.has(displayedStatus) ? (
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600 dark:bg-white/5 dark:text-slate-300">
                <Clock3 className="h-3.5 w-3.5" />
                Expires in {formatRemainingTime(remainingSeconds)}
              </div>
            ) : null}
          </div>

          <div className="flex gap-3 rounded-2xl bg-slate-100/80 p-4 text-xs font-semibold leading-5 text-slate-600 dark:bg-white/5 dark:text-slate-300">
            <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-300" />
            <p>
              On Android, open Camera, scan the code, and open the detected
              address. If it cannot connect, confirm both devices use the same
              network and allow the ProMana service through your firewall.
            </p>
          </div>
        </div>

        <div className="mt-5 flex shrink-0 flex-wrap justify-end gap-3 border-t border-white/20 pt-4 dark:border-white/5">
          <button
            type="button"
            disabled={isClosing}
            onClick={() => void handleClose()}
            className="rounded-2xl border border-white/40 bg-white/80 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-white disabled:cursor-wait disabled:opacity-60 dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-200"
          >
            {isClosing
              ? 'Closing…'
              : displayedStatus === 'completed'
                ? 'Done'
                : 'Cancel'}
          </button>
          {!session ? (
            <button
              type="button"
              disabled={
                isStartingRef.current || !selectedAddress || isClosing
              }
              onClick={() => void startTransfer()}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/15 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
            >
              {localStatus === 'preparing' ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : error ? (
                <RefreshCw className="h-4 w-4" />
              ) : (
                <QrCode className="h-4 w-4" />
              )}
              {localStatus === 'preparing'
                ? 'Preparing…'
                : error
                  ? 'Try again'
                  : 'Create QR code'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function OfflineTransferModal({
  request,
  open,
  onClose,
  onNotice,
}) {
  if (!open || !request || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <OfflineTransferPanel
      key={request.fileRecord.id}
      fileRecord={request.fileRecord}
      imageBlob={request.imageBlob}
      service={request.service}
      source={request.source}
      onClose={onClose}
      onNotice={onNotice}
    />,
    document.body,
  )
}
