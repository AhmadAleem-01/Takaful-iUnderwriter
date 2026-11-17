const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { JSDOM } = require('jsdom')
const cache = new Map()

function load(file) {
  const absolute = path.resolve(file)
  if (cache.has(absolute)) return cache.get(absolute)
  const context = { exports: {}, require: (name) => {
    if (!name.startsWith('.')) return require(name)
    const target = path.resolve(path.dirname(absolute), name)
    return load(fs.existsSync(target + '.tsx') ? target + '.tsx' : target + '.ts')
  } }
  cache.set(absolute, context.exports)
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, context)
  return context.exports
}

const { InquiryWorkspaceTabs } = load(path.join(__dirname, '../src/components/inquiries/InquiryWorkspaceTabs.tsx'))
function render(props = {}) {
  return new JSDOM(renderToStaticMarkup(React.createElement(InquiryWorkspaceTabs, {
    isMotorInsurance: false, isHealthInsurance: false, showQuotes: false, value: 'details', ...props,
  }, React.createElement('p', null, 'Inquiry content')))).window.document
}

test('inquiry navigation preserves the seven unconditional sections and accessible names', () => {
  const document = render()
  assert.deepEqual([...document.querySelectorAll('[role="tab"]')].map((tab) => tab.getAttribute('aria-label')), ['Details', 'Coverages', 'Email', 'Actions', 'RI Capacity Checks', 'Documents', 'History'])
  assert.equal(document.querySelector('[role="tablist"]').getAttribute('aria-label'), 'Inquiry sections')
  assert.match(document.body.textContent, /Inquiry content/)
})

test('motor and quotes tabs appear only when their conditions allow them', () => {
  const document = render({ isMotorInsurance: true, showQuotes: true })
  const labels = [...document.querySelectorAll('[role="tab"]')].map((tab) => tab.getAttribute('aria-label'))
  assert.equal(labels.length, 9)
  assert.ok(labels.includes('Driver & Vehicle'))
  assert.ok(labels.includes('Quotes'))
  assert.ok(!labels.includes('Health Information'))
})

test('health navigation uses its own accessible product tab name', () => {
  const document = render({ isHealthInsurance: true })
  assert.ok(document.querySelector('[role="tab"][aria-label="Health Information"]'))
  assert.equal(document.querySelector('[role="tab"][aria-label="Quotes"]'), null)
})

test('controlled selection still activates programmatic email navigation', () => {
  const document = render({ value: 'email' })
  assert.equal(document.querySelector('[role="tab"][aria-selected="true"]').getAttribute('aria-label'), 'Email')
  assert.equal(document.querySelector('[role="tablist"]').getAttribute('aria-orientation'), 'horizontal')
})

test('selected tab styling stays attached to aria selection when tooltip state changes', () => {
  const document = render({ value: 'email' })
  const selected = document.querySelector('[role="tab"][aria-label="Email"]')
  const inactive = document.querySelector('[role="tab"][aria-label="Details"]')
  for (const state of ['closed', 'delayed-open', 'instant-open']) {
    selected.setAttribute('data-state', state)
    assert.equal(selected.getAttribute('aria-selected'), 'true')
    assert.ok(selected.classList.contains('aria-selected:bg-primary'))
    assert.ok(selected.classList.contains('aria-selected:text-white'))
    assert.ok(selected.classList.contains('aria-selected:hover:bg-primary'))
    assert.ok(selected.classList.contains('dark:aria-selected:hover:bg-primary'))
    assert.equal(inactive.getAttribute('aria-selected'), 'false')
  }
})
