import { AccountsService } from '../generated/services/AccountsService'
import { Aur_aml_screeningsService } from '../generated/services/Aur_aml_screeningsService'
import { Aur_custom_document_templatesesService } from '../generated/services/Aur_custom_document_templatesesService'
import { Aur_policy_bookingsService } from '../generated/services/Aur_policy_bookingsService'
import { Aur_policy_conversionsService } from '../generated/services/Aur_policy_conversionsService'
import { Aur_productsesService } from '../generated/services/Aur_productsesService'
import { Aur_quotesService } from '../generated/services/Aur_quotesService'
import { BusinessunitsService } from '../generated/services/BusinessunitsService'
import { ContactsService } from '../generated/services/ContactsService'
import { TemplatesService } from '../generated/services/TemplatesService'
import { EmailsService } from '../generated/services/EmailsService'
import { GeneratePaymentLinkService } from '../generated/services/GeneratePaymentLinkService'
import { SystemusersService } from '../generated/services/SystemusersService'
import { TransactioncurrenciesService } from '../generated/services/TransactioncurrenciesService'
import type {
  AmlScreeningFormState,
  InquiryEmailSummary,
  PolicyBookingFormState,
  PolicyConversionDetail,
  PolicyConversionSummary,
} from '../domain/app'

export interface PolicyConversionOptions {
  accounts: LookupOption[]
  contacts: LookupOption[]
  products: LookupOption[]
  businessUnits: LookupOption[]
  currencies: LookupOption[]
  users: LookupOption[]
}

export interface LookupOption {
  id: string
  name: string
  email?: string
  type?: number
}

export interface ConversionTemplatePreview {
  id: string
  title: string
  subject?: string
  content: string
}

export async function listPolicyConversions(): Promise<PolicyConversionSummary[]> {
  const result = await Aur_policy_conversionsService.getAll({ orderBy: ['createdon desc'] })
  return (result.data ?? []).map(mapConversionSummary)
}

export async function getPolicyConversionDetail(id: string): Promise<PolicyConversionDetail> {
  const [conversionResult, amlResult, bookingResult] = await Promise.all([
    Aur_policy_conversionsService.get(id),
    Aur_aml_screeningsService.getAll(),
    Aur_policy_bookingsService.getAll(),
  ])

  const conversion = conversionResult.data
  if (!conversion) throw new Error('Policy conversion not found.')

  const aml = (amlResult.data ?? []).find(
    (record) => normalizeDataverseId(record._aur_policy_conversion_value) === normalizeDataverseId(id),
  )
  const booking = (bookingResult.data ?? []).find(
    (record) => normalizeDataverseId(record._aur_policy_conversion_value) === normalizeDataverseId(id),
  )
  const emails = await listPolicyConversionEmails(id)

  return {
    ...mapConversionSummary(conversion),
    quoteId: conversion._aur_quote_id_value,
    quoteName: conversion.aur_quote_idname,
    paymentLink: conversion.aur_payment_link ?? '',
    paymentReference: conversion.aur_payment_reference ?? '',
    paymentStatus: resolvePaymentStatus(conversion.aur_payment_statusname, conversion.aur_payment_link),
    customerId: readLookupId(conversion, '_aur_customer_id_value') || conversion.aur_customer_id,
    customerType: resolveCustomerType(
      readRawString(conversion, '_aur_customer_id_value@Microsoft.Dynamics.CRM.lookuplogicalname') ||
        conversion.aur_customer_ididtype,
    ),
    notes: conversion.aur_notes ?? '',
    aml: mapAmlForm(aml),
    booking: mapBookingForm(booking),
    emails,
  }
}

