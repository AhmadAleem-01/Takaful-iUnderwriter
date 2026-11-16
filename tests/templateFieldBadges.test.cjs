const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom')

const pathContext = { exports: {} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/templateFieldPaths.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, pathContext)
const context = { exports: {}, require(name) { if (name === './templateFieldPaths') return pathContext.exports; throw new Error(name) } }
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/templateFieldBadges.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context)
const { createTemplateFieldBadge, insertTemplateFieldBadgeAtRange, decorateTemplateFields, refreshTemplateFieldLabels, serializeTemplateEditorBody, templateFieldLabelMap, templateFieldLabel } = context.exports

function editor(html) {
  const element = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/xml').documentElement
  // xmldom supplies the DOM node operations. Add the browser HTML getter used
  // for serialization without altering the production implementation.
  if (!('innerHTML' in element)) Object.defineProperty(Object.getPrototypeOf(element), 'innerHTML', {
    configurable: true,
    get() { return Array.from(this.childNodes, (child) => new XMLSerializer().serializeToString(child)).join('') },
  })
  return element
}

const labels = new Map([
  ['aur_inquiry:aur_name', 'Inquiry Name'],
  ['contact:fullname', 'Full Name'],
])

test('existing tokens become non-editable badges showing field names', () => {
  const root = editor('<p>Hello {!contact:fullname;}, inquiry {!aur_inquiry:aur_name;}.</p>')
  decorateTemplateFields(root, labels)
  const spans = root.getElementsByTagName('span')
  assert.equal(spans.length, 2)
  assert.equal(spans[0].textContent, 'Full Name')
  assert.equal(spans[0].getAttribute('contenteditable'), 'false')
  assert.equal(spans[1].textContent, 'Inquiry Name')
  assert.equal(spans[1].getAttribute('data-template-token'), '{!aur_inquiry:aur_name;}')
  assert.equal(root.textContent, 'Hello Full Name, inquiry Inquiry Name.')
})

test('document fields including legacy dotted placeholders display names and retain identity', () => {
  const root = editor('<p>{{Quote.aur_total_premium}} {!aur_quote:aur_name;}</p>')
  decorateTemplateFields(root, new Map([['aur_quote:aur_total_premium', 'Total Premium'], ['aur_quote:aur_name', 'Name']]))
  assert.equal(root.getElementsByTagName('span')[0].textContent, 'Total Premium')
  assert.equal(root.getElementsByTagName('span')[1].textContent, 'Name')
  assert.equal(serializeTemplateEditorBody(root), '<p>{{Quote.aur_total_premium}} {!aur_quote:aur_name;}</p>')
})

test('related badges show the lookup path and preserve which related record supplies the value', () => {
  const token = '{!aur_quote:aur_quotes[aur_inquiry].aur_insured_company[account].emailaddress1;}'
  const root = editor(`<p>${token}</p>`)
  decorateTemplateFields(root, new Map([['aur_quote:aur_quotes', 'Inquiry'], ['aur_inquiry:aur_insured_company', 'Insured Company'], ['account:emailaddress1', 'Email']]))
  assert.equal(root.getElementsByTagName('span')[0].textContent, 'Inquiry › Insured Company › Email')
  assert.equal(serializeTemplateEditorBody(root), `<p>${token}</p>`)
})

// Exercise insertion against actual DOM nodes. xmldom has no browser selection
// API, so this adapter supplies only the text-range operations used by insertion.
function textRange(text, offset, end = offset) {
  return {
    startContainer: text, startOffset: offset,
    cloneRange() { return textRange(this.startContainer, this.startOffset, end) },
    deleteContents() { text.deleteData(offset, end - offset) },
    insertNode(node) {
      const following = text.splitText(offset)
      text.parentNode.insertBefore(node, following)
    },
    setStart(node, position) { this.startContainer = node; this.startOffset = position },
    collapse() {},
  }
}

test('adding a field after "text is" stays inside the same paragraph without a new line', () => {
  const root = editor('<p>text is</p>')
  const paragraph = root.firstChild
  const badge = createTemplateFieldBadge('{!aur_inquiry:aur_name;}', 'Name', root.ownerDocument)
  let selectedRange
  const caret = insertTemplateFieldBadgeAtRange(badge, textRange(paragraph.firstChild, 7), {
    removeAllRanges() {}, addRange(range) { selectedRange = range },
  })
  assert.equal(badge.parentNode, paragraph)
  assert.equal(root.getElementsByTagName('p').length, 1)
  assert.equal(root.getElementsByTagName('div').length, 0)
  assert.equal(root.getElementsByTagName('br').length, 0)
  assert.equal(serializeTemplateEditorBody(root), '<p>text is{!aur_inquiry:aur_name;}</p>')
  assert.equal(selectedRange, caret)
  assert.equal(caret.startContainer.previousSibling, badge)
  assert.equal(caret.startOffset, 0)
  caret.startContainer.appendData(' and more text')
  assert.equal(serializeTemplateEditorBody(root), '<p>text is{!aur_inquiry:aur_name;} and more text</p>')
})

test('inserting between words preserves the following text on the same line', () => {
  const root = editor('<p>Before after</p>')
  const badge = createTemplateFieldBadge('{!contact:fullname;}', 'Full Name', root.ownerDocument)
  insertTemplateFieldBadgeAtRange(badge, textRange(root.firstChild.firstChild, 7), {
    removeAllRanges() {}, addRange() {},
  })
  assert.equal(serializeTemplateEditorBody(root), '<p>Before {!contact:fullname;}after</p>')
})

