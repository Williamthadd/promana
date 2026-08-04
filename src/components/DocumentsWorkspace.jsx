import { useEffect, useMemo, useState } from 'react'
import { collection, deleteDoc, doc, setDoc, Timestamp } from 'firebase/firestore'
import {
  Cloud,
  FileArchive,
  Folder,
  FilePlus2,
  LoaderCircle,
  Save,
  Search,
  SearchX,
  ShieldCheck,
} from 'lucide-react'
import { auth, db } from '../firebase'
import {
  formatFileSize,
  getDocumentExtension,
  getDocumentKind,
  getDocumentMimeType,
} from '../constants/documentFiles'
import useDriveFolder from '../hooks/useDriveFolder'
import {
  clearGoogleDriveAccessToken,
  connectGoogleDrive,
  getGoogleDriveAccessToken,
} from '../utils/googleDriveAuth'
import DocumentCard from './DocumentCard'
import DocumentPreviewModal from './DocumentPreviewModal'
import DocumentSkeletonCard from './DocumentSkeletonCard'
import DocumentUploadModal from './DocumentUploadModal'

const DRIVE_UPLOAD_CHUNK_SIZE = 2 * 1024 * 1024

function normalizeDriveFolderId(value) {
  const input = String(value ?? '').trim()

  if (!input) {
    return ''
  }

  let candidate = input

  try {
    const folderUrl = new URL(input)

    if (folderUrl.hostname === 'drive.google.com') {
      const pathParts = folderUrl.pathname.split('/')
      const folderIndex = pathParts.indexOf('folders')
      candidate = pathParts[folderIndex + 1] || ''
    }
  } catch {
    // A raw folder ID is also accepted.
  }

  return /^[a-zA-Z0-9_-]{10,128}$/.test(candidate) ? candidate : ''
}

