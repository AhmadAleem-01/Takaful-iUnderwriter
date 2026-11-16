import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ArrowRight, Check, ChevronLeft, ChevronRight, Clock3, ExternalLink, FileSearch, FileText, Highlighter, LoaderCircle, Mail, Maximize2, Minimize2, Quote, RefreshCw, ShieldCheck, Sparkles, X } from 'lucide-react'
import type { InquiryDetail, QuoteResponse } from '../../domain/app'
import { customerEmail, emailEvidenceMatches, evidenceForResponse, evidenceOriginalUrl, resolveEvidencePath, type DocumentEvidence, type InquiryEvidence } from '../../lib/inquiryEvidence'
import { getInquiryEvidenceDocument } from '../../services/inquiryEvidenceService'
import { getSharePointSiteUrl } from '../../services/sharePointSiteService'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'

const PdfEvidenceViewer = lazy(() => import('./PdfEvidenceViewer'))
const DocxEvidenceViewer = lazy(() => import('./DocxEvidenceViewer'))
const ExcelEvidenceViewer = lazy(() => import('./ExcelEvidenceViewer'))
const ImageEvidenceViewer = lazy(() => import('./ImageEvidenceViewer'))
const PptxEvidenceViewer = lazy(() => import('./PptxEvidenceViewer'))

export function InquiryEvidenceFileNames({ inquiry, response }: { inquiry: InquiryDetail; response: QuoteResponse }) {
  const names = useMemo(() => {
    const documents = evidenceForResponse(inquiry.aiEvaluationJsonResponse, response)
      .filter((ref): ref is DocumentEvidence => ref.sourceType === 'Document')
    return [...new Map(documents.map((ref) => [ref.documentName.toLowerCase(), ref.documentName])).values()]
  }, [inquiry.aiEvaluationJsonResponse, response])
  if (!names.length) return null
  return <ul aria-label="Evidence source files" className="min-w-0 space-y-1.5">
    {names.map((name) => <li key={name} title={name} className="flex w-full min-w-0 max-w-full items-center gap-2 rounded-lg border border-secondary/10 bg-secondary/[0.04] px-2.5 py-2 text-[11px] text-muted-foreground">
      <FileText aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-secondary" /><span className="min-w-0 flex-1 truncate">{name}</span>
    </li>)}
  </ul>
}

export function InquiryEvidenceButton({ inquiry, response, references, siteUrl, ruleName }: {
  inquiry: InquiryDetail; response?: QuoteResponse; references?: InquiryEvidence[]; siteUrl?: string; ruleName?: string
}) {
  const refs = useMemo(() => references ?? (response ? evidenceForResponse(inquiry.aiEvaluationJsonResponse, response) : []), [references, response, inquiry.aiEvaluationJsonResponse])
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const heading = response?.businessRuleName?.trim() || response?.name?.trim() || ruleName?.trim()
  if (!refs.length) return null
  return <Dialog.Root open={open} onOpenChange={(value) => { setOpen(value); if (!value) setExpanded(false) }}>
    <Dialog.Trigger asChild><Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 rounded-lg px-2 text-primary" aria-label={`View ${refs.every((ref) => ref.sourceType === 'Document') ? 'document' : refs.every((ref) => ref.sourceType === 'Email') ? 'email' : 'source'} evidence for ${heading || 'this rule'}`} title="View highlighted source evidence"><FileText aria-hidden="true" className="h-4 w-4" /><span className="text-[11px]">Evidence</span></Button></Dialog.Trigger>
    {open ? <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[110] bg-slate-950/60 backdrop-blur-sm" />
      <Dialog.Content className={`fixed z-[111] flex flex-col overflow-hidden rounded-2xl border border-border bg-surface text-foreground shadow-2xl outline-none ${expanded ? 'inset-3' : 'left-1/2 top-1/2 h-[calc(100dvh-32px)] max-h-[900px] w-[calc(100vw-24px)] max-w-[1440px] -translate-x-1/2 -translate-y-1/2 sm:h-[calc(100dvh-80px)] sm:w-[calc(100vw-64px)]'}`}>
        <EvidenceSources inquiry={inquiry} references={refs} siteUrl={siteUrl} heading={heading} expanded={expanded} onToggleExpand={() => setExpanded((value) => !value)} />
      </Dialog.Content>
    </Dialog.Portal> : null}
  </Dialog.Root>
}

