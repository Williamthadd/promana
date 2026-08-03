import {
  GoogleAuthProvider,
  reauthenticateWithPopup,
} from 'firebase/auth'

export const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive'

const TOKEN_STORAGE_PREFIX = 'promana-google-drive-token'

function getTokenStorageKey(uid) {
  return `${TOKEN_STORAGE_PREFIX}:${uid}`
}

export function getGoogleDriveAccessToken(uid) {
  if (!uid || typeof window === 'undefined') {
    return ''
  }

  try {
    return window.sessionStorage.getItem(getTokenStorageKey(uid)) ?? ''
  } catch {
    return ''
  }
}

export function saveGoogleDriveAccessToken(uid, accessToken) {
  if (!uid || !accessToken || typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.setItem(getTokenStorageKey(uid), accessToken)
  } catch {
    // The current tab can still use the in-memory token if storage is blocked.
  }
}

export function clearGoogleDriveAccessToken(uid) {
  if (!uid || typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.removeItem(getTokenStorageKey(uid))
  } catch {
    // Ignore storage restrictions during logout or token renewal.
  }
}

export function createGoogleDriveProvider(parameters = {}) {
  const provider = new GoogleAuthProvider()
  provider.addScope(GOOGLE_DRIVE_SCOPE)
  provider.setCustomParameters(parameters)
  return provider
}

export async function connectGoogleDrive(user) {
  if (!user) {
    throw new Error('Sign in with Google before connecting Google Drive.')
  }

  const usesGoogleLogin = user.providerData?.some(
    (provider) => provider.providerId === GoogleAuthProvider.PROVIDER_ID,
  )

  if (!usesGoogleLogin) {
    throw new Error(
      'This feature requires the same Google account used to sign in to ProMana.',
    )
  }

  const provider = createGoogleDriveProvider({
    prompt: 'select_account consent',
    login_hint: user.email ?? '',
  })
  const result = await reauthenticateWithPopup(user, provider)
  const credential = GoogleAuthProvider.credentialFromResult(result)
  const accessToken = credential?.accessToken ?? ''

  if (!accessToken) {
    throw new Error('Google Drive did not return an access token.')
  }

  saveGoogleDriveAccessToken(user.uid, accessToken)
  return accessToken
}
