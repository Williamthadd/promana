// Workspace size preference regression tests (offline, node:test).

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_WORKSPACE_BOX_SIZE,
  DEFAULT_WORKSPACE_TEXT_SIZE,
  getStoredWorkspaceDisplay,
  getWorkspaceGridStyle,
  getWorkspaceSizeLabel,
  getWorkspaceTextStyle,
  normalizeWorkspaceDisplay,
  normalizeWorkspaceSize,
} from '../src/utils/workspaceDisplay.js'

test('workspace size values are clamped, rounded, and defaulted', () => {
  assert.equal(normalizeWorkspaceSize(0, 3), 1)
  assert.equal(normalizeWorkspaceSize(9, 3), 5)
  assert.equal(normalizeWorkspaceSize('4', 3), 4)
  assert.equal(normalizeWorkspaceSize(2.6, 3), 3)
  assert.equal(normalizeWorkspaceSize('nope', 3), 3)
  assert.equal(normalizeWorkspaceSize(undefined, 3), 3)
})

test('workspace display normalizes partially stored values', () => {
  assert.deepEqual(normalizeWorkspaceDisplay(null), {
    boxSize: DEFAULT_WORKSPACE_BOX_SIZE,
    textSize: DEFAULT_WORKSPACE_TEXT_SIZE,
  })
  assert.deepEqual(normalizeWorkspaceDisplay({ boxSize: 1 }), {
    boxSize: 1,
    textSize: DEFAULT_WORKSPACE_TEXT_SIZE,
  })
  assert.deepEqual(normalizeWorkspaceDisplay({ boxSize: 99, textSize: -4 }), {
    boxSize: 5,
    textSize: 1,
  })
})

test('size labels describe each level', () => {
  assert.equal(getWorkspaceSizeLabel(1), 'Tiny')
  assert.equal(getWorkspaceSizeLabel(DEFAULT_WORKSPACE_BOX_SIZE), 'Default')
  assert.equal(getWorkspaceSizeLabel(5), 'Extra large')
})

test('a larger box size requests a wider minimum card width', () => {
  const small = getWorkspaceGridStyle(1).gridTemplateColumns
  const medium = getWorkspaceGridStyle(3).gridTemplateColumns
  const large = getWorkspaceGridStyle(5).gridTemplateColumns

  const readRem = (value) => Number(value.match(/([\d.]+)rem/)[1])

  assert.ok(readRem(small) < readRem(medium))
  assert.ok(readRem(medium) < readRem(large))
  // Single column on very narrow screens instead of overflowing.
  assert.match(medium, /min\(100%,/)
  assert.match(medium, /repeat\(auto-fill, minmax\(/)
})

test('task boxes start wider than standard cards at the same level', () => {
  const readRem = (value) => Number(value.match(/([\d.]+)rem/)[1])
  const standard = getWorkspaceGridStyle(3, 'standard').gridTemplateColumns
  const tasks = getWorkspaceGridStyle(3, 'tasks').gridTemplateColumns

  assert.ok(readRem(tasks) > readRem(standard))
})

test('text size scales every Tailwind text tier together', () => {
  const base = getWorkspaceTextStyle(3)
  const bigger = getWorkspaceTextStyle(5)
  const smaller = getWorkspaceTextStyle(1)

  // Default level must match Tailwind's stock sizes exactly.
  assert.equal(base['--text-sm'], '0.875rem')
  assert.equal(base['--text-xl'], '1.25rem')

  for (const variable of Object.keys(base)) {
    const rem = (value) => Number(value.replace('rem', ''))
    assert.ok(rem(bigger[variable]) > rem(base[variable]), variable)
    assert.ok(rem(smaller[variable]) < rem(base[variable]), variable)
  }
})

test('stored display falls back to defaults without localStorage', () => {
  assert.deepEqual(getStoredWorkspaceDisplay(), {
    boxSize: DEFAULT_WORKSPACE_BOX_SIZE,
    textSize: DEFAULT_WORKSPACE_TEXT_SIZE,
  })
})
