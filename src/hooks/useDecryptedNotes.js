import { useEffect, useState } from 'react'
import { normalizeNoteVisibility } from '../constants/noteOptions'
import {
  decryptNoteContent,
  getNoteKey,
  isEncryptedNoteContent,
} from '../utils/noteEncryption'

// Resolves hidden-note ciphertext into in-memory plaintext for display.
// Returns the same notes with `content` decrypted plus a `contentLocked`
// flag. Locked notes (no key on this device, undecryptable payload) keep
// `content: ''` so ciphertext is never rendered, copied, or sent to AI.
//
// Legacy hidden notes stored as plaintext pass through unlocked and are
// encrypted on their next save. Non-hidden notes pass through untouched.
export default function useDecryptedNotes(uid, notes) {
  const [decryptedNotes, setDecryptedNotes] = useState(notes)

  useEffect(() => {
    let cancelled = false

    async function resolveNotes() {
      if (!uid) {
        if (!cancelled) {
          setDecryptedNotes([])
        }
        return
      }

      const key = await getNoteKey(uid).catch(() => null)
      const resolved = []

      for (const note of notes) {
        const isHidden =
          normalizeNoteVisibility(note.visibility) === 'hidden'
        const isEncrypted = isEncryptedNoteContent(note.content)

        if (!isHidden || !isEncrypted) {
          resolved.push({ ...note, contentLocked: false })
          continue
        }

        if (!key) {
          resolved.push({ ...note, content: '', contentLocked: true })
          continue
        }

        try {
          const plaintext = await decryptNoteContent(note.content, key)
          resolved.push({ ...note, content: plaintext, contentLocked: false })
        } catch {
          resolved.push({ ...note, content: '', contentLocked: true })
        }
      }

      if (!cancelled) {
        setDecryptedNotes(resolved)
      }
    }

    void resolveNotes()

    return () => {
      cancelled = true
    }
  }, [uid, notes])

  return decryptedNotes
}