async function requestDriveApi(accessToken, options = {}) {
  if (!accessToken) {
    throw new Error('Connect your Google Drive account to continue.')
  }

  const idToken = await auth.currentUser?.getIdToken()

  if (!idToken) {
    throw new Error('You need to be signed in to access Google Drive.')
  }

  const driveResponse = await fetch(options.url || '/api/drive-files', {
    method: options.method || 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'X-Google-Access-Token': accessToken,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const payload = await driveResponse.json().catch(() => ({}))

  if (!driveResponse.ok) {
    const requestError = new Error(
      payload.error || 'The Google Drive request could not be completed.',
    )
    requestError.status = driveResponse.status
    throw requestError
  }

  return payload
}

function decodeBase64Chunk(value) {
  try {
    const binaryChunk = window.atob(String(value ?? ''))
    const bytes = new Uint8Array(binaryChunk.length)

    for (let index = 0; index < binaryChunk.length; index += 1) {
      bytes[index] = binaryChunk.charCodeAt(index)
    }

    return bytes
  } catch {
    throw new Error('The Drive image returned an invalid data chunk.')
  }
}

async function requestDriveImageBlob(accessToken, fileId) {
  if (!accessToken) {
    throw new Error('Reconnect Google Drive before copying an image.')
  }

  const idToken = await auth.currentUser?.getIdToken()

  if (!idToken) {
    throw new Error('You need to be signed in to copy a Drive image.')
  }

  const imageChunks = []
  let offset = 0
  let expectedSize = null
  let mimeType = ''

  while (expectedSize === null || offset < expectedSize) {
    const imageResponse = await fetch(
      `/api/drive-files?action=image&fileId=${encodeURIComponent(fileId)}&offset=${offset}`,
      {
        headers: {
          Authorization: `Bearer ${idToken}`,
          'X-Google-Access-Token': accessToken,
        },
      },
    )
    const payload = await imageResponse.json().catch(() => ({}))

    if (!imageResponse.ok) {
      const requestError = new Error(
        payload.error || 'The Drive image could not be downloaded.',
      )
      requestError.status = imageResponse.status
      throw requestError
    }

    const chunk = decodeBase64Chunk(payload.chunkBase64)
    const totalSize = Number(payload.totalSize)
    const nextOffset = Number(payload.nextOffset)

    if (
      !chunk.length ||
      !Number.isSafeInteger(totalSize) ||
      totalSize <= 0 ||
      nextOffset !== offset + chunk.length ||
      nextOffset > totalSize ||
      (expectedSize !== null && expectedSize !== totalSize)
    ) {
      throw new Error('The Drive image returned an invalid chunk sequence.')
    }

    expectedSize = totalSize
    mimeType = String(payload.mimeType ?? '')
    imageChunks.push(chunk)
    offset = nextOffset

    if (Boolean(payload.complete) !== (offset === expectedSize)) {
      throw new Error('The Drive image returned an invalid completion state.')
    }
  }

  return new Blob(imageChunks, { type: mimeType })
}

async function convertImageBlobToPng(imageBlob) {
  const objectUrl = URL.createObjectURL(imageBlob)

  try {
    const image = await new Promise((resolve, reject) => {
      const nextImage = new window.Image()
      nextImage.addEventListener('load', () => resolve(nextImage), {
        once: true,
      })
      nextImage.addEventListener(
        'error',
        () => reject(new Error('The Drive image could not be decoded.')),
        { once: true },
      )
      nextImage.src = objectUrl
    })
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('This browser cannot prepare the image for copying.')
    }

    context.drawImage(image, 0, 0)

    return await new Promise((resolve, reject) => {
      canvas.toBlob((pngBlob) => {
        if (pngBlob) {
          resolve(pngBlob)
          return
        }

        reject(new Error('The Drive image could not be converted for copying.'))
      }, 'image/png')
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function copyDriveImageToClipboard(accessToken, document) {
  const ClipboardItemConstructor = window.ClipboardItem

  if (!window.isSecureContext || !navigator.clipboard?.write || !ClipboardItemConstructor) {
    throw new Error('Image copying requires a supported browser on HTTPS or localhost.')
  }

  if (
    typeof ClipboardItemConstructor.supports === 'function' &&
    !ClipboardItemConstructor.supports('image/png')
  ) {
    throw new Error('This browser does not support copying images.')
  }

  const clipboardImage = requestDriveImageBlob(
    accessToken,
    document.driveFileId,
  ).then((imageBlob) =>
    imageBlob.type === 'image/png'
      ? imageBlob
      : convertImageBlobToPng(imageBlob),
  )

  await navigator.clipboard.write([
    new ClipboardItemConstructor({ 'image/png': clipboardImage }),
  ])
}

function readBlobAsBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.addEventListener('load', () => {
      const encodedChunk = String(reader.result ?? '').split(',')[1]

      if (!encodedChunk) {
        reject(new Error('The selected file chunk could not be encoded.'))
        return
      }

      resolve(encodedChunk)
    })
    reader.addEventListener('error', () => {
      reject(new Error('The selected file chunk could not be read.'))
    })
    reader.readAsDataURL(blob)
  })
}

async function uploadFileToDrive(uploadUrl, file, accessToken, onProgress) {
  const mimeType = getDocumentMimeType(file)
  let offset = 0

  while (offset < file.size) {
    const nextOffset = Math.min(offset + DRIVE_UPLOAD_CHUNK_SIZE, file.size)
    const chunkBase64 = await readBlobAsBase64(file.slice(offset, nextOffset))
    const uploadState = await requestDriveApi(accessToken, {
      body: {
        action: 'upload-chunk',
        uploadUrl,
        chunkBase64,
        mimeType,
        offset,
        totalSize: file.size,
      },
    })

    offset = nextOffset
    onProgress(Math.min(95, Math.round((offset / file.size) * 95)))

    if (uploadState.complete !== (offset === file.size)) {
      throw new Error('Google Drive returned an invalid upload state.')
    }
  }
}

export default function DocumentsWorkspace({
  uid,
  documents,
  loading,
  error,
  addToast,
  uploadRequest = 0,
  searchInputRef,
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [kindFilter, setKindFilter] = useState('all')
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [previewDocument, setPreviewDocument] = useState(null)
  const [deletingDocumentId, setDeletingDocumentId] = useState('')
  const [copyingDocumentId, setCopyingDocumentId] = useState('')
  const [driveAccessToken, setDriveAccessToken] = useState('')
  const [isConnectingDrive, setIsConnectingDrive] = useState(false)
  const [folderInput, setFolderInput] = useState('')
  const [isSavingFolder, setIsSavingFolder] = useState(false)
  const {
    folderId: driveFolderId,
    loading: driveFolderLoading,
    error: driveFolderError,
  } = useDriveFolder(uid)
  const normalizedFolderInput = normalizeDriveFolderId(folderInput)
  const canConnectDrive =
    Boolean(driveFolderId) && normalizedFolderInput === driveFolderId

  useEffect(() => {
    setDriveAccessToken(getGoogleDriveAccessToken(uid))
  }, [uid])

  useEffect(() => {
    if (uploadRequest <= 0 || driveFolderLoading) {
      return
    }

    if (!driveFolderId) {
      addToast('Save your Google Drive folder before uploading a file.', 'info')
      return
    }

    const storedAccessToken = getGoogleDriveAccessToken(uid)

    if (storedAccessToken && canConnectDrive) {
      setDriveAccessToken(storedAccessToken)
      setIsUploadOpen(true)
      return
    }

    addToast('Reconnect Google Drive before uploading a file.', 'info')
  }, [
    addToast,
    canConnectDrive,
    driveFolderId,
    driveFolderLoading,
    uid,
    uploadRequest,
  ])

  useEffect(() => {
    if (!driveFolderLoading) {
      setFolderInput(driveFolderId)
    }
  }, [driveFolderId, driveFolderLoading])

  useEffect(() => {
    if (!driveFolderLoading && !driveFolderId) {
      clearGoogleDriveAccessToken(uid)
      setDriveAccessToken('')
    }
  }, [driveFolderId, driveFolderLoading, uid])

  useEffect(() => {
    if (error) {
      addToast(
        'Docs sync hit an issue. Check Firestore access and refresh the page.',
        'error',
      )
    }
  }, [addToast, error])

  useEffect(() => {
    if (driveFolderError) {
      addToast('Your Google Drive folder setting could not be loaded.', 'error')
    }
  }, [addToast, driveFolderError])

  const visibleDocuments = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase()

    return documents.filter((document) => {
      const matchesKind =
        kindFilter === 'all' || document.kind === kindFilter
      const searchableText = [
        document.title,
        document.originalName,
        document.extension,
        document.mimeType,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return (
        matchesKind &&
        (!normalizedSearch || searchableText.includes(normalizedSearch))
      )
    })
  }, [documents, kindFilter, searchQuery])

  const totalSize = documents.reduce(
    (total, document) => total + (Number(document.size) || 0),
    0,
  )

  async function handleSaveDriveFolder() {
    if (!uid || auth.currentUser?.uid !== uid) {
      addToast('You need to be signed in to configure Google Drive.', 'error')
      return
    }

    if (!normalizedFolderInput) {
      addToast('Enter a valid Google Drive folder ID or folder URL.', 'error')
      return
    }

    const folderChanged = normalizedFolderInput !== driveFolderId
    setIsSavingFolder(true)

    try {
      await setDoc(
        doc(db, 'users', uid, 'settings', 'googleDrive'),
        {
          folderId: normalizedFolderInput,
          lastUpdatedAt: Timestamp.now(),
        },
        { merge: true },
      )
      setFolderInput(normalizedFolderInput)

      if (folderChanged) {
        clearGoogleDriveAccessToken(uid)
        setDriveAccessToken('')
        setIsUploadOpen(false)
        addToast('Drive folder saved. Reconnect Drive to use it.', 'success')
      } else {
        addToast('Google Drive folder is already up to date.', 'info')
      }
    } catch (folderError) {
      addToast(
        folderError?.message || 'Unable to save your Google Drive folder.',
        'error',
      )
    } finally {
      setIsSavingFolder(false)
    }
  }

  async function handleConnectDrive() {
    if (!uid || auth.currentUser?.uid !== uid) {
      addToast('You need to be signed in to connect Google Drive.', 'error')
      return
    }

    if (!canConnectDrive) {
      addToast('Save your Google Drive folder before connecting.', 'info')
      return
    }

    setIsConnectingDrive(true)
    let connectedAccessToken = ''

    try {
      connectedAccessToken = await connectGoogleDrive(auth.currentUser)
      await requestDriveApi(connectedAccessToken, {
        body: {
          action: 'verify-folder',
          folderId: driveFolderId,
        },
      })
      setDriveAccessToken(connectedAccessToken)
      addToast(
        `Google Drive connected to your selected folder as ${auth.currentUser.email}.`,
        'success',
      )
    } catch (connectionError) {
      if (connectedAccessToken) {
        clearGoogleDriveAccessToken(uid)
        setDriveAccessToken('')
      }

      const message =
        connectionError?.code === 'auth/popup-closed-by-user'
          ? 'Google Drive connection was closed before it finished.'
          : connectionError?.code === 'auth/user-mismatch'
            ? 'Choose the same Google account used to sign in to ProMana.'
            : connectionError?.message ||
              'Unable to connect Google Drive right now.'

      addToast(message, 'error')
    } finally {
      setIsConnectingDrive(false)
    }
  }

  async function handleUpload({ file, title }) {
    if (!uid || auth.currentUser?.uid !== uid) {
      addToast('You need to be signed in to upload files.', 'error')
      return false
    }

    if (!driveFolderId || !canConnectDrive) {
      addToast('Save and reconnect your Google Drive folder first.', 'error')
      return false
    }

    if (!driveAccessToken) {
      addToast('Connect Google Drive before uploading a file.', 'error')
      return false
    }

    const accessToken = driveAccessToken

    setIsUploading(true)
    setUploadProgress(0)

    const metadataRef = doc(collection(db, 'users', uid, 'documents'))
    const extension = getDocumentExtension(file.name)
    let driveFileId = ''

    try {
      const session = await requestDriveApi(accessToken, {
        body: {
          action: 'create-upload',
          documentId: metadataRef.id,
          fileName: file.name,
          mimeType: getDocumentMimeType(file),
          size: file.size,
          folderId: driveFolderId,
        },
      })
      driveFileId = session.fileId

      await uploadFileToDrive(
        session.uploadUrl,
        file,
        accessToken,
        setUploadProgress,
      )
      setUploadProgress(96)

      const driveFile = await requestDriveApi(accessToken, {
        body: {
          action: 'complete-upload',
          documentId: metadataRef.id,
          fileId: driveFileId,
        },
      })
      const timestamp = Timestamp.now()

      await setDoc(metadataRef, {
        title,
        originalName: file.name,
        provider: 'google-drive',
        driveFileId,
        webViewLink: driveFile.webViewLink,
        previewUrl: driveFile.previewUrl,
        downloadUrl: driveFile.downloadUrl,
        thumbnailUrl: driveFile.thumbnailUrl,
        extension,
        mimeType: getDocumentMimeType(file),
        kind: getDocumentKind(extension),
        size: driveFile.size || file.size,
        createdAt: timestamp,
        lastUpdatedAt: timestamp,
      })

      setUploadProgress(100)
      addToast(`${title} saved to Google Drive.`, 'success')
      return true
    } catch (uploadError) {
      if (uploadError?.status === 401) {
        clearGoogleDriveAccessToken(uid)
        setDriveAccessToken('')
      }

      if (driveFileId) {
        try {
          await requestDriveApi(accessToken, {
            method: 'DELETE',
            url: `/api/drive-files?fileId=${encodeURIComponent(driveFileId)}`,
          })
        } catch {
          // Best-effort cleanup if Firestore metadata cannot be saved.
        }
      }

      addToast(
        uploadError?.message || 'Unable to upload that file to Google Drive.',
        'error',
      )
      return false
    } finally {
      setIsUploading(false)
    }
  }

  async function handleCopyImage(document) {
    if (!uid || auth.currentUser?.uid !== uid) {
      addToast('You need to be signed in to copy images.', 'error')
      return
    }

    if (document.kind !== 'image' || !document.driveFileId) {
      addToast('This image is not available for clipboard copying.', 'error')
      return
    }

    if (!driveAccessToken) {
      addToast('Reconnect Google Drive before copying this image.', 'error')
      return
    }

    setCopyingDocumentId(document.id)

    try {
      await copyDriveImageToClipboard(driveAccessToken, document)
      addToast(
        `${document.title || document.originalName} copied to the clipboard.`,
        'success',
      )
    } catch (copyError) {
      if (copyError?.status === 401) {
        clearGoogleDriveAccessToken(uid)
        setDriveAccessToken('')
      }

      addToast(
        copyError?.name === 'NotAllowedError'
          ? 'Allow clipboard access in your browser and try again.'
          : copyError?.message || 'Unable to copy this image.',
        'error',
      )
    } finally {
      setCopyingDocumentId('')
    }
  }

  async function handleDelete(document) {
    if (!uid || auth.currentUser?.uid !== uid) {
      addToast('You need to be signed in to remove files.', 'error')
      return
    }

    if (!driveAccessToken) {
      addToast('Reconnect Google Drive before removing this file.', 'error')
      return
    }

    const accessToken = driveAccessToken
    setDeletingDocumentId(document.id)

    try {
      if (document.driveFileId) {
        await requestDriveApi(accessToken, {
          method: 'DELETE',
          url: `/api/drive-files?fileId=${encodeURIComponent(document.driveFileId)}`,
        })
      }

      await deleteDoc(doc(db, 'users', uid, 'documents', document.id))
      addToast(`${document.title || document.originalName} removed.`, 'success')
    } catch (deleteError) {
      if (deleteError?.status === 401) {
        clearGoogleDriveAccessToken(uid)
        setDriveAccessToken('')
      }

      addToast(
        deleteError?.message || 'Unable to remove that Drive file right now.',
        'error',
      )
    } finally {
      setDeletingDocumentId('')
    }
  }

  return (
    <div className="grid gap-5">
      <section className="overflow-hidden rounded-3xl border border-white/50 shadow-md glass-panel-light dark:border-white/10 dark:glass-panel-dark">
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
              File library
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white">
              Documents and captured ideas
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
              Keep office files, spreadsheets, PDFs, and screenshots close to
              the notes that support your work.
            </p>
            <div
              className={
                driveFolderId
                  ? 'mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200'
                  : 'mt-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-200'
              }
            >
              {driveFolderId ? (
                <ShieldCheck className="h-4 w-4" />
              ) : (
                <Cloud className="h-4 w-4" />
              )}
              <span>
                {driveFolderId
                  ? `Google Drive connected as ${auth.currentUser?.email}`
                  : 'Add your Google Drive folder below to get started.'}
              </span>
            </div>
            <div className="mt-4 max-w-2xl">
              <label
                htmlFor="google-drive-folder"
                className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400"
              >
                Google Drive folder ID
              </label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <Folder className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
                  <input
                    id="google-drive-folder"
                    type="text"
                    value={folderInput}
                    disabled={driveFolderLoading || isSavingFolder}
                    onChange={(event) => setFolderInput(event.target.value)}
                    placeholder="Folder ID or https://drive.google.com/drive/folders/..."
                    className="w-full rounded-2xl border border-white/70 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:cursor-wait disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-500/20"
                  />
                </div>
                <button
                  type="button"
                  disabled={
                    driveFolderLoading ||
                    isSavingFolder ||
                    !normalizedFolderInput
                  }
                  onClick={handleSaveDriveFolder}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200"
                >
                  {isSavingFolder ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {isSavingFolder ? 'Saving...' : 'Save folder'}
                </button>
              </div>
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                Changing this folder disconnects Drive and requires you to connect again.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={
                isConnectingDrive ||
                driveFolderLoading ||
                !canConnectDrive
              }
              onClick={handleConnectDrive}
              title={canConnectDrive ? undefined : 'Save a Drive folder first'}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-100 disabled:cursor-wait disabled:opacity-60 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200"
            >
              {isConnectingDrive ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : driveFolderId ? (
                <ShieldCheck className="h-4 w-4" />
              ) : (
                <Cloud className="h-4 w-4" />
              )}
              {isConnectingDrive
                ? 'Connecting...'
                : driveFolderId
                  ? 'Reconnect Drive'
                  : 'Connect Drive'}
            </button>
            <button
              type="button"
              disabled={!driveAccessToken || !driveFolderId}
              onClick={() => setIsUploadOpen(true)}
              title={
                driveAccessToken && driveFolderId
                  ? undefined
                  : 'Configure and connect Google Drive first'
              }
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/20 transition hover:scale-[1.02] hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
            >
              <FilePlus2 className="h-4 w-4" />
              Add file
            </button>
          </div>
        </div>

        <div className="grid gap-3 border-t border-white/30 bg-white/30 p-5 dark:border-white/5 dark:bg-white/[0.02] md:grid-cols-[1fr_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search files by title, name, or format..."
              className="w-full rounded-2xl border border-white/70 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-500/20"
            />
          </label>
          <div className="grid grid-cols-3 rounded-2xl border border-white/70 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            {[
              ['all', 'All'],
              ['document', 'Docs'],
              ['image', 'Images'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setKindFilter(value)}
                className={
                  kindFilter === value
                    ? 'rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm'
                    : 'rounded-xl px-4 py-2 text-xs font-bold text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {!loading && documents.length ? (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm font-medium text-slate-500 dark:text-slate-400">
          <p>
            {visibleDocuments.length} of {documents.length} file
            {documents.length === 1 ? '' : 's'} shown
          </p>
          <p>{formatFileSize(totalSize)} stored</p>
        </div>
      ) : null}

      {loading ? (
        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <DocumentSkeletonCard key={`document-skeleton-${index}`} />
          ))}
        </section>
      ) : null}

      {!loading && !documents.length ? (
        <section className="rounded-3xl border border-dashed border-blue-200 bg-white/70 p-10 text-center shadow-sm backdrop-blur dark:border-blue-500/20 dark:bg-slate-900/70">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-[2rem] bg-gradient-to-br from-blue-600 to-cyan-400 text-white shadow-xl shadow-blue-500/20">
            <FileArchive className="h-9 w-9" />
          </div>
          <h2 className="mt-5 text-2xl font-black text-slate-950 dark:text-white">
            Your file shelf is ready
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600 dark:text-slate-300">
            Add a PDF, office document, spreadsheet, image, or paste your first
            screenshot directly from the clipboard.
          </p>
          <button
            disabled={!driveAccessToken}
            type="button"
            onClick={() => setIsUploadOpen(true)}
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FilePlus2 className="h-4 w-4" />
            {driveAccessToken ? 'Add your first file' : 'Connect Drive above first'}
          </button>
        </section>
      ) : null}

      {!loading && documents.length > 0 && !visibleDocuments.length ? (
        <section className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-10 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
          <SearchX className="mx-auto h-10 w-10 text-slate-400" />
          <p className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
            No files match this search.
          </p>
        </section>
      ) : null}

      {!loading && visibleDocuments.length ? (
        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visibleDocuments.map((document) => (
            <DocumentCard
              key={document.id}
              document={document}
              onPreview={setPreviewDocument}
              onCopyImage={handleCopyImage}
              onDelete={handleDelete}
              isCopying={copyingDocumentId === document.id}
              isDeleting={deletingDocumentId === document.id}
            />
          ))}
        </section>
      ) : null}

      <DocumentUploadModal
        open={isUploadOpen}
        onClose={() => {
          if (!isUploading) {
            setIsUploadOpen(false)
          }
        }}
        onUpload={handleUpload}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
      />

      <DocumentPreviewModal
        open={Boolean(previewDocument)}
        document={previewDocument}
        onClose={() => setPreviewDocument(null)}
      />
    </div>
  )
}
