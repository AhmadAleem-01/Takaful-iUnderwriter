const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function load(file, dependencies = {}) {
  const context = { exports: {}, require: (name) => dependencies[name] ?? {} }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context)
  return context.exports
}

function quoteService(previousStatus = 1, updateResult = { success: true }) {
  const updates = [], conversions = []
  const service = load('services/quotesService.ts', {
    '../generated/services/Aur_quotesService': { Aur_quotesService: {
      get: async () => ({ success: true, data: { statuscode: previousStatus, aur_name: 'Quote', aur_total_premium: 100 } }),
      update: async (_id, fields) => { updates.push(fields); return updateResult },
    } },
    './policyConversionsService': { ensurePolicyConversionForWonQuote: async (...args) => { conversions.push(args) } },
    '../lib/quoteNumbers': { quoteWholeNumber: (value) => value },
  })
  return { service, updates, conversions }
}

test('quote outcome buttons write statuscode and convert only on a new win', async () => {
  const won = quoteService()
  await won.service.updateQuoteStatus('quote-1', 'QuoteWon')
  assert.equal(won.updates[0].statuscode, 751820001)
  assert.equal(won.conversions.length, 1)

  const alreadyWon = quoteService(751820001)
  await alreadyWon.service.updateQuoteStatus('quote-1', 'QuoteWon')
  assert.equal(alreadyWon.conversions.length, 0)

  const lost = quoteService()
  await lost.service.updateQuoteStatus('quote-1', 'QuoteLost')
  assert.equal(lost.updates[0].statuscode, 751820002)
  assert.equal(lost.conversions.length, 0)
})

test('failed status updates do not trigger policy conversion', async () => {
  const fixture = quoteService(1, { success: false, error: new Error('Update failed') })
  await assert.rejects(fixture.service.updateQuoteStatus('quote-1', 'QuoteWon'), /Update failed/)
  assert.equal(fixture.conversions.length, 0)
})

test('saving quote details keeps the selected status in statuscode', async () => {
  const fixture = quoteService()
  await fixture.service.saveQuoteDetail('quote-1', {
    name: 'Quote', totalPremium: 100, grossPremium: 90, vat: 5, loadingPremium: 9,
    reason: '', aiSummary: '', quoteStatus: 'QuoteLost',
  })
  assert.equal(fixture.updates[0].statuscode, 751820002)
  assert.equal('aur_quote_status' in fixture.updates[0], false)
})

test('quote summaries read statuscode labels and values', () => {
  const { mapQuoteSummary } = load('services/dataMappers.ts')
  const quote = { aur_quoteid: 'quote-1', aur_name: 'Quote', statuscode: 751820001, statuscodename: 'QuoteWon' }
  const won = mapQuoteSummary(quote)
  assert.equal(won.status, 'Quote Won')
  assert.equal(won.quoteStatusValue, 751820001)
  assert.equal(mapQuoteSummary({ ...quote, statuscode: 751820002, statuscodename: 'QuoteLost' }).status, 'Quote Lost')
})
