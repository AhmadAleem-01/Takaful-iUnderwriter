import { UserRound, PackageSearch, Users, type LucideIcon } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { ReactNode } from 'react'
import type { BrokerInquiryDatum, ChartDatum } from '../../domain/app'
import { formatAmount } from '../../lib/formatters'
import { Card } from '../ui/Card'

const MIX_COLORS = ['#194F90', '#C5E0E8', '#4386B5', '#72AFAF', '#8CB9D4', '#386E85']
const share = (value: number, total: number) => total > 0 ? Math.round(value / total * 100) : 0

function MixPanel({ eyebrow, title, description, icon: Icon, children }: {
  eyebrow: string
  title: string
  description: string
  icon?: LucideIcon
  children: ReactNode
}) {
  return (
    <Card padding="none" className="flex min-w-0 flex-col rounded-xl bg-white px-5 pb-5 pt-4 shadow-none sm:px-6 sm:pb-6 dark:bg-surface">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-[12px] font-normal uppercase tracking-[0.08em] text-muted-foreground">{eyebrow}</p>
          <h2 className="text-[16px] font-semibold text-foreground">{title}</h2>
          <p className="text-[12px] font-normal leading-6 text-muted-foreground">{description}</p>
        </div>
        {Icon ? <Icon aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" /> : null}
      </div>
      {children}
    </Card>
  )
}

function MixStats({ items }: { items: Array<{ label: string; value: number }> }) {
  return (
    <dl className="my-4 flex flex-wrap gap-y-3">
      {items.map((item, index) => (
        <div key={item.label} className={'flex items-baseline gap-2 ' + (index ? 'ml-5 border-l border-border-soft pl-5' : '')}>
          <dd className="text-[26px] font-semibold leading-tight text-foreground">{formatAmount(item.value, 0)}</dd>
          <dt className="text-[12px] font-normal text-muted-foreground">{item.label}</dt>
        </div>
      ))}
    </dl>
  )
}

function MixEmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="flex min-h-[240px] flex-1 flex-col items-center justify-center gap-3 px-3 py-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border-soft bg-surface-soft text-primary dark:text-primary-light">
        <Icon aria-hidden="true" className="h-6 w-6" />
      </div>
      <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>
      <p className="max-w-[300px] text-[12px] font-normal leading-6 text-muted-foreground">{description}</p>
    </div>
  )
}

export function ProductMixPanel({ products }: { products: ChartDatum[] }) {
  const total = products.reduce((sum, item) => sum + item.value, 0)
  return (
    <MixPanel eyebrow="Product mix" title="Inquiry by Products" description="Where your inquiry demand is concentrated.">
      <MixStats items={[{ label: 'Products', value: products.length }, { label: 'Inquiries', value: total }]} />
      {total === 0 ? (
        <MixEmptyState icon={PackageSearch} title="No product-linked inquiries yet" description="Once inquiry records are linked with products, their share will appear here." />
      ) : (
        <div className="grid min-h-[240px] items-center gap-5 sm:grid-cols-[184px_minmax(0,1fr)]">
          <div role="img" aria-label={'Product distribution: ' + total + ' total inquiries. Details in the product table.'} className="relative mx-auto h-[184px] w-[184px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={products} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={68} outerRadius={92} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
                  {products.map((item, index) => <Cell key={item.label} fill={MIX_COLORS[index % MIX_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value) => [formatAmount(Number(value), 0), 'Inquiries']} contentStyle={{ fontFamily: 'Poppins, sans-serif', fontSize: 12, background: 'hsl(var(--surface))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border-soft))', borderRadius: 8 }} itemStyle={{ color: 'hsl(var(--foreground))' }} />
              </PieChart>
            </ResponsiveContainer>
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1">
              <p className="text-[26px] font-semibold text-foreground">{formatAmount(total, 0)}</p>
              <p className="text-[12px] font-normal text-muted-foreground">Total inquiries</p>
            </div>
          </div>
          <div role="region" aria-label="Product inquiry distribution" tabIndex={0} className="scrollbar-sleek max-h-[240px] min-w-0 overflow-auto rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <table className="w-full border-collapse text-left text-[12px] font-normal">
              <thead className="sticky top-0 z-10 bg-surface text-[12px] font-normal uppercase text-muted-foreground">
                <tr><th scope="col" className="border-b border-border-soft pb-3 pr-3 font-normal">Product</th><th scope="col" className="border-b border-border-soft pb-3 text-right font-normal">Inquiries</th></tr>
              </thead>
              <tbody>
                {products.map((item, index) => (
                  <tr key={item.label}>
                    <th scope="row" className="border-b border-border-soft py-4 pr-3 font-normal text-foreground">
                      <span className="flex items-center gap-2"><span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: MIX_COLORS[index % MIX_COLORS.length] }} /><span className="break-words">{item.label}</span></span>
                    </th>
                    <td className="whitespace-nowrap border-b border-border-soft py-4 text-right text-foreground">{formatAmount(item.value, 0)} <span className="text-muted-foreground">({share(item.value, total)}%)</span></td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-surface"><tr><th scope="row" className="py-3 pr-3 font-normal text-muted-foreground">Portfolio total</th><td className="py-3 text-right text-foreground">{formatAmount(total, 0)}</td></tr></tfoot>
            </table>
          </div>
        </div>
      )}
    </MixPanel>
  )
}

export function BrokerMixPanel({ brokers }: { brokers: BrokerInquiryDatum[] }) {
  const total = brokers.reduce((sum, item) => sum + item.value, 0)
  return (
    <MixPanel eyebrow="Broker mix" title="Inquiry by Brokers" description="Inquiry volume grouped by linked broker contacts." icon={Users}>
      <MixStats items={[{ label: 'Brokers', value: brokers.length }, { label: 'Linked inquiries', value: total }]} />
      {total === 0 ? (
        <MixEmptyState icon={UserRound} title="No broker-linked inquiries yet" description="As broker contacts are linked on inquiries, their intake share will start appearing here." />
      ) : (
        <div role="region" aria-label="Broker inquiry distribution" tabIndex={0} className="scrollbar-sleek max-h-[240px] min-h-[240px] space-y-6 overflow-y-auto rounded-sm pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          {brokers.map((broker, index) => {
            const initials = broker.label.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase()
            const percentage = share(broker.value, total)
            return (
              <div key={broker.id} className="space-y-3">
                <div className="flex items-start gap-3">
                  <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/[0.08] text-[12px] font-normal text-primary dark:text-primary-light">{initials || 'B'}</span>
                  <div className="min-w-0 flex-1 space-y-1"><p className="break-words text-[12px] font-normal text-foreground">{broker.label}</p><p className="text-[12px] font-normal text-muted-foreground">Linked broker contact</p></div>
                  <div className="shrink-0 space-y-1 text-right text-[12px] font-normal"><p className="text-foreground">{formatAmount(broker.value, 0)}</p><p className="text-muted-foreground">{percentage}%</p></div>
                </div>
                <div role="progressbar" aria-label={broker.label + ' share of linked inquiries'} aria-valuemin={0} aria-valuemax={total} aria-valuenow={broker.value} aria-valuetext={percentage + '%'} className="h-2 overflow-hidden rounded-full bg-surface-muted">
                  <div className="h-full rounded-full" style={{ width: (broker.value / total * 100) + '%', backgroundColor: MIX_COLORS[index % MIX_COLORS.length] }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </MixPanel>
  )
}
