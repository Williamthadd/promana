import { useCallback, useEffect, useRef } from 'react'

const SCAN_INTERVAL_MS = 125
const MAX_SCAN_SIDE = 720
const MIN_SCAN_SIDE = 160

const CAMERA_CONSTRAINTS = Object.freeze({
  audio: false,
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1_280, max: 1_920 },
    height: { ideal: 720, max: 1_080 },
    frameRate: { ideal: 30, max: 30 },
  },
})

function waitForVideoMetadata(video) {
  if (video.readyState >= 1 && video.videoWidth > 0) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup()
      reject(new Error('The camera did not start in time.'))
    }, 10_000)

    const cleanup = () => {
      window.clearTimeout(timeoutId)
      video.removeEventListener('loadedmetadata', handleLoaded)
      video.removeEventListener('error', handleError)
    }

    const handleLoaded = () => {
      cleanup()
      resolve()
    }

    const handleError = () => {
      cleanup()
      reject(new Error('The camera video could not be opened.'))
    }

    video.addEventListener('loadedmetadata', handleLoaded, { once: true })
    video.addEventListener('error', handleError, { once: true })
  })
}

function createCameraError(error) {
  const errorName = error?.name

  if (errorName === 'NotAllowedError' || errorName === 'SecurityError') {
    return {
      code: 'permission-denied',
      message:
        'Camera permission was denied. Allow camera access for ProMana in your browser settings, then tap Try camera again.',
    }
  }

  if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
    return {
      code: 'camera-unavailable',
      message: 'No usable camera was found on this device.',
    }
  }

  if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
    return {
      code: 'camera-busy',
      message:
        'The camera is already in use or unavailable. Close other camera apps and try again.',
    }
  }

  if (errorName === 'OverconstrainedError') {
    return {
      code: 'camera-constraints',
      message:
        'This camera does not support the preferred scan settings. Try again or use a different browser.',
    }
  }

  return {
    code: 'camera-start-failed',
    message:
      error?.message ||
      'The camera could not be started. ProMana needs a secure HTTPS page or an installed PWA.',
  }
}

