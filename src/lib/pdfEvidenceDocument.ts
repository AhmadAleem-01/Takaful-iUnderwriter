import { getDocument, type PDFDocumentProxy } from 'pdfjs-dist'
import type { TextContent } from 'pdfjs-dist/types/src/display/api'
import { getPreparedEvidence, setPreparedEvidence } from './evidenceSessionCache'

interface PreparedPdf { document: PDFDocumentProxy; contents: TextContent[]; users: number; retained: boolean; destroyed: boolean; destroy: () => void }
const pending = new WeakMap<Uint8Array, Promise<PreparedPdf>>()
export interface PdfEvidenceLease { document: PDFDocumentProxy; contents: TextContent[]; release: () => void }

/** Keep an engine/text index warm; eviction waits for active viewers to release it. */
export async function acquirePdfEvidence(bytes: Uint8Array): Promise<PdfEvidenceLease> {
  let prepared = getPreparedEvidence<PreparedPdf>(bytes, 'pdf')
  if (!prepared) {
    let request = pending.get(bytes)
    if (!request) {
      request = (async () => {
        const task = getDocument({ data: bytes.slice() })
        try {
          const document = await task.promise
          const contents: TextContent[] = []
          for (let page = 1; page <= document.numPages; page++) contents.push(await (await document.getPage(page)).getTextContent())
          const result: PreparedPdf = { document, contents, users: 0, retained: false, destroyed: false, destroy: () => {
            if (result.destroyed || result.users || result.retained) return
            result.destroyed = true; void task.destroy().catch(() => {})
          } }
          const size = bytes.byteLength * 2 + contents.reduce((sum, content) => sum + content.items.reduce((total, item) => total + ('str' in item ? item.str.length * 2 + 160 : 64), 0), 0)
          result.retained = setPreparedEvidence(bytes, 'pdf', result, size, () => { result.retained = false; result.destroy() })
          return result
        } catch (error) { void task.destroy().catch(() => {}); throw error }
      })()
      pending.set(bytes, request)
    }
    try { prepared = await request } finally { if (pending.get(bytes) === request) pending.delete(bytes) }
  }
  // Another preparation may have evicted this entry before our await resumed.
  if (prepared.destroyed) return acquirePdfEvidence(bytes)
  prepared.users++
  const resource = prepared
  let released = false
  return { document: resource.document, contents: resource.contents, release: () => {
    if (released) return
    released = true; resource.users--; resource.destroy()
  } }
}
