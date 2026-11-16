const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const { JSDOM } = require('jsdom'), { window } = new JSDOM('')
function load(file, mocks = {}) { const exports = {}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, document: window.document, DOMParser: window.DOMParser, NodeFilter: window.NodeFilter, require(name) { if (name in mocks) return mocks[name]; throw Error(name) } }); return exports }
const logos = load('src/lib/documentTemplateLogo.ts')
const page = load('src/lib/documentPageSetup.ts', { './documentTemplateLogo': logos })
const paths = load('src/lib/templateFieldPaths.ts'), badges = load('src/lib/templateFieldBadges.ts', { './templateFieldPaths': paths })
const render = load('src/lib/quotationTemplate.ts', { dompurify: { default: require('dompurify')(window) }, './documentTemplateLogo': logos, './documentPageSetup': page, './templateFieldPaths': paths, './templateFieldBadges': badges })
const image = 'data:image/png;base64,aGVsbG8='
const setup = { headerHtml: '<p style="color:#1d5ba6;text-align:center"><strong>Example Ltd</strong> {!aur_quote:aur_name;}</p>', footerHtml: '<p>Contact and disclaimer</p>', background: { src: image, name: 'logo.png', opacity: 0.36, size: 22, fit: 'fit', position: 'top-right', bleed: false } }

test('page setup round trips independently of body and survives repeated saves', () => {
  const body = '<h1>Quotation</h1><p>{!aur_quote:aur_total_premium;}</p>'
  const stored = page.writeDocumentPageSetup(body, setup), read = page.readDocumentPageSetup(stored)
  assert.equal(read.body, body); assert.equal(read.configured, true)
  assert.deepEqual(JSON.parse(JSON.stringify(read.setup)), setup)
  assert.equal(page.writeDocumentPageSetup(stored, read.setup), stored)
  assert.equal(page.readDocumentPageSetup('<p>Legacy</p>').configured, false)
})

test('old header/footer logos and watermarks migrate to page settings without losing text', () => {
  for (const placement of ['header', 'footer', 'watermark']) {
    const old = logos.writeDocumentTemplateLogo('<p>Terms</p>', { src: image, placement, width: 180, opacity: 0.12, align: 'right' })
    const migrated = page.readDocumentPageSetup(old)
    assert.equal(migrated.body, '<p>Terms</p>')
    assert.equal(migrated.configured, true)
    if (placement === 'watermark') { assert.equal(migrated.setup.background.src, image); assert.equal(migrated.setup.background.opacity, 0.12) }
    else assert.match(migrated.setup[placement + 'Html'], /text-align: right/)
    assert.doesNotMatch(page.writeDocumentPageSetup(migrated.body, migrated.setup), /data-document-logo/)
  }
})

test('settings survive sanitization and all header/body/footer fields populate together', () => {
  const content = page.writeDocumentPageSetup('<p>{!aur_quote:aur_total_premium;}</p>', { ...setup, footerHtml: '<p>Reference {!aur_quote:aur_name;}</p>' })
  const merged = render.renderQuotationTemplate(content, { Quote: { aur_name: 'Q-100', aur_total_premium: 12345.67 } })
  assert.equal(merged.resolvedCount, 3); assert.equal(merged.missingFields.length, 0)
  const read = page.readDocumentPageSetup(merged.html)
  assert.match(read.setup.headerHtml, /Q-100/); assert.match(read.setup.footerHtml, /Q-100/); assert.match(read.body, /12,345.67/)
  assert.equal(read.setup.background.position, 'top-right')
  const preview = new JSDOM(render.quotationDocumentHtml(merged.html)).window.document
  assert.ok(preview.querySelector('.page-setup-header strong'))
  assert.equal(preview.querySelector('.page-setup-background').style.opacity, '0.36')
  assert.equal(preview.querySelector('.page-setup-background img').style.objectFit, 'contain')
})

test('header and footer template fields display named badges in live preview', () => {
  const preview = new JSDOM(render.quotationDocumentHtml(page.writeDocumentPageSetup('<p>Body</p>', setup), new Map([['aur_quote:aur_name', 'Name']]))).window.document
  assert.equal(preview.querySelector('.page-setup-header .template-field-badge').textContent, 'Name')
})

test('normalizes metadata and prevents URL/style injection through page configuration', () => {
  assert.equal(page.normalizePageBackground({ ...setup.background, src: 'https://example.com/image.png' }), null)
  const normalized = page.normalizePageBackground({ ...setup.background, opacity: 5, size: -99, position: 'top;position:fixed', fit: 'url(x)', name: '<Logo>{!token}.png' })
  assert.equal(normalized.opacity, 1); assert.equal(normalized.size, 10); assert.equal(normalized.position, 'center'); assert.equal(normalized.fit, 'fit')
  assert.doesNotMatch(normalized.name, /[{}]/)
  const stored = page.writeDocumentPageSetup('<p>Body</p>', { ...setup, headerHtml: '<script>alert(1)</script><p onclick="alert(1)" style="position:fixed">Header</p>' })
  const html = render.quotationDocumentHtml(stored)
  assert.doesNotMatch(html, /<script|onclick|position: fixed/)
})

test('fit/fill/tile geometry honors proportions, position, opacity, and page-edge bleed', () => {
  const fit = page.pageBackgroundGeometry(setup.background, 600, 180)
  assert.equal(fit.area.x, 45); assert.equal(fit.width, 704 * 0.22); assert.equal(fit.x + fit.width, 749)
  assert.equal(fit.y, 45); assert.equal(fit.width / fit.height, 600 / 180)
  const fill = page.pageBackgroundGeometry({ ...setup.background, fit: 'fill', bleed: true }, 600, 180)
  assert.equal(fill.area.x, 0); assert.ok(fill.width >= fill.box.width); assert.ok(fill.height >= fill.box.height)
  const tile = page.pageBackgroundGeometry({ ...setup.background, fit: 'tile', size: 10 }, 600, 180)
  assert.equal(tile.width, 70.4); assert.equal(tile.height, tile.width * 180 / 600)
})

test('removing a background preserves header and footer content', () => {
  const saved = page.writeDocumentPageSetup('<p>Body</p>', { ...setup, background: null })
  const read = page.readDocumentPageSetup(saved)
  assert.equal(read.setup.background, null); assert.equal(read.setup.headerHtml, setup.headerHtml); assert.equal(read.setup.footerHtml, setup.footerHtml)
})
