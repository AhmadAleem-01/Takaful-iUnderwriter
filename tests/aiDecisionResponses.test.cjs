const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function compile(file, dependencies = {}) {
  const context = { exports: {}, require: (name) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`)
    return dependencies[name]
  } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, context)
  return context.exports
}
const decisions = compile('lib/aiDecisionResponse.ts', {
  '../generated/models/Aur_ai_decision_responsesModel': compile('generated/models/Aur_ai_decision_responsesModel.ts'),
})
const json = JSON.stringify({ bestSuitableProduct: { product: 'Hull & Liability', confidenceScore: 100, selectionReason: 'Aircraft fleet confirmed.' }, allProducts: [{ product: 'Liability' }] })
const inquiryId = '00000000-0000-0000-0000-000000000001'
const icons = Object.fromEntries(['Sparkles', 'ChevronDown', 'Check', 'CircleCheck', 'Eye', 'Layers3'].map((name) => [name, () => null]))
function load(getAll) {
  return compile('services/aiDecisionResponsesService.ts', {
    '../generated/services/Aur_ai_decision_responsesService': { Aur_ai_decision_responsesService: { getAll } },
    '../lib/aiDecisionResponse': decisions,
  }).getInquiryAiDecisionSuggestions
}

test('reads the selected product, percentage and reason, excluding alternative products', () => {
  const selection = decisions.parseAiDecisionSelection(json)
  assert.equal(selection.product, 'Hull & Liability')
  assert.equal(selection.confidenceScore, 100)
  assert.equal(selection.selectionReason, 'Aircraft fleet confirmed.')
  assert.equal(Object.keys(selection).length, 3)
})

test('handles invalid JSON and missing selections without inventing a suggestion', () => {
  for (const value of [undefined, '{', 'null', '[]', '{}', '{"bestSuitableProduct":{"product":42}}']) {
    assert.equal(decisions.parseAiDecisionSelection(value), null)
  }
  for (const score of [null, '95', -1, 101]) {
    assert.equal(decisions.parseAiDecisionSelection(JSON.stringify({ bestSuitableProduct: { product: 'Liability', confidenceScore: score } })).confidenceScore, undefined)
  }
  assert.equal(decisions.parseAiDecisionSelection('{"bestSuitableProduct":{"product":"Liability","confidenceScore":0}}').confidenceScore, 0)
})

test('alternatives exclude the selected product, invalid entries and duplicate names', () => {
  const alternatives = decisions.parseAiDecisionAlternatives(JSON.stringify({
    bestSuitableProduct: { product: 'Hull & Liability' },
    allProducts: [{ product: 'Hull & Liability' }, { product: 'Liability', confidenceScore: 0 }, { product: 'liability' }, null, { product: 10 }],
  }))
  assert.equal(alternatives.length, 1)
  assert.equal(alternatives[0].product, 'Liability')
  assert.equal(alternatives[0].confidenceScore, 0)
  assert.equal(decisions.parseAiDecisionAlternatives('{').length, 0)
})

test('applying requires a unique matching option, tolerating case and whitespace only', () => {
  const options = [{ value: 'product-id', label: 'Hull & Liability' }]
  assert.equal(decisions.aiDecisionMatchingOption(' hull  & liability ', options).value, 'product-id')
  assert.equal(decisions.aiDecisionMatchingOption('Hull', options), undefined)
  assert.equal(decisions.aiDecisionMatchingOption('Hull & Liability', [...options, { value: 'duplicate-id', label: 'Hull & Liability' }]), undefined)
})

test('routes by numeric option set and keeps the latest record per category including unreadable decisions', () => {
  const selections = decisions.latestAiDecisionSuggestions([
    { aur_ai_decision_responseid: 'new', aur_decision_category: 1, aur_ai_decision_response_json: '{' },
    { aur_ai_decision_responseid: 'type', aur_decision_category: 2, aur_ai_decision_response_json: json },
    { aur_ai_decision_responseid: 'purpose', aur_decision_category: 3, aur_ai_decision_response_json: json },
    { aur_ai_decision_responseid: 'old', aur_decision_category: 1, aur_ai_decision_response_json: json },
    { aur_ai_decision_responseid: 'unknown', aur_decision_category: 4, aur_ai_decision_response_json: json },
  ])
  assert.deepEqual(Array.from(selections, (item) => item.category), [1, 2, 3])
  assert.equal(selections[0].id, 'new')
  assert.equal(selections[0].selection, null)
})

test('parses category-specific inquiry type and purpose decisions and alternatives', () => {
  for (const [category, field, selected] of [[2, 'InquiryType', 'Renewal'], [3, 'InquiryPurpose', 'For Quotation']]) {
    const data = JSON.stringify({ [`bestSuitable${field}`]: { [field]: selected, confidenceScore: 93, selectionReason: 'The inquiry explicitly requests this.' }, [`all${field}s`]: [{ [field]: selected }, { [field]: 'Other', confidenceScore: 10 }] })
    const [suggestion] = decisions.latestAiDecisionSuggestions([{ aur_ai_decision_responseid: field, aur_decision_category: category, aur_ai_decision_response_json: data }])
    assert.equal(suggestion.selection.product, selected)
    assert.equal(suggestion.selection.confidenceScore, 93)
    assert.equal(suggestion.alternatives.length, 1)
    assert.equal(suggestion.alternatives[0].product, 'Other')
  }
})

test('uses category labels for new option values without requiring a generated category entry', () => {
  const [suggestion] = decisions.latestAiDecisionSuggestions([
    { aur_ai_decision_responseid: 'new', aur_decision_category: 101, aur_decision_categoryname: 'aur_broker_company', aur_ai_decision_response_json: JSON.stringify({ bestSuitableBrokerCompany: { brokerCompany: 'Broker A', confidenceScore: 88, selectionReason: 'Identified in the email.' } }) },
    { aur_ai_decision_responseid: 'old', aur_decision_category: 102, aur_decision_categoryname: 'Broker Company', aur_ai_decision_response_json: json },
  ])
  assert.equal(suggestion.id, 'new')
  assert.equal(suggestion.fieldName, 'aur_broker_company')
  assert.equal(suggestion.selection.product, 'Broker A')
  assert.equal(decisions.aiDecisionFieldKey(suggestion.fieldName), decisions.aiDecisionFieldKey('Broker Company'))
})

test('loads all pages by the inquiry reference and active state in newest-first order', async () => {
  const queries = []
  const get = load(async (options) => {
    assert.equal(options.select.includes('aur_decision_categoryname'), false, 'Virtual option-set label must not be requested as a Dataverse column')
    queries.push(options)
    return { success: true, skipToken: options.skipToken ? undefined : 'page-two', data: [
      { aur_ai_decision_responseid: options.skipToken ? 'old' : 'new', aur_decision_category: 1, aur_ai_decision_response_json: json },
    ] }
  })
  const result = await get(`{${inquiryId}}`)
  assert.equal(queries[0].filter, `_aur_ref_id_value eq ${inquiryId} and statecode eq 0`)
  assert.equal(queries[0].orderBy[0], 'createdon desc')
  assert.equal(queries[1].skipToken, 'page-two')
  assert.equal(result.inquiryId, inquiryId)
  assert.equal(result.suggestions.length, 1)
  assert.equal(result.suggestions[0].id, 'new')
})

test('surfaces service failures and rejects invalid inquiry IDs before querying', async () => {
  const get = load(async () => ({ success: false, error: { message: 'Read denied' } }))
  await assert.rejects(get(inquiryId), /Read denied/)
  await assert.rejects(get('invalid'), /valid inquiry ID/)
})

test('renders the selected value and explanation as text and handles missing decisions', () => {
  const React = require('react')
  const { renderToStaticMarkup } = require('react-dom/server')
  const { InquiryAiDecisionSuggestion } = compile('components/inquiries/InquiryAiDecisionSuggestion.tsx', {
    react: React,
    'react-dom': require('react-dom'),
    'react/jsx-runtime': require('react/jsx-runtime'),
    'lucide-react': icons,
    '../../lib/aiDecisionResponse': decisions,
  })
  const render = (suggestion) => renderToStaticMarkup(React.createElement(InquiryAiDecisionSuggestion, { suggestion, fieldLabel: 'Product' }))
  assert.equal(render(undefined), '')
  const markup = render({ category: 1, selection: { product: 'Hull & Liability', confidenceScore: 0, selectionReason: '<script>unsafe</script>' } })
  assert.match(markup, /Hull &amp; Liability/)
  assert.match(markup, /0% confidence/)
  assert.match(markup, /Selection reasoning/)
  assert.equal(markup.split('&lt;script&gt;unsafe&lt;/script&gt;').length - 1, 1)
  assert.match(markup, /aria-expanded="false"/)
  assert.match(markup, /aria-hidden="true"/)
  assert.match(markup, /&lt;script&gt;unsafe&lt;\/script&gt;/)
  assert.doesNotMatch(markup, /<script>/)
  assert.match(render({ category: 1, selection: null }), /could not be read/)
})

test('clicking the AI field reveals and collapses the reasoning while editing keeps the control usable', async () => {
  const React = require('react')
  const { JSDOM } = require('jsdom')
  const dom = new JSDOM('<div id="root" class="inquiry-details-grid"></div>')
  const previous = { window: global.window, document: global.document, IS_REACT_ACT_ENVIRONMENT: global.IS_REACT_ACT_ENVIRONMENT }
  Object.assign(global, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })
  const { createRoot } = require('react-dom/client')
  const { InquiryAiDecisionSuggestion } = compile('components/inquiries/InquiryAiDecisionSuggestion.tsx', {
    react: React, 'react/jsx-runtime': require('react/jsx-runtime'),
    'react-dom': require('react-dom'),
    'lucide-react': icons,
    '../../lib/aiDecisionResponse': decisions,
  })
  const root = createRoot(dom.window.document.getElementById('root'))
  const applied = []
  const props = { fieldLabel: 'Product', leadingField: React.createElement('div', { 'data-testid': 'lob' }, 'Aviation'), options: [{ value: 'product-id', label: 'Hull & Liability' }], currentValue: 'other-id', onApply: (value) => applied.push(value), suggestion: { id: 'decision', category: 1, selection: decisions.parseAiDecisionSelection(json), alternatives: decisions.parseAiDecisionAlternatives(json) } }
  try {
    await React.act(async () => root.render(React.createElement(InquiryAiDecisionSuggestion, props, React.createElement('span', null, 'Current product'))))
    const row = dom.window.document.querySelector('.ai-decision-row')
    const field = dom.window.document.querySelector('.ai-decision-product-slot')
    const trigger = dom.window.document.querySelector('button')
    const panel = dom.window.document.getElementById(trigger.getAttribute('aria-controls'))
    assert.equal(trigger.getAttribute('aria-expanded'), 'false')
    await React.act(async () => trigger.click())
    assert.equal(trigger.getAttribute('aria-expanded'), 'true')
    assert.equal(panel.getAttribute('aria-hidden'), 'false')
    assert.equal(row.children[0].getAttribute('data-testid'), 'lob')
    assert.equal(row.children[1], field)
    assert.equal(row.children[2], panel)
    assert.equal(field.contains(panel), false)
    const button = (label) => Array.from(dom.window.document.querySelectorAll('button')).find((item) => item.textContent === label)
    await React.act(async () => button('View reasoning').click())
    assert.equal(button('Hide reasoning').getAttribute('aria-expanded'), 'true')
    await React.act(async () => button('See alternatives').click())
    assert.equal(button('View reasoning').getAttribute('aria-expanded'), 'false')
    assert.equal(button('Hide alternatives').getAttribute('aria-expanded'), 'true')
    assert.match(dom.window.document.getElementById(button('Hide alternatives').getAttribute('aria-controls')).textContent, /Liability/)
    await React.act(async () => button('Apply suggestion').click())
    assert.deepEqual(applied, ['product-id'])
    await React.act(async () => trigger.click())
    assert.equal(trigger.getAttribute('aria-expanded'), 'false')
    assert.equal(panel.getAttribute('aria-hidden'), 'true')
    assert.equal(row.children[1], field)
    await React.act(async () => root.render(React.createElement(InquiryAiDecisionSuggestion, { ...props, editing: true }, React.createElement('select', null, React.createElement('option', null, 'Current product')))))
    assert.equal(dom.window.document.querySelector('button').contains(dom.window.document.querySelector('select')), false)
    assert.match(dom.window.document.querySelector('button').textContent, /AI reasoning/)
    await React.act(async () => root.render(React.createElement(InquiryAiDecisionSuggestion, { ...props, currentValue: 'product-id', editing: true })))
    assert.equal(button('Selected in draft').disabled, true)
    assert.match(dom.window.document.querySelector('[role=status]').textContent, /Save Inquiry/)
    await React.act(async () => root.render(React.createElement(InquiryAiDecisionSuggestion, { ...props, options: [] })))
    assert.equal(button('Apply suggestion').disabled, true)
    await React.act(async () => root.render(React.createElement(InquiryAiDecisionSuggestion, { ...props, suggestion: undefined }, React.createElement('span', null, 'Current product'))))
    assert.equal(dom.window.document.querySelector('button'), null)
    assert.match(dom.window.document.querySelector('.ai-decision-row').textContent, /AviationProductCurrent product/)
  } finally {
    await React.act(async () => root.unmount())
    Object.assign(global, previous)
    dom.window.close()
  }
})

test('uses tooltips for inquiry type and purpose and a full-row card only for product', async () => {
  const React = require('react')
  const { JSDOM } = require('jsdom')
  const dom = new JSDOM('<div id="root"></div>')
  const previous = { window: global.window, document: global.document, IS_REACT_ACT_ENVIRONMENT: global.IS_REACT_ACT_ENVIRONMENT }
  Object.assign(global, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })
  const dependencies = { react: React, 'react-dom': require('react-dom'), 'react/jsx-runtime': require('react/jsx-runtime'), 'lucide-react': icons, '../../lib/aiDecisionResponse': decisions }
  const component = compile('components/inquiries/InquiryAiDecisionSuggestion.tsx', dependencies)
  const tooltip = compile('components/inquiries/InquiryAiDecisionTooltip.tsx', { ...dependencies, '@radix-ui/react-tooltip': require('@radix-ui/react-tooltip') })
  const { InquiryDecisionFields } = compile('components/inquiries/InquiryDecisionFields.tsx', { ...dependencies, './InquiryAiDecisionSuggestion': component, './InquiryAiDecisionTooltip': tooltip })
  const root = require('react-dom/client').createRoot(dom.window.document.getElementById('root'))
  const applied = []
  const fields = [
    { label: 'Inquiry Type', decisionStyle: 'tooltip', content: React.createElement('span', null, 'New business'), currentValue: 'new', options: [{ value: 'renewal', label: 'Renewal' }], onApply: (value) => applied.push(['type', value]) },
    { label: 'Inquiry Purpose', decisionStyle: 'tooltip', content: React.createElement('span', null, 'Not selected'), currentValue: '', options: [{ value: 'quotation', label: 'For Quotation' }], onApply: (value) => applied.push(['purpose', value]) },
    { label: 'Broker Company', content: React.createElement('span', null, 'No broker') },
    { label: 'Name', content: React.createElement('span', null, 'Inquiry') },
    { label: 'Line of Business', content: React.createElement('span', null, 'Aviation') },
    { label: 'Product', decisionCategory: 1, decisionStyle: 'card', content: React.createElement('span', null, 'Other product'), currentValue: 'other', options: [{ value: 'hull', label: 'Hull & Liability' }], onApply: (value) => applied.push(['product', value]) },
  ]
  const suggestions = decisions.latestAiDecisionSuggestions([
    { aur_ai_decision_responseid: 'product', aur_decision_category: 1, aur_ai_decision_response_json: json },
    { aur_ai_decision_responseid: 'type', aur_decision_category: 2, aur_ai_decision_response_json: JSON.stringify({ bestSuitableInquiryType: { inquiryType: 'Renewal', confidenceScore: 95, selectionReason: 'Renewal request.' } }) },
    { aur_ai_decision_responseid: 'purpose', aur_decision_category: 3, aur_ai_decision_response_json: JSON.stringify({ bestSuitableInquiryPurpose: { inquiryPurpose: 'For Quotation', confidenceScore: 91, selectionReason: 'Quotation requested.' } }) },
    { aur_ai_decision_responseid: 'broker', aur_decision_category: 55, aur_decision_categoryname: 'Broker Company', aur_ai_decision_response_json: JSON.stringify({ bestSuitableBrokerCompany: { brokerCompany: 'Broker A' } }) },
  ])
  try {
    await React.act(async () => root.render(React.createElement(InquiryDecisionFields, { fields, suggestions, editing: false, disabled: false })))
    assert.equal(dom.window.document.querySelectorAll('.ai-decision-field').length, 1)
    assert.ok(dom.window.document.querySelector('button[aria-label="About AI-suggested Inquiry Type"]'))
    assert.ok(dom.window.document.querySelector('button[aria-label="About AI-suggested Inquiry Purpose"]'))
    assert.equal(dom.window.document.querySelector('button[aria-label="Show AI reasoning for Inquiry Type"]'), null)
    assert.equal(dom.window.document.querySelector('button[aria-label="Show AI reasoning for Broker Company"]'), null)
    const productButton = dom.window.document.querySelector('button[aria-label="Show AI reasoning for Product"]')
    const productField = productButton.closest('.ai-decision').parentElement
    const panel = dom.window.document.getElementById(productButton.getAttribute('aria-controls'))
    assert.equal(panel.parentElement.classList.contains('md:col-span-2'), true)
    assert.equal(productField.contains(panel), false)
    await React.act(async () => productButton.click())
    assert.equal(productButton.closest('.ai-decision').parentElement, productField)
    assert.equal(panel.dataset.open, 'true')
    await React.act(async () => Array.from(panel.querySelectorAll('button')).find((button) => button.textContent === 'Apply suggestion').click())
    assert.deepEqual(applied, [['product', 'hull']])
    await React.act(async () => root.render(React.createElement(InquiryDecisionFields, { fields, suggestions: [], editing: false, disabled: false })))
    assert.equal(dom.window.document.querySelectorAll('.ai-decision-field').length, 0)
    assert.ok(dom.window.document.querySelector('button[aria-label="About AI-suggested Inquiry Type"]'))
    assert.ok(dom.window.document.querySelector('button[aria-label="About AI-suggested Inquiry Purpose"]'))
  } finally {
    await React.act(async () => root.unmount())
    Object.assign(global, previous)
    dom.window.close()
  }
})
