const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

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

const presentation = compile('lib/aiResponsePresentation.ts')
function loadPanel(react = React) { return compile('components/inquiries/InquiryWorkspacePanels.tsx', {
  './InquiryAiSection': compile('components/inquiries/InquiryAiSection.tsx', {
    react, 'react/jsx-runtime': require('react/jsx-runtime'), 'lucide-react': require('lucide-react'),
  }),
  './ReadOnlyValueCard': { ReadOnlyValueCard: () => null },
  './InquiryCompletenessCard': { InquiryCompletenessCard: () => null },
  '@radix-ui/react-dialog': require('@radix-ui/react-dialog'),
  react, 'react/jsx-runtime': require('react/jsx-runtime'), 'lucide-react': require('lucide-react'),
  '../../lib/aiResponsePresentation': presentation,
  '../../lib/formatters': { formatDate: (value) => value, formatPercent: (value) => `${value}%` },
  '../../lib/inquiryUnderwriting': {},
  '../../lib/cn': { cn: (...values) => values.filter(Boolean).join(' ') },
  '../ui/Select': { Select: () => null },
  './InquiryEvidence': { InquiryEvidenceButton: () => null, InquiryEvidenceFileNames: () => null },
  '../ui/Button': { Button: ({ children, variant, size, ...props }) => React.createElement('button', props, children) },
}) }
const { InquiryAiPanel } = loadPanel()
const example = {
  id: '7d87bfa8-54d4-f111-a05b-7ced8dac4e55', name: 'Broker (Company)', response: 'Broker identified as Gallagher.',
  evidence: 'The broker email signature identifies Gallagher.', conditionMet: 'True', confidenceScore: 95,
  businessRuleName: 'Broker (Company)', businessRuleCategory: 'Submission Completeness', status: 'Active',
}
function render(record = example, overrides = {}) {
  return renderToStaticMarkup(React.createElement(InquiryAiPanel, {
    records: [record], allRecords: [record], summary: '', loading: false, category: 'All', categories: [{ value: 'All', label: 'All', count: 1 }],
    onCategory() {}, drafts: {}, saveStates: {}, onDraft() {}, onSave() {}, onReevaluate() {}, onRequestDraft() {},
    showRequestDraft: false, renderEvidence: () => React.createElement('button', { 'aria-label': 'View evidence' }, 'View evidence'), ...overrides,
  }))
}

test('shows the supplied response preview and confidence without condition labels on cards', () => {
  const html = render()
  for (const text of ['Broker (Company)', 'Broker identified as Gallagher.', '95% confidence', 'View Details']) assert.ok(html.includes(text), text)
  assert.equal(html.includes('Condition met'), false)
  assert.equal(html.includes(example.evidence), false)
  assert.equal(html.includes('Supporting evidence'), false)
  assert.equal(html.includes(example.id), false)
  assert.equal(html.includes('@odata'), false)
  assert.equal(html.includes('>True<'), false)
  assert.equal(html.includes('<textarea'), false)
})

test('displays the summary text from stored JSON without exposing empty JSON arrays', () => {
  const summary = 'The quote slip names ABFA Investments Ltd as owner.'
  const html = render(example, { summary: JSON.stringify({ summary, facts_used: [], conflicts: [] }) })
  assert.ok(html.includes(summary))
  assert.equal(html.includes('facts_used'), false)
  assert.equal(html.includes('Facts used'), false)
  assert.equal(html.includes('Conflicts to review'), false)
  assert.equal(html.includes('&quot;summary&quot;'), false)
})

test('keeps nonempty facts and conflicts readable and preserves existing plain summaries', () => {
  const html = render(example, { summary: JSON.stringify({ summary: 'Cover was reviewed.', facts_used: ['Aircraft is undergoing maintenance.', { source_document: 'Quote slip', page: 16 }], conflicts: ['The declared operating area differs.'] }) })
  for (const text of ['Cover was reviewed.', 'Facts used', 'Aircraft is undergoing maintenance.', 'source document: Quote slip; page: 16', 'Conflicts to review', 'The declared operating area differs.']) assert.ok(html.includes(text), text)
  assert.ok(render(example, { summary: 'Existing plain summary.' }).includes('Existing plain summary.'))
})

