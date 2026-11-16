import DOMPurify from 'dompurify'
import { getSlides, loadPresentation } from '@office-kit/pptx'
import { defaultMeasurer, renderSlideToSvg, type TextMeasurer } from '@office-kit/pptx-preview'
import { findIndexedEvidenceMatches, indexEvidenceText, visualReadingOrder, type EvidenceTextRange } from './inquiryEvidence'
import { getPreparedEvidence, setPreparedEvidence } from './evidenceSessionCache'

const svgNamespace = 'http://www.w3.org/2000/svg'
const highlightOwners = new WeakMap<SVGGElement, SVGTextElement>()
export interface PptxEvidenceSlide { svg: SVGSVGElement; page: number; width: number; height: number; partial: boolean }
export interface PptxEvidenceMatch { evidenceIndex: number; page: number; locationLabel: string; ranges: EvidenceTextRange[] }
type SlideTemplate = Omit<PptxEvidenceSlide, 'svg'> & { source: string }
const packageLimits = {
  maxEntries: 10000, maxTotalUncompressedBytes: 250 * 1024 * 1024,
  maxXmlPartBytes: 10 * 1024 * 1024, maxTotalXmlBytes: 50 * 1024 * 1024,
}

const cancelled = () => new DOMException('PowerPoint preview was cancelled.', 'AbortError')

/** Keep inline SVG graphics while preventing slides from loading remote assets. */
export function sanitizePptxEvidenceSvg(source: string, prefix: string): SVGSVGElement {
  const fragment = DOMPurify.sanitize(source, {
    USE_PROFILES: { svg: true, svgFilters: true }, RETURN_DOM_FRAGMENT: true,
    FORBID_TAGS: ['style', 'script', 'foreignObject', 'animate', 'animateTransform', 'set'],
  })
  const svg = fragment.querySelector('svg')
  if (!svg) throw new Error('The slide renderer did not return a valid slide.')
  const ids = new Map<string, string>()
  for (const element of [svg, ...svg.querySelectorAll('[id]')]) {
    const id = element.getAttribute('id')
    if (id) { ids.set(id, `${prefix}-${ids.size}`); element.id = ids.get(id)! }
  }
  const safeUrl = (value: string) => value.startsWith('#') || /^data:image\/(png|jpeg|gif|webp|bmp);base64,/i.test(value)
  for (const element of [svg, ...svg.querySelectorAll('*')]) {
    for (const attribute of [...element.attributes]) {
      let value = attribute.value
      if (['href', 'xlink:href', 'src'].includes(attribute.name)) {
        if (!safeUrl(value)) { element.removeAttributeNode(attribute); continue }
        if (value.startsWith('#')) value = `#${ids.get(value.slice(1)) ?? value.slice(1)}`
      }
      value = value.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (_match, _quote, target: string) => {
        const url = target.trim()
        return safeUrl(url) ? `url("${url.startsWith('#') ? `#${ids.get(url.slice(1)) ?? url.slice(1)}` : url}")` : 'none'
      })
      if (value !== attribute.value) element.setAttributeNS(attribute.namespaceURI, attribute.name, value)
    }
  }
  svg.setAttribute('role', 'img')
  svg.style.cssText = 'display:block;width:100%;height:100%;overflow:hidden;'
  return svg as unknown as SVGSVGElement
}

