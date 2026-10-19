import { AccountsService } from '../generated/services/AccountsService'
import { ActivitymimeattachmentsService } from '../generated/services/ActivitymimeattachmentsService'
import { Aur_business_rulesesService } from '../generated/services/Aur_business_rulesesService'
import { Aur_consequences_resultsService } from '../generated/services/Aur_consequences_resultsService'
import { Aur_consequencesesService } from '../generated/services/Aur_consequencesesService'
import { Aur_customdocumenttemplatesesService } from '../generated/services/Aur_customdocumenttemplatesesService'
import { Aur_plansService } from '../generated/services/Aur_plansService'
import { Aur_productsesService } from '../generated/services/Aur_productsesService'
import { Aur_quotes_detailsesService } from '../generated/services/Aur_quotes_detailsesService'
import { Aur_quotesService } from '../generated/services/Aur_quotesService'
import { Aur_quotesesService } from '../generated/services/Aur_quotesesService'
import { Aur_ri_capacity_checksService } from '../generated/services/Aur_ri_capacity_checksService'
import { ContactsService } from '../generated/services/ContactsService'
import { Cr058_emailtemplatesService } from '../generated/services/Cr058_emailtemplatesService'
import { EmailsService } from '../generated/services/EmailsService'
import { OnDemand_RecalculationofRI_CapacityChecksService } from '../generated/services/OnDemand_RecalculationofRI_CapacityChecksService'
import { Aur_business_rulesesaur_categories } from '../generated/models/Aur_business_rulesesModel'
import type {
  ConsequenceDefinition,
  ConsequenceResultSummary,
  InquiryEmailSummary,
  InquiryDetail,
  InquiryRuleGroup,
  InquirySummary,
  QuoteResponse,
  RiCapacityCheckSummary,
} from '../domain/app'
import {
  buildWorkflow,
  mapInquiryDetail,
  mapInquirySummary,
  mapQuoteResponse,
  mapQuoteSummary,
  mapRelatedParty,
} from './dataMappers'
import { INQUIRY_TYPE_OPTIONS } from './inquiryTypeOptions'
import { INQUIRY_STATUS_OPTIONS } from './inquiryStatusOptions'
import { quoteWholeNumber } from '../lib/quoteNumbers'
import { preferReceivedInquiryEmails } from '../lib/inquiryEmailDuplicates'

type InquiryReferenceData = {
  products: Awaited<ReturnType<typeof Aur_productsesService.getAll>>['data']
  plans: Awaited<ReturnType<typeof Aur_plansService.getAll>>['data']
  accounts: Awaited<ReturnType<typeof AccountsService.getAll>>['data']
}

let inquiryReferenceDataPromise: Promise<InquiryReferenceData> | null = null
let inquiryEditorOptionsPromise: Promise<Awaited<ReturnType<typeof getInquiryEditorOptionsUncached>>> | null = null

export async function listInquiries(scope?: string): Promise<InquirySummary[]> {
  const [result, referenceData] = await Promise.all([
    Aur_quotesesService.getAll({
      orderBy: ['createdon desc'],
    }),
    getInquiryReferenceData(),
  ])
  const records = result.data ?? []
  const products = referenceData.products ?? []
  const plans = referenceData.plans ?? []
  const accounts = referenceData.accounts ?? []
  const productMap = new Map(products.map((product) => [normalizeDataverseId(product.aur_productsid), product.aur_name]))
  const planMap = new Map(plans.map((plan) => [normalizeDataverseId(plan.aur_planid), plan.aur_name ?? 'Unnamed plan']))
  const accountLookupIds = [...new Set(records.map((record) => normalizeDataverseId(record._aur_account_value)).filter(Boolean))]
  const linkedAccounts = await Promise.all(
    accountLookupIds.map(async (accountId) => {
      try {
        const result = await AccountsService.get(accountId)
        return result.data
      } catch {
        return undefined
      }
    }),
  )
  const accountMap = new Map(
    [...accounts, ...linkedAccounts.filter((account): account is NonNullable<typeof account> => Boolean(account))].map((account) => [
      normalizeDataverseId(account.accountid),
      {
        name: account.name,
        type: account.aur_account_typename,
        typeCode: account.aur_account_type,
      },
    ]),
  )
  const filtered = scope
    ? records.filter((record) => (record.aur_inquiry_typename ?? '').toLowerCase() === scope.toLowerCase())
    : records
  return filtered.map((record) => mapInquirySummary(resolveInquiryRelations(record, productMap, planMap, accountMap)))
}

export async function getInquiryDetail(id: string): Promise<InquiryDetail> {
  const coreDetail = await getInquiryDetailCore(id)
  const supplementaryDetail = await getInquiryDetailSupplementary(id)

  return {
    ...coreDetail,
    ...supplementaryDetail,
  }
}

export async function getInquiryDetailCore(id: string): Promise<InquiryDetail> {
  const normalizedRouteId = normalizeDataverseId(id)
  const [inquiryResult, inquiryChoiceFieldsResult, referenceData] = await Promise.all([
    Aur_quotesesService.get(id),
    Aur_quotesesService.get(id, {
      select: ['aur_inquiry_type', 'aur_inquiry_typename', 'aur_inquiry_status', 'aur_inquiry_statusname', 'aur_ai_evaluation_json_response'],
    }).catch(() => ({ data: undefined })),
    getInquiryReferenceData(),
  ])
  const productMap = new Map((referenceData.products ?? []).map((product) => [normalizeDataverseId(product.aur_productsid), product.aur_name]))
  const planMap = new Map((referenceData.plans ?? []).map((plan) => [normalizeDataverseId(plan.aur_planid), plan.aur_name ?? 'Unnamed plan']))
  const accountMap = new Map(
    (referenceData.accounts ?? []).map((account) => [
      normalizeDataverseId(account.accountid),
      {
        name: account.name,
        type: account.aur_account_typename,
        typeCode: account.aur_account_type,
      },
    ]),
  )
  const inquiryRecord =
    inquiryResult.data
      ? {
          ...inquiryResult.data,
          aur_ai_evaluation_json_response:
            (inquiryChoiceFieldsResult.data as { aur_ai_evaluation_json_response?: string | null } | undefined)?.aur_ai_evaluation_json_response ??
            (inquiryResult.data as { aur_ai_evaluation_json_response?: string | null }).aur_ai_evaluation_json_response,
          aur_inquiry_type:
            inquiryChoiceFieldsResult.data?.aur_inquiry_type ??
            inquiryResult.data.aur_inquiry_type,
          aur_inquiry_typename:
            inquiryChoiceFieldsResult.data?.aur_inquiry_typename ??
            inquiryResult.data.aur_inquiry_typename,
          aur_inquiry_status:
            inquiryChoiceFieldsResult.data?.aur_inquiry_status ??
            inquiryResult.data.aur_inquiry_status,
          aur_inquiry_statusname:
            inquiryChoiceFieldsResult.data?.aur_inquiry_statusname ??
            inquiryResult.data.aur_inquiry_statusname,
        }
      : inquiryResult.data
  const inquiry = inquiryRecord ? resolveInquiryRelations(inquiryRecord, productMap, planMap, accountMap) : undefined
  if (!inquiry) throw new Error('Inquiry not found.')
  const inquiryId = normalizeDataverseId(inquiry.aur_quotesid) || normalizedRouteId
  const [coreAccount, coreContact] = await Promise.all([
    inquiry._aur_account_value
      ? AccountsService.get(inquiry._aur_account_value).then((result) => result.data).catch(() => undefined)
      : Promise.resolve(undefined),
    inquiry._aur_contact_value
      ? ContactsService.get(inquiry._aur_contact_value).then((result) => result.data).catch(() => undefined)
      : Promise.resolve(undefined),
  ])

  console.info('[Inquiry Debug] inquiry choice fields', {
    inquiryId,
    aur_inquiry_type: inquiry.aur_inquiry_type,
    aur_inquiry_typename: inquiry.aur_inquiry_typename,
    aur_inquiry_status: inquiry.aur_inquiry_status,
    aur_inquiry_statusname: inquiry.aur_inquiry_statusname,
    aur_account_lookup: inquiry._aur_account_value,
    aur_account_name: inquiry.aur_accountname,
    coreAccountName: coreAccount?.name,
  })

  const workspace = mapInquiryDetail(
    inquiry,
    [],
    [],
    buildWorkflow(inquiry),
    mapRelatedParty(coreAccount),
    mapRelatedParty(coreContact),
    mapRelatedParty(coreAccount),
  )

  return mergeInquiryWorkspace(
    workspace,
    [],
    [],
    [],
    [],
  )
}

