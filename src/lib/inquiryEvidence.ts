import type { QuoteResponse } from '../domain/app'

export interface DocumentEvidence { sourceType: 'Document'; documentName: string; exactText: string; sheetName?: string; cellRange?: string }
export interface EmailEvidence { sourceType: 'Email'; exactText: string }
export type InquiryEvidence = DocumentEvidence | EmailEvidence
type RecordValue = Record<string, unknown>
const object = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {}
const name = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase() : ''

export function documentEvidence(value: unknown): DocumentEvidence[] {
  const references = object(value).evidenceReferences
  if (!Array.isArray(references)) return []
  const seen = new Set<string>()
  return references.flatMap((value) => {
    const ref = object(value)
    if (name(ref.sourceType) !== 'document' || typeof ref.documentName !== 'string' || !ref.documentName.trim() || typeof ref.exactText !== 'string' || !ref.exactText.trim()) return []
    const sheetName = typeof ref.sheetName === 'string' ? ref.sheetName.trim() || undefined : undefined
    const cellRange = typeof ref.cellRange === 'string' ? ref.cellRange.trim() || undefined : undefined
    const key = JSON.stringify([name(ref.documentName), ref.exactText.trim(), name(sheetName), name(cellRange)])
    if (seen.has(key)) return []
    seen.add(key)
    return [{ sourceType: 'Document' as const, documentName: ref.documentName.trim(), exactText: ref.exactText.trim(), sheetName, cellRange }]
  })
}

export function inquiryEvidence(value: unknown): InquiryEvidence[] {
  const references = object(value).evidenceReferences
  const emails = new Set<string>()
  if (Array.isArray(references)) for (const value of references) {
    const ref = object(value)
    if (name(ref.sourceType) === 'email' && typeof ref.exactText === 'string' && ref.exactText.trim()) emails.add(ref.exactText)
  }
  return [...documentEvidence(value), ...Array.from(emails, (exactText): EmailEvidence => ({ sourceType: 'Email', exactText }))]
}

/** Read only the customer email sections, excluding appended extracted documents. */
export function customerEmail(value: string | undefined) {
  const text = value ?? ''
  // Section labels identify the email; decorative separator lines are optional.
  const heading = /^[\t \u00a0\ufeff]*(CUSTOMER[\t \u00a0]+EMAIL[\t \u00a0]+(?:SUBJECT|SENDER|(?:SENT|RECEIVED)(?:[\t \u00a0]+\(UTC\))?|BODY)|UPLOADED[\t \u00a0]+DOCUMENTS[\t \u00a0]*\/[\t \u00a0]*EXTRACTED[\t \u00a0]+CONTENT|DOCUMENT NAME:[^\r\n]*)(?:[\t \u00a0]*:[\t \u00a0]*([^\r\n]*))?[\t \u00a0]*\r?$/gim
  const sections = [...text.matchAll(heading)]
  const section = (label: string) => {
    const index = sections.findIndex((match) => match[1].trim().replace(/[\t \u00a0]+/g, ' ').toUpperCase() === label)
    if (index < 0) return undefined
    let start = sections[index].index! + sections[index][0].length
    const inline = sections[index][2]
    const following = text.slice(start)
    const separator = following.match(/^\r?\n(?:[\t \u00a0]*\r?\n)*[\t \u00a0]*[=-]{3,}[\t \u00a0]*(?:\r?\n|$)/)
    const newline = following.match(/^\r?\n/)
    start += separator?.[0].length ?? newline?.[0].length ?? 0
    let end = sections[index + 1]?.index ?? text.length
    // The next section can have a separator before its heading as well.
    const trailing = text.slice(start, end).match(/(?:\r?\n)[\t \u00a0]*[=-]{3,}[\t \u00a0]*(?:\r?\n[\t \u00a0]*)*$/)
    if (trailing) end = start + trailing.index!
    const content = text.slice(start, end)
    return inline ? inline + (content ? `\n${content}` : '') : content
  }
  return {
    subject: section('CUSTOMER EMAIL SUBJECT')?.trim() ?? '',
    body: section('CUSTOMER EMAIL BODY'),
    sentAt: (section('CUSTOMER EMAIL SENT (UTC)') ?? section('CUSTOMER EMAIL SENT'))?.trim() || undefined,
    receivedAt: (section('CUSTOMER EMAIL RECEIVED (UTC)') ?? section('CUSTOMER EMAIL RECEIVED'))?.trim() || undefined,
  }
}