export async function getPolicyConversionOptions(): Promise<PolicyConversionOptions> {
  const [accountsResult, contactsResult, productsResult, businessUnitsResult, currenciesResult, usersResult] = await Promise.all([
    AccountsService.getAll({ orderBy: ['name asc'] }),
    ContactsService.getAll({ orderBy: ['fullname asc'] }),
    Aur_productsesService.getAll({ orderBy: ['aur_name asc'] }),
    BusinessunitsService.getAll({ orderBy: ['name asc'] }),
    TransactioncurrenciesService.getAll({ orderBy: ['currencyname asc'] }),
    SystemusersService.getAll({ orderBy: ['fullname asc'] }),
  ])

  return {
    accounts: (accountsResult.data ?? []).map((account) => ({
      id: account.accountid,
      name: account.name,
      email: account.emailaddress1,
    })),
    contacts: (contactsResult.data ?? []).map((contact) => ({
      id: contact.contactid,
      name: contact.fullname || [contact.firstname, contact.lastname].filter(Boolean).join(' ') || 'Unnamed contact',
      email: contact.emailaddress1,
    })),
    products: (productsResult.data ?? []).map((product) => ({
      id: product.aur_productsid,
      name: product.aur_name,
    })),
    businessUnits: (businessUnitsResult.data ?? []).map((businessUnit) => ({
      id: businessUnit.businessunitid,
      name: businessUnit.name,
      type: businessUnit.aur_businessunittype,
    })),
    currencies: (currenciesResult.data ?? []).map((currency) => ({
      id: currency.transactioncurrencyid,
      name: `${currency.currencyname} (${currency.isocurrencycode})`,
    })),
    users: (usersResult.data ?? []).map((user) => ({
      id: user.systemuserid,
      name: user.fullname || user.internalemailaddress || 'Unnamed user',
      email: user.internalemailaddress,
    })),
  }
}

async function listPolicyConversionEmails(policyConversionId: string): Promise<InquiryEmailSummary[]> {
  const normalizedId = normalizeDataverseId(policyConversionId)
  const result = await EmailsService.getAll({
    filter: `_regardingobjectid_value eq ${normalizedId}`,
    select: ['activityid', 'description', 'sender', '_regardingobjectid_value', 'subject', 'torecipients', 'statuscode', 'directioncode', 'createdon', 'senton'],
    orderBy: ['createdon desc'],
  })

  return (result.data ?? [])
    .filter((email) => normalizeDataverseId(email._regardingobjectid_value) === normalizedId)
    .map((email) => {
      const parsed = extractEmailMetadata(email.description ?? '')
      return {
        id: email.activityid,
        subject: email.subject ?? parsed.subject ?? 'Untitled email',
        body: email.description ?? 'No email body captured.',
        sender: firstNonEmpty(email.sender, email.from, parsed.sender, email.owneridname, 'Unknown sender'),
        toRecipients: firstNonEmpty(email.torecipients, email.to, parsed.toRecipients, 'No recipients'),
        regardingId: email._regardingobjectid_value,
        status: getEmailStatusLabel(email.statuscodename, email.statuscode, email.directioncode),
        direction: (email.directioncode ? 'sent' : 'received') as 'sent' | 'received',
        createdOn: email.senton ?? email.createdon ?? email.actualend,
        attachments: [],
      }
    })
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
  if (typeof statusName === 'string' && statusName.trim()) return statusName.trim()
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
  return directionCode ? 'Sent' : 'Received'
}

