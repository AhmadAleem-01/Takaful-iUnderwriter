import { renderAsync } from 'docx-preview'
import { sanitizeDocxEvidence } from './docxEvidence'
import { getPreparedEvidence, setPreparedEvidence } from './evidenceSessionCache'

interface WordPreview { className: string; body: string; styles: string }
const pending = new WeakMap<Uint8Array, Promise<WordPreview>>()
let nextPreview = 0

export async function readDocxEvidence(bytes: Uint8Array) {
  let template = getPreparedEvidence<WordPreview>(bytes, 'docx')
  if (!template) {
    let request = pending.get(bytes)
    if (!request) {
      request = (async () => {
        const className = `evidence-word-cached-${++nextPreview}`
        const body = document.createElement('div'), styles = document.createElement('div')
        await renderAsync(bytes.slice(), body, styles, {
          className, inWrapper: true, useBase64URL: true, breakPages: true,
          ignoreLastRenderedPageBreak: false, renderAltChunks: false, renderComments: false,
        })
        sanitizeDocxEvidence(body, styles)
        const result = { className, body: body.innerHTML, styles: styles.innerHTML }
        if (!body.querySelector(`section.${className}`)) throw new Error('This file does not contain a viewable Word document. Use Open original to check it.')
        setPreparedEvidence(bytes, 'docx', result, (result.body.length + result.styles.length) * 2)
        return result
      })()
      pending.set(bytes, request)
    }
    try { template = await request } finally { if (pending.get(bytes) === request) pending.delete(bytes) }
  }
  // Cache pristine markup only. Every response receives its own DOM and marks.
  const body = document.createElement('div'), styles = document.createElement('div')
  body.innerHTML = template.body; styles.innerHTML = template.styles
  return { body, styles, className: template.className }
}
