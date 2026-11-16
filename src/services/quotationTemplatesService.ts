import { Aur_quotesService } from '../generated/services/Aur_quotesService'
import { Aur_inquiriesService } from '../generated/services/Aur_inquiriesService'
import { Aur_productsesService } from '../generated/services/Aur_productsesService'
import { Aur_plansService } from '../generated/services/Aur_plansService'
import type { QuotationTemplateContext } from '../lib/quotationTemplate'
import type { QuotePlanLinkedSection } from './quotesService'

export interface QuotationValues {
  name: string
  totalPremium: string
  grossPremium: string
  loadingPremium: string
  vat: string
  reason: string
  aiSummary: string
  productId: string
  planId: string
}

export async function getQuotationTemplateContext(quoteId: string, values: QuotationValues, sections: QuotePlanLinkedSection[], templateContent = ''): Promise<QuotationTemplateContext> {
  const quoteResult = await Aur_quotesService.get(quoteId)
  if (!quoteResult.success || !quoteResult.data) throw new Error('Unable to load the quotation data.')
  const quote = quoteResult.data
  const [inquiryResult, productResult, planResult] = await Promise.all([
    quote._aur_inquiry_value ? Aur_inquiriesService.get(quote._aur_inquiry_value) : null,
    values.productId ? Aur_productsesService.get(values.productId) : null,
    values.planId ? Aur_plansService.get(values.planId) : null,
  ])
  for (const [label, result] of [['inquiry', inquiryResult], ['product', productResult], ['plan', planResult]] as const) {
    if (result && (!result.success || !result.data)) throw new Error(`Unable to load the linked ${label}. Please retry.`)
  }
  const inquiry = inquiryResult?.data
  const product = productResult?.data
  const plan = planResult?.data
  const plainText = (html: string) => {
    const root = new DOMParser().parseFromString(html, 'text/html')
    return root.body.textContent?.trim() ?? ''
  }
  const planSections = Object.fromEntries(sections.map((section) => [
    section.key.charAt(0).toUpperCase() + section.key.slice(1),
    section.records.length ? section.records.map((record) => [record.name, plainText(record.description)].filter(Boolean).join(': ')).join('\n') : 'None listed',
  ]))
  const context: QuotationTemplateContext = {
    Quote: {
      ...quote,
      aur_name: values.name,
      aur_total_premium: numericValue(values.totalPremium),
      aur_gross_premium: numericValue(values.grossPremium),
      aur_loading_premium: numericValue(values.loadingPremium),
      aur_vat: numericValue(values.vat),
      aur_reason: values.reason,
      aur_ai_generated_summary: values.aiSummary,
      aur_productname: product?.aur_name,
      aur_planname: plan?.aur_name,
      _aur_product_value: values.productId,
      _aur_plan_value: values.planId,
      Name: values.name,
      Number: values.name,
    },
    Inquiry: {
      ...inquiry,
      Number: inquiry?.aur_inquiry_number,
      Client: inquiry?.aur_insured_companyname,
      Contact: inquiry?.aur_broker_contactname,
      Broker: inquiry?.aur_broker_companyname,
    },
    Product: {
      ...product,
      Name: product?.aur_name,
      aur_details: product?.aur_details ? plainText(product.aur_details) : undefined,
      aur_short_details: product?.aur_short_details ? plainText(product.aur_short_details) : undefined,
      aur_terms_conditions: product?.aur_terms_conditions ? plainText(product.aur_terms_conditions) : undefined,
    },
    Plan: { ...plan, Name: plan?.aur_name, ...planSections },
  }
  if (/\{!\w+:\w+\[/.test(templateContent)) {
    const { resolveRelatedTemplateContext } = await import('./templateRelatedFieldsService')
    return resolveRelatedTemplateContext(context, 'aur_quote', templateContent)
  }
  return context
}

function numericValue(value: string) {
  const number = Number(value.replace(/,/g, ''))
  if (!value.trim() || !Number.isFinite(number)) throw new Error('Enter valid premium and VAT values before generating the quotation.')
  return number
}
