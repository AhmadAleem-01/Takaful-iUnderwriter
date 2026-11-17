const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function dashboard(inquiries, contacts = [], extras = {}) {
  const sources = {
    Aur_inquiriesService: inquiries,
    ContactsService: contacts,
    ...extras,
  }
  const context = {
    exports: {},
    window: { location: { hostname: 'apps.powerapps.com' } },
    require: (name) => {
      if (name === './dataMappers') return {
        countByType: () => [], isRenewal: () => false,
        mapInquirySummary: (item) => item, mapQuoteSummary: (item) => item,
      }
      const service = name.split('/').pop()
      return { [service]: { getAll: async () => { if (sources[service] instanceof Error) throw sources[service]; return { data: sources[service] ?? [] } } } }
    },
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/services/dashboardService.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context)
  return context.exports.getDashboardMetrics()
}

test('product and broker contact aggregates retain records beyond previous display limits', async () => {
  const contacts = Array.from({ length: 8 }, (_, index) => ({ contactid: 'broker-' + index, fullname: 'Broker ' + index }))
  const inquiries = Array.from({ length: 9 }, (_, index) => ({
    aur_inquiryid: 'inquiry-' + index, aur_productname: 'Product ' + index,
    _aur_broker_contact_value: index < 8 ? contacts[index].contactid : undefined,
  }))
  const data = await dashboard(inquiries, contacts)
  assert.equal(data.topProducts.length, 9)
  assert.equal(data.topProducts.reduce((sum, item) => sum + item.value, 0), 9)
  assert.equal(data.inquiryByBrokers.length, 8)
  assert.equal(data.inquiryByBrokers.reduce((sum, item) => sum + item.value, 0), 8)
  assert.equal(data.totalInquiries, 9)
})

test('broker-linked totals use contacts and exclude company-only inquiries and unused contacts', async () => {
  const contacts = [{ contactid: 'broker', fullname: 'Broker Contact' }, { contactid: 'unused', fullname: 'Unused Contact' }]
  const data = await dashboard([
    { aur_inquiryid: 'a', _aur_broker_contact_value: 'broker', aur_productname: 'Medical' },
    { aur_inquiryid: 'b', _aur_broker_contact_value: 'broker', aur_productname: 'Medical' },
    { aur_inquiryid: 'c', _aur_broker_company_value: 'company', aur_productname: 'Motor' },
    { aur_inquiryid: 'd', aur_productname: 'Motor' },
  ], contacts)
  assert.equal(data.inquiryByBrokers.length, 1)
  assert.equal(data.inquiryByBrokers[0].id, 'broker')
  assert.equal(data.inquiryByBrokers[0].label, 'Broker Contact')
  assert.equal(data.inquiryByBrokers[0].value, 2)
  assert.equal(data.totalInquiries, 4)
})

test('empty and unlinked datasets produce zero broker aggregates', async () => {
  const empty = await dashboard([])
  assert.equal(empty.topProducts.length, 0)
  assert.equal(empty.inquiryByBrokers.length, 0)
  const unlinked = await dashboard([{ aur_inquiryid: 'a', aur_productname: 'Medical' }])
  assert.equal(unlinked.totalInquiries, 1)
  assert.equal(unlinked.inquiryByBrokers.length, 0)
})


test('reinsurance groups include only won quotes and expose per-group counts and plan product labels', async () => {
  const data = await dashboard([], [], {
    Aur_quotesService: [
      { statuscode: 751820001, aur_productname: 'Medical', aur_planname: 'Corporate', aur_total_premium: 20000 },
      { statuscode: 751820001, aur_productname: 'Medical', aur_planname: 'Corporate', aur_total_premium: 8000 },
      { statuscode: 751820001, aur_productname: 'Motor', aur_planname: 'Comprehensive', aur_total_premium: 20500 },
      { statuscode: 1, aur_productname: 'Medical', aur_planname: 'Corporate', aur_total_premium: 99999 },
    ],
  })
  assert.equal(data.wonQuotes, 3)
  assert.equal(data.wonPremiumTotal, 48500)
  assert.equal(data.wonPremiumByProduct[0].label, 'Medical')
  assert.equal(data.wonPremiumByProduct[0].value, 28000)
  assert.equal(data.wonPremiumByProduct[0].wonQuotes, 2)
  assert.equal(data.wonPremiumByPlan[0].productName, 'Medical')
  assert.equal(data.wonPremiumByPlan[0].wonQuotes, 2)
})

test('reinsurance retains more than six groups and full totals', async () => {
  const data = await dashboard([], [], {
    Aur_quotesService: Array.from({ length: 8 }, (_, index) => ({ statuscode: 751820001, aur_productname: 'Product ' + index, aur_planname: 'Plan ' + index, aur_total_premium: 100 })),
  })
  assert.equal(data.wonPremiumByProduct.length, 8)
  assert.equal(data.wonPremiumByPlan.length, 8)
  assert.equal(data.wonPremiumByPlan.reduce((sum, item) => sum + item.value, 0), data.wonPremiumTotal)
})

