const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const productId = '00000000-0000-0000-0000-000000000001'
function load(getAll) {
  const context = { exports: {}, require: (name) => {
    if (name.endsWith('Aur_coveragesesModel')) {
      const model = { exports: {} }
      vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/generated/models/Aur_coveragesesModel.ts'), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText, model)
      return model.exports
    }
    return { Aur_coveragesesService: { getAll } }
  } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/services/productCoveragesService.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context)
  return context.exports.getProductCoverages
}

test('loads all pages and excludes coverages linked to other products', async () => {
  const calls = []
  const get = load(async (options) => {
    calls.push(options)
    return { success: true, skipToken: options.skipToken ? undefined : 'next-page', data: options.skipToken
      ? [{ aur_coveragesid: 'second', aur_name: 'Second', _aur_product_value: productId }]
      : [{ aur_coveragesid: 'first', aur_name: 'First', _aur_product_value: `{${productId}}`, aur_description: 'Details', aur_typename: 'Full Coverage', aur_applicablename: 'Mandatory Cover' },
        { aur_coveragesid: 'other', aur_name: 'Other product', _aur_product_value: '00000000-0000-0000-0000-000000000002' }] }
  })
  const records = await get(`{${productId}}`)
  assert.deepEqual(Array.from(records, (record) => record.id), ['first', 'second'])
  assert.equal(calls[0].filter, `_aur_product_value eq ${productId}`)
  assert.equal(calls[1].skipToken, 'next-page')
  assert.equal(records[0].description, 'Details')
  assert.equal(records[0].context, 'Full Coverage')
  assert.equal(records[0].detail, 'Mandatory Cover')
})

test('new products load no records and invalid IDs cannot generate a query', async () => {
  const get = load(async () => { throw new Error('Unexpected API call') })
  assert.equal((await get()).length, 0)
  await assert.rejects(get('invalid'), /valid product ID/)
})

test('surfaces API failures instead of showing an empty coverage list', async () => {
  const get = load(async () => ({ success: false, error: { message: 'Coverage read denied' } }))
  await assert.rejects(get(productId), /Coverage read denied/)
})

test('uses aur_coverage_type labels rather than the separate aur_type field', async () => {
  const get = load(async () => ({ success: true, data: [
    { aur_coveragesid: 'choice', aur_name: 'A', _aur_product_value: productId, aur_coverage_type: 1, aur_coverage_typename: 'Main Covers', aur_typename: 'Full Coverage' },
    { aur_coveragesid: 'formatted', aur_name: 'B', _aur_product_value: productId, aur_coverage_type: 2, 'aur_coverage_type@OData.Community.Display.V1.FormattedValue': 'Additional Covers' },
    { aur_coveragesid: 'text', aur_name: 'C', _aur_product_value: productId, aur_coverage_type: 'Special Covers' },
    { aur_coveragesid: 'missing', aur_name: 'D', _aur_product_value: productId, aur_coverage_type: 3, aur_typename: 'Full Coverage' },
  ] }))
  assert.deepEqual(Array.from(await get(productId), (coverage) => coverage.coverageType), ['Main Covers', 'Additional Covers', 'Special Covers', 'Inclusions'])
})

test('resolves all eight synced numeric choices without formatted labels', async () => {
  const get = load(async () => ({ success: true, data: Array.from({ length: 8 }, (_, index) => ({
    aur_coveragesid: String(index), aur_name: 'Coverage', _aur_product_value: productId, aur_coverage_type: index + 1,
  })) }))
  assert.deepEqual(Array.from(await get(productId), (coverage) => coverage.coverageType), [
    'Coverages', 'Benefits', 'Inclusions', 'Exclusions', 'Warranties', 'Deductibles', 'Conditions', 'RI Conditions',
  ])
})

test('keeps missing or unknown choice values Uncategorized', async () => {
  const get = load(async () => ({ success: true, data: [undefined, null, 999].map((value, index) => ({
    aur_coveragesid: String(index), aur_name: 'Coverage', _aur_product_value: productId, aur_coverage_type: value,
  })) }))
  assert.deepEqual(Array.from(await get(productId), (coverage) => coverage.coverageType), ['Uncategorized', 'Uncategorized', 'Uncategorized'])
})