export async function getInquiryDetailSupplementary(id: string): Promise<Partial<InquiryDetail>> {
  const normalizedRouteId = normalizeDataverseId(id)
  const [inquiryResult, referenceData] = await Promise.all([
    Aur_quotesesService.get(id),
    getInquiryReferenceData(),
  ])
  const productMap = new Map((referenceData.products ?? []).map((product) => [product.aur_productsid, product.aur_name]))
  const planMap = new Map((referenceData.plans ?? []).map((plan) => [plan.aur_planid, plan.aur_name ?? 'Unnamed plan']))
  const accountMap = new Map(
    (referenceData.accounts ?? []).map((account) => [
      account.accountid,
      {
        name: account.name,
        type: account.aur_account_typename,
        typeCode: account.aur_account_type,
      },
    ]),
  )
  const inquiry = inquiryResult.data ? resolveInquiryRelations(inquiryResult.data, productMap, planMap, accountMap) : undefined
  if (!inquiry) throw new Error('Inquiry not found.')
  const inquiryId = normalizeDataverseId(inquiry.aur_quotesid) || normalizedRouteId

  const [quotesResult, rawQuoteDetails, consequenceResultsResult, emailsResult] = await Promise.all([
    listQuotesForInquiry(inquiryId),
    listQuoteDetailsForInquiry(inquiryId),
    Aur_consequences_resultsService.getAll({
      filter: `_aur_inquiry_value eq ${inquiryId}`,
    }),
    EmailsService.getAll({
      filter: `_regardingobjectid_value eq ${inquiryId}`,
      orderBy: ['createdon desc'],
    }),
  ])
  const riCapacityChecks = await listRiCapacityChecksForInquiry(inquiryId)

  const quotes = quotesResult
    .filter((quote) => normalizeDataverseId(quote._aur_quotes_value) === inquiryId)
    .map((quote) => resolveQuoteRelations(quote, productMap, planMap))

  console.info('[Inquiry Debug] aur_quotes_details paged lookup', {
    inquiryId,
    matchedCount: rawQuoteDetails.length,
    matchedIds: rawQuoteDetails.map((detail) => detail.aur_quotes_detailsid),
  })

  const businessRuleIds = [...new Set(rawQuoteDetails.map((detail) => normalizeDataverseId(detail._aur_business_rules_value)).filter(Boolean))]
  const consequenceLookupIds = [
    ...new Set(
      (consequenceResultsResult.data ?? [])
        .map((result) => normalizeDataverseId(result._aur_consequences_value))
        .filter(Boolean),
    ),
  ]
  const consequenceFilterParts = [
    consequenceLookupIds.length
      ? buildGuidOrFilter('aur_consequencesid', consequenceLookupIds)
      : '',
    businessRuleIds.length
      ? buildGuidOrFilter('_aur_business_rule_value', businessRuleIds)
      : '',
  ].filter(Boolean)
  const [businessRulesResult, consequencesResult] = await Promise.all([
    businessRuleIds.length
      ? Aur_business_rulesesService.getAll({
          filter: buildGuidOrFilter('aur_business_rulesid', businessRuleIds),
        })
      : Promise.resolve({ data: [] }),
    consequenceFilterParts.length
      ? Aur_consequencesesService.getAll({
          filter: consequenceFilterParts.join(' or '),
        })
      : Promise.resolve({ data: [] }),
  ])

  const businessRuleCatalog = new Map(
    (businessRulesResult.data ?? []).map((rule) => [
      normalizeDataverseId(rule.aur_business_rulesid),
      {
        name: rule.aur_name,
        category: resolveBusinessRuleCategory(rule.aur_categoriesname, rule.aur_categories),
      },
    ]),
  )

  const quoteDetails: QuoteResponse[] = rawQuoteDetails.map((detail) => {
    const mapped = mapQuoteResponse(detail)
    const metadata = mapped.businessRuleId
      ? businessRuleCatalog.get(normalizeDataverseId(mapped.businessRuleId))
      : undefined

    return {
      ...mapped,
      businessRuleName: metadata?.name ?? mapped.businessRuleName,
      businessRuleCategory: metadata?.category ?? 'Uncategorized',
    }
  })
  const aiRuleGroups = buildAiRuleGroups(
    quoteDetails,
    businessRulesResult.data ?? [],
  )
  const emailIds = (emailsResult.data ?? []).map((email) => normalizeDataverseId(email.activityid)).filter(Boolean)
  const attachmentsResult = emailIds.length
    ? await ActivitymimeattachmentsService.getAll({
        filter: buildGuidOrFilter('_objectid_value', emailIds),
      })
    : { data: [] }
  const emailTimeline = buildInquiryEmails(inquiryId, emailsResult.data ?? [], attachmentsResult.data ?? [])

  const consequences = buildConsequences(consequencesResult.data ?? [])
  const consequenceDefinitionMap = new Map(
    consequences.map((consequence) => [
      normalizeDataverseId(consequence.id),
      consequence,
    ]),
  )
  const consequenceCatalog = new Map(
    (consequencesResult.data ?? []).map((consequence) => [
      normalizeDataverseId(consequence.aur_consequencesid),
      consequence.aur_name,
    ]),
  )
  const consequenceResults = (consequenceResultsResult.data ?? [])
    .filter((result) => normalizeDataverseId(result._aur_inquiry_value) === inquiryId)
    .map<ConsequenceResultSummary>((result) => {
      const linkedConsequence = result._aur_consequences_value
        ? consequenceDefinitionMap.get(normalizeDataverseId(result._aur_consequences_value))
        : undefined
      const rawResult = result as typeof result & {
        aur_action_status?: number | null
        aur_action_statusname?: string
        aur_add?: number | null
        aur_multiply?: number | null
      }

      return {
        id: result.aur_consequences_resultid,
        consequenceId: result._aur_consequences_value,
        consequenceName:
          (result._aur_consequences_value
            ? consequenceCatalog.get(normalizeDataverseId(result._aur_consequences_value))
            : undefined) ??
          result.aur_consequencesname ??
          'Unlinked consequence',
        name: result.aur_name,
        action: resolveConsequenceActionLabel(result.aur_actionname, result.aur_action),
        type: resolveConsequenceTypeLabel(result.aur_typename, result.aur_type),
        typeValue: result.aur_type ? String(result.aur_type) : '',
        actionStatusValue: rawResult.aur_action_status ? Number(rawResult.aur_action_status) : undefined,
        actionStatusLabel: resolveActionStatusLabel(
          rawResult.aur_action_statusname,
          rawResult.aur_action_status ?? undefined,
        ),
        documentTemplateId: linkedConsequence?.documentTemplateId,
        documentTemplateName: linkedConsequence?.documentTemplateName,
        emailTemplateId: linkedConsequence?.emailTemplateId,
        emailTemplateName: linkedConsequence?.emailTemplateName,
        riskScore: linkedConsequence?.riskScore,
        riskSummary: linkedConsequence?.riskSummary,
        ratingAdd: linkedConsequence?.ratingAdd ?? rawResult.aur_add ?? undefined,
        ratingMultiply: linkedConsequence?.ratingMultiply ?? rawResult.aur_multiply ?? undefined,
        createdOn: result.createdon,
      }
    })
  const notificationMessages = consequenceResults
    .filter((result) => normalizeNotificationType(result.type, result.typeValue))
    .map((result) =>
      result.consequenceId
        ? consequenceDefinitionMap.get(normalizeDataverseId(result.consequenceId))?.notificationText?.trim()
        : undefined,
    )
    .filter((message): message is string => Boolean(message))
  const uniqueNotificationMessages = [...new Set(notificationMessages)]

  const [account, contact, broker] = await Promise.all([
    inquiry._aur_account_value
      ? AccountsService.get(inquiry._aur_account_value).then((result) => result.data).catch(() => undefined)
      : Promise.resolve(undefined),
    inquiry._aur_contact_value
      ? ContactsService.get(inquiry._aur_contact_value).then((result) => result.data).catch(() => undefined)
      : Promise.resolve(undefined),
    inquiry._aur_account_value
      ? AccountsService.get(inquiry._aur_account_value).then((result) => result.data).catch(() => undefined)
      : Promise.resolve(undefined),
  ])

  console.info('[Inquiry Debug] broker agent lookup', {
    inquiryId,
    aurContactLookup: inquiry._aur_contact_value,
    aurContactFormatted: inquiry.aur_contactname,
    fetchedContactName: contact?.fullname ?? `${contact?.firstname ?? ''} ${contact?.lastname ?? ''}`.trim(),
  })

  return {
    account: mapRelatedParty(account),
    contact: mapRelatedParty(contact),
    broker: mapRelatedParty(broker),
    contactName:
      contact?.fullname?.trim() ||
      `${contact?.firstname ?? ''} ${contact?.lastname ?? ''}`.trim() ||
      inquiry.aur_contactname ||
      'No contact linked',
    quotes: quotes.map(mapQuoteSummary),
    quoteDetails,
    consequences,
    consequenceResults,
    aiRuleGroups,
    notificationNotice: uniqueNotificationMessages.length
      ? {
          title: uniqueNotificationMessages.length === 1 ? 'Notification' : 'Notifications',
          messages: uniqueNotificationMessages,
        }
      : undefined,
    emailTimeline,
    riCapacityChecks,
  }
}

