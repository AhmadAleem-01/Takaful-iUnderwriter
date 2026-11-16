import * as Tooltip from '@radix-ui/react-tooltip'
import { Sparkles } from 'lucide-react'

const descriptions: Record<string, string> = {
  'Inquiry Type': 'AI-suggested Inquiry Type based on predefined business criteria and submitted information. The selection can be reviewed and modified by the underwriter.',
  'Inquiry Purpose': 'AI-suggested Inquiry Purpose based on configured identification criteria and submitted information. The selection can be reviewed and modified by the underwriter.',
}

export function InquiryAiDecisionTooltip({ fieldLabel }: { fieldLabel: string }) {
  const description = descriptions[fieldLabel]
  if (!description) return null
  return <Tooltip.Provider delayDuration={200}>
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button type="button" aria-label={`About AI-suggested ${fieldLabel}`} className="inline-flex h-6 w-6 items-center justify-center rounded-full text-violet-600 transition hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 dark:text-violet-300 dark:hover:bg-violet-400/10">
          <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side="top" sideOffset={8} collisionPadding={16} className="z-[100] max-h-[min(60vh,24rem)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-violet-200 bg-surface p-4 text-xs leading-relaxed text-foreground shadow-lg dark:border-violet-400/25">
          <p className="text-muted-foreground">{description}</p>
          <Tooltip.Arrow className="fill-surface" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  </Tooltip.Provider>
}
