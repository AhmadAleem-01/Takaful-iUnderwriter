import { ChartBarIncreasing, Layers3, Wallet, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ReinsuranceBreakdownDatum } from '../../domain/app'
import { formatAmount, formatCurrency } from '../../lib/formatters'
import { Card } from '../ui/Card'

const COLORS = ['#194F90', '#C5E0E8', '#4386B5', '#72AFAF', '#8CB9D4', '#386E85']

function ReinsurancePanel({ id, eyebrow, title, description, icon: Icon, children }: {
  id?: string; eyebrow: string; title: string; description: string; icon: LucideIcon; children: ReactNode
}) {
  return (
    <Card id={id} padding="none" className="flex min-w-0 scroll-mt-24 flex-col rounded-xl bg-white px-5 pb-5 pt-4 shadow-none sm:px-6 sm:pb-6 dark:bg-surface">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-[12px] font-normal uppercase tracking-[0.08em] text-muted-foreground">{eyebrow}</p>
          <h2 className="text-[16px] font-semibold text-foreground">{title}</h2>
          <p className="text-[12px] font-normal leading-6 text-muted-foreground">{description}</p>
        </div>
        <Icon aria-hidden="true" className="mt-2 h-5 w-5 shrink-0 text-muted-foreground" />
      </div>
      {children}
    </Card>
  )
}

function Summary({ items }: { items: Array<{ label: string; value: number; currency?: boolean }> }) {
  return (
    <dl className="mb-5 mt-5 flex flex-wrap gap-y-3">
      {items.map((item, index) => (
        <div key={item.label} className={'flex min-w-0 flex-col gap-2 ' + (index ? 'ml-5 border-l border-border-soft pl-5 sm:ml-7 sm:pl-7' : '')}>
          <dt className="order-2 text-[12px] font-normal text-muted-foreground">{item.label}</dt>
          <dd className="flex flex-wrap items-baseline gap-x-1.5 text-foreground">{item.currency ? <span className="text-[12px] font-normal">AED</span> : null}<span className="break-words text-[26px] font-semibold leading-tight">{formatAmount(item.value, 0)}</span></dd>
        </div>
      ))}
    </dl>
  )
}

function ReinsuranceEmpty({ plan = false }: { plan?: boolean }) {
  const Icon = plan ? Layers3 : ChartBarIncreasing
  return (
    <div className="flex min-h-[240px] flex-1 flex-col items-center justify-center gap-3 px-3 py-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border-soft bg-surface-soft text-primary dark:text-primary-light"><Icon aria-hidden="true" className="h-6 w-6" /></div>
      <h3 className="text-[14px] font-semibold text-foreground">{plan ? 'No reinsurance by plan yet' : 'No reinsurance by product yet'}</h3>
      <p className="max-w-[300px] text-[12px] font-normal leading-6 text-muted-foreground">{plan ? 'Plan-linked reinsurance will appear here once quotes with plans are marked won.' : 'Product reinsurance will appear here as quote outcomes mature into won status.'}</p>
    </div>
  )
}

export function ReinsuranceProductPanel({ products, total, wonQuotes }: { products: ReinsuranceBreakdownDatum[]; total: number; wonQuotes: number }) {
  return (
    <ReinsurancePanel id="dashboard-reinsurance" eyebrow="Revenue lens" title="Reinsurance by Product" description="Total reinsurance value of won quotes by product." icon={Wallet}>
      <Summary items={[{ label: 'Reinsurance', value: total, currency: true }, { label: 'Won quotes', value: wonQuotes }]} />
      {products.length === 0 ? <ReinsuranceEmpty /> : (
        <div role="region" aria-label="Reinsurance distribution by product" tabIndex={0} className="scrollbar-sleek max-h-[260px] min-h-[240px] space-y-6 overflow-y-auto rounded-sm pr-1 pt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          {products.map((product, index) => {
            const percentage = total > 0 ? product.value / total * 100 : 0
            const fill = Math.min(100, Math.max(0, percentage))
            return (
              <div key={product.label} className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[12px] font-normal">
                  <div className="flex min-w-0 items-center gap-2"><span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }} /><span className="break-words text-foreground">{product.label}</span></div>
                  <span className="text-foreground">{formatCurrency(product.value)}</span>
                </div>
                <div role="progressbar" aria-label={product.label + ' reinsurance share'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={fill} aria-valuetext={percentage.toFixed(1) + '%'} className="h-2 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full" style={{ width: fill + '%', backgroundColor: COLORS[index % COLORS.length] }} /></div>
                <p className="text-[12px] font-normal leading-5 text-muted-foreground">{product.wonQuotes} {product.wonQuotes === 1 ? 'won quote' : 'won quotes'} · {percentage.toFixed(1)}% of reinsurance</p>
              </div>
            )
          })}
        </div>
      )}
    </ReinsurancePanel>
  )
}

export function ReinsurancePlanPanel({ plans, total }: { plans: ReinsuranceBreakdownDatum[]; total: number }) {
  return (
    <ReinsurancePanel eyebrow="Plan view" title="Reinsurance by Plan" description="Won quote reinsurance grouped by the selected plan." icon={Layers3}>
      <Summary items={[{ label: 'Plans tracked', value: plans.length }, { label: 'Reinsurance', value: total, currency: true }]} />
      {plans.length === 0 ? <ReinsuranceEmpty plan /> : (
        <div role="region" aria-label="Reinsurance distribution by plan" tabIndex={0} className="scrollbar-sleek max-h-[260px] min-h-[240px] overflow-auto rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <table className="w-full border-collapse text-left text-[12px] font-normal">
            <thead className="sticky top-0 z-10 bg-surface uppercase text-muted-foreground"><tr><th scope="col" className="border-b border-border-soft pb-3 pr-3 font-normal">Plan</th><th scope="col" className="border-b border-border-soft pb-3 pr-3 text-center font-normal">Won</th><th scope="col" className="border-b border-border-soft pb-3 text-right font-normal">Reinsurance</th></tr></thead>
            <tbody>
              {plans.map((plan, index) => (
                <tr key={plan.label}>
                  <th scope="row" className="border-b border-border-soft py-4 pr-3 font-normal"><div className="flex items-start gap-2"><span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }} /><div className="min-w-0 space-y-1"><p className="break-words text-foreground">{plan.label}</p><p className="break-words text-muted-foreground">{plan.productName}</p></div></div></th>
                  <td className="border-b border-border-soft py-4 pr-3 text-center text-foreground">{formatAmount(plan.wonQuotes, 0)}</td>
                  <td className="whitespace-nowrap border-b border-border-soft py-4 text-right text-foreground">{formatCurrency(plan.value)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 bg-surface"><tr><th scope="row" colSpan={2} className="py-3 font-normal text-muted-foreground">Total</th><td className="py-3 text-right text-foreground">{formatCurrency(total)}</td></tr></tfoot>
          </table>
        </div>
      )}
    </ReinsurancePanel>
  )
}