test('responsive card grid shows every response with its metadata and actions', () => {
  const second = { ...example, id: 'second', name: 'Second question', response: 'Second answer' }
  const html = render(example, { records: [example, second], allRecords: [example, second] })
  for (const text of ['Second question', example.response, second.response, 'Find a response', 'View Details', '95% confidence']) assert.ok(html.includes(text), text)
  assert.equal((html.match(/<article/g) || []).length, 2)
  assert.ok(html.includes('grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'))
  assert.equal(html.includes('AI response items'), false)
  assert.equal(html.includes('Previous'), false)
  assert.equal(html.includes('Next'), false)
})

test('does not portray false or unknown conditions as approvals', () => {
  assert.equal(presentation.aiConditionResult('False').label, 'Condition not met')
  assert.equal(presentation.aiConditionResult('').label, 'Not evaluated')
  assert.equal(presentation.aiConditionResult('Check with underwriter').label, 'Needs review')
  assert.equal(render({ ...example, conditionMet: 'False' }).includes('Condition not met'), false)
})

test('cards show explicit business rule property and missing-evidence badges independently', () => {
  const card = (record) => render(record).split('<article')[1].split('</article>')[0]
  const propertyOnly = card({ ...example, businessRulePropertyName: '  Mandatory   Fields  ' })
  assert.ok(propertyOnly.includes('Mandatory Fields'))
  assert.equal(propertyOnly.includes('Evidence Not Found'), false)
  for (const evidence of ['No Evidence Found', '  evidence   not found  ']) {
    const both = card({ ...example, conditionMet: '', businessRulePropertyName: 'Conditional Rules', evidence })
    assert.ok(both.includes('Conditional Rules'))
    assert.ok(both.includes('Evidence Not Found'))
    assert.equal(both.includes('Not evaluated'), false)
  }
  const evidenceOnly = card({ ...example, evidence: 'No Evidence Found' })
  assert.ok(evidenceOnly.includes('Evidence Not Found'))
  assert.equal(evidenceOnly.includes('Submission Completeness'), false)
  const neither = card({ ...example, businessRulePropertyName: ' ', response: 'No Evidence Found', evidence: 'Email signature', conditionMet: 'False' })
  assert.equal(neither.includes('bg-warning/10'), false)
  assert.equal(neither.includes('Condition not met'), false)
})

test('missing or invalid confidence has explicit fallback text', () => {
  for (const score of [undefined, NaN, -1, 101]) assert.equal(presentation.aiConfidence(score), null)
  assert.equal(presentation.aiConfidence(0), 0)
  const html = render({ ...example, confidenceScore: undefined, evidence: 'No evidence captured.' })
  assert.ok(html.includes('Confidence unavailable'))
  assert.equal(html.includes('Supporting evidence'), false)
  assert.equal(html.includes('View evidence'), false)
})

test('drafts remain visibly marked as unsaved', () => {
  const html = render(example, { drafts: { [example.id]: 'Updated broker answer' } })
  assert.ok(html.includes('Updated broker answer'))
  assert.ok(html.includes('Unsaved changes'))
})

test('filters by Evidence rather than Response, independent of condition results', () => {
  const records = [
    { response: 'No Evidence Found', conditionMet: 'True', evidence: 'Some evidence text' },
    { response: 'An extracted answer', evidence: '  no  evidence found  ', conditionMet: 'False' },
    { response: 'Broker identified as Gallagher.', conditionMet: 'False', evidence: 'No Evidence Found' },
    { response: '' },
  ]
  assert.deepEqual(JSON.parse(JSON.stringify(presentation.getAiResponseFilters(records))), [
    { value: 'All', label: 'All', count: 4 }, { value: 'No Evidence Found', label: 'No Evidence Found', count: 2 },
  ])
  assert.equal(presentation.isNoEvidenceFound(undefined), false)
  assert.equal(presentation.isNoEvidenceFound('No Evidence Found for this query'), false)
  assert.deepEqual(JSON.parse(JSON.stringify(presentation.getAiResponseFilters([]))), [
    { value: 'All', label: 'All', count: 0 }, { value: 'No Evidence Found', label: 'No Evidence Found', count: 0 },
  ])
})

