const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const source = fs.readFileSync(path.join(__dirname, '../src/lib/businessRuleSearch.ts'), 'utf8')
const context = { exports: {} }
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context)
const { searchBusinessRules } = context.exports

const rules = [
  { id: '1', name: 'Type of coverage: Following covers are excluded if these are shown as' },
  { id: '2', name: 'Fleet Schedule (Reg No, Pass/Crew Seat, Attachment date, Status)' },
  { id: '3', name: 'Aircraft Registration' },
  { id: '4', name: 'Policy Period' },
]

test('searches words anywhere in long business rule names', () => {
  assert.deepEqual(searchBusinessRules(rules, 'reg no').map((rule) => rule.id), ['2'])
  assert.deepEqual(searchBusinessRules(rules, 'coverage excluded').map((rule) => rule.id), ['1'])
  assert.deepEqual(searchBusinessRules(rules, 'period').map((rule) => rule.id), ['4'])
})

test('starts empty, ranks exact names first, and limits long result lists', () => {
  assert.equal(searchBusinessRules(rules, '').length, 0)
  assert.deepEqual(searchBusinessRules(rules, 'aircraft registration').map((rule) => rule.id), ['3'])
  assert.equal(searchBusinessRules(rules, 'a', 1).length, 1)
})
