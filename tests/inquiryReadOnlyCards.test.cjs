const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { JSDOM } = require('jsdom')
function load(file, dependencies = {}) {
  const context = { exports: {}, require: (name) => Object.hasOwn(dependencies, name) ? dependencies[name] : name.startsWith('.') ? {} : require(name) }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, context)
  return context.exports
}
const card = load('components/inquiries/ReadOnlyValueCard.tsx')
const underwriting = load('lib/inquiryUnderwriting.ts')
const { InquiryDecisionRail } = load('components/inquiries/InquiryWorkspacePanels.tsx', {
  './ReadOnlyValueCard': card,
  './InquiryCompletenessCard': { InquiryCompletenessCard: () => null },
  '../../lib/inquiryUnderwriting': underwriting,
  '../ui/Select': { Select: ({ value, options, onValueChange, ...props }) => React.createElement('select', { ...props, value, onChange: onValueChange }, options.map((item) => React.createElement('option', { key: item.value, value: item.value }, item.label))) },
})
function render(props = {}) {
  return new JSDOM(renderToStaticMarkup(React.createElement(InquiryDecisionRail, {
    inquiry: {}, action: '2', subAction: '4', editing: false, busy: false, onAction() {}, onSubAction() {}, ...props,
  }))).window.document
}
test('view mode shows underwriting labels as cards without disabled controls', () => {
  const document = render()
  assert.equal(document.querySelectorAll('input, select, [role="combobox"]').length, 0)
  assert.match(document.body.textContent, /Lost/)
  assert.match(document.body.textContent, /Lost to Competitor - High Premium/)
  assert.equal(document.querySelector('.form-field-surface'), null)
})
test('editing reveals dropdowns with selected values and preserves busy/dependent disabling', () => {
  const document = render({ editing: true })
  const selects = document.querySelectorAll('select')
  assert.equal(selects.length, 2)
  assert.equal(selects[0].value, '2')
  assert.equal(selects[1].value, '4')
  assert.equal(selects[0].disabled, false)
  assert.ok([...render({ editing: true, busy: true }).querySelectorAll('select')].every((item) => item.disabled))
  assert.equal(render({ editing: true, action: '' }).querySelector('[aria-label="Underwriting sub action"]').disabled, true)
})
test('missing read-only values have a consistent placeholder and multiline text wraps', () => {
  const document = new JSDOM(renderToStaticMarkup(React.createElement(card.ReadOnlyValueCard, { value: ' ', multiline: true }))).window.document
  assert.equal(document.body.textContent, 'Not provided')
  assert.ok(document.querySelector('div').className.includes('whitespace-pre-wrap'))
  assert.equal((render({ action: '', subAction: '' }).body.textContent.match(/Not provided/g) ?? []).length, 2)
})
