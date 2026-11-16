const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { JSDOM } = require('jsdom')

const { window } = new JSDOM('')
function load(file, mocks = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports, document: window.document, DOMParser: window.DOMParser, NodeFilter: window.NodeFilter,
    require(name) { if (name in mocks) return mocks[name]; throw new Error(`Unexpected import: ${name}`) },
  })
  return exports
}
const fieldPaths = load('src/lib/templateFieldPaths.ts')
const badgeHelpers = load('src/lib/templateFieldBadges.ts', { './templateFieldPaths': fieldPaths })
const logoHelpers = load('src/lib/documentTemplateLogo.ts')
const { renderQuotationTemplate, sanitizeQuotationHtml, quotationDocumentHtml } = load('src/lib/quotationTemplate.ts', {
  dompurify: { default: require('dompurify')(window) },
  './templateFieldBadges': badgeHelpers,
  './templateFieldPaths': fieldPaths,
  './documentTemplateLogo': logoHelpers,
  './documentPageSetup': load('src/lib/documentPageSetup.ts', { './documentTemplateLogo': logoHelpers }),
})

test('populates repeated fields, numeric zero, and decimal premiums without interpreting values as HTML', () => {
  const result = renderQuotationTemplate('<h1>{{Quote.aur_name}}</h1><p>{{Quote.aur_total_premium}} / {{Quote.aur_vat}} / {{Quote.aur_name}}</p>', {
    Quote: { aur_name: '<img src=x onerror=alert(1)> & Co', aur_total_premium: 12345.67, aur_vat: 0 },
  })
  assert.equal(result.resolvedCount, 4)
  assert.equal(result.missingFields.length, 0)
  assert.match(result.html, /12,345.67 \/ 0/)
  assert.match(result.html, /&lt;img/)
  assert.equal(window.document.createRange().createContextualFragment(result.html).querySelector('img'), null)
})

test('logo configuration survives sanitizing and merging without becoming editable body content', () => {
  for (const placement of ['header', 'footer', 'watermark']) {
    const source = logoHelpers.writeDocumentTemplateLogo('<p>{!aur_quote:aur_name;}</p>', { src: 'data:image/png;base64,aGVsbG8=', placement, align: 'right', width: 240, opacity: 0.15 })
    const merged = renderQuotationTemplate(sanitizeQuotationHtml(source), { Quote: { aur_name: 'QUO-LOGO' } })
    assert.equal(merged.missingFields.length, 0)
    assert.equal(merged.unsupportedFields.length, 0)
    assert.equal(merged.resolvedCount, 1)
    assert.equal(logoHelpers.readDocumentTemplateLogo(merged.html).logo.placement, placement)
    const preview = new JSDOM(quotationDocumentHtml(merged.html)).window.document
    assert.equal(preview.querySelectorAll('.document-logo img').length, 1)
    assert.equal(preview.querySelector('.document-body').textContent, 'QUO-LOGO')
    assert.ok(preview.querySelector('.document-logo-' + placement))
    assert.equal(preview.querySelector('[data-document-logo]'), null)
    if (placement === 'watermark') assert.equal(preview.querySelector('.document-logo').style.opacity, '0.15')
  }
})

test('leaves unavailable fields visible and reports them once, including absent business-rule context', () => {
  const result = renderQuotationTemplate('<p>{{Inquiry.Client}} {{Inquiry.Client}} {{BusinessRule.aur_name}} {{Quote.Empty}}</p>', { Quote: { Empty: '' } })
  assert.equal(result.missingFields.length, 3)
  assert.match(result.html, /\{\{Inquiry.Client\}\}/)
})

test('does not resolve prototype properties, objects, or nonfinite values', () => {
  const result = renderQuotationTemplate('<p>{{Quote.constructor}} {{Quote.Object}} {{Quote.Number}}</p>', { Quote: { Object: {}, Number: Infinity } })
  assert.equal(result.resolvedCount, 0)
  assert.equal(result.missingFields.length, 3)
})

test('reports malformed tokens and forbids placeholders in attributes', () => {
  const result = renderQuotationTemplate('<p>{{Policy Expiry}} {{Quote.Missing}}</p><a href="https://example.com/{{Quote.Name}}">Link</a>', { Quote: { Name: 'Test' } })
  assert.equal(result.missingFields.length, 2)
  assert.equal(result.unsupportedFields[0], '{{Quote.Name}}')
})

test('handles literal placeholder syntax in data without merging it again', () => {
  const result = renderQuotationTemplate('<p>{{Quote.Name}}</p>', { Quote: { Name: '{{Other.Value}}' } })
  assert.equal(result.resolvedCount, 1)
  assert.equal(result.missingFields.length, 0)
  assert.match(result.html, /\{\{Other.Value\}\}/)
})

