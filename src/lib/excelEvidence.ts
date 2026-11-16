import * as XLSX from 'xlsx'
import { findIndexedEvidenceMatches, indexEvidenceText, type DocumentEvidence } from './inquiryEvidence'
import { getPreparedEvidence, setPreparedEvidence } from './evidenceSessionCache'

export interface ExcelEvidenceCell { address: string; row: number; col: number; text: string; formula?: string; dateYear?: number; numericValue?: number }
export interface ExcelEvidenceSheet {
  name: string; index: number; hidden: boolean; cells: ExcelEvidenceCell[];
  byAddress: Map<string, ExcelEvidenceCell>; range: XLSX.Range; merges: XLSX.Range[];
  columns: XLSX.ColInfo[]; rows: XLSX.RowInfo[];
}
export interface ExcelEvidenceMatch {
  evidenceIndex: number; page: number; sheetIndex: number; locationLabel: string;
  cells: Array<{ address: string; row: number; col: number; start: number; end: number }>;
}
export const EXCEL_PREVIEW_ROWS = 100
export const EXCEL_PREVIEW_COLUMNS = 20

function validRange(range: XLSX.Range) {
  return [range.s.r, range.s.c, range.e.r, range.e.c].every(Number.isInteger)
    && range.s.r >= 0 && range.s.c >= 0 && range.e.r >= range.s.r && range.e.c >= range.s.c && range.e.r < 1048576 && range.e.c < 16384
}
const inside = (row: number, col: number, range: XLSX.Range) => row >= range.s.r && row <= range.e.r && col >= range.s.c && col <= range.e.c

export function readExcelEvidence(bytes: Uint8Array): ExcelEvidenceSheet[] {
  const cached = getPreparedEvidence<ExcelEvidenceSheet[]>(bytes, 'excel')
  if (cached) return cached
  const workbook = XLSX.read(bytes, { type: 'array', cellText: true, cellNF: true, cellStyles: true, cellHTML: false, bookVBA: false })
  if (!workbook.SheetNames.length) throw new Error('This file does not contain any worksheets.')
  const sheets = workbook.SheetNames.map((name, index) => {
    const source = workbook.Sheets[name]
    const merges = (source['!merges'] ?? []).filter(validRange)
    const cells: ExcelEvidenceCell[] = []
    for (const [address, raw] of Object.entries(source)) {
      if (!/^[A-Z]{1,3}[1-9]\d*$/.test(address)) continue
      if (!raw || typeof raw !== 'object') continue
      const point = XLSX.utils.decode_cell(address)
      if (point.r > 1048575 || point.c > 16383) continue
      const merge = merges.find((range) => inside(point.r, point.c, range))
      if (merge && (merge.s.r !== point.r || merge.s.c !== point.c)) continue
      const cell = raw as XLSX.CellObject
      // Excel formula results are read from the file's saved cache, never recalculated.
      const text = cell.v == null && cell.f ? `=${cell.f}` : cell.w ?? XLSX.utils.format_cell(cell)
      if (!text) continue
      // A short displayed year is not enough to infer the century. Retain the
      // actual year from date-formatted serials, respecting the workbook epoch.
      const date = cell.t === 'n' && typeof cell.v === 'number' && cell.z && XLSX.SSF.is_date(cell.z)
        ? XLSX.SSF.parse_date_code(cell.v, { date1904: Boolean(workbook.Workbook?.WBProps?.date1904) }) : null
      cells.push({ address, row: point.r, col: point.c, text, formula: cell.f, dateYear: date?.y,
        numericValue: !date && cell.t === 'n' && typeof cell.v === 'number' && Number.isFinite(cell.v) ? cell.v : undefined })
    }
    cells.sort((a, b) => a.row - b.row || a.col - b.col)
    const range: XLSX.Range = { s: { r: Infinity, c: Infinity }, e: { r: 0, c: 0 } }
    const include = (row: number, col: number) => {
      range.s.r = Math.min(range.s.r, row); range.s.c = Math.min(range.s.c, col)
      range.e.r = Math.max(range.e.r, row); range.e.c = Math.max(range.e.c, col)
    }
    for (const cell of cells) include(cell.row, cell.col)
    for (const merge of merges) { include(merge.s.r, merge.s.c); include(merge.e.r, merge.e.c) }
    if (!Number.isFinite(range.s.r)) { range.s.r = 0; range.s.c = 0 }
    return { name, index, hidden: Boolean(workbook.Workbook?.Sheets?.[index]?.Hidden), cells,
      byAddress: new Map(cells.map((cell) => [cell.address, cell])), range, merges,
      columns: source['!cols'] ?? [], rows: source['!rows'] ?? [] }
  })
  setPreparedEvidence(bytes, 'excel', sheets, sheets.reduce((sum, sheet) => sum + sheet.cells.reduce((size, cell) => size + cell.text.length * 2 + 160, 0), 0))
  return sheets
}

