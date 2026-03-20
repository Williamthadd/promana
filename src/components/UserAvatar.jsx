import { useState } from 'react'
import { UserRound } from 'lucide-react'
import { getUserAvatarCandidates } from '../utils/avatar'

export default function UserAvatar({
  user,
  imageClassName,
  fallbackClassName,
  iconClassName,
}) {
  const avatarCandidates = getUserAvatarCandidates(user)
  const candidateKey = avatarCandidates.join('|')
  const [avatarState, setAvatarState] = useState({
    key: '',
    failedUrls: [],
  })
  const failedUrls =
    avatarState.key === candidateKey ? avatarState.failedUrls : []
  const avatarUrl =
    avatarCandidates.find((candidateUrl) => !failedUrls.includes(candidateUrl)) ??
    null

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={user?.email ?? 'User avatar'}
        className={imageClassName}
        onError={() => {
          setAvatarState((currentState) => {
            const nextFailedUrls =
              currentState.key === candidateKey ? currentState.failedUrls : []

            return {
              key: candidateKey,
              failedUrls: Array.from(new Set([...nextFailedUrls, avatarUrl])),
            }
          })
        }}
      />
    )
  }

  return (
    <span className={fallbackClassName}>
      <UserRound className={iconClassName} />
    </span>
  )
}
