import { useState, type ReactNode } from 'react'
import type { AiDecisionSuggestion } from '../../lib/aiDecisionResponse'
import { InquiryAiDecisionSuggestion } from './InquiryAiDecisionSuggestion'
import { InquiryAiDecisionTooltip } from './InquiryAiDecisionTooltip'

export interface InquiryDecisionField {
  label: string
  content: ReactNode
  currentValue?: string
  options?: Array<{ value: string; label: string }>
  onApply?: (value: string) => void
  decisionCategory?: 1
  decisionStyle?: 'card' | 'tooltip'
}

export function InquiryDecisionFields({ fields, suggestions, editing, disabled }: {
  fields: InquiryDecisionField[]; suggestions: AiDecisionSuggestion[]; editing: boolean; disabled: boolean
}) {
  return <div className="space-y-4">{Array.from({ length: Math.ceil(fields.length / 2) }, (_, index) =>
    <InquiryDecisionFieldRow key={fields[index * 2].label} fields={fields.slice(index * 2, index * 2 + 2)} suggestions={suggestions} editing={editing} disabled={disabled} />,
  )}</div>
}

function InquiryDecisionFieldRow({ fields, suggestions, editing, disabled }: {
  fields: InquiryDecisionField[]; suggestions: AiDecisionSuggestion[]; editing: boolean; disabled: boolean
}) {
  const [panelHost, setPanelHost] = useState<HTMLDivElement | null>(null)
  return <div className="grid items-start gap-x-4 md:grid-cols-2">
    {fields.map((field, index) => {
      const suggestion = field.decisionCategory === undefined ? undefined : suggestions.find((item) => item.category === field.decisionCategory)
      const cardSuggestion = field.decisionStyle === 'card' ? suggestion : undefined
      return <div key={field.label} className={`min-w-0 space-y-2.5 ${index ? 'mt-4 md:mt-0' : ''}`}>
        <div className="flex min-h-6 items-center gap-1"><p className="text-[12px] font-normal text-muted-foreground">{field.label}</p>{field.decisionStyle === 'tooltip' ? <InquiryAiDecisionTooltip fieldLabel={field.label} /> : null}</div>
        <InquiryAiDecisionSuggestion key={cardSuggestion?.id ?? field.label} suggestion={cardSuggestion} fieldLabel={field.label}
          options={field.options} currentValue={field.currentValue} onApply={field.onApply} editing={editing} disabled={disabled} panelHost={panelHost}>
          {field.content}
        </InquiryAiDecisionSuggestion>
      </div>
    })}
    <div ref={setPanelHost} className="min-w-0 md:col-span-2" />
  </div>
}
