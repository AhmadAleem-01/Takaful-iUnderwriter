import { Aur_quotesService } from '../generated/services/Aur_quotesService'
import { Aur_inquiriesService } from '../generated/services/Aur_inquiriesService'
import type { AnalyticsSnapshot } from '../domain/app'
import { countByType } from './dataMappers'

export async function getAnalyticsSnapshot(): Promise<AnalyticsSnapshot> {
  const [inquiriesResult, quotesResult] = await Promise.all([
    Aur_inquiriesService.getAll(),
    Aur_quotesService.getAll(),
  ])
  const inquiries = inquiriesResult.data ?? []
  const quotes = quotesResult.data ?? []

  const totalPremium = quotes.reduce((sum, item) => sum + (item.aur_total_premium ?? 0), 0)
  const averageRiskScore =
    inquiries.length === 0
      ? 0
      : Math.round(
          inquiries.reduce((sum, item) => sum + (item.aur_risk_score ?? 0), 0) /
            inquiries.length,
        )
  const wonQuotes = quotes.filter((item) => item.aur_quote_statusname === 'QuoteWon').length
  const inquiryTrend = countByType(inquiries)
  const premiumTrend = aggregateByDate(quotes, (quote) => quote.createdon, (quote) => quote.aur_total_premium ?? 0)
  const productDistribution = Array.from(
    inquiries.reduce((map, inquiry) => {
      const key = inquiry.aur_productname ?? 'Unassigned'
      map.set(key, (map.get(key) ?? 0) + 1)
      return map
    }, new Map<string, number>()),
  ).map(([label, value]) => ({ label, value }))
  const statusDistribution = Array.from(
    inquiries.reduce((map, inquiry) => {
      const key = inquiry.aur_underwriter_actionname ?? inquiry.statuscodename ?? 'Active'
      map.set(key, (map.get(key) ?? 0) + 1)
      return map
    }, new Map<string, number>()),
  ).map(([label, value]) => ({ label, value }))
  const riskDistribution = [
    {
      label: 'Low Risk',
      value: inquiries.filter((item) => (item.aur_risk_score ?? 0) >= 80).length,
    },
    {
      label: 'Medium Risk',
      value: inquiries.filter((item) => {
        const score = item.aur_risk_score ?? 0
        return score >= 60 && score < 80
      }).length,
    },
    {
      label: 'High Risk',
      value: inquiries.filter((item) => (item.aur_risk_score ?? 0) < 60).length,
    },
  ]
  const drilldown = Array.from(
    inquiries.reduce((map, inquiry) => {
      const key = inquiry.aur_productname ?? 'Unassigned'
      const current = map.get(key) ?? { label: key, inquiries: 0, quotes: 0, premium: 0 }
      current.inquiries += 1
      current.premium += inquiry.aur_total_premium_to_be_charged ?? 0
      map.set(key, current)
      return map
    }, new Map<string, { label: string; inquiries: number; quotes: number; premium: number }>()),
  )
    .map(([, value]) => {
      value.quotes = quotes.filter((quote) => quote.aur_productname === value.label).length
      return value
    })
    .sort((left, right) => right.premium - left.premium)

  const conversionFunnel = [
    {
      label: 'Inquiries',
      value: inquiries.length,
      helper: 'Total intake records received into the command center.',
      tone: 'primary' as const,
    },
    {
      label: 'Quoted',
      value: quotes.length,
      helper: 'Quotes currently assembled from active inquiry demand.',
      tone: 'info' as const,
    },
    {
      label: 'Won',
      value: wonQuotes,
      helper: 'Commercially won quotes ready for servicing follow-through.',
      tone: 'success' as const,
    },
    {
      label: 'Renewals',
      value: inquiries.filter((item) => item.aur_inquiry_typename === 'Renewal').length,
      helper: 'Renewal-driven operational volume requiring follow-up.',
      tone: 'warning' as const,
    },
  ]

  return {
    totalPremium,
    averageRiskScore,
    renewalLoad: inquiries.filter((item) => item.aur_inquiry_typename === 'Renewal').length,
    quoteWinRate: quotes.length === 0 ? 0 : Math.round((wonQuotes / quotes.length) * 100),
    inquiryTrend,
    premiumTrend,
    productDistribution,
    statusDistribution,
    riskDistribution,
    drilldown,
    conversionFunnel,
  }
}

function aggregateByDate<T>(
  records: T[],
  getDate: (record: T) => string | undefined,
  getValue: (record: T) => number,
) {
  const grouped = records.reduce((map, record) => {
    const rawDate = getDate(record)
    const date = rawDate ? new Date(rawDate) : undefined
    const label = date && !Number.isNaN(date.getTime())
      ? date.toLocaleDateString('en', { month: 'short', day: '2-digit' })
      : 'Unknown'
    map.set(label, (map.get(label) ?? 0) + getValue(record))
    return map
  }, new Map<string, number>())

  return Array.from(grouped, ([label, value]) => ({ label, value }))
}