function evidenceScope(reference: Pick<DocumentEvidence, 'sheetName' | 'cellRange'>) {
  let sheetName = reference.sheetName
  let address = reference.cellRange
  if (address?.includes('!')) {
    const separator = address.lastIndexOf('!')
    const qualifiedSheet = address.slice(0, separator).replace(/^'(.*)'$/, '$1').replace(/''/g, "'")
    if (sheetName && sheetName.toLowerCase() !== qualifiedSheet.toLowerCase()) return { error: 'The sheet name and cell range refer to different sheets.' }
    sheetName = qualifiedSheet; address = address.slice(separator + 1)
  }
  if (!address) return { sheetName }
  if (!/^\$?[A-Z]{1,3}\$?[1-9]\d*(?::\$?[A-Z]{1,3}\$?[1-9]\d*)?$/i.test(address)) return { error: 'The evidence contains an invalid cell range.' }
  const range = XLSX.utils.decode_range(address.replace(/\$/g, '').toUpperCase())
  return validRange(range) ? { sheetName, range } : { error: 'The evidence contains an invalid cell range.' }
}

interface NumericDate { start: number; end: number; canonical: string; year: number; fullYear?: number }

/** Preserve component order: never guess whether an ambiguous date is D/M or M/D. */
function numericDates(text: string): NumericDate[] {
  return [...text.matchAll(/(?<![\p{L}\p{N}_./-])(\d{1,2})([/.-])(\d{1,2})\2(\d{4}|\d{2})(?![\p{L}\p{N}_/]|[.-]\d)/gu)].flatMap((match) => {
    const first = Number(match[1]), second = Number(match[3]), year = Number(match[4])
    const fullYear = match[4].length === 4 ? year : undefined
    const calendarYear = fullYear ?? 2000 + year
    const leap = calendarYear % 4 === 0 && (calendarYear % 100 !== 0 || calendarYear % 400 === 0)
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    const valid = (month: number, day: number) => month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
    if (fullYear === 0 || (!valid(first, second) && !valid(second, first))) return []
    return [{ start: match.index!, end: match.index! + match[0].length, year, fullYear,
      canonical: `${first}/${second}/${String(year % 100).padStart(2, '0')}` }]
  })
}

function cellDate(cell: ExcelEvidenceCell): NumericDate | undefined {
  const dates = numericDates(cell.text), date = dates[0]
  if (dates.length !== 1 || cell.text.slice(0, date.start).trim() || cell.text.slice(date.end).trim()) return undefined
  const fullYear = date.fullYear ?? (cell.dateYear !== undefined && cell.dateYear % 100 === date.year ? cell.dateYear : undefined)
  return { ...date, fullYear }
}

function dateFormattedMatches(cells: ExcelEvidenceCell[], dates: Array<NumericDate | undefined>, passage: string) {
  const queryDates = numericDates(passage)
  if (!queryDates.length || !dates.some(Boolean)) return []
  let offset = 0
  const parts: string[] = []
  for (const date of queryDates) {
    parts.push(passage.slice(offset, date.start), date.canonical); offset = date.end
  }
  parts.push(passage.slice(offset))
  const index = indexEvidenceText(cells.map((cell, i) => dates[i]?.canonical ?? cell.text))
  // Canonical dates can have different lengths. Every date character maps back
  // to the complete original date, rather than offsets in the longer AI text.
  index.positions = index.positions.map((position) => {
    const date = dates[position.item]
    return date && position.endOffset > position.offset ? { item: position.item, offset: date.start, endOffset: date.end } : position
  })
  return findIndexedEvidenceMatches([index], [parts.join('')]).filter((match) => {
    const matchedDates = [...new Set(match.ranges.map((range) => range.item))].map((item) => dates[item]).filter((date): date is NumericDate => !!date)
    // The short-year canonical form is only a search aid. Full years in the
    // evidence must agree with the stored century; text-only short years cannot
    // establish one. No locale pivot or current-year assumption is used.
    return matchedDates.length === queryDates.length
      && queryDates.every((date, i) => date.fullYear === undefined || date.fullYear === matchedDates[i].fullYear)
  })
}

