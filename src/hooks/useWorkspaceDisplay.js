import { useEffect, useState } from 'react'
import {
  WORKSPACE_DISPLAY_STORAGE_KEY,
  getStoredWorkspaceDisplay,
  normalizeWorkspaceDisplay,
} from '../utils/workspaceDisplay'

// Local-only preference for the four card workspaces (Projects, Launchpad,
// Notes, Tasks). Follows the same lazy-init-from-localStorage + persist-on-
// change pattern as the light-background hook.
export default function useWorkspaceDisplay() {
  const [display, setDisplay] = useState(() => getStoredWorkspaceDisplay())

  useEffect(() => {
    try {
      window.localStorage.setItem(
        WORKSPACE_DISPLAY_STORAGE_KEY,
        JSON.stringify(display),
      )
    } catch {
      // Preference storage is optional; a blocked quota must not break the UI.
    }
  }, [display])

  function setBoxSize(boxSize) {
    setDisplay((current) => normalizeWorkspaceDisplay({ ...current, boxSize }))
  }

  function setTextSize(textSize) {
    setDisplay((current) =>
      normalizeWorkspaceDisplay({ ...current, textSize }),
    )
  }

  function resetWorkspaceDisplay() {
    setDisplay(normalizeWorkspaceDisplay(null))
  }

  return {
    boxSize: display.boxSize,
    textSize: display.textSize,
    setBoxSize,
    setTextSize,
    resetWorkspaceDisplay,
  }
}
