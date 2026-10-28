import { Aur_benefitsesService } from '../generated/services/Aur_benefitsesService'
import { quoteWholeNumber } from '../lib/quoteNumbers'
import { WhenQuoteGenerated_SendEmailtoCustomerService } from '../generated/services/WhenQuoteGenerated_SendEmailtoCustomerService'

export async function sendGeneratedQuoteToCustomer(inquiryId: string, pdf: { fileName: string; contentBytes: string }) {
  const recordId = inquiryId.replace(/[{}]/g, '').trim().toLowerCase()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(recordId)) {
    throw new Error('The quote must be linked to an inquiry before it can be emailed.')
  }
  if (!pdf.contentBytes) throw new Error('The generated PDF is empty. Please generate the quote again.')
  const result = await WhenQuoteGenerated_SendEmailtoCustomerService.Run({
    text: recordId,
    file: { name: pdf.fileName, contentBytes: pdf.contentBytes },
  })
  if (!result.success) throw result.error ?? new Error('The customer email flow could not be started.')
}
import { Aur_coveragesesService } from '../generated/services/Aur_coveragesesService'
import { Aur_custom_document_templatesesService } from '../generated/services/Aur_custom_document_templatesesService'
import { Aur_deductiblesesService } from '../generated/services/Aur_deductiblesesService'
import { Aur_exclusionsesService } from '../generated/services/Aur_exclusionsesService'
import { Aur_inclusionsesService } from '../generated/services/Aur_inclusionsesService'
import { Aur_plansService } from '../generated/services/Aur_plansService'
import { Aur_plan_details_extractionsService } from '../generated/services/Aur_plan_details_extractionsService'
import { Aur_productsesService } from '../generated/services/Aur_productsesService'
import { Aur_ai_extracted_responsesService } from '../generated/services/Aur_ai_extracted_responsesService'
import { Aur_quotesService } from '../generated/services/Aur_quotesService'
import { Aur_inquiriesService } from '../generated/services/Aur_inquiriesService'
import { Aur_warrantiesesService } from '../generated/services/Aur_warrantiesesService'
import { TemplatesService } from '../generated/services/TemplatesService'
import { HTTP_OnUploadFileforPlanDetailsComparison_RunAIEvaluationService } from '../generated/services/HTTP_OnUploadFileforPlanDetailsComparison_RunAIEvaluationService'
import type {
  DocumentTemplateSummary,
  EmailTemplateSummary,
  QuoteDetail,
  QuotePlanComparison,
  QuoteSummary,
} from '../domain/app'
import { mapInquirySummary, mapQuoteDetail, mapQuoteResponse, mapQuoteSummary } from './dataMappers'
import { ensurePolicyConversionForWonQuote } from './policyConversionsService'

export type QuotePlanLinkedEntityKey =
  | 'benefits'
  | 'inclusions'
  | 'exclusions'
  | 'deductibles'
  | 'warranties'
  | 'coverages'

export interface QuotePlanLinkedRecord {
  id: string
  name: string
  description: string
}

export interface QuotePlanLinkedSection {
  key: QuotePlanLinkedEntityKey
  title: string
  records: QuotePlanLinkedRecord[]
}

export interface QuotePlanComparisonUploadPayload {
  recordId: string
  uploadedFile: {
    fileName: string
    fileType: string
    fileContent: string
  }
}

export async function listQuotes(): Promise<QuoteSummary[]> {
  const [quotesResult, productsResult, plansResult] = await Promise.all([
    Aur_quotesService.getAll({
      orderBy: ['createdon desc'],
    }),
    Aur_productsesService.getAll(),
    Aur_plansService.getAll(),
  ])
  const productMap = new Map((productsResult.data ?? []).map((product) => [product.aur_productsid, product.aur_name]))
  const planMap = new Map((plansResult.data ?? []).map((plan) => [plan.aur_planid, plan.aur_name ?? 'Unnamed plan']))
  return (quotesResult.data ?? []).map((quote) => mapQuoteSummary(resolveQuoteRelations(quote, productMap, planMap)))
}

