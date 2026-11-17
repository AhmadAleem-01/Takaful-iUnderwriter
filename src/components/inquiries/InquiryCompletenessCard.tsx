import { Target } from 'lucide-react'
import type { ReadinessMetric } from '../../domain/app'
import { formatAmount } from '../../lib/formatters'

function percentage(value?: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(Math.min(100, Math.max(0, value))) : 0
}

function Progress({ label, value, prominent = false }: { label: string; value: number; prominent?: boolean }) {
  return <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} className={(prominent ? 'h-2' : 'h-1') + ' overflow-hidden rounded-full bg-surface-muted'}><div className={'h-full rounded-full ' + (prominent ? 'bg-primary' : 'bg-primary-light')} style={{ width: value + '%' }} /></div>
}

export function InquiryCompletenessCard({ readiness = [] }: { readiness?: ReadinessMetric[] }) {
  const overall = percentage(readiness[0]?.value)
  return (
    <section aria-label="Completeness" className="rounded-xl border border-border-soft bg-white p-4 dark:bg-surface">
      <div className="flex items-center gap-2.5"><Target aria-hidden="true" className="h-[18px] w-[18px] text-primary dark:text-primary-light" /><h2 className="text-[16px] font-semibold text-foreground">Completeness</h2></div>
      <p className="mt-2 text-[12px] font-normal leading-5 text-muted-foreground">Inquiry data completeness and readiness for underwriting.</p>
      <div className="mt-5 space-y-3"><p className="text-[26px] font-semibold leading-tight text-foreground">{formatAmount(overall, 0)}<span className="ml-0.5 text-[12px] font-normal">%</span></p><Progress label="Inquiry completeness" value={overall} prominent /></div>
      {readiness.length > 0 ? <dl className="mt-6 space-y-5">{readiness.map((item, index) => {
        const value = percentage(item.value)
        return <div key={item.label + index} className="space-y-2"><div className="flex items-baseline justify-between gap-3 text-[12px] font-normal"><dt className="min-w-0 break-words text-muted-foreground">{item.label}</dt><dd className="shrink-0 text-foreground">{value}%</dd></div><Progress label={item.label} value={value} /></div>
      })}</dl> : null}
    </section>
  )
}
