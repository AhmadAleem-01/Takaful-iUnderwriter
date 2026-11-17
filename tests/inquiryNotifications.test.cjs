const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { JSDOM } = require('jsdom')

function load(react = React, window = {}) {
  const context = { exports: {}, window, require: (name) => name === 'react' ? react : require(name) }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/components/ui/NotificationToast.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, context)
  return context.exports
}

test('all notification variants have appropriate semantics, typography, and countdown', () => {
  const { NotificationToast } = load()
  for (const variant of ['success', 'error', 'warning', 'info']) {
    const html = renderToStaticMarkup(React.createElement(NotificationToast, {
      notification: { id: 1, variant, title: 'Notification title', message: 'Notification message' }, onDismiss() {},
    }))
    const document = new JSDOM(html).window.document
    assert.ok(document.querySelector(`[role="${['warning', 'error'].includes(variant) ? 'alert' : 'status'}"]`))
    assert.equal(document.querySelector('.notification-countdown').style.animationDuration, '5000ms')
    assert.ok(document.querySelector('[aria-label="Dismiss notification"]'))
    assert.match(document.body.textContent, /Notification titleNotification message/)
  }
})

test('notifications dismiss after five seconds, can close manually, and clean up their timer', () => {
  let cleanup, callback, milliseconds, cleared, dismissed
  const { NotificationToast } = load({ ...React, useEffect: (effect) => { cleanup = effect() } }, {
    setTimeout: (fn, delay) => { callback = fn; milliseconds = delay; return 42 },
    clearTimeout: (timer) => { cleared = timer },
  })
  const element = NotificationToast({ notification: { id: 7, variant: 'success', title: 'Saved', message: 'Done' }, onDismiss: (id) => { dismissed = id } })
  assert.equal(milliseconds, 5000)
  callback()
  assert.equal(dismissed, 7)
  dismissed = null
  element.props.children[0].props.children[2].props.onClick()
  assert.equal(dismissed, 7)
  cleanup()
  assert.equal(cleared, 42)
})
