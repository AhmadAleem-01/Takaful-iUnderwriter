const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const compilerOptions = { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }

const pagePath = path.join(__dirname, '../src/pages/inquiries/InquiryWorkspacePage.tsx')
const source = ts.createSourceFile('page.tsx', fs.readFileSync(pagePath, 'utf8'), ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)
function functionSource(name) {
  let result
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) result = node.getText(source)
    ts.forEachChild(node, visit)
  }
  visit(source)
  assert.ok(result, 'Missing function: ' + name)
  return result
}
const handlers = ['handleSaveDetails', 'handleQuickAction', 'inquiryStatusValueForDisposition', 'inquiryStatusLabelForDisposition'].map(functionSource).join('\n')

function fixture({ editing = false, update = async () => ({ success: true }) } = {}) {
  const writes = []
  const services = { exports: {}, Error, console: { info() {} }, require: (name) => name.endsWith('/Aur_inquiriesService') ? {
    Aur_inquiriesService: { update: async (id, payload) => { writes.push({ id, payload }); return update() } },
  } : {} }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/services/inquiriesService.ts'), 'utf8'), { compilerOptions }).outputText, services)
  const context = {
    Error,
    form: { name: 'Edited inquiry', parentProductId: '', inquiryPurpose: '', brokerContactId: '', brokerCompanyId: '', insuredCompanyId: '', productId: '', inquiryType: '1', inquiryStatus: '0', planId: '', brokerId: '', planDetails: '', coverType: '', riskScore: '20', riskDescription: '', totalSumInsured: '1000', territorialScope: '', noOfItems: '1', basePremium: '2.5', underwriterActionStatus: '1', underwriterSubAction: '', premiumToBeCharged: '1200', brokerage: '0', grossPremium: '1200', paymentTerm: '', fee: '0', totalDeduction: '0' },
    inquiryRecordId: 'inquiry-id', isEditing: editing, saveBusy: false, pendingAction: null,
    saveInFlight: { current: false }, quickActionInFlight: { current: false },
    inquiryState: { name: 'Original inquiry', status: 'Draft', inquiryStatusValue: 0, underwriterActionStatus: 1 },
    options: { parentProducts: [], inquiryPurposes: [], brokerContacts: [], brokers: [], companies: [], products: [], inquiryTypes: [], inquiryStatuses: [], plans: [], coverTypes: [], paymentTerms: [] },
    findOptionLabel: (_options, _value, fallback) => fallback,
    findOptionName: (_options, _value, fallback) => fallback,
    saveInquiryDetail: services.exports.saveInquiryDetail,
    updateInquiryDisposition: services.exports.updateInquiryDisposition,
  }
  for (const [setter, field] of Object.entries({ setSaveBusy: 'saveBusy', setSaveError: 'saveError', setActionError: 'actionError', setActionSuccess: 'actionSuccess', setPendingAction: 'pendingAction', setIsEditing: 'isEditing', setInquiryState: 'inquiryState', setForm: 'form' })) {
    context[setter] = (value) => { context[field] = typeof value === 'function' ? value(context[field]) : value }
  }
  vm.runInNewContext(ts.transpileModule(handlers, { compilerOptions }).outputText, context)
  return { context, writes }
}

for (const [disposition, code, action] of [['RefertoUnderwriter', 751820010, 1], ['EscalatetoHeadofAviation', 751820013, 1], ['Decline', 751820011, 2]]) {
  test(disposition + ' writes only status/action outside editing', async () => {
    const { context, writes } = fixture()
    await context.handleQuickAction(disposition)
    assert.equal(writes.length, 1)
    assert.deepEqual(Object.keys(writes[0].payload).sort(), ['aur_underwriter_action', 'statuscode'])
    assert.equal(writes[0].payload.statuscode, code)
    assert.equal(writes[0].payload.aur_underwriter_action, action)
    assert.equal(context.inquiryState.inquiryStatusValue, code)
    assert.equal(context.pendingAction, null)
  })
}

test('quick action during editing saves draft and disposition in one update', async () => {
  const { context, writes } = fixture({ editing: true })
  await context.handleQuickAction('Decline')
  assert.equal(writes.length, 1)
  assert.equal(writes[0].payload.aur_name, 'Edited inquiry')
  assert.equal(writes[0].payload.aur_total_premium_to_be_charged, 1200)
  assert.equal(writes[0].payload.statuscode, 751820011)
  assert.equal(writes[0].payload.aur_underwriter_action, 2)
  assert.equal(context.isEditing, false)
  assert.equal(context.inquiryState.name, 'Edited inquiry')
  assert.equal(context.inquiryState.status, 'Decline')
})

test('failed combined saves retain drafts, editing mode, and original saved state', async () => {
  const { context } = fixture({ editing: true, update: async () => ({ success: false, error: { message: 'Save rejected' } }) })
  await context.handleQuickAction('Decline')
  assert.equal(context.isEditing, true)
  assert.equal(context.form.name, 'Edited inquiry')
  assert.equal(context.form.inquiryStatus, '0')
  assert.equal(context.inquiryState.status, 'Draft')
  assert.equal(context.saveError, 'Save rejected')
  assert.equal(context.actionSuccess, null)
  assert.equal(context.quickActionInFlight.current, false)
  assert.equal(context.saveInFlight.current, false)
})

test('failed disposition update leaves saved status untouched and reports the error', async () => {
  const { context } = fixture({ update: async () => ({ success: false, error: { message: 'Permission denied' } }) })
  await context.handleQuickAction('RefertoUnderwriter')
  assert.equal(context.inquiryState.status, 'Draft')
  assert.equal(context.actionError, 'Permission denied')
})

test('in-flight guard prevents duplicate quick actions before state can rerender', async () => {
  let resolveUpdate
  const pending = new Promise((resolve) => { resolveUpdate = resolve })
  const { context, writes } = fixture({ update: () => pending })
  const first = context.handleQuickAction('RefertoUnderwriter')
  await context.handleQuickAction('Decline')
  assert.equal(writes.length, 1)
  resolveUpdate({ success: true })
  await first
  assert.equal(context.inquiryState.inquiryStatusValue, 751820010)
})

test('normal form saves still preserve the selected form status and finish editing', async () => {
  const { context, writes } = fixture({ editing: true })
  context.form.inquiryStatus = '751820013'
  const success = await context.handleSaveDetails()
  assert.equal(success, true)
  assert.equal(writes.length, 1)
  assert.equal(writes[0].payload.statuscode, 751820013)
  assert.equal(context.isEditing, false)
})