test('blocks placeholders split across formatting elements instead of printing unresolved fields', () => {
  const result = renderQuotationTemplate('<p><b>{{Quote.</b><span>Name}}</span></p>', { Quote: { Name: 'QUO-100' } })
  assert.equal(result.missingFields[0], '{{Quote.Name}}')
})

test('recognizes visually empty rich-text drafts', () => {
  assert.equal(renderQuotationTemplate('<p><br></p><div>&nbsp;</div>', {}).hasContent, false)
  assert.equal(renderQuotationTemplate('<p>Quotation</p>', {}).hasContent, true)
})

test('removes editor chip presentation in generated content while keeping chips editable as tokens in authoring', () => {
  const html = '<p><span data-merge-chip="true" class="merge-chip" contenteditable="false" style="background-color:blue;padding:20px">{{Quote.Name}}</span></p>'
  assert.match(sanitizeQuotationHtml(html), /data-merge-chip="true"/)
  assert.equal(renderQuotationTemplate(html, { Quote: { Name: 'QUO-100' } }).html, '<p>QUO-100</p>')
})

test('sanitizes active content and external images but preserves source tables and basic text styles', () => {
  const html = sanitizeQuotationHtml('<script>alert(1)</script><p onclick="alert(1)" style="text-align:center;position:fixed;background-image:url(https://example.com/x)">Safe</p><img src="https://example.com/logo.png" alt="Logo"><table><tr><td colspan="2">Test</td></tr></table>')
  assert.doesNotMatch(html, /script|onclick|position|url\(|<img/)
  assert.match(html, /text-align: center/)
  assert.match(html, /colspan="2"/)
})

test('an entity-based quotation resolves numeric, lookup, choice, and date fields', () => {
  const result = renderQuotationTemplate('<h1>{!aur_quote:aur_name;}</h1><p>{!aur_quote:aur_total_premium;} {!aur_quote:aur_product/@name;} {!aur_quote:statuscode/@name;} {!aur_quote:createdon/@date;}</p>', {
    Quote: { aur_name: 'QUO-100', aur_total_premium: 1050, aur_productname: 'Motor', statuscodename: 'Active', createdon: '2026-11-04T12:00:00Z' },
  })
  assert.equal(result.missingFields.length, 0)
  assert.equal(result.resolvedCount, 5)
  assert.match(result.html, /Motor Active 4 Nov 2026/)
  assert.doesNotMatch(result.html, /\{!|\{\{/)
})

test('legacy quotation fields remain compatible with linked records', () => {
  const result = renderQuotationTemplate('<h1>{{Quote.aur_name}}</h1><p>{{Inquiry.Client}} {{Product.aur_name}} {{Plan.aur_name}}</p>', {
    Quote: { aur_name: 'QUO-100', aur_total_premium: 1050, aur_gross_premium: 1000, aur_loading_premium: 0, aur_vat: 5 },
    Inquiry: { Number: 'INQ-10', Client: 'Example LLC' }, Product: { aur_name: 'Motor' },
    Plan: { aur_name: 'Gold', Coverages: 'Accidental damage', Benefits: 'Roadside assistance', Exclusions: 'None listed' },
  })
  assert.equal(result.missingFields.length, 0)
  assert.equal(result.unsupportedFields.length, 0)
  assert.doesNotMatch(result.html, /\{\{/)
  assert.match(quotationDocumentHtml(result.html), /Content-Security-Policy/)
})

test('saved named badges resolve using their field identity rather than their visible label', () => {
  const result = renderQuotationTemplate('<p><span data-template-token="{!aur_quote:aur_name;}" class="template-field-badge" contenteditable="false">Name</span></p>', { Quote: { aur_name: 'QUO-100' } })
  assert.equal(result.html, '<p>QUO-100</p>')
  assert.equal(result.resolvedCount, 1)
})

test('related fields resolve by lookup path and keep separate account roles distinct', () => {
  const result = renderQuotationTemplate('<p>{!aur_quote:aur_inquiry[aur_inquiry].aur_insured_company[account].emailaddress1;} / {!aur_quote:aur_inquiry[aur_inquiry].aur_broker_company[account].emailaddress1;}</p>', {
    'aur_quote:aur_inquiry[aur_inquiry].aur_insured_company[account]': { emailaddress1: 'insured@example.test' },
    'aur_quote:aur_inquiry[aur_inquiry].aur_broker_company[account]': { emailaddress1: 'broker@example.test' },
  })
  assert.equal(result.html, '<p>insured@example.test / broker@example.test</p>')
  assert.equal(result.resolvedCount, 2)
})

test('previously saved Inquiry tokens resolve the current lookup name and record path', () => {
  const result = renderQuotationTemplate('<p>{!aur_quote:aur_quotes/@name;} / {!aur_quote:aur_quotes[aur_inquiry].aur_name;}</p>', {
    Quote: { aur_inquiryname: 'INQ-100' },
    'aur_quote:aur_inquiry[aur_inquiry]': { aur_name: 'Current inquiry' },
  })
  assert.equal(result.html, '<p>INQ-100 / Current inquiry</p>')
  assert.equal(result.missingFields.length, 0)
})

test('missing related records remain unresolved and related attribute tokens are rejected', () => {
  const token = '{!aur_quote:aur_product[aur_products].aur_heading;}'
  const result = renderQuotationTemplate(`<p>${token}</p><a href="https://example.com/${token}">Link</a>`, {})
  assert.equal(result.missingFields[0], token)
  assert.equal(result.unsupportedFields[0], token)
})

test('canonical unavailable fields, unsupported formats, and attribute placeholders block generation', () => {
  const result = renderQuotationTemplate('<p>{!aur_quote:missing;} {!aur_quote:aur_product/@name;} {!aur_quote:createdon/@date;}</p><a href="https://example.com/{!aur_quote:aur_name;}">Link</a>', { Quote: { _aur_product_value: 'guid', createdon: 'invalid' } })
  assert.equal(result.missingFields.length, 3)
  assert.equal(result.unsupportedFields[0], '{!aur_quote:aur_name;}')
})

test('admin document previews display named badges and serialize back to the same fields', () => {
  const html = quotationDocumentHtml('<p>{!aur_quote:aur_total_premium;}</p>', new Map([['aur_quote:aur_total_premium', 'Total Premium']]))
  const doc = new window.DOMParser().parseFromString(html, 'text/html')
  assert.equal(doc.querySelector('[data-template-token]').textContent, 'Total Premium')
  assert.equal(badgeHelpers.serializeTemplateEditorBody(doc.querySelector('main')), '<p>{!aur_quote:aur_total_premium;}</p>')
})

function serviceFixture(overrides = {}) {
  const calls = []
  const records = {
    Aur_quotesService: { aur_quoteid: 'quote-1', _aur_inquiry_value: 'inquiry-1', aur_name: 'Old quote' },
    Aur_inquiriesService: { aur_inquiry_number: 'INQ-10', aur_insured_companyname: 'Example LLC' },
    Aur_productsesService: { aur_name: 'Selected Product' },
    Aur_plansService: { aur_name: 'Selected Plan' },
    ...overrides,
  }
  const mocks = Object.fromEntries(Object.entries(records).map(([name, data]) => [`../generated/services/${name}`, {
    [name]: { get: async (id) => { calls.push([name, id]); return data === false ? { success: false } : { success: true, data } } },
  }]))
  return { ...load('src/services/quotationTemplatesService.ts', mocks), calls }
}
const values = { name: 'Updated quote', totalPremium: '1,234.50', grossPremium: '1200', loadingPremium: '0', vat: '5', reason: 'Reason', aiSummary: 'Summary', productId: 'selected-product', planId: 'selected-plan' }

test('loads only the linked records, uses visible quote edits, and formats selected plan details', async () => {
  const service = serviceFixture()
  const context = await service.getQuotationTemplateContext('quote-1', values, [{ key: 'coverages', records: [{ name: 'Damage', description: '<p>Up to AED 5,000</p>' }] }, { key: 'benefits', records: [] }])
  assert.equal(context.Quote.aur_name, 'Updated quote')
  assert.equal(context.Quote.aur_total_premium, 1234.5)
  assert.equal(context.Quote.aur_loading_premium, 0)
  assert.equal(context.Inquiry.Client, 'Example LLC')
  assert.equal(context.Plan.Coverages, 'Damage: Up to AED 5,000')
  assert.equal(context.Plan.Benefits, 'None listed')
  assert.ok(service.calls.some(([name, id]) => name === 'Aur_productsesService' && id === 'selected-product'))
  assert.ok(service.calls.some(([name, id]) => name === 'Aur_plansService' && id === 'selected-plan'))
})

test('does not invent missing linked records or load unrelated inquiry data', async () => {
  const service = serviceFixture({ Aur_quotesService: { aur_name: 'Standalone' } })
  const context = await service.getQuotationTemplateContext('quote-1', { ...values, productId: '', planId: '' }, [])
  assert.equal(service.calls.length, 1)
  assert.equal(context.Inquiry.Client, undefined)
  assert.equal(context.Product.aur_name, undefined)
})

test('surfaces linked-record failures and rejects invalid premium values', async () => {
  await assert.rejects(serviceFixture({ Aur_productsesService: false }).getQuotationTemplateContext('quote-1', values, []), /linked product/)
  await assert.rejects(serviceFixture().getQuotationTemplateContext('quote-1', { ...values, totalPremium: 'invalid' }, []), /valid premium/)
  await assert.rejects(serviceFixture({ Aur_quotesService: false }).getQuotationTemplateContext('quote-1', values, []), /quotation data/)
})
