const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const inquiryId = '00000000-0000-0000-0000-000000000001'
const productId = '00000000-0000-0000-0000-000000000002'
const inquiryPlanId = '00000000-0000-0000-0000-000000000003'
const selectedPlanId = '00000000-0000-0000-0000-000000000004'
const quoteId = '00000000-0000-0000-0000-000000000005'

function service(planProductId = productId) {
  const created = [], updates = []
  const dependencies = {
    '../generated/services/Aur_inquiriesService': { Aur_inquiriesService: { get: async () => ({ success: true, data: {
      aur_name: 'Inquiry', aur_inquiry_number: 'INQ-1', _aur_product_value: productId,
      _aur_plan_value: inquiryPlanId, aur_total_premium_to_be_charged: 1200, aur_gross_premium: 1000,
    } }) } },
    '../generated/services/Aur_plansService': { Aur_plansService: { get: async () => ({ success: true, data: { _aur_product_value: planProductId, aur_vat: 50 } }) } },
    '../generated/services/Aur_quotesService': { Aur_quotesService: {
      create: async (record) => { created.push(record); return { success: true, data: { aur_quoteid: quoteId } } },
      get: async () => ({ success: true, data: { _aur_inquiry_value: inquiryId, _aur_plan_value: selectedPlanId } }),
      getAll: async () => ({ success: true, data: [{ aur_quoteid: 'older-quote' }] }),
      update: async (_id, fields) => { updates.push(fields); return { success: true } },
    } },
    '../lib/quoteNumbers': { quoteWholeNumber: (value) => value },
  }
  const context = { exports: {}, require: (name) => dependencies[name] ?? {} }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/services/inquiriesService.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context)
  return { create: context.exports.createQuoteFromInquiry, created, updates }
}

test('creates the quote with the selected product plan, even when the inquiry has another plan', async () => {
  const fixture = service()
  assert.equal(await fixture.create(inquiryId, selectedPlanId), quoteId)
  assert.equal(fixture.created.length, 1)
  assert.equal(fixture.created[0]['aur_plan@odata.bind'], `/aur_plans(${selectedPlanId})`)
  assert.equal(fixture.created[0]['aur_product@odata.bind'], `/aur_productses(${productId})`)
  assert.equal(fixture.created[0].aur_total_premium, 1200)
  assert.equal(fixture.created[0].aur_gross_premium, 1000)
  assert.equal(fixture.created[0].aur_loading_premium, 100)
  assert.equal(fixture.created[0].aur_vat, 50)
  assert.equal(fixture.updates[0].statecode, 1)
  assert.equal(fixture.updates[0].statuscode, 2)
})

test('rejects a plan outside the inquiry product before creating a quote', async () => {
  const fixture = service(inquiryId)
  await assert.rejects(fixture.create(inquiryId, selectedPlanId), /does not belong to the inquiry product/)
  assert.equal(fixture.created.length, 0)
})
