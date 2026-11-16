const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const context = { exports: {} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/emailTemplateFields.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context)
const { parseTemplateFieldTable, templateFieldToken, insertTemplateToken } = context.exports

test('loads real inquiry fields using logical names and display labels', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '../.power/schemas/dataverse/inquiries.Schema.json'), 'utf8'))
  const table = parseTemplateFieldTable(schema)
  assert.equal(table.name, 'aur_inquiry')
  assert.equal(table.label, 'Inquiries')
  assert.ok(table.fields.length > 20)
  assert.equal(table.fields.find((field) => field.name === 'aur_name').token, '{!aur_inquiry:aur_name;}')
  assert.equal(table.fields.find((field) => field.name === 'aur_broker_company').token, '{!aur_inquiry:aur_broker_company/@name;}')
  assert.equal(table.fields.some((field) => field.name === 'aur_cover_typename'), false)
  assert.equal(table.fields.some((field) => field.name === 'aur_broker_companyname'), false)
})

test('all connected data tables have unique field names and no binary or navigation tokens', () => {
  let tableCount = 0
  for (const file of fs.readdirSync(path.join(__dirname, '../.power/schemas/dataverse'))) {
    if (!file.endsWith('.Schema.json')) continue
    const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '../.power/schemas/dataverse', file), 'utf8'))
    const table = parseTemplateFieldTable(schema)
    if (!table) continue
    tableCount += 1
    assert.equal(new Set(table.fields.map((field) => field.name)).size, table.fields.length, table.name)
    for (const field of table.fields) {
      assert.ok(field.label)
      assert.match(field.token, /^\{![a-z0-9_]+:[a-z0-9_]+(?:\/@(?:name|date))?;\}$/i)
      assert.equal(field.name, schema.schema.items.properties[field.name]['x-ms-dataverse-attribute'])
    }
  }
  assert.ok(tableCount >= 30)
})

test('skips actions and non-table schemas', () => {
  assert.equal(parseTemplateFieldTable({}), null)
  assert.equal(parseTemplateFieldTable({ name: 'action', schema: { items: { properties: {} } } }), null)
})

test('uses Dataverse display-name and date formats for typed dynamic fields', () => {
  assert.equal(templateFieldToken('quote', 'totalamount', 'MoneyType'), '{!quote:totalamount;}')
  assert.equal(templateFieldToken('contact', 'firstname', 'StringType'), '{!contact:firstname;}')
  assert.equal(templateFieldToken('aur_inquiry', 'aur_cover_type', 'PicklistType'), '{!aur_inquiry:aur_cover_type/@name;}')
  assert.equal(templateFieldToken('aur_inquiry', 'createdon', 'DateTimeType'), '{!aur_inquiry:createdon/@date;}')
})

test('inserts in the middle of subject or HTML without destroying surrounding content', () => {
  const token = '{!contact:firstname;}'
  assert.equal(insertTemplateToken('Hello , welcome', token, 6, 6).value, `Hello ${token}, welcome`)
  assert.equal(insertTemplateToken('<p>Hello </p>', token, 9, 9).value, `<p>Hello ${token}</p>`)
})

test('replaces selected text, appends without a saved cursor, and returns the next cursor', () => {
  const next = insertTemplateToken('Dear customer,', 'TOKEN', 5, 13)
  assert.equal(next.value, 'Dear TOKEN,')
  assert.equal(next.caret, 10)
  assert.equal(insertTemplateToken('Hello ', 'TOKEN').value, 'Hello TOKEN')
  assert.equal(insertTemplateToken('', 'TOKEN').value, 'TOKEN')
  assert.equal(insertTemplateToken('Hi', 'TOKEN', 100, 200).value, 'HiTOKEN')
})
