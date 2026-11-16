import { useState, type ReactNode, type RefObject } from 'react'
import { ArrowRight, Check, ChevronLeft, ChevronRight, Highlighter, Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen, Sparkles, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '../ui/Button'

export interface EvidenceViewerMatch { evidenceIndex: number; page: number; locationLabel?: string }
export interface EvidenceViewerLayoutProps {
  passages: string[]; matches: EvidenceViewerMatch[]; active: number;
  page: number; pageCount: number; zoom: number; loading: boolean; rendering?: boolean;
  error?: string; emptyMessage: string; sourceSelector?: ReactNode; expanded?: boolean;
  onToggleExpand?: () => void; onPage: (page: number) => void; onZoom: (zoom: number) => void;
  onMatch: (index: number) => void; formatLabel: string; children: ReactNode;
  scrollRef: RefObject<HTMLDivElement | null>;
  unitLabel?: 'Page' | 'Sheet' | 'Image' | 'Slide'; beforeDocument?: ReactNode; passageNotes?: Record<number, string>; loadingLabel?: string;
  minZoom?: number; maxZoom?: number; zoomStep?: number;
}

export function EvidenceViewerLayout({ passages, matches, active, page, pageCount, zoom, loading, rendering, error, emptyMessage, sourceSelector, expanded, onToggleExpand, onPage, onZoom, onMatch, formatLabel, children, scrollRef, unitLabel = 'Page', beforeDocument, passageNotes, loadingLabel, minZoom = .5, maxZoom = 3, zoomStep = .25 }: EvidenceViewerLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const previousPageLabel = unitLabel === 'Sheet' ? 'Previous worksheet' : unitLabel === 'Slide' ? 'Previous slide' : 'Previous document page'
  const nextPageLabel = unitLabel === 'Sheet' ? 'Next worksheet' : unitLabel === 'Slide' ? 'Next slide' : 'Next document page'
  return <div className="flex min-h-0 flex-1 flex-col md:flex-row">
    {sidebarOpen ? <aside aria-label="Evidence passages" className="max-h-[38vh] min-w-0 shrink-0 overflow-x-hidden overflow-y-auto border-b border-border-soft bg-surface md:max-h-none md:w-[300px] md:border-b-0 md:border-r xl:w-[328px]">
      <div className="p-5 pb-0">{sourceSelector}</div>
      <div className="space-y-5 p-5 pt-6">
        <div><div className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-violet-500" /><h3 className="flex-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Evidence passages</h3><span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-soft px-1 text-[10px] tabular-nums text-muted-foreground">{passages.length}</span></div><p className="mt-3 text-[11px] leading-6 text-muted-foreground">Select a passage to locate its words in the document.</p></div>
        <div className="space-y-3">{passages.map((passage, index) => {
          const first = matches.findIndex((match) => match.evidenceIndex === index)
          const selected = first >= 0 && matches[active]?.evidenceIndex === index
          return <button key={index} type="button" aria-pressed={selected} disabled={loading || first < 0} onClick={() => onMatch(first)} className={`block w-full rounded-[22px] border p-3.5 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-violet-400 disabled:opacity-70 ${selected ? 'border-violet-300 bg-violet-50/60' : 'border-border-soft hover:border-violet-300'}`}>
            <span className="flex items-center gap-2"><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${selected ? 'bg-violet-500 text-white' : 'bg-surface-soft text-muted-foreground'}`}>{String(index + 1).padStart(2, '0')}</span><span className="flex-1 text-[11px] font-medium">Passage {index + 1}</span>{first >= 0 ? <span title={matches[first].locationLabel} className="flex max-w-[135px] items-center gap-1 text-[10px] text-emerald-600"><Check className="h-3 w-3 shrink-0" /><span className="truncate">{matches[first].locationLabel || `${unitLabel} ${matches[first].page}`}</span></span> : <span className="text-[10px] text-muted-foreground">{loading ? 'Searching' : 'Not matched'}</span>}</span>
            <span className="mt-3 block whitespace-pre-wrap text-xs leading-7 text-muted-foreground [overflow-wrap:anywhere]">{passage}</span>
            {passageNotes?.[index] ? <span className="mt-2 block text-[11px] leading-5 text-warning">{passageNotes[index]}</span> : null}
            <span className="mt-4 flex items-center gap-1.5 border-t border-violet-100 pt-3 text-[11px] font-medium text-violet-500">{first >= 0 ? 'Locate in document' : 'No complete match'}<ArrowRight className="h-3 w-3" /></span>
          </button>
        })}</div>
        {!loading && !matches.length && !error ? <p className="text-xs leading-6 text-muted-foreground">{emptyMessage}</p> : null}
        <div className="flex gap-2 rounded-2xl bg-surface-soft/70 p-3.5"><Highlighter className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" /><p className="text-[10px] leading-6 text-muted-foreground">Matched source text is highlighted. Your original document is never changed.</p></div>
      </div>
    </aside> : null}
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div aria-label={`${formatLabel} controls`} className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border-soft px-3 py-2 sm:px-5">
        <div className="flex items-center gap-2 sm:gap-3"><Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg" aria-label={sidebarOpen ? 'Hide evidence sidebar' : 'Show evidence sidebar'} aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(!sidebarOpen)}>{sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}</Button><div className="flex h-10 items-center gap-1 rounded-xl border border-border-soft px-1"><Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg" aria-label={previousPageLabel} disabled={!pageCount || page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft className="h-3.5 w-3.5" /></Button><span className="min-w-14 text-center text-[11px] tabular-nums">{unitLabel === 'Sheet' || unitLabel === 'Slide' ? `${unitLabel} ` : ''}{page} / {pageCount || '…'}</span><Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg" aria-label={nextPageLabel} disabled={!pageCount || page >= pageCount} onClick={() => onPage(page + 1)}><ChevronRight className="h-3.5 w-3.5" /></Button></div></div>
        <div className="flex items-center gap-2"><div className="flex h-10 items-center gap-1 rounded-xl border border-border-soft px-1"><Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg" aria-label="Zoom out" disabled={zoom <= minZoom} onClick={() => onZoom(Math.max(minZoom, Math.round((zoom - zoomStep) * 100) / 100))}><ZoomOut className="h-4 w-4" /></Button><span className="w-10 text-center text-[10px] tabular-nums">{Math.round(zoom * 100)}%</span><Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg" aria-label="Zoom in" disabled={zoom >= maxZoom} onClick={() => onZoom(Math.min(maxZoom, Math.round((zoom + zoomStep) * 100) / 100))}><ZoomIn className="h-4 w-4" /></Button></div>{onToggleExpand ? <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg" aria-label={expanded ? 'Restore workspace size' : 'Expand workspace'} aria-pressed={expanded} onClick={onToggleExpand}>{expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</Button> : null}</div>
      </div>
      <div className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border-soft bg-violet-50/50 px-5 py-2"><p role="status" className="flex items-center gap-2 text-[11px] text-muted-foreground"><Highlighter className="h-4 w-4 text-violet-500" />{loading ? 'Finding evidence…' : `${matches.length} text ${matches.length === 1 ? 'match' : 'matches'} found`}</p><div className="flex items-center gap-1"><span className="mr-2 text-[10px] tabular-nums text-muted-foreground">{matches.length ? `${active + 1} of ${matches.length}` : '0 of 0'}</span><Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg" aria-label="Previous evidence match" disabled={matches.length < 2} onClick={() => onMatch((active - 1 + matches.length) % matches.length)}><ChevronLeft className="h-3.5 w-3.5" /></Button><Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg" aria-label="Next evidence match" disabled={matches.length < 2} onClick={() => onMatch((active + 1) % matches.length)}><ChevronRight className="h-3.5 w-3.5" /></Button></div></div>
      {beforeDocument}
      <div className="relative flex min-h-0 flex-1 flex-col">
        {loading || rendering ? <p role="status" className="pointer-events-none absolute right-5 top-3 z-10 rounded-lg border border-border-soft bg-surface px-3 py-2 text-[11px] text-muted-foreground shadow-sm">{loadingLabel || (loading ? 'Loading document…' : 'Rendering page…')}</p> : null}
        <div ref={scrollRef} aria-label={`${formatLabel} document`} aria-busy={loading || rendering} tabIndex={0} className="min-h-0 min-w-0 flex-1 overflow-auto bg-[#f3f6fb] p-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-300 dark:bg-slate-900 sm:p-7" style={{ backgroundImage: 'radial-gradient(circle, rgb(148 163 184 / .19) 1px, transparent 1px)', backgroundSize: '16px 16px' }}>
          {error ? <p role="alert" className="mb-3 rounded-lg bg-surface p-3 text-sm text-danger">{error}</p> : null}
          {children}
        </div>
        </div>
      <footer className="flex h-9 shrink-0 items-center justify-between gap-3 border-t border-border-soft px-4 text-[10px] text-muted-foreground"><span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-violet-500" />Read-only source document</span><span>{formatLabel}{pageCount ? ` · ${pageCount} ${unitLabel.toLowerCase()}${pageCount === 1 ? '' : 's'}` : ''}</span></footer>
    </div>
  </div>
}
