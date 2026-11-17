const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { createRoot } = require('react-dom/client')
const { JSDOM } = require('jsdom')

const context = { exports: {}, require }
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/components/inquiries/InquiryAiSection.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText, context)
const { InquiryAiSection } = context.exports

test('AI details collapse independently while summary and actions remain visible', async () => {
  const dom = new JSDOM('<div id="root"></div>')
  const previousWindow = global.window, previousDocument = global.document
  global.window = dom.window
  global.document = dom.window.document
  global.IS_REACT_ACT_ENVIRONMENT = true
  const root = createRoot(document.getElementById('root'))
  try {
    await React.act(async () => root.render(React.createElement(InquiryAiSection, {
      summary: React.createElement('p', { id: 'summary' }, 'Persistent AI summary'),
      actions: React.createElement('button', { id: 'reevaluate' }, 'Re-evaluate AI Extraction'),
    }, React.createElement('p', null, 'Detailed checks'))))
    const toggle = document.querySelector('button[aria-expanded]')
    const panel = document.getElementById(toggle.getAttribute('aria-controls'))
    assert.equal(toggle.getAttribute('aria-expanded'), 'false')
    assert.equal(panel.hidden, true)
    assert.equal(document.getElementById('summary').closest('[hidden]'), null)
    assert.equal(document.getElementById('reevaluate').closest('[hidden]'), null)
    await React.act(async () => toggle.click())
    assert.equal(toggle.getAttribute('aria-expanded'), 'true')
    assert.equal(panel.hidden, false)
    assert.equal(document.getElementById('summary').closest('[hidden]'), null)
    assert.equal(document.getElementById('reevaluate').closest('[hidden]'), null)
    assert.ok(document.querySelector('section').className.includes('dark:bg-primary/10'))
    await React.act(async () => toggle.click())
    assert.equal(panel.hidden, true)
  } finally {
    await React.act(async () => root.unmount())
    dom.window.close()
    global.window = previousWindow
    global.document = previousDocument
    delete global.IS_REACT_ACT_ENVIRONMENT
  }
})

test('both AI variants precede inquiry details and Health summary is not duplicated', () => {
  const page = fs.readFileSync(path.join(__dirname, '../src/pages/inquiries/InquiryWorkspacePage.tsx'), 'utf8')
  const start = page.indexOf('<TabsContent value="details"')
  const details = page.indexOf('<DetailsSection title="Inquiry Details"', start)
  assert.ok(page.indexOf('<HealthAiEvaluation', start) < details)
  assert.ok(page.indexOf('<InquiryAiPanel', start) < details)
  const health = fs.readFileSync(path.join(__dirname, '../src/components/inquiries/HealthAiEvaluation.tsx'), 'utf8')
  assert.equal((health.match(/data\??\.evaluationSummary/g) ?? []).length, 1)
  assert.match(health, /AI summary is not available yet/)
})

test('AI status cards use opaque semantic colors for each variant', () => {
  const { renderToStaticMarkup } = require('react-dom/server')
  const { InquiryAiStatus } = context.exports
  for (const [variant, color] of [['warning', 'amber'], ['info', 'blue'], ['success', 'emerald'], ['error', 'rose']]) {
    const document = new JSDOM(renderToStaticMarkup(React.createElement(InquiryAiStatus, { variant, title: 'Status heading' }, 'Status message'))).window.document
    const card = document.querySelector('[role]')
    assert.ok(card.className.includes(`bg-${color}-50`))
    assert.ok(card.className.includes(`dark:bg-${color}-950`))
    assert.ok(card.querySelector('svg'))
    assert.match(card.textContent, /Status headingStatus message/)
  }
})