/** Read every slide in presentation order; do not recalculate or execute content. */
export async function readPptxEvidence(bytes: Uint8Array, prefix: string, onProgress: (label: string) => void = () => {}, signal?: AbortSignal): Promise<PptxEvidenceSlide[]> {
  if (signal?.aborted) throw cancelled()
  const cached = getPreparedEvidence<SlideTemplate[]>(bytes, 'pptx')
  if (cached) return cached.map(({ source, ...slide }) => ({ ...slide, svg: sanitizePptxEvidenceSvg(source, `${prefix}-${slide.page}`) }))
  if (bytes.length > 50 * 1024 * 1024) throw new Error('This presentation is too large for the browser preview. Use Open original or convert it to PDF.')
  let presentation: Awaited<ReturnType<typeof loadPresentation>>
  try { presentation = await loadPresentation(bytes, { limits: packageLimits }) }
  catch (error) {
    const message = error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : String(error)
    // PowerPoint can retain deleted package entries without content types.
    // Only this precise compatibility failure permits a retry; other invalid
    // parts, malformed archives and size-limit errors remain reader errors.
    if (!/^part "\/\[trash\]\/[^"\r\n]+" has no content type registered in \[Content_Types\]\.xml$/i.test(message)) throw error
    const { withoutUnreferencedPptxTrash } = await import('./pptxPackage')
    const previewBytes = await withoutUnreferencedPptxTrash(bytes, signal)
    presentation = await loadPresentation(previewBytes, { limits: packageLimits })
  }
  const slides = getSlides(presentation)
  if (!slides.length) throw new Error('This presentation does not contain any slides.')
  if (slides.length > 300) throw new Error('This presentation has too many slides for the browser preview. Use Open original or convert it to PDF.')
  const context = document.createElement('canvas').getContext('2d')
  const measureText: TextMeasurer = context ? (text, spec) => {
    context.font = `${spec.italic ? 'italic ' : ''}${spec.bold ? 'bold ' : ''}${spec.sizePx}px ${JSON.stringify(spec.family)}`
    context.fontKerning = spec.kerning === false ? 'none' : 'normal'
    const metrics = context.measureText(text)
    return { widthPx: metrics.width + Math.max(0, [...text].length - 1) * spec.letterSpacingPx,
      ascentPx: metrics.fontBoundingBoxAscent, descentPx: metrics.fontBoundingBoxDescent }
  } : defaultMeasurer
  const result: PptxEvidenceSlide[] = []
  for (const [index, slide] of slides.entries()) {
    if (signal?.aborted) throw cancelled()
    onProgress(`Preparing slide ${index + 1} of ${slides.length}…`)
    const svg = sanitizePptxEvidenceSvg(renderSlideToSvg(presentation, slide, {
      textLayout: 'svg', measureText, resolveFamily: (family) => family || 'Arial',
    }), `${prefix}-${index + 1}`)
    const view = (svg.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number)
    const width = view[2], height = view[3]
    if (view.length !== 4 || !view.every(Number.isFinite) || width <= 0 || height <= 0 || width > 32768 || height > 32768) throw new Error('This presentation has an invalid slide size.')
    svg.setAttribute('aria-label', `Original PowerPoint slide ${index + 1}`)
    result.push({ svg, page: index + 1, width, height, partial: !!svg.querySelector('[data-pptx-fallback]') })
    // Let the viewer paint progress and honour cancellation between slides.
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }
  if (signal?.aborted) throw cancelled()
  const templates = result.map(({ svg, ...slide }) => ({ ...slide, source: svg.outerHTML }))
  setPreparedEvidence(bytes, 'pptx', templates, templates.reduce((sum, slide) => sum + slide.source.length * 2, 0))
  return result
}

function sourceTexts(svg: SVGSVGElement) {
  return [...svg.querySelectorAll<SVGTextElement>('text')].filter((text) => {
    if (!text.textContent?.trim() || !text.closest('[data-pptx-shape-id]')) return false
    if (text.closest('defs, symbol, clipPath, mask, pattern, marker, [aria-hidden="true"], [display="none"], [visibility="hidden"], [opacity="0"]')) return false
    const fallback = text.closest('[data-pptx-fallback]')
    return !fallback || (fallback.getAttribute('data-pptx-fallback') === 'custGeom' && !!text.closest('[data-pptx-paragraph]'))
  })
}

/** Match only rendered slide text, never notes, fallback labels or another slide. */
export function findPptxEvidenceMatches(slides: PptxEvidenceSlide[], passages: string[]) {
  const matches: PptxEvidenceMatch[] = []
  const texts = new Map<number, SVGTextElement[]>()
  for (const slide of slides) {
    const elements = sourceTexts(slide.svg)
    texts.set(slide.page, elements)
    const items = elements.map((element) => {
      const box = element.getBoundingClientRect()
      return { str: element.textContent ?? '', transform: [1, 0, 0, 1, box.left, -box.bottom], width: box.width, height: box.height || 1,
        dir: /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/.test(element.textContent ?? '') ? 'rtl' : 'ltr' }
    })
    // A <text> is a complete laid-out line; formatting runs are already joined
    // inside it. Always separate lines/cells, including adjacent table cells.
    const values = items.map((item) => item.str)
    const indexes = [indexEvidenceText(values), indexEvidenceText(values, visualReadingOrder(items))]
    for (const match of findIndexedEvidenceMatches(indexes, passages)) {
      const first = match.ranges[0], last = match.ranges.at(-1)
      const word = /[\p{L}\p{N}_]/u
      if (!first || !last) continue
      if (first.start > 0 && word.test(items[first.item].str[first.start - 1]) && word.test(items[first.item].str[first.start])) continue
      if (last.end < items[last.item].str.length && word.test(items[last.item].str[last.end]) && word.test(items[last.item].str[last.end - 1])) continue
      // Do not turn $1,500.00 into 500, or 5% into 5, by accepting a substring
      // at a punctuation boundary inside a numeric value.
      const before = items[first.item].str.slice(0, first.start), after = items[last.item].str.slice(last.end)
      if (/^\d/.test(items[first.item].str.slice(first.start)) && /(?:\d[.,]|[+\-\u2010-\u2015\u2212\p{Sc}])$/u.test(before)) continue
      if (/\d$/.test(items[last.item].str.slice(0, last.end)) && /^(?:[.,]\d|[%\p{Sc}])/u.test(after)) continue
      matches.push({ ...match, page: slide.page, locationLabel: `Slide ${slide.page}` })
    }
  }
  return { matches, texts, hasText: [...texts.values()].some((elements) => elements.length > 0) }
}

