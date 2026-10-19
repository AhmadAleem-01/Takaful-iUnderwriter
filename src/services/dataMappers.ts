import type { Aur_quoteses } from '../generated/models/Aur_quotesesModel'
import { inquiryTypeLabel } from './inquiryTypeOptions'
import { INQUIRY_STATUS_OPTIONS } from './inquiryStatusOptions'
import type { Aur_quotes } from '../generated/models/Aur_quotesModel'
import type { Aur_productses } from '../generated/models/Aur_productsesModel'
import type { Aur_quotes_detailses } from '../generated/models/Aur_quotes_detailsesModel'
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

export function mapInquirySummary(record: Aur_quoteses): InquirySummary {
  const accountName = record.aur_accountname?.trim() || 'No account linked'
  const brokerName =
    record.aur_brokername?.trim() ||
    record.aur_accountname?.trim() ||
    'No broker linked'

  return {
    id: record.aur_quotesid,
    name: record.aur_name,
    inquiryNumber: record.aur_quote_number ?? `INQ-${record.aur_quotesid.slice(0, 8).toUpperCase()}`,
    inquiryType: record.aur_inquiry_typename ?? inquiryTypeLabel(record.aur_inquiry_type) ?? '',
    inquiryTypeValue: record.aur_inquiry_type ? Number(record.aur_inquiry_type) : undefined,
    status: inquiryLifecycleStatusLabel(record.statuscodename, record.statuscode) ?? record.statuscodename ?? 'Draft',
    inquiryStatusValue: record.statuscode ? Number(record.statuscode) : undefined,
    accountId: record._aur_account_value,
    accountName,
    contactName: record.aur_contactname ?? 'No contact linked',
    brokerId: record._aur_account_value,
    brokerName,
    productId: record._aur_product_value,
    productName: record.aur_productname ?? 'No product linked',
    planId: record._aur_plan_value,
    planName: record.aur_planname ?? 'No plan linked',
    riskScore: record.aur_risk_score ?? 0,
    grossPremium: record.aur_gross_premium ?? 0,
    totalInsured: record.aur_total_sum_insured ?? 0,
    createdOn: record.createdon ?? record.aur_created_on ?? '',
    summary: record.aur_summary ?? record.aur_risksummary ?? 'Awaiting underwriting summary.',
    sharepointUrl: record.aur_sharepoint_url ?? '',
  }
}