/** Only unambiguous decimal/grouped amounts. Percentages, locale decimal commas,
 * units and scaled/rounded displays cannot silently become raw numeric values. */
function numericAmount(text: string) {
  let value = text.normalize('NFKC').replace(/\u2212/g, '-').trim()
  const accounting = value.startsWith('(') && value.endsWith(')')
  if (accounting) value = value.slice(1, -1).trim()
  const match = /^([+-]?)\s*(\p{Sc})?\s*([+-]?)\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*(\p{Sc})?$/u.exec(value)
  if (!match || (match[1] && match[3]) || (match[2] && match[5]) || (accounting && (match[1] || match[3]))) return undefined
  const [whole, fraction = ''] = match[4].replace(/,/g, '').split('.')
  const integer = whole.replace(/^0+(?=\d)/, ''), decimal = fraction.replace(/0+$/, '')
  const negative = accounting || (match[1] || match[3]) === '-'
  return { value: `${negative ? '-' : ''}${integer}${decimal ? `.${decimal}` : ''}`, currency: match[2] || match[5] }
}

/** Strip only valid thousands grouping, never decimal commas or identifiers. */
function withoutGroupingCommas(text: string) {
  return text.replace(/(?<![\p{L}\p{N}_,.])\d{1,3}(?:,\d{3})+(?:\.\d+)?(?![\p{L}\p{N}_]|[.,]\d)/gu, (amount) => amount.replace(/,/g, ''))
}

function commaFormattedMatches(cells: ExcelEvidenceCell[], passage: string) {
  const aliases = cells.map((cell) => {
    if (!cell.text.includes(',') || cell.dateYear !== undefined) return undefined
    const amount = numericAmount(cell.text)
    if (!amount || (cell.numericValue !== undefined && amount.value !== String(cell.numericValue))) return undefined
    const offsets: number[] = []
    let text = ''
    for (let offset = 0; offset < cell.text.length; offset++) {
      if (cell.text[offset] === ',') continue
      text += cell.text[offset]; offsets.push(offset)
    }
    return { text, offsets }
  })
  const query = withoutGroupingCommas(passage)
  if (!aliases.some(Boolean) && query === passage) return []
  const index = indexEvidenceText(cells.map((cell, item) => aliases[item]?.text ?? cell.text))
  index.positions = index.positions.map((position) => {
    const alias = aliases[position.item]
    return alias && position.endOffset > position.offset ? { item: position.item,
      offset: alias.offsets[position.offset], endOffset: alias.offsets[position.endOffset - 1] + 1 } : position
  })
  return findIndexedEvidenceMatches([index], [query]).flatMap((match) => {
    const ranges: typeof match.ranges = []
    for (const range of match.ranges) {
      const previous = ranges.at(-1)
      // Removed commas leave small gaps between the mapped digit groups.
      // Rejoin these ranges so the original separators are highlighted too.
      if (aliases[range.item] && previous?.item === range.item) previous.end = range.end
      else ranges.push({ ...range })
    }
    const complete = ranges.every((range) => {
      const cell = cells[range.item], text = cell.text
      const numeric = cell.numericValue !== undefined || !!numericAmount(text)
        || (text.trimEnd().endsWith('%') && !!numericAmount(text.trimEnd().slice(0, -1)))
      if (!aliases[range.item] && !numeric) return true
      // A removed separator must not turn a substring of an amount into evidence
      // or discard its sign, currency, precision or percent unit.
      return range.start === text.search(/\S/u) && range.end === text.trimEnd().length
    })
    return complete ? [{ ...match, ranges }] : []
  })
}

