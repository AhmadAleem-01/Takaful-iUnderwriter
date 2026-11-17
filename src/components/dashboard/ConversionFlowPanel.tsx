import { ArrowRight, Check, Expand, FileText, Info, Layers3, type LucideIcon } from 'lucide-react'
import type { DashboardMetrics } from '../../domain/app'
import { formatAmount } from '../../lib/formatters'
import { Card } from '../ui/Card'

type ConversionMetrics = Pick<DashboardMetrics, 'totalInquiries' | 'totalQuotes' | 'wonQuotes' | 'wonPremiumTotal' | 'inquiryToQuoteConversionRate' | 'quoteToWonConversionRate'>

function Stage({ icon: Icon, step, label, value, helper, fill, color }: {
  icon: LucideIcon; step: string; label: string; value: number; helper: string; fill: number; color: string
}) {
  const width = Math.min(100, Math.max(0, fill))
  return (
    <div className="min-w-0 rounded-lg border border-border-soft bg-[#f6f8fb] p-4 sm:p-5 dark:bg-surface-soft/50">
      <div className="flex items-center gap-2 text-[12px] font-normal text-muted-foreground"><Icon aria-hidden="true" className="h-4 w-4 text-primary dark:text-primary-light" /><span>{step}</span></div>
      <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1"><p className="break-words text-[26px] font-semibold leading-tight text-foreground">{formatAmount(value, 0)}</p><p className="text-[12px] font-normal text-muted-foreground">{label}</p></div>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={width} className="mt-4 h-1 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full" style={{ width: width + '%', backgroundColor: color }} /></div>
      <p className="mt-2 text-[12px] font-normal leading-5 text-muted-foreground">{helper}</p>
    </div>
  )
}

function Connector({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-1 text-center">
      <p className="text-[12px] font-normal text-primary dark:text-primary-light">{value}%</p>
      <ArrowRight aria-hidden="true" className="h-5 w-5 rotate-90 text-primary xl:rotate-0 dark:text-primary-light" />
      <p className="text-[12px] font-normal text-muted-foreground">{label}</p>
    </div>
  )
}

export function ConversionFlowPanel({ metrics }: { metrics: ConversionMetrics }) {
  const { totalInquiries, totalQuotes, wonQuotes, wonPremiumTotal } = metrics
  const quoteGeneration = totalInquiries > 0 ? metrics.inquiryToQuoteConversionRate : 0
  const winRate = totalQuotes > 0 ? metrics.quoteToWonConversionRate : 0
  const quotesPerInquiry = totalInquiries > 0 ? totalQuotes / totalInquiries : 0
  const balance = Math.max(totalQuotes - wonQuotes, 0)
  const summaries = [
    { label: 'Inquiry to Quote', value: quoteGeneration, suffix: '%', helper: totalQuotes + ' quotes from ' + totalInquiries + ' inquiries', info: true },
    { label: 'Quote to Won', value: winRate, suffix: '%', helper: wonQuotes + ' won outcomes from quote records' },
    { label: 'Reinsurance', value: wonPremiumTotal, prefix: 'AED', helper: 'Current won quote reinsurance pool' },
    { label: 'Pipeline Balance', value: balance, helper: 'Quotes still open or not yet won' },
  ]
  const ratioExplanation = 'One inquiry can generate multiple quotes. The ' + quoteGeneration + '% figure is a quote-volume ratio, not a unique-inquiry conversion rate.'

  return (
    <Card id="dashboard-conversion" padding="none" className="min-w-0 scroll-mt-24 overflow-hidden rounded-xl bg-white shadow-none xl:col-span-2 dark:bg-surface">
      <div className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[12px] font-normal uppercase tracking-[0.08em] text-muted-foreground">Pipeline</p>
            <h2 className="text-[16px] font-semibold text-foreground">Conversion Flow</h2>
            <p className="text-[12px] font-normal leading-6 text-muted-foreground">Follow the journey from inquiry to quote, and from quote to won business.</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded border border-border-soft px-2.5 py-2 text-[12px] font-normal text-muted-foreground"><Expand aria-hidden="true" className="h-3.5 w-3.5" />End-to-end overview</span>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_100px_minmax(0,1fr)_100px_minmax(0,1fr)] xl:gap-4">
          <Stage icon={FileText} step="01 · Intake" label="Inquiries" value={totalInquiries} helper="Starting point of the pipeline" fill={totalInquiries > 0 ? 100 : 0} color="#194F90" />
          <Connector value={quoteGeneration} label="Quote generation" />
          <Stage icon={Layers3} step="02 · Quotation" label="Quotes" value={totalQuotes} helper={quotesPerInquiry.toFixed(1) + ' quotes per inquiry'} fill={totalQuotes > 0 ? 100 : 0} color="#719FC2" />
          <Connector value={winRate} label="Win rate" />
          <Stage icon={Check} step="03 · Outcome" label="Won" value={wonQuotes} helper={balance + ' quotes not yet won'} fill={winRate} color="#C5E0E8" />
        </div>
        <dl className="mt-6 grid gap-y-4 border-t border-border-soft pt-5 sm:grid-cols-2 xl:grid-cols-4">
          {summaries.map((summary, index) => (
            <div key={summary.label} className={'min-w-0 space-y-3 ' + (index % 2 ? 'sm:border-l sm:border-border-soft sm:pl-5 ' : 'sm:pr-5 ') + (index > 0 ? 'xl:border-l xl:border-border-soft xl:pl-5 ' : '')}>
              <dt className="flex items-center gap-2 text-[12px] font-normal text-muted-foreground">{summary.label}{summary.info ? <Info role="img" aria-label={ratioExplanation} className="h-3 w-3"><title>{ratioExplanation}</title></Info> : null}</dt>
              <dd className="flex flex-wrap items-baseline gap-x-1.5 text-foreground">{summary.prefix ? <span className="text-[12px] font-normal">{summary.prefix}</span> : null}<span className="break-words text-[26px] font-semibold leading-tight">{formatAmount(summary.value, 0)}{summary.suffix ? <span className="text-[12px] font-normal">{summary.suffix}</span> : null}</span></dd>
              <dd className="text-[12px] font-normal leading-5 text-muted-foreground">{summary.helper}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Card>
  )
}