export async function ensurePolicyConversionForWonQuote(quoteId: string, fallback?: { name?: string; totalPremium?: number }) {
  const normalizedQuoteId = normalizeDataverseId(quoteId)
  if (!normalizedQuoteId) return

  const conversions = await Aur_policy_conversionsService.getAll()
  const existing = (conversions.data ?? []).find(
    (conversion) => normalizeDataverseId(conversion._aur_quote_id_value) === normalizedQuoteId,
  )
  if (existing) return existing

  const quote = fallback?.name && fallback.totalPremium !== undefined ? null : (await Aur_quotesService.get(quoteId)).data
  const name = fallback?.name || quote?.aur_name || 'Won quote conversion'
  const totalPremium = fallback?.totalPremium ?? quote?.aur_total_premium ?? 0

  const created = await Aur_policy_conversionsService.create({
    aur_name: name,
    aur_payment_amount: totalPremium,
    aur_conversion_stage: 1,
    aur_conversion_stage_status: 2,
    aur_payment_stage_status: 2,
    aur_payment_status: 1,
    aur_customer_stage_status: 1,
    aur_aml_stage_status: 1,
    aur_policy_processing_stage_status: 1,
    aur_overall_status: 2,
    'aur_quote_id@odata.bind': `/aur_quotes(${normalizedQuoteId})`,
  } as never)

  return created.data
}

export async function markPaymentLinkGenerated(
  id: string,
  amount: number,
  customer: { email: string; firstName: string; lastName: string },
) {
  const reference = `PAY-${Date.now()}`
  const flowResult = await GeneratePaymentLinkService.Run({
    text: id,
    number: amount,
    text_1: customer.email,
    text_2: customer.firstName,
    text_3: customer.lastName,
  })
  const flowResponse = flowResult.data?.response?.trim()
  const flowPaymentLink = resolvePaymentLink(flowResponse)

  await Aur_policy_conversionsService.update(id, {
    ...(flowPaymentLink ? { aur_payment_link: flowPaymentLink } : {}),
    aur_payment_reference: reference,
    aur_payment_amount: amount,
    aur_payment_status: 2,
    aur_payment_stage_status: 3,
    aur_conversion_stage: 3,
    aur_conversion_stage_status: 2,
    aur_overall_status: 2,
    aur_payment_requested_on: new Date().toISOString(),
  } as never)

  const refreshed = (await Aur_policy_conversionsService.get(id)).data
  const paymentLink = refreshed?.aur_payment_link || flowPaymentLink || ''

  return {
    paymentLink,
    paymentReference: refreshed?.aur_payment_reference || reference,
    paymentStatus: resolvePaymentStatus(refreshed?.aur_payment_statusname, paymentLink),
  }
}

export async function bindPolicyConversionCustomer(
  id: string,
  input: { type: 'account' | 'contact'; existingId?: string; name?: string; email?: string; firstName?: string; lastName?: string },
) {
  let customerId = input.existingId
  if (!customerId && input.type === 'account') {
    const created = await AccountsService.create({
      name: input.name || 'New account',
      emailaddress1: input.email || undefined,
    } as never)
    customerId = created.data?.accountid
  }
  if (!customerId && input.type === 'contact') {
    const created = await ContactsService.create({
      firstname: input.firstName || undefined,
      lastname: input.lastName || input.name || 'New contact',
      emailaddress1: input.email || undefined,
    } as never)
    customerId = created.data?.contactid
  }
  if (!customerId) throw new Error('Unable to resolve customer record.')

  await updatePolicyConversionCustomerLookup(id, input.type, customerId, {
    aur_customer_stage_status: 3,
    aur_conversion_stage: 2,
    aur_conversion_stage_status: 2,
    aur_customer_completed_on: new Date().toISOString(),
    aur_overall_status: 2,
  })

  return {
    customerId,
    customerType: input.type,
  }
}