test('search matches existing question text, responses, and unsaved drafts locally', () => {
  const records = [example, { ...example, id: 'second', name: 'Aircraft value', businessRuleName: 'Sum insured', response: 'USD 100000' }]
  const ids = (query, drafts) => Array.from(presentation.searchAiResponses(records, query, drafts), (item) => item.id)
  assert.deepEqual(ids('  GALLAGHER  '), [example.id])
  assert.deepEqual(ids('aircraft'), ['second'])
  assert.deepEqual(ids('sum insured'), ['second'])
  assert.deepEqual(ids('updated answer', { second: 'Updated answer' }), ['second'])
  assert.deepEqual(ids('no match'), [])
  assert.strictEqual(presentation.searchAiResponses(records, '  '), records)
  assert.equal(records[1].response, 'USD 100000')
})

test('builds counted property filters from explicit rule properties between All and missing evidence', () => {
  const records = [
    { ...example, id: 'a', businessRulePropertyName: 'Mandatory Fields', evidence: 'No Evidence Found' },
    { ...example, id: 'b', businessRulePropertyName: '  mandatory   fields  ' },
    { ...example, id: 'c', businessRulePropertyName: 'Conditional Rules' },
    { ...example, id: 'd', businessRulePropertyName: 'Custom Property', evidence: 'Evidence Not Found' },
    { ...example, id: 'e', businessRulePropertyName: '   ', businessRuleCategory: 'Risk', name: 'Conditional Rules' },
  ]
  const filters = JSON.parse(JSON.stringify(presentation.getAiResponseFilters(records)))
  assert.deepEqual(filters, [
    { value: 'All', label: 'All', count: 5 },
    { value: 'property:conditional rules', label: 'Conditional Rules', count: 1 },
    { value: 'property:custom property', label: 'Custom Property', count: 1 },
    { value: 'property:mandatory fields', label: 'Mandatory Fields', count: 2 },
    { value: 'No Evidence Found', label: 'No Evidence Found', count: 2 },
  ])
  for (const filter of filters) {
    const matches = presentation.filterAiResponses(records, filter.value)
    assert.equal(matches.length, filter.count)
  }
  assert.strictEqual(presentation.filterAiResponses(records, 'All'), records)
  assert.deepEqual(Array.from(presentation.filterAiResponses(records, 'property:mandatory fields'), (record) => record.id), ['a', 'b'])
  assert.deepEqual(Array.from(presentation.filterAiResponses(records, 'No Evidence Found'), (record) => record.id), ['a', 'd'])
})

test('property names matching built-in labels keep distinct filter values', () => {
  const records = [
    { ...example, id: 'a', businessRulePropertyName: 'All', evidence: 'No Evidence Found' },
    { ...example, id: 'b', businessRulePropertyName: 'No Evidence Found' },
  ]
  const filters = presentation.getAiResponseFilters(records)
  assert.equal(new Set(filters.map((filter) => filter.value)).size, 4)
  assert.deepEqual(Array.from(presentation.filterAiResponses(records, 'property:all'), (record) => record.id), ['a'])
  assert.deepEqual(Array.from(presentation.filterAiResponses(records, 'property:no evidence found'), (record) => record.id), ['b'])
})

test('compact cards clamp title and response previews without altering the underlying text', () => {
  const response = 'Long response.\n'.repeat(400)
  const html = render({ ...example, response })
  assert.ok(html.includes(response))
  assert.ok(html.includes('aria-label="AI response cards"'))
  assert.ok(html.includes('line-clamp-2'))
  assert.ok(html.includes('line-clamp-3'))
  assert.ok(html.includes('aria-haspopup="dialog"'))
  assert.equal(html.includes('Show more'), false)
})

test('toolbar retains response filters without a rule-type dropdown', () => {
  const html = render()
  assert.ok(html.includes('aria-label="Response filters"'))
  assert.equal(html.includes('Business rule type'), false)
  assert.equal(html.includes('All rule types'), false)
})

test('summary counts missing Evidence across all records instead of Conditions met', () => {
  const allRecords = [
    { ...example, id: 'a', evidence: 'Evidence Not Found' },
    { ...example, id: 'b', evidence: '  no  evidence found  ' },
    { ...example, id: 'c', response: 'Evidence Not Found', evidence: 'Email signature' },
  ]
  const html = render(example, { allRecords })
  assert.match(html, /Evidence Not Found<\/dt><dd[^>]*>2<\/dd>/)
  assert.equal(html.includes('Conditions met'), false)
  assert.equal(presentation.getAiResponseFilters(allRecords)[1].count, 2)
})

