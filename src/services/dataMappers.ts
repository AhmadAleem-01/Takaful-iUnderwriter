import type { Aur_inquiries } from '../generated/models/Aur_inquiriesModel'
import { inquiryTypeLabel } from './inquiryTypeOptions'
import { INQUIRY_STATUS_OPTIONS } from './inquiryStatusOptions'
import type { Aur_quotes } from '../generated/models/Aur_quotesModel'
import type { Aur_productses } from '../generated/models/Aur_productsesModel'
import type { Aur_ai_extracted_responses } from '../generated/models/Aur_ai_extracted_responsesModel'
import type { Accounts } from '../generated/models/AccountsModel'
import type { Contacts } from '../generated/models/ContactsModel'
import type {
  EmailTemplateSummary,
  DocumentTemplateSummary,
  InquiryDetail,
  InquirySummary,
  ProductSummary,
  QuoteDetail,
  QuoteResponse,
  QuoteSummary,
  RelatedParty,
  RenewalSummary,
  WorkflowStep,
} from '../domain/app'

export function mapProductSummary(
  product: Aur_productses,
  totals?: { inquiryVolume: number; premiumTotal: number; insuredTotal: number },
): ProductSummary {
  return {
    id: product.aur_productsid,
    name: product.aur_name,
    shortDetails: product.aur_short_details ?? product.aur_details ?? 'Product admin workspace and form-builder source.',
    status: product.aur_product_statusname ?? product.statuscodename ?? 'Draft',
    inquiryVolume: totals?.inquiryVolume ?? 0,
    premiumTotal: totals?.premiumTotal ?? 0,
    insuredTotal: totals?.insuredTotal ?? 0,
    emailAddress: product.aur_incomingemailaddress ?? '',
    heading: product.aur_heading ?? product.aur_buy_heading ?? product.aur_slogan ?? '',
  }
}

type InquiryRecord = Aur_inquiries & {
  aur_brokername?: string
  aur_vehicle_value?: string | null
  aur_tpa?: string | null
  aur_tpa_network?: number | null
  aur_tpa_networkname?: string | null
  'aur_tpa_network@OData.Community.Display.V1.FormattedValue'?: string
  'statuscode@OData.Community.Display.V1.FormattedValue'?: string
}

export function mapInquirySummary(record: InquiryRecord): InquirySummary {
  const accountName = record.aur_accountname?.trim() || 'No account linked'
  const brokerName =
    record.aur_brokername?.trim() ||
    record.aur_accountname?.trim() ||
    'No broker linked'

  return {
    id: record.aur_inquiryid,
    name: record.aur_name,
    inquiryNumber: record.aur_inquiry_number ?? `INQ-${record.aur_inquiryid.slice(0, 8).toUpperCase()}`,
    inquiryType: record.aur_inquiry_typename ?? inquiryTypeLabel(record.aur_inquiry_type) ?? '',
    inquiryTypeValue: record.aur_inquiry_type ? Number(record.aur_inquiry_type) : undefined,
    status: inquiryLifecycleStatusLabel(
      record['statuscode@OData.Community.Display.V1.FormattedValue'],
      record.statuscodename,
      record.statuscode,
      record.statecodename,
      record.statecode,
    ) ?? 'Status unavailable',
    inquiryStatusValue: inquiryLifecycleStatusValue(record.statuscode, record.statecode),
    accountId: record._aur_account_value,
    accountName,
    contactName: record.aur_contactname ?? 'No contact linked',
    brokerId: record._aur_account_value,
    brokerName,
    productId: record._aur_product_value,
    productName: record.aur_productname ?? 'No Product Linked',
    planId: record._aur_plan_value,
    planName: record.aur_planname ?? 'No plan linked',
    riskScore: record.aur_risk_score ?? 0,
    grossPremium: record.aur_gross_premium ?? 0,
    totalInsured: record.aur_total_sum_insured ?? 0,
    createdOn: record.createdon ?? '',
    summary: record.aur_ai_generated_summary ?? record.aur_risk_summary ?? 'Awaiting underwriting summary.',
    sharepointUrl: record.aur_sharepoint_url ?? '',
  }
}