/** An AI row excerpt may use saved numeric values and omit an adjacent repeated
 * text field (e.g. Model and Model short form). Require every populated cell in
 * order, allowing only exact adjacent text duplicates, never skipped amounts. */
function rowFieldMatches(cells: ExcelEvidenceCell[], dates: Array<NumericDate | undefined>, passage: string) {
  const fragments = passage.split(/\r?\n/).map((part) => part.trim()).filter(Boolean)
  const results: ReturnType<typeof findIndexedEvidenceMatches> = []
  if (fragments.length < 4) return results
  const key = (text: string) => indexEvidenceText([text]).text.trim()
  const fields = fragments.map((text) => ({ key: key(text), amount: numericAmount(text), date: numericDates(text).find((date) => date.start === 0 && date.end === text.length) }))
  const source = cells.map((cell) => ({ key: key(cell.text), amount: cell.numericValue !== undefined ? numericAmount(cell.text) : undefined }))
  const accepts = (item: number, field: typeof fields[number]) => {
    if (source[item].key === field.key) return true
    const date = dates[item]
    if (date && field.date) return date.canonical === field.date.canonical && (field.date.fullYear === undefined || field.date.fullYear === date.fullYear)
    const amount = source[item].amount, query = field.amount
    // Use both the saved number and its full displayed value. This prevents a
    // rounded display, percentage or scaled format from changing the meaning.
    return !!amount && !!query && amount.value === String(cells[item].numericValue) && query.value === amount.value
      && (!query.currency || query.currency === amount.currency)
  }
  const anchors = cells.flatMap((_, item) => accepts(item, fields[0]) ? [item] : [])
  if (anchors.length > 200) return results
  for (const anchor of anchors) {
    const first = cells[anchor], chosen: number[] = []
    let field = 0
    for (let item = anchor; item < cells.length && cells[item].row === first.row && cells[item].col - first.col <= 31; item++) {
      if (accepts(item, fields[field])) {
        chosen.push(item); field++
        if (field === fields.length) {
          results.push({ evidenceIndex: 0, ranges: chosen.map((item) => ({ item, start: 0, end: cells[item].text.length })) })
          break
        }
      } else if (chosen.length && source[item].key === source[item - 1].key && /\p{L}/u.test(cells[item].text) && !dates[item] && cells[item].numericValue === undefined) {
        chosen.push(item)
      } else break
    }
  }
  return results
}

/** A multi-line excerpt can describe a rectangular form area rather than every
 * populated cell to the right of it. Infer that area only from unique, complete
 * fields in adjacent rows, then run the normal whole-passage matcher inside it.
 * Interior contradictory values are never skipped or matched as a bag of words. */
