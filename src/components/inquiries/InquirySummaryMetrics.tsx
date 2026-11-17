import type { ReactNode } from 'react'
import type { InquiryDetail } from '../../domain/app'
import { cn } from '../../lib/cn'
import { Badge } from '../ui/Badge'
import { formatAmount } from '../../lib/formatters'

type SummaryInquiry = Pick<InquiryDetail, 'productName' | 'planName' | 'totalInsured' | 'totalCharge' | 'paymentTerm' | 'basePremium' | 'riskScore'>

function CurrencyValue({ value }: { value: number }) {
  return <span className="inline-flex max-w-full flex-wrap items-baseline gap-x-1.5"><span className="text-[12px] font-normal text-muted-foreground">AED</span><span className="min-w-0 [overflow-wrap:anywhere]">{formatAmount(value, 0)}</span></span>
}

export function InquirySummaryMetrics({ inquiry }: { inquiry: SummaryInquiry }) {
  const metrics: Array<{ label: string; value: ReactNode; helper?: string }> = [
    { label: 'Selected Product', value: inquiry.productName?.trim() || 'No Product Linked' },
    { label: 'Selected Plan', value: inquiry.planName?.trim().replace(/\s*[-\u2013\u2014]\s*plan\s*$/i, '').trim() || 'No plan linked' },
    { label: 'Sum Insured', value: <CurrencyValue value={inquiry.totalInsured} /> },
    { label: 'Premium to be Charged', value: <CurrencyValue value={inquiry.totalCharge} />, helper: inquiry.paymentTerm || undefined },
    { label: 'Annual Base Rate', value: <>{formatAmount(inquiry.basePremium)}<span className="ml-0.5 text-[12px] font-normal text-muted-foreground">%</span></> },
    { label: 'Risk Score', value: <>{formatAmount(inquiry.riskScore)}<span className="ml-1 text-[12px] font-normal text-muted-foreground">/ 100</span></> },
  ]

  return (
    <section aria-label="Inquiry summary metrics" className="min-w-0 overflow-hidden rounded-xl border border-border-soft bg-[#FBFDFF] dark:bg-surface">
      <dl className="grid sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
        {metrics.map((metric, index) => (
          <div key={metric.label} className={cn(
            'min-w-0 space-y-2 border-border-soft px-4 py-4',
            index > 0 && 'border-t',
            index < 2 ? 'sm:border-t-0' : 'sm:border-t',
            index % 2 ? 'sm:border-l' : 'sm:border-l-0',
            index < 4 ? 'lg:border-t-0' : 'lg:border-t',
            index % 4 ? 'lg:border-l' : 'lg:border-l-0',
            '2xl:border-t-0',
            index > 0 ? '2xl:border-l' : '2xl:border-l-0',
          )}>
            <dt className="text-[12px] font-normal leading-5 text-muted-foreground">{metric.label}</dt>
            <dd className={cn('break-words font-semibold leading-6 text-foreground', metric.label === 'Selected Product' || metric.label === 'Selected Plan' ? 'text-[14px]' : 'text-[16px]')}>{metric.value}</dd>
            {metric.helper ? <dd className="break-words text-[12px] font-normal leading-5 text-muted-foreground">{metric.label === 'Premium to be Charged' ? <Badge variant="new" className="max-w-full whitespace-normal break-words px-2 py-0.5 text-[12px] font-normal shadow-none">{metric.helper}</Badge> : metric.helper}</dd> : null}
          </div>
        ))}
      </dl>
    </section>
  )
}
