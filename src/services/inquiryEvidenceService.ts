import { GetInquiryEvidenceDocumentService } from '../generated/services/GetInquiryEvidenceDocumentService'
import { normalizeEvidenceDocumentPath, resolveEvidencePath } from '../lib/inquiryEvidence'
import { getSharePointSiteUrl } from './sharePointSiteService'
import { evidenceDocumentFormat } from '../lib/evidenceDocumentFormat'
import { EvidenceSessionCache } from '../lib/evidenceSessionCache'

type EvidenceDocument = Awaited<ReturnType<typeof fetchEvidenceDocument>>
const documents = new EvidenceSessionCache<string, EvidenceDocument>(8, 96 * 1024 * 1024)
const pending = new Map<string, Promise<EvidenceDocument>>()

export async function getInquiryEvidenceDocument(inquiryId: string, documentsUrl: string | undefined, documentName: string, options: { refresh?: boolean } = {}) {
  // Resolve and validate current inquiry links even when this file was cached.
  const linkedPath = resolveEvidencePath(documentsUrl, documentName)
  const needsSite = /^(https?:\/\/|\/(sites|teams)\/)/i.test(linkedPath)
  const documentPath = normalizeEvidenceDocumentPath(linkedPath, needsSite ? await getSharePointSiteUrl() : undefined)
  const id = inquiryId.replace(/[{}]/g, '')
  const key = JSON.stringify([id.toLowerCase(), documentPath])
  if (options.refresh) { documents.delete(key); pending.delete(key) }
  const cached = documents.get(key)
  if (cached) return cached
  const existing = pending.get(key)
  if (existing) return existing
  const request = fetchEvidenceDocument(id, documentPath, documentName)
  pending.set(key, request)
  try {
    const result = await request
    // A slower, superseded request must not overwrite a manual refresh.
    if (pending.get(key) === request) documents.set(key, result, result.bytes.byteLength)
    return result
  } finally { if (pending.get(key) === request) pending.delete(key) }
}

async function fetchEvidenceDocument(inquiryId: string, documentPath: string, documentName: string) {
  const result = await GetInquiryEvidenceDocumentService.Run({ text: inquiryId, text_1: documentPath })
  if (!result.success) throw new Error(result.error?.message || 'Unable to retrieve the evidence document.')
  const data = result.data
  if (!data || String(data.success).toLowerCase() !== 'true') throw new Error(data?.errormessage || 'The evidence flow could not retrieve this file.')
  if (!data.contentbase64) throw new Error('The evidence flow returned an empty file.')
  let bytes: Uint8Array
  try {
    const binary = atob(data.contentbase64.replace(/^data:[^,]*;base64,/, '').replace(/\s/g, ''))
    bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  } catch { throw new Error('The evidence flow returned invalid file content.') }
  const filename = data.filename || documentPath.split('/').pop() || documentName
  const format = evidenceDocumentFormat(bytes, filename, data.mimetype, documentPath)
  return { bytes, isPdf: format === 'pdf', format, filename, documentPath }
}
