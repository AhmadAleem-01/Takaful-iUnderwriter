const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
function load(file, mocks = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require(name) { if (name in mocks) return mocks[name]; throw new Error(`Unexpected import: ${name}`) } })
  return exports
}
const paths = load('src/lib/templateFieldPaths.ts')
const parser = load('src/lib/emailTemplateFields.ts')
const tables = ['quotes', 'inquiries', 'products', 'plans', 'accounts', 'contacts'].map((name) => parser.parseTemplateFieldTable(JSON.parse(fs.readFileSync(path.join(__dirname, `../.power/schemas/dataverse/${name}.Schema.json`), 'utf8'))))
const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const relation = (field, table) => ({ ReferencingAttribute: field, ReferencedEntity: table })

function fixture({ relations = {}, records = {}, metadataFailure = false, catalog = tables } = {}) {
  const calls = { metadata: [], records: [] }
  const client = {
    executeAsync: async ({ dataverseRequest }) => {
      const { tableName, options } = dataverseRequest.parameters
      assert.equal(options.schema.manyToOne, true)
      calls.metadata.push(tableName)
      return metadataFailure ? { success: false } : { success: true, data: { ManyToOneRelationships: relations[tableName] ?? [] } }
    },
    retrieveRecordAsync: async (table, recordId) => {
      calls.records.push([table, recordId])
      return records[`${table}:${recordId}`] ? { success: true, data: records[`${table}:${recordId}`] } : { success: false }
    },
  }
  return { calls, ...load('src/services/templateRelatedFieldsService.ts', {
    '@microsoft/power-apps/data': { getClient: () => client },
    '../../.power/schemas/appschemas/dataSourcesInfo': { dataSourcesInfo: {} },
    '../lib/templateFieldPaths': paths,
    './emailTemplateFieldsService': { getEmailTemplateFieldTables: async () => catalog },
  }) }
}

test('constructs anchored related tokens and validates the field path against connected schemas', () => {
  const field = tables.find((t) => t.name === 'aur_products').fields.find((f) => f.name === 'aur_heading')
  const related = paths.relatedTemplateField('aur_quote', [{ field: 'aur_product', table: 'aur_products' }], field, 'Product › Heading')
  assert.equal(related.token, '{!aur_quote:aur_product[aur_products].aur_heading;}')
  assert.equal(paths.templateFieldFromPath(related.token, tables).label, 'Product › Heading')
  assert.equal(paths.parseTemplateFieldPath('{!aur_quote:aur_product[https://evil].aur_heading;}'), null)
  assert.equal(paths.templateFieldFromPath('{!aur_quote:aur_total_premium[account].name;}', tables), null)
  assert.equal(paths.parseTemplateFieldPath(`{!aur_quote:${'aur_product[aur_products].'.repeat(6)}aur_name;}`), null)
})

test('loads the actual lookup target from Dataverse relationship metadata and caches it', async () => {
  const service = fixture({ relations: { aur_quotes: [relation('aur_product', 'aur_products')] } })
  const quote = tables.find((table) => table.name === 'aur_quote')
  assert.equal((await service.getTemplateLookupTargets(quote, 'aur_product', tables))[0].table, 'aur_products')
  await service.getTemplateLookupTargets(quote, 'aur_product', tables)
  assert.deepEqual(service.calls.metadata, ['aur_quotes'])
  assert.equal((await service.getTemplateLookupTargets(quote, 'aur_total_premium', tables)).length, 0)
})

test('the refreshed Quote Inquiry field matches live relationship metadata', async () => {
  const quote = tables.find((table) => table.name === 'aur_quote')
  const field = quote.fields.find((item) => item.label === 'Inquiry')
  assert.equal(field.name, 'aur_inquiry')
  const service = fixture({ relations: { aur_quotes: [relation('aur_inquiry', 'aur_inquiry')] } })
  const targets = await service.getTemplateLookupTargets(quote, field.name, tables)
  assert.equal(targets.length, 1)
  assert.equal(targets[0].table, 'aur_inquiry')
})

test('stale lookup names report schema mismatch instead of incorrectly claiming no connection', async () => {
  const quote = tables.find((table) => table.name === 'aur_quote')
  const stale = { ...quote, fields: [...quote.fields, { name: 'aur_quotes', label: 'Inquiry', type: 'Lookup', token: '{!aur_quote:aur_quotes/@name;}' }] }
  const service = fixture({ relations: { aur_quotes: [relation('aur_inquiry', 'aur_inquiry')] } })
  await assert.rejects(service.getTemplateLookupTargets(stale, 'aur_quotes', tables), /table schema needs refreshing/)
})

test('older saved Inquiry paths resolve through the current aur_inquiry lookup', async () => {
  const token = '{!aur_quote:aur_quotes[aur_inquiry].aur_name;}'
  assert.equal(paths.parseTemplateFieldPath(token).lookups[0].field, 'aur_inquiry')
  assert.equal(paths.templateFieldFromPath(token, tables).label, 'Inquiry › Name')
  const service = fixture({ relations: { aur_quotes: [relation('aur_inquiry', 'aur_inquiry')] } })
  const result = await service.resolveRelatedTemplateContext({ Quote: { _aur_inquiry_value: id(2) }, Inquiry: { aur_inquiryid: id(2), aur_name: 'Current Inquiry' } }, 'aur_quote', token)
  assert.equal(result['aur_quote:aur_inquiry[aur_inquiry]'].aur_name, 'Current Inquiry')
})

