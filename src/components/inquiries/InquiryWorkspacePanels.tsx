import { useId, useState, type ReactNode } from 'react'
import { ChevronDown, Download, ExternalLink, FileText, List, LoaderCircle, Mail, Paperclip, RefreshCw, Save, ShieldCheck, Sparkles, Table2, type LucideIcon } from 'lucide-react'
import type { InquiryDetail, InquiryEmailAttachment, InquiryEmailSummary, QuoteResponse } from '../../domain/app'
import { formatDate, formatPercent } from '../../lib/formatters'
import { getUnderwriterSubActions, underwriterActions } from '../../lib/inquiryUnderwriting'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { cn } from '../../lib/cn'

export function InquirySection({ title, icon: Icon, defaultOpen = false, tone = 'default', children }: {
  title: string; icon: LucideIcon; defaultOpen?: boolean; tone?: 'default' | 'ai'; children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()
  return (
    <section className="overflow-visible rounded-2xl border border-border bg-surface">
      <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)} className={cn('flex w-full items-center gap-3 bg-white px-5 py-4 text-left outline-none transition hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-primary/30 dark:bg-surface', open ? 'rounded-t-[23px]' : 'rounded-[23px]')}>
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', tone === 'ai' ? 'bg-secondary/10 text-secondary' : 'bg-primary/8 text-primary')}><Icon className="h-4 w-4" /></span>
        <h2 className="flex-1 text-sm font-semibold text-foreground">{title}</h2>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
      </button>
      <div id={panelId} hidden={!open} className="inquiry-panel-body border-t border-border-soft px-5 py-5">{children}</div>
    </section>
  )
}

export function InquiryHeaderMetric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="min-w-0 px-4 py-3.5"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-semibold text-foreground">{value}</p>{detail ? <p className="mt-1 truncate text-[11px] text-muted-foreground">{detail}</p> : null}</div>
}

export function InquiryInformationSection({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <section className="overflow-visible rounded-2xl border border-border bg-surface">
      <header className="flex items-center gap-3 rounded-t-[23px] border-b border-border-soft bg-white px-5 py-4 dark:bg-surface"><span className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/10 bg-surface text-primary"><Icon className="h-4 w-4" /></span><h2 className="text-sm font-semibold">{title}</h2></header>
      <div className="px-5 py-5">{children}</div>
    </section>
  )
}

export function InquiryDecisionRail({ inquiry, hideCompleteness = false, premiumContent, afterActionContent, action, subAction, editing, busy, onAction, onSubAction, onEdit, onSave }: {
  inquiry: InquiryDetail; hideCompleteness?: boolean; premiumContent?: ReactNode; afterActionContent?: ReactNode; action: string; subAction: string; editing: boolean; busy: boolean;
  onAction: (value: string) => void; onSubAction: (value: string) => void; onEdit: () => void; onSave: () => void
}) {
  const completeness = Math.min(100, Math.max(0, inquiry.readiness[0]?.value ?? 0))
  const selectedAction = underwriterActions.find((option) => String(option.value) === action)?.label
  return (
    <aside aria-label="Underwriting overview" className="space-y-4 [&_.form-field-surface]:text-[13px] [&_[role=combobox]]:text-[13px]">
      <section className="rounded-2xl border border-border-soft bg-surface p-5">
        <div className="flex items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/10 bg-surface text-primary"><ShieldCheck className="h-4 w-4" /></span><h2 className="text-sm font-semibold">Underwriting Action</h2></div>
        <p className="mt-1 text-xs text-muted-foreground">{selectedAction ?? 'Not recorded yet'}</p>
        <div className="mt-5 space-y-4">
          <label className="block space-y-2"><span className="text-[11px] font-medium">Action Status</span><Select aria-label="Underwriting action status" value={action} disabled={!editing || busy} onValueChange={onAction} options={[{ value: '', label: 'Select a status' }, ...underwriterActions.map((item) => ({ value: String(item.value), label: item.label }))]} /></label>
          <label className="block space-y-2"><span className="text-[11px] font-medium">Sub Action</span><Select aria-label="Underwriting sub action" value={subAction} disabled={!editing || !action || busy} onValueChange={onSubAction} options={[{ value: '', label: 'Select a reason' }, ...getUnderwriterSubActions(action).map((item) => ({ value: String(item.value), label: item.label }))]} /></label>
          <Button type="button" className="w-full rounded-lg" disabled={busy} onClick={editing ? onSave : onEdit}>{busy ? 'Saving...' : editing ? 'Save Action' : 'Edit Action'}</Button>
        </div>
      </section>
      {afterActionContent}
      {premiumContent}
      {!hideCompleteness ? <section className="rounded-2xl border border-border-soft bg-surface p-5">
        <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Completeness</h2><span className="text-sm font-semibold">{formatPercent(completeness)}</span></div>
        <div role="progressbar" aria-label="Inquiry completeness" aria-valuenow={completeness} aria-valuemin={0} aria-valuemax={100} className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-soft"><div className="h-full rounded-full bg-primary" style={{ width: `${completeness}%` }} /></div>
        <dl className="mt-4 space-y-3 text-xs">{inquiry.readiness.map((item) => <div key={item.label} className="flex justify-between gap-3"><dt className="text-muted-foreground">{item.label}</dt><dd className="font-medium">{formatPercent(item.value)}</dd></div>)}</dl>
      </section> : null}
    </aside>
  )
}