export async function getQuoteDetail(id: string): Promise<QuoteDetail> {
  const [quoteResult, inquiriesResult, detailResult, emailTemplatesResult, documentTemplatesResult, productsResult, plansResult] = await Promise.all([
    Aur_quotesService.get(id),
    Aur_inquiriesService.getAll(),
    Aur_ai_extracted_responsesService.getAll(),
    TemplatesService.getAll(),
    Aur_custom_document_templatesesService.getAll(),
    Aur_productsesService.getAll(),
    Aur_plansService.getAll(),
  ])

  const productMap = new Map((productsResult.data ?? []).map((product) => [product.aur_productsid, product.aur_name]))
  const planMap = new Map((plansResult.data ?? []).map((plan) => [plan.aur_planid, plan.aur_name ?? 'Unnamed plan']))
  const quote = quoteResult.data ? resolveQuoteRelations(quoteResult.data, productMap, planMap) : undefined
  if (!quote) throw new Error('Quote not found.')

  const inquiry = (inquiriesResult.data ?? []).find((item) => item.aur_inquiryid === quote._aur_quotes_value)
  const responses = (detailResult.data ?? [])
    .filter((item) => normalizeDataverseId(item._aur_inquiry_value) === normalizeDataverseId(quote._aur_quotes_value))
    .map(mapQuoteResponse)
  const emailTemplates = (emailTemplatesResult.data ?? [])
    .filter((template) => {
      return Number(template.templatetypecode) === 1084
    })
    .map<EmailTemplateSummary>((template) => ({
      id: template.templateid,
      name: template.title,
      subject: template.subject ?? '',
      body: template.body ?? '',
      category: template.templatetypecodename ?? 'Quote',
      isActive: template.componentstate === 0,
    }))
  const documentTemplates = (documentTemplatesResult.data ?? []).map<DocumentTemplateSummary>((template) => ({
    id: template.aur_custom_document_templatesid,
    name: template.aur_name ?? 'Untitled template',
    content: template.aur_template_content ?? '',
  }))

  return mapQuoteDetail(
    quote,
    inquiry ? mapInquirySummary(inquiry) : undefined,
    responses,
    emailTemplates,
    documentTemplates,
  )
}

export async function listQuotePlanComparisons(quoteId: string): Promise<QuotePlanComparison[]> {
  const normalizedQuoteId = normalizeDataverseId(quoteId)
  const result = await Aur_plan_details_extractionsService.getAll({ orderBy: ['createdon desc'] })

  return (result.data ?? [])
    .filter((record) => normalizeDataverseId(record._aur_quotes_value) === normalizedQuoteId)
    .map((record) => ({
      id: record.aur_plan_details_extractionid,
      name: record.aur_name || 'Plan comparison',
      response: record.aur_open_ai_response ?? '',
      suggestedPlanDetails: String((record as { aur_ai_suggested_plan_details?: string }).aur_ai_suggested_plan_details ?? ''),
      unmatchedPlanDetails: String((record as { aur_unmatched_plan_details?: string }).aur_unmatched_plan_details ?? ''),
      quoteId: record._aur_quotes_value,
      quoteName: record.aur_quotesname,
      createdOn: record.createdon,
    }))
}

export async function analyzeQuotePlanComparison(
  payload: QuotePlanComparisonUploadPayload,
): Promise<{ comparisonId?: string }> {
  const result = await HTTP_OnUploadFileforPlanDetailsComparison_RunAIEvaluationService.Run({
    text: payload.recordId,
    file: {
      name: payload.uploadedFile.fileName,
      contentBytes: payload.uploadedFile.fileContent,
    },
  })

  const comparisonId = result.data?.plan_details_guid
  if (!comparisonId) {
    throw new Error('Plan comparison completed, but no comparison record was returned. Please try again.')
  }

  return { comparisonId }
}

