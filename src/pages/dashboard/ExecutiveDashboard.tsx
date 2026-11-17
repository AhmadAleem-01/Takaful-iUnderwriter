import {
  ArrowRight,
  ArrowRightLeft,
  FileText,
  LayoutTemplate,
  Link2,
  Mail,
  ShieldCheck,
} from 'lucide-react'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useRole } from '../../hooks/useRole'
import { getDashboardMetrics } from '../../services/dashboardService'
import { Card } from '../../components/ui/Card'
import { formatAmount, formatCompactNumber } from '../../lib/formatters'
import { DashboardSkeleton } from '../../components/dashboard/DashboardSkeleton'
import { ProductMixPanel, BrokerMixPanel } from '../../components/dashboard/InquiryMixPanels'
import { ConversionFlowPanel } from '../../components/dashboard/ConversionFlowPanel'
import { ReinsuranceProductPanel, ReinsurancePlanPanel } from '../../components/dashboard/ReinsurancePanels'
import { InquiryTypeMixPanel } from '../../components/dashboard/InquiryTypeMixPanel'

export function DashboardPage() {
  const { user } = useRole()
  const { data, loading, error } = useAsyncData(getDashboardMetrics, [])

  if (loading) return <DashboardSkeleton />

  if (error || !data) {
    return (
      <Card className="space-y-3">
        <h2 className="text-xl font-semibold">Dashboard failed to load</h2>
        <p className="text-sm text-muted-foreground">
          {error ?? 'Unable to load executive metrics from Dataverse.'}
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <section aria-label="Welcome and portfolio overview" className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card padding="none" className="min-w-0 overflow-hidden rounded-xl bg-white shadow-none dark:bg-surface">
          <div className="space-y-2 border-b border-border-soft px-5 py-5 sm:px-6">
            <h1 className="break-words text-[26px] font-bold leading-snug text-foreground">{data.greeting}, {user.name.replace(/\.+$/, '')}.</h1>
            <p className="max-w-2xl text-[12px] font-normal leading-6 text-muted-foreground">{data.heroDescription}</p>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:px-6 sm:py-5">
            {data.heroMetrics.map((metric) => {
              const isReinsurance = metric.label.includes('Reinsurance')
              const isBrokerEmails = metric.label === 'Broker Emails'
              const Icon = isReinsurance ? ShieldCheck : isBrokerEmails ? Mail : FileText
              const target = isReinsurance ? 'dashboard-reinsurance' : isBrokerEmails ? 'dashboard-intake' : 'dashboard-conversion'
              const linkLabel = isReinsurance ? 'View revenue breakdown' : isBrokerEmails ? 'View intake signal' : 'Explore conversion'
              return (
                <div key={metric.label} className={'min-w-0 rounded-[10px] border border-[#E2E8F0] bg-surface-soft/40 px-4 py-4 dark:border-border dark:bg-surface-soft/30 ' + (isReinsurance ? 'sm:col-start-1' : '')}>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-[14px] font-semibold text-foreground">{metric.label}</h2>
                    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/[0.08] text-primary dark:text-primary-light">
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                  </div>
                  <div className="mt-2 flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                    {isReinsurance ? <span className="text-[12px] font-normal text-muted-foreground">AED</span> : null}
                    <p className="min-w-0 text-[34px] font-bold leading-tight text-foreground [overflow-wrap:anywhere] sm:text-[38px]">
                      {isReinsurance ? formatAmount(metric.value, 0) : formatCompactNumber(metric.value)}
                    </p>
                    {!isReinsurance ? <span className="text-[12px] font-normal text-muted-foreground">{isBrokerEmails ? 'linked emails' : 'inquiries received'}</span> : null}
                  </div>
                  <p className="mt-2 text-[12px] font-normal leading-6 text-muted-foreground">{metric.helper}</p>
                  <a href={'#' + target} onClick={(event) => {
                    const section = document.getElementById(target)
                    if (section) {
                      event.preventDefault()
                      section.scrollIntoView({ block: 'start' })
                    }
                  }} className="mt-3 inline-flex items-center gap-2 rounded text-[12px] font-normal text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary dark:text-primary-light">
                    {linkLabel}<ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                  </a>
                </div>
              )
            })}
          </div>
        </Card>
        <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-rows-3">
          {data.insightCards.map((insight, index) => {
            const Icon = index === 0 ? Link2 : index === 1 ? ArrowRightLeft : LayoutTemplate
            return (
              <Card key={insight.title} id={index === 0 ? 'dashboard-intake' : undefined} padding="none" className="min-w-0 scroll-mt-24 rounded-xl bg-white p-5 shadow-none dark:bg-surface">
                <div className="flex items-start gap-3">
                  <Icon aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] shrink-0 text-primary dark:text-primary-light" />
                  <div className="min-w-0 space-y-2">
                    <h2 className="text-[14px] font-semibold text-foreground">{insight.title}</h2>
                    <p className="break-words text-[12px] font-normal leading-6 text-muted-foreground">{insight.text}</p>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <ProductMixPanel products={data.topProducts} />
        <BrokerMixPanel brokers={data.inquiryByBrokers} />

        <ConversionFlowPanel metrics={data} />

        <ReinsuranceProductPanel products={data.wonPremiumByProduct} total={data.wonPremiumTotal} wonQuotes={data.wonQuotes} />
        <ReinsurancePlanPanel plans={data.wonPremiumByPlan} total={data.wonPremiumTotal} />

        <InquiryTypeMixPanel metrics={data} />
      </div>
    </div>
  )
}
