import { createWorker, OEM, PSM } from 'tesseract.js'
import { imageOcrWords, imagePreviewSize } from '../lib/imageEvidence'
import { evidenceImageMimeType } from '../lib/evidenceDocumentFormat'
import { clearPreparedEvidence, getPreparedEvidence, setPreparedEvidence } from '../lib/evidenceSessionCache'
import type { ImageEvidenceWord } from '../lib/imageEvidence'

interface PreparedImage { width: number; height: number; dataUrl: string; bytes: Uint8Array }
interface RecognizedImage { words: ImageEvidenceWord[]; confidence: number; text: string }

function aborted() { return new DOMException('Image recognition was cancelled.', 'AbortError') }

function imageDataUrl(blob: Blob, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    const cleanup = () => signal?.removeEventListener('abort', cancel)
    const cancel = () => { reader.abort(); cleanup(); reject(aborted()) }
    reader.onload = () => { cleanup(); resolve(String(reader.result)) }
    reader.onerror = () => { cleanup(); reject(new Error('Unable to read the image.')) }
    if (signal?.aborted) { reject(aborted()); return }
    signal?.addEventListener('abort', cancel, { once: true })
    reader.readAsDataURL(blob)
  })
}

/** Normalize browser orientation and capture a fixed raster for both OCR and display. */
export async function prepareEvidenceImage(bytes: Uint8Array, signal?: AbortSignal): Promise<PreparedImage> {
  if (signal?.aborted) throw aborted()
  const cached = getPreparedEvidence<PreparedImage>(bytes, 'image-preview')
  if (cached) return cached
  const type = evidenceImageMimeType(bytes)
  if (!type) throw new Error('This image format is not supported. Use PNG, JPEG, WebP, BMP, or GIF.')
  const sourceUrl = await imageDataUrl(new Blob([bytes.slice().buffer], { type }), signal)
  if (signal?.aborted) throw aborted()
  const image = new Image()
  image.src = sourceUrl
  try { await image.decode() } catch { throw new Error('Unable to decode this image. Use Open original to check the file.') }
  if (signal?.aborted) throw aborted()
  const size = imagePreviewSize(image.naturalWidth, image.naturalHeight)
  const canvas = document.createElement('canvas')
  canvas.width = size.width; canvas.height = size.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Image preview is unavailable in this browser.')
  // Flatten transparent backgrounds to white so recognition sees the same raster.
  context.fillStyle = '#fff'; context.fillRect(0, 0, size.width, size.height)
  context.drawImage(image, 0, 0, size.width, size.height)
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Unable to prepare the image preview.')), 'image/png'))
  if (signal?.aborted) throw aborted()
  const result = { ...size, dataUrl: await imageDataUrl(blob, signal), bytes: new Uint8Array(await blob.arrayBuffer()) }
  if (signal?.aborted) throw aborted()
  setPreparedEvidence(bytes, 'image-preview', result, result.dataUrl.length * 2 + result.bytes.byteLength)
  return result
}

export async function recognizeEvidenceImage(bytes: Uint8Array, width: number, height: number, onProgress: (label: string) => void, signal?: AbortSignal, options: { refresh?: boolean } = {}): Promise<RecognizedImage> {
  if (signal?.aborted) throw aborted()
  const kind = `image-ocr-eng-ara:${width}:${height}`
  if (options.refresh) clearPreparedEvidence(bytes)
  const cached = getPreparedEvidence<RecognizedImage>(bytes, kind)
  if (cached) return cached
  onProgress('Preparing text recognition…')
  const { createImageOcrAssets } = await import('./imageOcrAssets')
  if (signal?.aborted) throw aborted()
  const assets = createImageOcrAssets()
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined
  let stopped = false
  let timedOut = false
  let rejectStop: (reason: Error) => void = () => {}
  const interruption = new Promise<never>((_, reject) => { rejectStop = reject })
  const stop = (reason: Error) => { stopped = true; rejectStop(reason) }
  const onAbort = () => stop(aborted())
  signal?.addEventListener('abort', onAbort, { once: true })
  const timeout = setTimeout(() => { timedOut = true; stop(new Error('Image recognition took too long. Try a smaller or clearer image.')) }, 120000)
  try {
    // The models are bundled in-memory; cacheMethod:none avoids IndexedDB writes.
    const creation = createWorker(assets.languages, OEM.LSTM_ONLY, {
      workerPath: assets.workerUrl, langPath: assets.languagePath, workerBlobURL: false, cacheMethod: 'none',
      errorHandler: (reason: unknown) => stop(reason instanceof Error ? reason : new Error(String(reason))),
      logger: (message) => {
        if (!stopped && message.status === 'recognizing text') onProgress(`Reading image… ${Math.round(Math.max(0, Math.min(1, message.progress)) * 100)}%`)
      },
    })
    // createWorker exposes the worker only after initialization. If cancellation
    // wins that race, terminate the worker as soon as initialization completes.
    void creation.then((created) => { if (stopped) void created.terminate().catch(() => {}) }, () => {})
    worker = await Promise.race([creation, interruption])
    if (stopped || signal?.aborted) throw aborted()
    await Promise.race([worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, user_defined_dpi: '300' }), interruption])
    const image = new Blob([bytes.slice().buffer], { type: 'image/png' })
    const result = await Promise.race([worker.recognize(image, { rotateAuto: false }, { text: true, blocks: true }), interruption])
    if (stopped || signal?.aborted) throw aborted()
    const recognized = { words: imageOcrWords(result.data.blocks, width, height), confidence: result.data.confidence, text: result.data.text ?? '' }
    setPreparedEvidence(bytes, kind, recognized, recognized.text.length * 2 + recognized.words.reduce((sum, word) => sum + word.text.length * 2 + 96, 0))
    return recognized
  } catch (reason) {
    if (signal?.aborted) throw aborted()
    const detail = reason instanceof Error ? reason.message : String(reason)
    if (/content security policy|\bCSP\b|security policy|unsafe-eval/i.test(detail)) throw new Error("Text recognition is blocked by this app's browser security settings. Use Open original or contact your administrator.")
    throw new Error(timedOut ? 'Image recognition took too long. Try a smaller or clearer image.' : `Text recognition could not run in this browser. ${detail}`)
  } finally {
    clearTimeout(timeout); signal?.removeEventListener('abort', onAbort)
    if (worker) await worker.terminate().catch(() => {})
    assets.dispose()
  }
}