export async function getQuoteEditorOptions() {
  const [
    productsResult,
    plansResult,
    coveragesResult,
    benefitsResult,
    inclusionsResult,
    exclusionsResult,
    deductiblesResult,
    warrantiesResult,
  ] = await Promise.all([
    Aur_productsesService.getAll(),
    Aur_plansService.getAll(),
    Aur_coveragesesService.getAll(),
    Aur_benefitsesService.getAll(),
    Aur_inclusionsesService.getAll(),
    Aur_exclusionsesService.getAll(),
    Aur_deductiblesesService.getAll(),
    Aur_warrantiesesService.getAll(),
  ])

  return {
    products: (productsResult.data ?? []).map((record) => ({ id: record.aur_productsid, name: record.aur_name })),
    plans: (plansResult.data ?? []).map((record) => ({ id: record.aur_planid, name: record.aur_name ?? 'Unnamed plan' })),
    coverages: (coveragesResult.data ?? []).map((record) => ({ id: record.aur_coveragesid, name: record.aur_name })),
    benefits: (benefitsResult.data ?? []).map((record) => ({ id: record.aur_benefitsid, name: record.aur_name })),
    inclusions: (inclusionsResult.data ?? []).map((record) => ({ id: record.aur_inclusionsid, name: record.aur_name })),
    exclusions: (exclusionsResult.data ?? []).map((record) => ({ id: record.aur_exclusionsid, name: record.aur_name })),
    deductibles: (deductiblesResult.data ?? []).map((record) => ({ id: record.aur_deductiblesid, name: record.aur_name })),
    warranties: (warrantiesResult.data ?? []).map((record) => ({ id: record.aur_warrantiesid, name: record.aur_name })),
  }
}

export async function saveQuoteDetail(
  id: string,
  payload: {
    name: string
    totalPremium: number
    grossPremium: number
    vat: number
    loadingPremium: number
    reason: string
    aiSummary: string
    productId?: string
    planId?: string
    coverageId?: string
    benefitsId?: string
    inclusionsId?: string
    exclusionsId?: string
    deductiblesId?: string
    warrantiesId?: string
    quoteStatus?: 'QuoteWon' | 'QuoteLost'
  },
) {
  const previousQuote = payload.quoteStatus === 'QuoteWon' ? (await Aur_quotesService.get(id)).data : undefined
  await Aur_quotesService.update(id, {
    aur_name: payload.name,
    aur_total_premium: quoteWholeNumber(payload.totalPremium, 'Total Premium'),
    aur_gross_premium: quoteWholeNumber(payload.grossPremium, 'Gross Premium'),
    aur_vat: quoteWholeNumber(payload.vat, 'VAT'),
    aur_loading_premium: quoteWholeNumber(payload.loadingPremium, 'Loading Premium'),
    aur_reason: payload.reason,
    aur_ai_generated_summary: payload.aiSummary,
    ...(payload.productId ? { 'aur_product@odata.bind': `/aur_productses(${payload.productId})` } : {}),
    ...(payload.planId ? { 'aur_plan@odata.bind': `/aur_plans(${payload.planId})` } : {}),
    ...(payload.coverageId ? { 'aur_coverage@odata.bind': `/aur_coverageses(${payload.coverageId})` } : {}),
    ...(payload.benefitsId ? { 'aur_benefits@odata.bind': `/aur_benefitses(${payload.benefitsId})` } : {}),
    ...(payload.inclusionsId ? { 'aur_inclusions@odata.bind': `/aur_inclusionses(${payload.inclusionsId})` } : {}),
    ...(payload.exclusionsId ? { 'aur_exclusions@odata.bind': `/aur_exclusionses(${payload.exclusionsId})` } : {}),
    ...(payload.deductiblesId ? { 'aur_deductibles@odata.bind': `/aur_deductibleses(${payload.deductiblesId})` } : {}),
    ...(payload.warrantiesId ? { 'aur_warranties@odata.bind': `/aur_warrantieses(${payload.warrantiesId})` } : {}),
    ...(payload.quoteStatus
      ? { aur_quote_status: payload.quoteStatus === 'QuoteWon' ? 751820000 : 751820001 }
      : {}),
  })
  if (payload.quoteStatus === 'QuoteWon' && previousQuote?.aur_quote_status !== 751820000) {
    await ensurePolicyConversionForWonQuote(id, {
      name: payload.name,
      totalPremium: payload.totalPremium,
    })
  }
}