type SaveState = { saving?: boolean; error?: string | null; success?: string | null }
export function InquiryAiPanel({ records, allRecords, summary, loading, category, categories, onCategory, view, onView, drafts, saveStates, onDraft, onSave, onReevaluate, onRequestDraft, showRequestDraft, renderEvidence }: {
  records: QuoteResponse[]; allRecords: QuoteResponse[]; summary: string; loading: boolean;
  category: string; categories: Array<{ label: string; count: number }>; onCategory: (value: string) => void;
  view: 'card' | 'table'; onView: (value: 'card' | 'table') => void;
  drafts: Record<string, string>; saveStates: Record<string, SaveState>;
  onDraft: (id: string, value: string) => void; onSave: (id: string) => void;
  onReevaluate: () => void; onRequestDraft: () => void; showRequestDraft: boolean; renderEvidence: (value: string) => ReactNode
}) {
  const scores = allRecords.flatMap((item) => item.confidenceScore == null ? [] : [item.confidenceScore])
  const average = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null
  return (
    <InquirySection title="AI Extracted Response" icon={Sparkles} tone="ai" defaultOpen>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{allRecords.length} underwriting checks · Editable before underwriting</p>
        <div className="flex flex-wrap gap-2"><Button type="button" size="sm" className="rounded-lg bg-secondary text-white shadow-none hover:bg-secondary/90 focus-visible:ring-secondary/30" onClick={onReevaluate}><RefreshCw className="h-3.5 w-3.5" />Re-evaluate AI Extraction</Button>{showRequestDraft ? <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={onRequestDraft}>Request a Draft</Button> : null}</div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_150px]">
        <div><p className="text-xs font-semibold">AI Summary</p><p className="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-muted-foreground">{summary || 'No summary is available yet.'}</p></div>
        <div className="space-y-2"><div className="rounded-xl border border-border-soft p-3"><p className="text-[11px] text-muted-foreground">Checks Extracted</p><p className="mt-1 text-lg font-semibold">{allRecords.length}</p></div><div className="rounded-xl border border-border-soft p-3"><p className="text-[11px] text-muted-foreground">Average Confidence</p><p className="mt-1 text-lg font-semibold">{average == null ? '—' : `${average}%`}</p></div></div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-y border-border-soft py-3">
        <div className="flex flex-wrap gap-1.5">{categories.map((item) => <button key={item.label} type="button" onClick={() => onCategory(item.label)} aria-pressed={category === item.label} className={cn('rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition', category === item.label ? 'border-secondary bg-secondary text-white' : 'border-secondary/15 text-secondary hover:bg-secondary/5')}>{item.label} <span className="ml-1 opacity-75">{item.count}</span></button>)}</div>
        <div className="flex gap-1"><Button type="button" variant={view === 'card' ? 'secondary' : 'ghost'} size="icon" aria-label="Accordion view" onClick={() => onView('card')}><List className="h-4 w-4" /></Button><Button type="button" variant={view === 'table' ? 'secondary' : 'ghost'} size="icon" aria-label="Table view" onClick={() => onView('table')}><Table2 className="h-4 w-4" /></Button></div>
      </div>
      {loading ? <p role="status" className="py-6 text-sm text-muted-foreground">Loading AI responses...</p> : !records.length ? <p className="py-6 text-sm text-muted-foreground">No extracted responses in this category.</p> : view === 'table' ? (
        <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-xs"><thead><tr className="border-b border-border-soft"><th className="py-3 pr-3">Check</th><th className="pr-3">Confidence</th><th>Response</th><th>Evidence</th><th /></tr></thead><tbody>{records.map((item) => <tr key={item.id} className="border-b border-border-soft"><td className="max-w-[220px] py-4 pr-3 font-medium">{item.name}</td><td className="pr-3">{item.confidenceScore == null ? '—' : `${item.confidenceScore}%`}</td><td className="py-3 pr-3"><AiResponseEditor item={item} draft={drafts[item.id] ?? item.response} saveState={saveStates[item.id]} onDraft={onDraft} onSave={onSave} /></td><td>{item.evidence ? renderEvidence(item.evidence) : null}</td><td /></tr>)}</tbody></table></div>
      ) : <div className="divide-y divide-border-soft">{records.map((item) => <AiResponseRow key={item.id} item={item} draft={drafts[item.id] ?? item.response} saveState={saveStates[item.id]} onDraft={onDraft} onSave={onSave} renderEvidence={renderEvidence} />)}</div>}
    </InquirySection>
  )
}