export async function recalculateRiCapacityChecks(payload: {
  inquiryId: string
  productId: string
  totalSumInsured: number
}) {
  await OnDemand_RecalculationofRI_CapacityChecksService.Run({
    text: payload.inquiryId,
    text_1: payload.productId,
    number: payload.totalSumInsured,
  })
}

export async function listRiCapacityChecksForInquiry(inquiryId: string): Promise<RiCapacityCheckSummary[]> {
  const normalizedInquiryId = normalizeDataverseId(inquiryId)
  if (!normalizedInquiryId) return []

  const result = await Aur_ri_capacity_checksService.getAll({
    filter: `_aur_inquiry_id_value eq ${normalizedInquiryId}`,
    orderBy: ['createdon desc'],
  })

  return (result.data ?? [])
    .filter((record) => normalizeDataverseId(record._aur_inquiry_id_value) === normalizedInquiryId)
    .sort(
      (left, right) =>
        new Date(right.createdon ?? right.aur_calculated_on ?? '').getTime() -
        new Date(left.createdon ?? left.aur_calculated_on ?? '').getTime(),
    )
    .map((record) => ({
      id: record.aur_ri_capacity_checkid,
      name: record.aur_name ?? 'RI Capacity Check',
      outcome: record.aur_outcomename ?? riCapacityOutcomeLabel(record.aur_outcome) ?? 'Not evaluated',
      calculationSource:
        record.aur_calculation_sourcename ??
        riCapacityCalculationSourceLabel(record.aur_calculation_source) ??
        'Not specified',
      sumInsured: record.aur_sum_insured ?? 0,
      retainedAmount: record.aur_retained_amount ?? 0,
      treatyAbsorbed: record.aur_treaty_absorbed ?? 0,
      excessToPlace: record.aur_excess_to_place ?? 0,
      treatyName: record.aur_treaty_idname ?? 'No treaty linked',
      calculatedOn: record.aur_calculated_on,
      createdOn: record.createdon,
    }))
}

export async function getInquiryEditorOptions() {
  if (!inquiryEditorOptionsPromise) {
    inquiryEditorOptionsPromise = getInquiryEditorOptionsUncached()
  }
  return inquiryEditorOptionsPromise
}

export async function createInquiry(payload: {
  name: string
  inquiryType?: number
  statusCode?: number
  productId?: string
  planId?: string
  brokerId?: string
}) {
  const result = await Aur_quotesesService.create({
    aur_name: payload.name,
    ...(payload.inquiryType !== undefined ? { aur_inquiry_type: payload.inquiryType as never } : {}),
    ...(payload.statusCode !== undefined ? { statuscode: payload.statusCode as never } : {}),
    ...(payload.productId ? { 'aur_product@odata.bind': `/aur_productses(${payload.productId})` } : {}),
    ...(payload.planId ? { 'aur_plan@odata.bind': `/aur_plans(${payload.planId})` } : {}),
    ...(payload.brokerId ? { 'aur_account@odata.bind': `/accounts(${payload.brokerId})` } : {}),
  } as never)

  return result.data?.aur_quotesid ?? ''
}

export interface ConsequenceTemplatePreview {
  id: string
  kind: 'document' | 'email'
  name: string
  status: string
  content: string
  subject?: string
  description?: string
  category?: string
}