function EvidenceSources({ inquiry, references, siteUrl, heading, expanded, onToggleExpand }: { inquiry: InquiryDetail; references: InquiryEvidence[]; siteUrl?: string; heading?: string; expanded: boolean; onToggleExpand: () => void }) {
  const documents = references.filter((ref): ref is DocumentEvidence => ref.sourceType === 'Document')
  const emails = references.filter((ref) => ref.sourceType === 'Email')
  const [source, setSource] = useState(documents.length ? 'document' : 'email')
  const switchRef = useRef<HTMLDivElement>(null)
  const restoreSwitchFocus = useRef(false)
  useEffect(() => {
    if (!restoreSwitchFocus.current) return
    switchRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus()
    restoreSwitchFocus.current = false
  }, [source])
  const sourceControl = documents.length && emails.length ? <div ref={switchRef} role="group" aria-label="Evidence source type" className="inline-flex max-w-full flex-wrap gap-1 rounded-lg border border-border-soft bg-surface-soft/60 p-0.5">
    {[{ value: 'document', label: 'Documents', Icon: FileText }, { value: 'email', label: 'Customer email', Icon: Mail }].map(({ value, label, Icon }) => <button key={value} type="button" aria-pressed={source === value} onClick={() => {
      if (source === value) return
      restoreSwitchFocus.current = true; setSource(value)
    }} className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-violet-400 ${source === value ? 'bg-surface text-violet-600 shadow-sm' : 'text-muted-foreground hover:bg-surface/70 hover:text-foreground'}`}><Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />{label}</button>)}
  </div> : undefined
  return source === 'email' ? <EmailEvidenceDocument customerData={inquiry.customerData} passages={emails.map((ref) => ref.exactText)} heading={heading} sourceControl={sourceControl} expanded={expanded} onToggleExpand={onToggleExpand} /> : <EvidenceDocument inquiry={inquiry} references={documents} siteUrl={siteUrl} heading={heading} sourceControl={sourceControl} expanded={expanded} onToggleExpand={onToggleExpand} />
}

// Compact email-export spacing for display without changing the stored source.
function compactEmailText(value: string) {
  return value.replace(/\r\n?/g, '\n').replace(/^[\t \u00a0]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim()
}

export function EmailEvidenceDocument({ customerData, passages, heading, sourceControl, expanded, onToggleExpand }: { customerData?: string; passages: string[]; heading?: string; sourceControl?: ReactNode; expanded?: boolean; onToggleExpand?: () => void }) {
  const email = useMemo(() => customerEmail(customerData), [customerData])
  const body = useMemo(() => compactEmailText(email.body ?? ''), [email.body])
  const matches = useMemo(() => emailEvidenceMatches(body, passages), [body, passages])
  const [active, setActive] = useState(0)
  const content = useRef<HTMLDivElement>(null)
  useEffect(() => {
    content.current?.querySelector<HTMLElement>(`[data-email-match~="${active}"]`)?.scrollIntoView?.({ block: 'center' })
  }, [active, matches])
  const timestamp = email.sentAt || email.receivedAt
  const date = timestamp ? new Date(timestamp) : undefined
  const validDate = date && Number.isFinite(date.getTime())
  const dateLabel = validDate ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short', hour12: false }).format(date) : timestamp
  const emailDate = timestamp ? <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground"><Clock3 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /><span>{email.sentAt ? 'Sent' : 'Received'} <time dateTime={validDate ? date.toISOString() : undefined}>{dateLabel}</time></span></p> : null
  const cuts = [...new Set([0, body.length, ...matches.flatMap((match) => [match.start, match.end])])].sort((a, b) => a - b)
  return <>
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border-soft bg-gradient-to-r from-violet-500/[0.06] via-surface to-surface px-5 py-5 sm:px-7">
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-violet-500/15 bg-violet-500/10 text-violet-500 sm:flex"><Mail className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2.5"><Dialog.Title title={heading} className="line-clamp-2 max-w-full text-base font-semibold tracking-tight [overflow-wrap:anywhere]">{heading || 'Customer email evidence'}</Dialog.Title><span className="inline-flex items-center gap-1 rounded-full border border-violet-500/15 bg-violet-500/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-violet-500"><Sparkles className="h-3 w-3" />AI source</span></div><Dialog.Description className="mt-1.5 text-xs text-muted-foreground">Review the original email and the passages supporting this response.</Dialog.Description>{sourceControl ? <div className="mt-3">{sourceControl}</div> : null}</div>
      </div>
      <div className="flex shrink-0 gap-1">
        {onToggleExpand ? <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-xl" aria-label={expanded ? 'Restore workspace size' : 'Expand workspace'} aria-pressed={expanded} onClick={onToggleExpand}>{expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</Button> : null}
        <Dialog.Close asChild><Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-xl" aria-label="Close evidence workspace"><X className="h-4 w-4" /></Button></Dialog.Close>
      </div>
    </header>
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <aside aria-label="Email evidence passages" className="max-h-[35vh] shrink-0 space-y-5 overflow-y-auto border-b border-border-soft bg-surface p-5 md:max-h-none md:w-[300px] md:border-b-0 md:border-r xl:w-[328px]">
        <div className="rounded-2xl border border-violet-500/15 bg-violet-500/[0.04] p-4"><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-violet-500"><Mail className="h-3.5 w-3.5" />Customer email</div><p className="mt-2.5 break-words text-xs font-semibold leading-6">{email.subject || 'No customer email subject captured'}</p>{emailDate}</div>
        <div><div className="flex items-center gap-2"><Quote className="h-3.5 w-3.5 text-violet-500" /><h3 className="flex-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Evidence passages</h3><span className="rounded-full bg-surface-soft px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">{passages.length}</span></div><p className="mt-2 text-[11px] leading-5 text-muted-foreground">Select a passage to see it in context.</p></div>
        <div className="space-y-3">
        {passages.map((passage, index) => {
          const first = matches.findIndex((match) => match.evidenceIndex === index)
          const selected = first >= 0 && matches[active]?.evidenceIndex === index
          return <button type="button" key={index} disabled={first < 0} aria-pressed={selected} onClick={() => setActive(first)} className={`group block w-full rounded-2xl border p-4 text-left text-xs transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-default disabled:opacity-60 ${selected ? 'border-violet-400/50 bg-violet-500/[0.06] shadow-sm' : 'border-border-soft bg-surface hover:border-violet-400/50 hover:bg-violet-500/[0.02]'}`}>
            <span className="flex items-center gap-2"><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-semibold tabular-nums ${selected ? 'bg-violet-500 text-white shadow-sm' : 'bg-surface-soft text-muted-foreground'}`}>{String(index + 1).padStart(2, '0')}</span><span className="flex-1 font-semibold">Passage {index + 1}</span>{first >= 0 ? <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400"><Check className="h-3 w-3" />Matched</span> : null}</span>
            <span className="mt-3 block whitespace-pre-wrap break-words leading-6 text-muted-foreground">{compactEmailText(first < 0 ? passage : matches[first].exactText)}</span>
            <span className={`mt-3 flex items-center justify-between border-t pt-3 text-[10px] font-medium ${first < 0 ? 'border-border-soft text-muted-foreground' : 'border-violet-500/10 text-violet-500'}`}>{first < 0 ? 'Not matched in email body' : 'Locate in email'}{first >= 0 ? <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /> : null}</span>
          </button>
        })}
        </div>
        <div className="flex gap-2 rounded-xl bg-surface-soft/70 p-3.5"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" /><p className="text-[10px] leading-5 text-muted-foreground">Passages are matched against the original email. Source wording is preserved.</p></div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface-soft/60">
        <div className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border-soft bg-surface/80 px-5 py-2.5">
          <p role="status" className="flex items-center gap-2 text-[11px] text-muted-foreground"><Highlighter className="h-4 w-4 text-violet-500" /><span><strong className="font-semibold text-foreground">{matches.length}</strong> text {matches.length === 1 ? 'match' : 'matches'} found in customer email body</span></p>
          <div className="flex items-center gap-1"><span className="mr-2 text-[10px] tabular-nums text-muted-foreground">{matches.length ? active + 1 : 0} of {matches.length}</span><Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg" aria-label="Previous email evidence match" disabled={matches.length < 2} onClick={() => setActive((active - 1 + matches.length) % matches.length)}><ChevronLeft className="h-3.5 w-3.5" /></Button><Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg" aria-label="Next email evidence match" disabled={matches.length < 2} onClick={() => setActive((active + 1) % matches.length)}><ChevronRight className="h-3.5 w-3.5" /></Button></div>
        </div>
        <div ref={content} aria-label="Customer email body" tabIndex={0} className="min-h-0 min-w-0 flex-1 overflow-auto p-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-400 sm:p-7">
        <article className="mx-auto max-w-[860px] overflow-hidden rounded-2xl border border-border-soft bg-surface shadow-sm">
          <div className="border-b border-border-soft px-5 py-5 sm:px-8 sm:py-6"><div className="mb-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground"><Mail className="h-3.5 w-3.5 text-violet-500" />Original message</div><h2 className="break-words text-lg font-semibold leading-7 tracking-tight">{email.subject || 'Customer email'}</h2>{emailDate}</div>
          <div className="px-5 py-6 sm:px-8 sm:py-8">
        {email.body === undefined ? <div role="alert" className="rounded-xl border border-dashed border-border p-6 text-center"><Mail className="mx-auto mb-3 h-7 w-7 text-muted-foreground/50" /><p className="text-sm font-medium">Email body unavailable</p><p className="mt-2 text-xs leading-6 text-muted-foreground">No CUSTOMER EMAIL BODY section was found in the customer information.</p></div> : <div className="whitespace-pre-wrap break-words text-[13px] leading-7 text-foreground/85">{cuts.slice(0, -1).map((start, index) => {
          const end = cuts[index + 1]
          const covering = matches.flatMap((match, matchIndex) => match.start < end && match.end > start ? [matchIndex] : [])
          return covering.length ? <mark key={start} data-email-match={covering.join(' ')} className={`rounded-sm py-0.5 text-slate-950 [box-decoration-break:clone] ${covering.includes(active) ? 'bg-amber-200 ring-1 ring-amber-400/60' : 'bg-yellow-100'}`}>{body.slice(start, end)}</mark> : <span key={start}>{body.slice(start, end)}</span>
        })}</div>}
          </div>
        </article>
        </div>
        <footer className="flex h-10 shrink-0 items-center justify-between gap-3 border-t border-border-soft bg-surface px-5 text-[10px] text-muted-foreground"><span className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-violet-500" />Read-only email</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-amber-300" />Highlighted source text</span></footer>
      </div>
    </div>
  </>
}

