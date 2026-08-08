/* global Buffer, process */

import { sendJson } from '../server/apiResponse.js'

const MAX_FILE_SIZE = 25 * 1024 * 1024
const IMAGE_DOWNLOAD_CHUNK_SIZE = 2 * 1024 * 1024
const UPLOAD_CHUNK_SIZE = 2 * 1024 * 1024
const UPLOAD_CHUNK_GRANULARITY = 256 * 1024
const MAX_ENCODED_CHUNK_LENGTH = Math.ceil(UPLOAD_CHUNK_SIZE / 3) * 4
const MAX_REQUEST_BODY_LENGTH = MAX_ENCODED_CHUNK_LENGTH + 16_384
const ALLOWED_EXTENSIONS = new Set([
  'pdf',
  'docx',
  'xlsx',
  'csv',
  'png',
  'jpg',
  'jpeg',
  'gif',
])
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/gif',
])


class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function getEnvironmentValue(name, fallback = '') {
  return String(process.env[name] ?? fallback).trim()
}

function getFileExtension(fileName) {
  return String(fileName ?? '')
    .toLowerCase()
    .match(/\.([a-z0-9]+)$/)?.[1] ?? ''
}

function sanitizeFileName(fileName) {
  return (
    String(fileName ?? 'file')
      .replace(/[\\/]+/g, '-')
      .split('')
      .filter((character) => {
        const characterCode = character.charCodeAt(0)
        return characterCode >= 32 && characterCode !== 127
      })
      .join('')
      .trim()
      .slice(0, 180) || 'file'
  )
}

function isValidIdentifier(value) {
  return /^[a-zA-Z0-9_-]{10,128}$/.test(String(value ?? ''))
}

async function readRequestBody(request) {
  if (
    request.body &&
    typeof request.body === 'object' &&
    !ArrayBuffer.isView(request.body)
  ) {
    return request.body
  }

  if (typeof request.body === 'string') {
    try {
      return request.body ? JSON.parse(request.body) : {}
    } catch {
      throw new ApiError(400, 'Invalid JSON request body.')
    }
  }

  return new Promise((resolve, reject) => {
    let rawBody = ''

    request.on('data', (chunk) => {
      rawBody += chunk

      if (rawBody.length > MAX_REQUEST_BODY_LENGTH) {
        reject(new ApiError(413, 'Upload request is too large.'))
      }
    })
    request.on('end', () => {
      try {
        resolve(rawBody ? JSON.parse(rawBody) : {})
      } catch {
        reject(new ApiError(400, 'Invalid JSON request body.'))
      }
    })
    request.on('error', reject)
  })
}

function getBearerToken(request) {
  const authorization = String(request.headers.authorization ?? '')
  const match = authorization.match(/^Bearer\s+(.+)$/i)

  if (!match) {
    throw new ApiError(401, 'Authentication is required.')
  }

  return match[1]
}

async function verifyFirebaseUser(request) {
  const firebaseApiKey = getEnvironmentValue(
    'FIREBASE_WEB_API_KEY',
    process.env.VITE_FIREBASE_API_KEY,
  )

  if (!firebaseApiKey) {
    throw new ApiError(
      503,
      'FIREBASE_WEB_API_KEY is not configured on the server.',
    )
  }

  const idToken = getBearerToken(request)
  const authResponse = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseApiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    },
  )

  if (!authResponse.ok) {
    throw new ApiError(401, 'Your session has expired. Please sign in again.')
  }

  const payload = await authResponse.json()
  const user = payload.users?.[0]

  if (!user?.localId || user.disabled) {
    throw new ApiError(401, 'Your account could not be verified.')
  }

  if (!user.email || !user.emailVerified) {
    throw new ApiError(
      400,
      'A verified email address is required for Google Drive access.',
    )
  }

  return {
    uid: user.localId,
    email: user.email,
  }
}

function getGoogleDriveAccessToken(request) {
  const accessToken = String(
    request.headers['x-google-access-token'] ?? '',
  ).trim()

  if (!accessToken || accessToken.length > 4096) {
    throw new ApiError(401, 'Connect your Google Drive account to continue.')
  }

  return accessToken
}

