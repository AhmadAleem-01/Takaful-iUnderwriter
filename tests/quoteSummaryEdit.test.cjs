const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function load(file, dependencies = {}) {
  const context = { exports: {}, require: (name) => dependencies[name] ?? {} }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context)
  return context.exports
}

const summary = load('lib/quoteSummaryEdit.ts', {
  './aiResponsePresentation': load('lib/aiResponsePresentation.ts'),
})

test('shows readable AI summary text and retains metadata on save', () => {
  const stored = JSON.stringify({ summary: 'Original summary', facts_used: ['Fleet schedule'], conflicts: ['Different dates'] })
  assert.equal(summary.quoteSummaryText(stored), 'Original summary')
  assert.equal(summary.saveQuoteSummaryText(stored, 'Original summary'), stored)
  const edited = JSON.parse(summary.saveQuoteSummaryText(stored, 'Revised summary'))
  assert.equal(edited.summary, 'Revised summary')
  assert.deepEqual(edited.facts_used, ['Fleet schedule'])
  assert.deepEqual(edited.conflicts, ['Different dates'])
})

test('plain-text summaries remain plain text', () => {
  assert.equal(summary.quoteSummaryText('Plain summary'), 'Plain summary')
  assert.equal(summary.saveQuoteSummaryText('Plain summary', 'Updated summary'), 'Updated summary')
})