function fieldAreaMatches(cells: ExcelEvidenceCell[], dates: Array<NumericDate | undefined>, passage: string) {
  const fragments = passage.split(/\r?\n/).map((part) => part.trim()).filter(Boolean)
  const results: ReturnType<typeof findIndexedEvidenceMatches> = []
  if (fragments.length < 4) return results
  const textKey = (text: string) => JSON.stringify(['text', indexEvidenceText([text]).text.trim().replace(/:$/, '').trim()])
  const dateKey = (date: NumericDate, year?: number) => JSON.stringify(['date', date.canonical, year ?? null])
  const fields = new Map<string, Set<number>>()
  const add = (key: string, item: number) => { const values = fields.get(key) ?? new Set<number>(); values.add(item); fields.set(key, values) }
  cells.forEach((cell, item) => {
    add(textKey(cell.text), item)
    const date = dates[item]
    if (date) { add(dateKey(date), item); if (date.fullYear !== undefined) add(dateKey(date, date.fullYear), item) }
  })
  const candidates = fragments.map((fragment) => {
    const values = new Set(fields.get(textKey(fragment)))
    const date = numericDates(fragment)[0]
    if (date?.start === 0 && date.end === fragment.length) for (const item of fields.get(dateKey(date, date.fullYear)) ?? []) values.add(item)
    return [...values]
  })
  if (candidates.some((items) => !items.length) || candidates[0].length > 200) return results
  const seen = new Set<string>()
  for (const anchor of candidates[0]) {
    const first = cells[anchor]
    const nearby = candidates.map((items) => items.filter((item) => cells[item].row >= first.row && cells[item].row <= first.row + 1 && Math.abs(cells[item].col - first.col) <= 31))
    // Ambiguous repeated fields need a narrower sheet/cell reference.
    if (nearby.some((items) => items.length !== 1)) continue
    const chosen = nearby.map((items) => items[0])
    if (chosen.some((item, i) => i > 0 && item <= chosen[i - 1])) continue
    if (cells[chosen.at(-1)!].row !== first.row + 1) continue
    const minCol = Math.min(...chosen.map((item) => cells[item].col)), maxCol = Math.max(...chosen.map((item) => cells[item].col))
    if (maxCol - minCol > 31) continue
    const order = cells.flatMap((cell, item) => cell.row >= first.row && cell.row <= first.row + 1 && cell.col >= minCol && cell.col <= maxCol ? [item] : [])
    const area = order.map((item) => cells[item]), areaDates = order.map((item) => dates[item])
    const index = indexEvidenceText(area.map((cell) => cell.text))
    const found = [...findIndexedEvidenceMatches([index], [passage]), ...dateFormattedMatches(area, areaDates, passage)]
    for (const match of found) {
      const ranges = match.ranges.map((range) => ({ ...range, item: order[range.item] }))
      const included = new Set(ranges.map((range) => range.item))
      if (!chosen.every((item) => included.has(item))) continue
      const key = JSON.stringify(ranges)
      if (seen.has(key)) continue
      seen.add(key); results.push({ ...match, ranges })
    }
  }
  return results
}

/** Layout-aware fallback, not fuzzy word matching. All quoted fields must map
 * to complete cells in one compact rectangle, regardless of extraction order.
 * Blank rows and wrapped field names are layout, not missing evidence. */