export async function saveAmlScreening(conversionId: string, form: AmlScreeningFormState) {
  const payload = {
    aur_name: form.clientName || 'AML Screening',
    aur_client_name: form.clientName || undefined,
    aur_client_email: form.clientEmail || undefined,
    aur_client_type: Number(form.clientType || 1),
    aur_email_date: form.emailDate ? new Date(form.emailDate).toISOString() : undefined,
    aur_email_subject: form.emailSubject || undefined,
    aur_premium: Number(form.premium) || 0,
    aur_remarks: form.remarks || '',
    aur_screening_status: 2,
    aur_trade_license: form.tradeLicense || undefined,
    aur_type_of_policy: form.typeOfPolicy || 'Policy',
    ...(form.assignedToId ? { 'aur_assigned_to@odata.bind': `/systemusers(${normalizeDataverseId(form.assignedToId)})` } : {}),
    'aur_policy_conversion@odata.bind': `/aur_policy_conversions(${normalizeDataverseId(conversionId)})`,
  }

  if (form.id) {
    await Aur_aml_screeningsService.update(form.id, payload as never)
  } else {
    const created = await Aur_aml_screeningsService.create(payload as never)
    form.id = created.data?.aur_aml_screeningid
  }

  await Aur_policy_conversionsService.update(conversionId, {
    aur_aml_stage_status: 3,
    aur_conversion_stage: 4,
    aur_conversion_stage_status: 2,
    aur_aml_completed_on: new Date().toISOString(),
    aur_overall_status: 2,
  } as never)

  return {
    id: form.id,
  }
}

export async function savePolicyBooking(conversionId: string, form: PolicyBookingFormState) {
  if (!form.branchId) throw new Error('Select a branch before saving policy processing.')
  const payload = {
    aur_name: form.newPolicyNo || form.requestNo || 'Policy Booking',
    ...(form.productId ? { 'aur_product@odata.bind': `/aur_productses(${normalizeDataverseId(form.productId)})` } : {}),
    ...(form.customerContactId ? { 'aur_customer_name@odata.bind': `/contacts(${normalizeDataverseId(form.customerContactId)})` } : {}),
    aur_hundred_percent_premium: Number(form.hundredPercentPremium) || undefined,
    aur_hundred_percent_si: Number(form.hundredPercentSi) || undefined,
    aur_adntc_share_premium: Number(form.adntcSharePremium) || undefined,
    'aur_branch@odata.bind': `/businessunits(${normalizeDataverseId(form.branchId)})`,
    aur_broker_commission_percent: Number(form.brokerCommissionPercent) || 0,
    aur_ceding_commission_percent: Number(form.cedingCommissionPercent) || 0,
    aur_current_old_policy_no: form.currentOldPolicyNo || undefined,
    ...(form.departmentId ? { 'aur_department@odata.bind': `/businessunits(${normalizeDataverseId(form.departmentId)})` } : {}),
    aur_installments: Number(form.installments) || undefined,
    aur_insured_address: form.insuredAddress || undefined,
    aur_insured_country: form.insuredCountry ? Number(form.insuredCountry) : undefined,
    aur_insured_emirates: form.insuredEmirates ? Number(form.insuredEmirates) : undefined,
    aur_insured_name: form.insuredName || 'Insured',
    aur_insured_nationality: form.insuredNationality ? Number(form.insuredNationality) : undefined,
    aur_inward_policy_no: form.inwardPolicyNo || undefined,
    aur_inward_ref_no: form.inwardRefNo || undefined,
    aur_new_policy_no: form.newPolicyNo || undefined,
    aur_our_share_percent: Number(form.ourSharePercent) || 0,
    aur_period_from: form.periodFrom ? new Date(form.periodFrom).toISOString() : undefined,
    aur_period_to: form.periodTo ? new Date(form.periodTo).toISOString() : undefined,
    'aur_policy_conversion@odata.bind': `/aur_policy_conversions(${normalizeDataverseId(conversionId)})`,
    aur_remarks: form.remarks || '',
    aur_request_no: form.requestNo || undefined,
    aur_tax_percent: Number(form.taxPercent) || 0,
    aur_transaction_type: Number(form.transactionType || 1),
    ...(form.transactionCurrencyId
      ? { 'aur_transaction_currency_id@odata.bind': `/transactioncurrencies(${normalizeDataverseId(form.transactionCurrencyId)})` }
      : {}),
  }

  if (form.id) {
    await Aur_policy_bookingsService.update(form.id, payload as never)
  } else {
    const created = await Aur_policy_bookingsService.create(payload as never)
    form.id = created.data?.aur_policy_bookingid
  }

  await Aur_policy_conversionsService.update(conversionId, {
    aur_policy_processing_stage_status: 3,
    aur_conversion_stage: 6,
    aur_conversion_stage_status: 3,
    aur_overall_status: 4,
    aur_policy_processing_completed_on: new Date().toISOString(),
    aur_converted_on: new Date().toISOString(),
  } as never)

  return {
    id: form.id,
  }
}

