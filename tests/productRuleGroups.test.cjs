const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const context = { exports: {} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/productRuleGroups.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context)
const { categorizeRule, groupLinkedProductRules } = context.exports

test('Property Rule takes precedence over misleading subject words', () => {
  assert.equal(categorizeRule('Mandatory Fields'), 'Mandatory Field')
  assert.equal(categorizeRule('Conditional Rules'), 'Conditional')
  assert.equal(categorizeRule('Conditional Rules'), 'Conditional')
  assert.equal(categorizeRule('Exclusion Rules'), 'Exclusion')
  assert.equal(categorizeRule('Inclusion Rules'), 'Inclusion')
  assert.equal(categorizeRule('Required Document'), 'Required Document')
})

test('shows only populated linked categories and keeps all 33 mandatory rules together', () => {
  const mandatory = Array.from({ length: 33 }, (_, i) => ({ id: `mandatory-${i}`, name: `Coverage document ${i}`, context: 'Risk', propertyRuleName: 'Mandatory Fields' }))
  const conditional = { id: 'conditional', name: 'Exclusion and inclusion review', context: 'Risk', propertyRuleName: 'Conditional Rules' }
  const unlinked = { id: 'unlinked', name: 'Excluded aircraft', context: 'Risk', propertyRuleName: 'Exclusion Rules' }
  const groups = groupLinkedProductRules([...mandatory, conditional, unlinked], [...mandatory.map((rule) => rule.id), '{CONDITIONAL}'])
  assert.deepEqual(Array.from(groups, (group) => group.label), ['Mandatory Field', 'Conditional'])
  assert.equal(groups[0].rules.length, 33)
  assert.equal(groups[1].rules.length, 1)
  assert.equal(groupLinkedProductRules([unlinked], []).length, 0)
})

test('does not guess from arbitrary text when no property is set', () => {
  assert.equal(categorizeRule(''), 'Uncategorized')
})

test('ignores category-like names and descriptions when Properties is unset', () => {
  const groups = groupLinkedProductRules([{id: 'rule', name: 'Mandatory Fields', context: 'Conditional Rules', description: 'Exclusion Rules'}], ['rule'])
  assert.equal(groups[0].label, 'Uncategorized')
})

test('recognizes singular Conditional Rule and retains custom Properties categories', () => {
  assert.equal(categorizeRule('Conditional Rule'), 'Conditional')
  const groups = groupLinkedProductRules([
    { id: 'conditional', propertyRuleName: 'Conditional Rule' },
    { id: 'custom', propertyRuleName: 'Custom Underwriting Checks' },
  ], ['conditional', 'custom'])
  assert.deepEqual(Array.from(groups, (group) => group.label), ['Conditional', 'Custom Underwriting Checks'])
})
