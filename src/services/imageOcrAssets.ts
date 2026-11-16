import workerSource from 'tesseract.js/dist/worker.min.js?raw'
// This portable LSTM build embeds WASM. Preloading it in the same classic
// worker avoids importScripts/fetch for engine assets in the hosted app.
import coreSource from 'tesseract.js-core/tesseract-core-lstm.wasm.js?raw'
import englishModel from '@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz?url&inline'
import arabicModel from '@tesseract.js-data/ara/4.0.0_best_int/ara.traineddata.gz?url&inline'

export function createImageOcrAssets() {
  const models = [englishModel, arabicModel].map((model) => {
    if (!/^data:[^,]*;base64,/.test(model)) throw new Error('The OCR language model was not bundled correctly.')
    return model.slice(model.indexOf(',') + 1)
  })
  const languagePath = 'data:application/x-evidence-ocr-language,'
  const routes = { [`${languagePath}/eng.traineddata.gz`]: models[0], [`${languagePath}/ara.traineddata.gz`]: models[1] }
  // This adapter runs only inside our dedicated worker. It routes Tesseract's
  // normal language requests to in-memory responses. No network or Blob fetch
  // is needed, so OCR does not require a connect-src allowance.
  const localModels = `;(() => { const routes = ${JSON.stringify(routes)}; self.fetch = (input) => { const key = typeof input === 'string' ? input : input.url; const model = routes[key]; if (!model) return Promise.reject(new Error('Unexpected OCR asset request')); const binary = atob(model); const bytes = Uint8Array.from(binary, char => char.charCodeAt(0)); return Promise.resolve(new Response(bytes)); }; })();`
  const workerUrl = URL.createObjectURL(new Blob([coreSource, '\n;\n', localModels, '\n;\n', workerSource], { type: 'application/javascript' }))
  return { workerUrl, languagePath, languages: 'eng+ara', dispose: () => URL.revokeObjectURL(workerUrl) }
}
