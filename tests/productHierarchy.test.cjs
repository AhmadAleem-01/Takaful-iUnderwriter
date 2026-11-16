const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function load(relativePath) {
  const context = { exports: {}, require: () => ({}) }
  const source = fs.readFileSync(path.join(__dirname, relativePath), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context)
  return context.exports
}

const { buildProductHierarchy } = load('../src/lib/productHierarchy.ts')
const { mapProductSummary } = load('../src/services/dataMappers.ts')
const product = (id, name, lineOfBusinessId) => ({ id, name, lineOfBusinessId, shortDetails: '', status: 'Draft' })
const records = [
  product('child', 'Comprehensive', '{PARENT}'),
  product('parent', 'Motor'),
  product('sibling', 'Third party', 'parent'),
  product('empty', 'Health', '  '),
  product('orphan', 'Unlinked', 'missing'),
]

test('maps the aur_lob lookup and recognizes null, missing, and blank values as lines of business', () => {
  for (const value of [null, undefined, '', '  ']) {
    assert.equal(mapProductSummary({ aur_productsid: 'parent', _aur_lob_value: value }).lineOfBusinessId, undefined)
  }
  assert.equal(mapProductSummary({ _aur_lob_value: ' parent ' }).lineOfBusinessId, 'parent')
})

test('groups children under their line of business regardless of order and GUID casing', () => {
  const groups = buildProductHierarchy(records)
  assert.equal(groups.length, 3)
  assert.equal(groups[0].product.id, 'parent')
  assert.equal(groups[0].children.map((child) => child.id).join(','), 'child,sibling')
  assert.equal(groups[1].product.id, 'empty')
  assert.equal(groups[1].children.length, 0)
  assert.equal(groups[2].product.id, 'orphan')
})

test('searching a child retains its parent and excludes unrelated siblings', () => {
  const groups = buildProductHierarchy(records, ' comprehensive ')
  assert.equal(groups.length, 1)
  assert.equal(groups[0].product.id, 'parent')
  assert.equal(groups[0].children.length, 1)
  assert.equal(groups[0].children[0].id, 'child')
})

test('searching a line of business includes its children, and no matches returns no groups', () => {
  assert.equal(buildProductHierarchy(records, 'motor')[0].children.length, 2)
  assert.equal(buildProductHierarchy(records, 'not found').length, 0)
  assert.equal(buildProductHierarchy([]).length, 0)
})
