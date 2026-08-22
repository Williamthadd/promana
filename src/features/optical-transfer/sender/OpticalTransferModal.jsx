import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  LoaderCircle,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  QrCode,
  Radio,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
  X,
} from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { formatFileSize } from '../../../constants/documentFiles'
import {
  OPTICAL_TRANSFER_CONFIG,
  createLoopingFrameSchedule,
  prepareOpticalTransfer,
} from '../protocol/index.js'

const LARGE_TRANSFER_SECONDS = 120

function formatDuration(seconds) {
  const roundedSeconds = Math.max(1, Math.ceil(Number(seconds) || 0))
  const minutes = Math.floor(roundedSeconds / 60)
  const remainder = roundedSeconds % 60

  return minutes
    ? `${minutes} min ${String(remainder).padStart(2, '0')} sec`
    : `${remainder} sec`
}

function getFilename(fileRecord) {
  return (
    fileRecord?.originalName ||
    fileRecord?.title ||
    `promana-image.${fileRecord?.extension || 'png'}`
  )
}

function OpticalTransferPanel({ request, onClose, onNotice }) {
  const panelRef = useRef(null)
  const wakeLockRef = useRef(null)
  const mountedRef = useRef(true)
  const wantsWakeLockRef = useRef(false)
  const [preparation, setPreparation] = useState({
    status: 'preparing',
    transfer: null,
    schedule: null,
    error: '',
  })
  const [isBroadcasting, setIsBroadcasting] = useState(false)
  const [frameNumber, setFrameNumber] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [wakeLockActive, setWakeLockActive] = useState(false)
  const filename = getFilename(request.fileRecord)
  const mimeType = request.imageBlob.type || request.fileRecord?.mimeType

  useEffect(
    () => () => {
      mountedRef.current = false
      wantsWakeLockRef.current = false
    },
    [],
  )

  useEffect(() => {
    let cancelled = false

    void prepareOpticalTransfer({
      blob: request.imageBlob,
      filename,
      mimeType,
    })
      .then((transfer) => {
        if (cancelled) return
        setPreparation({
          status: 'ready',
          transfer,
          schedule: createLoopingFrameSchedule(transfer),
          error: '',
        })
      })
      .catch((error) => {
        if (cancelled) return
        setPreparation({
          status: 'error',
          transfer: null,
          schedule: null,
          error: error?.message || 'This image could not be prepared.',
        })
      })

    return () => {
      cancelled = true
    }
  }, [filename, mimeType, request.imageBlob])

  const releaseWakeLock = useCallback(async () => {
    const sentinel = wakeLockRef.current
    wakeLockRef.current = null
    if (mountedRef.current) setWakeLockActive(false)
    if (sentinel && !sentinel.released) {
      await sentinel.release().catch(() => {})
    }
  }, [])

  const acquireWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') {
      return
    }

    try {
      await releaseWakeLock()
      const sentinel = await navigator.wakeLock.request('screen')
      if (!mountedRef.current || !wantsWakeLockRef.current) {
        await sentinel.release().catch(() => {})
        return
      }
      wakeLockRef.current = sentinel
      setWakeLockActive(true)
      sentinel.addEventListener(
        'release',
        () => {
          if (wakeLockRef.current === sentinel) {
            wakeLockRef.current = null
            if (mountedRef.current) setWakeLockActive(false)
          }
        },
        { once: true },
      )
    } catch {
      if (mountedRef.current && wantsWakeLockRef.current) {
        onNotice?.(
          'The browser could not keep the display awake. Keep this screen active during transfer.',
          'info',
        )
      }
    }
  }, [onNotice, releaseWakeLock])

  useEffect(() => {
    if (!isBroadcasting || !preparation.schedule) return undefined

    const intervalId = window.setInterval(() => {
      setFrameNumber((current) => current + 1)
    }, preparation.schedule.frameDurationMs)

    return () => window.clearInterval(intervalId)
  }, [isBroadcasting, preparation.schedule])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isBroadcasting) {
        void acquireWakeLock()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [acquireWakeLock, isBroadcasting])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === panelRef.current)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(
    () => () => {
      void releaseWakeLock()
      if (document.fullscreenElement === panelRef.current) {
        void document.exitFullscreen().catch(() => {})
      }
    },
    [releaseWakeLock],
  )

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !document.fullscreenElement) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleBroadcastToggle = async () => {
    if (isBroadcasting) {
      wantsWakeLockRef.current = false
      setIsBroadcasting(false)
      await releaseWakeLock()
      return
    }

    wantsWakeLockRef.current = true
    setIsBroadcasting(true)
    await acquireWakeLock()
  }

  const handleFullscreenToggle = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }

    if (!panelRef.current?.requestFullscreen) {
      onNotice?.('Fullscreen is not supported by this browser.', 'info')
      return
    }

    await panelRef.current.requestFullscreen()
  }

  const handleClose = async () => {
    wantsWakeLockRef.current = false
    setIsBroadcasting(false)
    await releaseWakeLock()
    if (document.fullscreenElement === panelRef.current) {
      await document.exitFullscreen().catch(() => {})
    }
    onClose()
  }

  const descriptor = preparation.schedule?.getDescriptor(frameNumber)
  const qrPayload = useMemo(
    () => preparation.schedule?.getQrPayload(frameNumber) || '',
    [frameNumber, preparation.schedule],
  )
  const estimatedSeconds = preparation.schedule?.estimatedFirstCycleSeconds || 0
  const isLargeTransfer = estimatedSeconds >= LARGE_TRANSFER_SECONDS
  const cyclePercent = preparation.schedule
    ? Math.round(
        ((Number(descriptor?.frameInCycle || 0) + 1) /
          preparation.schedule.framesPerCycle) *
          100,
      )
    : 0

  return (
    <div
      className="calendar-modal-backdrop fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/70 px-3 py-3 backdrop-blur-md sm:items-center sm:px-4 sm:py-6"
      onClick={() => void handleClose()}
    >
      <div
        ref={panelRef}
        className="calendar-modal-panel relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/40 bg-slate-50 p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950 sm:max-h-[calc(100dvh-3rem)] sm:p-7 fullscreen:max-h-none fullscreen:rounded-none"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="optical-transfer-title"
      >
        <header className="flex shrink-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-violet-600 dark:text-violet-300">
              <QrCode className="h-4 w-4" />
              PMOT V1 optical transfer
            </div>
            <h2
              id="optical-transfer-title"
              className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl"
            >
              Send image through the screen
            </h2>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
              The animated QR codes contain the actual image bytes. No Wi-Fi,
              hotspot, LAN server, internet, or cloud transfer is used.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleClose()}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-white/5"
            aria-label="Close optical transfer"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
          {preparation.status === 'preparing' ? (
            <div className="grid min-h-[28rem] place-items-center rounded-3xl border border-violet-200 bg-violet-50/70 p-8 text-center dark:border-violet-500/20 dark:bg-violet-500/10">
              <div>
                <LoaderCircle className="mx-auto h-10 w-10 animate-spin text-violet-600 dark:text-violet-300" />
                <p className="mt-4 text-lg font-black text-slate-950 dark:text-white">
                  Preparing and hashing the image…
                </p>
                <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                  ProMana is splitting the original bytes into QR-sized chunks
                  and calculating SHA-256 locally.
                </p>
              </div>
            </div>
          ) : null}

          {preparation.status === 'error' ? (
            <div className="flex min-h-[20rem] items-center justify-center rounded-3xl border border-red-200 bg-red-50 p-8 text-center text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
              <div>
                <TriangleAlert className="mx-auto h-10 w-10" />
                <p className="mt-4 text-lg font-black">Image cannot be sent</p>
                <p className="mt-2 max-w-xl text-sm font-semibold">
                  {preparation.error}
                </p>
              </div>
            </div>
          ) : null}

          {preparation.status === 'ready' ? (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <section className="min-w-0">
                <div className="relative grid place-items-center overflow-hidden rounded-3xl border border-slate-200 bg-white p-3 shadow-inner dark:border-slate-700 sm:p-5">
                  <QRCodeCanvas
                    value={qrPayload}
                    title="Animated ProMana optical transfer frame"
                    level={OPTICAL_TRANSFER_CONFIG.qrErrorCorrection}
                    marginSize={3}
                    size={640}
                    bgColor="#ffffff"
                    fgColor="#020617"
                    className="aspect-square h-auto w-full max-w-[38rem]"
                  />
                  {!isBroadcasting ? (
                    <div className="absolute inset-0 grid place-items-center bg-white/90 p-6 text-center backdrop-blur-sm">
                      <div>
                        <Play className="mx-auto h-12 w-12 text-violet-600" />
                        <p className="mt-3 text-lg font-black text-slate-950">
                          Ready to broadcast
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-600">
                          Start the receiver camera first, then begin.
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/70">
                  <div className="flex items-center justify-between gap-3 text-xs font-black text-slate-600 dark:text-slate-300">
                    <span>
                      Cycle {Number(descriptor?.cycleNumber || 0) + 1} · frame{' '}
                      {Number(descriptor?.frameInCycle || 0) + 1}/
                      {preparation.schedule.framesPerCycle}
                    </span>
                    <span>{cyclePercent}% of this broadcast cycle</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-600 to-cyan-400 transition-[width] duration-100"
                      style={{ width: `${cyclePercent}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] font-semibold leading-5 text-slate-500 dark:text-slate-400">
                    This shows outgoing frames only—not phone progress. The
                    phone reports real unique chunks and verifies SHA-256.
                  </p>
                </div>
              </section>

              <aside className="space-y-3">
                <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-500/20 dark:bg-violet-500/10">
                  <div className="flex items-start gap-3">
                    <Radio className={`mt-0.5 h-5 w-5 shrink-0 ${isBroadcasting ? 'animate-pulse' : ''}`} />
                    <div>
                      <p className="text-sm font-black text-violet-900 dark:text-violet-100">
                        {isBroadcasting ? 'Broadcasting frames' : 'Broadcast paused'}
                      </p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-violet-700 dark:text-violet-200">
                        {OPTICAL_TRANSFER_CONFIG.chunkSize} bytes/frame at{' '}
                        {preparation.schedule.fps} FPS · metadata repeats every{' '}
                        {preparation.schedule.metadataInterval} data frames
                      </p>
                    </div>
                  </div>
                </div>

                {isLargeTransfer ? (
                  <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                    <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
                    <p className="text-xs font-semibold leading-5">
                      Large optical transfer. One ideal cycle is about{' '}
                      {formatDuration(estimatedSeconds)}; camera conditions and
                      missed frames can make it longer.
                    </p>
                  </div>
                ) : null}

                <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/70">
                  <p className="truncate text-sm font-black text-slate-950 dark:text-white">
                    {preparation.transfer.metadata.filename}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {formatFileSize(preparation.transfer.metadata.size)} ·{' '}
                    {preparation.transfer.metadata.totalChunks} chunks
                  </p>
                  <p className="mt-2 break-all font-mono text-[10px] text-slate-400">
                    SHA-256 {preparation.transfer.metadata.sha256Hex}
                  </p>
                </div>

                <div className="flex gap-3 rounded-2xl bg-slate-100 p-4 text-slate-700 dark:bg-white/5 dark:text-slate-200">
                  <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-300" />
                  <ol className="list-decimal space-y-1 pl-4 text-xs font-semibold leading-5">
                    <li>On the phone, open ProMana’s cached receiver.</li>
                    <li>Tap Start camera and point it at this QR.</li>
                    <li>Keep both screens steady until verification passes.</li>
                    <li>Save the verified image on the phone.</li>
                  </ol>
                </div>

                <a
                  href="/receiver"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <Smartphone className="h-4 w-4" />
                  Preview receiver on this device
                </a>
              </aside>
            </div>
          ) : null}
        </div>

        <footer className="mt-5 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            Actual bytes travel only from this display to the phone camera.
            {wakeLockActive ? ' Screen wake lock active.' : ''}
          </div>
          <div className="flex flex-wrap gap-2">
            {preparation.status === 'ready' ? (
              <>
                <button
                  type="button"
                  onClick={() => void handleFullscreenToggle()}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                  {isFullscreen ? 'Exit full screen' : 'Full screen'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleBroadcastToggle()}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-violet-500/20 transition hover:brightness-110"
                >
                  {isBroadcasting ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {isBroadcasting ? 'Pause broadcast' : 'Start broadcast'}
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => void handleClose()}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              Close
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default function OpticalTransferModal({ request, open, onClose, onNotice }) {
  if (!open || !request || typeof document === 'undefined') return null

  return createPortal(
    <OpticalTransferPanel
      key={request.fileRecord?.id || getFilename(request.fileRecord)}
      request={request}
      onClose={onClose}
      onNotice={onNotice}
    />,
    document.body,
  )
}
