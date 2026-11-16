const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { JSDOM } = require('jsdom')
const createDOMPurify = require('dompurify')
const { createCanvas } = require('@napi-rs/canvas')
const JSZip = require('jszip')

function compile(file, dependencies = {}, globals = {}) {
  const context = { exports: {}, TextDecoder, Uint8Array, URL, atob, DOMException, AbortController, setTimeout, clearTimeout, ...globals,
    require: (name) => { if (name.endsWith('/evidenceSessionCache')) return sessionCache;
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`); return dependencies[name] } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, context)
  return context.exports
}
const sessionCache = compile('lib/evidenceSessionCache.ts')
const evidence = compile('lib/inquiryEvidence.ts')
const format = compile('lib/evidenceDocumentFormat.ts')
const packages = Promise.all([import('@office-kit/pptx'), import('@office-kit/pptx-preview')])

async function fixture() {
  const [p] = await packages
  const pres = p.createPresentation()
  const add = (slide, text, y = 1) => p.addSlideTextBox(slide, { x: p.inches(1), y: p.inches(y), w: p.inches(8), h: p.inches(.7), text })
  const first = p.addBlankSlide(pres)
  const split = add(first, '')
  p.setShapeParagraphs(split, [{ runs: [{ text: 'Premium pay', format: { bold: true } }, { text: 'able USD 1500' }] }])
  p.addSlideTable(first, { x: p.inches(1), y: p.inches(2), w: p.inches(8), h: p.inches(1), rows: [['Status', 'No claims']] })
  add(first, 'قسط التأمين', 4)
  add(first, 'Cover not included', 5)
  const hidden = add(first, 'Hidden evidence', 6); p.setShapeHidden(hidden, true)
  p.setSlideNotes(first, 'Notes-only evidence')
  const second = p.addBlankSlide(pres)
  const rotated = add(second, 'Premium payable USD 1500'); p.setShapeRotation(rotated, 12)
  add(second, 'Document checks passed', 3)
  const third = p.addBlankSlide(pres)
  add(third, 'Front and back supplied')
  return p.savePresentation(pres)
}

function setup() {
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true })
  dom.window.HTMLCanvasElement.prototype.getContext = () => createCanvas(1, 1).getContext('2d')
  // JSDOM has no SVG layout engine. Keep glyph geometry explicit in these DOM
  // tests; the reader and SVG renderer themselves are the real shipped packages.
  dom.window.SVGElement.prototype.getNumberOfChars = function () { return this.textContent.length }
  dom.window.SVGElement.prototype.getExtentOfChar = function (index) {
    return { x: Number(this.getAttribute('x') || 0) + index * 10, y: Number(this.getAttribute('y') || 0) - 20, width: 10, height: 24 }
  }
  dom.window.HTMLElement.prototype.scrollTo = function ({ top, left }) { this.scrollTop = top; this.scrollLeft = left }
  const root = dom.window.document.getElementById('root')
  return { dom, root, async helpers(overrides = {}) {
    const [p, preview] = await packages
    const packageHelpers = compile('lib/pptxPackage.ts', { jszip: JSZip }, { DOMParser: dom.window.DOMParser })
    return compile('lib/pptxEvidence.ts', { '@office-kit/pptx': p, '@office-kit/pptx-preview': preview, dompurify: createDOMPurify(dom.window), './inquiryEvidence': evidence, './pptxPackage': packageHelpers, ...overrides }, { document: dom.window.document })
  } }
}

async function trashFixture() {
  const archive = await JSZip.loadAsync(await fixture())
  archive.file('[trash]/0000.dat', 'Unused deleted slide bytes')
  archive.file('[trash]/0001.dat', 'Unused deleted media bytes')
  return archive.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
}

test('previews PPTX files with unregistered trash entries without changing the original source', async () => {
  const { dom, root, helpers } = setup()
  try {
    const [p] = await packages, bytes = await trashFixture(), before = Buffer.from(bytes)
    await assert.rejects(p.loadPresentation(bytes), /part "\/\[trash\]\/0000.dat" has no content type registered/)
    const api = await helpers(), slides = await api.readPptxEvidence(bytes, 'trash')
    assert.equal(slides.length, 3)
    slides.forEach((slide) => root.append(slide.svg))
    assert.equal(api.findPptxEvidenceMatches(slides, ['Premium payable USD 1500']).matches.length, 2)
    assert.deepEqual(Buffer.from(bytes), before)
    const cleaner = compile('lib/pptxPackage.ts', { jszip: JSZip }, { DOMParser: dom.window.DOMParser })
    const original = await JSZip.loadAsync(bytes), cleaned = await JSZip.loadAsync(await cleaner.withoutUnreferencedPptxTrash(bytes))
    assert.equal(Object.keys(cleaned.files).some((name) => name.startsWith('[trash]/')), false)
    for (const [name, file] of Object.entries(original.files)) {
      if (file.dir || name.startsWith('[trash]/')) continue
      assert.deepEqual(Buffer.from(await cleaned.file(name).async('uint8array')), Buffer.from(await file.async('uint8array')), name)
    }
  } finally { dom.window.close() }
})

test('does not discard trash content referenced by package or slide relationships', async () => {
  const { dom, helpers } = setup()
  try {
    const api = await helpers()
    for (const [part, target] of [['_rels/.rels', '[trash]/0000.dat'], ['ppt/slides/_rels/slide1.xml.rels', '../../%5Btrash%5D/0000.dat']]) {
      const archive = await JSZip.loadAsync(await trashFixture())
      const xml = new dom.window.DOMParser().parseFromString(await archive.file(part).async('string'), 'application/xml')
      const link = xml.createElementNS(xml.documentElement.namespaceURI, 'Relationship')
      link.setAttribute('Id', 'rIdTrash'); link.setAttribute('Type', 'urn:test:trash'); link.setAttribute('Target', target)
      xml.documentElement.append(link)
      archive.file(part, new dom.window.XMLSerializer().serializeToString(xml))
      await assert.rejects(api.readPptxEvidence(await archive.generateAsync({ type: 'uint8array' }), 'linked-trash'), /references content in its trash folder/)
    }
  } finally { dom.window.close() }
})

test('a missing content type outside the trash folder is still rejected', async () => {
  const { dom, helpers } = setup()
  try {
    const archive = await JSZip.loadAsync(await trashFixture())
    archive.file('ppt/unknown.dat', 'Unknown active package content')
    const api = await helpers()
    await assert.rejects(api.readPptxEvidence(await archive.generateAsync({ type: 'uint8array' }), 'invalid-type'), /part "\/ppt\/unknown.dat" has no content type registered/)
  } finally { dom.window.close() }
})

test('an invalid relationship mode is not treated as proof that trash is unused', async () => {
  const { dom, helpers } = setup()
  try {
    const archive = await JSZip.loadAsync(await trashFixture())
    const xml = new dom.window.DOMParser().parseFromString(await archive.file('_rels/.rels').async('string'), 'application/xml')
    const link = xml.createElementNS(xml.documentElement.namespaceURI, 'Relationship')
    link.setAttribute('Id', 'rIdTrash'); link.setAttribute('Type', 'urn:test:trash'); link.setAttribute('Target', '[trash]/0000.dat'); link.setAttribute('TargetMode', 'external')
    xml.documentElement.append(link)
    archive.file('_rels/.rels', new dom.window.XMLSerializer().serializeToString(xml))
    const api = await helpers()
    await assert.rejects(api.readPptxEvidence(await archive.generateAsync({ type: 'uint8array' }), 'invalid-mode'), /invalid relationship mode/)
  } finally { dom.window.close() }
})

test('archive-limit errors do not trigger trash cleanup or bypass reader validation', async () => {
  const { dom, helpers } = setup()
  try {
    let cleanup = 0, loads = 0
    const api = await helpers({ '@office-kit/pptx': { loadPresentation: async (_bytes, options) => {
      loads++
      assert.equal(options.limits.maxTotalUncompressedBytes, 250 * 1024 * 1024)
      throw new Error('invalid ZIP: archive exceeds maxTotalUncompressedBytes')
    } }, './pptxPackage': { withoutUnreferencedPptxTrash: async () => { cleanup++; throw new Error('Must not run') } } })
    await assert.rejects(api.readPptxEvidence(new Uint8Array([1]), 'too-large'), /maxTotalUncompressedBytes/)
    assert.equal(loads, 1); assert.equal(cleanup, 0)
  } finally { dom.window.close() }
})

test('recognizes PPTX filenames, MIME types and linked paths, with a legacy PPT fallback', () => {
  const zip = Uint8Array.from([0x50, 0x4b, 0x03, 0x04])
  assert.equal(format.evidenceDocumentFormat(zip, 'Presentation.PPTX'), 'pptx')
  assert.equal(format.evidenceDocumentFormat(zip, 'Presentation', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'), 'pptx')
  assert.equal(format.evidenceDocumentFormat(zip, 'Presentation', '', '/files/Presentation.pptx'), 'pptx')
  assert.equal(format.evidenceDocumentFormat(new Uint8Array(), 'Presentation.ppt'), 'ppt')
  assert.throws(() => format.evidenceDocumentFormat(new TextEncoder().encode('<html>Login</html>'), 'Presentation.pptx'), /not a valid PPTX/)
})

test('renders a real PPTX and matches split runs, table cells, Arabic and repeated text per slide', async () => {
  const { dom, root, helpers } = setup()
  try {
    const api = await helpers(), bytes = await fixture(), before = Buffer.from(bytes)
    const slides = await api.readPptxEvidence(bytes, 'test')
    assert.equal(slides.length, 3)
    assert.equal(slides[0].width, 1280); assert.equal(slides[0].height, 720)
    for (const slide of slides) root.append(slide.svg)
    const passages = ['Premium payable USD 1500', 'Status: No claims', 'قسط التأمين']
    const result = api.findPptxEvidenceMatches(slides, passages)
    assert.deepEqual(Array.from(result.matches, (match) => [match.evidenceIndex, match.page]), [[0, 1], [1, 1], [2, 1], [0, 2]])
    assert.ok(slides[0].svg.querySelectorAll('text tspan').length > 2)
    assert.equal(slides[0].svg.querySelector('foreignObject'), null)
    const source = root.textContent
    assert.ok(api.drawPptxEvidenceHighlights(result) >= 4)
    assert.equal(root.textContent, source)
    const active = api.activatePptxEvidence(root, 3)
    assert.ok(active.getAttribute('fill').includes('251'))
    assert.ok(slides[0].svg.querySelector('[data-pptx-evidence-match="0"]').getAttribute('fill').includes('250'))
    assert.ok(active.closest('[data-pptx-shape-id]').querySelector('[transform*="rotate"]'))
    assert.deepEqual(Buffer.from(bytes), before)
  } finally { dom.window.close() }
})

test('does not match notes, hidden shapes, partial words, changed facts or text spanning slides', async () => {
  const { dom, root, helpers } = setup()
  try {
    const api = await helpers(), slides = await api.readPptxEvidence(await fixture(), 'limits')
    slides.forEach((slide) => root.append(slide.svg))
    for (const query of ['Hidden evidence', 'Notes-only evidence', 'Premium payable USD 15000', 'Cover included', 'pay', 'Document checks passed Front and back supplied']) {
      assert.equal(api.findPptxEvidenceMatches(slides, [query]).matches.length, 0, query)
    }
    assert.equal(api.findPptxEvidenceMatches(slides, ['Cover not included']).matches.length, 1)
  } finally { dom.window.close() }
})

test('reopening PPTX reuses parsing/rendering but creates clean slides for different evidence', async () => {
  const { dom, root, helpers } = setup()
  try {
    const [p, preview] = await packages
    let reads = 0, renders = 0
    const api = await helpers({
      '@office-kit/pptx': { ...p, loadPresentation: (...args) => { reads++; return p.loadPresentation(...args) } },
      '@office-kit/pptx-preview': { ...preview, renderSlideToSvg: (...args) => { renders++; return preview.renderSlideToSvg(...args) } },
    })
    const bytes = await fixture()
    const first = await api.readPptxEvidence(bytes, 'first')
    first.forEach((slide) => root.append(slide.svg))
    api.drawPptxEvidenceHighlights(api.findPptxEvidenceMatches(first, ['Premium payable USD 1500']))
    assert.ok(first[0].svg.querySelector('[data-pptx-evidence-match]'))
    const second = await api.readPptxEvidence(bytes, 'second')
    assert.equal(reads, 1); assert.equal(renders, 3)
    assert.notEqual(first[0].svg, second[0].svg)
    assert.equal(second[0].svg.querySelector('[data-pptx-evidence-match]'), null)
    assert.equal(api.findPptxEvidenceMatches(second, ['Document checks passed']).matches[0].page, 2)
  } finally { dom.window.close() }
})

test('matches visual row order when a presentation stores column labels before their values', async () => {
  const { dom, root, helpers } = setup()
  try {
    const api = await helpers()
    const svg = api.sanitizePptxEvidenceSvg('<svg viewBox="0 0 500 200"><g data-pptx-shape-id="2"><text>Inception</text><text>Currency</text><text>02/01/2026</text><text>USD and EUR</text></g></svg>', 'columns')
    root.append(svg)
    const boxes = [[10, 10], [10, 50], [200, 10], [200, 50]]
    ;[...svg.querySelectorAll('text')].forEach((text, i) => { text.getBoundingClientRect = () => ({ left: boxes[i][0], bottom: boxes[i][1] + 20, width: 120, height: 20 }) })
    const { matches } = api.findPptxEvidenceMatches([{ svg, page: 1 }], ['Inception 02/01/2026 Currency USD and EUR'])
    assert.equal(matches.length, 1)
    assert.deepEqual(Array.from(matches[0].ranges, (range) => range.item), [0, 2, 1, 3])
  } finally { dom.window.close() }
})

test('does not highlight partial currency amounts, percentages or signed numeric values', async () => {
  const { dom, root, helpers } = setup()
  try {
    const api = await helpers()
    const svg = api.sanitizePptxEvidenceSvg('<svg viewBox="0 0 600 100"><g data-pptx-shape-id="2"><text>Premium $1,500.00; Tax 5%; Adjustment -20</text></g></svg>', 'numbers')
    root.append(svg)
    const slides = [{ svg, page: 1 }]
    for (const query of ['500', '1,500', '1,500.00', 'Tax 5', '20', 'Adjustment 20']) assert.equal(api.findPptxEvidenceMatches(slides, [query]).matches.length, 0, query)
    for (const query of ['$1,500.00', 'Tax 5%', 'Adjustment -20']) assert.equal(api.findPptxEvidenceMatches(slides, [query]).matches.length, 1, query)
  } finally { dom.window.close() }
})

test('sanitizes slide SVG, retains safe graphics, and isolates gradient and clip identifiers', async () => {
  const { dom, helpers } = setup()
  try {
    const api = await helpers()
    const source = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" onload="alert(1)"><defs><linearGradient id="paint"><stop offset="0" stop-color="red"/></linearGradient></defs><style>@import "https://evil.example/x.css";</style><script>alert(1)</script><foreignObject><div>Active content</div></foreignObject><image href="https://evil.example/tracker.png"/><image href="data:image/png;base64,AAAA"/><rect fill="url(#paint)" style="filter:url(https://evil.example/filter)"/><g data-pptx-shape-id="2"><text>Source text</text></g><g data-pptx-fallback="image" data-pptx-shape-id="3"><text>Placeholder evidence</text></g><text aria-hidden="true">Reflection</text></svg>'
    const one = api.sanitizePptxEvidenceSvg(source, 'one'), two = api.sanitizePptxEvidenceSvg(source, 'two')
    assert.equal(one.querySelector('script, style, foreignObject, [onload]'), null)
    assert.equal(one.querySelector('image').getAttribute('href'), null)
    assert.ok(one.querySelectorAll('image')[1].getAttribute('href').startsWith('data:image/png'))
    assert.ok(one.querySelector('rect').getAttribute('fill').includes('#one-0'))
    assert.equal(one.querySelector('[id]').id, 'one-0'); assert.equal(two.querySelector('[id]').id, 'two-0')
    assert.ok(!one.outerHTML.includes('evil.example'))
    const result = api.findPptxEvidenceMatches([{ svg: one, page: 1 }], ['Source text', 'Placeholder evidence', 'Reflection'])
    assert.equal(result.matches.length, 1)
  } finally { dom.window.close() }
})

test('draws only exact source character ranges and activates overlapping evidence without changing text', async () => {
  const { dom, root, helpers } = setup()
  try {
    const api = await helpers()
    const svg = api.sanitizePptxEvidenceSvg('<svg viewBox="0 0 400 100"><g data-pptx-shape-id="2"><text x="10" y="40" transform="rotate(10)">Cover not included</text></g></svg>', 'range')
    root.append(svg)
    const result = api.findPptxEvidenceMatches([{ svg, page: 1 }], ['Cover not included', 'not included'])
    assert.equal(result.matches.length, 2)
    api.drawPptxEvidenceHighlights(result)
    const rect = root.querySelector('[data-pptx-evidence-match="1"]')
    assert.equal(rect.getAttribute('x'), '70'); assert.equal(rect.getAttribute('width'), '120')
    assert.equal(rect.parentElement.getAttribute('transform'), 'rotate(10)')
    assert.equal(root.textContent, 'Cover not included')
    api.activatePptxEvidence(root, 0)
    assert.equal(root.querySelector('text').previousElementSibling.querySelector('rect').getAttribute('data-pptx-evidence-match'), '0')
    const count = root.querySelectorAll('rect').length
    api.drawPptxEvidenceHighlights(result)
    assert.equal(root.querySelectorAll('rect').length, count)
  } finally { dom.window.close() }
})

test('rejects malformed or empty decks and honours cancellation while rendering slides', async () => {
  const { dom, helpers } = setup()
  try {
    const api = await helpers(), [p] = await packages
    await assert.rejects(api.readPptxEvidence(new Uint8Array([1, 2, 3]), 'bad'))
    await assert.rejects(api.readPptxEvidence(await p.savePresentation(p.createPresentation()), 'empty'), /does not contain any slides/)
    const controller = new AbortController(), progress = []
    await assert.rejects(api.readPptxEvidence(await fixture(), 'cancel', (label) => { progress.push(label); controller.abort() }, controller.signal), /cancelled/)
    assert.equal(progress.length, 1)
    await assert.rejects(api.readPptxEvidence(await fixture(), 'cancel', undefined, controller.signal), /cancelled/)
  } finally { dom.window.close() }
})

test('retrieves a PPTX through the existing evidence flow without altering file bytes', async () => {
  const bytes = await fixture()
  let input
  const api = compile('services/inquiryEvidenceService.ts', { '../lib/inquiryEvidence': evidence, '../lib/evidenceDocumentFormat': format, './sharePointSiteService': {},
    '../generated/services/GetInquiryEvidenceDocumentService': { GetInquiryEvidenceDocumentService: { Run: async (value) => {
      input = value
      return { success: true, data: { success: 'true', filename: 'Evidence.pptx', mimetype: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', contentbase64: Buffer.from(bytes).toString('base64') } }
    } } },
  })
  const result = await api.getInquiryEvidenceDocument('inquiry', '/aur_inquiry/Example/Evidence.pptx', 'Evidence.pptx')
  assert.equal(result.format, 'pptx'); assert.equal(input.text_1, '/aur_inquiry/Example/Evidence.pptx')
  assert.deepEqual(Buffer.from(result.bytes), Buffer.from(bytes))
})

test('PowerPoint workspace navigates slides and matches, zooms, preserves source SVG and shows errors', async () => {
  const { dom, root: rootElement, helpers } = setup()
  const saved = new Map()
  for (const name of ['window', 'document', 'Node', 'Element', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT']) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, { value: name === 'IS_REACT_ACT_ENVIRONMENT' ? true : name === 'window' ? dom.window : dom.window[name], writable: true, configurable: true })
  }
  const React = require('react'), { act } = React, root = require('react-dom/client').createRoot(rootElement)
  try {
    const api = await helpers()
    const dependencies = { react: React, 'react/jsx-runtime': require('react/jsx-runtime'), 'lucide-react': require('lucide-react'),
      '../ui/Button': { Button: ({ children, variant, size, ...props }) => React.createElement('button', props, children) } }
    const layout = compile('components/inquiries/EvidenceViewerLayout.tsx', dependencies)
    const { default: Viewer } = compile('components/inquiries/PptxEvidenceViewer.tsx', { ...dependencies, '../../lib/pptxEvidence': api, './EvidenceViewerLayout': layout }, { document: dom.window.document })
    await act(async () => root.render(React.createElement(Viewer, { bytes: await fixture(), passages: ['Premium payable USD 1500', 'Document checks passed'] })))
    for (let attempt = 0; attempt < 40 && rootElement.querySelector('[aria-busy="true"]'); attempt++) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)) })
    assert.equal(rootElement.querySelector('[role="alert"]'), null)
    assert.ok(rootElement.textContent.includes('3 text matches found'))
    assert.ok(rootElement.textContent.includes('Slide 1 / 3'))
    const click = async (label) => {
      const button = rootElement.querySelector(`button[aria-label="${label}"]`)
      assert.ok(button, label); assert.equal(button.disabled, false, label)
      await act(async () => button.click())
    }
    await click('Next evidence match')
    assert.ok(rootElement.textContent.includes('Slide 2 / 3'))
    assert.ok(rootElement.textContent.includes('2 of 3'))
    await click('Next slide'); assert.ok(rootElement.textContent.includes('Slide 3 / 3'))
    await click('Zoom in'); assert.ok(rootElement.textContent.includes('110%'))
    await click('Previous evidence match'); assert.ok(rootElement.textContent.includes('Slide 1 / 3'))
    assert.equal(rootElement.querySelectorAll('svg[aria-label^="Original PowerPoint slide"]').length, 3)
    await act(async () => root.render(React.createElement(Viewer, { bytes: new Uint8Array([1, 2, 3]), passages: ['Unknown'] })))
    for (let attempt = 0; attempt < 20 && rootElement.querySelector('[aria-busy="true"]'); attempt++) await act(async () => { await new Promise(setImmediate) })
    assert.ok(rootElement.querySelector('[role="alert"]').textContent.includes('Unable to preview this PowerPoint file'))
    assert.equal(rootElement.querySelector('section[data-evidence-page]'), null)
  } finally {
    await act(async () => root.unmount())
    for (const [name, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name] }
    dom.window.close()
  }
})