/** Map complete citations to the original body's offsets, preserving its exact text. */
export function emailEvidenceMatches(body: string, passages: string[]) {
  return findIndexedEvidenceMatches([indexEvidenceText([body])], passages).flatMap((match) => {
    const start = match.ranges[0]?.start, end = match.ranges.at(-1)?.end
    return start === undefined || end === undefined ? [] : [{ evidenceIndex: match.evidenceIndex, start, end, exactText: body.slice(start, end) }]
  })
}

export function evidenceForResponse(json: string | undefined, response: QuoteResponse): InquiryEvidence[] {
  let parsed: unknown
  try { parsed = JSON.parse(json ?? '') } catch { return [] }
  const rules: RecordValue[] = []
  function visit(value: unknown, inRules = false) {
    if (Array.isArray(value)) { value.forEach((item) => visit(item, inRules)); return }
    const row = object(value)
    if (inRules && ('ruleName' in row || 'businessRuleId' in row || 'ruleId' in row)) rules.push(row)
    for (const [key, child] of Object.entries(row)) {
      if (child && typeof child === 'object') visit(child, inRules || key === 'businessRuleEvaluation' || key === 'memberBusinessRuleEvaluations')
    }
  }
  visit(parsed)
  const id = (value: unknown) => name(value).replace(/[{}]/g, '')
  const byId = response.businessRuleId ? rules.filter((row) => id(row.businessRuleId ?? row.ruleId) === id(response.businessRuleId)) : []
  const matches = byId.length ? byId : rules.filter((row) => {
    // A different explicit ID must never be rescued by a coincidentally equal name.
    if (response.businessRuleId && (row.businessRuleId || row.ruleId)) return false
    const ruleName = name(row.ruleName)
    return !!ruleName && [response.businessRuleName, response.name].some((value) => ruleName === name(value))
  })
  return inquiryEvidence({ evidenceReferences: matches.flatMap((row) => Array.isArray(row.evidenceReferences) ? row.evidenceReferences : []) })
}

