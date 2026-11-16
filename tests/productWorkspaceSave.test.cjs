const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const duplicateLogicContext = { exports: {} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/inquiryDuplicates.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, duplicateLogicContext)
const duplicateLogic = duplicateLogicContext.exports

const id = '00000000-0000-0000-0000-000000000001'
function load(products, rules = { getAll: async () => ({ success: true, data: [] }) }) {
  const dependencies = {
    '../generated': {
      Aur_productsesService: products,
      Aur_plansService: { getAll: async () => ({ data: [] }) },
      Aur_business_rulesesService: rules,
    },
    './dataMappers': { mapProductSummary: (product) => ({ id: product.aur_productsid, name: product.aur_name }) },
    './productRuleAssociations': { getProductRuleIds: async () => [] },
    '../lib/inquiryDuplicates': duplicateLogic,
  }
  const context = { exports: {}, require: (name) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`)
    return dependencies[name]
  } }
  const source = fs.readFileSync(path.join(__dirname, '../src/services/productWorkspaceService.ts'), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context)
  return context.exports
}

test('reports SDK update failures instead of treating them as saved', async () => {
  const service = load({ update: async () => ({ success: false, error: { message: 'Write access denied' } }) })
  await assert.rejects(service.saveProductWorkspace({ id, name: 'Changed' }), /Write access denied/)
})

test('reports create failures, including failures without an SDK message', async () => {
  const service = load({ create: async () => ({ success: false }) })
  await assert.rejects(service.saveProductWorkspace({ name: 'New' }), /Unable to create product/)
})

test('saves editable fields and reloads the updated product directly by normalized ID', async () => {
  let stored = { aur_productsid: id, aur_name: 'Old', aur_product_status: 751820000 }
  let getId
  const service = load({
    update: async (recordId, record) => {
      assert.equal(recordId, id)
      assert.equal('aur_apply_action_automatically' in record, false)
      stored = { ...stored, ...record }
      return { success: true }
    },
    get: async (recordId) => { getId = recordId; return { success: true, data: stored } },
    getAll: async () => { throw new Error('Must not reload an edited product from a list') },
  })
  await service.saveProductWorkspace({ id: `{${id}}`, name: 'Updated', details: 'New details', arabicName: 'Arabic name',
    emailAddress: 'product@example.com', premiumPercentage: '12.5', status: 'publish', applyActionAutomatically: false })
  const workspace = await service.getProductWorkspace(`{${id}}`)
  assert.equal(getId, id)
  assert.equal(workspace.summary.name, 'Updated')
  assert.equal(workspace.metadata.details, 'New details')
  assert.equal(workspace.metadata.arabicName, 'Arabic name')
  assert.equal(workspace.metadata.emailAddress, 'product@example.com')
  assert.equal(workspace.metadata.premiumPercentage, '12.5')
  assert.equal(workspace.metadata.status, 'publish')
})

test('loads and saves duplicate criteria on the parent product without changing it on ordinary saves', async () => {
  const criteria = fs.readFileSync(path.join(__dirname, '../config/duplicate-inquiry/aviation.json'), 'utf8')
  let stored = { aur_productsid: id, aur_name: 'Aviation', aur_duplicate_inquiry_criteria: 'Legacy prose' }
  const updates = []
  const service = load({
    get: async () => ({ success: true, data: stored }),
    update: async (_id, record) => { updates.push(record); stored = { ...stored, ...record }; return { success: true } },
  })
  assert.equal((await service.getProductWorkspace(id)).metadata.duplicateCriteria, 'Legacy prose')
  await service.saveProductWorkspace({ id, name: 'Aviation' })
  assert.equal('aur_duplicate_inquiry_criteria' in updates[0], false)
  await service.saveProductWorkspace({ id, name: 'Aviation', duplicateCriteria: criteria })
  assert.equal(updates[1].aur_duplicate_inquiry_criteria, criteria)
  assert.equal((await service.getProductWorkspace(id)).metadata.duplicateCriteria, criteria)
})

test('rejects incomplete duplicate rules before writing to Dataverse', async () => {
  let called = false
  const service = load({ update: async () => { called = true; return { success: true } } })
  await assert.rejects(service.saveProductWorkspace({ id, name: 'Aviation', duplicateCriteria: '{"version":1}' }), /Complete the duplicate inquiry rule/)
  assert.equal(called, false)
})

test('reports failed product reads instead of initializing an empty editor', async () => {
  const service = load({ get: async () => ({ success: false, error: { message: 'Read denied' } }) })
  await assert.rejects(service.getProductWorkspace(id), /Read denied/)
})

test('auto-action failures reach the UI so its optimistic toggle can roll back', async () => {
  const service = load({ update: async () => ({ success: false, error: { message: 'Unknown column' } }) })
  await assert.rejects(service.updateProductAutoActionSetting(id, true), /Unknown column/)
})

test('resolves property names from lookup IDs across all library pages', async () => {
  const calls = []
  const service = load({ get: async () => ({ success: true, data: { aur_productsid: id, aur_name: 'Product' } }) }, {
    getAll: async (options) => {
      calls.push(options)
      return { success: true, skipToken: options.skipToken ? undefined : 'next', data: options.skipToken
        ? [{ aur_business_rulesid: 'parent', aur_name: 'Mandatory Fields' }]
        : [{ aur_business_rulesid: 'child', aur_name: 'Coverage document requirement', _aur_properties_value: '{PARENT}' }] }
    },
  })
  const workspace = await service.getProductWorkspace(id)
  assert.equal(calls.length, 2)
  assert.equal(calls[1].skipToken, 'next')
  assert.equal(workspace.availableRules.find((rule) => rule.id === 'child').propertyRuleName, 'Mandatory Fields')
})
