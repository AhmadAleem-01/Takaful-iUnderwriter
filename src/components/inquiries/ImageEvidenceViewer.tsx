import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import { findImageEvidenceMatches, type ImageEvidenceWord } from '../../lib/imageEvidence'
import { prepareEvidenceImage, recognizeEvidenceImage } from '../../services/imageEvidenceService'
import { EvidenceViewerLayout } from './EvidenceViewerLayout'
import { Button } from '../ui/Button'

export default function ImageEvidenceViewer({ bytes, passages, sourceSelector, expanded, onToggleExpand }: {
  bytes: Uint8Array; passages: string[]; sourceSelector?: ReactNode; expanded?: boolean; onToggleExpand?: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [preview, setPreview] = useState<{ url: string; width: number; height: number } | null>(null)
  const [words, setWords] = useState<ImageEvidenceWord[]>([])
  const [active, setActive] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState('Preparing image…')
  const [confidence, setConfidence] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setProgress('Preparing image…'); setError(''); setWords([]); setConfidence(null); setActive(0); setPreview(null)
    void (async () => {
      const image = await prepareEvidenceImage(bytes, controller.signal)
      if (controller.signal.aborted) return
      setPreview({ url: image.dataUrl, width: image.width, height: image.height })
      setZoom(Math.round(Math.max(.1, Math.min(1, ((scrollRef.current?.clientWidth || image.width + 56) - 56) / image.width)) * 100) / 100)
      const result = await recognizeEvidenceImage(image.bytes, image.width, image.height, (label) => {
        if (!controller.signal.aborted) setProgress(label)
      }, controller.signal, { refresh: retry > 0 })
      if (controller.signal.aborted) return
      setWords(result.words)
      setConfidence(Number.isFinite(result.confidence) ? Math.max(0, Math.min(100, Math.round(result.confidence))) : null)
    })().catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Unable to recognize text in this image.')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => { controller.abort() }
  }, [bytes, retry])
  const matches = useMemo(() => findImageEvidenceMatches(words, passages, preview?.height ?? 1), [words, passages, preview?.height])
  useEffect(() => { setActive(0) }, [passages])
  useEffect(() => {
    const scroll = scrollRef.current
    const mark = contentRef.current?.querySelector<SVGRectElement>(`[data-image-match="${active}"]`)
    if (!scroll || !mark) return
    const box = mark.getBoundingClientRect(), viewport = scroll.getBoundingClientRect()
    scroll.scrollTo({ top: scroll.scrollTop + box.top - viewport.top - 64,
      left: box.left < viewport.left || box.right > viewport.right ? scroll.scrollLeft + box.left - viewport.left - 32 : scroll.scrollLeft })
  }, [active, matches, zoom])
  const controls = <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border-soft bg-surface px-4 py-2 text-[11px] text-muted-foreground"><span>English and Arabic text recognition{confidence !== null ? ` · ${confidence}% OCR confidence` : ''}</span><Button type="button" variant="ghost" size="sm" className="h-7 rounded-lg text-[11px]" disabled={loading} onClick={() => setRetry((value) => value + 1)}><RefreshCw className="h-3 w-3" />Recognize again</Button></div>
  return <EvidenceViewerLayout passages={passages} matches={matches} active={active} page={1} pageCount={preview ? 1 : 0} zoom={zoom} loading={loading} loadingLabel={progress} error={error}
    emptyMessage={words.length ? 'The complete evidence passage was not found in the recognized text. Blurry text, handwriting, or a different language can prevent matching.' : 'No text was recognized. Try a clearer image with readable English or Arabic text.'}
    sourceSelector={sourceSelector} expanded={expanded} onToggleExpand={onToggleExpand} onPage={() => {}} onZoom={setZoom} minZoom={.1} zoomStep={.1} onMatch={setActive} formatLabel="Image preview" unitLabel="Image" beforeDocument={controls} scrollRef={scrollRef}>
    {preview ? <div ref={contentRef} className="relative mx-auto bg-white shadow-sm" style={{ width: preview.width * zoom, height: preview.height * zoom }}>
      <img src={preview.url} alt="Reference document" draggable={false} className="block h-full w-full max-w-none" />
      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${preview.width} ${preview.height}`} preserveAspectRatio="none">
        {matches.map((match, index) => match.boxes.map((box, part) => <rect key={`${index}:${part}`} data-image-match={index} x={box.x0} y={box.y0} width={box.x1 - box.x0} height={box.y1 - box.y0} rx={2} fill={index === active ? 'rgb(251 146 60 / .5)' : 'rgb(250 204 21 / .4)'} />))}
      </svg>
    </div> : null}
  </EvidenceViewerLayout>
}
