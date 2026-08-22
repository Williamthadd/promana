import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Bug,
  Camera,
  CheckCircle2,
  CircleStop,
  Download,
  Image as ImageIcon,
  Info,
  LoaderCircle,
  PackageCheck,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Smartphone,
  WifiOff,
  X,
} from 'lucide-react'
import { createOpticalTransferCollector } from '../protocol/index.js'
import { useCameraQrScanner } from './useCameraQrScanner.js'

const IS_DEVELOPMENT = import.meta.env.DEV
const SAFE_IMAGE_MIME_TYPES = new Set([
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
])

const EMPTY_SNAPSHOT = Object.freeze({
  status: 'waiting',
  sessionId: null,
  metadata: null,
  uniqueChunks: 0,
  totalChunks: 0,
  duplicateCount: 0,
  progress: 0,
  ready: false,
})

const INITIAL_DIAGNOSTICS = Object.freeze({
  decodedQrFrames: 0,
  acceptedPackets: 0,
  ignoredPackets: 0,
  invalidPackets: 0,
  duplicatePackets: 0,
  firstPacketAt: null,
  lastUniqueChunkAt: null,
  lastIssue: '',
})

const PHASE_COPY = Object.freeze({
  idle: {
    title: 'Ready to receive',
    detail: 'Camera access starts only when you tap Start camera.',
  },
  requesting: {
    title: 'Requesting camera',
    detail: 'Approve camera access when your browser asks.',
  },
  scanning: {
    title: 'Looking for a ProMana QR stream',
    detail: 'Keep the animated QR code fully inside the guide.',
  },
  receiving: {
    title: 'Receiving image',
    detail: 'Hold the phone steady. Missed frames arrive on the next loop.',
  },
  verifying: {
    title: 'Verifying image',
    detail: 'Checking exact byte length, image format, and SHA-256 integrity.',
  },
  complete: {
    title: 'Transfer complete',
    detail: 'The reconstructed image passed every integrity check.',
  },
  error: {
    title: 'Receiver needs attention',
    detail: 'Review the message below, then restart when ready.',
  },
})

