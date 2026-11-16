const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { JSDOM } = require('jsdom')
const createDOMPurify = require('dompurify')

function compile(file, dependencies = {}, globals = {}) {
  const context = { exports: {}, TextDecoder, Uint8Array, URL, atob, DOMException, setTimeout, clearTimeout, ...globals,
    require: (name) => { if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`); return dependencies[name] } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, context)
  return context.exports
}
const cache = compile('lib/evidenceSessionCache.ts')
const evidence = compile('lib/inquiryEvidence.ts')
const format = compile('lib/evidenceDocumentFormat.ts')
const response = (text = 'original') => ({ success: true, data: { success: 'true', filename: 'source.pdf', mimetype: 'application/pdf', contentbase64: Buffer.from(`%PDF-1.7\n${text}`).toString('base64') } })
function fileService(run, cacheModule = cache) {
  return compile('services/inquiryEvidenceService.ts', {
    '../lib/evidenceSessionCache': cacheModule, '../lib/inquiryEvidence': evidence, '../lib/evidenceDocumentFormat': format,
    './sharePointSiteService': { getSharePointSiteUrl: async () => 'https://tenant.sharepoint.com/sites/Insurance' },
    '../generated/services/GetInquiryEvidenceDocumentService': { GetInquiryEvidenceDocumentService: { Run: run } },
  })
}

test('session cache expires absolutely, evicts least recently used data, and skips oversized entries', () => {
  let now = 0, disposed = 0
  const store = new cache.EvidenceSessionCache(2, 10, 100, () => now)
  store.set('a', 1, 4, () => disposed++)
  store.set('b', 2, 4)
  assert.equal(store.get('a'), 1)
  store.set('c', 3, 4)
  assert.equal(store.get('b'), undefined)
  assert.equal(store.set('huge', 10, 11), false)
  now = 99; assert.equal(store.get('a'), 1)
  now = 100; assert.equal(store.get('a'), undefined)
  assert.equal(disposed, 1)
  assert.equal(store.get('c'), undefined)
})

test('same inquiry and source share a single flow call and the same bytes across responses', async () => {
  let calls = 0, finish
  const gate = new Promise((resolve) => { finish = resolve })
  const service = fileService(async () => { calls++; await gate; return response() })
  const first = service.getInquiryEvidenceDocument('{ABC}', '/files/source.pdf', 'source.pdf')
  const second = service.getInquiryEvidenceDocument('abc', '/files/source.pdf', 'source.pdf')
  assert.equal(calls, 1)
  finish()
  const [a, b] = await Promise.all([first, second])
  assert.equal(a, b)
  assert.equal(await service.getInquiryEvidenceDocument('abc', '/files/source.pdf', 'source.pdf'), a)
  assert.equal(calls, 1)
  await service.getInquiryEvidenceDocument('different', '/files/source.pdf', 'source.pdf')
  await service.getInquiryEvidenceDocument('abc', '/other/source.pdf', 'source.pdf')
  assert.equal(calls, 3)
})

test('cached files still require current unambiguous links and valid SharePoint paths', async () => {
  let calls = 0
  const service = fileService(async () => { calls++; return response() })
  await service.getInquiryEvidenceDocument('abc', '/files/source.pdf', 'source.pdf')
  for (const links of ['', '/files/source.pdf,/other/source.pdf', '/files/%02source.pdf', 'https://other.example/files/source.pdf']) {
    await assert.rejects(service.getInquiryEvidenceDocument('abc', links, 'source.pdf'))
  }
  assert.equal(calls, 1)
})

test('refresh cannot be overwritten by an older flow request and produces a fresh byte identity', async () => {
  const finishes = []
  const service = fileService(() => new Promise((resolve) => finishes.push(resolve)))
  const old = service.getInquiryEvidenceDocument('abc', '/files/source.pdf', 'source.pdf')
  const fresh = service.getInquiryEvidenceDocument('abc', '/files/source.pdf', 'source.pdf', { refresh: true })
  finishes[1](response('new'))
  const current = await fresh
  finishes[0](response('old'))
  assert.notEqual((await old).bytes, current.bytes)
  assert.equal(await service.getInquiryEvidenceDocument('abc', '/files/source.pdf', 'source.pdf'), current)
})

test('failed flow requests are retryable and expired files are fetched again', async () => {
  let now = 0, calls = 0
  class ClockCache extends cache.EvidenceSessionCache { constructor(entries, bytes) { super(entries, bytes, 100, () => now) } }
  const service = fileService(async () => { calls++; if (calls === 1) throw new Error('Flow unavailable'); return response() }, { ...cache, EvidenceSessionCache: ClockCache })
  await assert.rejects(service.getInquiryEvidenceDocument('abc', '/files/source.pdf', 'source.pdf'), /Flow unavailable/)
  const first = await service.getInquiryEvidenceDocument('abc', '/files/source.pdf', 'source.pdf')
  assert.equal(calls, 2)
  now = 101
  assert.notEqual((await service.getInquiryEvidenceDocument('abc', '/files/source.pdf', 'source.pdf')).bytes, first.bytes)
  assert.equal(calls, 3)
})

test('PDF text extraction and engine are reused; eviction waits for active viewers', async () => {
  let opens = 0, extractions = 0, destroys = 0
  const service = compile('lib/pdfEvidenceDocument.ts', { './evidenceSessionCache': cache, 'pdfjs-dist': { getDocument: () => {
    opens++
    return { promise: Promise.resolve({ numPages: 2, getPage: async (number) => ({ getTextContent: async () => {
      extractions++
      return { items: [{ str: number === 1 ? 'Premium 1500' : 'Expiry 2027', transform: [1, 0, 0, 1, 10, 10], width: 120, height: 12 }], styles: {} }
    } }) }), destroy: async () => { destroys++ } }
  } } })
  const bytes = new Uint8Array([1])
  const [one, two] = await Promise.all([service.acquirePdfEvidence(bytes), service.acquirePdfEvidence(bytes)])
  assert.equal(opens, 1); assert.equal(extractions, 2)
  assert.equal(one.document, two.document)
  one.release(); one.release()
  assert.equal(destroys, 0)
  const three = await service.acquirePdfEvidence(bytes)
  assert.equal(opens, 1); assert.equal(extractions, 2)
  assert.equal(evidence.findPdfEvidenceMatches(three.contents[0].items, ['Premium 1500']).length, 1)
  assert.equal(evidence.findPdfEvidenceMatches(three.contents[0].items, ['Expiry 2027']).length, 0)
  cache.clearPreparedEvidence(bytes)
  assert.equal(destroys, 0)
  two.release(); assert.equal(destroys, 0)
  three.release(); assert.equal(destroys, 1)
  const next = await service.acquirePdfEvidence(bytes)
  assert.equal(opens, 2)
  next.release(); cache.clearPreparedEvidence(bytes)
})

test('PDF extraction failures clean up the engine and do not poison subsequent opens', async () => {
  let opens = 0, destroys = 0
  const service = compile('lib/pdfEvidenceDocument.ts', { './evidenceSessionCache': cache, 'pdfjs-dist': { getDocument: () => {
    const attempt = ++opens
    return { promise: Promise.resolve({ numPages: 1, getPage: async () => ({ getTextContent: async () => { if (attempt === 1) throw new Error('Read failed'); return { items: [], styles: {} } } }) }), destroy: async () => { destroys++ } }
  } } })
  const bytes = new Uint8Array([2])
  await assert.rejects(service.acquirePdfEvidence(bytes), /Read failed/)
  assert.equal(destroys, 1)
  const lease = await service.acquirePdfEvidence(bytes)
  assert.equal(opens, 2)
  lease.release(); cache.clearPreparedEvidence(bytes)
})

test('a real PDF reopens with cached text and can still render after the first viewer closes', async () => {
  const { jsPDF } = require('jspdf'), { createCanvas } = require('@napi-rs/canvas')
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  let opens = 0, cleanup
  const service = compile('lib/pdfEvidenceDocument.ts', { './evidenceSessionCache': cache, 'pdfjs-dist': { getDocument: (options) => {
    opens++
    const task = pdfjs.getDocument({ ...options, standardFontDataUrl: path.join(__dirname, '../node_modules/pdfjs-dist/standard_fonts').replace(/\\/g, '/') + '/' })
    return { promise: task.promise, destroy: () => { cleanup = task.destroy(); return cleanup } }
  } } })
  const pdf = new jsPDF(); pdf.text('Cached source evidence', 20, 30)
  const bytes = new Uint8Array(pdf.output('arraybuffer'))
  const one = await service.acquirePdfEvidence(bytes)
  one.release()
  const two = await service.acquirePdfEvidence(bytes)
  try {
    assert.equal(opens, 1)
    assert.equal(one.contents, two.contents)
    const page = await two.document.getPage(1), viewport = page.getViewport({ scale: 1 })
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
    await page.render({ canvas, viewport }).promise
    assert.ok(canvas.toBuffer('image/png').length > 1000)
  } finally { two.release(); cache.clearPreparedEvidence(bytes); await cleanup }
})

test('Word preview is rendered once but each response gets clean, independent highlights', async () => {
  const dom = new JSDOM('<div></div>')
  try {
    const helpers = compile('lib/docxEvidence.ts', { './inquiryEvidence': evidence, dompurify: createDOMPurify(dom.window) })
    let renders = 0
    const documents = compile('lib/docxEvidenceDocument.ts', { './evidenceSessionCache': cache, './docxEvidence': helpers, 'docx-preview': { renderAsync: async (_bytes, body, styles, options) => {
      renders++
      body.innerHTML = `<section class="${options.className}"><p>Premium 1500</p><p>Expiry 2027</p></section>`
      styles.innerHTML = `<style>.${options.className} { color:black }</style>`
    } } }, { document: dom.window.document })
    const bytes = new Uint8Array([3])
    const [one, two] = await Promise.all([documents.readDocxEvidence(bytes), documents.readDocxEvidence(bytes)])
    assert.equal(renders, 1)
    helpers.highlightDocxEvidence(one.body, ['Premium 1500'])
    assert.equal(two.body.querySelector('mark'), null)
    helpers.highlightDocxEvidence(two.body, ['Expiry 2027'])
    assert.equal(one.body.querySelector('mark').textContent, 'Premium 1500')
    assert.equal(two.body.querySelector('mark').textContent, 'Expiry 2027')
    const three = await documents.readDocxEvidence(bytes)
    assert.equal(renders, 1); assert.equal(three.body.querySelector('mark'), null)
  } finally { dom.window.close() }
})

test('Excel workbook parsing is reused while each response searches its own passage', () => {
  const xlsx = require('xlsx'), book = xlsx.utils.book_new()
  xlsx.utils.book_append_sheet(book, xlsx.utils.aoa_to_sheet([['Premium', 1500], ['Expiry', 2027]]), 'Source')
  const bytes = new Uint8Array(xlsx.write(book, { type: 'array', bookType: 'xlsx' }))
  let reads = 0
  const service = compile('lib/excelEvidence.ts', { './evidenceSessionCache': cache, './inquiryEvidence': evidence, xlsx: { ...xlsx, read: (...args) => { reads++; return xlsx.read(...args) } } })
  const one = service.readExcelEvidence(bytes), two = service.readExcelEvidence(bytes)
  assert.equal(reads, 1); assert.equal(one, two)
  assert.equal(service.findExcelEvidenceMatches(one, [{ exactText: 'Premium 1500' }]).matches[0].cells[0].address, 'A1')
  assert.equal(service.findExcelEvidenceMatches(two, [{ exactText: 'Expiry 2027' }]).matches[0].cells[0].address, 'A2')
  service.readExcelEvidence(bytes.slice()); assert.equal(reads, 2)
})

test('evidence dialog reopens from cache and Reload source explicitly calls the flow again', async () => {
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true, url: 'http://localhost/' })
  const saved = new Map()
  for (const name of ['window', 'document', 'Node', 'Element', 'HTMLElement', 'HTMLInputElement', 'DocumentFragment', 'CustomEvent', 'MutationObserver', 'NodeFilter', 'getComputedStyle', 'IS_REACT_ACT_ENVIRONMENT']) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, { value: name === 'IS_REACT_ACT_ENVIRONMENT' ? true : name === 'window' ? dom.window : dom.window[name], writable: true, configurable: true })
  }
  const React = require('react'), { act } = React, root = require('react-dom/client').createRoot(document.getElementById('root'))
  try {
    let calls = 0
    const service = fileService(async () => { calls++; return { success: true, data: { success: 'true', filename: 'source.ppt', mimetype: 'application/vnd.ms-powerpoint', contentbase64: Buffer.from('legacy powerpoint fixture').toString('base64') } } })
    const { InquiryEvidenceButton } = compile('components/inquiries/InquiryEvidence.tsx', {
      react: React, 'react/jsx-runtime': require('react/jsx-runtime'), '@radix-ui/react-dialog': require('@radix-ui/react-dialog'), 'lucide-react': require('lucide-react'),
      '../../lib/inquiryEvidence': evidence, '../../services/inquiryEvidenceService': service, '../../services/sharePointSiteService': {},
      '../ui/Button': { Button: ({ children, variant, size, ...props }) => React.createElement('button', props, children) },
      '../ui/Select': { Select: ({ value, options, onValueChange, contentClassName, ...props }) => React.createElement('select', { ...props, value, onChange: (event) => onValueChange(event.target.value) }, options.map((option) => React.createElement('option', { key: option.value, value: option.value }, option.value))) },
    })
    await act(async () => root.render(React.createElement(InquiryEvidenceButton, {
      inquiry: { id: 'cache-ui', documentsUrl: '/files/source.ppt' }, siteUrl: 'https://tenant.sharepoint.com/sites/Insurance',
      references: [{ sourceType: 'Document', documentName: 'source.ppt', exactText: 'Evidence' }],
    })))
    const open = () => document.querySelector('button[aria-label^="View document evidence"]')
    await act(async () => open().click())
    assert.equal(calls, 1)
    await act(async () => document.querySelector('button[aria-label="Close evidence workspace"]').click())
    await act(async () => open().click())
    assert.equal(calls, 1)
    const reload = document.querySelector('button[aria-label="Reload source document"]')
    assert.equal(reload.disabled, false)
    await act(async () => reload.click())
    assert.equal(calls, 2)
  } finally {
    await act(async () => root.unmount())
    for (const [name, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name] }
    dom.window.close()
  }
})