export async function getPolicyConversionEmailTemplate(): Promise<ConversionTemplatePreview> {
  const result = await TemplatesService.getAll()
  const template = (result.data ?? []).find(
    (record) =>
      record.title.trim().toLowerCase() === 'policy conversion template' ||
      record.subject?.trim().toLowerCase() === 'policy conversion template',
  )
  if (!template) throw new Error('Policy Conversion email template was not found.')
  return {
    id: template.templateid,
    title: template.title || template.subject || 'Policy Conversion Template',
    subject: template.subject ?? '',
    content: template.body || '',
  }
}

export async function getPolicyConversionDocumentTemplate(): Promise<ConversionTemplatePreview> {
  const result = await Aur_custom_document_templatesesService.getAll()
  const template = (result.data ?? []).find(
    (record) => record.aur_name?.trim().toLowerCase() === 'policy conversion template',
  )
  if (!template) throw new Error('Policy Conversion document template was not found.')
  return {
    id: template.aur_custom_document_templatesid,
    title: template.aur_name || 'Policy Conversion Template',
    content: template.aur_template_content || '',
  }
}

function mapConversionSummary(record: Awaited<ReturnType<typeof Aur_policy_conversionsService.getAll>>['data'][number]): PolicyConversionSummary {
  return {
    id: record.aur_policy_conversionid,
    name: record.aur_name || record.aur_conversion_number || 'Untitled conversion',
    paymentAmount: record.aur_payment_amount ?? 0,
    customerName:
      readRawString(record, '_aur_customer_id_value@OData.Community.Display.V1.FormattedValue') ||
      record.aur_customer_idname ||
      'No customer linked',
    stage: readableLabel(record.aur_conversion_stagename || 'Payment Link'),
    stageStatus: readableLabel(record.aur_conversion_stage_statusname || record.aur_overall_statusname || 'In Progress'),
    createdOn: record.createdon ?? '',
  }
}

function mapAmlForm(record?: Awaited<ReturnType<typeof Aur_aml_screeningsService.getAll>>['data'][number]): AmlScreeningFormState {
  return {
    id: record?.aur_aml_screeningid,
    assignedToId: record?._aur_assigned_to_value ?? '',
    clientName: record?.aur_client_name ?? '',
    clientEmail: record?.aur_client_email ?? '',
    clientType: record?.aur_client_type ? String(record.aur_client_type) : '1',
    emailDate: toInputDateTime(record?.aur_email_date),
    emailSubject: record?.aur_email_subject ?? '',
    premium: record?.aur_premium != null ? String(record.aur_premium) : '',
    remarks: record?.aur_remarks ?? '',
    screeningStatus: record?.aur_screening_status ? String(record.aur_screening_status) : '1',
    tradeLicense: record?.aur_trade_license ?? '',
    typeOfPolicy: record?.aur_type_of_policy ?? '',
  }
}

