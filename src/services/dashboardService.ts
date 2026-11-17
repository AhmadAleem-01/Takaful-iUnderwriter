import { ContactsService } from '../generated/services/ContactsService'
import { TemplatesService } from '../generated/services/TemplatesService'
import { Aur_custom_document_templatesesService } from '../generated/services/Aur_custom_document_templatesesService'
import { Aur_plansService } from '../generated/services/Aur_plansService'
import { Aur_productsesService } from '../generated/services/Aur_productsesService'
import { Aur_quotesService } from '../generated/services/Aur_quotesService'
import { Aur_inquiriesService } from '../generated/services/Aur_inquiriesService'
import { EmailsService } from '../generated/services/EmailsService'
import type { BrokerInquiryDatum, DashboardMetrics } from '../domain/app'
import {
  countByType,
  isRenewal,
  mapInquirySummary,
  mapQuoteSummary,
} from './dataMappers'

function normalizeDataverseId(value?: string | null) {
  return (value ?? '').trim().replace(/[{}]/g, '').toLowerCase()
}

function isPreviewMode() {
  return !window.location.hostname.includes('powerapps.com') &&
    !window.location.hostname.includes('powerplatformusercontent.com')
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const [inquiriesResult, quotesResult, emailTemplatesResult, documentTemplatesResult, emailsResult, productsResult, plansResult, contactsResult] =
    await Promise.all([
      Aur_inquiriesService.getAll({ orderBy: ['createdon desc'] }),
      Aur_quotesService.getAll({ orderBy: ['createdon desc'] }),
      TemplatesService.getAll().catch(() => ({ data: [] })),
      Aur_custom_document_templatesesService.getAll().catch(() => ({ data: [] })),
      EmailsService.getAll({ orderBy: ['createdon desc'] }).catch(() => ({ data: [] })),
      Aur_productsesService.getAll().catch(() => ({ data: [] })),
      Aur_plansService.getAll().catch(() => ({ data: [] })),
      ContactsService.getAll({ select: ['contactid', 'fullname', 'firstname', 'lastname'] }).catch(() => ({ data: [] })),
    ])

  const inquiries = inquiriesResult.data ?? []
  const quotes = quotesResult.data ?? []
  const emailTemplates = emailTemplatesResult.data ?? []
  const documentTemplates = documentTemplatesResult.data ?? []
  const emails = emailsResult.data ?? []
  const productMap = new Map(
    (productsResult.data ?? []).map((item) => [normalizeDataverseId(item.aur_productsid), item.aur_name]),
  )
  const planMap = new Map(
    (plansResult.data ?? []).map((item) => [normalizeDataverseId(item.aur_planid), item.aur_name ?? 'Unnamed Plan']),
  )
  const contactMap = new Map(
    (contactsResult.data ?? []).map((item) => [normalizeDataverseId(item.contactid), item]),
  )
  const inquiryCatalog = new Map(
    inquiries.map((item) => [
      normalizeDataverseId(item.aur_inquiryid),
      {
        name: item.aur_name || item.aur_inquiry_number || 'Unnamed inquiry',
        inquiryNumber: item.aur_inquiry_number || 'Draft',
      },
    ]),
  )
  const inquiryIds = new Set(inquiries.map((item) => normalizeDataverseId(item.aur_inquiryid)))
  const wonQuotes = quotes.filter((quote) => quote.statuscode === 751820001)
  const brokerEmails = emails.filter((email) =>
    inquiryIds.has(normalizeDataverseId(email._regardingobjectid_value)),
  )
  const wonPremiumTotal = Math.round(wonQuotes.reduce((sum, item) => sum + (item.aur_total_premium ?? 0), 0))
  const inquiryToQuoteConversionRate = inquiries.length === 0 ? 0 : Math.round((quotes.length / inquiries.length) * 100)
  const quoteToWonConversionRate = quotes.length === 0 ? 0 : Math.round((wonQuotes.length / quotes.length) * 100)

  const resolveProductName = (productName?: string | null, productId?: string | null) =>
    productName?.trim() || productMap.get(normalizeDataverseId(productId)) || 'Unassigned Product'

  const resolvePlanName = (planName?: string | null, planId?: string | null) =>
    planName?.trim() || planMap.get(normalizeDataverseId(planId)) || 'Unassigned Plan'

  const topProducts = Array.from(
    inquiries.reduce((map, inquiry) => {
      const key = resolveProductName(inquiry.aur_productname, inquiry._aur_product_value)
      map.set(key, (map.get(key) ?? 0) + 1)
      return map
    }, new Map<string, number>()),
  )
    .sort((left, right) => right[1] - left[1])
    .map(([label, value]) => ({ label, value }))

  const inquiryByBrokers = Array.from(
    inquiries.reduce((map, inquiry) => {
      const id = normalizeDataverseId(inquiry._aur_broker_contact_value)
      if (!id) return map
      const contact = contactMap.get(id)
      const label = contact?.fullname?.trim() ||
        [contact?.firstname, contact?.lastname].filter(Boolean).join(' ').trim() ||
        inquiry.aur_broker_contactname?.trim()
      const group = map.get(id) ?? { id, label: label || 'Unnamed broker contact', value: 0 }
      if (group.label === 'Unnamed broker contact' && label) group.label = label
      group.value += 1
      map.set(id, group)
      return map
    }, new Map<string, BrokerInquiryDatum>()).values(),
  ).sort((left, right) => right.value - left.value || left.label.localeCompare(right.label) || left.id.localeCompare(right.id))

  const wonPremiumByProduct = Array.from(
    wonQuotes.reduce((map, quote) => {
      const label = resolveProductName(quote.aur_productname, quote._aur_product_value)
      const group = map.get(label) ?? { value: 0, wonQuotes: 0 }
      group.value += quote.aur_total_premium ?? 0
      group.wonQuotes += 1
      map.set(label, group)
      return map
    }, new Map<string, { value: number; wonQuotes: number }>()),
    ([label, group]) => ({ label, value: Math.round(group.value), wonQuotes: group.wonQuotes }),
  ).sort((left, right) => right.value - left.value)

  const planRecords = new Map((plansResult.data ?? []).map((plan) => [normalizeDataverseId(plan.aur_planid), plan]))
  const wonPremiumByPlan = Array.from(
    wonQuotes.reduce((map, quote) => {
      const label = resolvePlanName(quote.aur_planname, quote._aur_plan_value)
      const group = map.get(label) ?? { value: 0, wonQuotes: 0, products: new Set<string>() }
      const plan = planRecords.get(normalizeDataverseId(quote._aur_plan_value))
      group.value += quote.aur_total_premium ?? 0
      group.wonQuotes += 1
      group.products.add(resolveProductName(quote.aur_productname, quote._aur_product_value || plan?._aur_product_value))
      map.set(label, group)
      return map
    }, new Map<string, { value: number; wonQuotes: number; products: Set<string> }>()),
    ([label, group]) => ({ label, value: Math.round(group.value), wonQuotes: group.wonQuotes, productName: [...group.products].sort().join(', ') }),
  ).sort((left, right) => right.value - left.value)

  const brokerEmailTrend = Array.from(
    brokerEmails.reduce((map, email) => {
      const date = email.createdon ? new Date(email.createdon) : undefined
      const label = date && !Number.isNaN(date.getTime())
        ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : 'Unknown'
      map.set(label, (map.get(label) ?? 0) + 1)
      return map
    }, new Map<string, number>()),
  )
    .slice(-7)
    .map(([label, value]) => ({ label, value }))

  const brokerEmailByInquiry = Array.from(
    brokerEmails.reduce((map, email) => {
      const inquiryId = normalizeDataverseId(email._regardingobjectid_value)
      const inquiry = inquiryCatalog.get(inquiryId)
      const key = inquiry
        ? `${inquiry.inquiryNumber}`
        : 'Unlinked'
      map.set(key, (map.get(key) ?? 0) + 1)
      return map
    }, new Map<string, number>()),
  )
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([label, value]) => ({ label, value }))

  const emailStatusMix = Array.from(
    brokerEmails.reduce((map, email) => {
      const key = email.statuscodename ?? (email.statuscode !== undefined ? `Status ${email.statuscode}` : 'Unknown')
      map.set(key, (map.get(key) ?? 0) + 1)
      return map
    }, new Map<string, number>()),
  )
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([label, value]) => ({ label, value }))

  const riskScores = inquiries.map((inquiry) => inquiry.aur_risk_score)
    .filter((score): score is number => typeof score === 'number' && Number.isFinite(score))

  return {
    averageInquiryRiskScore: riskScores.length > 0 ? Math.round(riskScores.reduce((sum, score) => sum + score, 0) / riskScores.length) : null,
    scoredInquiryCount: riskScores.length,
    previewMode: isPreviewMode(),
    greeting: 'Welcome back',
    heroDescription:
      'Monitor broker-driven intake, inquiry conversion, won premium performance, and live underwriting momentum from a calmer executive command center.',
    heroMetrics: [
      {
        label: 'Broker Emails',
        value: brokerEmails.length,
        helper: 'Email activities currently linked to inquiry records',
        tone: 'primary',
      },
      {
        label: 'Total Inquiries',
        value: inquiries.length,
        helper: `${quotes.length} quotes generated from the intake pipeline`,
        tone: 'success',
      },
      {
        label: 'Reinsurance',
        value: wonPremiumTotal,
        helper: `${wonQuotes.length} quotes are currently won`,
        tone: 'secondary',
      },
    ],
    brokerEmailCount: brokerEmails.length,
    brokerEmailByInquiry,
    emailStatusMix,
    totalInquiries: inquiries.length,
    totalQuotes: quotes.length,
    wonQuotes: wonQuotes.length,
    wonPremiumTotal,
    inquiryToQuoteConversionRate,
    quoteToWonConversionRate,
    brokerEmailTrend,
    wonPremiumByProduct,
    wonPremiumByPlan,
    inquiryByBrokers,
    inquiryKpis: [
      {
        label: 'Total Inquiries',
        value: inquiries.length,
        helper: 'All intake submissions captured in Dataverse',
        tone: 'primary',
      },
      {
        label: 'In Progress',
        value: inquiries.filter((item) => item.aur_underwriter_action === 1).length,
        helper: 'Active inquiry records under review',
        tone: 'warning',
      },
      {
        label: 'Average Risk Score',
        value:
          inquiries.length === 0
            ? 0
            : Math.round(
                inquiries.reduce((sum, item) => sum + (item.aur_risk_score ?? 0), 0) /
                  inquiries.length,
              ),
        helper: 'Live average across inquiry records',
        tone: 'secondary',
      },
    ],
    quoteKpis: [
      {
        label: 'Quotes Generated',
        value: quotes.length,
        helper: `${wonQuotes.length} marked won`,
        tone: 'success',
      },
      {
        label: 'Reinsurance',
        value: wonPremiumTotal,
        helper: 'Won premium across the portfolio',
        tone: 'info',
      },
      {
        label: 'Lost Quotes',
        value: quotes.filter((item) => item.statuscode === 751820002).length,
        helper: 'Outcome reasons remain visible for review',
        tone: 'danger',
      },
    ],
    renewalKpis: [
      {
        label: 'Renewal Due',
        value: inquiries.filter(isRenewal).length,
        helper: 'Renewal workload derived from inquiry type',
        tone: 'warning',
      },
      {
        label: 'Template Library',
        value: documentTemplates.length,
        helper: 'Dataverse-backed custom document templates',
        tone: 'info',
      },
      {
        label: 'Email Templates',
        value: emailTemplates.length,
        helper: 'Communication templates ready for workflows',
        tone: 'secondary',
      },
    ],
    inquiryMix: countByType(inquiries),
    quoteStatusMix: Array.from(
      quotes.reduce((map, quote) => {
        const key = quote.statuscode === 751820001 ? 'Quote Won' : quote.statuscode === 751820002 ? 'Quote Lost' : quote.statuscodename ?? 'Active'
        map.set(key, (map.get(key) ?? 0) + 1)
        return map
      }, new Map<string, number>()),
    ).map(([label, value]) => ({ label, value })),
    topProducts,
    recentInquiries: inquiries.slice(0, 5).map(mapInquirySummary),
    recentQuotes: quotes.slice(0, 5).map(mapQuoteSummary),
    insightCards: [
      {
        title: 'Broker intake signal',
        text: isPreviewMode()
          ? 'Preview mode is active, but the dashboard layout remains available while live Dataverse metrics continue to hydrate from the local code app runtime.'
          : `${brokerEmails.length} broker-linked emails are currently connected to inquiry records in the hosted runtime.`,
        tone: 'info',
      },
      {
        title: 'Conversion focus',
        text: `${quotes.length} quotes exist for ${inquiries.length} inquiries, with ${wonQuotes.length} already moved into won outcome.`,
        tone: 'warning',
      },
      {
        title: 'Template readiness',
        text: `${emailTemplates.length} email templates and ${documentTemplates.length} document templates remain available for downstream communication and export workflows.`,
        tone: 'success',
      },
    ],
  }
}
