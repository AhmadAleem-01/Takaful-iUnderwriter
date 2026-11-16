const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const guid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const productId = guid(999)
const relationship = 'aur_products_aur_business_rules_aur_business_rules'

function loadService(file, dependencies) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/services', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const context = { exports: {}, require: (name) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`)
    return dependencies[name]
  }, console: { debug() {}, info() {}, table() {} } }
  vm.runInNewContext(code, context)
  return context.exports
}

function harness(respond) {
  const calls = []
  const api = loadService('takafulM2MDebugger.ts', {
    '../generated/services/Aur_TakafulManageManyToManyService': {
      Aur_TakafulManageManyToManyService: { aur_TakafulManageManyToMany: async (...args) => {
        const call = { operation: args[0], relationship: args[1], table: args[2], ids: JSON.parse(args[3]),
          pageSize: args[4], pageNumber: args[5], cookie: args[6], columns: JSON.parse(args[7]),
          productId: args[8], targetColumns: JSON.parse(args[9]) }
        calls.push(call)
        return { success: true, data: { ResultJson: JSON.stringify(await respond(call)) } }
      } },
    },
  })
  return { calls, api, service: loadService('productRuleAssociations.ts', { './takafulM2MDebugger': api }) }
}

test('retrieves every page, preserves the cookie, and handles supported ID shapes', async () => {
  const cookie = '<cookie page="1" />'
  const { service, calls } = harness(({ pageNumber }) => ({ success: true, operation: 'Retrieve',
    records: pageNumber === 1 ? [{ id: `{${guid(1)}}` }] : [{ attributes: { aur_business_rulesid: guid(2) } }, { aur_business_rulesid: guid(1) }],
    moreRecords: pageNumber === 1, pagingCookie: cookie }))
  const ids = await service.getProductRuleIds(`{${productId}}`)
  assert.deepEqual(Array.from(ids), [guid(1), guid(2)])
  assert.equal(calls[1].cookie, cookie)
  assert.equal(calls[1].pageNumber, 2)
  assert.equal(calls[0].relationship, relationship)
  assert.equal(calls[0].table, 'aur_products')
  assert.equal(calls[0].productId, productId)
  assert.deepEqual(calls[0].ids, [])
})

test('adds only missing links, deduplicates IDs, and batches over 100 rules', async () => {
  const { service, calls } = harness(({ operation }) => operation === 'Retrieve'
    ? { operation, records: [{ id: guid(1) }], moreRecords: false }
    : { operation, success: true })
  const selected = Array.from({ length: 103 }, (_, i) => guid(i + 1))
  await service.associateProductRules(productId, [...selected, guid(2)])
  const mutations = calls.filter((call) => call.operation !== 'Retrieve')
  assert.deepEqual(mutations.map((call) => call.operation), ['Associate', 'Associate'])
  assert.deepEqual(mutations.map((call) => call.ids.length), [100, 2])
  assert.deepEqual(mutations.flatMap((call) => call.ids), selected.slice(1))
})

test('unchanged selection sends no mutation and does not unlink other existing rules', async () => {
  const { service, calls } = harness(() => ({ operation: 'Retrieve', records: [{ id: guid(1) }, { id: guid(2) }], moreRecords: false }))
  await service.associateProductRules(productId, [guid(1)])
  assert.equal(calls.length, 1)
  assert.equal(calls[0].operation, 'Retrieve')
})

test('removes only the requested product-rule link', async () => {
  const { service, calls } = harness(({ operation }) => ({ success: true, operation }))
  await service.disassociateProductRule(`{${productId}}`, `{${guid(1)}}`)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].operation, 'Disassociate')
  assert.deepEqual(calls[0].ids, [guid(1)])
  assert.equal(calls[0].productId, productId)
})

test('validates later batches before making any change', async () => {
  const { service, calls } = harness(() => { throw new Error('Should not call API') })
  await assert.rejects(service.associateProductRules(productId, [...Array.from({ length: 101 }, (_, i) => guid(i)), 'invalid']), /valid GUID/)
  assert.equal(calls.length, 0)
  await assert.rejects(service.getProductRuleIds(''), /product ID is required/)
})

test('surfaces errors inside ResultJson and stops subsequent mutation batches', async () => {
  const { service, calls } = harness(({ operation }) => operation === 'Retrieve'
    ? { operation, records: [], moreRecords: false }
    : { success: false, error: { message: 'Association denied' } })
  await assert.rejects(service.associateProductRules(productId, Array.from({ length: 102 }, (_, i) => guid(i))), /Association denied/)
  assert.equal(calls.filter((call) => call.operation === 'Associate').length, 1)
})

test('rejects malformed retrieval rows rather than silently treating them as unlinked', async () => {
  const { service } = harness(() => ({ operation: 'Retrieve', records: [{ aur_name: 'Missing ID' }], moreRecords: false }))
  await assert.rejects(service.getProductRuleIds(productId), /without a valid ID/)
})
