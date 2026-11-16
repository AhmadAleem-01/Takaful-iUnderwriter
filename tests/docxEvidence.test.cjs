const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { JSDOM } = require('jsdom')
const createDOMPurify = require('dompurify')
const JSZip = require('jszip')

function compile(file, dependencies = {}) {
  const context = { exports: {}, TextDecoder, Uint8Array, URL, atob, document: globalThis.document, require: (name) => {
    if (name.endsWith('/evidenceSessionCache')) return sessionCache;
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`)
    return dependencies[name]
  } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, context)
  return context.exports
}
const sessionCache = compile('lib/evidenceSessionCache.ts')
const evidence = compile('lib/inquiryEvidence.ts')
const format = compile('lib/evidenceDocumentFormat.ts')

function preview(html) {
  const dom = new JSDOM(`<div id="body">${html}</div><div id="styles"></div>`, { pretendToBeVisual: true })
  const helpers = compile('lib/docxEvidence.ts', { dompurify: createDOMPurify(dom.window), './inquiryEvidence': evidence })
  return { dom, helpers, body: dom.window.document.getElementById('body'), styles: dom.window.document.getElementById('styles') }
}

test('recognizes genuine DOCX containers by filename, MIME type or linked path', () => {
  const zip = Uint8Array.from([0x50, 0x4b, 0x03, 0x04])
  assert.equal(format.evidenceDocumentFormat(zip, 'evidence.DOCX', 'application/octet-stream'), 'docx')
  assert.equal(format.evidenceDocumentFormat(zip, 'evidence', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), 'docx')
  assert.equal(format.evidenceDocumentFormat(zip, 'evidence', '', '/files/evidence.docx'), 'docx')
  assert.equal(format.evidenceDocumentFormat(new Uint8Array(), 'evidence.doc', 'application/msword'), 'doc')
  assert.equal(format.evidenceDocumentFormat(zip, 'workbook.xlsx'), 'excel')
  assert.throws(() => format.evidenceDocumentFormat(new TextEncoder().encode('<html>Login page</html>'), 'evidence.docx'), /not a valid DOCX/)
})

test('matches across split Word formatting runs, paragraphs and table cells', () => {
  const { dom, helpers, body } = preview('<section data-evidence-page="1"><p>Current li<strong>cence</strong> status</p><p>Valid; no recorded suspension</p><table><tr><td>Premium payable</td><td>£1,500.50</td></tr></table></section>')
  try {
    const before = body.textContent
    const result = helpers.highlightDocxEvidence(body, ['Current licence status\nValid; no recorded suspension', 'Premium payable £1,500.50'])
    assert.equal(result.matches.length, 2)
    assert.equal(result.matches[0].page, 1)
    assert.equal(body.textContent, before)
    assert.ok(body.querySelector('strong mark'))
    assert.equal(body.querySelector('td:last-child mark').textContent, '£1,500.50')
    assert.equal(body.querySelectorAll('mark[data-evidence-matches~="0"]').length, 4)
  } finally { dom.window.close() }
})

test('keeps repeated passages on their own preview pages and activates only the selected match', () => {
  const { dom, helpers, body } = preview('<section data-evidence-page="1"><p>Document checks passed</p></section><section data-evidence-page="2"><p>Document checks passed</p><p>Other words</p></section>')
  try {
    const result = helpers.highlightDocxEvidence(body, ['Document checks passed'])
    assert.deepEqual(Array.from(result.matches, (match) => match.page), [1, 2])
    const selected = helpers.activateDocxEvidence(body, 1)
    assert.equal(selected.closest('[data-evidence-page]').dataset.evidencePage, '2')
    assert.ok(selected.style.backgroundColor.includes('251'))
    assert.ok(body.querySelector('[data-evidence-page="1"] mark').style.backgroundColor.includes('250'))
    assert.equal(body.querySelector('[data-evidence-page="2"] p:last-child').textContent, 'Other words')
  } finally { dom.window.close() }
})

test('handles overlapping passages without nesting or altering text', () => {
  const { dom, helpers, body } = preview('<p>Document checks passed successfully.</p>')
  try {
    const result = helpers.highlightDocxEvidence(body, ['Document checks passed', 'checks passed successfully'])
    assert.equal(result.matches.length, 2)
    assert.equal(body.querySelectorAll('mark mark').length, 0)
    assert.equal(body.textContent, 'Document checks passed successfully.')
    assert.ok(body.querySelector('mark[data-evidence-matches="0 1"]'))
  } finally { dom.window.close() }
})

test('ignores hidden text and styles, and does not accept changed facts or unrelated short values', () => {
  const { dom, helpers, body } = preview('<style>.foo { color: red }</style><p hidden>Hidden evidence</p><p style="display:none">Invisible evidence</p><p>Cover not included. Premium: $1,500.50</p><p>Taxes: applicable</p><p>Other field: None</p>')
  try {
    const result = helpers.highlightDocxEvidence(body, ['Hidden evidence', 'Invisible evidence', 'color: red', 'Cover included', 'Premium: $150050', 'Taxes: None'])
    assert.equal(result.matches.length, 0)
    assert.equal(result.hasText, true)
    assert.equal(body.querySelectorAll('mark').length, 0)
  } finally { dom.window.close() }
})

test('sanitizes active document content while preserving formatting and embedded assets', () => {
  const { dom, helpers, body, styles } = preview('<p style="font-weight:bold;background-image:url(https://other.example/tracker)">Valid evidence<script>alert(1)</script></p><a href="javascript:alert(1)">Unsafe link</a><iframe src="https://other.example"></iframe><img src="https://other.example/tracker.png"><img src="data:image/png;base64,AAAA"><a href="https://example.com">Source</a>')
  try {
    styles.innerHTML = '<style>.preview { font-family: Arial; background: url(https://other.example/a); } @font-face { src:url("data:font/woff;base64,AAAA"); }</style>'
    helpers.sanitizeDocxEvidence(body, styles)
    assert.equal(body.querySelectorAll('script,iframe').length, 0)
    assert.equal(body.querySelector('a').getAttribute('href'), null)
    assert.equal(body.querySelector('img').getAttribute('src'), null)
    assert.equal(body.querySelectorAll('img')[1].getAttribute('src'), 'data:image/png;base64,AAAA')
    assert.equal(body.querySelector('p').style.fontWeight, 'bold')
    assert.equal(body.querySelector('p').getAttribute('style').includes('other.example'), false)
    assert.equal(styles.textContent.includes('other.example'), false)
    assert.ok(styles.textContent.includes('data:font/woff'))
  } finally { dom.window.close() }
})

async function docxFixture() {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
  zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
  zip.file('word/document.xml', `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
    <w:p><w:r><w:t xml:space="preserve">Current li</w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>cence</w:t></w:r><w:r><w:t xml:space="preserve"> status</w:t></w:r></w:p>
    <w:p><w:r><w:t>Valid; no recorded suspension</w:t></w:r></w:p>
    <w:tbl><w:tblPr/><w:tblGrid><w:gridCol w:w="4000"/><w:gridCol w:w="4000"/></w:tblGrid><w:tr><w:tc><w:p><w:r><w:t>Premium payable</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>$1,500.50</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
    <w:p><w:r><w:br w:type="page"/></w:r></w:p><w:p><w:r><w:t>Document checks passed</w:t></w:r></w:p>
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body></w:document>`)
  return zip.generateAsync({ type: 'uint8array' })
}

test('renders an actual DOCX with the production renderer and highlights evidence on both pages', async () => {
  const { dom, helpers, body, styles } = preview('')
  const saved = new Map()
  for (const name of ['document', 'DOMParser', 'Node', 'Element', 'HTMLElement', 'XMLSerializer', 'FileReader']) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, { value: dom.window[name], writable: true, configurable: true })
  }
  try {
    const { renderAsync } = require('docx-preview')
    const bytes = await docxFixture()
    assert.equal(format.evidenceDocumentFormat(bytes, 'evidence.docx'), 'docx')
    await renderAsync(bytes, body, styles, { className: 'evidence-word-test', inWrapper: true, useBase64URL: true, breakPages: true, ignoreLastRenderedPageBreak: false, renderAltChunks: false, renderComments: false })
    helpers.sanitizeDocxEvidence(body, styles)
    const pages = [...body.querySelectorAll('section.evidence-word-test')]
    assert.equal(pages.length, 2)
    pages.forEach((page, index) => { page.dataset.evidencePage = String(index + 1) })
    const before = body.textContent
    const result = helpers.highlightDocxEvidence(body, ['Current licence status Valid; no recorded suspension', 'Premium payable $1,500.50', 'Document checks passed'])
    assert.deepEqual(Array.from(result.matches, (match) => match.page), [1, 1, 2])
    assert.equal(body.textContent, before)
    assert.ok(body.querySelector('section[data-evidence-page="2"] mark'))
    assert.equal(helpers.activateDocxEvidence(body, 2).textContent, 'Document checks passed')
  } finally {
    for (const [name, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name] }
    dom.window.close()
  }
})

test('retrieves DOCX bytes through the existing flow and routes them to the Word viewer', async () => {
  const bytes = await docxFixture()
  let input
  const api = compile('services/inquiryEvidenceService.ts', {
    '../lib/inquiryEvidence': evidence,
    '../lib/evidenceDocumentFormat': format,
    './sharePointSiteService': {},
    '../generated/services/GetInquiryEvidenceDocumentService': { GetInquiryEvidenceDocumentService: { Run: async (value) => {
      input = value
      return { success: true, data: { success: 'true', filename: 'Evidence.docx', mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', contentbase64: Buffer.from(bytes).toString('base64') } }
    } } },
  })
  const file = await api.getInquiryEvidenceDocument('{inquiry-id}', '/aur_inquiry/Example/Evidence.docx', 'Evidence')
  assert.equal(input.text, 'inquiry-id')
  assert.equal(input.text_1, '/aur_inquiry/Example/Evidence.docx')
  assert.equal(file.format, 'docx')
  assert.equal(file.isPdf, false)
  assert.deepEqual(Buffer.from(file.bytes), Buffer.from(bytes))
})

test('Word workspace navigates matches and pages, zooms, and collapses its sidebar', async () => {
  const { dom, helpers } = preview('')
  const saved = new Map()
  for (const name of ['window', 'document', 'DOMParser', 'Node', 'Element', 'HTMLElement', 'XMLSerializer', 'FileReader', 'IS_REACT_ACT_ENVIRONMENT']) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, { value: name === 'IS_REACT_ACT_ENVIRONMENT' ? true : name === 'window' ? dom.window : dom.window[name], writable: true, configurable: true })
  }
  dom.window.HTMLElement.prototype.scrollTo = function ({ top, left }) { this.scrollTop = top; this.scrollLeft = left }
  const React = require('react')
  const { act } = React
  const { createRoot } = require('react-dom/client')
  const rootElement = dom.window.document.createElement('div')
  dom.window.document.body.append(rootElement)
  const root = createRoot(rootElement)
  try {
    const dependencies = {
      react: React, 'react/jsx-runtime': require('react/jsx-runtime'), 'lucide-react': require('lucide-react'),
      '../ui/Button': { Button: ({ children, variant, size, ...props }) => React.createElement('button', props, children) },
    }
    const layout = compile('components/inquiries/EvidenceViewerLayout.tsx', dependencies)
    const documents = compile('lib/docxEvidenceDocument.ts', { 'docx-preview': require('docx-preview'), './docxEvidence': helpers })
    const { default: Viewer } = compile('components/inquiries/DocxEvidenceViewer.tsx', {
      ...dependencies, '../../lib/docxEvidenceDocument': documents, '../../lib/docxEvidence': helpers, './EvidenceViewerLayout': layout,
    })
    const bytes = await docxFixture()
    await act(async () => { root.render(React.createElement(Viewer, { bytes, passages: ['Current licence status Valid; no recorded suspension', 'Document checks passed'] })) })
    for (let attempt = 0; attempt < 20 && rootElement.querySelector('[aria-busy="true"]'); attempt++) await act(async () => { await new Promise(setImmediate) })
    assert.equal(rootElement.querySelector('[aria-busy="true"]'), null)
    assert.ok(rootElement.textContent.includes('2 text matches found'))
    const click = async (label) => {
      const button = rootElement.querySelector(`button[aria-label="${label}"]`)
      assert.ok(button, label)
      assert.equal(button.disabled, false, label)
      await act(async () => { button.click() })
    }
    await click('Next evidence match')
    assert.ok(rootElement.textContent.includes('2 of 2'))
    assert.ok(rootElement.textContent.includes('2 / 2'))
    assert.ok(rootElement.querySelector('[data-evidence-page="2"] mark').style.backgroundColor.includes('251'))
    await click('Previous document page')
    assert.ok(rootElement.textContent.includes('1 / 2'))
    await click('Zoom in')
    assert.ok(rootElement.textContent.includes('125%'))
    await click('Hide evidence sidebar')
    assert.equal(rootElement.querySelector('aside'), null)
    await click('Show evidence sidebar')
    assert.ok(rootElement.querySelector('aside'))
  } finally {
    await act(async () => { root.unmount() })
    for (const [name, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name] }
    dom.window.close()
  }
})
