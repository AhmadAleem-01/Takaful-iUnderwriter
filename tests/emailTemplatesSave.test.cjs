const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function load(service) {
  const context = { exports: {}, require: (name) => {
    if (name.endsWith('/TemplatesService')) return { TemplatesService: service }
    const model = { exports: {} }
    vm.runInNewContext(compile('src/generated/models/TemplatesModel.ts'), model)
    return model.exports
  } }
  vm.runInNewContext(compile('src/services/emailTemplatesService.ts'), context)
  return context.exports
}
function compile(file) {
  return ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
}
const draft = { templateName: ' Welcome ', subject: ' Hello ', description: '', body: '<p>Hello {{customer_name}}</p>', categoryKey: 'Quote' }

test('creates a Template with a logical entity name and returns its ID', async () => {
  let payload
  const { saveEmailTemplate } = load({ create: async (record) => {
    payload = record
    return { success: true, data: { templateid: 'created-template' } }
  } })
  const saved = await saveEmailTemplate(draft)
  assert.equal(saved.templateid, 'created-template')
  assert.equal(payload.templatetypecode, 'quote')
  assert.equal(payload.title, 'Welcome')
  assert.equal(payload.subjectsafehtml, 'Hello')
  assert.equal(payload.safehtml, draft.body)
  assert.equal(Object.hasOwn(payload, 'subject'), false)
  assert.equal(Object.hasOwn(payload, 'body'), false)
  assert.equal(payload.languagecode, 1033)
})

test('surfaces non-throwing Dataverse failures and permission errors', async () => {
  const { saveEmailTemplate } = load({ create: async () => ({ success: false, error: { message: 'Create privilege denied' } }) })
  await assert.rejects(saveEmailTemplate(draft), /Create privilege denied/)
})

test('preserves dynamic table-field tokens in the saved subject and HTML body', async () => {
  const subject = 'Inquiry {!aur_inquiry:aur_name;}'
  const body = '<p>Dear {!contact:fullname;}, your inquiry was created on {!aur_inquiry:createdon/@date;}.</p>'
  const { saveEmailTemplate } = load({ create: async (payload) => {
    assert.equal(payload.subjectsafehtml, subject)
    assert.equal(payload.safehtml, body)
    return { success: true, data: { templateid: 'dynamic-template' } }
  } })
  await saveEmailTemplate({ ...draft, categoryKey: 'Global', subject, body })
})

test('does not report success when a create response lacks a record ID', async () => {
  const { saveEmailTemplate } = load({ create: async () => ({ success: true }) })
  await assert.rejects(saveEmailTemplate(draft), /did not return a template ID/)
})

test('updates the existing record and surfaces update failures', async () => {
  let recordId
  const { saveEmailTemplate } = load({ update: async (id, payload) => {
    recordId = id
    assert.equal(payload.templatetypecode, 'incident')
    assert.equal(payload.subjectsafehtml, 'Hello')
    assert.equal(payload.safehtml, draft.body)
    return { success: false, error: { message: 'Update denied' } }
  } })
  await assert.rejects(saveEmailTemplate({ ...draft, id: 'existing', categoryKey: 'Case' }), /Update denied/)
  assert.equal(recordId, 'existing')
})

test('rejects invalid categories before making an API call', async () => {
  const { saveEmailTemplate } = load({})
  await assert.rejects(saveEmailTemplate({ ...draft, categoryKey: '' }), /valid template category/)
})

test('Global is selectable and saves without category tags', async () => {
  const service = load({ create: async (payload) => {
    assert.equal(payload.templatetypecode, 'systemuser')
    assert.equal(payload.subjectsafehtml, 'Hello')
    assert.equal(payload.safehtml, draft.body)
    assert.equal(payload.description, 'Inquiry acknowledgement')
    return { success: true, data: { templateid: 'inquiry-template', ...payload } }
  } })
  assert.ok(service.EMAIL_TEMPLATE_CATEGORY_OPTIONS.some((option) => option.value === 'Global' && option.label === 'Global'))
  assert.equal(service.EMAIL_TEMPLATE_CATEGORY_OPTIONS.some((option) => option.value === 'Inquiry'), false)
  const record = await service.saveEmailTemplate({ ...draft, description: 'Inquiry acknowledgement', categoryKey: 'Global' })
  assert.equal(service.emailTemplateCategory(record), 'Global')
  assert.equal(service.emailTemplateDescription(record), 'Inquiry acknowledgement')
  assert.equal(service.emailTemplateCategory({ ...record, templatetypecode: 8 }), 'Global')
  assert.equal(service.emailTemplateCategory({ templatetypecode: 'systemuser' }), 'Global')
  assert.equal(service.emailTemplateCategory({ templatetypecode: 8, description: 'Other template' }), 'Global')
})

