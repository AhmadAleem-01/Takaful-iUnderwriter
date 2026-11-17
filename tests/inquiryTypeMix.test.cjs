const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const context = { exports: {} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/inquiryTypeMix.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context)
const { normalizeInquiryMix, inquiryMixShare, inquiryMixTooltip } = context.exports

test('normalization fixes known category order and includes missing zero categories', () => {
  const result = normalizeInquiryMix([{ label: 'Claims', value: 2 }, { label: 'Renewal', value: 1 }])
  assert.equal(JSON.stringify(result), JSON.stringify([
    { label: 'New', value: 0 }, { label: 'Renewal', value: 1 }, { label: 'Endorsement', value: 0 }, { label: 'Claims', value: 2 },
  ]))
})

test('normalization preserves unexpected types and combines repeated known categories', () => {
  const result = normalizeInquiryMix([{ label: ' renewal ', value: 1 }, { label: 'Renewal', value: 2 }, { label: 'Other', value: 3 }])
  assert.equal(result[1].value, 3)
  assert.equal(result[4].label, 'Other')
  assert.equal(result.reduce((sum, item) => sum + item.value, 0), 6)
})

test('empty mixes retain all four categories and percentage division is guarded', () => {
  assert.equal(normalizeInquiryMix([]).length, 4)
  assert.equal(normalizeInquiryMix([]).reduce((sum, item) => sum + item.value, 0), 0)
  assert.equal(inquiryMixShare(0, 0), 0)
  assert.equal(inquiryMixShare(1, 2), 50)
})

test('tooltips use live counts, percentages, and correct singular and plural text', () => {
  assert.equal(inquiryMixTooltip('Renewal', 1, 2), 'Renewal · 1 inquiry · 50% of intake')
  assert.equal(inquiryMixTooltip('New', 2, 3), 'New · 2 inquiries · 67% of intake')
  assert.equal(inquiryMixTooltip('Claims', 0, 0), 'Claims · 0 inquiries · 0% of intake')
})