test('replacing a selection and adding another badge keeps both fields inline', () => {
  const root = editor('<p>text is customer</p>')
  const first = createTemplateFieldBadge('{!contact:fullname;}', 'Full Name', root.ownerDocument)
  const caret = insertTemplateFieldBadgeAtRange(first, textRange(root.firstChild.firstChild, 8, 16), {
    removeAllRanges() {}, addRange() {},
  })
  const second = createTemplateFieldBadge('{!aur_inquiry:aur_name;}', 'Name', root.ownerDocument)
  insertTemplateFieldBadgeAtRange(second, caret, { removeAllRanges() {}, addRange() {} })
  assert.equal(serializeTemplateEditorBody(root), '<p>text is {!contact:fullname;}{!aur_inquiry:aur_name;}</p>')
  assert.equal(root.getElementsByTagName('p').length, 1)
  assert.equal(root.getElementsByTagName('br').length, 0)
})

test('saving and switching to HTML restores exact tokens without saving badge markup', () => {
  const original = '<p>Hello <strong>{!contact:fullname;}</strong>. {!aur_inquiry:aur_name;}</p>'
  const root = editor(original)
  decorateTemplateFields(root, labels)
  const saved = serializeTemplateEditorBody(root)
  assert.equal(saved, original)
  assert.equal(saved.includes('data-template-token'), false)
  assert.equal(saved.includes('template-field-badge'), false)
  assert.equal(saved.includes('Inquiry Name'), false)
  assert.equal(root.getElementsByTagName('span').length, 2, 'serialization must leave the live editor untouched')
})

test('repeated decoration and reopening do not duplicate badges or lose formatting', () => {
  const original = '<p><em>{!contact:fullname;}</em> {!aur_inquiry:aur_name;}</p>'
  const root = editor(original)
  decorateTemplateFields(root, labels)
  decorateTemplateFields(root, labels)
  assert.equal(root.getElementsByTagName('span').length, 2)
  const reopened = editor(serializeTemplateEditorBody(root))
  decorateTemplateFields(reopened, labels)
  assert.equal(reopened.getElementsByTagName('span').length, 2)
  assert.equal(serializeTemplateEditorBody(reopened), original)
})

test('display-name, date, and legacy placeholders retain their original values', () => {
  const original = '<p>{!aur_inquiry:aur_broker_company/@name;} {!aur_inquiry:createdon/@date;} {{customer_name}}</p>'
  const root = editor(original)
  decorateTemplateFields(root, labels)
  assert.equal(root.getElementsByTagName('span').length, 3)
  assert.equal(serializeTemplateEditorBody(root), original)
  assert.equal(templateFieldLabel('{!aur_inquiry:aur_name/@name;}', labels), 'Inquiry Name')
})

test('labels from loaded table metadata replace fallback labels without changing tokens', () => {
  const root = editor('<p>{!aur_inquiry:aur_name;}</p>')
  decorateTemplateFields(root, new Map())
  const badge = root.getElementsByTagName('span')[0]
  assert.equal(badge.textContent, 'Name')
  refreshTemplateFieldLabels(root, labels)
  assert.equal(root.getElementsByTagName('span')[0], badge)
  assert.equal(badge.textContent, 'Inquiry Name')
  assert.equal(serializeTemplateEditorBody(root), '<p>{!aur_inquiry:aur_name;}</p>')
})

test('only text is decorated; placeholders in URLs or styles remain intact', () => {
  const original = '<p><a href="https://example.com/{!contact:fullname;}">Open</a></p><style>.x{color:red}</style>'
  const root = editor(original)
  decorateTemplateFields(root, labels)
  assert.equal(root.getElementsByTagName('span').length, 0)
  assert.equal(serializeTemplateEditorBody(root), original)
})

test('field labels are inserted as text and cannot introduce HTML', () => {
  const root = editor('')
  const badge = createTemplateFieldBadge('{!contact:fullname;}', '<img src="x" />', root.ownerDocument)
  root.appendChild(badge)
  assert.equal(badge.textContent, '<img src="x" />')
  assert.equal(badge.getElementsByTagName('img').length, 0)
  assert.equal(serializeTemplateEditorBody(root), '{!contact:fullname;}')
})

test('table and field labels are indexed by their logical names', () => {
  const indexed = templateFieldLabelMap([{ name: 'aur_inquiry', fields: [{ name: 'aur_name', label: 'Name' }] }])
  assert.equal(indexed.get('aur_inquiry:aur_name'), 'Name')
})

test('the visual form submission sends tokens to Dataverse instead of badge labels or markup', async () => {
  const body = '<p>Hello {!contact:fullname;}, your inquiry is {!aur_inquiry:aur_name;}.</p>'
  const root = editor(body)
  decorateTemplateFields(root, labels)
  const page = ts.createSourceFile('EmailTemplatesPage.tsx', fs.readFileSync(
    path.join(__dirname, '../src/pages/admin/EmailTemplatesPage.tsx'), 'utf8',
  ), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let handler
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'handleSubmit') handler = node
    ts.forEachChild(node, visit)
  }
  visit(page)
  let payload
  let closed = false
  const submit = vm.runInNewContext(ts.transpileModule(`(${handler.getText(page)})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    editorMode: 'visual', editorRef: { current: root }, serializeTemplateEditorBody,
    draft: { templateName: 'Welcome', subject: 'Your inquiry', categoryKey: 'Global', body },
    saveEmailTemplate: async (record) => { payload = record },
    setSubmitBusy() {}, setSubmitError: (error) => { if (error) throw new Error(error) },
    setEditorOpen: (open) => { closed = !open }, setDraft() {}, setRefreshKey() {}, EMPTY_DRAFT: {},
  })
  await submit({ preventDefault() {} })
  assert.equal(payload.body, body)
  assert.equal(payload.subject, 'Your inquiry')
  assert.equal(closed, true)
  assert.equal(root.getElementsByTagName('span').length, 2)
})
