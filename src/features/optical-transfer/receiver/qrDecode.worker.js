import jsQR from 'jsqr'

const MAX_SCAN_PIXELS = 1_280 * 1_280

function isValidDimension(value) {
  return Number.isInteger(value) && value >= 32 && value <= 1_280
}

self.addEventListener('message', (event) => {
  const message = event.data

  if (message?.type !== 'decode') {
    return
  }

  const { requestId, width, height, pixels } = message

  try {
    if (
      !Number.isSafeInteger(requestId) ||
      !isValidDimension(width) ||
      !isValidDimension(height) ||
      width * height > MAX_SCAN_PIXELS ||
      !(pixels instanceof ArrayBuffer) ||
      pixels.byteLength !== width * height * 4
    ) {
      throw new Error('The camera frame was not valid.')
    }

    const result = jsQR(new Uint8ClampedArray(pixels), width, height, {
      inversionAttempts: 'dontInvert',
    })

    self.postMessage({
      type: 'decoded',
      requestId,
      payload: typeof result?.data === 'string' ? result.data : null,
    })
  } catch (error) {
    self.postMessage({
      type: 'decode-error',
      requestId,
      message: error instanceof Error ? error.message : 'QR decoding failed.',
    })
  }
})