// Exercise the panel's event handlers with persistent hook state, without a DOM dependency.
function panelHarness(records) {
  const state = []
  let cursor = 0
  const { InquiryAiPanel: Panel } = loadPanel({ ...React,
    useState(initial) {
      const index = cursor++
      if (!(index in state)) state[index] = initial
      return [state[index], (value) => { state[index] = typeof value === 'function' ? value(state[index]) : value }]
    },
    useMemo(callback) { return callback() },
    useRef() { return { current: null } },
    useId() { return 'panel-id' },
  })
  const props = { records, allRecords: records, summary: '', loading: false, category: 'All', categories: [],
    drafts: {}, saveStates: {}, onCategory() {}, onDraft() {}, onSave() {}, onReevaluate() {}, onRequestDraft() {}, showRequestDraft: false }
  return {
    render(overrides = {}) {
      Object.assign(props, overrides)
      cursor = 0
      const tree = Panel(props)
      const nodes = []
      function visit(node) {
        if (!node || typeof node !== 'object') return
        if (Array.isArray(node)) return node.forEach(visit)
        nodes.push(node)
        visit(node.props?.children)
      }
      visit(tree)
      return {
        nodes,
        cards: nodes.filter((node) => node.type?.name === 'AiResponseRow'),
        detail: nodes.find((node) => node.type?.name === 'AiResponseContent'),
        close: () => tree.props.onOpenChange(false),
        search: (value) => nodes.find((node) => node.type === 'input').props.onChange({ target: { value } }),
        button: (text) => nodes.find((node) => React.Children.toArray(node.props?.children).includes(text)),
      }
    },
  }
}

test('search filters the cards while retaining each record draft and save callbacks', () => {
  const records = [example,
    { ...example, id: 'b', name: 'Aircraft value', response: 'Value answer' },
    { ...example, id: 'c', name: 'Aircraft use', response: 'Use answer' },
  ]
  const harness = panelHarness(records)
  const saved = []
  const onSave = (id) => saved.push(id)
  let ui = harness.render({ drafts: { c: 'Unsaved use answer' }, onSave })
  assert.deepEqual(ui.cards.map((card) => card.props.item.id), [example.id, 'b', 'c'])
  assert.equal(ui.cards[2].props.draft, 'Unsaved use answer')
  ui.search('aircraft')
  ui = harness.render()
  assert.deepEqual(ui.cards.map((card) => card.props.item.id), ['b', 'c'])
  ui.cards[1].props.onView(null)
  ui = harness.render()
  ui.detail.props.onSave(ui.detail.props.item.id)
  ui.close()
  assert.deepEqual(saved, ['c'])
  ui.search('no matching item')
  ui = harness.render()
  assert.equal(ui.cards.length, 0)
  ui.button('Clear search').props.onClick()
  ui = harness.render()
  assert.equal(ui.cards.length, 3)
  assert.equal(ui.cards[2].props.draft, 'Unsaved use answer')
})

test('empty, loading, and error states are explicit and retain retry', () => {
  assert.ok(render(example, { records: [], allRecords: [] }).includes('No extracted responses linked'))
  assert.ok(render(example, { loading: true }).includes('Loading AI responses'))
  const error = render(example, { error: 'Read denied', onRetry() {} })
  assert.ok(error.includes('role="alert"'))
  assert.ok(error.includes('Try Again'))
  assert.ok(render(example, { records: [] }).includes('No matching items'))
})

test('property chip selection filters cards and combines with response search', () => {
  const records = [
    { ...example, id: 'a', businessRulePropertyName: 'Mandatory Fields' },
    { ...example, id: 'b', businessRulePropertyName: 'Conditional Rules', response: 'Aircraft value confirmed' },
    { ...example, id: 'c', businessRulePropertyName: 'Conditional Rules', response: 'Pilot confirmed' },
  ]
  const categories = presentation.getAiResponseFilters(records)
  const harness = panelHarness(records)
  let selected = 'All'
  let ui = harness.render({ categories, onCategory: (value) => { selected = value } })
  const chip = ui.nodes.find((node) => node.key === 'property:conditional rules')
  chip.props.onClick()
  assert.equal(selected, 'property:conditional rules')
  const filtered = presentation.filterAiResponses(records, selected)
  ui = harness.render({ records: filtered, category: selected })
  assert.equal(ui.nodes.find((node) => node.key === selected).props['aria-pressed'], true)
  assert.deepEqual(ui.cards.map((card) => card.props.item.id), ['b', 'c'])
  ui.search('aircraft')
  ui = harness.render()
  assert.deepEqual(ui.cards.map((card) => card.props.item.id), ['b'])
})

