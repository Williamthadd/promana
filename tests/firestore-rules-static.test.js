// Static Firestore rules regression tests.
//
// These run without the Firebase Local Emulator Suite (no Java/project
// needed) and guard the rule file against dangerous regressions: blanket
// allows, client-writable quotas, append-only log tampering, and missing
// per-UID isolation. Live emulator tests for authenticated user A vs user B
// are specified in SECURITY_TEST_PLAN.md and must be run before changing
// firestore.rules.

import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = fs.readFileSync(path.join(projectRoot, 'firestore.rules'), 'utf8')

test('rules deny by default with no recursive blanket allow', () => {
  assert.doesNotMatch(rules, /\{\s*document\s*=\s*\*\*\s*\}[\s\S]*?allow read, write:\s*if request\.auth/)
  assert.match(rules, /allow read, write:\s*if false/)
  assert.match(rules, /rules_version = '2'/)
})

test('every collection requires the authenticated owner UID', () => {
  assert.match(rules, /request\.auth\.uid == userId/)
  for (const collection of [
    'projects', 'launchpad', 'notes', 'taskGroups',
    'calendarEntries', 'documents', 'loginLogs',
  ]) {
    assert.ok(rules.includes(`/users/{userId}/${collection}/`), `missing ${collection}`)
  }
  for (const doc of ['settings/googleDrive', 'settings/editors', 'settings/limits', 'usage/aiDaily']) {
    assert.ok(rules.includes(`/users/{userId}/${doc}`), `missing ${doc}`)
  }
})

test('plan limits are read-only from clients (no self-granted pro)', () => {
  const block = rules.slice(rules.indexOf('settings/limits'))
  assert.match(block.slice(0, 600), /allow get:\s*if isOwner\(userId\)/)
  assert.match(block.slice(0, 600), /allow list, create, update, delete:\s*if false/)
})

test('login logs are append-only', () => {
  const block = rules.slice(rules.indexOf('loginLogs'))
  assert.match(block.slice(0, 1200), /allow update, delete:\s*if false/)
  assert.match(block.slice(0, 1200), /allow create:\s*if isOwner\(userId\)/)
})

test('AI usage documents are schema-locked', () => {
  const block = rules.slice(rules.indexOf('usage/aiDaily'))
  assert.ok(block.slice(0, 2000).includes('dateKey'), 'dateKey validated')
  assert.ok(block.slice(0, 2000).includes('hasOnly'), 'unknown fields rejected')
})

test('security-sensitive identifiers are pattern-validated', () => {
  assert.ok(rules.includes('^[A-Za-z0-9_-]{10,128}$'), 'Drive IDs validated')
})

test('document metadata is restricted to the inert allowlist', () => {
  for (const mime of ['application/pdf', 'image/png', 'text/csv']) {
    assert.ok(rules.includes(mime), `missing ${mime}`)
  }
  assert.ok(!rules.includes('svg'), 'SVG must stay out of the allowlist')
  assert.ok(!rules.includes('text/html'), 'HTML must stay out of the allowlist')
})

test('field sizes are bounded', () => {
  assert.ok(rules.includes('26214400'), 'document size cap present')
})

test('note content is uncapped', () => {
  const block = rules.slice(rules.indexOf('function validNote'))
  assert.ok(!block.slice(0, 1200).includes('200000'), 'note content cap removed')
  assert.ok(block.includes("size() > 0"), 'note content still requires non-empty string on create')
})
