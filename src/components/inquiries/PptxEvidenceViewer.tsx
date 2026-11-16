import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { activatePptxEvidence, drawPptxEvidenceHighlights, findPptxEvidenceMatches, readPptxEvidence, type PptxEvidenceMatch, type PptxEvidenceSlide } from '../../lib/pptxEvidence'
import { EvidenceViewerLayout } from './EvidenceViewerLayout'

export default function PptxEvidenceViewer({ bytes, passages, sourceSelector, expanded, onToggleExpand }: {
  bytes: Uint8Array; passages: string[]; sourceSelector?: ReactNode; expanded?: boolean; onToggleExpand?: () => void
}) {
  const prefix = `evidence-slides-${useId().replace(/[^a-z0-9]/gi, '')}`
  const contentRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pages = useRef<HTMLElement[]>([])
  const [slides, setSlides] = useState<PptxEvidenceSlide[]>([])
  const [matches, setMatches] = useState<PptxEvidenceMatch[]>([])
  const [active, setActive] = useState(0)
  const [page, setPage] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState('Preparing presentation…')
  const [hasText, setHasText] = useState(false)
  const [error, setError] = useState('')
  const [highlightError, setHighlightError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const host = contentRef.current
    if (!host) return
    host.replaceChildren(); pages.current = []
    setSlides([]); setMatches([]); setActive(0); setPage(1); setLoading(true); setError(''); setHighlightError('')
    void readPptxEvidence(bytes, prefix, (label) => { if (!controller.signal.aborted) setProgress(label) }, controller.signal).then((prepared) => {
      if (controller.signal.aborted) return
      const elements = prepared.map((slide) => {
        const section = document.createElement('section')
        section.dataset.evidencePage = String(slide.page)
        section.setAttribute('aria-label', `Slide ${slide.page}`)
        section.className = 'mx-auto bg-white shadow-sm'
        section.style.cssText = `width:${slide.width}px;height:${slide.height}px;`
        section.append(slide.svg)
        return section
      })
      host.replaceChildren(...elements); pages.current = elements
      const result = findPptxEvidenceMatches(prepared, passages)
      drawPptxEvidenceHighlights(result)
      if (result.matches.some((_, index) => !host.querySelector(`[data-pptx-evidence-match="${index}"]`))) setHighlightError('Evidence was found, but this browser could not position all highlights. Use Open original to check the source.')
      setSlides(prepared); setMatches(result.matches); setHasText(result.hasText); setPage(result.matches[0]?.page ?? 1)
      setZoom(Math.round(Math.max(.1, Math.min(1, ((scrollRef.current?.clientWidth || prepared[0].width + 56) - 56) / prepared[0].width)) * 100) / 100)
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? `Unable to preview this PowerPoint file: ${reason.message}` : 'Unable to preview this PowerPoint file.')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => { controller.abort(); host.replaceChildren(); pages.current = [] }
  }, [bytes, passages, prefix])

  function locate(element: Element) {
    const scroll = scrollRef.current
    if (!scroll) return
    const box = element.getBoundingClientRect(), viewport = scroll.getBoundingClientRect()
    scroll.scrollTo({ top: scroll.scrollTop + box.top - viewport.top - 48,
      left: box.left < viewport.left || box.right > viewport.right ? scroll.scrollLeft + box.left - viewport.left - 32 : scroll.scrollLeft })
  }
  useEffect(() => {
    if (loading || !contentRef.current) return
    const mark = activatePptxEvidence(contentRef.current, active)
    const target = mark ?? pages.current[(matches[active]?.page ?? 1) - 1]
    if (target) locate(target)
  }, [active, loading, matches])
  useEffect(() => {
    const scroll = scrollRef.current
    if (!scroll || loading) return
    const onScroll = () => {
      const top = scroll.getBoundingClientRect().top + 60
      let visible = 1
      for (const [index, element] of pages.current.entries()) if (element.getBoundingClientRect().top <= top) visible = index + 1
      setPage(visible)
    }
    scroll.addEventListener('scroll', onScroll, { passive: true })
    return () => scroll.removeEventListener('scroll', onScroll)
  }, [loading])
  function changePage(number: number) { const element = pages.current[number - 1]; if (element) { setPage(number); locate(element) } }
  function changeMatch(index: number) {
    if (!matches[index]) return
    setActive(index); setPage(matches[index].page)
    if (contentRef.current) { const mark = activatePptxEvidence(contentRef.current, index); if (mark) locate(mark); else changePage(matches[index].page) }
  }
  const partial = slides.some((slide) => slide.partial)
  const notice = partial ? <p role="status" className="shrink-0 border-b border-border-soft bg-surface px-5 py-2 text-[11px] text-muted-foreground">Some slide elements could not be fully rendered. Use Open original to see the complete presentation.</p> : undefined
  return <EvidenceViewerLayout passages={passages} matches={matches} active={active} page={page} pageCount={slides.length} zoom={zoom} loading={loading} loadingLabel={progress} error={error || highlightError}
    emptyMessage={hasText ? 'The complete evidence passage was not found in the slide text. Check its wording against the source presentation.' : 'No searchable slide text was found. Text inside images needs OCR.'}
    sourceSelector={sourceSelector} expanded={expanded} onToggleExpand={onToggleExpand} onPage={changePage} onZoom={setZoom} minZoom={.1} zoomStep={.1} onMatch={changeMatch} formatLabel="PPTX preview" unitLabel="Slide" beforeDocument={notice} scrollRef={scrollRef}>
    <div ref={contentRef} className="flex flex-col gap-6 text-black" style={{ zoom, width: 'max-content', minWidth: `${100 / zoom}%`, visibility: loading ? 'hidden' : 'visible' }} />
  </EvidenceViewerLayout>
}
