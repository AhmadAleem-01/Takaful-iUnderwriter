const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

// Exercise the actual JSX handler with React's deferred updater timing.
function loadBodyInputHandler(setDraft) {
  const file = ts.createSourceFile(
    'EmailTemplatesPage.tsx',
    fs.readFileSync(path.join(__dirname, '../src/pages/admin/EmailTemplatesPage.tsx'), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  let handler
  function visit(node) {
    if (ts.isJsxAttribute(node) && node.name.getText(file) === 'onInput') {
      handler = node.initializer.expression
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  assert.ok(handler, 'Email body input handler must exist')
  const code = ts.transpileModule(`(${handler.getText(file)})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText
  return vm.runInNewContext(code, { setDraft, serializeTemplateEditorBody: (element) => element.innerHTML })
}

test('body input survives event cleanup and updater replay without losing other draft fields', () => {
  let update
  const onInput = loadBodyInputHandler((updater) => { update = updater })
  const body = '<p>Hello <strong>{{customer_name}}</strong></p>'
  const event = { currentTarget: { innerHTML: body } }
  onInput(event)
  event.currentTarget = null

  const draft = { templateName: 'Welcome', subject: 'Hello', categoryKey: 'Quote', body: 'Old' }
  for (let replay = 0; replay < 2; replay += 1) {
    assert.deepEqual({ ...update(draft) }, { ...draft, body })
  }
})

test('clearing the visual body preserves the empty value after event cleanup', () => {
  let update
  const onInput = loadBodyInputHandler((updater) => { update = updater })
  const event = { currentTarget: { innerHTML: '' } }
  onInput(event)
  event.currentTarget = null
  assert.equal(update({ body: 'Previous content' }).body, '')
})

function loadPageFunction(name, globals) {
  const file = ts.createSourceFile('EmailTemplatesPage.tsx', fs.readFileSync(
    path.join(__dirname, '../src/pages/admin/EmailTemplatesPage.tsx'), 'utf8',
  ), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let handler
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) handler = node
    ts.forEachChild(node, visit)
  }
  visit(file)
  assert.ok(handler, `${name} must exist`)
  return vm.runInNewContext(ts.transpileModule(`(${handler.getText(file)})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, globals)
}

function tokenHelpers() {
  const context = { exports: {} }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/emailTemplateFields.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context)
  return context.exports
}

test('sidebar inserts into the saved subject selection and restores the subject cursor', () => {
  let draft = { subject: 'Hello customer!', body: '<p>Body unchanged</p>' }
  let cursor
  let focused = false
  const frames = []
  const insert = loadPageFunction('insertPlaceholder', {
    ...tokenHelpers(), draft, insertionTarget: 'subject', editorMode: 'visual',
    subjectSelectionRef: { current: { start: 6, end: 14 } },
    subjectRef: { current: { focus: () => { focused = true }, setSelectionRange: (start, end) => { cursor = [start, end] } } },
    setDraft: (update) => { draft = update(draft) }, requestAnimationFrame: (callback) => frames.push(callback),
  })
  const token = '{!contact:firstname;}'
  insert(token)
  frames.forEach((frame) => frame())
  assert.equal(draft.subject, `Hello ${token}!`)
  assert.equal(draft.body, '<p>Body unchanged</p>')
  assert.equal(focused, true)
  assert.deepEqual(cursor, [6 + token.length, 6 + token.length])
})

test('sidebar inserts inside HTML at the remembered caret rather than appending after the document', () => {
  let draft = { subject: 'Subject unchanged', body: '<p>Hello </p>' }
  const frames = []
  let focused = false
  const insert = loadPageFunction('insertPlaceholder', {
    ...tokenHelpers(), draft, insertionTarget: 'body', editorMode: 'html',
    htmlSelectionRef: { current: { start: 9, end: 9 } },
    htmlRef: { current: { focus: () => { focused = true }, setSelectionRange() {} } },
    setDraft: (update) => { draft = update(draft) }, requestAnimationFrame: (callback) => frames.push(callback),
  })
  insert('{!contact:firstname;}')
  frames.forEach((frame) => frame())
  assert.equal(draft.body, '<p>Hello {!contact:firstname;}</p>')
  assert.equal(draft.subject, 'Subject unchanged')
  assert.equal(focused, true)
})

test('visual insertion restores the saved editor range even after the sidebar takes focus', () => {
  const node = {}
  const restored = {}
  let focused = false
  let range
  const restore = loadPageFunction('restoreVisualSelection', {
    editorRef: { current: { focus: () => { focused = true }, contains: (value) => value === node } },
    visualSelectionRef: { current: { commonAncestorContainer: node, cloneRange: () => restored } },
    window: { getSelection: () => ({ removeAllRanges() {}, addRange: (value) => { range = value } }) },
    document: { createRange: () => { throw new Error('Must restore saved range') } },
  })
  restore()
  assert.equal(focused, true)
  assert.equal(range, restored)
})

test('visual field insertion uses the restored range and saves the cursor directly after the badge', () => {
  let draft = { subject: 'Unchanged', body: '<p>text is</p>' }
  let restored = false
  let inserted = false
  const range = {}
  const savedCaret = {}
  const cursorRef = { current: null }
  const editor = {}
  const insert = loadPageFunction('insertPlaceholder', {
    draft, insertionTarget: 'body', editorMode: 'visual', document: {},
    editorRef: { current: editor }, visualSelectionRef: cursorRef,
    createTemplateFieldBadge: (token, label) => ({ token, label }),
    restoreVisualSelection: () => { restored = true },
    window: { getSelection: () => ({ rangeCount: 1, getRangeAt: () => range }) },
    insertTemplateFieldBadgeAtRange: (badge, insertionRange) => {
      assert.equal(restored, true)
      assert.equal(insertionRange, range)
      assert.equal(badge.label, 'Name')
      inserted = true
      return { cloneRange: () => savedCaret }
    },
    serializeTemplateEditorBody: () => '<p>text is{!aur_inquiry:aur_name;}</p>',
    setDraft: (update) => { draft = update(draft) },
  })
  insert('{!aur_inquiry:aur_name;}', 'Name')
  assert.equal(inserted, true)
  assert.equal(cursorRef.current, savedCaret)
  assert.equal(draft.body, '<p>text is{!aur_inquiry:aur_name;}</p>')
  assert.equal(draft.subject, 'Unchanged')
})
