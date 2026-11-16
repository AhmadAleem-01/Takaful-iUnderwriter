import { useEffect, useRef, useState, type ReactNode } from 'react'
import { TextLayer, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist'
import type { TextContent } from 'pdfjs-dist/types/src/display/api'
// Registers pdfjsWorker.WorkerMessageHandler in this lazy-loaded app chunk.
// PDF.js can then parse locally without fetching a standalone .mjs worker
// through the published Power Apps runtime proxy.
import 'pdfjs-dist/build/pdf.worker.mjs'
import 'pdfjs-dist/web/pdf_viewer.css'
import { EvidenceViewerLayout } from './EvidenceViewerLayout'
import { findPdfEvidenceMatches, type PdfEvidenceMatch } from '../../lib/inquiryEvidence'
import { acquirePdfEvidence, type PdfEvidenceLease } from '../../lib/pdfEvidenceDocument'

type Match = PdfEvidenceMatch & { page: number }

export default function PdfEvidenceViewer({ bytes, passages, sourceSelector, expanded, onToggleExpand }: { bytes: Uint8Array; passages: string[]; sourceSelector?: ReactNode; expanded?: boolean; onToggleExpand?: () => void }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [page, setPage] = useState(1)
  const [active, setActive] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [loading, setLoading] = useState(true)
  const [hasSearchableText, setHasSearchableText] = useState(false)
  const [rendering, setRendering] = useState(false)
  const [error, setError] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const highlightsRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentsRef = useRef<TextContent[]>([])

  useEffect(() => {
    let cancelled = false
    let lease: PdfEvidenceLease | undefined
    setLoading(true); setPdf(null); setError(''); setMatches([]); setPage(1); setActive(0); setHasSearchableText(false)
    void (async () => {
      const acquired = await acquirePdfEvidence(bytes)
      if (cancelled) { acquired.release(); return }
      lease = acquired
      const document = acquired.document
      const found: Match[] = []
      let searchable = false
      for (let number = 1; number <= document.numPages; number++) {
        if (cancelled) return
        const content = acquired.contents[number - 1]
        const items = content.items.flatMap((item) => 'str' in item ? [item] : [])
        searchable ||= items.some((item) => item.str.trim().length > 0)
        found.push(...findPdfEvidenceMatches(items, passages).map((match) => ({ ...match, page: number })))
      }
      if (!cancelled) { contentsRef.current = acquired.contents; setPdf(document); setMatches(found); setPage(found[0]?.page ?? 1); setHasSearchableText(searchable) }
    })().catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Unable to open this PDF.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true; lease?.release() }
  }, [bytes, passages])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = textRef.current
    const highlights = highlightsRef.current
    const surface = surfaceRef.current
    if (!pdf || !canvas || !container || !highlights || !surface) return
    let cancelled = false
    let renderTask: RenderTask | undefined
    let layer: TextLayer | undefined
    setRendering(true)
    setError('')
    container.replaceChildren(); highlights.replaceChildren()
    void (async () => {
      const pdfPage = await pdf.getPage(page)
      if (cancelled) return
      const viewport = pdfPage.getViewport({ scale: zoom })
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.ceil(viewport.width * ratio); canvas.height = Math.ceil(viewport.height * ratio)
      canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`
      surface.style.width = `${viewport.width}px`; surface.style.height = `${viewport.height}px`
      surface.style.setProperty('--total-scale-factor', String(zoom * pdfPage.userUnit))
      surface.style.setProperty('--scale-round-x', '1px')
      surface.style.setProperty('--scale-round-y', '1px')
      renderTask = pdfPage.render({ canvas, viewport, transform: [ratio, 0, 0, ratio, 0, 0] })
      const content = contentsRef.current[page - 1]
      if (cancelled) return
      layer = new TextLayer({ textContentSource: content, container, viewport })
      await Promise.all([renderTask.promise, layer.render(), document.fonts.ready])
      if (cancelled) return
      const bounds = surface.getBoundingClientRect()
      matches.forEach((match, matchIndex) => {
        if (match.page !== page) return
        for (const source of match.ranges) {
          const span = layer!.textDivs[source.item]
          const node = span?.firstChild
          if (!node || node.nodeType !== Node.TEXT_NODE) continue
          const start = source.start
          const end = source.end
          if (end > node.textContent!.length) continue
          if (start >= end) continue
          const range = document.createRange()
          range.setStart(node, start); range.setEnd(node, end)
          for (const rect of range.getClientRects()) {
            const mark = document.createElement('div')
            mark.dataset.match = String(matchIndex)
            mark.style.cssText = `position:absolute;left:${rect.left - bounds.left}px;top:${rect.top - bounds.top}px;width:${rect.width}px;height:${rect.height}px;background:${matchIndex === active ? 'rgb(251 146 60 / .5)' : 'rgb(250 204 21 / .4)'};border-radius:2px;`
            highlights.append(mark)
          }
        }
      })
      const mark = highlights.querySelector<HTMLElement>(`[data-match="${active}"]`)
      if (mark && scrollRef.current) {
        const box = mark.getBoundingClientRect(), parent = scrollRef.current.getBoundingClientRect()
        const outside = box.left < parent.left + 16 || box.right > parent.right - 16
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollTop + box.top - parent.top - 80, left: outside ? scrollRef.current.scrollLeft + box.left - parent.left - 60 : scrollRef.current.scrollLeft })
      }
    })().catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Unable to render this PDF page.') })
      .finally(() => { if (!cancelled) setRendering(false) })
    return () => { cancelled = true; renderTask?.cancel(); layer?.cancel() }
  }, [pdf, page, zoom, matches, active])

  function jump(index: number) { setActive(index); setPage(matches[index].page) }
  return <EvidenceViewerLayout passages={passages} matches={matches} active={active} page={page} pageCount={pdf?.numPages ?? 0} zoom={zoom} loading={loading} rendering={rendering} error={error} emptyMessage={hasSearchableText ? 'This PDF has searchable text, but the complete evidence passage could not be matched. Check the JSON wording against the document.' : 'No searchable text was extracted. Scanned documents need OCR, which is not available here.'} sourceSelector={sourceSelector} expanded={expanded} onToggleExpand={onToggleExpand} onPage={setPage} onZoom={setZoom} onMatch={jump} formatLabel="PDF" scrollRef={scrollRef}>
    <div ref={surfaceRef} className="relative mx-auto bg-white shadow-[0_2px_12px_rgba(15,23,42,0.08)]" style={{ visibility: loading ? 'hidden' : 'visible' }}>
      <canvas ref={canvasRef} aria-label={`Original PDF page ${page}`} />
      <div ref={textRef} className="textLayer" />
      <div ref={highlightsRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-[2]" />
    </div>
  </EvidenceViewerLayout>
}
