import DOMPurify from 'dompurify'
import { findIndexedEvidenceMatches, indexEvidenceText } from './inquiryEvidence'

const blockElements = new Set(['P', 'DIV', 'SECTION', 'ARTICLE', 'TD', 'TH', 'TR', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BR'])

/** Collect visible text without inserting spaces between Word's split formatting runs. */
export function indexDocxEvidence(root: HTMLElement) {
  const nodes: Text[] = []
  const separators: string[] = []
  let boundary = false
  function visit(node: Node) {
    if (node.nodeType === 3) {
      const text = node as Text
      if (!text.data) return
      separators.push(boundary ? ' ' : '')
      nodes.push(text)
      boundary = false
      return
    }
    if (node.nodeType !== 1) return
    const element = node as HTMLElement
    if (['STYLE', 'SCRIPT', 'NOSCRIPT', 'TEMPLATE'].includes(element.tagName) || element.hidden || element.style.display === 'none') return
    const block = blockElements.has(element.tagName)
    if (block) boundary = true
    for (const child of element.childNodes) visit(child)
    if (block) boundary = true
  }
  visit(root)
  return { nodes, index: indexEvidenceText(nodes.map((node) => node.data), nodes.map((_, index) => index), separators) }
}

export function sanitizeDocxEvidence(body: HTMLElement, styles: HTMLElement) {
  DOMPurify.sanitize(body, { IN_PLACE: true, ADD_TAGS: ['style'], FORBID_TAGS: ['iframe', 'object', 'embed', 'form', 'input', 'button'] })
  // Keep the renderer's scoped CSS, but remove any active content from style output.
  DOMPurify.sanitize(styles, { IN_PLACE: true, ADD_TAGS: ['style'] })
  const safeCss = (css: string) => css.replace(/@import\s+[^;]+;/gi, '')
      .replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (match, _quote, target: string) => /^data:/i.test(target.trim()) ? match : 'none')
  for (const style of [...styles.querySelectorAll('style'), ...body.querySelectorAll('style')]) {
    style.textContent = safeCss(style.textContent ?? '')
  }
  for (const element of body.querySelectorAll<HTMLElement>('[style]')) {
    element.setAttribute('style', safeCss(element.getAttribute('style') ?? ''))
  }
  for (const image of body.querySelectorAll('img')) {
    if (!(image.getAttribute('src') ?? '').startsWith('data:')) image.removeAttribute('src')
  }
  for (const link of body.querySelectorAll('a')) {
    link.target = '_blank'; link.rel = 'noopener noreferrer'
    const href = link.getAttribute('href') ?? ''
    if (href && !/^(https?:|mailto:|#)/i.test(href)) link.removeAttribute('href')
  }
}

/** Wrap only matched source ranges; preserve all other source text and formatting. */
export function highlightDocxEvidence(root: HTMLElement, passages: string[]) {
  const { nodes, index } = indexDocxEvidence(root)
  const matches = findIndexedEvidenceMatches([index], passages).map((match) => {
    const page = nodes[match.ranges[0]?.item]?.parentElement?.closest<HTMLElement>('[data-evidence-page]')
    return { ...match, page: Number(page?.dataset.evidencePage) || 1 }
  })
  const byNode = new Map<number, Array<{ start: number; end: number; match: number }>>()
  matches.forEach((match, matchIndex) => match.ranges.forEach((range) => {
    const ranges = byNode.get(range.item) ?? []
    ranges.push({ ...range, match: matchIndex }); byNode.set(range.item, ranges)
  }))
  for (const [item, ranges] of byNode) {
    const node = nodes[item]
    const cuts = [...new Set([0, node.length, ...ranges.flatMap((range) => [range.start, range.end])])].sort((a, b) => a - b)
    const fragment = node.ownerDocument.createDocumentFragment()
    for (let cut = 0; cut < cuts.length - 1; cut++) {
      const start = cuts[cut], end = cuts[cut + 1]
      const active = ranges.filter((range) => range.start < end && range.end > start).map((range) => range.match)
      const text = node.data.slice(start, end)
      if (!active.length) { fragment.append(node.ownerDocument.createTextNode(text)); continue }
      const mark = node.ownerDocument.createElement('mark')
      mark.dataset.evidenceMatches = [...new Set(active)].join(' ')
      mark.textContent = text
      mark.style.cssText = 'color:inherit;background:rgb(250 204 21 / .4);border-radius:2px;padding:0;font:inherit;'
      fragment.append(mark)
    }
    node.replaceWith(fragment)
  }
  return { matches, hasText: Boolean(index.text.trim()) }
}

export function activateDocxEvidence(root: HTMLElement, active: number) {
  for (const mark of root.querySelectorAll<HTMLElement>('mark[data-evidence-matches]')) {
    const selected = (mark.dataset.evidenceMatches ?? '').split(' ').includes(String(active))
    mark.style.backgroundColor = selected ? 'rgb(251 146 60 / .5)' : 'rgb(250 204 21 / .4)'
  }
  return root.querySelector<HTMLElement>(`mark[data-evidence-matches~="${active}"]`)
}
