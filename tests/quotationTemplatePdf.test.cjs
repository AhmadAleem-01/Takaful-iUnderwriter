const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const { JSDOM } = require('jsdom')
const { jsPDF } = require('jspdf')
const { window } = new JSDOM('')
function load(file, globals) { const exports = {}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, ...globals }); return exports }
const logos = load('src/lib/documentTemplateLogo.ts', { document: window.document })
// Valid opaque 1-pixel PNG; the test checks PDF commands and page reservations, not browser image decoding.
const src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4XmOQjV72HwAD1QIeDIGuRAAAAABJRU5ErkJggg=='

function harness(fail = false) {
  const state = { removed: false, pdf: null, options: null, initialListeners: 0 }
  const content = window.document.createElement('main')
  content.innerHTML = '<p>Synthetic quotation</p>'
  const frame = { style: {}, setAttribute() {}, contentDocument: { querySelector: () => content }, contentWindow: window, remove() { state.removed = true } }
  class Pdf extends jsPDF {
    constructor(options) {
      super(options); state.pdf = this
      state.initialListeners = Object.keys(this.internal.events.getTopics().addPage ?? {}).length
      this.html = async (_, options) => {
        state.options = options
        this.text('First page terms', 12, options.margin[0] + 10)
        this.addPage()
        this.text('Second page terms', 12, options.margin[0] + 10)
        if (fail) throw new Error('Renderer failed')
        return this
      }
    }
  }
  class Image { naturalWidth = 600; naturalHeight = 180; async decode() {} }
  const module = load('src/lib/quotationTemplatePdf.ts', {
    document: { createElement: () => frame, body: { appendChild: () => frame.onload() } }, window, Image,
    require(name) {
      if (name === 'jspdf') return { jsPDF: Pdf }
      if (name === './quotationTemplate') return { quotationDocumentHtml: html => html }
      if (name === './documentTemplateLogo') return logos
      throw new Error(name)
    },
  })
  return { ...module, state }
}

test('repeats logos before text on each PDF page and reserves header/footer space', async () => {
  for (const placement of ['header', 'footer', 'watermark']) {
    const { createQuotationTemplatePdf, state } = harness()
    const html = logos.writeDocumentTemplateLogo('<p>Quotation</p>', { src, placement, align: 'right', width: 220, opacity: 0.18 })
    const pdf = await createQuotationTemplatePdf(html)
    assert.equal(pdf.getNumberOfPages(), 2)
    for (const page of pdf.internal.pages.slice(1)) {
      const stream = page.join('\n')
      assert.equal((stream.match(/\/I\d+ Do/g) ?? []).length, 1)
      assert.ok(stream.indexOf(' Do') < stream.indexOf('BT'), 'watermark must be drawn behind text')
      assert.equal(/\/GS\d+ gs/.test(stream), placement === 'watermark')
    }
    assert.equal(state.options.margin[0], placement === 'header' ? 35 : 12)
    assert.equal(state.options.margin[2], placement === 'footer' ? 35 : 12)
    assert.equal(state.options.html2canvas.backgroundColor, null)
    assert.equal(Object.keys(pdf.internal.events.getTopics().addPage ?? {}).length, state.initialListeners)
    assert.equal(state.removed, true)
  }
})

test('plain templates preserve existing page margins and do not add images', async () => {
  const { createQuotationTemplatePdf, state } = harness()
  const pdf = await createQuotationTemplatePdf('<p>Plain quotation</p>')
  assert.deepEqual([...state.options.margin], [12, 12, 12, 12])
  assert.ok(pdf.internal.pages.slice(1).every(page => !page.join('\n').includes(' Do')))
  assert.equal(state.removed, true)
})

test('rendering failures clean up the isolated frame and repeat-logo listener', async () => {
  const { createQuotationTemplatePdf, state } = harness(true)
  const html = logos.writeDocumentTemplateLogo('<p>Quotation</p>', { src, placement: 'header', align: 'left', width: 180, opacity: 0.12 })
  await assert.rejects(() => createQuotationTemplatePdf(html), /Renderer failed/)
  assert.equal(state.removed, true)
  assert.equal(Object.keys(state.pdf.internal.events.getTopics().addPage ?? {}).length, state.initialListeners)
})