function EvidenceDocument({ inquiry, references, siteUrl, heading, sourceControl, expanded, onToggleExpand }: { inquiry: InquiryDetail; references: DocumentEvidence[]; siteUrl?: string; heading?: string; sourceControl?: ReactNode; expanded: boolean; onToggleExpand: () => void }) {
  const names = [...new Map(references.map((ref) => [ref.documentName.toLowerCase(), ref.documentName])).values()]
  const [selected, setSelected] = useState(names[0])
  const [file, setFile] = useState<Awaited<ReturnType<typeof getInquiryEvidenceDocument>> | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  const reloadRequested = useRef(false)
  function reloadDocument() { reloadRequested.current = true; setRetry((value) => value + 1) }
  const [resolvedSite, setResolvedSite] = useState(siteUrl)
  useEffect(() => {
    if (siteUrl) return
    let cancelled = false
    void getSharePointSiteUrl().then((url) => { if (!cancelled) setResolvedSite(url) }).catch(() => { /* File retrieval remains usable without an original link. */ })
    return () => { cancelled = true }
  }, [siteUrl])
  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(''); setFile(null)
    const refresh = reloadRequested.current
    reloadRequested.current = false
    void getInquiryEvidenceDocument(inquiry.id, inquiry.documentsUrl, selected, { refresh }).then((result) => {
      if (!cancelled) setFile(result)
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : 'Unable to retrieve this document.')
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [inquiry.id, inquiry.documentsUrl, selected, retry])
  let original: string | undefined
  try { original = evidenceOriginalUrl(siteUrl || resolvedSite, resolveEvidencePath(inquiry.documentsUrl, selected)) } catch { /* A missing or ambiguous document must not have an original link either. */ }
  const selectedReferences = useMemo(() => references.filter((ref) => ref.documentName.toLowerCase() === selected.toLowerCase()), [references, selected])
  const passages = useMemo(() => selectedReferences.map((ref) => ref.exactText), [selectedReferences])
  const sourceSelector = <div className="min-w-0 space-y-3">
    <div className="flex items-center justify-between gap-3"><h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Source document</h3><span className="text-[10px] text-muted-foreground">{names.length} {names.length === 1 ? 'file' : 'files'}</span></div>
    <Select aria-label="Source document" title={selected} value={selected} onValueChange={setSelected} options={names.map((value) => ({ value, label: <span title={value} className="flex w-full min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-violet-500" /><span className="min-w-0 flex-1 truncate">{value}</span></span> }))} className="h-12 rounded-2xl text-xs shadow-none" contentClassName="z-[120] max-w-[340px]" />
  </div>
  const placeholder = (content: ReactNode) => <div className="flex min-h-0 flex-1 flex-col md:flex-row"><aside className="shrink-0 border-b border-border-soft p-5 md:w-[300px] md:border-b-0 md:border-r xl:w-[328px]">{sourceSelector}</aside><div className="min-w-0 flex-1 bg-surface-soft/50">{content}</div></div>
  return <>
    <header className="flex min-h-20 shrink-0 items-center justify-between gap-3 border-b border-border-soft px-5 py-4 sm:px-7">
      <div className="flex min-w-0 flex-1 items-center gap-3.5"><span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-violet-200 bg-violet-50 text-violet-500 sm:flex"><FileSearch className="h-[18px] w-[18px]" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Dialog.Title title={heading} className="line-clamp-2 max-w-full text-base font-semibold tracking-tight [overflow-wrap:anywhere]">{heading || 'Evidence workspace'}</Dialog.Title><span className="rounded-full bg-violet-50 px-2 py-1 text-[9px] font-semibold tracking-wide text-violet-500">AI SOURCE</span></div><Dialog.Description title={file?.filename || selected} className="mt-1 truncate text-xs text-muted-foreground">{file?.filename || selected}</Dialog.Description>{sourceControl ? <div className="mt-3">{sourceControl}</div> : null}</div></div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3"><Button type="button" variant="ghost" size="sm" className="h-9 gap-2 rounded-xl px-2 text-[11px]" aria-label="Reload source document" title="Fetch the latest source file from SharePoint" disabled={loading} onClick={reloadDocument}><RefreshCw className="h-3.5 w-3.5" /><span className="hidden sm:inline">Reload source</span></Button>{original ? <a href={original} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-xl border border-border-soft px-3 text-[11px] font-medium transition hover:bg-surface-soft"><ExternalLink className="h-3.5 w-3.5" /><span className="hidden sm:inline">Open original</span><span className="sr-only sm:hidden">Open original</span></a> : null}<Dialog.Close asChild><Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg" aria-label="Close evidence workspace"><X className="h-4 w-4" /></Button></Dialog.Close></div>
    </header>
    {loading ? placeholder(<Loading />) : error ? placeholder(<div role="alert" className="space-y-3 p-6"><p className="text-sm text-danger">{error}</p><Button variant="outline" onClick={reloadDocument}>Try again</Button></div>) : file?.format === 'pdf' ? <Suspense fallback={placeholder(<Loading />)}><PdfEvidenceViewer key={selected} bytes={file.bytes} passages={passages} sourceSelector={sourceSelector} expanded={expanded} onToggleExpand={onToggleExpand} /></Suspense> : file?.format === 'docx' ? <Suspense fallback={placeholder(<Loading />)}><DocxEvidenceViewer key={selected} bytes={file.bytes} passages={passages} sourceSelector={sourceSelector} expanded={expanded} onToggleExpand={onToggleExpand} /></Suspense> : file?.format === 'excel' ? <Suspense fallback={placeholder(<Loading />)}><ExcelEvidenceViewer key={selected} bytes={file.bytes} passages={passages} references={selectedReferences} sourceSelector={sourceSelector} expanded={expanded} onToggleExpand={onToggleExpand} /></Suspense> : file?.format === 'pptx' ? <Suspense fallback={placeholder(<Loading />)}><PptxEvidenceViewer key={selected} bytes={file.bytes} passages={passages} sourceSelector={sourceSelector} expanded={expanded} onToggleExpand={onToggleExpand} /></Suspense> : file?.format === 'image' ? <Suspense fallback={placeholder(<Loading />)}><ImageEvidenceViewer key={selected} bytes={file.bytes} passages={passages} sourceSelector={sourceSelector} expanded={expanded} onToggleExpand={onToggleExpand} /></Suspense> : placeholder(<p role="status" className="p-6 text-sm text-muted-foreground">{file?.format === 'ppt' ? 'Legacy .ppt files need conversion to .pptx or PDF for highlighting. Use Open original to view this presentation.' : file?.format === 'doc' ? 'Legacy .doc files need conversion to .docx or PDF for highlighting. Use Open original to view this file.' : 'Highlighting is available for PDF, DOCX, Excel, PPTX, and PNG/JPEG/WebP/BMP/GIF images. Use Open original to view this file.'}</p>)}
  </>
}

function Loading() { return <p role="status" className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" />Loading evidence document…</p> }