async function driveFetch(accessToken, url, options = {}) {
  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${accessToken}`)

  return fetch(url, {
    ...options,
    headers,
  })
}

async function verifyGoogleDriveUser(accessToken, user) {
  const aboutResponse = await driveFetch(
    accessToken,
    'https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)',
  )

  if (aboutResponse.status === 401) {
    throw new ApiError(
      401,
      'Your Google Drive session expired. Reconnect Google Drive and try again.',
    )
  }

  if (!aboutResponse.ok) {
    throw new ApiError(
      403,
      await getGoogleError(
        aboutResponse,
        'Google Drive permission was not granted. Reconnect and allow Drive access.',
      ),
    )
  }

  const payload = await aboutResponse.json()
  const driveEmail = String(payload.user?.emailAddress ?? '').toLowerCase()

  if (!driveEmail || driveEmail !== user.email.toLowerCase()) {
    throw new ApiError(
      403,
      'The connected Google Drive email must match your ProMana login email.',
    )
  }
}

async function getGoogleError(driveResponse, fallback) {
  try {
    const payload = await driveResponse.json()
    return payload.error?.message || fallback
  } catch {
    return fallback
  }
}

async function getDriveFile(accessToken, fileId) {
  const fields = [
    'id',
    'name',
    'mimeType',
    'size',
    'appProperties',
    'webViewLink',
    'webContentLink',
  ].join(',')
  const fileResponse = await driveFetch(
    accessToken,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true&fields=${encodeURIComponent(fields)}`,
  )

  if (fileResponse.status === 404) {
    return null
  }

  if (!fileResponse.ok) {
    throw new ApiError(
      502,
      await getGoogleError(fileResponse, 'Unable to read the Drive file.'),
    )
  }

  return fileResponse.json()
}

function assertFileOwnership(file, user, documentId = '') {
  if (
    file?.appProperties?.promanUserId !== user.uid ||
    (documentId &&
      file?.appProperties?.promanDocumentId !== String(documentId))
  ) {
    throw new ApiError(403, 'You do not have access to that Drive file.')
  }
}

async function assertDriveFolderAccess(accessToken, user, folderId) {
  const fields = 'id,mimeType,capabilities(canAddChildren)'
  const folderResponse = await driveFetch(
    accessToken,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?supportsAllDrives=true&fields=${encodeURIComponent(fields)}`,
  )

  if (folderResponse.status === 403 || folderResponse.status === 404) {
    throw new ApiError(
      403,
      `The selected Drive folder is not available to ${user.email} as an editor.`,
    )
  }

  if (!folderResponse.ok) {
    throw new ApiError(
      502,
      await getGoogleError(
        folderResponse,
        'Unable to verify access to the selected Drive folder.',
      ),
    )
  }

  const folder = await folderResponse.json()

  if (
    folder.mimeType !== 'application/vnd.google-apps.folder' ||
    !folder.capabilities?.canAddChildren
  ) {
    throw new ApiError(
      403,
      `Google Drive account ${user.email} cannot add files to the selected folder.`,
    )
  }
}

function getFileLinks(file) {
  const encodedId = encodeURIComponent(file.id)

  return {
    webViewLink:
      file.webViewLink || `https://drive.google.com/file/d/${encodedId}/view`,
    previewUrl: `https://drive.google.com/file/d/${encodedId}/preview`,
    downloadUrl:
      file.webContentLink ||
      `https://drive.google.com/uc?export=download&id=${encodedId}`,
    thumbnailUrl: `https://drive.google.com/thumbnail?id=${encodedId}&sz=w1200`,
  }
}

function getUploadSessionUrl(value) {
  const rawUrl = String(value ?? '').trim()
  let uploadUrl

  if (!rawUrl || rawUrl.length > 4096) {
    throw new ApiError(400, 'Invalid Google Drive upload session.')
  }

  try {
    uploadUrl = new URL(rawUrl)
  } catch {
    throw new ApiError(400, 'Invalid Google Drive upload session.')
  }

  if (
    uploadUrl.protocol !== 'https:' ||
    uploadUrl.hostname !== 'www.googleapis.com' ||
    uploadUrl.pathname !== '/upload/drive/v3/files' ||
    uploadUrl.searchParams.get('uploadType') !== 'resumable' ||
    !uploadUrl.searchParams.get('upload_id')
  ) {
    throw new ApiError(400, 'Invalid Google Drive upload session.')
  }

  return uploadUrl.toString()
}

function decodeUploadChunk(value) {
  const encodedChunk = String(value ?? '')

  if (
    !encodedChunk ||
    encodedChunk.length > MAX_ENCODED_CHUNK_LENGTH ||
    encodedChunk.length % 4 !== 0 ||
    !/^[a-zA-Z0-9+/]*={0,2}$/.test(encodedChunk)
  ) {
    throw new ApiError(400, 'Invalid upload chunk.')
  }

  const chunk = Buffer.from(encodedChunk, 'base64')

  if (
    !chunk.length ||
    chunk.length > UPLOAD_CHUNK_SIZE ||
    chunk.toString('base64') !== encodedChunk
  ) {
    throw new ApiError(400, 'Invalid upload chunk.')
  }

  return chunk
}

