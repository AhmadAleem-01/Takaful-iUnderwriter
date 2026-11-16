const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { createCanvas, loadImage } = require('@napi-rs/canvas')
const { JSDOM } = require('jsdom')
function compile(file, dependencies = {}, globals = {}) {
  const context = { exports: {}, TextDecoder, Uint8Array, URL, Blob, atob, DOMException, AbortController, setTimeout, clearTimeout, document: globalThis.document, ...globals, require: (name) => {
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
const image = compile('lib/imageEvidence.ts', { './inquiryEvidence': evidence })
const word = (text, x, y, width = 100, confidence = 95) => ({ text, confidence, bbox: { x0: x, y0: y, x1: x + width, y1: y + 30 } })

function pngFixture() {
  const canvas = createCanvas(1600, 620), context = canvas.getContext('2d')
  context.fillStyle = 'white'; context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = 'black'; context.font = 'bold 56px Arial'
  context.fillText('PREMIUM PAYABLE USD 1500', 80, 130)
  context.font = '48px Arial'; context.fillText('DOCUMENT CHECKS PASSED', 80, 260)
  context.font = '56px Arial'; context.fillText('قسط التأمين', 80, 400)
  return canvas.toBuffer('image/png')
}
function assetsModule() {
  const dataUrl = (language) => `data:application/octet-stream;base64,${fs.readFileSync(require.resolve(`@tesseract.js-data/${language}/4.0.0_best_int/${language}.traineddata.gz`)).toString('base64')}`
  return compile('services/imageOcrAssets.ts', {
    'tesseract.js/dist/worker.min.js?raw': fs.readFileSync(require.resolve('tesseract.js/dist/worker.min.js'), 'utf8'),
    'tesseract.js-core/tesseract-core-lstm.wasm.js?raw': fs.readFileSync(require.resolve('tesseract.js-core/tesseract-core-lstm.wasm.js'), 'utf8'),
    '@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz?url&inline': dataUrl('eng'),
    '@tesseract.js-data/ara/4.0.0_best_int/ara.traineddata.gz?url&inline': dataUrl('ara'),
  })
}

test('detects supported raster images from bytes and leaves HTML and SVG unsupported', () => {
  const png = new Uint8Array(pngFixture())
  assert.equal(format.evidenceDocumentFormat(png, 'Evidence.png'), 'image')
  assert.equal(format.evidenceImageMimeType(png), 'image/png')
  for (const [bytes, expected] of [[[0xff, 0xd8, 0xff], 'image/jpeg'], [[0x42, 0x4d], 'image/bmp'], [Array.from(Buffer.from('GIF89a')), 'image/gif'], [Array.from(Buffer.from('RIFF0000WEBP')), 'image/webp']]) {
    assert.equal(format.evidenceImageMimeType(Uint8Array.from(bytes)), expected)
  }
  assert.equal(format.evidenceDocumentFormat(new TextEncoder().encode('<svg onload="alert(1)"></svg>'), 'Evidence.svg'), 'unsupported')
  assert.equal(format.evidenceDocumentFormat(new TextEncoder().encode('<html>Login</html>'), 'Evidence.png'), 'unsupported')
})

test('matches complete OCR passages and keeps distinct boxes for English and right-to-left Arabic words', () => {
  const words = [word('PREMIUM', 10, 10), word('PAYABLE', 130, 10), word('USD', 250, 10), word('1500', 370, 10),
    word('قسط', 500, 100), word('التأمين', 350, 100)]
  const matches = image.findImageEvidenceMatches(words, ['Premium payable USD 1500', 'قسط التأمين'], 300)
  assert.equal(matches.length, 2)
  assert.equal(matches[0].boxes.length, 4)
  assert.equal(matches[1].boxes.length, 2)
  assert.equal(matches[1].boxes[0].x0, 500)
  assert.equal(matches[0].confidence, 95)
  assert.equal(image.findImageEvidenceMatches(words, ['Premium payable USD 15000', 'قسط مختلف'], 300).length, 0)
})

test('does not accept partial words, partial percentages or missing negations', () => {
  const words = [word('reinsured', 10, 10), word('100%', 150, 10), word('Cover', 10, 80), word('not', 150, 80), word('included', 300, 80)]
  assert.equal(image.findImageEvidenceMatches(words, ['insured', '100', 'Cover included'], 200).length, 0)
  assert.equal(image.findImageEvidenceMatches(words, ['100%', 'Cover not included'], 200).length, 2)
})

test('validates OCR boxes, handles empty recognition and bounds large image dimensions', () => {
  const words = image.imageOcrWords([{ paragraphs: [{ lines: [{ words: [word('Visible', -10, -5), word('Outside', 1000, 1000), word('', 10, 10), { ...word('Invalid', 10, 10), bbox: { x0: NaN, y0: 0, x1: 10, y1: 10 } }] }] }] }], 400, 300)
  assert.equal(words.length, 1)
  assert.equal(words[0].bbox.x0, 0)
  assert.equal(words[0].bbox.y0, 0)
  assert.equal(image.imageOcrWords(null, 400, 300).length, 0)
  assert.equal(image.findImageEvidenceMatches([], ['Evidence'], 300).length, 0)
  const size = image.imagePreviewSize(12000, 8000)
  assert.ok(size.width <= 6000 && size.height <= 6000 && size.width * size.height <= 16010000)
  assert.throws(() => image.imagePreviewSize(0, 100), /invalid dimensions/)
})

test('prepares the same fixed raster for OCR and display using data URLs and a white background', async () => {
  const source = createCanvas(400, 160)
  source.getContext('2d').fillText('Evidence', 30, 60)
  class Reader {
    readAsDataURL(blob) { void blob.arrayBuffer().then((buffer) => { this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`; this.onload() }) }
    abort() {}
  }
  class Image {
    async decode() { this.decoded = await loadImage(Buffer.from(this.src.split(',')[1], 'base64')); this.naturalWidth = this.decoded.width; this.naturalHeight = this.decoded.height }
  }
  const document = { createElement: () => {
    const canvas = createCanvas(1, 1), ctx = canvas.getContext('2d')
    return {
      set width(value) { canvas.width = value }, set height(value) { canvas.height = value },
      getContext: () => ({ set fillStyle(value) { ctx.fillStyle = value }, fillRect: (...args) => ctx.fillRect(...args), drawImage: (image, ...args) => ctx.drawImage(image.decoded, ...args) }),
      toBlob: (callback) => callback(new Blob([canvas.toBuffer('image/png')], { type: 'image/png' })),
    }
  } }
  const api = service(async () => {}, undefined, { FileReader: Reader, Image, document })
  const bytes = new Uint8Array(source.toBuffer('image/png'))
  const result = await api.prepareEvidenceImage(bytes)
  assert.equal(await api.prepareEvidenceImage(bytes), result)
  assert.equal(result.width, 400); assert.equal(result.height, 160)
  assert.ok(result.dataUrl.startsWith('data:image/png;base64,'))
  assert.deepEqual(Buffer.from(result.dataUrl.split(',')[1], 'base64'), Buffer.from(result.bytes))
  const rendered = await loadImage(Buffer.from(result.bytes)), target = createCanvas(400, 160)
  target.getContext('2d').drawImage(rendered, 0, 0)
  assert.deepEqual(Array.from(target.getContext('2d').getImageData(0, 0, 1, 1).data), [255, 255, 255, 255])
})

test('retrieves image bytes through the existing file flow', async () => {
  const bytes = new Uint8Array(pngFixture())
  const api = compile('services/inquiryEvidenceService.ts', {
    '../lib/inquiryEvidence': evidence, '../lib/evidenceDocumentFormat': format, './sharePointSiteService': {},
    '../generated/services/GetInquiryEvidenceDocumentService': { GetInquiryEvidenceDocumentService: { Run: async () => ({ success: true, data: { success: 'true', filename: 'Evidence.png', mimetype: 'image/png', contentbase64: Buffer.from(bytes).toString('base64') } }) } },
  })
  const result = await api.getInquiryEvidenceDocument('inquiry', '/folder/Evidence.png', 'Evidence')
  assert.equal(result.format, 'image')
  assert.deepEqual(Buffer.from(result.bytes), Buffer.from(bytes))
})

function service(createWorker, createImageOcrAssets = () => ({ workerUrl: 'blob:worker', languagePath: 'blob:model#languages', languages: 'eng+ara', dispose() {} }), globals) {
  return compile('services/imageEvidenceService.ts', {
    'tesseract.js': { createWorker, OEM: { LSTM_ONLY: 1 }, PSM: { AUTO: '3' } },
    '../lib/imageEvidence': image, '../lib/evidenceDocumentFormat': format, './imageOcrAssets': { createImageOcrAssets },
  }, globals)
}
test('recognition requests bilingual word boxes and cleans up worker and asset URLs', async () => {
  let options, language, recognized, disposed = 0, terminated = 0
  const worker = { setParameters: async () => {}, recognize: async (...args) => { recognized = args; return { data: { text: 'Evidence', confidence: 93, blocks: [{ paragraphs: [{ lines: [{ words: [word('Evidence', 10, 10)] }] }] }] } } }, terminate: async () => { terminated++ } }
  const api = service(async (langs, _mode, configuration) => { language = langs; options = configuration; return worker }, () => ({ workerUrl: 'blob:worker', languagePath: 'blob:model#languages', languages: 'eng+ara', dispose: () => { disposed++ } }))
  const bytes = new Uint8Array(pngFixture())
  const result = await api.recognizeEvidenceImage(bytes, 1600, 620, () => {})
  assert.equal(language, 'eng+ara')
  assert.equal(options.workerBlobURL, false)
  assert.equal(options.cacheMethod, 'none')
  assert.equal(recognized[2].blocks, true)
  assert.ok(recognized[0] instanceof Blob)
  assert.deepEqual(Buffer.from(await recognized[0].arrayBuffer()), Buffer.from(bytes))
  assert.equal(result.words.length, 1)
  assert.equal(disposed, 1); assert.equal(terminated, 1)
})

test('reopening the same image reuses OCR words while Recognize again forces a new worker', async () => {
  let workers = 0, terminated = 0
  const api = service(async () => {
    workers++
    return { setParameters: async () => {}, recognize: async () => ({ data: { text: 'Evidence', confidence: 95, blocks: [{ paragraphs: [{ lines: [{ words: [word('Evidence', 10, 10)] }] }] }] } }), terminate: async () => { terminated++ } }
  })
  const bytes = new Uint8Array(pngFixture())
  const first = await api.recognizeEvidenceImage(bytes, 1600, 620, () => {})
  assert.equal(await api.recognizeEvidenceImage(bytes, 1600, 620, () => {}), first)
  assert.equal(workers, 1); assert.equal(terminated, 1)
  assert.notEqual(await api.recognizeEvidenceImage(bytes, 1600, 620, () => {}, undefined, { refresh: true }), first)
  assert.equal(workers, 2); assert.equal(terminated, 2)
})

test('cancellation settles an in-flight recognition and terminates its worker', async () => {
  let terminated = 0, started
  const ready = new Promise((resolve) => { started = resolve })
  const worker = { setParameters: async () => {}, recognize: () => { started(); return new Promise(() => {}) }, terminate: async () => { terminated++ } }
  const controller = new AbortController()
  const task = service(async () => worker).recognizeEvidenceImage(new Uint8Array(), 400, 300, () => {}, controller.signal)
  await ready; controller.abort()
  await assert.rejects(task, (error) => error.name === 'AbortError')
  assert.equal(terminated, 1)
})

test('cancellation during initialization cleans up the worker when initialization eventually completes', async () => {
  let finish, started, terminated = 0, disposed = 0
  const ready = new Promise((resolve) => { started = resolve })
  const creation = new Promise((resolve) => { finish = resolve })
  const worker = { terminate: async () => { terminated++ } }
  const controller = new AbortController()
  const task = service(() => { started(); return creation }, () => ({ workerUrl: 'blob:worker', languagePath: 'blob:model', languages: 'eng+ara', dispose() { disposed++ } })).recognizeEvidenceImage(new Uint8Array(), 400, 300, () => {}, controller.signal)
  await ready; controller.abort(); await assert.rejects(task, (error) => error.name === 'AbortError')
  finish(worker); await new Promise(setImmediate)
  assert.equal(terminated, 1); assert.equal(disposed, 1)
})

test('OCR errors and timeouts settle without waiting forever for terminated-worker messages', async () => {
  let timeout, started, terminated = 0
  const ready = new Promise((resolve) => { started = resolve })
  const worker = { setParameters: async () => {}, recognize: () => { started(); return new Promise(() => {}) }, terminate: async () => { terminated++ } }
  const api = service(async () => worker, undefined, { setTimeout: (callback) => { timeout = callback; return 1 }, clearTimeout: () => {} })
  const task = api.recognizeEvidenceImage(new Uint8Array(), 400, 300, () => {})
  await ready; timeout(); await assert.rejects(task, /took too long/)
  assert.equal(terminated, 1)
  await assert.rejects(service(async () => { throw new Error('Worker blocked by CSP') }).recognizeEvidenceImage(new Uint8Array(), 400, 300, () => {}), /browser security settings/)
})

test('the exact bundled browser worker recognizes English and Arabic without any asset fetches', { timeout: 90000 }, async () => {
  const assets = assetsModule().createImageOcrAssets()
  const pending = new Map(), requested = []
  let listener, count = 0
  const context = { console, TextEncoder, TextDecoder, URL, Blob, Response, atob, btoa, setTimeout, clearTimeout, performance,
    WorkerGlobalScope: class {}, location: { href: assets.workerUrl },
    addEventListener: (type, callback) => { if (type === 'message') listener = callback },
    postMessage: (message) => {
      const job = pending.get(message.jobId)
      if (!job || message.status === 'progress') return
      pending.delete(message.jobId); clearTimeout(job.timer)
      if (message.status === 'reject') job.reject(new Error(String(message.data))); else job.resolve(message.data)
    },
    importScripts: () => { throw new Error('Separate worker/core downloads must not occur') },
    fetch: (resource, options) => { const url = String(resource); requested.push(url); if (!url.startsWith('blob:')) throw new Error('Network downloads must not occur'); return fetch(resource, options) },
  }
  context.self = context
  const workerContext = vm.createContext(context, { codeGeneration: { strings: false, wasm: true } })
  vm.runInContext(await (await fetch(assets.workerUrl)).text(), workerContext, { timeout: 20000 })
  function job(action, payload) {
    return new Promise((resolve, reject) => {
      const jobId = `test-${++count}`
      const timer = setTimeout(() => { pending.delete(jobId); reject(new Error(`OCR ${action} timed out`)) }, 30000)
      pending.set(jobId, { resolve, reject, timer })
      listener({ data: { workerId: 'image-test', jobId, action, payload } })
    })
  }
  try {
    await job('load', { options: { lstmOnly: true } })
    await job('loadLanguage', { langs: 'eng+ara', options: { langPath: assets.languagePath, cacheMethod: 'none', gzip: true, lstmOnly: true } })
    await job('initialize', { langs: 'eng+ara', oem: 1, config: {} })
    await job('setParameters', { params: { tessedit_pageseg_mode: '3', user_defined_dpi: '300' } })
    const result = await job('recognize', { image: new Uint8Array(pngFixture()), options: { rotateAuto: false }, output: { text: true, blocks: true } })
    assert.match(result.text, /PREMIUM PAYABLE USD 1500/i)
    assert.match(result.text, /[\u0600-\u06ff]/)
    const words = image.imageOcrWords(result.blocks, 1600, 620)
    assert.ok(words.length >= 8)
    const matches = image.findImageEvidenceMatches(words, ['PREMIUM PAYABLE USD 1500', 'DOCUMENT CHECKS PASSED'], 620)
    assert.equal(matches.length, 2)
    assert.equal(image.findImageEvidenceMatches(words, ['قسط التأمين'], 620).length, 1)
    assert.ok(matches.every((match) => match.boxes.every((box) => box.x0 >= 0 && box.x1 <= 1600 && box.y0 >= 0 && box.y1 <= 620)))
    assert.equal(requested.length, 0)
    await job('terminate', {})
  } finally {
    for (const item of pending.values()) clearTimeout(item.timer)
    assets.dispose()
  }
})

test('image workspace renders aligned SVG boxes, navigates, zooms and retries recognition', async () => {
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true })
  const saved = new Map()
  for (const name of ['window', 'document', 'Node', 'Element', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT']) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, { value: name === 'IS_REACT_ACT_ENVIRONMENT' ? true : name === 'window' ? dom.window : dom.window[name], writable: true, configurable: true })
  }
  dom.window.HTMLElement.prototype.scrollTo = function ({ top, left }) { this.scrollTop = top; this.scrollLeft = left }
  const React = require('react'), { act } = React
  const rootElement = dom.window.document.getElementById('root'), root = require('react-dom/client').createRoot(rootElement)
  let recognitions = 0
  try {
    const dependencies = { react: React, 'react/jsx-runtime': require('react/jsx-runtime'), 'lucide-react': require('lucide-react'), '../ui/Button': { Button: ({ children, variant, size, ...props }) => React.createElement('button', props, children) } }
    const layout = compile('components/inquiries/EvidenceViewerLayout.tsx', dependencies)
    const { default: Viewer } = compile('components/inquiries/ImageEvidenceViewer.tsx', { ...dependencies, './EvidenceViewerLayout': layout, '../../lib/imageEvidence': image,
      '../../services/imageEvidenceService': { prepareEvidenceImage: async () => ({ width: 800, height: 400, dataUrl: `data:image/png;base64,${pngFixture().toString('base64')}`, bytes: new Uint8Array(pngFixture()) }), recognizeEvidenceImage: async () => { recognitions++; return { words: [word('Evidence', 10, 10), word('passed', 150, 10), word('Approved', 10, 100)], confidence: 95 } } },
    })
    await act(async () => { root.render(React.createElement(Viewer, { bytes: new Uint8Array(pngFixture()), passages: ['Evidence passed', 'Approved'] })) })
    for (let attempt = 0; attempt < 20 && rootElement.querySelector('[aria-busy="true"]'); attempt++) await act(async () => { await new Promise(setImmediate) })
    assert.equal(rootElement.querySelector('[aria-busy="true"]'), null)
    assert.ok(rootElement.querySelector('svg[viewBox="0 0 800 400"]'))
    assert.equal(rootElement.querySelectorAll('rect[data-image-match]').length, 3)
    assert.ok(rootElement.textContent.includes('English and Arabic'))
    const click = async (label) => { const button = rootElement.querySelector(`button[aria-label="${label}"]`); assert.ok(button, label); await act(async () => { button.click() }) }
    await click('Next evidence match')
    assert.ok(rootElement.textContent.includes('2 of 2'))
    assert.ok(rootElement.querySelector('rect[data-image-match="1"]').getAttribute('fill').includes('251'))
    await click('Zoom in'); assert.ok(rootElement.textContent.includes('110%'))
    assert.equal(rootElement.querySelector('rect[data-image-match="1"]').getAttribute('x'), '10')
    const retry = [...rootElement.querySelectorAll('button')].find((button) => button.textContent.includes('Recognize again'))
    await act(async () => { retry.click() })
    assert.equal(recognitions, 2)
  } finally {
    await act(async () => { root.unmount() })
    for (const [name, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name] }
    dom.window.close()
  }
})