export async function updateQuoteStatus(
  id: string,
  quoteStatus?: 'QuoteWon' | 'QuoteLost',
) {
  const previousQuote = quoteStatus === 'QuoteWon' ? (await Aur_quotesService.get(id)).data : undefined
  await Aur_quotesService.update(id, {
    ...(quoteStatus
      ? { aur_quote_status: quoteStatus === 'QuoteWon' ? 751820000 : 751820001 }
      : { aur_quote_status: undefined }),
  })
  if (quoteStatus === 'QuoteWon' && previousQuote?.aur_quote_status !== 751820000) {
    await ensurePolicyConversionForWonQuote(id, {
      name: previousQuote?.aur_name,
      totalPremium: previousQuote?.aur_total_premium,
    })
  }
}

export async function getQuotePlanLinkedSections(planId: string): Promise<QuotePlanLinkedSection[]> {
  const normalizedPlanId = normalizeDataverseId(planId)
  if (!normalizedPlanId) {
    return [
      { key: 'benefits', title: 'Benefits', records: [] },
      { key: 'inclusions', title: 'Inclusions', records: [] },
      { key: 'exclusions', title: 'Exclusions', records: [] },
      { key: 'deductibles', title: 'Deductibles', records: [] },
      { key: 'warranties', title: 'Warranties', records: [] },
      { key: 'coverages', title: 'Coverage', records: [] },
    ]
  }

  const [
    benefitsResult,
    inclusionsResult,
    exclusionsResult,
    deductiblesResult,
    warrantiesResult,
    coveragesResult,
  ] = await Promise.all([
    Aur_benefitsesService.getAll(),
    Aur_inclusionsesService.getAll(),
    Aur_exclusionsesService.getAll(),
    Aur_deductiblesesService.getAll(),
    Aur_warrantiesesService.getAll(),
    Aur_coveragesesService.getAll(),
  ])

  return [
    {
      key: 'benefits',
      title: 'Benefits',
      records: (benefitsResult.data ?? [])
        .filter((record) => normalizeDataverseId(record._aur_plan_value) === normalizedPlanId)
        .map((record) => ({ id: record.aur_benefitsid, name: record.aur_name, description: record.aur_description ?? '' })),
    },
    {
      key: 'inclusions',
      title: 'Inclusions',
      records: (inclusionsResult.data ?? [])
        .filter((record) => normalizeDataverseId(record._aur_plan_value) === normalizedPlanId)
        .map((record) => ({ id: record.aur_inclusionsid, name: record.aur_name, description: record.aur_description ?? '' })),
    },
    {
      key: 'exclusions',
      title: 'Exclusions',
      records: (exclusionsResult.data ?? [])
        .filter((record) => normalizeDataverseId(record._aur_plan_value) === normalizedPlanId)
        .map((record) => ({ id: record.aur_exclusionsid, name: record.aur_name, description: record.aur_description ?? '' })),
    },
    {
      key: 'deductibles',
      title: 'Deductibles',
      records: (deductiblesResult.data ?? [])
        .filter((record) => normalizeDataverseId(record._aur_plan_value) === normalizedPlanId)
        .map((record) => ({ id: record.aur_deductiblesid, name: record.aur_name, description: record.aur_description ?? '' })),
    },
    {
      key: 'warranties',
      title: 'Warranties',
      records: (warrantiesResult.data ?? [])
        .filter((record) => normalizeDataverseId(record._aur_plan_value) === normalizedPlanId)
        .map((record) => ({ id: record.aur_warrantiesid, name: record.aur_name, description: record.aur_description ?? '' })),
    },
    {
      key: 'coverages',
      title: 'Coverage',
      records: (coveragesResult.data ?? [])
        .filter((record) => normalizeDataverseId(record._aur_plan_value) === normalizedPlanId)
        .map((record) => ({ id: record.aur_coveragesid, name: record.aur_name, description: record.aur_description ?? '' })),
    },
  ]
}

