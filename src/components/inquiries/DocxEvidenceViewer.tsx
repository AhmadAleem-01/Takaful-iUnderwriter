import { useEffect, useRef, useState, type ReactNode } from 'react'
import { activateDocxEvidence, highlightDocxEvidence } from '../../lib/docxEvidence'
import { readDocxEvidence } from '../../lib/docxEvidenceDocument'
import { EvidenceViewerLayout } from './EvidenceViewerLayout'

type Match = ReturnType<typeof highlightDocxEvidence>['matches'][number]

export default function DocxEvidenceViewer({ bytes, passages, sourceSelector, expanded, onToggleExpand }: {
  bytes: Uint8Array; passages: string[]; sourceSelector?: ReactNode; expanded?: boolean; onToggleExpand?: () => void
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pageElements = useRef<HTMLElement[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [active, setActive] = useState(0)
  const [page, setPage] = useState(1)
  const [pageCount, setPageCount] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [loading, setLoading] = useState(true)
  const [hasText, setHasText] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const host = contentRef.current
    if (!host) return
    host.replaceChildren(); pageElements.current = []
    setLoading(true); setError(''); setMatches([]); setActive(0); setPage(1); setPageCount(0)
    void (async () => {
      const { body, styles, className } = await readDocxEvidence(bytes)
      if (cancelled) return
      const pages = [...body.querySelectorAll<HTMLElement>(`section.${className}`)]
      if (!pages.length) throw new Error('This file does not contain a viewable Word document. Use Open original to check it.')
      pages.forEach((element, index) => {
        element.dataset.evidencePage = String(index + 1)
        element.style.marginBottom = '0'
        element.style.boxShadow = '0 2px 12px rgb(15 23 42 / .08)'
      })
      const wrapper = body.querySelector<HTMLElement>(`.${className}-wrapper`)
      if (wrapper) Object.assign(wrapper.style, { padding: '0', background: 'transparent', gap: '24px' })
      const result = highlightDocxEvidence(body, passages)
      if (cancelled) return
      host.replaceChildren(styles, body); pageElements.current = pages
      setMatches(result.matches); setHasText(result.hasText); setPageCount(pages.length)
      setPage(result.matches[0]?.page ?? 1)
    })().catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? `Unable to preview this Word document: ${reason.message}` : 'Unable to preview this Word document.')
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true; host.replaceChildren(); pageElements.current = [] }
  }, [bytes, passages])

  function locate(element: HTMLElement) {
    const scroll = scrollRef.current
    if (!scroll) return
    const box = element.getBoundingClientRect(), viewport = scroll.getBoundingClientRect()
    scroll.scrollTo({ top: scroll.scrollTop + box.top - viewport.top - 48,
      left: box.left < viewport.left || box.right > viewport.right ? scroll.scrollLeft + box.left - viewport.left - 32 : scroll.scrollLeft })
  }

  useEffect(() => {
    if (loading || !contentRef.current) return
    const mark = activateDocxEvidence(contentRef.current, active)
    if (mark) locate(mark)
  }, [active, loading, zoom])

  useEffect(() => {
    const scroll = scrollRef.current
    if (!scroll || loading) return
    const onScroll = () => {
      const top = scroll.getBoundingClientRect().top + 60
      let visible = 1
      for (const [index, element] of pageElements.current.entries()) {
        if (element.getBoundingClientRect().top <= top) visible = index + 1
      }
      setPage(visible)
    }
    scroll.addEventListener('scroll', onScroll, { passive: true })
    return () => scroll.removeEventListener('scroll', onScroll)
  }, [loading])

  function changePage(number: number) { const element = pageElements.current[number - 1]; if (element) { setPage(number); locate(element) } }
  function changeMatch(index: number) {
    if (!matches[index]) return
    setActive(index); setPage(matches[index].page)
    if (contentRef.current) { const mark = activateDocxEvidence(contentRef.current, index); if (mark) locate(mark) }
  }
  return <EvidenceViewerLayout passages={passages} matches={matches} active={active} page={page} pageCount={pageCount} zoom={zoom} loading={loading} error={error}
    emptyMessage={hasText ? 'This Word document has text, but the complete evidence passage could not be matched. Check the JSON wording against the document.' : 'No searchable text was found. Text inside images needs OCR.'}
    sourceSelector={sourceSelector} expanded={expanded} onToggleExpand={onToggleExpand} onPage={changePage} onZoom={setZoom} onMatch={changeMatch} formatLabel="DOCX preview" scrollRef={scrollRef}>
    <div ref={contentRef} className="text-black" style={{ zoom, width: 'max-content', minWidth: `${100 / zoom}%`, visibility: loading ? 'hidden' : 'visible' }} />
  </EvidenceViewerLayout>
}