test('detail navigation follows filtered cards and closing preserves search, filter, and drafts', () => {
  const records = [example,
    { ...example, id: 'b', name: 'Aircraft value', response: 'Value answer', businessRulePropertyName: 'Conditional Rules' },
    { ...example, id: 'c', name: 'Aircraft use', response: 'Use answer', businessRulePropertyName: 'Conditional Rules' },
  ]
  const category = 'property:conditional rules'
  const harness = panelHarness(records)
  let ui = harness.render({ records: presentation.filterAiResponses(records, category), category,
    categories: presentation.getAiResponseFilters(records), drafts: { c: 'Unsaved use response' } })
  ui.search('aircraft')
  ui = harness.render()
  ui.cards[0].props.onView(null)
  ui = harness.render()
  assert.equal(ui.detail.props.item.id, 'b')
  assert.equal(ui.button('Previous').props.disabled, true)
  ui.button('Next').props.onClick()
  ui = harness.render()
  assert.equal(ui.detail.props.item.id, 'c')
  assert.equal(ui.detail.props.draft, 'Unsaved use response')
  assert.equal(ui.button('Next').props.disabled, true)
  // Reordering data preserves the selected ID rather than selecting a different card.
  ui = harness.render({ records: [records[2], records[1]] })
  assert.equal(ui.detail.props.item.id, 'c')
  ui = harness.render({ records: [records[1], records[2]] })
  ui.button('Previous').props.onClick()
  ui = harness.render()
  assert.equal(ui.detail.props.item.id, 'b')
  ui.close()
  ui = harness.render()
  assert.equal(ui.detail, undefined)
  assert.equal(ui.nodes.find((node) => node.type === 'input').props.value, 'aircraft')
  assert.equal(ui.nodes.find((node) => node.key === category).props['aria-pressed'], true)
  assert.deepEqual(ui.cards.map((card) => card.props.item.id), ['b', 'c'])
  assert.equal(ui.cards[1].props.draft, 'Unsaved use response')
})

test('full detail preserves complete text and Copy/Edit actions without preview clamps', () => {
  const response = 'Full response with line breaks.\n'.repeat(400)
  const name = 'Full underwriting check title '.repeat(30)
  const record = { ...example, response, name }
  const harness = panelHarness([record])
  let ui = harness.render()
  ui.cards[0].props.onView(null)
  ui = harness.render()
  assert.ok(ui.nodes.some((node) => node.type === 'h3' && node.props.children === name))
  const html = renderToStaticMarkup(ui.detail)
  assert.ok(html.includes(response))
  assert.ok(html.includes('Copy Response'))
  assert.ok(html.includes('Edit response'))
  assert.equal(html.includes('line-clamp'), false)
})

test('saving a response that no longer matches search keeps its detail accessible', () => {
  const harness = panelHarness([example])
  let ui = harness.render()
  ui.search('Gallagher')
  ui = harness.render()
  ui.cards[0].props.onView(null)
  ui = harness.render()
  const updated = { ...example, response: 'New saved answer' }
  ui = harness.render({ records: [updated], allRecords: [updated] })
  assert.equal(ui.cards.length, 0)
  assert.equal(ui.detail.props.item.id, example.id)
  assert.equal(ui.detail.props.draft, 'New saved answer')
  assert.equal(ui.button('Previous').props.disabled, true)
  assert.equal(ui.button('Next').props.disabled, true)
  ui.close()
  ui = harness.render()
  assert.equal(ui.nodes.find((node) => node.type === 'input').props.value, 'Gallagher')
  assert.equal(ui.detail, undefined)
})

test('search handles thousands of items without changing response data', () => {
  const records = Array.from({ length: 10000 }, (_, index) => ({ ...example, id: String(index), name: `Question ${index}`, response: `Answer ${index}` }))
  const result = presentation.searchAiResponses(records, 'Answer 9999')
  assert.equal(result.length, 1)
  assert.strictEqual(result[0], records[9999])
})