function mapBookingForm(record?: Awaited<ReturnType<typeof Aur_policy_bookingsService.getAll>>['data'][number]): PolicyBookingFormState {
  return {
    id: record?.aur_policy_bookingid,
    productId: readLookupId(record, '_aur_product_value'),
    customerContactId: readLookupId(record, '_aur_customer_name_value'),
    hundredPercentPremium: stringify(record?.aur_hundred_percent_premium),
    hundredPercentSi: stringify(record?.aur_hundred_percent_si),
    adntcSharePremium: stringify(record?.aur_adntc_share_premium),
    branchId: record?._aur_branch_value ?? '',
    brokerCommissionPercent: stringify(record?.aur_broker_commission_percent),
    cedingCommissionPercent: stringify(record?.aur_ceding_commission_percent),
    currentOldPolicyNo: record?.aur_current_old_policy_no ?? '',
    departmentId: record?._aur_department_value ?? '',
    installments: stringify(record?.aur_installments),
    insuredAddress: record?.aur_insured_address ?? '',
    insuredCountry: record?.aur_insured_country ? String(record.aur_insured_country) : '',
    insuredEmirates: record?.aur_insured_emirates ? String(record.aur_insured_emirates) : '',
    insuredName: record?.aur_insured_name ?? '',
    insuredNationality: record?.aur_insured_nationality ? String(record.aur_insured_nationality) : '',
    inwardPolicyNo: record?.aur_inward_policy_no ?? '',
    inwardRefNo: record?.aur_inward_ref_no ?? '',
    newPolicyNo: record?.aur_new_policy_no ?? '',
    ourSharePercent: stringify(record?.aur_our_share_percent),
    periodFrom: toInputDate(record?.aur_period_from),
    periodTo: toInputDate(record?.aur_period_to),
    remarks: record?.aur_remarks ?? '',
    requestNo: record?.aur_request_no ?? '',
    transactionCurrencyId: record?._aur_transaction_currency_id_value ?? '',
    taxPercent: stringify(record?.aur_tax_percent),
    transactionType: record?.aur_transaction_type ? String(record.aur_transaction_type) : '1',
  }
}

function readLookupId(record: unknown, key: string) {
  if (!record || typeof record !== 'object') return ''
  const value = (record as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : ''
}

function readRawString(record: unknown, key: string) {
  if (!record || typeof record !== 'object') return ''
  const value = (record as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : ''
}

function stringify(value?: number | null) {
  return value == null ? '' : String(value)
}

function readableLabel(value: string) {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2')
}

function resolvePaymentStatus(statusName?: string | null, paymentLink?: string | null) {
  if (paymentLink && (!statusName || statusName.trim().toLowerCase() === 'not requested')) {
    return 'Link Generated'
  }
  return statusName ?? 'Not Requested'
}

async function updatePolicyConversionCustomerLookup(
  conversionId: string,
  customerType: 'account' | 'contact',
  customerId: string,
  stageFields: Record<string, unknown>,
) {
  const normalizedCustomerId = normalizeDataverseId(customerId)
  await Aur_policy_conversionsService.update(conversionId, {
    ...(customerType === 'account'
      ? { 'aur_customer_id_account@odata.bind': `/accounts(${normalizedCustomerId})` }
      : { 'aur_customer_id_contact@odata.bind': `/contacts(${normalizedCustomerId})` }),
    ...stageFields,
  } as never)
}

function resolveCustomerType(value?: string | null) {
  const normalized = value?.toLowerCase() ?? ''
  if (normalized.includes('contact')) return 'contact'
  if (normalized.includes('account')) return 'account'
  return undefined
}

function resolvePaymentLink(response?: string) {
  if (!response) return ''
  if (isUrlLike(response)) return response
  try {
    const parsed = JSON.parse(response) as Record<string, unknown>
    const candidate =
      parsed.paymentLink ||
      parsed.PaymentLink ||
      parsed.url ||
      parsed.Url ||
      parsed.link ||
      parsed.Link
    return typeof candidate === 'string' && isUrlLike(candidate) ? candidate : ''
  } catch {
    return ''
  }
}

function isUrlLike(value: string) {
  return /^https?:\/\//i.test(value.trim()) || /^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(value.trim())
}

function toInputDate(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function toInputDateTime(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 16)
}

function normalizeDataverseId(value?: string | null) {
  return value?.replace(/[{}]/g, '').toLowerCase() ?? ''
}
