import JSZip from 'jszip'

const trashPath = (name: string) => /^\/?\[trash\](?:\/|$)/i.test(name)
const cancelled = () => new DOMException('PowerPoint preview was cancelled.', 'AbortError')

/** Called only after the reader validated ZIP limits and rejected an untyped
 * trash part. Remove reserved, unreferenced trash from a private preview copy;
 * never guess a content type or remove an active presentation part. */
export async function withoutUnreferencedPptxTrash(bytes: Uint8Array, signal?: AbortSignal) {
  if (signal?.aborted) throw cancelled()
  const archive = await JSZip.loadAsync(bytes, { createFolders: false })
  if (signal?.aborted) throw cancelled()
  const trash = Object.keys(archive.files).filter(trashPath)
  if (!trash.length) throw new Error('The presentation archive has no unused trash entries to exclude.')
  for (const file of Object.values(archive.files)) {
    if (signal?.aborted) throw cancelled()
    // JSZip normalizes traversal paths. Do not let repacking silently repair
    // unrelated part names or change which content an active relationship uses.
    if (file.unsafeOriginalName && file.unsafeOriginalName !== file.name) throw new Error('This presentation has nonstandard package paths. Re-save it as a new PPTX or export it to PDF.')
    if (file.dir || trashPath(file.name) || !file.name.toLowerCase().endsWith('.rels')) continue
    const source = file.name.toLowerCase() === '_rels/.rels' ? '/' : file.name.replace(/^(.*\/)?_rels\/([^/]+)\.rels$/i, '/$1$2')
    if (!source.startsWith('/')) throw new Error('This presentation has an invalid relationship part. Re-save it as a new PPTX or export it to PDF.')
    const xml = new DOMParser().parseFromString(await file.async('string'), 'application/xml')
    if (xml.querySelector('parsererror') || xml.documentElement.localName !== 'Relationships') throw new Error('This presentation has invalid package relationships. Re-save it as a new PPTX or export it to PDF.')
    for (const relationship of xml.getElementsByTagNameNS('*', 'Relationship')) {
      const mode = relationship.getAttribute('TargetMode')
      if (mode === 'External') continue
      if (mode && mode !== 'Internal') throw new Error('This presentation has an invalid relationship mode. Re-save it as a new PPTX or export it to PDF.')
      const target = relationship.getAttribute('Target')
      if (!target) throw new Error('This presentation has a relationship without a target.')
      let resolved: URL
      try { resolved = new URL(decodeURIComponent(target), `https://pptx-preview.invalid${source}`) }
      catch { throw new Error('This presentation has an invalid relationship target.') }
      if (resolved.origin !== 'https://pptx-preview.invalid') throw new Error('This presentation has an invalid internal relationship target.')
      if (trashPath(resolved.pathname)) throw new Error('This presentation references content in its trash folder. Re-save it as a new PPTX or export it to PDF before previewing.')
    }
  }
  if (signal?.aborted) throw cancelled()
  for (const name of trash) archive.remove(name)
  const result = await archive.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
  if (signal?.aborted) throw cancelled()
  return result
}
