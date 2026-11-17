import { useId, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, CircleCheck, ChevronDown, Eye, Layers3, Sparkles } from 'lucide-react'
import type { AiDecisionSuggestion } from '../../lib/aiDecisionResponse'
import { aiDecisionMatchingOption } from '../../lib/aiDecisionResponse'

export function InquiryAiDecisionSuggestion({ suggestion, children, editing = false, fieldLabel, options = [], currentValue, onApply, disabled = false, leadingField, panelHost }: {
  suggestion?: AiDecisionSuggestion; children?: ReactNode; editing?: boolean; fieldLabel: string
  options?: Array<{ value: string; label: string }>; currentValue?: string; onApply?: (value: string) => void; disabled?: boolean
  leadingField?: ReactNode
  panelHost?: HTMLElement | null
}) {
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<'reason' | 'alternatives' | null>(null)
  const panelId = useId()
  const rowLayout = Boolean(leadingField)
  const renderPanel = (panel: ReactNode) => panelHost === undefined ? panel : panelHost ? createPortal(panel, panelHost) : null
  if (!suggestion && !rowLayout) return <>{children}</>
  const { selection = null, alternatives = [] } = suggestion ?? {}
  const match = selection ? aiDecisionMatchingOption(selection.product, options) : undefined
  const alreadySelected = Boolean(match && match.value === currentValue)
  const score = selection?.confidenceScore
  const confidenceTone = score !== undefined && score >= 80 ? 'text-emerald-700 bg-emerald-100/80 dark:bg-emerald-400/10 dark:text-emerald-300'
    : score !== undefined && score >= 50 ? 'text-amber-700 bg-amber-100/80 dark:bg-amber-400/10 dark:text-amber-300'
    : 'text-slate-600 bg-slate-100 dark:bg-slate-400/10 dark:text-slate-300'
  return (
    <div className={`ai-decision${rowLayout ? ' ai-decision-row' : ''}`} data-open={Boolean(suggestion && open)}>
      {leadingField}
      <div className={rowLayout ? 'ai-decision-product-slot min-w-0 space-y-2.5' : ''}>
        {rowLayout ? <p className="text-[12px] font-normal text-muted-foreground">{fieldLabel}</p> : null}
      <div className={suggestion ? 'ai-decision-field' : ''}>
        <div className="min-w-0">{children}</div>
        {suggestion ? <button type="button" aria-expanded={open} aria-controls={panelId} aria-label={`${open ? 'Hide' : 'Show'} AI reasoning for ${fieldLabel}`} onClick={() => setOpen((value) => !value)}
          className="mt-1.5 flex min-h-7 w-full items-center justify-end gap-1.5 rounded-md px-1 text-[12px] font-normal text-primary outline-none transition-colors hover:text-primary-dark focus-visible:ring-2 focus-visible:ring-primary/30">
          <Sparkles aria-hidden="true" className="h-3.5 w-3.5" /><span>AI reasoning</span>
          <ChevronDown aria-hidden="true" className="ai-decision-chevron h-3.5 w-3.5" />
        </button> : null}
      </div>
      </div>
      {renderPanel(suggestion ? <div id={panelId} className="ai-decision-reveal" data-open={open} aria-hidden={!open} inert={!open}>
        <div className="min-h-0 overflow-hidden">
          <div className="ai-decision-content ai-suggestion-card mt-2 space-y-3 rounded-xl border border-primary/20 p-3.5 text-xs font-normal shadow-none dark:border-primary/25 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1.5 font-normal text-primary"><Sparkles aria-hidden="true" className="h-4 w-4" />AI suggestion</span>
              {score !== undefined ? <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-semibold tabular-nums ${confidenceTone}`}><CircleCheck aria-hidden="true" className="h-4 w-4" />{Number(score.toFixed(1))}% confidence</span> : null}
            </div>
            {selection ? <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="min-w-0 flex-1 break-words border-l-[3px] border-primary pl-3 text-[14px] font-semibold leading-6 text-foreground">{selection.product}</p>
                {score !== undefined ? <div role="progressbar" aria-label="AI confidence" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score} className="h-1.5 w-28 shrink-0 overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/10"><div className={`h-full rounded-full ${score >= 80 ? 'bg-emerald-600' : score >= 50 ? 'bg-amber-500' : 'bg-slate-400'}`} style={{ width: `${score}%` }} /></div> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {onApply ? <button type="button" disabled={disabled || !match || alreadySelected} onClick={() => { if (match) onApply(match.value) }} className="ai-suggestion-action border border-primary bg-primary text-white shadow-none hover:bg-primary-dark disabled:cursor-default disabled:opacity-60"><Check aria-hidden="true" className="h-4 w-4" />{alreadySelected ? editing ? 'Selected in draft' : 'Current selection' : 'Apply suggestion'}</button> : null}
                <button type="button" aria-expanded={detail === 'reason'} aria-controls={`${panelId}-reason`} onClick={() => setDetail((value) => value === 'reason' ? null : 'reason')} className="ai-suggestion-action border border-border bg-surface text-foreground shadow-none hover:bg-surface-muted"><Eye aria-hidden="true" className="h-4 w-4" />{detail === 'reason' ? 'Hide reasoning' : 'View reasoning'}</button>
                {alternatives.length ? <button type="button" aria-expanded={detail === 'alternatives'} aria-controls={`${panelId}-alternatives`} onClick={() => setDetail((value) => value === 'alternatives' ? null : 'alternatives')} className="ai-suggestion-action border border-transparent text-primary hover:bg-primary/10"><Layers3 aria-hidden="true" className="h-4 w-4" />{detail === 'alternatives' ? 'Hide alternatives' : 'See alternatives'}</button> : null}
              </div>
              {onApply && !match ? <p className="text-[11px] text-muted-foreground">{options.length ? 'No unique matching option is available. Choose the field value manually.' : 'Field options are not available yet.'}</p> : null}
              {alreadySelected && editing ? <p role="status" className="text-[11px] text-muted-foreground">Save Inquiry to confirm this selection.</p> : null}
              <div id={`${panelId}-reason`} className="ai-suggestion-detail" data-open={detail === 'reason'} aria-hidden={detail !== 'reason'} inert={detail !== 'reason'}><div className="min-h-0 overflow-hidden"><div className="border-t border-primary/15 pt-3 dark:border-primary/20"><p className="mb-1 font-semibold text-foreground">Selection reasoning</p><p className="whitespace-pre-wrap break-words text-[12px] leading-6 text-muted-foreground">{selection.selectionReason || 'No selection reason provided.'}</p></div></div></div>
              {alternatives.length ? <div id={`${panelId}-alternatives`} className="ai-suggestion-detail" data-open={detail === 'alternatives'} aria-hidden={detail !== 'alternatives'} inert={detail !== 'alternatives'}><div className="min-h-0 overflow-hidden"><div className="space-y-2 border-t border-primary/15 pt-3 dark:border-primary/20"><p className="font-semibold text-foreground">Other options considered</p>{alternatives.map((item) => <div key={item.product} className="rounded-xl border border-border-soft bg-surface p-3 dark:border-border dark:bg-surface"><div className="flex items-center justify-between gap-3"><span className="break-words font-normal">{item.product}</span>{item.confidenceScore !== undefined ? <span className="shrink-0 tabular-nums text-muted-foreground">{item.confidenceScore}% confidence</span> : null}</div>{item.selectionReason ? <p className="mt-1 break-words leading-relaxed text-muted-foreground">{item.selectionReason}</p> : null}</div>)}</div></div></div> : null}
            </> : <p className="text-muted-foreground">The latest AI suggestion could not be read.</p>}
          </div>
        </div>
      </div> : null)}
    </div>
  )
}
