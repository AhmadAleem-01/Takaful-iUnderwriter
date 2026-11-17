import { useId, useState, type ReactNode } from 'react'
import { ChevronDown, Sparkles, Info, TriangleAlert, CircleCheck, CircleX } from 'lucide-react'

const statusStyles = {
  info: { icon: Info, colors: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200' },
  warning: { icon: TriangleAlert, colors: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200' },
  success: { icon: CircleCheck, colors: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' },
  error: { icon: CircleX, colors: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200' },
}

export function InquiryAiStatus({ variant, title, children }: { variant: keyof typeof statusStyles; title: string; children: ReactNode }) {
  const { icon: Icon, colors } = statusStyles[variant]
  return <div role={variant === 'error' || variant === 'warning' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-xl border p-4 ${colors}`}>
    <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
    <div className="min-w-0 flex-1 space-y-2 text-[12px] font-normal leading-6 [overflow-wrap:anywhere]"><p className="font-semibold">{title}</p>{children}</div>
  </div>
}

export function InquiryAiSection({ summary, actions, children }: { summary: ReactNode; actions: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const scope = useId()
  return (
    <section aria-labelledby={`${scope}-heading`} className="overflow-hidden rounded-2xl border border-primary/20 bg-[#EBF8FE] dark:bg-primary/10">
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <button type="button" aria-expanded={open} aria-controls={`${scope}-details`} onClick={() => setOpen((current) => !current)} className="flex min-w-0 items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Sparkles aria-hidden="true" className="h-4 w-4" /></span>
          <h2 id={`${scope}-heading`} className="text-[14px] font-semibold">AI Extracted Response</h2>
          <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-primary transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
        </button>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </header>
      <div className="space-y-3 border-t border-primary/15 px-5 py-4 text-[12px] font-normal leading-6">
        <h3 className="text-[14px] font-semibold">AI Summary</h3>
        {summary}
      </div>
      <div id={`${scope}-details`} hidden={!open} className="border-t border-primary/15 px-5 py-5 text-[12px] font-normal">{children}</div>
    </section>
  )
}