function AiResponseRow({ item, draft, saveState, onDraft, onSave, renderEvidence }: { item: QuoteResponse; draft: string; saveState?: SaveState; onDraft: (id: string, value: string) => void; onSave: (id: string) => void; renderEvidence: (value: string) => ReactNode }) {
  const [open, setOpen] = useState(false)
  return <div className={open ? 'bg-surface-soft/50' : ''}><div className="flex items-center gap-2 py-4"><button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-w-0 flex-1 flex-wrap items-center gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/30"><div className="min-w-[160px] flex-1"><p className="text-[13px] font-semibold leading-5">{item.name}</p><p className="mt-1 text-[11px] text-muted-foreground">{item.businessRuleCategory}</p></div><span className="rounded-md bg-surface-soft px-2 py-1 text-[10px] text-muted-foreground">{item.conditionMet || item.status}</span><span className="flex items-center gap-2"><span className="hidden h-1 w-12 overflow-hidden rounded-full bg-border-soft sm:block"><span className="block h-full bg-secondary" style={{ width: `${Math.min(100, Math.max(0, item.confidenceScore ?? 0))}%` }} /></span><span className="min-w-8 text-right text-[11px] font-medium">{item.confidenceScore == null ? '—' : `${item.confidenceScore}%`}</span></span><ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} /></button>{item.evidence ? renderEvidence(item.evidence) : null}</div><div hidden={!open} className="pb-4"><AiResponseEditor item={item} draft={draft} saveState={saveState} onDraft={onDraft} onSave={onSave} /></div></div>
}

function AiResponseEditor({ item, draft, saveState, onDraft, onSave }: { item: QuoteResponse; draft: string; saveState?: SaveState; onDraft: (id: string, value: string) => void; onSave: (id: string) => void }) {
  const dirty = draft !== item.response
  return <div className="space-y-2"><textarea aria-label={`Response for ${item.name}`} value={draft} onChange={(event) => onDraft(item.id, event.target.value)} className="form-field-surface min-h-[90px] w-full rounded-lg border border-border-soft px-3 py-2 text-[13px] leading-6 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /><div className="flex flex-wrap items-center justify-between gap-2"><p role={saveState?.error ? 'alert' : 'status'} className={cn('text-xs', saveState?.error ? 'text-danger' : 'text-muted-foreground')}>{saveState?.error || saveState?.success || (dirty ? 'Unsaved changes' : '')}</p><Button type="button" size="sm" className="rounded-lg" disabled={!dirty || saveState?.saving} onClick={() => onSave(item.id)}><Save className="h-3.5 w-3.5" />{saveState?.saving ? 'Saving...' : 'Save Response'}</Button></div></div>
}

