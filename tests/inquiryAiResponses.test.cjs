const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const inquiryId = '00000000-0000-0000-0000-000000000001'
const ruleId = '00000000-0000-0000-0000-000000000002'

function compile(file, resolve = () => ({})) {
  const context = { exports: {}, require: resolve, console: { info() {}, debug() {}, error() {}, table() {} } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context)
  return context.exports
}

function load(responses, rules) {
  const mapper = compile('services/dataMappers.ts')
  return compile('services/inquiriesService.ts', (name) => {
    if (name === './dataMappers') return mapper
    if (name.endsWith('/Aur_ai_extracted_responsesService')) return { Aur_ai_extracted_responsesService: responses }
    if (name.endsWith('/Aur_business_rulesesService')) return { Aur_business_rulesesService: rules }
    if (name.endsWith('/Aur_business_rulesesModel')) return compile('generated/models/Aur_business_rulesesModel.ts')
    if (name.endsWith('/aiResponsePresentation')) return compile('lib/aiResponsePresentation.ts')
    return {}
  })
}

test('loads customer information explicitly when the default inquiry response omits it', async () => {
  const queries = []
  const customerInformation = 'CUSTOMER EMAIL SUBJECT: Neos renewal\nCUSTOMER EMAIL BODY:\nOriginal email text.'
  const service = compile('services/inquiriesService.ts', (name) => {
    if (name === './dataMappers') return {
      mapInquiryDetail: (record) => ({ id: record.aur_inquiryid, customerData: record.aur_customer_information }),
      buildWorkflow: () => [], mapRelatedParty: () => undefined,
    }
    if (name.endsWith('/Aur_inquiriesService')) return { Aur_inquiriesService: { get: async (_id, options) => {
      queries.push(options)
      return { data: options?.select?.includes('aur_customer_information')
        ? { aur_customer_information: customerInformation }
        : { aur_inquiryid: inquiryId } }
    } } }
    for (const key of ['Aur_productsesService', 'Aur_plansService', 'AccountsService']) {
      if (name.endsWith(`/${key}`)) return { [key]: { getAll: async () => ({ data: [] }) } }
    }
    return {}
  })
  const inquiry = await service.getInquiryDetailCore(inquiryId)
  assert.equal(inquiry.customerData, customerInformation)
  assert.equal(queries.some((query) => query?.select?.includes('aur_customer_information')), true)
})

test('loads the new table by Inquiry lookup across every page independently of other workspace services', async () => {
  const queries = []
  const service = load({ getAll: async (options) => {
    queries.push(options)
    return { success: true, skipToken: options.skipToken ? undefined : 'second-page', data: [{
      aur_ai_extracted_responseid: options.skipToken ? 'second' : 'first',
      _aur_business_rule_value: ruleId, aur_name: 'Extraction', aur_response: 'Yes', aur_evidence: 'Submitted file', aur_confidence_score: 95,
    }] }
  } }, { getAll: async () => ({ success: true, data: [{ aur_business_rulesid: ruleId, aur_name: 'Risk Check', aur_categoriesname: 'Risk' }] }) })
  const records = await service.getInquiryAiExtractedResponses(`{${inquiryId}}`)
  assert.equal(queries[0].filter, `_aur_inquiry_value eq ${inquiryId}`)
  assert.equal(queries[1].skipToken, 'second-page')
  assert.deepEqual(Array.from(records, (record) => record.id), ['first', 'second'])
  assert.equal(records[0].businessRuleName, 'Risk Check')
  assert.equal(records[0].response, 'Yes')
  assert.equal(records[0].confidenceScore, 95)
})

test('does not turn an SDK query failure into an empty result', async () => {
  const service = load({ getAll: async () => ({ success: false, error: { message: 'AI table read denied' }, data: [] }) })
  await assert.rejects(service.getInquiryAiExtractedResponses(inquiryId), /AI table read denied/)
})

test('shares concurrent reads but allows a fresh retry after failure', async () => {
  let calls = 0
  const service = load({ getAll: async () => {
    calls += 1
    if (calls === 1) return { success: false, error: { message: 'Temporary failure' } }
    return { success: true, data: [] }
  } })
  const failed = await Promise.allSettled([service.getInquiryAiExtractedResponses(inquiryId), service.getInquiryAiExtractedResponses(inquiryId)])
  assert.equal(calls, 1)
  assert.equal(failed.every((result) => result.status === 'rejected'), true)
  assert.equal((await service.getInquiryAiExtractedResponses(inquiryId)).length, 0)
  assert.equal(calls, 2)
})

test('empty linked-response results require no business-rule lookup', async () => {
  const service = load({ getAll: async () => ({ success: true, data: [] }) }, { getAll: async () => { throw new Error('Unexpected rule lookup') } })
  assert.equal((await service.getInquiryAiExtractedResponses(inquiryId)).length, 0)
})

test('response saves surface SDK errors instead of returning an unsaved draft', async () => {
  const service = load({ update: async () => ({ success: false, error: { message: 'AI response save denied' } }) })
  await assert.rejects(service.updateInquiryAiExtractedResponse('response', 'Edited response'), /AI response save denied/)
})

test('determines conditional rules through the Business Rule Properties self-lookup', async () => {
  const parentId = '00000000-0000-0000-0000-000000000003'
  let ruleReads = 0
  const service = load({ getAll: async () => ({ success: true, data: [{ aur_ai_extracted_responseid: 'response', _aur_business_rule_value: ruleId }] }) }, {
    getAll: async () => ({ success: true, data: ++ruleReads === 1
      ? [{ aur_business_rulesid: ruleId, aur_name: 'Aircraft cover check', _aur_properties_value: `{${parentId}}` }]
      : [{ aur_business_rulesid: parentId, aur_name: 'Conditional Rules' }] }),
  })
  const [record] = await service.getInquiryAiExtractedResponses(inquiryId)
  assert.equal(ruleReads, 2)
  assert.equal(record.businessRulePropertyName, 'Conditional Rules')
  assert.equal(record.isConditionalRule, true)
})

test('does not infer conditional type from a business-rule name', async () => {
  const service = load({ getAll: async () => ({ success: true, data: [{ aur_ai_extracted_responseid: 'response', _aur_business_rule_value: ruleId }] }) }, {
    getAll: async () => ({ success: true, data: [{ aur_business_rulesid: ruleId, aur_name: 'Conditional coverage check', aur_propertiesname: 'Mandatory Fields' }] }),
  })
  const [record] = await service.getInquiryAiExtractedResponses(inquiryId)
  assert.equal(record.isConditionalRule, false)
})
