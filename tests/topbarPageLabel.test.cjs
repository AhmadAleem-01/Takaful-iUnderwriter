const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function load(file, dependencies = {}) {
  const context = { exports: {}, URLSearchParams, require: (name) => dependencies[name] ?? require(name) }
  const source = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context)
  return context.exports
}

const constants = load('lib/constants.ts')
const { topbarPageLabel } = load('lib/topbarPageLabel.ts', { './constants': constants })

test('home and navigation sections use their existing labels', () => {
  assert.equal(topbarPageLabel('/'), 'Executive Dashboard')
  assert.equal(topbarPageLabel('/quotes'), 'Quotes')
  assert.equal(topbarPageLabel('/reinsurance/treaty-layers'), 'Treaty Layers')
})

test('inquiry filters take priority over the general section and tolerate unrelated query parameters', () => {
  assert.equal(topbarPageLabel('/inquiries', '?type=New'), 'New Business')
  assert.equal(topbarPageLabel('/inquiries', '?view=grid&type=Renewal'), 'Renewals')
  assert.equal(topbarPageLabel('/inquiries', '?type=Endorsement'), 'Endorsements')
  assert.equal(topbarPageLabel('/inquiries', '?type=Unknown'), 'All Inquiries')
})

test('detail, creation, and preview routes retain their parent section label', () => {
  assert.equal(topbarPageLabel('/quotes/record-id/edit'), 'Quotes')
  assert.equal(topbarPageLabel('/admin/products/create'), 'Products')
  assert.equal(topbarPageLabel('/admin/document-templates/preview/template-id'), 'Document Templates')
  assert.equal(topbarPageLabel('/inquiries/record-id', '?type=Renewal'), 'All Inquiries')
})

test('sections absent from sidebar navigation have explicit labels', () => {
  assert.equal(topbarPageLabel('/admin/plans/record-id/edit'), 'Plans')
  assert.equal(topbarPageLabel('/admin/benefits'), 'Benefits')
  assert.equal(topbarPageLabel('/admin/brokers'), 'Brokers')
  assert.equal(topbarPageLabel('/policies/record-id'), 'Policies')
  assert.equal(topbarPageLabel('/access-denied'), 'Access Denied')
})

test('unknown paths do not accidentally match a similarly named section or the dashboard', () => {
  assert.equal(topbarPageLabel('/quotes-archive'), 'Insure AI')
  assert.equal(topbarPageLabel('/unknown'), 'Insure AI')
})