function filename(value: string) {
  let path = value.split(/[?#]/)[0]
  try { path = decodeURIComponent(path) } catch { /* Keep a literal filename if it isn't URI encoded. */ }
  return path.split('/').pop()!.replace(/\.[^.]+$/, '').toLowerCase()
}

export function resolveEvidencePath(documentsUrl: string | undefined, documentName: string): string {
  const paths = [...new Set((documentsUrl ?? '').split(',').map((path) => path.trim()).filter(Boolean))]
  const matches = paths.filter((path) => filename(path) === filename(documentName))
  if (!matches.length) throw new Error(`The document “${documentName}” is not linked to this inquiry.`)
  if (matches.length > 1) throw new Error(`More than one linked file matches “${documentName}”. Please correct the inquiry's document links.`)
  return matches[0]
}

/** Convert a linked URL into the decoded File Path expected by the SharePoint action. */
export function normalizeEvidenceDocumentPath(value: string, siteUrl?: string): string {
  const assertVisible = (path: string) => {
    for (const char of path) {
      const code = char.codePointAt(0)!
      if (code < 32 || (code >= 127 && code <= 159) || (code >= 0x200b && code <= 0x200f) || code === 0x2060 || code === 0xfeff) {
        throw new Error(`The document path contains a hidden character (U+${code.toString(16).toUpperCase().padStart(4, '0')}). Correct the inquiry's document link.`)
      }
    }
    if (/%(?:0[0-9a-f]|1[0-9a-f]|7f|c2%(?:8[0-9a-f]|9[0-9a-f]))/i.test(path)) {
      throw new Error('The document path contains an encoded control character. Correct the inquiry\'s document link.')
    }
  }
  // Check before URL parsing, which can silently discard tabs and newlines.
  assertVisible(value)
  let path = value.trim()
  const absolute = /^https?:\/\//i.test(path)
  const serverRelative = /^\/(sites|teams)\//i.test(path)
  if (absolute || serverRelative) {
    if (!siteUrl) throw new Error('The SharePoint site URL is required to resolve this document link.')
    const site = new URL(siteUrl)
    if (absolute) {
      const file = new URL(path)
      if (file.protocol !== 'https:' || file.origin !== site.origin) throw new Error('The document link belongs to a different SharePoint site.')
      path = file.pathname
    }
    // Decode the path and site prefix once; preserve literal plus signs and percent characters.
    path = decodePath(path)
    const prefix = decodePath(site.pathname).replace(/\/+$/, '')
    if (prefix && !path.toLowerCase().startsWith(`${prefix.toLowerCase()}/`)) throw new Error('The document link belongs to a different SharePoint site.')
    path = path.slice(prefix.length)
  } else {
    path = decodePath(path)
  }
  assertVisible(path)
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || path.split('/').some((part) => part === '.' || part === '..')) {
    throw new Error('The document link must contain a site-relative SharePoint file path.')
  }
  // Repair only an exact repeated path, as in URL-to-file + /path-to-the-same-file.
  for (let boundary = path.indexOf('/', 1); boundary !== -1; boundary = path.indexOf('/', boundary + 1)) {
    if (path.slice(0, boundary) === path.slice(boundary)) {
      path = path.slice(boundary)
      break
    }
  }
  if (path === '/' || path.endsWith('/')) throw new Error('The document link must point to a file.')
  return path
}

function decodePath(value: string): string {
  return value.replace(/(?:%[\da-f]{2})+/gi, (encoded) => {
    try { return decodeURIComponent(encoded) } catch { throw new Error('The document link contains invalid URL encoding.') }
  })
}

export function evidenceOriginalUrl(siteUrl: string | undefined, path: string): string | undefined {
  if (!siteUrl) return undefined
  try {
    const site = new URL(siteUrl)
    path = normalizeEvidenceDocumentPath(path, siteUrl)
    const serverRelative = path.startsWith('/sites/') || path.startsWith('/teams/') || (site.pathname !== '/' && path.startsWith(`${site.pathname.replace(/\/+$/, '')}/`))
    const target = serverRelative ? new URL(path, site.origin) : new URL(path.replace(/^\/+/, ''), `${site.href.replace(/\/+$/, '')}/`)
    // Only link to the configured SharePoint origin.
    if (target.protocol !== 'https:' || target.origin !== site.origin) return undefined
    return target.href
  } catch { return undefined }
}

export interface TextPosition { item: number; offset: number; endOffset: number }
export interface EvidenceTextRange { item: number; start: number; end: number }
export interface PdfEvidenceTextItem { str: string; transform: number[]; width: number; height: number; dir?: string }
export interface PdfEvidenceMatch { evidenceIndex: number; ranges: EvidenceTextRange[] }

function normalizeEvidenceCharacter(char: string) {
  return char.normalize('NFKC').toLowerCase()
    .replace(/[\u00ad\u200b\ufeff]/g, '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\s/g, ' ')
}

export function indexEvidenceText(items: string[], order = items.map((_, index) => index), separators?: string[]) {
  let text = ''
  const positions: TextPosition[] = []
  order.forEach((index, sequence) => {
    const item = items[index]
    if (text && !text.endsWith(' ') && item && (separators?.[sequence] ?? ' ')) {
      text += ' '; positions.push({ item: index, offset: 0, endOffset: 0 })
    }
    let offset = 0
    for (const original of item) {
      // A ligature can expand into multiple characters. Each retains its source range.
      for (const char of normalizeEvidenceCharacter(original)) {
        if (char === ' ' && (!text || text.endsWith(' '))) continue
        text += char
        for (let unit = 0; unit < char.length; unit++) positions.push({ item: index, offset, endOffset: offset + original.length })
      }
      offset += original.length
    }
  })
  return { text, positions }
}

export function findEvidenceMatches(text: string, passages: string[]) {
  return passages.flatMap((passage, evidenceIndex) => {
    const query = indexEvidenceText([passage]).text.trim()
    const matches: Array<{ start: number; end: number; evidenceIndex: number }> = []
    if (!query) return matches
    let start = text.indexOf(query)
    while (start !== -1) {
      matches.push({ start, end: start + query.length, evidenceIndex })
      start = text.indexOf(query, start + query.length)
    }
    return matches
  }).sort((a, b) => a.start - b.start || a.evidenceIndex - b.evidenceIndex)
}

export function visualReadingOrder(items: PdfEvidenceTextItem[]) {
  const lines: Array<{ y: number; height: number; indices: number[] }> = []
  const byHeight = items.map((_, index) => index).filter((index) => items[index].str.trim())
    .sort((a, b) => items[b].transform[5] - items[a].transform[5] || items[a].transform[4] - items[b].transform[4])
  for (const index of byHeight) {
    const item = items[index]
    const y = item.transform[5], height = Math.max(item.height, 1)
    const line = lines.at(-1)
    if (line && Math.abs(line.y - y) <= Math.min(line.height, height) * .3) line.indices.push(index)
    else lines.push({ y, height, indices: [index] })
  }
  return lines.flatMap((line) => line.indices.sort((a, b) => items[a].dir === 'rtl' && items[b].dir === 'rtl'
    ? items[b].transform[4] - items[a].transform[4] : items[a].transform[4] - items[b].transform[4]))
}

function pdfTextIndex(items: PdfEvidenceTextItem[], order: number[]) {
  const separators = order.map((index, sequence) => {
    if (!sequence) return ''
    const previous = items[order[sequence - 1]], current = items[index]
    const sameLine = Math.abs(previous.transform[5] - current.transform[5]) <= Math.min(previous.height, current.height) * .3
    const gap = current.transform[4] - previous.transform[4] - previous.width
    // Adjacent font runs can split a word without a real space between them.
    return sameLine && gap >= -.5 && gap <= Math.max(.5, Math.min(previous.height, current.height) * .08) ? '' : ' '
  })
  return indexEvidenceText(items.map((item) => item.str), order, separators)
}

function evidenceTokens(text: string) {
  // Ignore sentence punctuation, but preserve numeric punctuation, currencies,
  // percentages, signs and every word (including negations).
  return [...text.matchAll(/[\p{L}\p{N}]+(?:[.,]\p{N}+)*|[^\s\p{L}\p{N}]/gu)]
    .filter((match) => !/^[.,;:!?()[\]{}"']$/.test(match[0]))
    .map((match) => ({ value: match[0], start: match.index!, end: match.index! + match[0].length }))
}

function rangesForMatch(positions: TextPosition[], start: number, end: number): EvidenceTextRange[] {
  const ranges: EvidenceTextRange[] = []
  for (const position of positions.slice(start, end)) {
    if (position.endOffset <= position.offset) continue
    const previous = ranges.at(-1)
    if (previous?.item === position.item && position.offset <= previous.end) previous.end = Math.max(previous.end, position.endOffset)
    else ranges.push({ item: position.item, start: position.offset, end: position.endOffset })
  }
  return ranges
}

/** Match a whole passage in extraction order or visual row order, mapping back to original PDF spans. */
export function findPdfEvidenceMatches(items: PdfEvidenceTextItem[], passages: string[]): PdfEvidenceMatch[] {
  const rawOrder = items.map((_, index) => index)
  const indexes = [pdfTextIndex(items, rawOrder), pdfTextIndex(items, visualReadingOrder(items))]
  return findIndexedEvidenceMatches(indexes, passages)
}

/** Match rendered text while retaining ranges in the original text nodes or PDF spans. */
export function findIndexedEvidenceMatches(indexes: ReturnType<typeof indexEvidenceText>[], passages: string[]): PdfEvidenceMatch[] {
  const results: PdfEvidenceMatch[] = []
  passages.forEach((passage, evidenceIndex) => {
    const seen = new Set<string>()
    const add = (index: ReturnType<typeof indexEvidenceText>, start: number, end: number) => {
      const ranges = rangesForMatch(index.positions, start, end)
      if (!ranges.length) return
      const key = JSON.stringify([...ranges].sort((a, b) => a.item - b.item || a.start - b.start))
      if (seen.has(key)) return
      seen.add(key)
      results.push({ evidenceIndex, ranges })
    }
    for (const index of indexes) {
      for (const match of findEvidenceMatches(index.text, [passage])) add(index, match.start, match.end)
    }
    if (seen.size) return
    // Sentence punctuation may differ in the AI JSON. Require the complete token
    // sequence; never highlight a loose subset such as an unrelated “None”.
    const query = evidenceTokens(indexEvidenceText([passage]).text)
    if (!query.length) return
    for (const index of indexes) {
      const tokens = evidenceTokens(index.text)
      for (let start = 0; start <= tokens.length - query.length; start++) {
        if (query.every((token, offset) => token.value === tokens[start + offset].value)) {
          add(index, tokens[start].start, tokens[start + query.length - 1].end)
        }
      }
    }
  })
  return results
}