async function uploadDriveChunk(response, payload) {
  const uploadUrl = getUploadSessionUrl(payload.uploadUrl)
  const mimeType = String(payload.mimeType ?? '').toLowerCase()
  const offset = Number(payload.offset)
  const totalSize = Number(payload.totalSize)
  const chunk = decodeUploadChunk(payload.chunkBase64)
  const nextOffset = offset + chunk.length
  const isFinalChunk = nextOffset === totalSize

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new ApiError(400, 'That file type is not supported.')
  }

  if (
    !Number.isSafeInteger(offset) ||
    !Number.isSafeInteger(totalSize) ||
    offset < 0 ||
    totalSize <= 0 ||
    totalSize > MAX_FILE_SIZE ||
    nextOffset > totalSize ||
    offset % UPLOAD_CHUNK_GRANULARITY !== 0 ||
    (!isFinalChunk && chunk.length % UPLOAD_CHUNK_GRANULARITY !== 0)
  ) {
    throw new ApiError(400, 'Invalid upload chunk range.')
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Length': String(chunk.length),
      'Content-Range': `bytes ${offset}-${nextOffset - 1}/${totalSize}`,
      'Content-Type': mimeType,
    },
    body: chunk,
    redirect: 'manual',
  })

  if (uploadResponse.status === 308) {
    sendJson(response, 200, {
      complete: false,
      receivedRange: uploadResponse.headers.get('range') || '',
    })
    return
  }

  if (!uploadResponse.ok) {
    throw new ApiError(
      502,
      await getGoogleError(
        uploadResponse,
        'Google Drive rejected an upload chunk. Please try again.',
      ),
    )
  }

  sendJson(response, 200, { complete: true })
}

async function verifyDriveFolder(accessToken, response, user, payload) {
  const folderId = String(payload.folderId ?? '').trim()

  if (!isValidIdentifier(folderId)) {
    throw new ApiError(400, 'Choose a valid Google Drive folder first.')
  }

  await assertDriveFolderAccess(accessToken, user, folderId)
  sendJson(response, 200, { folderId, verified: true })
}

async function createUploadSession(accessToken, response, user, payload) {
  const fileName = sanitizeFileName(payload.fileName)
  const extension = getFileExtension(fileName)
  const mimeType = String(payload.mimeType ?? '').toLowerCase()
  const size = Number(payload.size)
  const documentId = String(payload.documentId ?? '')
  const folderId = String(payload.folderId ?? '').trim()

  if (!isValidIdentifier(documentId)) {
    throw new ApiError(400, 'Invalid document identifier.')
  }

  if (
    !ALLOWED_EXTENSIONS.has(extension) ||
    !ALLOWED_MIME_TYPES.has(mimeType)
  ) {
    throw new ApiError(400, 'That file type is not supported.')
  }

  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_FILE_SIZE) {
    throw new ApiError(400, 'Files must be 25 MB or smaller.')
  }

  if (!isValidIdentifier(folderId)) {
    throw new ApiError(400, 'Choose a valid Google Drive folder first.')
  }

  await assertDriveFolderAccess(accessToken, user, folderId)

  const generatedIdsResponse = await driveFetch(
    accessToken,
    'https://www.googleapis.com/drive/v3/files/generateIds?count=1&space=drive&type=files',
  )

  if (!generatedIdsResponse.ok) {
    throw new ApiError(
      502,
      await getGoogleError(
        generatedIdsResponse,
        'Unable to reserve a Google Drive file identifier.',
      ),
    )
  }

  const generatedIdsPayload = await generatedIdsResponse.json()
  const fileId = generatedIdsPayload.ids?.[0]

  if (!isValidIdentifier(fileId)) {
    throw new ApiError(502, 'Google Drive did not reserve a file identifier.')
  }

  const uploadResponse = await driveFetch(
    accessToken,
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,mimeType,size,appProperties,webViewLink,webContentLink',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mimeType,
        'X-Upload-Content-Length': String(size),
      },
      body: JSON.stringify({
        id: fileId,
        name: fileName,
        parents: [folderId],
        appProperties: {
          promanUserId: user.uid,
          promanDocumentId: documentId,
        },
      }),
    },
  )

  if (!uploadResponse.ok) {
    throw new ApiError(
      502,
      await getGoogleError(
        uploadResponse,
        'Unable to create a Google Drive upload session.',
      ),
    )
  }

  const uploadUrl = uploadResponse.headers.get('location')

  if (!uploadUrl) {
    throw new ApiError(502, 'Google Drive did not return an upload session.')
  }

  sendJson(response, 200, { uploadUrl, fileId })
}

async function completeUpload(accessToken, response, user, payload) {
  const fileId = String(payload.fileId ?? '')
  const documentId = String(payload.documentId ?? '')

  if (!isValidIdentifier(fileId) || !isValidIdentifier(documentId)) {
    throw new ApiError(400, 'Invalid upload completion request.')
  }

  const file = await getDriveFile(accessToken, fileId)

  if (!file) {
    throw new ApiError(404, 'The uploaded Drive file was not found.')
  }

  assertFileOwnership(file, user, documentId)

  sendJson(response, 200, {
    fileId: file.id,
    name: file.name,
    mimeType: file.mimeType,
    size: Number(file.size) || 0,
    ...getFileLinks(file),
  })
}