test('does not guess targets when metadata fails or the related table is not connected', async () => {
  const quote = tables.find((table) => table.name === 'aur_quote')
  const service = fixture({ metadataFailure: true })
  await assert.rejects(service.getTemplateLookupTargets(quote, 'aur_product', tables), /could not be loaded/)
  await assert.rejects(service.getTemplateLookupTargets(quote, 'aur_product', tables), /could not be loaded/)
  assert.equal(service.calls.metadata.length, 2, 'failed metadata loads must remain retryable')
  const unavailable = fixture({ relations: { aur_quotes: [relation('ownerid', 'systemuser')] } })
  assert.equal((await unavailable.getTemplateLookupTargets(quote, 'ownerid', tables)).length, 0)
})

test('reuses the selected product snapshot and loads only records requested by related fields', async () => {
  const service = fixture({ relations: { aur_quotes: [relation('aur_product', 'aur_products')] } })
  const context = { Quote: { aur_quoteid: id(1), _aur_product_value: id(2) }, Product: { aur_productsid: id(2), aur_heading: 'Current product heading' } }
  const result = await service.resolveRelatedTemplateContext(context, 'aur_quote', '<p>{!aur_quote:aur_product[aur_products].aur_heading;}</p>')
  assert.equal(result['aur_quote:aur_product[aur_products]'].aur_heading, 'Current product heading')
  assert.equal(service.calls.records.length, 0)
  await service.resolveRelatedTemplateContext(context, 'aur_quote', '<p>{!aur_quote:aur_name;}</p>')
  assert.equal(service.calls.metadata.length, 1)
})

test('traverses multiple lookups and distinguishes insured-company from broker-company fields', async () => {
  const service = fixture({
    relations: { aur_quotes: [relation('aur_inquiry', 'aur_inquiry')], aur_inquiries: [relation('aur_insured_company', 'account'), relation('aur_broker_company', 'account')] },
    records: { [`accounts:${id(3)}`]: { emailaddress1: 'insured@example.test' }, [`accounts:${id(4)}`]: { emailaddress1: 'broker@example.test' } },
  })
  const content = '<p>{!aur_quote:aur_inquiry[aur_inquiry].aur_insured_company[account].emailaddress1;} {!aur_quote:aur_inquiry[aur_inquiry].aur_broker_company[account].emailaddress1;} {!aur_quote:aur_inquiry[aur_inquiry].aur_insured_company[account].name;}</p>'
  const context = { Quote: { _aur_inquiry_value: id(2) }, Inquiry: { aur_inquiryid: id(2), _aur_insured_company_value: id(3), _aur_broker_company_value: id(4) } }
  const result = await service.resolveRelatedTemplateContext(context, 'aur_quote', content)
  assert.equal(result['aur_quote:aur_inquiry[aur_inquiry].aur_insured_company[account]'].emailaddress1, 'insured@example.test')
  assert.equal(result['aur_quote:aur_inquiry[aur_inquiry].aur_broker_company[account]'].emailaddress1, 'broker@example.test')
  assert.equal(service.calls.records.length, 2)
  assert.deepEqual(service.calls.metadata, ['aur_quotes', 'aur_inquiries'])
})

test('missing lookup records stay missing and relationship mismatches cannot load arbitrary tables', async () => {
  const service = fixture({ relations: { aur_quotes: [relation('aur_product', 'aur_products')] } })
  const result = await service.resolveRelatedTemplateContext({ Quote: {} }, 'aur_quote', '{!aur_quote:aur_product[aur_products].aur_heading;}')
  assert.equal(Object.keys(result['aur_quote:aur_product[aur_products]']).length, 0)
  assert.equal(service.calls.records.length, 0)
  await assert.rejects(service.resolveRelatedTemplateContext({ Quote: { _aur_product_value: id(1) } }, 'aur_quote', '{!aur_quote:aur_product[account].name;}'), /does not match/)
  assert.equal(service.calls.records.length, 0)
})

test('lookup targets with multiple record types honor the actual type annotation', async () => {
  const quote = tables.find((table) => table.name === 'aur_quote')
  const catalog = [{ ...quote, fields: [...quote.fields, { name: 'customerid', label: 'Customer', type: 'Lookup', token: '{!aur_quote:customerid/@name;}' }] }, ...tables.filter((table) => table.name !== 'aur_quote')]
  const service = fixture({ catalog, relations: { aur_quotes: [relation('customerid', 'account'), relation('customerid', 'contact')] }, records: { [`contacts:${id(5)}`]: { fullname: 'Contact Customer' } } })
  const context = { Quote: { _customerid_value: id(5), '_customerid_value@Microsoft.Dynamics.CRM.lookuplogicalname': 'contact' } }
  const wrong = await service.resolveRelatedTemplateContext(context, 'aur_quote', '{!aur_quote:customerid[account].name;}')
  assert.equal(Object.keys(wrong['aur_quote:customerid[account]']).length, 0)
  assert.equal(service.calls.records.length, 0)
  const right = await service.resolveRelatedTemplateContext(context, 'aur_quote', '{!aur_quote:customerid[contact].fullname;}')
  assert.equal(right['aur_quote:customerid[contact]'].fullname, 'Contact Customer')
  await assert.rejects(service.resolveRelatedTemplateContext({ Quote: { _customerid_value: id(5) } }, 'aur_quote', '{!aur_quote:customerid[account].name;}'), /record type is unavailable/)
})

test('related-record read failures are surfaced instead of producing misleading documents', async () => {
  const service = fixture({ relations: { aur_quotes: [relation('aur_product', 'aur_products')] } })
  await assert.rejects(service.resolveRelatedTemplateContext({ Quote: { _aur_product_value: id(2) } }, 'aur_quote', '{!aur_quote:aur_product[aur_products].aur_heading;}'), /could not be loaded/)
  await assert.rejects(service.resolveRelatedTemplateContext({ Quote: { _aur_product_value: 'invalid' } }, 'aur_quote', '{!aur_quote:aur_product[aur_products].aur_heading;}'), /invalid identifier/)
})
