const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const inquiryId = '00000000-0000-0000-0000-000000000001'
const firstId = '00000000-0000-0000-0000-000000000002'
const secondId = '00000000-0000-0000-0000-000000000003'
const planId = '00000000-0000-0000-0000-000000000006'
const productId = '00000000-0000-0000-0000-000000000007'

function moduleAt(file, dependencies = {}) {
  const context = { exports: {}, require: (name) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`)
    return dependencies[name]
  } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context)
  return context.exports
}

function loadModule(getAll, get, update, extra = {}) {
  const sdk = { Aur_coveragesesService: { get, getAll: extra.coveragesGetAll } }
  const labels = moduleAt('services/productCoveragesService.ts', {
    '../generated/services/Aur_coveragesesService': sdk,
    '../generated/models/Aur_coveragesesModel': moduleAt('generated/models/Aur_coveragesesModel.ts'),
  })
  return moduleAt('services/inquiryCoveragesService.ts', {
    '../generated/services/Aur_inquiry_coveragesesService': { Aur_inquiry_coveragesesService: { getAll, update, create: extra.create } },
    '../generated/services/Aur_coveragesesService': sdk,
    '../generated/services/Aur_plansService': { Aur_plansService: { get: extra.planGet, getAll: extra.plansGetAll } },
    '../generated/services/Aur_inquiriesService': { Aur_inquiriesService: { get: extra.inquiryGet } },
    './productCoveragesService': labels,
  })
}

function load(getAll, get) {
  return loadModule(getAll, get).getInquiryCoverages
}

test('retrieves all active inquiry-link pages, excludes other inquiries, and deduplicates linked coverage IDs', async () => {
  const queries = [], reads = []
  const get = load(async (options) => {
    queries.push(options)
    return { success: true, skipToken: options.skipToken ? undefined : 'page-two', data: options.skipToken
      ? [{ _aur_inquiry_value: inquiryId, _aur_coverages_value: secondId, statuscode: 1 }, { _aur_inquiry_value: inquiryId, _aur_coverages_value: firstId, statuscode: 1 }]
      : [{ _aur_inquiry_value: `{${inquiryId}}`, _aur_coverages_value: `{${firstId}}`, statuscode: 1, aur_name: 'Link name' },
        { _aur_inquiry_value: secondId, _aur_coverages_value: inquiryId, statuscode: 1 }] }
  }, async (id) => {
    reads.push(id)
    return { success: true, data: { aur_name: id === firstId ? 'A Coverage' : 'B Coverage', aur_coverage_type: id === firstId ? 1 : 8 } }
  })
  const records = await get(`{${inquiryId}}`)
  assert.equal(queries[0].filter, `_aur_inquiry_value eq ${inquiryId} and statuscode eq 1`)
  assert.equal(queries[1].skipToken, 'page-two')
  assert.deepEqual(reads.sort(), [firstId, secondId])
  assert.deepEqual(Array.from(records, (record) => record.name), ['A Coverage', 'B Coverage'])
  assert.deepEqual(Array.from(records, (record) => record.coverageType), ['Coverages', 'RI Conditions'])
})

test('excludes inactive inquiry coverage links even when returned by the API', async () => {
  const reads = []
  const get = load(async () => ({ success: true, data: [
    { _aur_inquiry_value: inquiryId, _aur_coverages_value: firstId, statuscode: 2 },
    { _aur_inquiry_value: inquiryId, _aur_coverages_value: secondId, statuscode: 1 },
  ] }), async (id) => {
    reads.push(id)
    return { success: true, data: { aur_name: 'Active Coverage' } }
  })
  const records = await get(inquiryId)
  assert.deepEqual(reads, [secondId])
  assert.deepEqual(Array.from(records, (record) => record.name), ['Active Coverage'])
})

test('an inquiry with no links does not read the coverage catalog', async () => {
  const get = load(async () => ({ success: true, data: [] }), async () => { throw new Error('Unexpected coverage read') })
  assert.equal((await get(inquiryId)).length, 0)
})

test('surfaces link and coverage read failures instead of showing incomplete results', async () => {
  const failedLinks = load(async () => ({ success: false, error: { message: 'Link read denied' } }))
  await assert.rejects(failedLinks(inquiryId), /Link read denied/)
  const failedCoverage = load(async () => ({ success: true, data: [{ _aur_inquiry_value: inquiryId, _aur_coverages_value: firstId, statuscode: 1 }] }),
    async () => ({ success: false, error: { message: 'Coverage read denied' } }))
  await assert.rejects(failedCoverage(inquiryId), /Coverage read denied/)
})

test('validates inquiry IDs and reports broken Coverage lookups', async () => {
  const get = load(async () => ({ success: true, data: [{ _aur_inquiry_value: inquiryId, statuscode: 1 }] }))
  await assert.rejects(get('invalid'), /valid inquiry ID/)
  await assert.rejects(get(inquiryId), /missing a valid Coverage lookup/)
})

test('deactivates every active link for a coverage on the selected inquiry only', async () => {
  const linkId1 = '00000000-0000-0000-0000-000000000004'
  const linkId2 = '00000000-0000-0000-0000-000000000005'
  const updates = [], queries = []
  const { deactivateInquiryCoverage } = loadModule(async (options) => {
    queries.push(options)
    return { success: true, skipToken: options.skipToken ? undefined : 'page-two', data: options.skipToken
      ? [{ aur_inquiry_coveragesid: linkId2, _aur_inquiry_value: inquiryId, _aur_coverages_value: firstId, statuscode: 1 },
        { aur_inquiry_coveragesid: linkId1, _aur_inquiry_value: inquiryId, _aur_coverages_value: firstId, statuscode: 1 }]
      : [{ aur_inquiry_coveragesid: linkId1, _aur_inquiry_value: inquiryId, _aur_coverages_value: firstId, statuscode: 1 },
        { aur_inquiry_coveragesid: 'other-inquiry', _aur_inquiry_value: secondId, _aur_coverages_value: firstId, statuscode: 1 },
        { aur_inquiry_coveragesid: 'other-coverage', _aur_inquiry_value: inquiryId, _aur_coverages_value: secondId, statuscode: 1 },
        { aur_inquiry_coveragesid: 'inactive', _aur_inquiry_value: inquiryId, _aur_coverages_value: firstId, statuscode: 2 }] }
  }, undefined, async (id, fields) => {
    updates.push({ id, fields })
    return { success: true }
  })
  await deactivateInquiryCoverage(inquiryId, firstId)
  assert.equal(queries[0].filter, `_aur_inquiry_value eq ${inquiryId} and _aur_coverages_value eq ${firstId} and statuscode eq 1`)
  assert.equal(queries[1].skipToken, 'page-two')
  assert.deepEqual(updates.map((item) => item.id), [linkId1, linkId2])
  assert.deepEqual(updates.map((item) => Object.assign({}, item.fields)), [
    { statecode: 1, statuscode: 2 }, { statecode: 1, statuscode: 2 },
  ])
})

test('reports deactivation failures and does not update unrelated links', async () => {
  const linkId = '00000000-0000-0000-0000-000000000004'
  const { deactivateInquiryCoverage } = loadModule(async () => ({ success: true, data: [
    { aur_inquiry_coveragesid: linkId, _aur_inquiry_value: inquiryId, _aur_coverages_value: firstId, statuscode: 1 },
  ] }), undefined, async () => ({ success: false, error: { message: 'Update denied' } }))
  await assert.rejects(deactivateInquiryCoverage(inquiryId, firstId), /Update denied/)
  await assert.rejects(deactivateInquiryCoverage('invalid', firstId), /Valid inquiry and coverage IDs/)
})

test('lists only plans for the product and active coverages in the chosen plan', async () => {
  const { getProductPlans, getPlanCoverages } = loadModule(undefined, undefined, undefined, {
    plansGetAll: async (options) => ({ success: true, data: options.skipToken
      ? [{ aur_planid: firstId, aur_name: 'Plan B', _aur_product_value: productId }]
      : [{ aur_planid: planId, aur_name: 'Plan A', _aur_product_value: productId },
        { aur_planid: secondId, aur_name: 'Other product', _aur_product_value: inquiryId }], skipToken: options.skipToken ? undefined : 'next' }),
    planGet: async () => ({ success: true, data: { _aur_product_value: productId } }),
    coveragesGetAll: async () => ({ success: true, data: [
      { aur_coveragesid: firstId, aur_name: 'Valid', _aur_plan_value: planId, _aur_product_value: productId, statuscode: 1 },
      { aur_coveragesid: secondId, aur_name: 'Wrong plan', _aur_plan_value: inquiryId, statuscode: 1 },
      { aur_coveragesid: inquiryId, aur_name: 'Inactive', _aur_plan_value: planId, statuscode: 2 },
    ] }),
  })
  const plans = await getProductPlans(productId)
  assert.deepEqual(Array.from(plans, (plan) => plan.name), ['Plan A', 'Plan B'])
  const coverages = await getPlanCoverages(productId, planId)
  assert.deepEqual(Array.from(coverages, (coverage) => coverage.name), ['Valid'])
})

test('adds a new inquiry coverage link and reactivates a removed link', async () => {
  const linkId = '00000000-0000-0000-0000-000000000008'
  const created = [], updated = []
  let existing = false
  const { addExistingInquiryCoverage } = loadModule(async () => ({ success: true, data: existing
    ? [{ aur_inquiry_coveragesid: linkId, _aur_inquiry_value: inquiryId, _aur_coverages_value: firstId, statuscode: 2 }] : [] }),
  async () => ({ success: true, data: { aur_name: 'Coverage', _aur_plan_value: planId, _aur_product_value: productId, statuscode: 1 } }),
  async (id, fields) => { updated.push({ id, fields }); return { success: true } }, {
    inquiryGet: async () => ({ success: true, data: { _aur_product_value: productId } }),
    planGet: async () => ({ success: true, data: { _aur_product_value: productId } }),
    create: async (fields) => { created.push(fields); return { success: true } },
  })
  await addExistingInquiryCoverage(inquiryId, productId, planId, firstId)
  assert.equal(created.length, 1)
  assert.equal(created[0]['aur_inquiry@odata.bind'], `/aur_inquiries(${inquiryId})`)
  assert.equal(created[0]['aur_coverages@odata.bind'], `/aur_coverageses(${firstId})`)
  existing = true
  await addExistingInquiryCoverage(inquiryId, productId, planId, firstId)
  assert.equal(created.length, 1)
  assert.equal(updated[0].id, linkId)
  assert.deepEqual(Object.assign({}, updated[0].fields), { statecode: 0, statuscode: 1 })
})

test('rejects a coverage outside the inquiry product before creating a link', async () => {
  let writes = 0
  const { addExistingInquiryCoverage } = loadModule(async () => ({ success: true, data: [] }),
    async () => ({ success: true, data: { _aur_plan_value: planId, statuscode: 1 } }), undefined, {
      inquiryGet: async () => ({ success: true, data: { _aur_product_value: secondId } }),
      planGet: async () => ({ success: true, data: { _aur_product_value: productId } }),
      create: async () => { writes++; return { success: true } },
    })
  await assert.rejects(addExistingInquiryCoverage(inquiryId, productId, planId, firstId), /not active in a plan/)
  assert.equal(writes, 0)
})