export async function getConsequenceTemplatePreview(
  kind: 'document' | 'email',
  id: string,
): Promise<ConsequenceTemplatePreview> {
  if (kind === 'document') {
    const record = (await Aur_customdocumenttemplatesesService.get(id)).data
    if (!record) {
      throw new Error('Document template not found.')
    }

    return {
      id: record.aur_customdocumenttemplatesid,
      kind,
      name: record.aur_name,
      status: record.statuscodename ?? (Number(record.statuscode) === 2 ? 'Inactive' : 'Active'),
      content: record.aur_templatecontent ?? '',
    }
  }

  const record = (await Cr058_emailtemplatesService.get(id)).data
  if (!record) {
    throw new Error('Email template not found.')
  }

  return {
    id: record.cr058_emailtemplateid,
    kind,
    name: record.cr058_templatename,
    subject: record.cr058_subject,
    description: record.cr058_description ?? '',
    category: record.cr058_categoryname ?? 'General',
    status: record.statuscodename ?? (record.cr058_isactive ? 'Active' : 'Inactive'),
    content: record.cr058_body ?? '',
  }
}

export async function getConsequenceLinkedTemplatePreview(
  consequenceId: string,
  preferredKind: 'document' | 'email',
): Promise<ConsequenceTemplatePreview> {
  const normalizedConsequenceId = normalizeDataverseId(consequenceId)
  const consequenceResult = await Aur_consequencesesService.getAll({
    select: [
      'aur_consequencesid',
      '_aur_documenttemplate_value',
      '_aur_emailtemplate_value',
      'aur_action',
      'aur_type',
    ],
    filter: `aur_consequencesid eq ${normalizedConsequenceId}`,
  })

  const consequence = consequenceResult.data?.[0] as ((typeof consequenceResult.data)[number] & {
    _aur_emailtemplate_value?: string
    _aur_documenttemplate_value?: string
  }) | undefined

  if (!consequence) {
    throw new Error('Linked consequence was not found.')
  }

  const documentTemplateId = consequence._aur_documenttemplate_value
  const emailTemplateId = consequence._aur_emailtemplate_value

  if (preferredKind === 'document' && documentTemplateId) {
    return getConsequenceTemplatePreview('document', documentTemplateId)
  }

  if (preferredKind === 'email' && emailTemplateId) {
    return getConsequenceTemplatePreview('email', emailTemplateId)
  }

  if (documentTemplateId) {
    return getConsequenceTemplatePreview('document', documentTemplateId)
  }

  if (emailTemplateId) {
    return getConsequenceTemplatePreview('email', emailTemplateId)
  }

  throw new Error('No linked document or email template is configured on this consequence.')
}

async function getInquiryEditorOptionsUncached() {
  const referenceData = await getInquiryReferenceData()

  const brokerAccounts = (referenceData.accounts ?? []).filter((record) => {
    const typeName = record.aur_account_typename?.toLowerCase()
    return record.aur_account_type === 751820000 || typeName === 'broker'
  })

  return {
    products: (referenceData.products ?? []).map((record) => ({ id: record.aur_productsid, name: record.aur_name })),
    plans: (referenceData.plans ?? []).map((record) => ({
      id: record.aur_planid,
      name: record.aur_name ?? 'Unnamed plan',
      productId: record._aur_product_value ?? '',
    })),
    brokers: brokerAccounts.map((record) => ({ id: record.accountid, name: record.name ?? 'Unnamed broker' })),
    inquiryTypes: INQUIRY_TYPE_OPTIONS,
    inquiryStatuses: INQUIRY_STATUS_OPTIONS,
    coverTypes: [
      { value: 1, label: 'PAR All Risks' },
      { value: 2, label: 'Named Perils' },
      { value: 3, label: 'Aviation Hull Liability' },
      { value: 4, label: 'Liability Only' },
      { value: 5, label: 'Hull Only' },
    ],
    paymentTerms: [
      { value: 1, label: 'Annual' },
      { value: 2, label: 'Quarterly' },
      { value: 3, label: 'Monthly' },
    ],
  }
}

export async function saveInquiryDetail(
  id: string,
  payload: {
    name: string
    productId?: string
    inquiryType?: number
    inquiryStatus?: number
    planId?: string
    brokerId?: string
    planDetails: string
    coverType?: number
    riskScore: number
    riskDescription: string
    totalSumInsured: number
    territorialScope: string
    noOfItems: string
    basePremium: number
    underwriterActionStatus?: number | null
    underwriterSubAction?: number | null
    premiumToBeCharged: number
    brokerage: number
    grossPremium: number
    paymentTerm?: number
    fee: number
    totalDeduction: number
    riskSummary?: string
  },
) {
  const recordId = normalizeDataverseId(id)
  const updatePayload = {
    aur_name: payload.name,
    ...(payload.productId ? { 'aur_product@odata.bind': `/aur_productses(${payload.productId})` } : {}),
    ...(payload.planId ? { 'aur_plan@odata.bind': `/aur_plans(${payload.planId})` } : {}),
    ...(payload.brokerId ? { 'aur_account@odata.bind': `/accounts(${payload.brokerId})` } : {}),
    aur_plan_details: payload.planDetails,
    ...(payload.inquiryType !== undefined ? { aur_inquiry_type: payload.inquiryType as never } : {}),
    ...(payload.inquiryStatus !== undefined ? { statuscode: payload.inquiryStatus as never } : {}),
    ...(payload.coverType !== undefined ? { aur_cover_type: payload.coverType as never } : {}),
    ...(payload.paymentTerm !== undefined ? { aur_payment_term: payload.paymentTerm as never } : {}),
    aur_risk_score: payload.riskScore,
    aur_risk_description: payload.riskDescription,
    aur_total_sum_insured: payload.totalSumInsured,
    aur_territorial_scope: payload.territorialScope,
    aur_no_of_items: payload.noOfItems,
    aur_base_premium: payload.basePremium,
    ...(payload.underwriterActionStatus !== undefined ? { aur_underwriter_action_status: payload.underwriterActionStatus } : {}),
    ...(payload.underwriterSubAction !== undefined ? { aur_underwriter_sub_action: payload.underwriterSubAction } : {}),
    aur_total_amount_charge: payload.premiumToBeCharged,
    aur_brokerage_pct: payload.brokerage,
    aur_gross_premium: payload.grossPremium,
    aur_fee: payload.fee,
    aur_total_deduction_pct: payload.totalDeduction,
    ...(payload.riskSummary !== undefined ? { aur_risksummary: payload.riskSummary } : {}),
  }

  console.info('[Inquiry Debug] saveInquiryDetail payload', {
    id: recordId,
    inquiryStatus: payload.inquiryStatus,
    updatePayload,
  })

  await Aur_quotesesService.update(recordId, updatePayload as never)
}

