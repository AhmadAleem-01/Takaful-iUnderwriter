const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const { JSDOM } = require('jsdom'), { jsPDF } = require('jspdf')
const { window } = new JSDOM('')
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4XmOQjV72HwAD1QIeDIGuRAAAAABJRU5ErkJggg=='
function load(file, globals = {}) { const exports = {}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, document: window.document, ...globals }); return exports }
const logos = load('src/lib/documentTemplateLogo.ts')
const pages = load('src/lib/documentPageSetup.ts', { require: () => logos })
const background = { src: png, name: 'Logo.png', opacity: 0.36, size: 22, fit: 'fit', position: 'top-right', bleed: false }

function harness({ fail = false, headerHeight = 42 } = {}) {
  const state = { removed: false, pdf: null, options: null, renders: [], draws: [], clips: [], initialListeners: 0 }
  const source = window.document.createElement('div')
  source.innerHTML = '<div><div class="page-setup-header"><p>Letterhead</p></div><div class="page-setup-body"><p>Quotation terms</p></div><div class="page-setup-footer"><p>Contact</p></div></div>'
  for (const part of ['header', 'footer']) source.querySelector('.page-setup-' + part).getBoundingClientRect = () => ({ height: part === 'header' ? headerHeight : 30 })
  const frame = { style: {}, setAttribute() {}, contentDocument: source, contentWindow: window, remove() { state.removed = true } }
  const canvas = { width: 0, height: 0, getContext: () => ({ scale() {}, set globalAlpha(value) { state.opacity = value }, beginPath() {}, rect(...args) { state.clips.push(args) }, clip() {}, drawImage(...args) { state.draws.push(args.slice(1)) } }), toDataURL: () => png }
  class Image { naturalWidth = 600; naturalHeight = 180; async decode() {} }
  class Pdf extends jsPDF {
    constructor(options) { super(options); state.pdf = this; state.initialListeners = Object.keys(this.internal.events.getTopics().addPage ?? {}).length; this.html = async (_, options) => { state.options = options; this.text('Page one terms', 12, 50); this.addPage(); this.text('Page two terms', 12, 50); if (fail) throw Error('Renderer failed'); return this } }
  }
  const module = load('src/lib/documentPageSetupPdf.ts', {
    window, Image, document: { createElement: (tag) => tag === 'iframe' ? frame : canvas, body: { appendChild: () => frame.onload() } },
    require(name) {
      if (name === 'jspdf') return { jsPDF: Pdf }
      if (name === 'html2canvas') return { default: async (part) => { state.renders.push(part.className); return canvas } }
      if (name === './documentPageSetup') return pages
      if (name === './quotationTemplate') return { quotationDocumentHtml: html => html, sanitizeQuotationHtml: html => html }
      throw Error(name)
    },
  })
  return { ...module, state, canvas }
}

test('background raster honors fit/fill/tile geometry and clipping at the margin or page edge', async () => {
  for (const fit of ['fit', 'fill', 'tile']) {
    const { renderPageBackground, state, canvas } = harness()
    await renderPageBackground({ ...background, fit })
    assert.equal(canvas.width, 1588); assert.equal(canvas.height, 2246)
    assert.equal(state.opacity, 0.36)
    assert.deepEqual(state.clips[0], [45, 45, 704, 1033])
    assert.equal(state.clips.length, fit === 'fill' ? 2 : 1)
    assert.equal(state.draws.length > 1, fit === 'tile')
    const edge = harness(); await edge.renderPageBackground({ ...background, fit, bleed: true })
    assert.deepEqual(edge.state.clips[0], [0, 0, 794, 1123])
  }
})

test('rich header/footer and background repeat before text with enough space on every page', async () => {
  const { createDocumentPageSetupPdf, state } = harness()
  const html = pages.writeDocumentPageSetup('<p>Body</p>', { headerHtml: '<p>Letterhead</p>', footerHtml: '<p>Contact</p>', background })
  const pdf = await createDocumentPageSetupPdf(html)
  assert.equal(pdf.getNumberOfPages(), 2)
  for (const page of pdf.internal.pages.slice(1)) { const stream = page.join('\n'); assert.equal((stream.match(/\/I\d+ Do/g) ?? []).length, 3); assert.ok(stream.lastIndexOf(' Do') < stream.indexOf('BT')) }
  assert.ok(state.options.margin[0] > 25); assert.ok(state.options.margin[2] > 20)
  assert.equal(state.options.html2canvas.ignoreElements({ tagName: 'IFRAME' }), true)
  assert.equal(state.options.html2canvas.ignoreElements({ tagName: 'P' }), false)
  assert.deepEqual(state.renders, ['page-setup-header', 'page-setup-footer'])
  assert.equal(state.removed, true)
  assert.equal(Object.keys(pdf.internal.events.getTopics().addPage ?? {}).length, state.initialListeners)
})

test('oversized repeated content reports an actionable error and removes its frame', async () => {
  const { createDocumentPageSetupPdf, state } = harness({ headerHeight: 200 })
  await assert.rejects(() => createDocumentPageSetupPdf(pages.writeDocumentPageSetup('<p>Body</p>', { ...pages.emptyPageSetup(), headerHtml: '<p>Long header</p>' })), /header is too tall/)
  assert.equal(state.removed, true)
})

test('rendering failures clean up the frame and repeated-content listener', async () => {
  const { createDocumentPageSetupPdf, state } = harness({ fail: true })
  await assert.rejects(() => createDocumentPageSetupPdf(pages.writeDocumentPageSetup('<p>Body</p>', { ...pages.emptyPageSetup(), headerHtml: '<p>Header</p>' })), /Renderer failed/)
  assert.equal(state.removed, true)
  assert.equal(Object.keys(state.pdf.internal.events.getTopics().addPage ?? {}).length, state.initialListeners)
})