function localFieldMatches(cells: ExcelEvidenceCell[], dates: Array<NumericDate | undefined>, passage: string) {
  const results: ReturnType<typeof findIndexedEvidenceMatches> = []
  const lines = passage.split(/[\r\n\t]+/).map((line) => line.trim()).filter(Boolean)
  if (lines.length < 3 || lines.length > 64) return results
  const key = (text: string) => indexEvidenceText([text]).text.trim().replace(/:$/, '').trim()
  const lookup = new Map<string, Set<number>>()
  const token = (kind: string, ...parts: unknown[]) => JSON.stringify([kind, ...parts])
  const add = (value: string, item: number) => { const values = lookup.get(value) ?? new Set<number>(); values.add(item); lookup.set(value, values) }
  const keys = cells.map((cell, item) => {
    const normalized = key(cell.text)
    add(token('text', normalized), item)
    const date = dates[item]
    if (date) {
      add(token('date', date.canonical, null), item)
      if (date.fullYear !== undefined) add(token('date', date.canonical, date.fullYear), item)
    }
    const amount = cell.numericValue !== undefined ? numericAmount(cell.text) : undefined
    if (amount && amount.value === String(cell.numericValue)) {
      add(token('amount', amount.value, null), item)
      if (amount.currency) add(token('amount', amount.value, amount.currency), item)
    }
    return normalized
  })
  const field = (text: string) => {
    const normalized = key(text), amount = numericAmount(text)
    const date = numericDates(text).find((date) => date.start === 0 && date.end === text.length)
    const items = new Set(lookup.get(token('text', normalized)))
    const alias = date ? token('date', date.canonical, date.fullYear ?? null)
      : amount ? token('amount', amount.value, amount.currency || null) : undefined
    if (alias) for (const item of lookup.get(alias) ?? []) items.add(item)
    return { key: normalized, items: [...items], textual: !date && /\p{L}/u.test(normalized) }
  }
  type Field = ReturnType<typeof field>
  // Reassemble at most four wrapped lines into a whole-cell field. Prefer the
  // longest complete fields and decline equally plausible segmentations.
  const paths: Field[][][] = Array.from({ length: lines.length + 1 }, () => [])
  paths[lines.length] = [[]]
  for (let start = lines.length - 1; start >= 0; start--) {
    let best = Infinity
    for (let end = start + 1; end <= Math.min(lines.length, start + 4); end++) {
      const part = field(lines.slice(start, end).join(' '))
      if (!part.items.length) continue
      for (const tail of paths[end]) {
        const candidate = [part, ...tail]
        if (candidate.length < best) { best = candidate.length; paths[start] = [] }
        if (candidate.length === best && paths[start].length < 2) paths[start].push(candidate)
      }
    }
  }
  if (paths[0].length !== 1) return results
  const fields = paths[0][0]
  if (fields.length < 3 || fields.filter((part) => part.textual).length < 2) return results
  const grouped = new Map<string, { field: Field; positions: number[] }>()
  fields.forEach((part, position) => {
    const group = grouped.get(part.key) ?? { field: part, positions: [] }
    group.positions.push(position); grouped.set(part.key, group)
  })
  const groups = [...grouped.values()]
  const anchorGroup = groups.filter((group) => group.field.textual).sort((a, b) => a.field.items.length - b.field.items.length)[0]
  if (anchorGroup.field.items.length > 200 || groups.reduce((sum, group) => sum + group.field.items.length, 0) > 10000) return results
  const seen = new Set<string>()
  let attempts = 0
  for (const anchor of anchorGroup.field.items) {
    const origin = cells[anchor]
    const nearby = groups.map((group) => group.field.items.filter((item) => Math.abs(cells[item].row - origin.row) <= 7 && Math.abs(cells[item].col - origin.col) <= 31))
    if (nearby.some((items) => !items.length)) continue
    const rows = [...new Set(nearby.flat().map((item) => cells[item].row))].sort((a, b) => a - b)
    for (const top of rows.filter((row) => row <= origin.row)) for (const bottom of rows.filter((row) => row >= origin.row && row - top <= 7)) {
      if (++attempts > 10000) return []
      const chosen = fields.map(() => [] as number[])
      let valid = true
      groups.forEach((group, groupIndex) => {
        const items = nearby[groupIndex].filter((item) => cells[item].row >= top && cells[item].row <= bottom)
        if (items.length === group.positions.length) group.positions.forEach((position, i) => { chosen[position] = [items[i]] })
        else if (group.positions.length === 1 && items.length > 1 && group.field.textual
          && items.every((item, i) => cells[item].numericValue === undefined && !dates[item] && keys[item] === keys[items[0]]
            && cells[item].row === cells[items[0]].row && (!i || item === items[i - 1] + 1))) chosen[group.positions[0]] = items
        else valid = false
      })
      if (!valid) continue
      const order = chosen.flat().sort((a, b) => a - b), selected = new Set(order)
      if (selected.size !== order.length || !selected.has(anchor)) continue
      const minRow = cells[order[0]].row, maxRow = cells[order.at(-1)!].row
      const minCol = Math.min(...order.map((item) => cells[item].col)), maxCol = Math.max(...order.map((item) => cells[item].col))
      if (minRow !== top || maxRow !== bottom || maxCol - minCol > 31) continue
      const area = { s: { r: minRow, c: minCol }, e: { r: maxRow, c: maxCol } }
      // A contradictory or unquoted interior field cannot disappear just
      // because the remaining words/amounts happen to occur nearby.
      if (cells.some((cell, item) => inside(cell.row, cell.col, area) && !selected.has(item))) continue
      const associated = (labels: number[], value: number) => labels.some((label) => {
        const a = cells[label], b = cells[value]
        if (a.row === b.row) return !cells.some((cell, item) => cell.row === a.row && cell.col > Math.min(a.col, b.col) && cell.col < Math.max(a.col, b.col) && !labels.includes(item))
        return a.col === b.col && !cells.some((cell) => cell.col === a.col && cell.row > Math.min(a.row, b.row) && cell.row < Math.max(a.row, b.row))
      })
      // Preserve explicit label/value pairs even when the pairs themselves
      // were reordered by AI extraction. Do not swap Premium and Tax amounts.
      if (fields.some((part, i) => i > 0 && !part.textual && fields[i - 1].textual && !chosen[i].every((item) => associated(chosen[i - 1], item)))) continue
      const identity = JSON.stringify(order)
      if (seen.has(identity)) continue
      seen.add(identity)
      results.push({ evidenceIndex: 0, ranges: order.map((item) => ({ item, start: 0, end: cells[item].text.length })) })
    }
  }
  return results
}

