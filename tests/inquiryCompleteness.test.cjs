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
const completenessModule = load('components/inquiries/InquiryCompletenessCard.tsx', { '../../lib/formatters': { formatAmount: (value) => String(value) } })
const { InquiryCompletenessCard } = completenessModule
const render = (readiness) => new JSDOM(renderToStaticMarkup(React.createElement(InquiryCompletenessCard, { readiness }))).window.document

test('completeness displays the existing overall and individual readiness values', () => {
  const document = render([{ label: 'Overall Completeness', value: 60 }, { label: 'Information Capture', value: 72 }, { label: 'Document Readiness', value: 48 }, { label: 'Senior Review Readiness', value: 55 }])
  assert.equal(document.querySelector('h2').textContent, 'Completeness')
  assert.deepEqual([...document.querySelectorAll('[role="progressbar"]')].map((bar) => Number(bar.getAttribute('aria-valuenow'))), [60, 60, 72, 48, 55])
})

test('missing readiness renders a zero overall score without invalid values', () => {
  const document = render(undefined)
  assert.equal(document.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'), '0')
  assert.equal(document.querySelectorAll('[role="progressbar"]').length, 1)
  assert.doesNotMatch(document.body.textContent, /NaN|undefined/)
})

test('readiness values are clamped and invalid values display zero', () => {
  const document = render([{ label: 'Overall', value: 150 }, { label: 'Negative', value: -10 }, { label: 'Invalid', value: NaN }, { label: 'Infinite', value: Infinity }])
  assert.deepEqual([...document.querySelectorAll('[role="progressbar"]')].map((bar) => Number(bar.getAttribute('aria-valuenow'))), [100, 100, 0, 0, 0])
})

test('decision rail places completeness between quick actions and underwriting action', () => {
  const { InquiryDecisionRail } = load('components/inquiries/InquiryWorkspacePanels.tsx', {
    './ReadOnlyValueCard': load('components/inquiries/ReadOnlyValueCard.tsx'),
    './InquiryCompletenessCard': completenessModule,
    '../../lib/inquiryUnderwriting': { underwriterActions: [], getUnderwriterSubActions: () => [] },
    '../ui/Button': { Button: ({ children }) => React.createElement('button', null, children) },
    '../ui/Select': { Select: () => React.createElement('select') },
  })
  const markup = renderToStaticMarkup(React.createElement(InquiryDecisionRail, {
    inquiry: { readiness: [] }, action: '', subAction: '', editing: false, busy: false,
    beforeActionContent: React.createElement('section', null, React.createElement('h2', null, 'Quick Actions')),
    onAction() {}, onSubAction() {}, onEdit() {}, onSave() {},
  }))
  const document = new JSDOM(markup).window.document
  assert.deepEqual([...document.querySelectorAll('aside > section > h2, aside > section > div > h2')].map((heading) => heading.textContent), ['Quick Actions', 'Completeness', 'Underwriting Action'])
  assert.equal(document.querySelectorAll('section[aria-label="Completeness"]').length, 1)
})
