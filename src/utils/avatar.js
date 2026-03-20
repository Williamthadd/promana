import md5 from 'blueimp-md5'

function normalizeEmail(email) {
  return (email ?? '').trim().toLowerCase()
}

export function getUserAvatarCandidates(user) {
  const providerPhotoUrls = (user?.providerData ?? [])
    .map((providerProfile) => providerProfile.photoURL)
    .filter(Boolean)

  const normalizedEmail = normalizeEmail(user?.email)
  const gravatarUrl = normalizedEmail
    ? `https://www.gravatar.com/avatar/${md5(normalizedEmail)}?d=404&s=160`
    : null

  return Array.from(
    new Set([user?.photoURL, ...providerPhotoUrls, gravatarUrl].filter(Boolean)),
  )
}