function validateExcelMatch(match: ReturnType<typeof findIndexedEvidenceMatches>[number], cells: ExcelEvidenceCell[], dates: Array<NumericDate | undefined>, passage: string) {
  // Even literal matches must include a complete date, never e.g. 1/26
  // from a cell showing 2/1/26.
  if (match.ranges.some((range) => dates[range.item] && (range.start > dates[range.item]!.start || range.end < dates[range.item]!.end))) return undefined
  const ranges = match.ranges.map((range) => ({ ...range, ...cells[range.item] }))
  const unique = [...new Map(ranges.map((range) => [range.address, range])).values()]
  const first = ranges[0], last = ranges.at(-1)
  if (!first || !last) return undefined
  // Blank layout rows do not break a passage, but distant or populated
  // intervening rows still cannot connect unrelated evidence.
  const minCol = Math.min(...unique.map((cell) => cell.col)), maxCol = Math.max(...unique.map((cell) => cell.col))
  const gaps = unique.flatMap((cell, i) => i > 0 && cell.row - unique[i - 1].row > 1 ? [{ previous: unique[i - 1], current: cell }] : [])
  if (gaps.some(({ previous, current }) => current.row - previous.row > 7
    || cells.some((between) => between.row > previous.row && between.row < current.row && between.col >= minCol && between.col <= maxCol))) return undefined
  const word = /[\p{L}\p{N}_]/u
  if (first.start > 0 && word.test(first.text[first.start - 1]) && word.test(first.text[first.start])) return undefined
  if (last.end < last.text.length && word.test(last.text[last.end]) && word.test(last.text[last.end - 1])) return undefined
  // A number-only reference must include the whole displayed value.
  if (unique.length === 1 && !dates[match.ranges[0].item] && /^[\p{Sc}\s+-]*\d[\d,.\s]*%?$/u.test(passage.trim())
    && indexEvidenceText([withoutGroupingCommas(first.text)]).text.trim() !== indexEvidenceText([withoutGroupingCommas(passage)]).text.trim()) return undefined
  return { ranges, unique, first, blankRows: gaps.length > 0 }
}

export function findExcelEvidenceMatches(sheets: ExcelEvidenceSheet[], references: Array<Pick<DocumentEvidence, 'exactText' | 'sheetName' | 'cellRange'>>) {
  const matches: ExcelEvidenceMatch[] = []
  const notes: Record<number, string> = {}
  references.forEach((reference, evidenceIndex) => {
    const scope = evidenceScope(reference)
    if (scope.error) { notes[evidenceIndex] = scope.error; return }
    const candidates = sheets.filter((sheet) => !scope.sheetName || sheet.name.toLowerCase() === scope.sheetName.toLowerCase())
    if (!candidates.length) { notes[evidenceIndex] = `The referenced sheet “${scope.sheetName}” was not found.`; return }
    for (const sheet of candidates) {
      const cells = sheet.cells.filter((cell) => !scope.range || inside(cell.row, cell.col, scope.range))
      const index = indexEvidenceText(cells.map((cell) => cell.text))
      const dates = cells.map(cellDate)
      const accept = (match: ReturnType<typeof findIndexedEvidenceMatches>[number]) => !!validateExcelMatch(match, cells, dates, reference.exactText)
      // Rejected literal occurrences must not suppress a valid local fallback.
      const found = [...findIndexedEvidenceMatches([index], [reference.exactText]), ...dateFormattedMatches(cells, dates, reference.exactText)].filter(accept)
      if (!found.length) {
        const grouped = commaFormattedMatches(cells, reference.exactText).filter(accept)
        if (grouped.length) { found.push(...grouped); notes[evidenceIndex] = 'Matched complete values ignoring thousands-separator commas.' }
      }
      if (!found.length) {
        const rows = rowFieldMatches(cells, dates, reference.exactText).filter(accept)
        if (rows.length) { found.push(...rows); notes[evidenceIndex] = 'Matched complete fields in one row; number formatting may differ.' }
      }
      if (!found.length) {
        const fields = fieldAreaMatches(cells, dates, reference.exactText).filter(accept)
        if (fields.length) { found.push(...fields); notes[evidenceIndex] = 'Matched fields within an area spanning adjacent rows.' }
      }
      if (!found.length) {
        const fields = localFieldMatches(cells, dates, reference.exactText).filter(accept)
        if (fields.length) { found.push(...fields); notes[evidenceIndex] = 'Field-based match: all quoted fields were found together; layout or field order may differ.' }
      }
      const seen = new Set<string>()
      for (const match of found) {
        const validated = validateExcelMatch(match, cells, dates, reference.exactText)
        if (!validated) continue
        const { ranges, unique, first, blankRows } = validated
        if (blankRows && !notes[evidenceIndex]) notes[evidenceIndex] = 'Matched text across blank layout rows.'
        const key = JSON.stringify(match.ranges)
        if (seen.has(key)) continue
        seen.add(key)
        const location = unique.length === 1 ? first.address : XLSX.utils.encode_range({
          s: { r: Math.min(...unique.map((cell) => cell.row)), c: Math.min(...unique.map((cell) => cell.col)) },
          e: { r: Math.max(...unique.map((cell) => cell.row)), c: Math.max(...unique.map((cell) => cell.col)) },
        })
        matches.push({ evidenceIndex, page: sheet.index + 1, sheetIndex: sheet.index, locationLabel: `${sheet.name} · ${location}`,
          cells: ranges.map((cell) => ({ address: cell.address, row: cell.row, col: cell.col, start: cell.start, end: cell.end })) })
      }
    }
  })
  return { matches, notes }
}