test('plan product labels resolve from linked catalog records and combine distinct names', async () => {
  const data = await dashboard([], [], {
    Aur_plansService: [{ aur_planid: 'plan', aur_name: 'Corporate', _aur_product_value: 'product' }],
    Aur_productsesService: [{ aur_productsid: 'product', aur_name: 'Medical' }],
    Aur_quotesService: [
      { statuscode: 751820001, _aur_plan_value: 'plan', aur_total_premium: 100 },
      { statuscode: 751820001, _aur_plan_value: 'plan', aur_productname: 'Motor', aur_total_premium: 100 },
    ],
  })
  assert.equal(data.wonPremiumByPlan[0].label, 'Corporate')
  assert.equal(data.wonPremiumByPlan[0].productName, 'Medical, Motor')
  assert.equal(data.wonPremiumByPlan[0].wonQuotes, 2)
})

test('unassigned and zero-premium won records remain represented, while empty data stays empty', async () => {
  const data = await dashboard([], [], { Aur_quotesService: [{ statuscode: 751820001, aur_total_premium: 0 }] })
  assert.equal(data.wonPremiumTotal, 0)
  assert.equal(data.wonPremiumByProduct[0].label, 'Unassigned Product')
  assert.equal(data.wonPremiumByProduct[0].wonQuotes, 1)
  assert.equal(data.wonPremiumByPlan[0].label, 'Unassigned Plan')
  assert.equal(data.wonPremiumByPlan[0].productName, 'Unassigned Product')
  const empty = await dashboard([])
  assert.equal(empty.wonPremiumByProduct.length, 0)
  assert.equal(empty.wonPremiumByPlan.length, 0)
})

test('panel average risk excludes missing scores while the existing KPI is unchanged', async () => {
  const data = await dashboard([{ aur_risk_score: 20 }, { aur_risk_score: 40 }, {}])
  assert.equal(data.averageInquiryRiskScore, 30)
  assert.equal(data.scoredInquiryCount, 2)
  assert.equal(data.inquiryKpis[2].value, 20)
})

test('panel average risk distinguishes missing risk scores from valid zero scores', async () => {
  const missing = await dashboard([{}, { aur_risk_score: null }])
  assert.equal(missing.averageInquiryRiskScore, null)
  assert.equal(missing.scoredInquiryCount, 0)
  const zero = await dashboard([{ aur_risk_score: 0 }, {}])
  assert.equal(zero.averageInquiryRiskScore, 0)
  assert.equal(zero.scoredInquiryCount, 1)
  const empty = await dashboard([])
  assert.equal(empty.averageInquiryRiskScore, null)
})


test('broker contacts group by normalized ID rather than shared display names', async () => {
  const data = await dashboard([
    { _aur_broker_contact_value: ' {ABC} ' },
    { _aur_broker_contact_value: 'abc' },
    { _aur_broker_contact_value: 'DEF' },
  ], [{ contactid: '{ABC}', fullname: 'Same Name' }, { contactid: 'def', fullname: 'Same Name' }])
  assert.equal(data.inquiryByBrokers.length, 2)
  assert.equal(data.inquiryByBrokers[0].id, 'abc')
  assert.equal(data.inquiryByBrokers[0].value, 2)
  assert.equal(data.inquiryByBrokers[1].id, 'def')
  assert.equal(data.inquiryByBrokers[1].value, 1)
  assert.equal(data.inquiryByBrokers[0].label, data.inquiryByBrokers[1].label)
})

test('contact names use full name, first/last, lookup display, and unnamed fallback in order', async () => {
  const data = await dashboard([
    { _aur_broker_contact_value: 'full', aur_broker_contactname: 'Ignored lookup' },
    { _aur_broker_contact_value: 'parts' },
    { _aur_broker_contact_value: 'lookup', aur_broker_contactname: ' Display Name ' },
    { _aur_broker_contact_value: 'missing' },
  ], [{ contactid: 'full', fullname: ' Full Name ', firstname: 'Ignored', lastname: 'Parts' }, { contactid: 'parts', fullname: ' ', firstname: 'First', lastname: 'Last' }])
  const names = new Map(data.inquiryByBrokers.map((row) => [row.id, row.label]))
  assert.equal(names.get('full'), 'Full Name')
  assert.equal(names.get('parts'), 'First Last')
  assert.equal(names.get('lookup'), 'Display Name')
  assert.equal(names.get('missing'), 'Unnamed broker contact')
  assert.equal(data.inquiryByBrokers.reduce((sum, row) => sum + row.value, 0), 4)
  const labels = Array.from(data.inquiryByBrokers, (row) => row.label)
  assert.equal(JSON.stringify(labels), JSON.stringify([...labels].sort((a, b) => a.localeCompare(b))))
})

test('contact lookup failures preserve linked inquiry counts and display-name fallbacks', async () => {
  const data = await dashboard([
    { _aur_broker_contact_value: 'missing' },
    { _aur_broker_contact_value: 'missing', aur_broker_contactname: 'Available Lookup Name' },
  ], [], { ContactsService: new Error('Contacts unavailable') })
  assert.equal(data.inquiryByBrokers.length, 1)
  assert.equal(data.inquiryByBrokers[0].value, 2)
  assert.equal(data.inquiryByBrokers[0].label, 'Available Lookup Name')
})