export function mapInquiryDetail(
  record: InquiryRecord,
  quotes: QuoteSummary[],
  quoteDetails: QuoteResponse[],
  workflow: WorkflowStep[],
  account?: RelatedParty,
  contact?: RelatedParty,
  broker?: RelatedParty,
): InquiryDetail {
  const inquiryRecord = record
  const summary = mapInquirySummary(record)
  const resolvedAccountName = account?.name?.trim() || summary.accountName
  const resolvedContactName = contact?.name?.trim() || summary.contactName
  const resolvedBrokerName =
    broker?.name?.trim() ||
    account?.name?.trim() ||
    summary.brokerName
  const readiness = [
    {
      label: 'Overall Completeness',
      value: buildCompletenessScore(record),
      description: 'Measures how much of the underwriting input is already captured.',
    },
    {
      label: 'Information Capture',
      value: record.aur_contactname ? 82 : 48,
      description: 'Based on client, product, plan, and financial context fields.',
    },
    {
      label: 'Document Readiness',
      value: record.aur_sharepoint_url ? 88 : 34,
      description: 'Reflects whether linked document storage is already available.',
    },
    {
      label: 'Senior Review Readiness',
      value: record.aur_risk_score && record.aur_risk_score >= 70 ? 79 : 54,
      description: 'Shows how prepared the file is for escalation or formal review.',
    },
  ]

  return {
    ...summary,
    accountName: resolvedAccountName,
    contactName: resolvedContactName,
    brokerName: resolvedBrokerName,
    riskDescription: record.aur_risk_description ?? '',
    paymentTerm: record.aur_payment_termname ?? 'Annual',
    territorialScope: record.aur_territorial_scope ?? 'Not specified',
    coverType: record.aur_cover_typename ?? 'Not specified',
    planDetails: inquiryRecord.aur_plan_details ?? '',
    fee: record.aur_fees ?? 0,
    declaredValue: record.aur_declared_value ?? 0,
    basePremium: inquiryRecord.aur_base_premium ?? 0,
    vehicleValue: inquiryRecord.aur_vehicle_value ?? '',
    customerData: inquiryRecord.aur_customer_information ?? '',
    aiEvaluationJsonResponse: inquiryRecord.aur_ai_evaluation_json_response ?? '',
    tpa: inquiryRecord.aur_tpa ?? '',
    tpaNetworkValue: inquiryRecord.aur_tpa_network,
    tpaNetworkLabel: inquiryRecord.aur_tpa_networkname || inquiryRecord['aur_tpa_network@OData.Community.Display.V1.FormattedValue'] || '',
    underwriterActionStatus: inquiryRecord.aur_underwriter_action,
    underwriterSubAction: inquiryRecord.aur_underwriter_sub_action,
    totalCharge: record.aur_total_premium_to_be_charged ?? 0,
    actionApplied: Boolean(inquiryRecord.aur_action_applied),
    aiSummary: record.aur_ai_generated_summary ?? record.aur_risk_summary ?? 'AI summary is not available yet.',
    account,
    contact,
    broker,
    quotes,
    quoteDetails,
    readiness,
    workflow,
    consequences: [],
    consequenceResults: [],
    aiRuleGroups: [],
    emailTimeline: [],
    riCapacityChecks: [],
  }
}

export function mapQuoteSummary(record: Aur_quotes): QuoteSummary {
  return {
    id: record.aur_quoteid,
    inquiryId: record._aur_quotes_value ?? '',
    name: record.aur_name,
    status: record.aur_quote_statusname ?? quoteStatusLabel(record.aur_quote_status) ?? record.statuscodename ?? 'Active',
    quoteStatusValue: record.aur_quote_status ? Number(record.aur_quote_status) : undefined,
    productName: record.aur_productname ?? 'No Product Linked',
    planName: record.aur_planname ?? 'No plan linked',
    totalPremium: record.aur_total_premium ?? 0,
    grossPremium: record.aur_gross_premium ?? 0,
    vat: record.aur_vat ?? 0,
    aiSummary: record.aur_ai_generated_summary ?? 'No AI quote summary yet.',
    reason: record.aur_reason ?? 'No outcome reason captured.',
    createdOn: record.createdon ?? '',
  }
}

