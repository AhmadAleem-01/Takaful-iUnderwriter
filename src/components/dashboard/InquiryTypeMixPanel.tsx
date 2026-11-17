import { ShieldCheck } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { DashboardMetrics } from '../../domain/app'
import { formatAmount } from '../../lib/formatters'
import { INQUIRY_MIX_COLORS, inquiryMixShare, inquiryMixTooltip, normalizeInquiryMix } from '../../lib/inquiryTypeMix'
import { Card } from '../ui/Card'

type InquiryTypeMetrics = Pick<DashboardMetrics, 'inquiryMix' | 'totalInquiries' | 'averageInquiryRiskScore' | 'scoredInquiryCount'>

export function InquiryTypeMixPanel({ metrics }: { metrics: InquiryTypeMetrics }) {
  const { totalInquiries, averageInquiryRiskScore, scoredInquiryCount } = metrics
  const mix = normalizeInquiryMix(metrics.inquiryMix)
  const renewalCount = mix.find((item) => item.label === 'Renewal')?.value ?? 0
  const renewalShare = inquiryMixShare(renewalCount, totalInquiries)
  const largestCount = Math.max(0, ...mix.map((item) => item.value))
  const tickStep = Math.max(1, Math.ceil(largestCount / 4))
  const axisMax = Math.max(2, Math.ceil(largestCount / tickStep) * tickStep)
  const ticks = Array.from({ length: axisMax / tickStep + 1 }, (_, index) => index * tickStep)

  return (
    <Card padding="none" className="min-w-0 rounded-xl bg-white px-5 pb-5 pt-4 shadow-none sm:px-6 sm:pb-6 xl:col-span-2 dark:bg-surface">
      <div className="space-y-1">
        <p className="text-[12px] font-normal uppercase tracking-[0.08em] text-muted-foreground">Intake mix</p>
        <h2 className="text-[16px] font-semibold text-foreground">Inquiry Type Mix</h2>
        <p className="text-[12px] font-normal leading-6 text-muted-foreground">Inquiry distribution across New, Renewal, Endorsement, and Claims.</p>
      </div>
      <div className="mt-4 grid items-stretch gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[12px] font-normal text-muted-foreground"><span className="uppercase tracking-[0.04em]">Inquiry count</span><span>{formatAmount(totalInquiries, 0)} total {totalInquiries === 1 ? 'inquiry' : 'inquiries'}</span></div>
          <div role="img" aria-label={'Inquiry distribution: ' + mix.map((item) => item.label + ' ' + item.value).join(', ')} className="h-[250px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mix} margin={{ top: 16, right: 10, bottom: 8, left: -12 }} accessibilityLayer>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border-soft))" />
                <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'hsl(var(--border-soft))' }} interval={0} height={42} tickMargin={12} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontFamily: 'Poppins, sans-serif', fontWeight: 400 }} />
                <YAxis domain={[0, axisMax]} ticks={ticks} allowDecimals={false} tickLine={false} axisLine={false} width={40} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontFamily: 'Poppins, sans-serif', fontWeight: 400 }} />
                <Tooltip cursor={{ fill: 'hsl(var(--primary) / 0.03)' }} content={({ active, payload }) => {
                  const item = payload?.[0]?.payload
                  if (!active || !item) return null
                  return <div className="rounded-md bg-[#1E304B] px-3 py-2 text-[12px] font-normal text-white shadow-sm">{inquiryMixTooltip(String(item.label), Number(item.value), totalInquiries)}</div>
                }} />
                <Bar dataKey="value" maxBarSize={78} minPointSize={2} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {mix.map((item, index) => <Cell key={item.label} fill={INQUIRY_MIX_COLORS[index % INQUIRY_MIX_COLORS.length]} />)}
                  <LabelList dataKey="value" position="top" offset={8} fill="hsl(var(--foreground))" fontSize={12} fontFamily="Poppins, sans-serif" fontWeight={400} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul aria-label="Inquiry type legend" className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2">
            {mix.map((item, index) => <li key={item.label} className="flex items-center gap-2 text-[12px] font-normal text-muted-foreground"><span aria-hidden="true" className="h-2 w-2 rounded-sm" style={{ backgroundColor: INQUIRY_MIX_COLORS[index % INQUIRY_MIX_COLORS.length] }} />{item.label}</li>)}
          </ul>
        </div>
        <aside aria-label="Renewal and risk summary" className="min-w-0 rounded-lg border border-border-soft bg-[#f6f8fb] p-5 dark:bg-surface-soft/50">
          <h3 className="text-[12px] font-normal text-muted-foreground">Renewals</h3>
          <p className="mt-3 flex flex-wrap items-baseline gap-2 text-foreground"><span className="text-[26px] font-semibold leading-tight">{formatAmount(renewalCount, 0)}</span><span className="text-[12px] font-normal text-muted-foreground">{renewalCount === 1 ? 'inquiry' : 'inquiries'}</span></p>
          <p className="mt-2 text-[12px] font-normal leading-5 text-muted-foreground">{renewalShare}% of this intake mix</p>
          <div role="progressbar" aria-label="Renewal share of intake" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.max(0, renewalShare))} className="mt-3 h-1 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full bg-[#C5E0E8]" style={{ width: Math.min(100, Math.max(0, renewalShare)) + '%' }} /></div>
          <div className="mt-5 border-t border-border-soft pt-4">
            <div className="flex items-center justify-between gap-2"><h3 className="text-[12px] font-normal text-muted-foreground">Average Risk</h3><ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" /></div>
            <p className="mt-3 text-[26px] font-semibold leading-tight text-foreground">{averageInquiryRiskScore == null ? '—' : formatAmount(averageInquiryRiskScore, 0)}</p>
            <p className="mt-3 text-[12px] font-normal leading-6 text-muted-foreground">{averageInquiryRiskScore == null ? 'Risk scores have not been provided.' : 'Based on ' + formatAmount(scoredInquiryCount, 0) + ' scored ' + (scoredInquiryCount === 1 ? 'inquiry.' : 'inquiries.')}</p>
          </div>
        </aside>
      </div>
    </Card>
  )
}