export function useCameraQrScanner({
  videoRef,
  canvasRef,
  onPayload,
  onFatalError,
}) {
  const streamRef = useRef(null)
  const workerRef = useRef(null)
  const activeRef = useRef(false)
  const startingRef = useRef(false)
  const workerBusyRef = useRef(false)
  const frameHandleRef = useRef(null)
  const frameHandleKindRef = useRef(null)
  const lastScanAtRef = useRef(0)
  const requestIdRef = useRef(0)
  const operationIdRef = useRef(0)
  const onPayloadRef = useRef(onPayload)
  const onFatalErrorRef = useRef(onFatalError)

  useEffect(() => {
    onPayloadRef.current = onPayload
  }, [onPayload])

  useEffect(() => {
    onFatalErrorRef.current = onFatalError
  }, [onFatalError])

  const cancelScheduledFrame = useCallback(() => {
    const video = videoRef.current
    const handle = frameHandleRef.current

    if (handle === null) {
      return
    }

    if (
      frameHandleKindRef.current === 'video' &&
      typeof video?.cancelVideoFrameCallback === 'function'
    ) {
      video.cancelVideoFrameCallback(handle)
    } else {
      window.cancelAnimationFrame(handle)
    }

    frameHandleRef.current = null
    frameHandleKindRef.current = null
  }, [videoRef])

  const stop = useCallback(() => {
    operationIdRef.current += 1
    activeRef.current = false
    startingRef.current = false
    workerBusyRef.current = false
    cancelScheduledFrame()

    workerRef.current?.terminate()
    workerRef.current = null

    for (const track of streamRef.current?.getTracks?.() || []) {
      track.stop()
    }
    streamRef.current = null

    const video = videoRef.current
    if (video) {
      video.pause()
      video.srcObject = null
    }
  }, [cancelScheduledFrame, videoRef])

  const scheduleNextFrameRef = useRef(null)

  const captureFrame = useCallback(
    (timestamp) => {
      if (!activeRef.current) {
        return
      }

      const video = videoRef.current
      const canvas = canvasRef.current

      if (
        !workerBusyRef.current &&
        timestamp - lastScanAtRef.current >= SCAN_INTERVAL_MS &&
        video?.readyState >= 2 &&
        video.videoWidth >= MIN_SCAN_SIDE &&
        video.videoHeight >= MIN_SCAN_SIDE &&
        canvas
      ) {
        const sourceSide = Math.min(video.videoWidth, video.videoHeight)
        const targetSide = Math.min(MAX_SCAN_SIDE, sourceSide)
        const sourceX = Math.floor((video.videoWidth - sourceSide) / 2)
        const sourceY = Math.floor((video.videoHeight - sourceSide) / 2)
        const context = canvas.getContext('2d', {
          alpha: false,
          willReadFrequently: true,
        })

        if (context) {
          if (canvas.width !== targetSide || canvas.height !== targetSide) {
            canvas.width = targetSide
            canvas.height = targetSide
          }
          context.drawImage(
            video,
            sourceX,
            sourceY,
            sourceSide,
            sourceSide,
            0,
            0,
            targetSide,
            targetSide,
          )

          const imageData = context.getImageData(0, 0, targetSide, targetSide)
          const requestId = ++requestIdRef.current
          lastScanAtRef.current = timestamp
          workerBusyRef.current = true
          workerRef.current?.postMessage(
            {
              type: 'decode',
              requestId,
              width: targetSide,
              height: targetSide,
              pixels: imageData.data.buffer,
            },
            [imageData.data.buffer],
          )
        }
      }

      scheduleNextFrameRef.current?.()
    },
    [canvasRef, videoRef],
  )

  useEffect(() => {
    scheduleNextFrameRef.current = () => {
      if (!activeRef.current) {
        return
      }

      const video = videoRef.current
      if (typeof video?.requestVideoFrameCallback === 'function') {
        frameHandleKindRef.current = 'video'
        frameHandleRef.current = video.requestVideoFrameCallback(() => {
          frameHandleRef.current = null
          captureFrame(performance.now())
        })
      } else {
        frameHandleKindRef.current = 'animation'
        frameHandleRef.current = window.requestAnimationFrame(captureFrame)
      }
    }
  }, [captureFrame, videoRef])

  const start = useCallback(async () => {
    if (activeRef.current || startingRef.current) {
      return false
    }

    if (
      !window.isSecureContext ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof Worker === 'undefined'
    ) {
      onFatalErrorRef.current?.({
        code: 'camera-unsupported',
        message:
          'Camera scanning is unavailable here. Open ProMana over HTTPS or from the installed PWA in a modern browser.',
      })
      return false
    }

    const operationId = operationIdRef.current + 1
    operationIdRef.current = operationId
    startingRef.current = true
    let pendingStream = null
    let pendingWorker = null

    const wasCancelled = () => operationIdRef.current !== operationId
    const discardPendingResources = () => {
      pendingWorker?.terminate()
      for (const track of pendingStream?.getTracks?.() || []) track.stop()
      if (streamRef.current === pendingStream) streamRef.current = null
    }

    try {
      const video = videoRef.current
      if (!video) {
        throw new Error('The camera preview is not ready.')
      }

      const stream = await navigator.mediaDevices.getUserMedia(
        CAMERA_CONSTRAINTS,
      )
      pendingStream = stream
      if (wasCancelled()) {
        discardPendingResources()
        return false
      }
      streamRef.current = stream
      video.srcObject = stream
      video.setAttribute('playsinline', '')
      await waitForVideoMetadata(video)
      await video.play()
      if (wasCancelled()) {
        discardPendingResources()
        return false
      }

      const worker = new Worker(new URL('./qrDecode.worker.js', import.meta.url), {
        type: 'module',
        name: 'promana-optical-qr-decoder',
      })
      pendingWorker = worker

      worker.addEventListener('message', (event) => {
        const message = event.data
        if (
          message?.requestId !== requestIdRef.current ||
          !activeRef.current
        ) {
          return
        }

        workerBusyRef.current = false

        if (message.type === 'decoded' && message.payload) {
          onPayloadRef.current?.(message.payload)
        } else if (message.type === 'decode-error') {
          onFatalErrorRef.current?.({
            code: 'decoder-failed',
            message:
              message.message || 'The QR decoder could not process the camera.',
          })
        }
      })

      worker.addEventListener('error', () => {
        workerBusyRef.current = false
        onFatalErrorRef.current?.({
          code: 'decoder-worker-failed',
          message:
            'The offline QR decoder stopped unexpectedly. Restart the receiver and try again.',
        })
      })

      workerRef.current = worker
      if (wasCancelled()) {
        discardPendingResources()
        return false
      }
      lastScanAtRef.current = 0
      activeRef.current = true
      startingRef.current = false
      scheduleNextFrameRef.current?.()
      return true
    } catch (error) {
      if (wasCancelled()) {
        discardPendingResources()
        return false
      }
      stop()
      onFatalErrorRef.current?.(createCameraError(error))
      return false
    }
  }, [stop, videoRef])

  useEffect(() => stop, [stop])

  return { start, stop }
}
