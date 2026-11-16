const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { JSDOM } = require('jsdom')

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/', pretendToBeVisual: true })
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'DocumentFragment', 'Element', 'Node', 'CustomEvent', 'Event', 'MutationObserver', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  global[key] = key === 'getComputedStyle' ? dom.window.getComputedStyle.bind(dom.window) : dom.window[key]
}
dom.window.HTMLElement.prototype.scrollIntoView = function () {}
global.IS_REACT_ACT_ENVIRONMENT = true
const React = require('react')
const { createRoot } = require('react-dom/client')
const { MemoryRouter } = require('react-router-dom')
const fixture = (id, name, lineOfBusinessId, overrides = {}) => ({
  id, name, lineOfBusinessId, shortDetails: `${name} description`, status: 'Draft',
  inquiryVolume: 0, premiumTotal: 0, insuredTotal: 0, ...overrides,
})
const records = [
  fixture('aviation', 'Aviation', undefined, { inquiryVolume: 1 }),
  fixture('hull', 'Hull & Liability', 'aviation', { inquiryVolume: 3, premiumTotal: 100 }),
  fixture('liability', 'Liability', 'aviation', { status: 'Publish', inquiryVolume: 2, insuredTotal: 500 }),
  fixture('health', 'Health'),
  fixture('orphan', 'Unlinked product', 'missing-parent'),
]
const cache = new Map()
function load(file) {
  if (cache.has(file)) return cache.get(file)
  const exports = {}
  cache.set(file, exports)
  const context = {
    exports, console, window, document,
    require(name) {
      if (name.endsWith('/useAsyncData')) return { useAsyncData: () => ({ data: records, loading: false, error: null }) }
      if (name.endsWith('/productsService')) return { getProductsSummary: async () => records }
      if (name.endsWith('/Aur_productsesService')) return { Aur_productsesService: {} }
      if (!name.startsWith('.')) return require(name)
      const base = path.resolve(path.dirname(file), name)
      const dependency = ['.tsx', '.ts', '.js'].map((extension) => base + extension).find((candidate) => fs.existsSync(candidate))
      return dependency ? load(dependency) : require(base)
    },
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, context)
  return exports
}
const { ProductsPage } = load(path.resolve(__dirname, '../src/pages/products/ProductsPage.tsx'))

test('product browser selects businesses, searches products, switches views, and exposes unavailable parents', async () => {
  const container = document.getElementById('root')
  const root = createRoot(container)
  await React.act(async () => root.render(React.createElement(MemoryRouter, null, React.createElement(ProductsPage))))
  const articles = () => [...container.querySelectorAll('article')]
  const click = async (element) => React.act(async () => element.click())
  const input = async (label, text) => React.act(async () => {
    const element = container.querySelector(`input[aria-label="${label}"]`)
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(element, text)
    element.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
  const business = (name) => [...container.querySelectorAll('nav button')].find((element) => element.textContent.includes(name))
  try {
    assert.equal(articles().length, 2)
    assert.match(articles()[0].textContent, /Hull & Liability/)
    assert.equal(container.querySelector('a[href="/admin/products/aviation/edit"]').textContent, 'Edit Line of Business')
    assert.match(container.textContent, /Showing 2 of 2 products/)
    const overviewValue = (label) => [...container.querySelectorAll('p')].find((element) => element.textContent === label).nextElementSibling.textContent
    assert.equal(overviewValue('Inquiry Volume'), '6')
    assert.match(overviewValue('Premium Total'), /100/)
    assert.match(overviewValue('Insured Total'), /500/)
    await click(container.querySelector('[aria-label="Sort products"]'))
    await click([...document.querySelectorAll('[role="option"]')].find((element) => element.textContent === 'Name (Z-A)'))
    assert.match(articles()[0].textContent, /^Liability/)
    await click(container.querySelector('[aria-label="Filter products by status"]'))
    await click([...document.querySelectorAll('[role="option"]')].find((element) => element.textContent === 'Status: Draft'))
    assert.equal(articles().length, 1)
    assert.equal(overviewValue('Inquiry Volume'), '6')
    await input('Search products', 'Hull')
    assert.equal(articles().length, 1)
    await input('Search products', 'no match')
    assert.match(container.textContent, /No matching products/)
    await click([...container.querySelectorAll('button')].find((element) => element.textContent === 'Clear filters'))
    assert.equal(articles().length, 2)
    await click(container.querySelector('button[aria-label="Grid view"]'))
    assert.equal(container.querySelector('button[aria-label="Grid view"]').getAttribute('aria-pressed'), 'true')
    await click(business('Health'))
    assert.equal(articles().length, 0)
    assert.match(container.textContent, /Products linked to Health will appear here/)
    await click(business('Unassigned products'))
    assert.match(articles()[0].textContent, /Unlinked product/)
    assert.equal(container.querySelector('a[href="/admin/products/missing-parent/edit"]'), null)
    await input('Search lines of business', 'Aviation')
    assert.equal(container.querySelectorAll('nav button').length, 1)
    assert.equal(articles().length, 2)
  } finally {
    await React.act(async () => root.unmount())
    dom.window.close()
  }
})