export function mapQuoteDetail(
  record: Aur_quotes,
  inquiry: InquirySummary | undefined,
  responses: QuoteResponse[],
  emailTemplates: EmailTemplateSummary[],
  documentTemplates: DocumentTemplateSummary[],
): QuoteDetail {
  const summary = mapQuoteSummary(record)
  return {
    ...summary,
    loadingPremium: record.aur_loading_premium ?? 0,
    benefitsName: record.aur_benefitsname ?? 'No benefits linked',
    coverageName: record.aur_coveragename ?? 'No coverages linked',
    deductibleName: record.aur_deductiblesname ?? 'No deductibles linked',
    exclusionName: record.aur_exclusionsname ?? 'No exclusions linked',
    inclusionName: record.aur_inclusionsname ?? 'No inclusions linked',
    warrantyName: record.aur_warrantiesname ?? 'No warranties linked',
    inquiry,
    responses,
    emailTemplates,
    documentTemplates,
  }
}

export function mapQuoteResponse(record: Aur_ai_extracted_responses): QuoteResponse {
  const rawRecord = record as Aur_ai_extracted_responses & {
    aur_confidence_score?: number | string | null
  }

  return {
    id: record.aur_ai_extracted_responseid,
    businessRuleId: record._aur_business_rule_value,
    businessRuleName: record.aur_business_rulename ?? 'Business Rule',
    businessRuleCategory: 'Uncategorized',
    name: record.aur_name ?? 'Unnamed response',
    response: record.aur_response ?? '',
    evidence: record.aur_evidence ?? 'No evidence captured.',
    conditionMet: record.aur_condition_met ?? 'Pending evaluation',
    status: record.statuscodename ?? record.statecodename ?? 'Active',
    confidenceScore: parseConfidenceScore(rawRecord.aur_confidence_score),
  }
}

function parseConfidenceScore(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return undefined
  if (typeof value === 'number') return Number.isNaN(value) ? undefined : value

  const normalized = value.trim()
  if (!normalized) return undefined

  const numericValue = Number.parseFloat(normalized.replace('%', '').trim())
  return Number.isNaN(numericValue) ? undefined : numericValue
}

export function mapRelatedParty(
  record: Accounts | Contacts | undefined,
): RelatedParty | undefined {
  if (!record) return undefined
  if ('contactid' in record) {
    return {
      id: record.contactid,
      name: record.fullname ?? `${record.firstname ?? ''} ${record.lastname}`.trim(),
      email: record.emailaddress1 ?? '',
      phone: record.mobilephone ?? record.telephone1 ?? '',
      subtitle: record.jobtitle ?? '',
    }
  }
  const account = record as Accounts
  return {
    id: account.accountid,
    name: account.name,
    email: account.emailaddress1 ?? '',
    phone: account.telephone1 ?? '',
    subtitle: account.accountnumber ?? account.aur_account_typename ?? '',
  }
}

export function mapRenewalSummary(
  inquiry: InquiryRecord,
  linkedQuote?: Aur_quotes,
  reminderCount = 0,
): RenewalSummary {
  const expiryDate = buildRenewalDate(inquiry, linkedQuote)
  return {
    id: inquiry.aur_inquiryid,
    inquiryId: inquiry.aur_inquiryid,
    quoteId: linkedQuote?.aur_quoteid,
    policyNumber: linkedQuote?.aur_name ?? inquiry.aur_inquiry_number ?? `POL-${inquiry.aur_inquiryid.slice(0, 6).toUpperCase()}`,
    client: inquiry.aur_accountname ?? inquiry.aur_contactname ?? inquiry.aur_name,
    product: inquiry.aur_productname ?? 'No Product Linked',
    expiryDate: expiryDate.toISOString(),
    daysRemaining: Math.ceil((expiryDate.getTime() - Date.now()) / 86400000),
    status: buildRenewalStatus(expiryDate),
    reminderCount,
    premiumTotal: linkedQuote?.aur_total_premium ?? inquiry.aur_total_premium_to_be_charged ?? 0,
  }
}

