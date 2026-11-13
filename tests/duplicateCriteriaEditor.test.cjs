const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function transpile(file, dependencies = {}) {
  const context = { exports: {}, structuredClone, require: (name) => dependencies[name] ?? {} }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context)
  return context.exports
}

const logic = transpile('lib/inquiryDuplicates.ts')
const aviationTemplate = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/duplicate-inquiry/aviation.json'), 'utf8'))
const editor = transpile('lib/duplicateCriteriaEditor.ts', {
  './inquiryDuplicates': logic,
  '../../config/duplicate-inquiry/aviation.json': { default: aviationTemplate },
})

test('Aviation starting rule converts to valid JSON without editing the shared preset', () => {
  const draft = editor.createAviationCriteria()
  draft.identifiers.groups[0].label = 'Tail registration'
  const saved = editor.serializeDuplicateCriteria(draft)
  assert.equal(logic.parseDuplicateCriteria(saved).state, 'ready')
  assert.equal(JSON.parse(saved).identifiers.groups[0].label, 'Tail registration')
  assert.equal(aviationTemplate.identifiers.groups[0].label, 'Aircraft registration')
})

test('custom rule cannot be saved until its field mappings are complete', () => {
  const draft = editor.createBlankCriteria()
  assert.throws(() => editor.serializeDuplicateCriteria(draft), /Complete each identifier source/)
  draft.identifiers.groups[0].sources = ['response:Vehicle VIN']
  draft.period.renewalSources = ['response:Renewal Date']
  assert.equal(logic.parseDuplicateCriteria(editor.serializeDuplicateCriteria(draft)).state, 'ready')
})