function resolveInquiryRelations(
  inquiry: Awaited<ReturnType<typeof Aur_quotesesService.get>>['data'] extends infer T ? NonNullable<T> : never,
  productMap: Map<string, string>,
  planMap: Map<string, string>,
  accountMap: Map<string, { name: string; type?: string; typeCode?: number }>,
) {
  const accountLookupId = normalizeDataverseId(inquiry._aur_account_value)
  const productLookupId = normalizeDataverseId(inquiry._aur_product_value)
  const planLookupId = normalizeDataverseId(inquiry._aur_plan_value)
  const account = accountLookupId ? accountMap.get(accountLookupId) : undefined
  const brokerAccount = accountLookupId ? accountMap.get(accountLookupId) : undefined
  const inferredBrokerName =
    inquiry.aur_brokername ??
    inquiry.aur_accountname ??
    brokerAccount?.name

  return {
    ...inquiry,
    aur_accountname:
      inquiry.aur_accountname || !inquiry._aur_account_value
        ? inquiry.aur_accountname
        : account?.name ?? inquiry.aur_accountname,
    aur_productname:
      inquiry.aur_productname || !inquiry._aur_product_value
        ? inquiry.aur_productname
        : productMap.get(productLookupId) ?? inquiry.aur_productname,
    aur_planname:
      inquiry.aur_planname || !inquiry._aur_plan_value
        ? inquiry.aur_planname
        : planMap.get(planLookupId) ?? inquiry.aur_planname,
    aur_brokername: inferredBrokerName,
  }
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

export async function updateInquiryDisposition(
  id: string,
  disposition: 'Decline' | 'RefertoUnderwriter' | 'EscalatetoHeadofAviation' | 'PropertyorReinsuranceTeam',
) {
  const inquiryStatusMap = {
    Decline: 751820011,
    RefertoUnderwriter: 751820010,
    EscalatetoHeadofAviation: 751820013,
    PropertyorReinsuranceTeam: 751820014,
  } as const

  await Aur_quotesesService.update(id, {
    statuscode: inquiryStatusMap[disposition] as never,
  })
}

export async function applyInquiryConsequenceResult(input: {
  inquiryId: string
  consequenceResultId: string
  statusCode?: number
  riskScoreIncrement?: number
  riskSummaryAppend?: string
  basePremium?: number
}) {
  const inquiryResult = await Aur_quotesesService.get(input.inquiryId)
  const inquiry = inquiryResult.data
  if (!inquiry) {
    throw new Error('Inquiry not found.')
  }

  const nextRiskScore =
    input.riskScoreIncrement !== undefined
      ? (inquiry.aur_risk_score ?? 0) + input.riskScoreIncrement
      : inquiry.aur_risk_score ?? 0
  const nextRiskSummary =
    input.riskSummaryAppend !== undefined
      ? appendRiskSummary(inquiry.aur_risksummary ?? '', input.riskSummaryAppend)
      : inquiry.aur_risksummary ?? ''

  const inquiryPayload = {
    ...(input.statusCode !== undefined ? { statuscode: input.statusCode as never } : {}),
    ...(input.riskScoreIncrement !== undefined ? { aur_risk_score: nextRiskScore } : {}),
    ...(input.riskSummaryAppend !== undefined ? { aur_risksummary: nextRiskSummary } : {}),
    ...(input.basePremium !== undefined
      ? {
          aur_base_premium: input.basePremium,
          aur_total_amount_charge: input.basePremium,
        }
      : {}),
  }

  await Promise.all([
    Object.keys(inquiryPayload).length
      ? Aur_quotesesService.update(input.inquiryId, inquiryPayload as never)
      : Promise.resolve(),
    Aur_consequences_resultsService.update(input.consequenceResultId, {
      aur_action_status: 751820001,
    } as never),
  ])

  return {
    riskScore: nextRiskScore,
    riskSummary: nextRiskSummary,
    basePremium: input.basePremium,
    statusCode: input.statusCode,
    actionStatusValue: 751820001,
  }
}

export async function applyInquiryRatingOrder(input: {
  inquiryId: string
  premiumToBeCharged: number
}) {
  await Aur_quotesesService.update(input.inquiryId, {
    aur_total_amount_charge: input.premiumToBeCharged,
    aur_action_applied: true,
  } as never)

  return {
    premiumToBeCharged: input.premiumToBeCharged,
    actionApplied: true,
  }
}

export async function syncInquiryHealthFinalPremium(inquiryId: string, finalPremium: number) {
  if (!Number.isFinite(finalPremium) || finalPremium < 0) throw new Error('The evaluated policy premium is invalid.')
  await Aur_quotesesService.update(inquiryId, { aur_total_amount_charge: finalPremium } as never)
}

export async function createQuoteFromInquiry(
  inquiryId: string,
  fallback?: {
    productId?: string
    planId?: string
    premiumToBeCharged?: number
  },
) {
  const recordId = normalizeDataverseId(inquiryId)
  const inquiryResult = await Aur_quotesesService.get(recordId)
  if (!inquiryResult.success) throw inquiryResult.error ?? new Error('Unable to load the inquiry for quote creation.')
  const inquiry = inquiryResult.data
  if (!inquiry) throw new Error('Inquiry not found.')

  const referenceCode = inquiry.aur_quote_number?.trim() || inquiry.aur_name?.trim() || 'Inquiry'
  const customerName = inquiry.aur_contactname?.trim() || inquiry.aur_name?.trim() || 'Customer'
  const totalPremium = inquiry.aur_total_amount_charge ?? fallback?.premiumToBeCharged ?? 0
  const grossPremium = inquiry.aur_gross_premium ?? 0
  const loadingPremium = grossPremium * 0.1
  const productId = inquiry._aur_product_value ?? fallback?.productId
  const planId = inquiry._aur_plan_value ?? fallback?.planId
  const planResult = planId ? await Aur_plansService.get(normalizeDataverseId(planId)) : undefined
  if (planResult && !planResult.success) throw planResult.error ?? new Error('Unable to load the selected plan for quote creation.')
  const plan = planResult?.data
  if (planId && !plan) throw new Error('The selected inquiry plan could not be loaded.')
  const vat = (plan as (typeof plan & { aur_vat?: number | null }))?.aur_vat ?? 0

  const record = {
    aur_name: `${referenceCode} - ${customerName}`,
    ...(productId ? { 'aur_product@odata.bind': `/aur_productses(${productId})` } : {}),
    ...(planId ? { 'aur_plan@odata.bind': `/aur_plans(${planId})` } : {}),
    'aur_quotes@odata.bind': `/aur_quoteses(${recordId})`,
    aur_total_premium: quoteWholeNumber(totalPremium, 'Total Premium'),
    aur_gross_premium: quoteWholeNumber(grossPremium, 'Gross Premium'),
    aur_loading_premium: quoteWholeNumber(loadingPremium, 'Loading Premium'),
    aur_vat: quoteWholeNumber(vat, 'VAT'),
    aur_ai_generated_summary:
      inquiry.aur_risksummary?.trim() || inquiry.aur_summary?.trim() || undefined,
    aur_reason: 'Created from inquiry detail workspace',
  }

  const created = await Aur_quotesService.create(record as never)
  if (!created.success) throw created.error ?? new Error('Quote creation failed. Please try again.')
  const createdId = normalizeDataverseId(created.data?.aur_quoteid)
  if (!createdId) throw new Error('Quote creation did not return a record ID. Refresh the quote list before trying again.')
  const savedQuote = await Aur_quotesService.get(createdId)
  if (!savedQuote.success || !savedQuote.data) {
    throw savedQuote.error ?? new Error('The quote was created but could not be verified. Refresh the quote list before trying again.')
  }
  if (normalizeDataverseId(savedQuote.data._aur_quotes_value) !== recordId) {
    throw new Error('The created quote is not linked to this inquiry. Please check its Inquiry lookup before creating another quote.')
  }
  await deactivateSiblingQuotes(recordId, [createdId])
  return createdId
}

async function listQuotesForInquiry(inquiryId: string) {
  const records: NonNullable<Awaited<ReturnType<typeof Aur_quotesService.getAll>>['data']> = []
  let skipToken: string | undefined
  do {
    const result = await Aur_quotesService.getAll({
      filter: `_aur_quotes_value eq ${normalizeDataverseId(inquiryId)}`,
      orderBy: ['createdon desc'],
      ...(skipToken ? { skipToken } : {}),
    })
    if (!result.success) throw result.error ?? new Error('Unable to load this inquiry\'s quotes. Please refresh and try again.')
    records.push(...(result.data ?? []))
    skipToken = result.skipToken
  } while (skipToken)
  return records
}

export async function listWonQuotesForProduct(productId: string) {
  const normalizedProductId = normalizeDataverseId(productId)
  if (!normalizedProductId) return []

  const [quotesResult, referenceData] = await Promise.all([
    Aur_quotesService.getAll({
      filter: `_aur_product_value eq ${normalizedProductId} and aur_quote_status eq 751820000`,
      orderBy: ['createdon desc'],
    }),
    getInquiryReferenceData(),
  ])

  const productMap = new Map((referenceData.products ?? []).map((product) => [product.aur_productsid, product.aur_name]))
  const planMap = new Map((referenceData.plans ?? []).map((plan) => [plan.aur_planid, plan.aur_name ?? 'Unnamed plan']))

  return (quotesResult.data ?? [])
    .map((quote) => resolveQuoteRelations(quote, productMap, planMap))
    .map(mapQuoteSummary)
}

export async function copyQuotesToInquiry(
  inquiryId: string,
  quoteIds: string[],
) {
  const normalizedQuoteIds = [...new Set(quoteIds.map((id) => normalizeDataverseId(id)).filter(Boolean))]
  if (normalizedQuoteIds.length === 0) {
    return []
  }

  const targetInquiryResult = await Aur_quotesesService.get(inquiryId)
  const targetInquiry = targetInquiryResult.data
  if (!targetInquiry) {
    throw new Error('Target inquiry not found.')
  }
  const targetInquiryNumber = targetInquiry.aur_quote_number?.trim()
  const targetInquiryName = targetInquiry.aur_name?.trim() || 'Inquiry'
  const targetQuoteName = targetInquiryNumber
    ? `${targetInquiryNumber} - ${targetInquiryName}`
    : targetInquiryName

  const sourceQuotes = await Promise.all(
    normalizedQuoteIds.map(async (quoteId) => {
      const result = await Aur_quotesService.get(quoteId)
      return result.data
    }),
  )

  const createdQuoteIds = await Promise.all(
    sourceQuotes
      .filter((quote): quote is NonNullable<typeof quote> => Boolean(quote))
      .map(async (quote) => {
        const record = {
          aur_name: targetQuoteName,
          ...(quote._aur_product_value
            ? { 'aur_product@odata.bind': `/aur_productses(${quote._aur_product_value})` }
            : {}),
          ...(quote._aur_plan_value
            ? { 'aur_plan@odata.bind': `/aur_plans(${quote._aur_plan_value})` }
            : {}),
          ...(quote._aur_coverage_value
            ? { 'aur_coverage@odata.bind': `/aur_coverageses(${quote._aur_coverage_value})` }
            : {}),
          ...(quote._aur_benefits_value
            ? { 'aur_benefits@odata.bind': `/aur_benefitses(${quote._aur_benefits_value})` }
            : {}),
          ...(quote._aur_inclusions_value
            ? { 'aur_inclusions@odata.bind': `/aur_inclusionses(${quote._aur_inclusions_value})` }
            : {}),
          ...(quote._aur_exclusions_value
            ? { 'aur_exclusions@odata.bind': `/aur_exclusionses(${quote._aur_exclusions_value})` }
            : {}),
          ...(quote._aur_deductibles_value
            ? { 'aur_deductibles@odata.bind': `/aur_deductibleses(${quote._aur_deductibles_value})` }
            : {}),
          ...(quote._aur_warranties_value
            ? { 'aur_warranties@odata.bind': `/aur_warrantieses(${quote._aur_warranties_value})` }
            : {}),
          'aur_quotes@odata.bind': `/aur_quoteses(${normalizeDataverseId(inquiryId)})`,
          aur_total_premium: quote.aur_total_premium ?? 0,
          aur_gross_premium: quote.aur_gross_premium ?? 0,
          aur_loading_premium: quote.aur_loading_premium ?? 0,
          aur_vat: quote.aur_vat ?? 0,
          aur_ai_generated_summary: quote.aur_ai_generated_summary ?? undefined,
          aur_reason: quote.aur_reason ?? undefined,
          statecode: 0,
          statuscode: 1,
        }

        const created = await Aur_quotesService.create(record as never)
        return created.data?.aur_quoteid
      }),
  )

  const filteredCreatedIds = createdQuoteIds.filter((value): value is string => Boolean(value))
  if (filteredCreatedIds.length) {
    await deactivateSiblingQuotes(inquiryId, filteredCreatedIds)
  }

  return filteredCreatedIds
}

async function deactivateSiblingQuotes(inquiryId: string, excludeIds: string[]) {
  const result = await Aur_quotesService.getAll({
    filter: `_aur_quotes_value eq ${normalizeDataverseId(inquiryId)}`,
  })

  const excluded = new Set(excludeIds.map((id) => normalizeDataverseId(id)))
  const updates = (result.data ?? [])
    .filter((quote) => {
      const quoteId = normalizeDataverseId(quote.aur_quoteid)
      return quoteId && !excluded.has(quoteId)
    })
    .map((quote) =>
      Aur_quotesService.update(quote.aur_quoteid, {
        aur_quote_status: 751820002 as never,
      }),
    )

  await Promise.all(updates)
}

export async function recordInquiryConsequenceResult(
  inquiryId: string,
  input: { consequenceId?: string; name: string; action: number; type: number },
) {
  await Aur_consequences_resultsService.create({
    aur_name: input.name,
    aur_action: input.action as never,
    aur_type: input.type as never,
    ...(input.consequenceId
      ? { 'aur_consequences@odata.bind': `/aur_consequenceses(${input.consequenceId})` }
      : {}),
    'aur_inquiry@odata.bind': `/aur_quoteses(${inquiryId})`,
  } as never)
}

export async function createInquiryEmail(
  inquiryId: string,
  input: {
    sender: string
    toRecipients: string
    subject: string
    description: string
  },
) {
  const created = await EmailsService.create({
    sender: input.sender,
    torecipients: input.toRecipients,
    subject: input.subject,
    description: input.description,
    directioncode: true,
    statecode: 0,
    statuscode: 1,
    'regardingobjectid_aur_quotes@odata.bind': `/aur_quoteses(${inquiryId})`,
  } as never)

  return created.data?.activityid
}

export async function updateInquiryQuoteDetailResponse(
  quoteDetailId: string,
  response: string,
): Promise<QuoteResponse> {
  const updated = await Aur_quotes_detailsesService.update(quoteDetailId, {
    aur_response: response,
  } as never)

  return mapQuoteResponse(updated.data ?? {
    aur_quotes_detailsid: quoteDetailId,
    aur_response: response,
  } as never)
}

function buildConsequences(
  consequences: Awaited<ReturnType<typeof Aur_consequencesesService.getAll>>['data'],
): ConsequenceDefinition[] {
  return (consequences ?? [])
    .map((consequence) => {
      const consequenceRecord = consequence as typeof consequence & {
        aur_riskscore?: number | null
        aur_risksummary?: string | null
        aur_add?: number | null
        aur_multiply?: number | null
      }

      return {
        id: consequence.aur_consequencesid,
        businessRuleId: consequence._aur_business_rule_value,
        businessRuleName: consequence.aur_business_rulename ?? 'Business Rule',
        name: consequence.aur_name,
        action: consequence.aur_actionname ?? 'Unknown action',
        type: consequence.aur_typename ?? 'Unknown type',
        notificationText: consequence.aur_notification_text ?? 'No notification text configured.',
        documentTemplateId: consequence._aur_documenttemplate_value ?? undefined,
        documentTemplateName: consequence.aur_documenttemplatename,
        emailTemplateId:
          (consequence as typeof consequence & { _aur_emailtemplate_value?: string })
            ._aur_emailtemplate_value ?? undefined,
        emailTemplateName:
          (consequence as typeof consequence & { aur_emailtemplatename?: string })
            .aur_emailtemplatename,
        riskScore: consequenceRecord.aur_riskscore ?? undefined,
        riskSummary: consequenceRecord.aur_risksummary ?? undefined,
        ratingAdd: consequenceRecord.aur_add ?? undefined,
        ratingMultiply: consequenceRecord.aur_multiply ?? undefined,
      }
    })
}

function normalizeNotificationType(typeLabel?: string, typeValue?: string | number) {
  return typeLabel?.trim().toLowerCase() === 'notification' || Number(typeValue) === 2
}

export function mergeInquiryWorkspace(
  detail: InquiryDetail,
  consequences: ConsequenceDefinition[],
  consequenceResults: ConsequenceResultSummary[],
  aiRuleGroups: InquiryRuleGroup[],
  emailTimeline: InquiryEmailSummary[],
) {
  return {
    ...detail,
    consequences,
    consequenceResults,
    aiRuleGroups,
    emailTimeline,
    productRuleLinkNotice:
      'Product-specific business-rule loading still depends on the unresolved product-to-rule junction datasource. The AI tab currently groups the matched rule responses category-wise from the extracted Dataverse rule context.',
  }
}

function resolveConsequenceActionLabel(formatted: string | undefined, raw: string | number | undefined) {
  const label = consequenceActionLabel(raw) || formatted?.trim()
  return label ? humanizePascalChoice(label) : 'Unknown action'
}

function resolveConsequenceTypeLabel(formatted: string | undefined, raw: string | number | undefined) {
  const label = consequenceTypeLabel(raw) || formatted?.trim()
  return label ? humanizePascalChoice(label) : 'Unknown type'
}

function resolveActionStatusLabel(formatted: string | undefined, raw: string | number | undefined) {
  const numericValue = Number(raw)
  if (numericValue === 751820000) return 'Not Applied'
  if (numericValue === 751820001) return 'Applied'
  return formatted?.trim() || 'Not Applied'
}

function consequenceActionLabel(value: string | number | undefined) {
  switch (Number(value)) {
    case 1:
      return 'Decline'
    case 2:
      return 'Refer to Underwriter'
    case 3:
      return 'Escalate to Head of Aviation'
    case 4:
      return 'Property or Reinsurance Team'
    case 5:
      return 'Request Missing Information'
    case 6:
      return 'Document'
    case 7:
      return 'Generate Decline Letter'
    case 8:
      return 'Generate Notice of Cancellation'
    case 9:
      return 'Update Risk Score'
    case 10:
      return 'Email'
    case 751820001:
      return 'Update Risk Summary'
    case 751820002:
      return 'Add'
    case 751820003:
      return 'Multiply'
    default:
      return ''
  }
}

function consequenceTypeLabel(value: string | number | undefined) {
  switch (Number(value)) {
    case 1:
      return 'Case Control'
    case 2:
      return 'Notification'
    case 3:
      return 'Document'
    case 4:
      return 'Risk'
    case 5:
      return 'Email'
    case 6:
      return 'Rating'
    default:
      return ''
  }
}

function humanizePascalChoice(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeDataverseId(value?: string) {
  return (value ?? '').replace(/[{}]/g, '').toLowerCase()
}

function appendRiskSummary(current: string, addition: string) {
  const normalizedCurrent = current.trim()
  const normalizedAddition = addition.trim()

  if (!normalizedAddition) return normalizedCurrent
  if (!normalizedCurrent) return normalizedAddition
  if (normalizedCurrent.includes(normalizedAddition)) return normalizedCurrent

  return `${normalizedCurrent}\n\n${normalizedAddition}`
}

function buildAiRuleGroups(
  responses: QuoteResponse[],
  businessRules: Awaited<ReturnType<typeof Aur_business_rulesesService.getAll>>['data'],
): InquiryRuleGroup[] {
  const catalog = new Map(
    (businessRules ?? []).map((rule) => [
      rule.aur_business_rulesid,
      {
        name: rule.aur_name,
        category: rule.aur_categoriesname ?? 'Uncategorized',
      },
    ]),
  )

  const grouped = responses.reduce((map, response) => {
    const metadata = response.businessRuleId ? catalog.get(response.businessRuleId) : undefined
    const category = metadata?.category ?? 'Uncategorized'
    const current = map.get(category) ?? []
    current.push({
      id: response.id,
      name: metadata?.name ?? response.businessRuleName,
      response: response.response,
      evidence: response.evidence,
      conditionMet: response.conditionMet,
    })
    map.set(category, current)
    return map
  }, new Map<string, InquiryRuleGroup['rules']>())

  return Array.from(grouped, ([category, rules]) => ({ category, rules }))
}

function resolveBusinessRuleCategory(formatted: string | undefined, raw: string | number | undefined) {
  const normalizedFormatted = formatted?.replaceAll('_', ' ').trim()
  if (normalizedFormatted) {
    return humanizePascalChoice(normalizedFormatted)
      .replace('Eligibility Appetite', 'Eligibility & Appetite')
      .replace('Financial Capacity Limits', 'Financial & Capacity Limits')
      .replace('Contractual Terms Clauses', 'Contractual Terms & Clauses')
  }

  switch (Number(raw)) {
    case 1:
      return 'Eligibility & Appetite'
    case 2:
      return 'Domicile'
    case 3:
      return 'Submission Completeness'
    case 4:
      return 'Risk'
    case 5:
      return 'History'
    case 6:
      return 'Financial & Capacity Limits'
    case 7:
      return 'Contractual Terms & Clauses'
    default:
      return Aur_business_rulesesaur_categories[Number(raw) as keyof typeof Aur_business_rulesesaur_categories]
        ? humanizePascalChoice(
            Aur_business_rulesesaur_categories[Number(raw) as keyof typeof Aur_business_rulesesaur_categories],
          )
        : 'Uncategorized'
  }
}

function buildInquiryEmails(
  inquiryId: string,
  emails: Awaited<ReturnType<typeof EmailsService.getAll>>['data'],
  attachments: Awaited<ReturnType<typeof ActivitymimeattachmentsService.getAll>>['data'],
): InquiryEmailSummary[] {
  const attachmentsByEmail = (attachments ?? []).reduce((map, attachment) => {
    const emailId = attachment._objectid_value ?? attachment._activityid_value
    if (!emailId) return map
    const current = map.get(emailId) ?? []
    current.push({
      id: attachment.activitymimeattachmentid,
      name: attachment.filename ?? attachment.subject ?? 'Attachment',
      mimeType: attachment.mimetype,
      sizeLabel: formatAttachmentSize(attachment.filesize),
    })
    map.set(emailId, current)
    return map
  }, new Map<string, InquiryEmailSummary['attachments']>())

  const timeline: InquiryEmailSummary[] = (emails ?? [])
    .filter((email) => normalizeDataverseId(email._regardingobjectid_value) === inquiryId)
    .map((email) => {
      const parsed = extractEmailMetadata(email.description ?? '')
      const status = getEmailStatusLabel(email.statuscodename, email.statuscode, email.directioncode)
      return {
        id: email.activityid,
        subject: email.subject ?? parsed.subject ?? 'Untitled email',
        body: email.description ?? 'No email body captured.',
        sender: firstNonEmpty(email.sender, email.from, parsed.sender, email.owneridname, 'Unknown sender'),
        toRecipients: firstNonEmpty(email.torecipients, email.to, parsed.toRecipients, 'No recipients'),
        regardingId: email._regardingobjectid_value,
        status,
        direction: (email.directioncode ? 'sent' : 'received') as 'sent' | 'received',
        createdOn: email.senton ?? email.createdon ?? email.actualend,
        attachments: attachmentsByEmail.get(email.activityid) ?? [],
      }
    })
    .sort((left, right) => new Date(right.createdOn ?? 0).getTime() - new Date(left.createdOn ?? 0).getTime())
  return preferReceivedInquiryEmails(timeline)
}

async function listQuoteDetailsForInquiry(inquiryId: string) {
  const records = []
  let skipToken: string | undefined

  do {
    const result = await Aur_quotes_detailsesService.getAll({
      filter: `_aur_quotes_value eq ${inquiryId}`,
      select: [
        'aur_quotes_detailsid',
        '_aur_business_rules_value',
        'aur_condition_met',
        'aur_confidence_score',
        'aur_evidence',
        'aur_name',
        '_aur_quotes_value',
        'aur_response',
        'statuscode',
      ],
      ...(skipToken ? { skipToken } : {}),
    })

    records.push(
      ...(result.data ?? []),
    )

    skipToken = result.skipToken
  } while (skipToken)

  return records
}

async function getInquiryReferenceData(): Promise<InquiryReferenceData> {
  if (!inquiryReferenceDataPromise) {
    inquiryReferenceDataPromise = Promise.all([
      Aur_productsesService.getAll({
        select: ['aur_productsid', 'aur_name'],
      }),
      Aur_plansService.getAll({
        select: ['aur_planid', 'aur_name', '_aur_product_value'],
      }),
      AccountsService.getAll({
        select: ['accountid', 'name', 'aur_account_type', 'aur_account_typename'],
      }),
    ]).then(([productsResult, plansResult, accountsResult]) => ({
      products: productsResult.data ?? [],
      plans: plansResult.data ?? [],
      accounts: accountsResult.data ?? [],
    }))
  }

  return inquiryReferenceDataPromise
}

function buildGuidOrFilter(fieldName: string, ids: string[]) {
  return ids
    .map((id) => `${fieldName} eq ${normalizeDataverseId(id)}`)
    .join(' or ')
}

function extractEmailMetadata(html: string) {
  const text = html.replace(/<[^>]+>/g, '\n').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim()
  const sender = text.match(/(?:^|\s)From:\s*(.+?)(?=\s(?:To:|Sent:|Cc:|Subject:|$))/i)?.[1]?.trim()
  const toRecipients = text.match(/(?:^|\s)To:\s*(.+?)(?=\s(?:From:|Sent:|Cc:|Subject:|$))/i)?.[1]?.trim()
  const subject = text.match(/(?:^|\s)Subject:\s*(.+?)(?=\s(?:From:|To:|Sent:|Cc:|$))/i)?.[1]?.trim()
  return { sender, toRecipients, subject }
}

function firstNonEmpty(...values: Array<string | undefined>) {
  return values.find((value) => value && value.trim()) ?? ''
}

function getEmailStatusLabel(
  statusName?: string | null,
  statusCode?: string | number | null,
  directionCode?: boolean | null,
) {
  if (typeof statusName === 'string' && statusName.trim()) {
    return statusName.trim()
  }
  if (typeof statusCode === 'number' || typeof statusCode === 'string') {
    const normalized = Number(statusCode)
    if (!Number.isNaN(normalized)) {
      if (normalized === 1) return 'Draft'
      if (normalized === 2) return 'Completed'
      if (normalized === 3) return 'Sent'
      if (normalized === 4) return 'Received'
      if (normalized === 5) return 'Canceled'
      if (normalized === 6) return 'Pending Send'
      if (normalized === 7) return 'Sending'
      if (normalized === 8) return 'Failed'
    }
  }
  return directionCode ? 'Sent' : 'Received'
}

function formatAttachmentSize(size?: number) {
  if (!size || size <= 0) return undefined
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  if (size >= 1024) return `${Math.round(size / 1024)} KB`
  return `${size} B`
}

function riCapacityOutcomeLabel(value?: string | number | null) {
  const normalized = Number(value)
  if (normalized === 1) return 'Within Retention'
  if (normalized === 2) return 'Within Treaty'
  if (normalized === 3) return 'Facultative Required'
  if (normalized === 4) return 'Refer to RI Manager'
  if (normalized === 5) return 'No Treaty Found'
  return undefined
}

function riCapacityCalculationSourceLabel(value?: string | number | null) {
  const normalized = Number(value)
  if (normalized === 1) return 'AI Extraction'
  if (normalized === 2) return 'Manual Entry'
  if (normalized === 3) return 'Recalculation'
  return undefined
}