export function buildWorkflow(record: InquiryRecord): WorkflowStep[] {
  return [
    {
      label: 'Email Received',
      complete: Boolean(record.createdon),
      tone: 'info',
    },
    {
      label: 'Product Matched',
      complete: Boolean(record._aur_product_value),
      tone: 'primary',
    },
    {
      label: 'Inquiry Created',
      complete: Boolean(record.aur_inquiryid),
      tone: 'success',
    },
    {
      label: 'Documents Stored',
      complete: Boolean(record.aur_sharepoint_url),
      tone: 'secondary',
    },
    {
      label: 'AI Processing',
      complete: Boolean(record.aur_ai_generated_summary || record.aur_risk_summary),
      tone: 'info',
    },
    {
      label: 'Awaiting Review',
      complete: Boolean(record.aur_underwriter_action || record.aur_underwriter_actionname),
      tone: 'warning',
    },
  ]
}

export function isRenewal(record: InquiryRecord) {
  return record.aur_inquiry_type === 2 || record.aur_inquiry_typename === 'Renewal'
}

export function countByType(records: InquiryRecord[]): Array<{ label: string; value: number }> {
  const counts = new Map<string, number>()
  for (const record of records) {
    const key = record.aur_inquiry_typename ?? inquiryTypeLabel(record.aur_inquiry_type) ?? 'Unknown'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Array.from(counts.entries()).map(([label, value]) => ({ label, value }))
}

function inquiryLifecycleStatusLabel(
  formattedStatusAnnotation?: string,
  formattedStatusReason?: string,
  rawStatusReason?: number | string,
  formattedState?: string,
  rawState?: number | string,
) {
  const annotation = formattedStatusAnnotation?.trim()
  if (annotation) return annotation

  const numericStatusReason = Number(rawStatusReason)
  const mappedStatusReason = INQUIRY_STATUS_OPTIONS.find((option) => option.value === numericStatusReason)
  if (mappedStatusReason) return mappedStatusReason.label

  const formatted = formattedStatusReason?.trim() || formattedState?.trim()
  if (formatted) {
    return formatted
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim()
  }

  if (Number(rawState) === 0) return 'Active'
  if (Number(rawState) === 1) return 'Inactive'
  return undefined
}

function inquiryLifecycleStatusValue(rawStatusReason?: number | string, rawState?: number | string) {
  const numericStatusReason = Number(rawStatusReason)
  if (INQUIRY_STATUS_OPTIONS.some((option) => option.value === numericStatusReason)) {
    return numericStatusReason
  }

  if (Number(rawState) === 0) return 1
  if (Number(rawState) === 1) return 2
  return undefined
}

function quoteStatusLabel(value?: number) {
  if (value === 751820000) return 'Quote Won'
  if (value === 751820001) return 'Quote Lost'
  if (value === 751820002) return 'Deactivated'
  return undefined
}

function buildCompletenessScore(record: InquiryRecord) {
  let score = 40
  if (record.aur_brokername) score += 10
  if (record._aur_contact_value) score += 10
  if (record._aur_account_value) score += 10
  if (record._aur_product_value) score += 10
  if (record.aur_sharepoint_url) score += 10
  if (record.aur_risk_summary || record.aur_ai_generated_summary) score += 10
  return Math.min(score, 100)
}

function buildRenewalDate(inquiry: InquiryRecord, linkedQuote?: Aur_quotes) {
  const anchor = inquiry.createdon ?? linkedQuote?.createdon
  const base = anchor ? new Date(anchor) : new Date()
  base.setDate(base.getDate() + 30)
  return base
}

function buildRenewalStatus(expiryDate: Date) {
  const daysRemaining = Math.ceil((expiryDate.getTime() - Date.now()) / 86400000)
  if (daysRemaining < 0) return 'Overdue'
  if (daysRemaining <= 7) return 'Due Soon'
  if (daysRemaining <= 30) return 'Due in 30 Days'
  return 'Monitored'
}