export async function renameQuotePlanLinkedRecord(
  entity: QuotePlanLinkedEntityKey,
  id: string,
  name: string,
) {
  const payload = { aur_name: name }
  if (entity === 'benefits') return Aur_benefitsesService.update(id, payload)
  if (entity === 'inclusions') return Aur_inclusionsesService.update(id, payload)
  if (entity === 'exclusions') return Aur_exclusionsesService.update(id, payload)
  if (entity === 'deductibles') return Aur_deductiblesesService.update(id, payload)
  if (entity === 'warranties') return Aur_warrantiesesService.update(id, payload)
  return Aur_coveragesesService.update(id, payload)
}

export async function updateQuotePlanLinkedRecordDetails(
  entity: QuotePlanLinkedEntityKey,
  id: string,
  details: { name: string; description: string },
) {
  const payload = {
    aur_name: details.name,
    aur_description: details.description,
  }
  if (entity === 'benefits') return Aur_benefitsesService.update(id, payload)
  if (entity === 'inclusions') return Aur_inclusionsesService.update(id, payload)
  if (entity === 'exclusions') return Aur_exclusionsesService.update(id, payload)
  if (entity === 'deductibles') return Aur_deductiblesesService.update(id, payload)
  if (entity === 'warranties') return Aur_warrantiesesService.update(id, payload)
  return Aur_coveragesesService.update(id, payload)
}

export async function updateQuotePlanLinkedDescription(
  entity: QuotePlanLinkedEntityKey,
  id: string,
  description: string,
) {
  const payload = { aur_description: description }
  if (entity === 'benefits') return Aur_benefitsesService.update(id, payload)
  if (entity === 'inclusions') return Aur_inclusionsesService.update(id, payload)
  if (entity === 'exclusions') return Aur_exclusionsesService.update(id, payload)
  if (entity === 'deductibles') return Aur_deductiblesesService.update(id, payload)
  if (entity === 'warranties') return Aur_warrantiesesService.update(id, payload)
  return Aur_coveragesesService.update(id, payload)
}

export async function deleteQuotePlanLinkedRecord(
  entity: QuotePlanLinkedEntityKey,
  id: string,
) {
  if (entity === 'benefits') return Aur_benefitsesService.delete(id)
  if (entity === 'inclusions') return Aur_inclusionsesService.delete(id)
  if (entity === 'exclusions') return Aur_exclusionsesService.delete(id)
  if (entity === 'deductibles') return Aur_deductiblesesService.delete(id)
  if (entity === 'warranties') return Aur_warrantiesesService.delete(id)
  return Aur_coveragesesService.delete(id)
}

function resolveQuoteRelations(
  quote: Awaited<ReturnType<typeof Aur_quotesService.get>>['data'] extends infer T ? NonNullable<T> : never,
  productMap: Map<string, string>,
  planMap: Map<string, string>,
) {
  return {
    ...quote,
    aur_productname:
      quote.aur_productname || !quote._aur_product_value
        ? quote.aur_productname
        : productMap.get(quote._aur_product_value) ?? quote.aur_productname,
    aur_planname:
      quote.aur_planname || !quote._aur_plan_value
        ? quote.aur_planname
        : planMap.get(quote._aur_plan_value) ?? quote.aur_planname,
  }
}

function normalizeDataverseId(value?: string | null) {
  return value?.replace(/[{}]/g, '').toLowerCase() ?? ''
}
