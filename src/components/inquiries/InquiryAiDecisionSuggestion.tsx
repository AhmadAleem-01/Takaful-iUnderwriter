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
        {rowLayout ? <p className="text-[11px] font-medium text-muted-foreground">{fieldLabel}</p> : null}
      <div className={suggestion ? 'ai-decision-field' : ''}>
        <div className={editing || !suggestion ? 'relative' : 'relative [&_.form-field-surface]:pr-24'}>{children}</div>
        {suggestion ? <button type="button" aria-expanded={open} aria-controls={panelId} aria-label={`${open ? 'Hide' : 'Show'} AI reasoning for ${fieldLabel}`} onClick={() => setOpen((value) => !value)}
          className={editing
            ? 'relative flex w-full items-center justify-end gap-1.5 rounded-b-xl bg-surface px-3 py-2 text-[11px] font-medium text-secondary outline-none focus-visible:ring-2 focus-visible:ring-secondary/50'
            : 'absolute inset-0 flex w-full items-center justify-end gap-1.5 rounded-xl px-3 text-[11px] font-medium text-secondary outline-none focus-visible:ring-2 focus-visible:ring-secondary/50'}>
          <Sparkles aria-hidden="true" className="h-3.5 w-3.5" /><span>{editing ? 'AI reasoning' : 'AI'}</span>
          <ChevronDown aria-hidden="true" className="ai-decision-chevron h-3.5 w-3.5" />
        </button> : null}
      </div>
      </div>
      {renderPanel(suggestion ? <div id={panelId} className="ai-decision-reveal" data-open={open} aria-hidden={!open} inert={!open}>
        <div className="min-h-0 overflow-hidden">
          <div className="ai-decision-content ai-suggestion-card mt-2 space-y-3 rounded-[18px] border border-violet-300/70 p-3.5 text-xs shadow-[0_2px_5px_rgba(109,40,217,0.06)] dark:border-violet-400/25 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100/80 px-2.5 py-1.5 font-semibold text-violet-700 dark:bg-violet-400/15 dark:text-violet-300"><Sparkles aria-hidden="true" className="h-4 w-4" />AI suggestion</span>
              {score !== undefined ? <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-semibold tabular-nums ${confidenceTone}`}><CircleCheck aria-hidden="true" className="h-4 w-4" />{Number(score.toFixed(1))}% confidence</span> : null}
            </div>
            {selection ? <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="min-w-0 flex-1 break-words border-l-[3px] border-violet-600 pl-3 text-[17px] font-bold leading-tight tracking-tight text-foreground">{selection.product}</p>
                {score !== undefined ? <div role="progressbar" aria-label="AI confidence" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score} className="h-1.5 w-28 shrink-0 overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/10"><div className={`h-full rounded-full ${score >= 80 ? 'bg-emerald-600' : score >= 50 ? 'bg-amber-500' : 'bg-slate-400'}`} style={{ width: `${score}%` }} /></div> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {onApply ? <button type="button" disabled={disabled || !match || alreadySelected} onClick={() => { if (match) onApply(match.value) }} className="ai-suggestion-action border border-blue-600 bg-gradient-to-b from-blue-600 to-blue-700 text-white shadow-sm hover:from-blue-500 hover:to-blue-600 disabled:cursor-default disabled:opacity-60"><Check aria-hidden="true" className="h-4 w-4" />{alreadySelected ? editing ? 'Selected in draft' : 'Current selection' : 'Apply suggestion'}</button> : null}
                <button type="button" aria-expanded={detail === 'reason'} aria-controls={`${panelId}-reason`} onClick={() => setDetail((value) => value === 'reason' ? null : 'reason')} className="ai-suggestion-action border border-slate-300 bg-white/80 text-slate-700 shadow-sm hover:bg-violet-50 dark:border-white/20 dark:bg-white/5 dark:text-slate-200"><Eye aria-hidden="true" className="h-4 w-4" />{detail === 'reason' ? 'Hide reasoning' : 'View reasoning'}</button>
                {alternatives.length ? <button type="button" aria-expanded={detail === 'alternatives'} aria-controls={`${panelId}-alternatives`} onClick={() => setDetail((value) => value === 'alternatives' ? null : 'alternatives')} className="ai-suggestion-action border border-transparent text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-white/5"><Layers3 aria-hidden="true" className="h-4 w-4" />{detail === 'alternatives' ? 'Hide alternatives' : 'See alternatives'}</button> : null}
              </div>
              {onApply && !match ? <p className="text-[11px] text-muted-foreground">{options.length ? 'No unique matching option is available. Choose the field value manually.' : 'Field options are not available yet.'}</p> : null}
              {alreadySelected && editing ? <p role="status" className="text-[11px] text-muted-foreground">Save Inquiry to confirm this selection.</p> : null}
              <div id={`${panelId}-reason`} className="ai-suggestion-detail" data-open={detail === 'reason'} aria-hidden={detail !== 'reason'} inert={detail !== 'reason'}><div className="min-h-0 overflow-hidden"><div className="border-t border-violet-200/70 pt-3 dark:border-violet-400/20"><p className="mb-1 font-semibold text-foreground">Selection reasoning</p><p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-muted-foreground">{selection.selectionReason || 'No selection reason provided.'}</p></div></div></div>
              {alternatives.length ? <div id={`${panelId}-alternatives`} className="ai-suggestion-detail" data-open={detail === 'alternatives'} aria-hidden={detail !== 'alternatives'} inert={detail !== 'alternatives'}><div className="min-h-0 overflow-hidden"><div className="space-y-2 border-t border-violet-200/70 pt-3 dark:border-violet-400/20"><p className="font-semibold text-foreground">Other options considered</p>{alternatives.map((item) => <div key={item.product} className="rounded-xl border border-violet-200/60 bg-white/60 p-3 dark:border-white/10 dark:bg-white/5"><div className="flex items-center justify-between gap-3"><span className="break-words font-medium">{item.product}</span>{item.confidenceScore !== undefined ? <span className="shrink-0 tabular-nums text-muted-foreground">{item.confidenceScore}% confidence</span> : null}</div>{item.selectionReason ? <p className="mt-1 break-words leading-relaxed text-muted-foreground">{item.selectionReason}</p> : null}</div>)}</div></div></div> : null}
            </> : <p className="text-muted-foreground">The latest AI suggestion could not be read.</p>}
          </div>
        </div>
      </div> : null)}
    </div>
  )
}