async function getDriveImageChunk(accessToken, request, response, user) {
  const requestUrl = new URL(request.url, 'https://promana.local')
  const fileId = String(requestUrl.searchParams.get('fileId') ?? '')
  const offset = Number(requestUrl.searchParams.get('offset') ?? 0)

  if (
    requestUrl.searchParams.get('action') !== 'image' ||
    !isValidIdentifier(fileId) ||
    !Number.isSafeInteger(offset) ||
    offset < 0
  ) {
    throw new ApiError(400, 'Invalid Drive image request.')
  }

  const file = await getDriveFile(accessToken, fileId)

  if (!file) {
    throw new ApiError(404, 'The Drive image was not found.')
  }

  assertFileOwnership(file, user)

  const totalSize = Number(file.size)

  if (
    !String(file.mimeType ?? '').startsWith('image/') ||
    !ALLOWED_MIME_TYPES.has(file.mimeType) ||
    !Number.isSafeInteger(totalSize) ||
    totalSize <= 0 ||
    totalSize > MAX_FILE_SIZE ||
    offset >= totalSize
  ) {
    throw new ApiError(400, 'Only supported image files can be copied.')
  }

  const requestedEnd = Math.min(
    offset + IMAGE_DOWNLOAD_CHUNK_SIZE,
    totalSize,
  )
  const imageResponse = await driveFetch(
    accessToken,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    {
      headers: {
        Range: `bytes=${offset}-${requestedEnd - 1}`,
      },
    },
  )

  if (!imageResponse.ok && imageResponse.status !== 206) {
    throw new ApiError(
      502,
      await getGoogleError(imageResponse, 'Unable to read the Drive image.'),
    )
  }

  const imageChunk = Buffer.from(await imageResponse.arrayBuffer())
  const nextOffset = offset + imageChunk.length

  if (
    !imageChunk.length ||
    imageChunk.length > IMAGE_DOWNLOAD_CHUNK_SIZE ||
    nextOffset > totalSize
  ) {
    throw new ApiError(502, 'Google Drive returned an invalid image chunk.')
  }

  sendJson(response, 200, {
    chunkBase64: imageChunk.toString('base64'),
    mimeType: file.mimeType,
    nextOffset,
    totalSize,
    complete: nextOffset === totalSize,
  })
}

async function deleteDriveFile(accessToken, request, response, user) {
  const requestUrl = new URL(request.url, 'https://promana.local')
  const fileId = String(requestUrl.searchParams.get('fileId') ?? '')

  if (!isValidIdentifier(fileId)) {
    throw new ApiError(400, 'Invalid Drive file identifier.')
  }

  const file = await getDriveFile(accessToken, fileId)

  if (!file) {
    sendJson(response, 200, { deleted: true })
    return
  }

  assertFileOwnership(file, user)

  const deleteResponse = await driveFetch(
    accessToken,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`,
    { method: 'DELETE' },
  )

  if (!deleteResponse.ok && deleteResponse.status !== 404) {
    throw new ApiError(
      502,
      await getGoogleError(deleteResponse, 'Unable to delete the Drive file.'),
    )
  }

  sendJson(response, 200, { deleted: true })
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')

  try {
    const user = await verifyFirebaseUser(request)
    const accessToken = getGoogleDriveAccessToken(request)
    await verifyGoogleDriveUser(accessToken, user)

    if (request.method === 'POST') {
      const payload = await readRequestBody(request)

      if (payload.action === 'verify-folder') {
        await verifyDriveFolder(accessToken, response, user, payload)
        return
      }

      if (payload.action === 'create-upload') {
        await createUploadSession(accessToken, response, user, payload)
        return
      }

      if (payload.action === 'upload-chunk') {
        await uploadDriveChunk(response, payload)
        return
      }

      if (payload.action === 'complete-upload') {
        await completeUpload(accessToken, response, user, payload)
        return
      }

      throw new ApiError(400, 'Unknown Google Drive action.')
    }

    if (request.method === 'GET') {
      await getDriveImageChunk(accessToken, request, response, user)
      return
    }

    if (request.method === 'DELETE') {
      await deleteDriveFile(accessToken, request, response, user)
      return
    }

    response.setHeader('Allow', 'GET, POST, DELETE')
    throw new ApiError(405, 'Method not allowed.')
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500

    if (status >= 500) {
      console.error('Google Drive API error:', error)
    }

    sendJson(response, status, {
      error:
        error?.message || 'The Google Drive request could not be completed.',
    })
  }
}