/** Render a bounded window even when Excel's used range includes a distant cell. */
export function excelEvidenceWindow(sheet: ExcelEvidenceSheet, rowStart: number, colStart: number) {
  const startRow = Math.max(sheet.range.s.r, Math.min(rowStart, sheet.range.e.r))
  const startCol = Math.max(sheet.range.s.c, Math.min(colStart, sheet.range.e.c))
  const endRow = Math.min(sheet.range.e.r, startRow + EXCEL_PREVIEW_ROWS - 1)
  const endCol = Math.min(sheet.range.e.c, startCol + EXCEL_PREVIEW_COLUMNS - 1)
  const covered = new Map<string, XLSX.Range>()
  for (const merge of sheet.merges) {
    if (merge.e.r < startRow || merge.s.r > endRow || merge.e.c < startCol || merge.s.c > endCol) continue
    for (let row = Math.max(startRow, merge.s.r); row <= Math.min(endRow, merge.e.r); row++) {
      for (let col = Math.max(startCol, merge.s.c); col <= Math.min(endCol, merge.e.c); col++) covered.set(`${row}:${col}`, merge)
    }
  }
  const columns = Array.from({ length: endCol - startCol + 1 }, (_, i) => {
    const col = startCol + i, source = sheet.columns[col]
    const width = source?.wpx ?? (source?.wch ? source.wch * 7 + 12 : 140)
    return { col, label: XLSX.utils.encode_col(col), width: Number.isFinite(width) ? Math.max(90, Math.min(width, 360)) : 140 }
  })
  const rows = Array.from({ length: endRow - startRow + 1 }, (_, i) => {
    const row = startRow + i
    const cells = columns.flatMap(({ col }) => {
      const merge = covered.get(`${row}:${col}`)
      if (merge && (row !== Math.max(startRow, merge.s.r) || col !== Math.max(startCol, merge.s.c))) return []
      const address = XLSX.utils.encode_cell(merge?.s ?? { r: row, c: col })
      const source = sheet.byAddress.get(address)
      return [{ address, row, col, text: source?.text ?? '', formula: source?.formula,
        rowSpan: merge ? Math.min(endRow, merge.e.r) - row + 1 : 1, colSpan: merge ? Math.min(endCol, merge.e.c) - col + 1 : 1 }]
    })
    const height = sheet.rows[row]?.hpx ?? 32
    return { row, height: Number.isFinite(height) ? Math.min(200, Math.max(28, height)) : 32, cells }
  })
  return { startRow, startCol, endRow, endCol, columns, rows }
}