test('saving a legacy tagged template removes its tag from the stored description', async () => {
  let payload
  const service = load({ update: async (id, fields) => {
    payload = fields
    return { success: true, data: { templateid: id, ...fields } }
  } })
  const description = '[InsureAI:category=Inquiry]\r\nAcknowledgement'
  const first = await service.saveEmailTemplate({ ...draft, id: 'existing', description, categoryKey: 'Global' })
  assert.equal(payload.description, 'Acknowledgement')
  assert.equal(service.emailTemplateCategory(first), 'Global')
  const changed = await service.saveEmailTemplate({ ...draft, id: 'existing', description: '[InsureAI:category=Inquiry]', categoryKey: 'Quote' })
  assert.equal(payload.description, '')
  assert.equal(service.emailTemplateCategory(changed), 'Quote')
})

test('allows a full length description and rejects descriptions exceeding the field limit', async () => {
  let payload
  const service = load({ create: async (record) => {
    payload = record
    return { success: true, data: { templateid: 'global-template', ...record } }
  } })
  await service.saveEmailTemplate({ ...draft, categoryKey: 'Global', description: 'x'.repeat(2000) })
  assert.equal(payload.description.length, 2000)
  await assert.rejects(service.saveEmailTemplate({ ...draft, categoryKey: 'Global', description: 'x'.repeat(2001) }), /description is too long/)
})

test('rejects the removed Inquiry category before contacting Dataverse', async () => {
  const service = load({})
  await assert.rejects(service.saveEmailTemplate({ ...draft, categoryKey: 'Inquiry' }), /valid template category/)
})

test('maps saved logical names and legacy numeric types back to editor categories', () => {
  const { emailTemplateCategory } = load({})
  assert.equal(emailTemplateCategory({ templatetypecode: 'quote', templatetypecodename: 'Localized label' }), 'Quote')
  assert.equal(emailTemplateCategory({ templatetypecode: 'salesorder' }), 'Order')
  assert.equal(emailTemplateCategory({ templatetypecode: 'incident' }), 'Case')
  assert.equal(emailTemplateCategory({ templatetypecode: 1084 }), 'Quote')
})

test('editor and preview load safe HTML fields while preserving the separate template name', () => {
  const file = ts.createSourceFile('EmailTemplatesPage.tsx', fs.readFileSync(
    path.join(__dirname, '../src/pages/admin/EmailTemplatesPage.tsx'), 'utf8',
  ), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const mapper = file.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'mapTemplateRecord')
  assert.ok(mapper)
  const map = vm.runInNewContext(ts.transpileModule(`(${mapper.getText(file)})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    emailTemplateCategory: load({}).emailTemplateCategory,
    emailTemplateDescription: load({}).emailTemplateDescription,
  })
  const record = { templateid: 'saved', title: 'Template name', templatetypecode: 'quote',
    subjectsafehtml: 'Actual email subject', safehtml: draft.body, subject: 'Old subject', body: 'Old body' }
  const result = map(record)
  assert.equal(result.templateName, 'Template name')
  assert.equal(result.subject, 'Actual email subject')
  assert.equal(result.body, draft.body)
  assert.equal(map({ ...record, subjectsafehtml: undefined, safehtml: undefined }).subject, 'Old subject')
  assert.equal(map({ ...record, subjectsafehtml: undefined, safehtml: undefined }).body, 'Old body')
  assert.equal(map({ ...record, subjectsafehtml: '', safehtml: '' }).body, '')
  const inquiry = map({ ...record, templatetypecode: 'systemuser',
    description: '[InsureAI:category=Inquiry]\nCustomer acknowledgement' })
  assert.equal(inquiry.categoryKey, 'Global')
  assert.equal(inquiry.description, 'Customer acknowledgement')
})