export function mapInquiryDetail(
  record: Aur_quoteses,
  quotes: QuoteSummary[],
  quoteDetails: QuoteResponse[],
  workflow: WorkflowStep[],
  account?: RelatedParty,
  contact?: RelatedParty,
  broker?: RelatedParty,
): InquiryDetail {
  const inquiryRecord = record as Aur_quoteses & {
    aur_base_premium?: number | null
    aur_vehicle_value?: string | null
    aur_customer_data?: string | null
    aur_ai_evaluation_json_response?: string | null
    aur_underwriter_action_status?: number | null
    aur_underwriter_sub_action?: number | null
    aur_action_applied?: boolean | null
    aur_plan_details?: string | null
  }
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
    riskDescription: record.aur_risksummary ?? '',
    paymentTerm: record.aur_payment_termname ?? 'Annual',
    territorialScope: record.aur_territorial_scope ?? 'Not specified',
    coverType: record.aur_cover_typename ?? 'Not specified',
    planDetails: inquiryRecord.aur_plan_details ?? '',
    fee: record.aur_fee ?? 0,
    declaredValue: record.aur_declared_value ?? 0,
    basePremium: inquiryRecord.aur_base_premium ?? 0,
    vehicleValue: inquiryRecord.aur_vehicle_value ?? '',
    customerData: inquiryRecord.aur_customer_data ?? '',
    aiEvaluationJsonResponse: inquiryRecord.aur_ai_evaluation_json_response ?? '',
    underwriterActionStatus: inquiryRecord.aur_underwriter_action_status,
    underwriterSubAction: inquiryRecord.aur_underwriter_sub_action,
    totalCharge: record.aur_total_amount_charge ?? 0,
    actionApplied: Boolean(inquiryRecord.aur_action_applied),
    aiSummary: record.aur_risksummary ?? record.aur_summary ?? 'AI summary is not available yet.',
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
    productName: record.aur_productname ?? 'No product linked',
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

export function mapQuoteResponse(record: Aur_quotes_detailses): QuoteResponse {
  const rawRecord = record as Aur_quotes_detailses & {
    aur_confidence_score?: number | string | null
  }

  return {
    id: record.aur_quotes_detailsid,
    businessRuleId: record._aur_business_rules_value,
    businessRuleName: record.aur_business_rulesname ?? 'Business Rule',
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
  inquiry: Aur_quoteses,
  linkedQuote?: Aur_quotes,
  reminderCount = 0,
): RenewalSummary {
  const expiryDate = buildRenewalDate(inquiry, linkedQuote)
  return {
    id: inquiry.aur_quotesid,
    inquiryId: inquiry.aur_quotesid,
    quoteId: linkedQuote?.aur_quoteid,
    policyNumber: linkedQuote?.aur_name ?? inquiry.aur_quote_number ?? `POL-${inquiry.aur_quotesid.slice(0, 6).toUpperCase()}`,
    client: inquiry.aur_accountname ?? inquiry.aur_contactname ?? inquiry.aur_name,
    product: inquiry.aur_productname ?? 'No product linked',
    expiryDate: expiryDate.toISOString(),
    daysRemaining: Math.ceil((expiryDate.getTime() - Date.now()) / 86400000),
    status: buildRenewalStatus(expiryDate),
    reminderCount,
    premiumTotal: linkedQuote?.aur_total_premium ?? inquiry.aur_total_amount_charge ?? 0,
  }
}

export function buildWorkflow(record: Aur_quoteses): WorkflowStep[] {
  return [
    {
      label: 'Email Received',
      complete: Boolean(record.createdon ?? record.aur_created_on),
      tone: 'info',
    },
    {
      label: 'Product Matched',
      complete: Boolean(record._aur_product_value),
      tone: 'primary',
    },
    {
      label: 'Inquiry Created',
      complete: Boolean(record.aur_quotesid),
      tone: 'success',
    },
    {
      label: 'Documents Stored',
      complete: Boolean(record.aur_sharepoint_url),
      tone: 'secondary',
    },
    {
      label: 'AI Processing',
      complete: Boolean(record.aur_summary || record.aur_risksummary),
      tone: 'info',
    },
    {
      label: 'Awaiting Review',
      complete: Boolean(record.aur_inquiry_status || record.aur_inquiry_statusname),
      tone: 'warning',
    },
  ]
}

export function isRenewal(record: Aur_quoteses) {
  return record.aur_inquiry_type === 2 || record.aur_inquiry_typename === 'Renewal'
}

export function countByType(records: Aur_quoteses[]): Array<{ label: string; value: number }> {
  const counts = new Map<string, number>()
  for (const record of records) {
    const key = record.aur_inquiry_typename ?? inquiryTypeLabel(record.aur_inquiry_type) ?? 'Unknown'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Array.from(counts.entries()).map(([label, value]) => ({ label, value }))
}

function inquiryLifecycleStatusLabel(formatted?: string, raw?: number | string) {
  const numericValue = Number(raw)
  const mappedStatus = INQUIRY_STATUS_OPTIONS.find((option) => option.value === numericValue)
  if (mappedStatus) return mappedStatus.label

  return formatted
    ? formatted
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\s+/g, ' ')
        .trim()
    : undefined
}

function quoteStatusLabel(value?: number) {
  if (value === 751820000) return 'Quote Won'
  if (value === 751820001) return 'Quote Lost'
  if (value === 751820002) return 'Deactivated'
  return undefined
}

function buildCompletenessScore(record: Aur_quoteses) {
  let score = 40
  if (record._aur_account_value) score += 10
  if (record._aur_contact_value) score += 10
  if (record._aur_broker_value) score += 10
  if (record._aur_product_value) score += 10
  if (record.aur_sharepoint_url) score += 10
  if (record.aur_risksummary || record.aur_summary) score += 10
  return Math.min(score, 100)
}

function buildRenewalDate(inquiry: Aur_quoteses, linkedQuote?: Aur_quotes) {
  const anchor = inquiry.createdon ?? inquiry.aur_created_on ?? linkedQuote?.createdon
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
