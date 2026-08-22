export class OpticalTransferProtocolError extends Error {
  constructor(code, message, options = undefined) {
    super(message, options)
    this.name = 'OpticalTransferProtocolError'
    this.code = code
  }
}

export function protocolError(code, message, options) {
  return new OpticalTransferProtocolError(code, message, options)
}

export function assertProtocol(condition, code, message) {
  if (!condition) {
    throw protocolError(code, message)
  }
}
