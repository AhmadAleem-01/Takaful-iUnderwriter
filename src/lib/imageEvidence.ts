import { findPdfEvidenceMatches, indexEvidenceText } from './inquiryEvidence'

export interface ImageEvidenceBox { x0: number; y0: number; x1: number; y1: number }
export interface ImageEvidenceWord { text: string; confidence: number; bbox: ImageEvidenceBox }
export interface ImageOcrBlock { paragraphs: Array<{ lines: Array<{ words: ImageEvidenceWord[] }> }> }
export interface ImageEvidenceMatch { evidenceIndex: number; page: number; boxes: ImageEvidenceBox[]; confidence: number }

export function imageOcrWords(blocks: ImageOcrBlock[] | null | undefined, width: number, height: number): ImageEvidenceWord[] {
  return (blocks ?? []).flatMap((block) => (block.paragraphs ?? []).flatMap((paragraph) => (paragraph.lines ?? []).flatMap((line) => line.words ?? [])))
    .filter((word) => word.text?.trim() && word.bbox && Object.values(word.bbox).every(Number.isFinite))
    .map((word) => ({ ...word, confidence: Number.isFinite(word.confidence) ? word.confidence : 0, bbox: {
      x0: Math.max(0, word.bbox.x0), y0: Math.max(0, word.bbox.y0), x1: Math.min(width, word.bbox.x1), y1: Math.min(height, word.bbox.y1),
    } }))
    .filter((word) => word.bbox.x1 > word.bbox.x0 && word.bbox.y1 > word.bbox.y0)
}

export function findImageEvidenceMatches(words: ImageEvidenceWord[], passages: string[], height: number): ImageEvidenceMatch[] {
  const items = words.map((word) => ({ str: word.text, transform: [1, 0, 0, 1, word.bbox.x0, height - word.bbox.y1],
    width: word.bbox.x1 - word.bbox.x0, height: word.bbox.y1 - word.bbox.y0, dir: /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/.test(word.text) ? 'rtl' : 'ltr' }))
  return findPdfEvidenceMatches(items, passages).flatMap((match) => {
    const first = match.ranges[0], last = match.ranges.at(-1)
    if (!first || !last) return []
    const wordCharacter = /[\p{L}\p{N}_]/u
    const firstText = words[first.item].text, lastText = words[last.item].text
    if (first.start > 0 && wordCharacter.test(firstText[first.start - 1]) && wordCharacter.test(firstText[first.start])) return []
    if (last.end < lastText.length && wordCharacter.test(lastText[last.end]) && wordCharacter.test(lastText[last.end - 1])) return []
    const matched = [...new Set(match.ranges.map((range) => range.item))].map((index) => words[index])
    if (matched.length === 1 && /^[\p{Sc}\s+-]*\d[\d,.\s]*%?$/u.test(passages[match.evidenceIndex].trim())
      && indexEvidenceText([matched[0].text]).text.trim() !== indexEvidenceText([passages[match.evidenceIndex]]).text.trim()) return []
    return [{ evidenceIndex: match.evidenceIndex, page: 1, boxes: matched.map((word) => word.bbox),
      confidence: Math.round(matched.reduce((sum, word) => sum + word.confidence, 0) / matched.length) }]
  })
}

export function imagePreviewSize(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('The image has invalid dimensions.')
  const scale = Math.min(1, 6000 / Math.max(width, height), Math.sqrt(16000000 / (width * height)))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}
