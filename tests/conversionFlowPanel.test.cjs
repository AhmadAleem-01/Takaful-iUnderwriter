const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { JSDOM } = require('jsdom')

const dependencies = {
  '../../lib/formatters': { formatAmount: (value) => new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(value) },
  '../ui/Card': { Card: ({ children, className, id }) => React.createElement('div', { className, id }, children) },
}
const context = { exports: {}, require: (name) => dependencies[name] ?? require(name) }
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/components/dashboard/ConversionFlowPanel.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText, context)

function render(inquiries, quotes, won, premium = 0) {
  const metrics = {
    totalInquiries: inquiries, totalQuotes: quotes, wonQuotes: won, wonPremiumTotal: premium,
    inquiryToQuoteConversionRate: inquiries ? Math.round(quotes / inquiries * 100) : 0,
    quoteToWonConversionRate: quotes ? Math.round(won / quotes * 100) : 0,
  }
  return new JSDOM(renderToStaticMarkup(React.createElement(context.exports.ConversionFlowPanel, { metrics }))).window.document
}

function fill(document, label) {
  return Number(document.querySelector('[role="progressbar"][aria-label="' + label + '"]').getAttribute('aria-valuenow'))
}

test('multiple quotes per inquiry preserve ratios above 100% and explain their meaning', () => {
  const document = render(2, 4, 2, 48500)
  assert.ok(document.querySelector('#dashboard-conversion'))
  assert.match(document.body.textContent, /200%/)
  assert.match(document.body.textContent, /2\.0 quotes per inquiry/)
  const explanation = document.querySelector('[role="img"][aria-label*="quote-volume ratio"]')
  assert.ok(explanation)
  assert.match(explanation.getAttribute('aria-label'), /200%/)
  assert.ok([...document.querySelectorAll('p')].every((paragraph) => !paragraph.textContent.includes('One inquiry can generate multiple quotes')))
  assert.equal(explanation.querySelector('title').textContent, explanation.getAttribute('aria-label'))
  assert.match(document.body.textContent, /48,500/)
  assert.equal(fill(document, 'Inquiries'), 100)
  assert.equal(fill(document, 'Quotes'), 100)
  assert.equal(fill(document, 'Won'), 50)
})

test('empty pipeline renders zero values without invalid ratios or fills', () => {
  const document = render(0, 0, 0)
  assert.doesNotMatch(document.body.textContent, /NaN|Infinity/)
  assert.match(document.body.textContent, /0\.0 quotes per inquiry/)
  for (const label of ['Inquiries', 'Quotes', 'Won']) assert.equal(fill(document, label), 0)
})

test('inquiries without quotes fill only the intake stage', () => {
  const document = render(3, 0, 0)
  assert.equal(fill(document, 'Inquiries'), 100)
  assert.equal(fill(document, 'Quotes'), 0)
  assert.equal(fill(document, 'Won'), 0)
})

test('quotes without wins leave the outcome stage empty', () => {
  const document = render(2, 4, 0)
  assert.equal(fill(document, 'Won'), 0)
  assert.match(document.body.textContent, /4 quotes not yet won/)
})

test('all quotes won fully fill the outcome stage with no remaining balance', () => {
  const document = render(2, 4, 4)
  assert.equal(fill(document, 'Won'), 100)
  assert.match(document.body.textContent, /0 quotes not yet won/)
})
