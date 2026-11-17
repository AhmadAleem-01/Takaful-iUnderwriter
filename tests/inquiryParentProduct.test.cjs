const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const parentId = '00000000-0000-0000-0000-000000000001'
const childId = '00000000-0000-0000-0000-000000000002'

function load() {
  const updates = []
  const services = {
    Aur_inquiriesService: { update: async (id, payload) => { updates.push({ id, payload }); return { success: true } } },
    Aur_productsesService: { getAll: async () => ({ data: [{ aur_productsid: `{${parentId}}`, aur_name: 'Parent' }] }) },
    Aur_plansService: { getAll: async () => ({ data: [] }) },
    AccountsService: { getAll: async () => ({ data: [] }) },
    ContactsService: { getAll: async () => ({ data: [] }) },
  }
  const context = { exports: {}, console: { info() {} }, require: (name) => {
    if (name.includes('inquiryPurposesService')) return { getInquiryPurposeOptions: async () => [{ value: parentId, label: 'For Quotation' }] };
    if (name.includes('Aur_line_of_businessesService')) throw new Error('Obsolete lookup table used')
    const key = name.split('/').at(-1)
    return services[key] ? { [key]: services[key] } : {}
  } }
  const source = fs.readFileSync(path.join(__dirname, '../src/services/inquiriesService.ts'), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context)
  return { api: context.exports, updates }
}

test('parent product options come from the products table', async () => {
  const { api } = load()
  const options = await api.getInquiryEditorOptions()
  assert.equal(options.parentProducts[0].id, parentId)
  assert.equal(options.parentProducts[0].name, 'Parent')
})

test('parent and child product bindings remain independent and parent can be cleared', async () => {
  const { api, updates } = load()
  await api.saveInquiryDetail('inquiry', { name: 'Inquiry', parentProductId: `{${parentId}}`, productId: childId })
  assert.equal(updates[0].payload['aur_line_of_business@odata.bind'], `/aur_productses(${parentId})`)
  assert.equal(updates[0].payload['aur_product@odata.bind'], `/aur_productses(${childId})`)
  await api.saveInquiryDetail('inquiry', { name: 'Inquiry', parentProductId: null })
  assert.equal(updates[1].payload['aur_line_of_business@odata.bind'], null)
  await api.saveInquiryDetail('inquiry', { name: 'Inquiry' })
  assert.equal(Object.hasOwn(updates[2].payload, 'aur_line_of_business@odata.bind'), false)
})

test('inquiry purpose uses a lookup binding, supports clearing, and preserves omitted values', async () => {
  const { api, updates } = load()
  await api.saveInquiryDetail('inquiry', { name: 'Inquiry', inquiryPurpose: `{${parentId}}` })
  assert.equal(updates[0].payload['aur_inquiry_purpose@odata.bind'], `/aur_inquiry_purposes(${parentId})`)
  assert.equal(Object.hasOwn(updates[0].payload, 'aur_inquiry_purpose'), false)
  await api.saveInquiryDetail('inquiry', { name: 'Inquiry', inquiryPurpose: null })
  assert.equal(updates[1].payload['aur_inquiry_purpose@odata.bind'], null)
  await api.saveInquiryDetail('inquiry', { name: 'Inquiry' })
  assert.equal(Object.hasOwn(updates[2].payload, 'aur_inquiry_purpose@odata.bind'), false)
  const options = await api.getInquiryEditorOptions()
  assert.equal(options.inquiryPurposes[0].value, parentId)
})
