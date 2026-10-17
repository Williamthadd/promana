// User preference for the visual density of the Projects, Launchpad, Notes and
// Tasks workspaces. Two independent sliders drive it:
//  - Box size: how much horizontal room each card gets, which in turn decides
//    how many cards fit per row.
//  - Text size: the text scale of everything inside those workspaces.
//
// Nothing here touches Firestore; the preference is a purely local UI setting
// stored in localStorage, mirroring the light-background preference.

export const WORKSPACE_DISPLAY_STORAGE_KEY = 'proman-workspace-display'

export const WORKSPACE_SIZE_MIN = 1
export const WORKSPACE_SIZE_MAX = 5

export const DEFAULT_WORKSPACE_BOX_SIZE = 3
export const DEFAULT_WORKSPACE_TEXT_SIZE = 3

// Minimum card width (in rem) for each box-size level. A smaller minimum packs
// more cards per row; a larger minimum shows fewer, bigger cards. The CSS
// `auto-fill` grid uses these so the count also adapts to the viewport.
const BOX_MIN_WIDTH_REM = {
  standard: [12, 15, 18, 23, 30],
  tasks: [20, 24, 29, 35, 46],
}

// Font-size multipliers for each text-size level, applied to the Tailwind v4
// `--text-*` theme variables. Tailwind's font-size utilities read these
// variables (`font-size: var(--text-sm)`), so overriding them on the workspace
// container scales every piece of text inside it. Tailwind's line-height
// variables are unitless ratios, so they scale along automatically.
const TEXT_MULTIPLIERS = [0.85, 0.95, 1, 1.15, 1.3]
const TEXT_SIZE_BASE_REM = {
  '--text-xs': 0.75,
  '--text-sm': 0.875,
  '--text-base': 1,
  '--text-lg': 1.125,
  '--text-xl': 1.25,
  '--text-2xl': 1.5,
  '--text-3xl': 1.875,
}

export const WORKSPACE_SIZE_LABELS = [
  'Tiny',
  'Small',
  'Default',
  'Large',
  'Extra large',
]

export function normalizeWorkspaceSize(value, fallback) {
  const numeric = Math.round(Number(value))

  if (!Number.isFinite(numeric)) {
    return fallback
  }

  return Math.min(WORKSPACE_SIZE_MAX, Math.max(WORKSPACE_SIZE_MIN, numeric))
}

export function normalizeWorkspaceDisplay(value) {
  const source = value && typeof value === 'object' ? value : {}

  return {
    boxSize: normalizeWorkspaceSize(source.boxSize, DEFAULT_WORKSPACE_BOX_SIZE),
    textSize: normalizeWorkspaceSize(
      source.textSize,
      DEFAULT_WORKSPACE_TEXT_SIZE,
    ),
  }
}

export function getStoredWorkspaceDisplay() {
  if (typeof window === 'undefined') {
    return normalizeWorkspaceDisplay(null)
  }

  try {
    const stored = window.localStorage.getItem(WORKSPACE_DISPLAY_STORAGE_KEY)
    return normalizeWorkspaceDisplay(stored ? JSON.parse(stored) : null)
  } catch {
    return normalizeWorkspaceDisplay(null)
  }
}

export function getWorkspaceSizeLabel(size) {
  const index = normalizeWorkspaceSize(size, DEFAULT_WORKSPACE_BOX_SIZE) - 1
  return WORKSPACE_SIZE_LABELS[index]
}

// Inline style with the overridden Tailwind text-size variables. Spread this on
// the workspace container so every descendant `text-*` utility scales.
export function getWorkspaceTextStyle(textSize) {
  const multiplier =
    TEXT_MULTIPLIERS[
      normalizeWorkspaceSize(textSize, DEFAULT_WORKSPACE_TEXT_SIZE) - 1
    ]

  const style = {}

  for (const [variable, base] of Object.entries(TEXT_SIZE_BASE_REM)) {
    style[variable] = `${Number((base * multiplier).toFixed(4))}rem`
  }

  return style
}

// Inline grid style that turns the fixed `grid-cols-*` classes into a
// size-aware, responsive auto-fill track. `min(100%, Nrem)` keeps a single
// column on very narrow screens instead of overflowing.
export function getWorkspaceGridStyle(boxSize, variant = 'standard') {
  const widths = variant === 'tasks' ? BOX_MIN_WIDTH_REM.tasks : BOX_MIN_WIDTH_REM.standard
  const minWidthRem =
    widths[normalizeWorkspaceSize(boxSize, DEFAULT_WORKSPACE_BOX_SIZE) - 1]

  return {
    gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${minWidthRem}rem), 1fr))`,
  }
}