/** Draw in each text element's own coordinate system so group rotation stays aligned. */
export function drawPptxEvidenceHighlights(result: ReturnType<typeof findPptxEvidenceMatches>) {
  for (const elements of result.texts.values()) for (const element of elements) {
    element.parentElement?.querySelectorAll(':scope > [data-pptx-evidence-layer]').forEach((layer) => layer.remove())
  }
  let painted = 0
  result.matches.forEach((match, matchIndex) => {
    for (const range of match.ranges) {
      const text = result.texts.get(match.page)?.[range.item]
      if (!text || typeof text.getExtentOfChar !== 'function') continue
      const layer = text.ownerDocument.createElementNS(svgNamespace, 'g')
      layer.setAttribute('data-pptx-evidence-layer', '')
      layer.setAttribute('aria-hidden', 'true'); layer.setAttribute('pointer-events', 'none')
      for (const attribute of ['transform', 'clip-path']) {
        const value = text.getAttribute(attribute)
        if (value) layer.setAttribute(attribute, value)
      }
      const points = [...(text.textContent ?? '')]
      const codePoints = text.getNumberOfChars() === points.length && points.length !== text.textContent?.length
      const start = codePoints ? [...(text.textContent ?? '').slice(0, range.start)].length : range.start
      const end = codePoints ? [...(text.textContent ?? '').slice(0, range.end)].length : range.end
      const boxes: Array<{ x: number; y: number; width: number; height: number }> = []
      for (let index = start; index < end; index++) {
        try {
          const box = text.getExtentOfChar(index)
          if ([box.x, box.y, box.width, box.height].every(Number.isFinite) && box.width > 0 && box.height > 0) boxes.push({ x: box.x, y: box.y, width: box.width, height: box.height })
        } catch { /* A zero-width or non-addressable character has no rectangle. */ }
      }
      boxes.sort((a, b) => a.y - b.y || a.x - b.x)
      const merged: typeof boxes = []
      for (const box of boxes) {
        const previous = merged.at(-1)
        if (previous && Math.abs(previous.y - box.y) < 1 && Math.abs(previous.height - box.height) < 1 && box.x <= previous.x + previous.width + 1) previous.width = Math.max(previous.width, box.x + box.width - previous.x)
        else merged.push({ ...box })
      }
      for (const box of merged) {
        const rect = text.ownerDocument.createElementNS(svgNamespace, 'rect')
        for (const [key, value] of Object.entries(box)) rect.setAttribute(key, String(value))
        rect.setAttribute('rx', '1.5'); rect.setAttribute('fill', 'rgb(250 204 21 / .4)')
        rect.setAttribute('data-pptx-evidence-match', String(matchIndex))
        layer.append(rect); painted++
      }
      if (layer.childNodes.length) { highlightOwners.set(layer, text); text.before(layer) }
    }
  })
  return painted
}

export function activatePptxEvidence(root: HTMLElement, active: number) {
  for (const rect of root.querySelectorAll<SVGRectElement>('[data-pptx-evidence-match]')) {
    const selected = Number(rect.getAttribute('data-pptx-evidence-match')) === active
    rect.setAttribute('fill', selected ? 'rgb(251 146 60 / .5)' : 'rgb(250 204 21 / .4)')
    if (selected) {
      const layer = rect.parentElement as unknown as SVGGElement
      highlightOwners.get(layer)?.before(layer)
    }
  }
  return root.querySelector<SVGRectElement>(`[data-pptx-evidence-match="${active}"]`)
}