export function InquiryEmailReader({ emails, loading, bodyHtml, previewText, attachmentBusyId, attachmentError, onOpenAttachment, onDownloadAttachment }: { emails: InquiryEmailSummary[]; loading: boolean; bodyHtml: (value: string) => string; previewText: (value: string) => string; attachmentBusyId?: string | null; attachmentError?: string | null; onOpenAttachment: (file: InquiryEmailAttachment) => void; onDownloadAttachment: (file: InquiryEmailAttachment) => void }) {
  const [selectedId, setSelectedId] = useState('')
  const [filter, setFilter] = useState<'all' | 'received' | 'sent' | 'attachments'>('all')
  const visible = emails.filter((email) => filter === 'all' || (filter === 'attachments' ? email.attachments.length > 0 : email.direction === filter))
  const selected = visible.find((email) => email.id === selectedId) ?? visible[0]
  if (loading) return <p role="status" className="p-6 text-sm text-muted-foreground">Loading email conversations...</p>
  return <div><div className="flex flex-wrap gap-2 border-b border-border-soft px-5 py-3">{(['all', 'received', 'sent', 'attachments'] as const).map((value) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)} className={cn('rounded-md border px-2.5 py-1.5 text-[11px] font-medium', filter === value ? 'border-primary bg-primary text-white' : 'border-border-soft text-muted-foreground hover:bg-surface-soft')}>{value === 'attachments' ? 'With Attachments' : value === 'all' ? 'All' : value === 'received' ? 'Received' : 'Sent'}</button>)}</div>{!selected ? <div className="px-5 py-12 text-center"><Mail className="mx-auto h-8 w-8 text-primary/60" /><p className="mt-3 text-sm font-medium">No email conversations found</p><p className="mt-1 text-xs text-muted-foreground">Try another filter or compose an inquiry email.</p></div> : <div className="grid lg:grid-cols-[minmax(240px,0.32fr)_minmax(0,0.68fr)]"><div aria-label="Email conversations" className="max-h-[620px] overflow-y-auto border-b border-border lg:border-b-0">{visible.map((email) => <button type="button" key={email.id} onClick={() => setSelectedId(email.id)} aria-pressed={selected.id === email.id} className={cn('flex w-full gap-3 border-b border-border-soft px-4 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary', selected.id === email.id ? 'bg-primary/5 shadow-[inset_3px_0_0_var(--color-primary,#286CFF)]' : 'hover:bg-surface-soft')}><span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md', email.direction === 'received' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary')}><Mail className="h-3.5 w-3.5" /></span><div className="min-w-0 flex-1"><div className="flex justify-between gap-2 text-[10px] text-muted-foreground"><span className="truncate">{email.status} · {email.sender}</span><span className="shrink-0">{formatDate(email.createdOn)}</span></div><p className="mt-1 line-clamp-2 text-xs font-semibold leading-5">{email.subject}</p><p className="mt-1 line-clamp-2 text-[11px] leading-5 text-muted-foreground">{previewText(email.body)}</p>{email.attachments.length ? <span className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground"><Paperclip className="h-3 w-3" />{email.attachments.length} attachment{email.attachments.length === 1 ? '' : 's'}</span> : null}</div></button>)}</div><article aria-label="Selected email" className="min-w-0 border-border px-5 py-5 sm:px-7 lg:border-l"><div className="flex items-center gap-2 text-[11px] text-muted-foreground"><span className="rounded-md bg-primary/8 px-2 py-1 text-primary">{selected.status}</span><span>{formatDate(selected.createdOn)}</span></div><h3 className="mt-3 break-words text-base font-semibold leading-6">{selected.subject}</h3><dl className="mt-4 space-y-2 rounded-lg bg-surface-soft/70 px-3 py-3 text-xs"><div className="flex gap-3"><dt className="w-8 shrink-0 text-muted-foreground">From</dt><dd className="break-all">{selected.sender}</dd></div><div className="flex gap-3"><dt className="w-8 shrink-0 text-muted-foreground">To</dt><dd className="break-all">{selected.toRecipients}</dd></div></dl><div className="prose prose-sm mt-6 max-w-none overflow-x-auto break-words text-[13px] leading-7 text-foreground dark:prose-invert" dangerouslySetInnerHTML={{ __html: bodyHtml(selected.body) }} />{selected.attachments.length ? <div className="mt-6 border-t border-border-soft pt-4"><h4 className="text-xs font-semibold">Attachments ({selected.attachments.length})</h4>{attachmentError ? <p role="alert" className="mt-2 text-xs text-danger">{attachmentError}</p> : null}<div className="mt-3 space-y-2">{selected.attachments.map((file) => <div key={file.id} className="flex max-w-full flex-wrap items-center gap-2 rounded-lg border border-border-soft px-3 py-2"><FileText className="h-5 w-5 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="break-all text-xs font-medium">{file.name}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{file.sizeLabel} {file.mimeType}</p></div><Button type="button" variant="ghost" size="sm" disabled={attachmentBusyId === file.id} onClick={() => onOpenAttachment(file)}>{attachmentBusyId === file.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}Open</Button><Button type="button" variant="ghost" size="sm" disabled={attachmentBusyId === file.id} onClick={() => onDownloadAttachment(file)}><Download className="h-3.5 w-3.5" />Download</Button></div>)}</div></div> : null}</article></div>}</div>
}
