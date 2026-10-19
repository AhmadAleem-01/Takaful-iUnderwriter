import { ClipboardList, ShieldCheck, HeartPulse, ContactRound, Sparkles, ClipboardCheck } from 'lucide-react'
import { HEALTH_INQUIRY_STEPS, healthInquiryStepIndex } from '../../lib/healthInquiryStages'
import { cn } from '../../lib/cn'

const stageIcons = [ClipboardList, ShieldCheck, HeartPulse, ContactRound, Sparkles, ClipboardCheck]

export function HealthInquiryStepper({ status, statusLabel }: { status?: number | null; statusLabel: string }) {
  const activeIndex = healthInquiryStepIndex(status)
  return (
    <nav aria-label={`Health inquiry progress. Current status: ${statusLabel}`} className="mt-6 border-t border-border-soft pt-6">
      <ol className="flex flex-col md:grid md:grid-cols-6">
        {HEALTH_INQUIRY_STEPS.map((step, index) => {
          const Icon = stageIcons[index]
          const reached = activeIndex >= 0 && index <= activeIndex
          const current = index === activeIndex
          return (
            <li key={step.status} className="relative pb-4 last:pb-0 md:pb-0">
              {index < HEALTH_INQUIRY_STEPS.length - 1 ? <span aria-hidden="true" className={cn('absolute bottom-0 left-5 top-10 w-px md:bottom-auto md:left-[calc(50%+24px)] md:top-5 md:h-px md:w-[calc(100%-48px)]', index < activeIndex ? 'bg-primary' : 'bg-border-soft')} /> : null}
              <div aria-current={current ? 'step' : undefined} aria-label={`${step.label}: ${current ? 'current' : reached ? 'reached' : 'upcoming'}`} className="relative z-10 flex w-full items-center gap-3 rounded-lg text-left md:flex-col md:gap-3 md:px-1 md:text-center">
                <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors', reached ? 'border-primary bg-primary text-white' : 'border-border-soft bg-surface text-muted-foreground', current && 'ring-4 ring-primary/15')}><Icon className="h-4 w-4" /></span>
                <span className={cn('text-[11px] leading-4', reached ? 'font-semibold text-primary' : 'text-muted-foreground')}>{step.label}</span>
              </div>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
