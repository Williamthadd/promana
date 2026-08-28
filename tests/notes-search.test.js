import assert from 'node:assert/strict'
import test from 'node:test'
import { noteTitleMatchesSearch } from '../src/utils/noteSearch.js'

const note = {
  title: 'Firebase deployment checklist',
  content: 'Private production token rotation details',
  type: 'reference',
  tags: ['security', 'production'],
}

test('notes search matches note titles case-insensitively', () => {
  assert.equal(noteTitleMatchesSearch(note, 'firebase'), true)
  assert.equal(noteTitleMatchesSearch(note, '  DEPLOYMENT  '), true)
})

test('notes search does not match content, type, or tags', () => {
  assert.equal(noteTitleMatchesSearch(note, 'token rotation'), false)
  assert.equal(noteTitleMatchesSearch(note, 'reference'), false)
  assert.equal(noteTitleMatchesSearch(note, 'security'), false)
})

test('an empty query keeps all notes visible', () => {
  assert.equal(noteTitleMatchesSearch(note, ''), true)
  assert.equal(noteTitleMatchesSearch(note, '   '), true)
  assert.equal(noteTitleMatchesSearch(null, ''), true)
})
