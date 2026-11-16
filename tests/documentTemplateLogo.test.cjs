const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { JSDOM } = require('jsdom')
const { window } = new JSDOM('')
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/documentTemplateLogo.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
function load(globals = {}) { const exports = {}; vm.runInNewContext(code, { exports, document: window.document, ...globals }); return exports }
const helpers = load()
const logo = { src: 'data:image/png;base64,aGVsbG8=', placement: 'header', align: 'right', width: 180, opacity: 0.12 }

test('logo and settings round trip separately from editable document content', () => {
  const content = '<h1>Quotation</h1><p>{!aur_quote:aur_name;}</p>'
  for (const placement of ['header', 'footer', 'watermark']) {
    const stored = helpers.writeDocumentTemplateLogo(content, { ...logo, placement })
    const restored = helpers.readDocumentTemplateLogo(stored)
    assert.equal(restored.body, content)
    assert.deepEqual(JSON.parse(JSON.stringify(restored.logo)), { ...logo, placement })
    assert.equal(helpers.writeDocumentTemplateLogo(stored, restored.logo), stored)
    assert.equal(helpers.writeDocumentTemplateLogo(stored, null), content)
  }
})

test('legacy documents keep ordinary embedded images and have no logo settings', () => {
  const content = '<p>Existing document</p><img src="data:image/png;base64,aGVsbG8=">'
  const restored = helpers.readDocumentTemplateLogo(content)
  assert.equal(restored.logo, null)
  assert.equal(restored.body, content)
})

test('rejects remote, SVG, malformed, and oversized image sources', () => {
  for (const src of ['https://example.com/logo.png', 'data:image/svg+xml;base64,aGVsbG8=', 'data:image/png;base64,invalid" onerror="alert(1)', 'data:image/png;base64,' + 'a'.repeat(700000)]) {
    assert.equal(helpers.normalizeDocumentLogo({ ...logo, src }), null)
    assert.throws(() => helpers.writeDocumentTemplateLogo('<p>Body</p>', { ...logo, src }), /valid embedded/)
  }
  assert.equal(helpers.readDocumentTemplateLogo('<div data-document-logo="v1"><img src="https://example.com/x"></div><p>Safe</p>').logo, null)
})

test('untrusted settings cannot inject CSS and numeric settings stay within supported bounds', () => {
  const restored = helpers.readDocumentTemplateLogo(`<div data-document-logo="v1" data-logo-placement="fixed" data-logo-align="left;position:fixed" data-logo-width="999999" data-logo-opacity="-1"><img src="${logo.src}"></div>`).logo
  assert.equal(restored.placement, 'header')
  assert.equal(restored.align, 'left')
  assert.equal(restored.width, 480)
  assert.equal(restored.opacity, 0.05)
  const normalized = helpers.normalizeDocumentLogo({ ...logo, width: NaN, opacity: Infinity })
  assert.equal(normalized.width, 180)
  assert.equal(normalized.opacity, 0.12)
})

test('wide and tall logos retain their aspect ratio and reserve bounded header space', () => {
  const wide = helpers.documentLogoSize({ ...logo, width: 240 }, 1200, 200)
  assert.equal(wide.width, 240); assert.equal(wide.height, 40)
  const tall = helpers.documentLogoSize(logo, 200, 1000)
  assert.equal(tall.height, 64); assert.equal(tall.width, 12.8)
  const watermark = helpers.documentLogoSize({ ...logo, placement: 'watermark', width: 480 }, 800, 800)
  assert.equal(watermark.width, 480); assert.equal(watermark.height, 480)
})

test('file validation rejects unsupported and oversized uploads before decoding', async () => {
  const { readDocumentLogoFile } = load({ FileReader: class { constructor() { throw new Error('Should not read') } } })
  await assert.rejects(() => readDocumentLogoFile({ name: 'logo.svg', size: 100 }), /PNG or JPEG/)
  await assert.rejects(() => readDocumentLogoFile({ name: 'logo.png', size: 3 * 1024 * 1024 }), /2 MB/)
  await assert.rejects(() => readDocumentLogoFile({ name: 'logo.jpg', size: 0 }), /2 MB/)
})

test('uses CSP-compatible data URLs, resizes locally, and preserves PNG transparency', async () => {
  const sources = []; const formats = []; const canvas = { width: 0, height: 0, getContext: () => ({ drawImage() {} }), toDataURL: (type) => { formats.push(type); return `data:${type};base64,aGVsbG8=` } }
  class Image { naturalWidth = 2000; naturalHeight = 500; set src(value) { sources.push(value) } async decode() {} }
  class FileReader { readAsDataURL() { this.result = logo.src; this.onload() } }
  const { readDocumentLogoFile } = load({ Image, FileReader, URL: { createObjectURL() { throw new Error('Blob images violate host CSP') } }, document: { createElement: () => canvas } })
  await readDocumentLogoFile({ name: 'logo.png', size: 100 })
  assert.equal(canvas.width, 1000); assert.equal(canvas.height, 250)
  await readDocumentLogoFile({ name: 'logo.JPG', size: 100 })
  assert.deepEqual(formats, ['image/png', 'image/jpeg'])
  assert.deepEqual(sources, [logo.src, logo.src])
})

test('unreadable images and file-read failures fail clearly', async () => {
  class Image { async decode() { throw new Error('Bad image') } }
  class FileReader { readAsDataURL() { this.result = logo.src; this.onload() } }
  const { readDocumentLogoFile } = load({ Image, FileReader })
  await assert.rejects(() => readDocumentLogoFile({ name: 'broken.png', size: 100 }), /could not be read/)
  const unreadable = load({ FileReader: class { readAsDataURL() { this.onerror() } } })
  await assert.rejects(() => unreadable.readDocumentLogoFile({ name: 'broken.png', size: 100 }), /Unable to read/)
})
