const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { JSDOM } = require('jsdom')
const { window } = new JSDOM('')
const pathContext = { exports: {} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/templateFieldPaths.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, pathContext)
const exportsObject = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/documentTemplate.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: exportsObject, DOMParser: window.DOMParser, require(name) { if (name === './templateFieldPaths') return pathContext.exports; throw new Error(name) } })
const { readDocumentTemplate, writeDocumentTemplate, documentTemplateFieldEntities, isQuotationDocumentTemplate } = exportsObject
const logoExports = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/documentTemplateLogo.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: logoExports, document: window.document })
const pageExports = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/documentPageSetup.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: pageExports, document: window.document, require: () => logoExports })

test('persists and reopens the selected entity even when the document has no fields', () => {
  const saved = writeDocumentTemplate('aur_quote', '<h1>Quotation</h1>')
  const loaded = readDocumentTemplate(saved)
  assert.equal(loaded.entity, 'aur_quote')
  assert.equal(loaded.body, '<h1>Quotation</h1>')
})

test('switching entities can detect existing fields from a different table', () => {
  assert.deepEqual([...documentTemplateFieldEntities('<p>{!aur_quote:aur_name;} {!aur_products:aur_name;} {!aur_quote:aur_total_premium;}</p>')], ['aur_quote', 'aur_products'])
})

test('related fields belong to the root template entity and survive reopening', () => {
  const token = '{!aur_quote:aur_product[aur_products].aur_heading;}'
  assert.deepEqual([...documentTemplateFieldEntities(token)], ['aur_quote'])
  const saved = writeDocumentTemplate('aur_quote', `<p>${token}</p>`)
  assert.equal(readDocumentTemplate(saved).body, `<p>${token}</p>`)
  assert.equal(isQuotationDocumentTemplate(saved), true)
})

test('quote template selection excludes other entities and supports older templates', () => {
  assert.equal(isQuotationDocumentTemplate(writeDocumentTemplate('aur_inquiry', '<p>Inquiry</p>')), false)
  assert.equal(isQuotationDocumentTemplate(writeDocumentTemplate('aur_quote', '<p>Quote</p>')), true)
  assert.equal(isQuotationDocumentTemplate('<p>{{Quote.aur_name}} {{Product.aur_name}}</p>'), true)
  assert.equal(isQuotationDocumentTemplate('<p>{!aur_products:aur_name;}</p>'), false)
  assert.equal(isQuotationDocumentTemplate('<p>Legacy static document</p>'), true)
})

test('does not silently default new blank templates to an entity', () => {
  assert.equal(readDocumentTemplate('<p><br></p>').entity, '')
  assert.throws(() => writeDocumentTemplate('', '<p>Content</p>'), /Select an entity/)
  assert.throws(() => writeDocumentTemplate('" onclick="alert(1)', '<p>Content</p>'), /Select an entity/)
})

function saveHandler(overrides = {}) {
  const page = ts.createSourceFile('DocumentTemplatesPage.tsx', fs.readFileSync(path.join(__dirname, '../src/pages/admin/DocumentTemplatesPage.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let handler
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'handleSaveTemplate') handler = node
    ts.forEachChild(node, visit)
  }
  visit(page)
  const body = window.document.createElement('div')
  body.innerHTML = '<p>Quotation total: {!aur_quote:aur_total_premium;}</p>'
  const result = { calls: [], errors: [], messages: [] }
  const globals = {
    DOMParser: window.DOMParser, editorRef: { current: body }, workspaceContent: '',
    selectedTable: { name: 'aur_quote' }, selectedEntity: 'aur_quote', selectedTemplateId: null,
    workspaceName: 'My Quotation', workspaceStatus: 1,
    logoBusy: false, pageSetup: pageExports.emptyPageSetup(), writeDocumentPageSetup: pageExports.writeDocumentPageSetup,
    serializeTemplateEditorBody: (element) => element.innerHTML,
    sanitizeQuotationHtml: (html) => html,
    writeDocumentTemplate, documentTemplateFieldEntities,
    setSaveError: (message) => result.errors.push(message), setSaveMessage: (message) => result.messages.push(message),
    setSaveBusy() {}, setRefreshKey() {}, setSelectedTemplateId() {},
    Aur_custom_document_templatesesService: { create: async (payload) => { result.calls.push(payload); return { success: true, data: { aur_custom_document_templatesid: 'saved-1' } } } },
    ...overrides,
  }
  result.save = vm.runInNewContext(ts.transpileModule(`(${handler.getText(page)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, globals)
  return result
}

test('the actual editor save stores the selected entity and reusable field identity', async () => {
  const result = saveHandler()
  await result.save()
  assert.equal(result.calls.length, 1)
  assert.equal(result.calls[0].aur_name, 'My Quotation')
  assert.equal(readDocumentTemplate(result.calls[0].aur_template_content).entity, 'aur_quote')
  assert.match(result.calls[0].aur_template_content, /\{!aur_quote:aur_total_premium;\}/)
  assert.equal(result.messages.at(-1), 'Document template saved successfully.')
})

test('the actual editor refuses to save before entity selection or after incompatible entity changes', async () => {
  const missing = saveHandler({ selectedTable: undefined, selectedEntity: '' })
  await missing.save()
  assert.equal(missing.calls.length, 0)
  assert.match(missing.errors.at(-1), /Select an entity/)
  const incompatible = saveHandler({ selectedTable: { name: 'aur_products' }, selectedEntity: 'aur_products' })
  await incompatible.save()
  assert.equal(incompatible.calls.length, 0)
  assert.match(incompatible.errors.at(-1), /another entity/)
})

test('the actual editor saves the logo alongside the selected entity and field tokens', async () => {
  const result = saveHandler({ pageSetup: { headerHtml: '<p>Letterhead</p>', footerHtml: '<p>Disclaimer</p>', background: { src: 'data:image/png;base64,aGVsbG8=', name: 'Logo.png', position: 'top-right', fit: 'fit', size: 30, opacity: 0.1, bleed: false } } })
  await result.save()
  const stored = readDocumentTemplate(result.calls[0].aur_template_content)
  assert.equal(stored.entity, 'aur_quote')
  const branded = pageExports.readDocumentPageSetup(stored.body)
  assert.equal(branded.setup.background.position, 'top-right')
  assert.equal(branded.setup.headerHtml, '<p>Letterhead</p>')
  assert.match(branded.body, /\{!aur_quote:aur_total_premium;\}/)
})

test('header/footer fields from another entity cannot bypass template entity validation', async () => {
  const result = saveHandler({ pageSetup: { ...pageExports.emptyPageSetup(), headerHtml: '<p>{!aur_products:aur_name;}</p>' } })
  await result.save()
  assert.equal(result.calls.length, 0)
  assert.match(result.errors.at(-1), /another entity/)
})

test('the actual editor prevents truncation when content and embedded images exceed Dataverse capacity', async () => {
  const result = saveHandler({ serializeTemplateEditorBody: () => '<p>' + 'x'.repeat(1048576) + '</p>' })
  await result.save()
  assert.equal(result.calls.length, 0)
  assert.match(result.errors.at(-1), /too large to save/)
})