function formatFileSize(byteLength) {
  const bytes = Number(byteLength)
  if (!Number.isFinite(bytes) || bytes < 0) return 'Unknown size'
  if (bytes < 1_024) return `${bytes} B`
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`
  return `${(bytes / 1_048_576).toFixed(2)} MB`
}

function sanitizeDownloadName(value, mimeType) {
  const extensionByMime = {
    'image/gif': 'gif',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  }
  const fallback = `promana-received.${extensionByMime[mimeType] || 'img'}`
  const basename = String(value || '')
    .replace(/^.*[\\/]/, '')
    .split('')
    .map((character) =>
      character.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(character)
        ? '_'
        : character,
    )
    .join('')
    .replace(/[. ]+$/g, '')
    .trim()

  return basename.slice(0, 160) || fallback
}

function useStandaloneStatus() {
  const [isStandalone, setIsStandalone] = useState(() => {
    if (typeof window === 'undefined') return false
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    )
  })

  useEffect(() => {
    const query = window.matchMedia('(display-mode: standalone)')
    const update = () =>
      setIsStandalone(
        query.matches || window.navigator.standalone === true,
      )

    query.addEventListener?.('change', update)
    return () => query.removeEventListener?.('change', update)
  }, [])

  return isStandalone
}

function useOnlineHint() {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  return online
}

function Progress({ snapshot }) {
  const totalChunks = Math.max(0, Number(snapshot.totalChunks) || 0)
  const uniqueChunks = Math.min(
    totalChunks,
    Math.max(0, Number(snapshot.uniqueChunks) || 0),
  )
  const progress = totalChunks
    ? Math.min(100, (uniqueChunks / totalChunks) * 100)
    : 0

  return (
    <div className="rounded-2xl border border-white/50 bg-white/70 p-4 dark:border-white/10 dark:bg-slate-950/50">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            Unique chunks received
          </p>
          <p className="mt-1 text-lg font-black text-slate-950 dark:text-white">
            {uniqueChunks.toLocaleString()} /{' '}
            {totalChunks ? totalChunks.toLocaleString() : '—'}
          </p>
        </div>
        <p className="text-2xl font-black tabular-nums text-blue-600 dark:text-blue-300">
          {progress.toFixed(progress > 0 && progress < 10 ? 1 : 0)}%
        </p>
      </div>
      <div
        className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
        role="progressbar"
        aria-label="Optical transfer progress"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={Math.round(progress)}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-400 transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
        This is actual recovered data, not the sender&apos;s current frame.
      </p>
    </div>
  )
}

function DevelopmentDiagnostics({ diagnostics, snapshot }) {
  if (!IS_DEVELOPMENT) return null

  const elapsedSeconds = diagnostics.firstPacketAt
    ? Math.max(
        1,
        ((diagnostics.lastUniqueChunkAt || diagnostics.firstPacketAt) -
          diagnostics.firstPacketAt) /
          1_000,
      )
    : 0
  const uniquePerSecond = elapsedSeconds
    ? snapshot.uniqueChunks / elapsedSeconds
    : 0
  const duplicateRate = diagnostics.acceptedPackets
    ? (diagnostics.duplicatePackets / diagnostics.acceptedPackets) * 100
    : 0

  return (
    <details className="rounded-2xl border border-violet-200/80 bg-violet-50/80 p-4 text-xs dark:border-violet-500/20 dark:bg-violet-500/10">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-200">
        <Bug className="h-4 w-4" />
        Development scan diagnostics
      </summary>
      <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 font-mono text-slate-700 dark:text-slate-200 sm:grid-cols-3">
        <div>
          <dt className="text-slate-500">Decoded QR</dt>
          <dd>{diagnostics.decodedQrFrames}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Accepted</dt>
          <dd>{diagnostics.acceptedPackets}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Ignored</dt>
          <dd>{diagnostics.ignoredPackets}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Invalid</dt>
          <dd>{diagnostics.invalidPackets}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Duplicates</dt>
          <dd>{duplicateRate.toFixed(1)}%</dd>
        </div>
        <div>
          <dt className="text-slate-500">Unique chunks/s</dt>
          <dd>{uniquePerSecond.toFixed(2)}</dd>
        </div>
      </dl>
      {diagnostics.lastIssue ? (
        <p className="mt-3 break-words font-mono text-amber-700 dark:text-amber-200">
          Last rejected packet: {diagnostics.lastIssue}
        </p>
      ) : null}
    </details>
  )
}

export default function OfflineReceiver({ onClose, onComplete, className = '' }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const collectorRef = useRef(createOpticalTransferCollector())
  const scannerRef = useRef(null)
  const verificationInFlightRef = useRef(false)
  const generationRef = useRef(0)
  const mountedRef = useRef(true)
  const previewUrlRef = useRef(null)
  const [phase, setPhase] = useState('idle')
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT)
  const [diagnostics, setDiagnostics] = useState(INITIAL_DIAGNOSTICS)
  const [error, setError] = useState('')
  const [scanNotice, setScanNotice] = useState('')
  const [result, setResult] = useState(null)
  const isStandalone = useStandaloneStatus()
  const onlineHint = useOnlineHint()

  const releasePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      releasePreview()
    }
  }, [releasePreview])

  const handleFatalError = useCallback((cameraError) => {
    scannerRef.current?.stop()
    setError(cameraError?.message || 'The camera scanner stopped unexpectedly.')
    setPhase('error')
  }, [])

  const verifyTransfer = useCallback(
    async (collector) => {
      if (verificationInFlightRef.current) return

      verificationInFlightRef.current = true
      const generation = generationRef.current
      scannerRef.current?.stop()
      setPhase('verifying')
      setError('')

      try {
        const verified = await collector.assembleAndVerify()
        if (!mountedRef.current || generation !== generationRef.current) return

        const mimeType = String(verified.metadata?.mimeType || '').toLowerCase()
        if (!SAFE_IMAGE_MIME_TYPES.has(mimeType)) {
          throw new Error('The received file is not a supported raster image.')
        }

        const filename = sanitizeDownloadName(
          verified.metadata?.filename,
          mimeType,
        )
        const blob = new Blob([verified.bytes], { type: mimeType })

        if (blob.size !== verified.metadata.size) {
          throw new Error('The verified image size changed during reconstruction.')
        }

        releasePreview()
        const previewUrl = URL.createObjectURL(blob)
        previewUrlRef.current = previewUrl
        const completedResult = {
          blob,
          filename,
          mimeType,
          previewUrl,
          sha256: verified.sha256,
          size: blob.size,
        }
        setResult(completedResult)
        setPhase('complete')
        onComplete?.(completedResult)
      } catch (verificationError) {
        if (!mountedRef.current || generation !== generationRef.current) return
        setError(
          verificationError?.message ||
            'The image failed its integrity verification. Restart the transfer.',
        )
        setPhase('error')
      } finally {
        if (generation === generationRef.current) {
          verificationInFlightRef.current = false
        }
      }
    },
    [onComplete, releasePreview],
  )

  const handlePayload = useCallback(
    (untrustedPayload) => {
      if (verificationInFlightRef.current || phase === 'complete') return

      setDiagnostics((current) => ({
        ...current,
        decodedQrFrames: current.decodedQrFrames + 1,
      }))

      try {
        const collector = collectorRef.current
        const previous = collector.getSnapshot()
        const outcome = collector.ingestQrFrame(untrustedPayload)

        if (!outcome.accepted) {
          setDiagnostics((current) => ({
            ...current,
            ignoredPackets: current.ignoredPackets + 1,
            lastIssue: outcome.reason || current.lastIssue,
          }))
          return
        }

        const next = outcome.snapshot || collector.getSnapshot()
        const receivedUniqueChunk = next.uniqueChunks > previous.uniqueChunks
        setSnapshot(next)
        setScanNotice('')
        setDiagnostics((current) => ({
          ...current,
          acceptedPackets: current.acceptedPackets + 1,
          duplicatePackets:
            current.duplicatePackets + (outcome.duplicate ? 1 : 0),
          firstPacketAt: current.firstPacketAt || Date.now(),
          lastUniqueChunkAt: receivedUniqueChunk
            ? Date.now()
            : current.lastUniqueChunkAt,
          lastIssue: '',
        }))

        if (next.metadata || next.uniqueChunks > 0) {
          setPhase('receiving')
        }

        if (outcome.ready || next.ready) {
          void verifyTransfer(collector)
        }
      } catch (packetError) {
        const issue = packetError?.message || 'Malformed QR packet'
        setDiagnostics((current) => ({
          ...current,
          invalidPackets: current.invalidPackets + 1,
          lastIssue: issue,
        }))

        if (String(packetError?.code || '').includes('VERSION')) {
          setScanNotice(
            'This QR stream uses a ProMana protocol version that this receiver does not support.',
          )
        }
      }
    },
    [phase, verifyTransfer],
  )

  const scanner = useCameraQrScanner({
    videoRef,
    canvasRef,
    onPayload: handlePayload,
    onFatalError: handleFatalError,
  })
  scannerRef.current = scanner

  const startCamera = useCallback(async () => {
    if (phase === 'requesting' || phase === 'verifying') return

    setError('')
    setScanNotice('')
    setPhase('requesting')
    const started = await scanner.start()

    if (started && mountedRef.current) {
      const current = collectorRef.current.getSnapshot()
      setPhase(current.metadata || current.uniqueChunks ? 'receiving' : 'scanning')
    }
  }, [phase, scanner])

  const stopCamera = useCallback(() => {
    scanner.stop()
    if (phase !== 'complete' && phase !== 'verifying') {
      setPhase('idle')
      setError('')
    }
  }, [phase, scanner])

  const resetReceiver = useCallback(() => {
    generationRef.current += 1
    verificationInFlightRef.current = false
    scanner.stop()
    collectorRef.current = createOpticalTransferCollector()
    releasePreview()
    setResult(null)
    setSnapshot(EMPTY_SNAPSHOT)
    setDiagnostics(INITIAL_DIAGNOSTICS)
    setScanNotice('')
    setError('')
    setPhase('idle')
  }, [releasePreview, scanner])

  const restartReceiver = useCallback(async () => {
    resetReceiver()
    setPhase('requesting')
    const started = await scanner.start()
    if (started && mountedRef.current) setPhase('scanning')
  }, [resetReceiver, scanner])

  const saveImage = useCallback(() => {
    if (!result?.previewUrl) return

    const anchor = document.createElement('a')
    anchor.href = result.previewUrl
    anchor.download = result.filename
    anchor.rel = 'noopener'
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }, [result])

  const phaseCopy = PHASE_COPY[phase] || PHASE_COPY.error
  const isCameraActive = phase === 'scanning' || phase === 'receiving'
  const progressSnapshot = snapshot || EMPTY_SNAPSHOT
  const displayFilename =
    result?.filename || progressSnapshot.metadata?.filename || 'Waiting for metadata'
  const displaySize = result?.size ?? progressSnapshot.metadata?.size
  const statusIcon = useMemo(() => {
    if (phase === 'complete') return CheckCircle2
    if (phase === 'error') return AlertTriangle
    if (phase === 'requesting' || phase === 'verifying') return LoaderCircle
    if (phase === 'receiving') return PackageCheck
    return ScanLine
  }, [phase])
  const StatusIcon = statusIcon

  return (
    <main
      className={`min-h-dvh bg-mesh-light px-3 py-4 text-slate-950 dark:bg-mesh-dark dark:text-white sm:px-5 sm:py-7 ${className}`}
    >
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
              <WifiOff className="h-4 w-4" />
              Optical channel only
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              ProMana Offline Receiver
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
              Receive an image directly from animated QR codes. The image travels
              from screen to camera—no internet, Wi-Fi, hotspot, Bluetooth, or
              cloud transfer is used.
            </p>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={() => {
                scanner.stop()
                onClose()
              }}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/50 bg-white/70 text-slate-600 transition hover:bg-white dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-300"
              aria-label="Close offline receiver"
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
          <section className="overflow-hidden rounded-3xl border border-white/60 p-4 shadow-xl shadow-blue-950/5 glass-panel-light dark:border-white/10 dark:glass-panel-dark sm:p-5">
            <div className="relative aspect-square overflow-hidden rounded-[1.4rem] bg-slate-950">
              <video
                ref={videoRef}
                className={`h-full w-full object-cover transition-opacity duration-300 ${
                  isCameraActive ? 'opacity-100' : 'opacity-20'
                }`}
                muted
                playsInline
                aria-label="Rear camera preview"
              />
              <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

              <div className="pointer-events-none absolute inset-[10%] rounded-[2rem] border-2 border-white/90 shadow-[0_0_0_999px_rgba(2,6,23,0.32)]">
                <span className="absolute -left-0.5 -top-0.5 h-12 w-12 rounded-tl-[2rem] border-l-4 border-t-4 border-cyan-400" />
                <span className="absolute -right-0.5 -top-0.5 h-12 w-12 rounded-tr-[2rem] border-r-4 border-t-4 border-cyan-400" />
                <span className="absolute -bottom-0.5 -left-0.5 h-12 w-12 rounded-bl-[2rem] border-b-4 border-l-4 border-cyan-400" />
                <span className="absolute -bottom-0.5 -right-0.5 h-12 w-12 rounded-br-[2rem] border-b-4 border-r-4 border-cyan-400" />
                {isCameraActive ? (
                  <span className="absolute left-[8%] right-[8%] top-1/2 h-px animate-pulse bg-cyan-300 shadow-[0_0_14px_2px_rgba(103,232,249,0.8)]" />
                ) : null}
              </div>

              {!isCameraActive ? (
                <div className="absolute inset-0 grid place-items-center p-8 text-center">
                  <div>
                    {phase === 'requesting' || phase === 'verifying' ? (
                      <LoaderCircle className="mx-auto h-12 w-12 animate-spin text-cyan-300" />
                    ) : phase === 'complete' ? (
                      <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-300" />
                    ) : (
                      <Camera className="mx-auto h-12 w-12 text-slate-300" />
                    )}
                    <p className="mt-4 text-sm font-bold text-white">
                      {phaseCopy.title}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3" aria-live="polite">
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${
                    phase === 'complete'
                      ? 'bg-emerald-500 text-white'
                      : phase === 'error'
                        ? 'bg-red-500 text-white'
                        : 'bg-blue-600 text-white'
                  }`}
                >
                  <StatusIcon
                    className={`h-5 w-5 ${
                      phase === 'requesting' || phase === 'verifying'
                        ? 'animate-spin'
                        : ''
                    }`}
                  />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">{phaseCopy.title}</p>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {phaseCopy.detail}
                  </p>
                </div>
              </div>

              {isCameraActive ? (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200"
                >
                  <CircleStop className="h-4 w-4" />
                  Stop camera
                </button>
              ) : null}
            </div>
          </section>

          <aside className="space-y-4">
            {phase === 'complete' && result ? (
              <section className="rounded-3xl border border-emerald-200 bg-emerald-50/90 p-5 shadow-lg shadow-emerald-900/5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                <img
                  src={result.previewUrl}
                  alt={`Verified preview of ${result.filename}`}
                  className="max-h-64 w-full rounded-2xl bg-white object-contain shadow-sm dark:bg-slate-950"
                />
                <div className="mt-4 flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-300" />
                  <div className="min-w-0">
                    <p className="truncate font-black">{result.filename}</p>
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-200">
                      {formatFileSize(result.size)} · SHA-256 verified
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={saveImage}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-md shadow-emerald-600/20 transition hover:brightness-110"
                >
                  <Download className="h-5 w-5" />
                  Save image
                </button>
                <p className="mt-2 text-center text-xs font-semibold text-emerald-700/80 dark:text-emerald-200/80">
                  Your browser chooses the Downloads or save destination. Gallery
                  placement varies by Android browser.
                </p>
              </section>
            ) : (
              <section className="space-y-4 rounded-3xl border border-white/60 p-5 shadow-lg shadow-blue-950/5 glass-panel-light dark:border-white/10 dark:glass-panel-dark">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
                    <ImageIcon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-black">{displayFilename}</p>
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                      {displaySize === undefined
                        ? 'Image details appear after metadata is scanned'
                        : formatFileSize(displaySize)}
                    </p>
                  </div>
                </div>

                <Progress snapshot={progressSnapshot} />

                {error ? (
                  <div
                    className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-5 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200"
                    role="alert"
                  >
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                    <p>{error}</p>
                  </div>
                ) : null}

                {scanNotice ? (
                  <div
                    className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-5 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
                    role="status"
                  >
                    <Info className="mt-0.5 h-5 w-5 shrink-0" />
                    <p>{scanNotice}</p>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  {phase === 'idle' ? (
                    <button
                      type="button"
                      onClick={() => void startCamera()}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-md shadow-blue-600/20 transition hover:brightness-110"
                    >
                      <Camera className="h-5 w-5" />
                      {snapshot.uniqueChunks ? 'Resume camera' : 'Start camera'}
                    </button>
                  ) : null}
                  {phase === 'requesting' ? (
                    <button
                      type="button"
                      disabled
                      className="inline-flex flex-1 cursor-wait items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white opacity-70"
                    >
                      <LoaderCircle className="h-5 w-5 animate-spin" />
                      Opening camera…
                    </button>
                  ) : null}
                  {phase === 'error' ? (
                    <button
                      type="button"
                      onClick={() => void restartReceiver()}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-md shadow-blue-600/20 transition hover:brightness-110"
                    >
                      <RefreshCw className="h-5 w-5" />
                      Try camera again
                    </button>
                  ) : null}
                  {snapshot.uniqueChunks > 0 && phase !== 'verifying' ? (
                    <button
                      type="button"
                      onClick={() => void restartReceiver()}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Restart transfer
                    </button>
                  ) : null}
                </div>
              </section>
            )}

            <section className="rounded-3xl border border-cyan-200/80 bg-cyan-50/80 p-5 dark:border-cyan-500/20 dark:bg-cyan-500/10">
              <div className="flex gap-3">
                <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700 dark:text-cyan-300" />
                <div>
                  <p className="text-sm font-black text-cyan-950 dark:text-cyan-100">
                    Keep the QR code fully in frame
                  </p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-cyan-800 dark:text-cyan-200">
                    Avoid glare, hold steady, and move slightly closer if frames
                    are not detected. The rear camera is requested by default.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/60 bg-white/65 p-5 dark:border-white/10 dark:bg-slate-950/55">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
                <div>
                  <p className="text-sm font-black">
                    {onlineHint ? 'Network-independent transfer' : 'Airplane-mode ready'}
                  </p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-600 dark:text-slate-300">
                    {isStandalone
                      ? 'You are using the installed ProMana app. This receiver and QR decoder run locally on this device.'
                      : 'Before a future offline transfer, open this receiver online once and install ProMana from your browser menu. Then launch the installed app while offline.'}
                  </p>
                </div>
              </div>
            </section>

            <DevelopmentDiagnostics
              diagnostics={diagnostics}
              snapshot={progressSnapshot}
            />

            {phase === 'complete' ? (
              <button
                type="button"
                onClick={() => void restartReceiver()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200"
              >
                <RefreshCw className="h-4 w-4" />
                Receive another image
              </button>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  )
}
