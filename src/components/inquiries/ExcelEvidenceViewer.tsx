import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react'
import { excelEvidenceWindow, findExcelEvidenceMatches, readExcelEvidence, EXCEL_PREVIEW_COLUMNS, EXCEL_PREVIEW_ROWS, type ExcelEvidenceMatch, type ExcelEvidenceSheet } from '../../lib/excelEvidence'
import type { DocumentEvidence } from '../../lib/inquiryEvidence'
import { EvidenceViewerLayout } from './EvidenceViewerLayout'
import { Button } from '../ui/Button'

function matchStart(match: ExcelEvidenceMatch) {
  return { row: Math.min(...match.cells.map((cell) => cell.row)), col: Math.min(...match.cells.map((cell) => cell.col)) }
}

export default function ExcelEvidenceViewer({ bytes, passages, references, sourceSelector, expanded, onToggleExpand }: {
  bytes: Uint8Array; passages: string[]; references?: DocumentEvidence[]; sourceSelector?: ReactNode; expanded?: boolean; onToggleExpand?: () => void
}) {
  const scope = useId()
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [sheets, setSheets] = useState<ExcelEvidenceSheet[]>([])
  const [matches, setMatches] = useState<ExcelEvidenceMatch[]>([])
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [active, setActive] = useState(0)
  const [sheetIndex, setSheetIndex] = useState(0)
  const [rowStart, setRowStart] = useState(0)
  const [colStart, setColStart] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const evidence = useMemo(() => references ?? passages.map((exactText) => ({ exactText })), [references, passages])

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(''); setSheets([]); setMatches([]); setNotes({}); setActive(0)
    void Promise.resolve().then(() => {
      if (cancelled) return
      const workbook = readExcelEvidence(bytes)
      const result = findExcelEvidenceMatches(workbook, evidence)
      const first = result.matches[0]
      const selected = first?.sheetIndex ?? Math.max(0, workbook.findIndex((sheet) => !sheet.hidden))
      const origin = first ? matchStart(first) : { row: workbook[selected].range.s.r, col: workbook[selected].range.s.c }
      if (cancelled) return
      setSheets(workbook); setMatches(result.matches); setNotes(result.notes); setSheetIndex(selected)
      setRowStart(Math.max(workbook[selected].range.s.r, origin.row - 5))
      setColStart(Math.max(workbook[selected].range.s.c, origin.col - 2))
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? `Unable to preview this Excel workbook: ${reason.message}` : 'Unable to preview this Excel workbook.')
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [bytes, evidence])

  const sheet = sheets[sheetIndex]
  const view = useMemo(() => sheet ? excelEvidenceWindow(sheet, rowStart, colStart) : null, [sheet, rowStart, colStart])
  const cellMatches = useMemo(() => {
    const result = new Map<string, Array<{ start: number; end: number; index: number }>>()
    matches.forEach((match, index) => {
      if (match.sheetIndex !== sheetIndex) return
      match.cells.forEach((cell) => {
        const ranges = result.get(cell.address) ?? []
        ranges.push({ start: cell.start, end: cell.end, index }); result.set(cell.address, ranges)
      })
    })
    return result
  }, [matches, sheetIndex])

  useEffect(() => {
    const match = matches[active], scroll = scrollRef.current
    if (!match || match.sheetIndex !== sheetIndex || !scroll) return
    const element = contentRef.current?.querySelector<HTMLElement>(`[data-cell-address="${match.cells[0].address}"]`)
    if (!element) return
    const box = element.getBoundingClientRect(), viewport = scroll.getBoundingClientRect()
    scroll.scrollTo({ top: scroll.scrollTop + box.top - viewport.top - 48,
      left: box.left < viewport.left + 48 || box.right > viewport.right - 16 ? scroll.scrollLeft + box.left - viewport.left - 64 : scroll.scrollLeft })
  }, [active, matches, sheetIndex, rowStart, colStart, zoom])

  function changeSheet(index: number) {
    if (!sheets[index]) return
    setSheetIndex(index); setRowStart(sheets[index].range.s.r); setColStart(sheets[index].range.s.c)
    scrollRef.current?.scrollTo({ top: 0, left: 0 })
  }
  function jump(index: number) {
    const match = matches[index]
    if (!match) return
    const origin = matchStart(match)
    setActive(index); setSheetIndex(match.sheetIndex)
    setRowStart(Math.max(sheets[match.sheetIndex].range.s.r, origin.row - 5))
    setColStart(Math.max(sheets[match.sheetIndex].range.s.c, origin.col - 2))
  }
  function cellText(address: string, text: string) {
    const ranges = cellMatches.get(address)
    if (!ranges?.length) return text
    const cuts = [...new Set([0, text.length, ...ranges.flatMap((range) => [range.start, range.end])])].sort((a, b) => a - b)
    return cuts.slice(0, -1).map((start, index) => {
      const end = cuts[index + 1], selected = ranges.filter((range) => range.start < end && range.end > start)
      const value = text.slice(start, end)
      return selected.length ? <mark key={start} className="rounded-sm p-0 text-inherit" style={{ background: selected.some((range) => range.index === active) ? 'rgb(251 146 60 / .5)' : 'rgb(250 204 21 / .4)' }}>{value}</mark> : value
    })
  }

  const sheetControls = sheet && view ? <div className="shrink-0 border-b border-border-soft bg-surface">
    <div role="tablist" aria-label="Workbook sheets" className="flex overflow-x-auto px-3 pt-1">{sheets.map((item, index) => <button key={item.name} type="button" role="tab" id={`${scope}-sheet-${index}`} aria-controls={`${scope}-sheet-panel`} aria-selected={sheetIndex === index} tabIndex={sheetIndex === index ? 0 : -1} data-sheet-index={index} onClick={() => changeSheet(index)} onKeyDown={(event) => {
      const next = event.key === 'ArrowRight' ? (index + 1) % sheets.length : event.key === 'ArrowLeft' ? (index - 1 + sheets.length) % sheets.length : event.key === 'Home' ? 0 : event.key === 'End' ? sheets.length - 1 : null
      if (next === null) return
      event.preventDefault(); changeSheet(next)
      event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-sheet-index="${next}"]`)?.focus()
    }} className={`shrink-0 border-b-2 px-4 py-3 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-300 ${sheetIndex === index ? 'border-violet-500 text-violet-600' : 'border-transparent text-muted-foreground hover:bg-surface-soft'}`}>{item.name}{item.hidden ? <span className="ml-1 text-[10px] opacity-70">(hidden)</span> : null}</button>)}</div>
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-soft px-4 py-1.5 text-[10px] text-muted-foreground">
      <div className="flex items-center gap-1"><Button type="button" variant="ghost" size="icon" className="h-6 w-6 rounded-md" aria-label="Previous worksheet rows" disabled={view.startRow <= sheet.range.s.r} onClick={() => setRowStart(Math.max(sheet.range.s.r, view.startRow - EXCEL_PREVIEW_ROWS))}><ChevronUp className="h-3 w-3" /></Button><span className="tabular-nums">Rows {view.startRow + 1}–{view.endRow + 1}</span><Button type="button" variant="ghost" size="icon" className="h-6 w-6 rounded-md" aria-label="Next worksheet rows" disabled={view.endRow >= sheet.range.e.r} onClick={() => setRowStart(view.startRow + EXCEL_PREVIEW_ROWS)}><ChevronDown className="h-3 w-3" /></Button></div>
      <div className="flex items-center gap-1"><Button type="button" variant="ghost" size="icon" className="h-6 w-6 rounded-md" aria-label="Previous worksheet columns" disabled={view.startCol <= sheet.range.s.c} onClick={() => setColStart(Math.max(sheet.range.s.c, view.startCol - EXCEL_PREVIEW_COLUMNS))}><ChevronLeft className="h-3 w-3" /></Button><span>Columns {view.columns[0].label}–{view.columns[view.columns.length - 1].label}</span><Button type="button" variant="ghost" size="icon" className="h-6 w-6 rounded-md" aria-label="Next worksheet columns" disabled={view.endCol >= sheet.range.e.c} onClick={() => setColStart(view.startCol + EXCEL_PREVIEW_COLUMNS)}><ChevronRight className="h-3 w-3" /></Button></div>
      <span>Saved values · Formulas are not recalculated</span>
    </div>
  </div> : null

  return <EvidenceViewerLayout passages={passages} matches={matches} active={active} page={sheetIndex + 1} pageCount={sheets.length} zoom={zoom} loading={loading} error={error}
    emptyMessage="The complete evidence text was not found in the workbook's displayed values. Check the wording and any sheet or cell references."
    sourceSelector={sourceSelector} expanded={expanded} onToggleExpand={onToggleExpand} onPage={(number) => changeSheet(number - 1)} onZoom={setZoom} onMatch={jump} formatLabel="Excel preview" unitLabel="Sheet" beforeDocument={sheetControls} passageNotes={notes} scrollRef={scrollRef}>
    <div ref={contentRef} role="tabpanel" id={`${scope}-sheet-panel`} aria-labelledby={`${scope}-sheet-${sheetIndex}`} style={{ zoom, width: 'max-content', minWidth: `${100 / zoom}%` }}>
      {sheet && view ? <table role="grid" aria-readonly="true" aria-label={`${sheet.name} worksheet`} className="border-separate border-spacing-0 bg-white text-xs text-slate-800 shadow-sm">
        <colgroup><col style={{ width: 48 }} />{view.columns.map((column) => <col key={column.col} style={{ width: column.width, minWidth: column.width }} />)}</colgroup>
        <thead><tr><th className="sticky left-0 top-0 z-[3] min-w-12 border border-slate-200 bg-slate-100" aria-label="Row numbers" />{view.columns.map((column) => <th key={column.col} scope="col" className="sticky top-0 z-[2] border-y border-r border-slate-200 bg-slate-100 px-3 py-2 text-center text-[10px] font-medium text-slate-500">{column.label}</th>)}</tr></thead>
        <tbody>{view.rows.map((row) => <tr key={row.row} style={{ height: row.height }}><th scope="row" className="sticky left-0 z-[1] border-b border-x border-slate-200 bg-slate-100 px-2 text-center text-[10px] font-medium text-slate-500">{row.row + 1}</th>{row.cells.map((cell) => <td key={`${cell.row}:${cell.col}`} data-cell-address={cell.address} aria-label={`${cell.address}: ${cell.text}`} rowSpan={cell.rowSpan} colSpan={cell.colSpan} title={`${cell.address}${cell.formula ? ` · Formula: =${cell.formula}` : ''}`} className={`max-w-[720px] whitespace-pre-wrap border-b border-r border-slate-200 px-3 py-2 align-top leading-5 [overflow-wrap:anywhere] ${cellMatches.get(cell.address)?.some((range) => range.index === active) ? 'bg-violet-50/50 ring-1 ring-inset ring-violet-300' : ''}`}>{cellText(cell.address, cell.text)}</td>)}</tr>)}</tbody>
      </table> : null}
    </div>
  </EvidenceViewerLayout>
}
