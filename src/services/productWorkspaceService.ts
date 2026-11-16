import {
  Aur_business_rulesesService,
  Aur_plansService,
  Aur_productsesService,
} from '../generated'
import type { AdminCatalogItem, ProductWorkspace } from '../domain/app'
import { mapProductSummary } from './dataMappers'
import { parseDuplicateCriteria } from '../lib/inquiryDuplicates'
import { associateProductRules, disassociateProductRule, getProductRuleIds } from './productRuleAssociations'

function assertProductOperation(result: { success: boolean; error?: unknown }, fallback: string) {
  if (result.success && !result.error) return
  const error = result.error
  if (error instanceof Error) throw error
  if (typeof error === 'string') throw new Error(error)
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    throw new Error(error.message)
  }
  throw new Error(fallback)
}

function parseOptionalNumber(value?: string) {
  if (!value?.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function mapPlanRecord(plan: Awaited<ReturnType<typeof Aur_plansService.getAll>>['data'][number]): AdminCatalogItem {
  const planRecord = plan as typeof plan & {
    aur_base_premium?: number | null
    aur_minimum_sum_insured?: number | null
    aur_maximum_sum_insured?: number | null
    aur_cealing?: number | null
    aur_floor?: number | null
  }
  return {
    id: plan.aur_planid,
    name: plan.aur_name ?? 'Unnamed plan',
    description: plan.aur_description ?? 'No plan description has been captured yet.',
    status: plan.statuscodename ?? 'Active',
    context: plan.aur_productname ?? 'Unassigned',
    detail: plan.createdon ? `Created ${new Date(plan.createdon).toLocaleDateString('en')}` : 'Product-linked plan',
    productId: plan._aur_product_value,
    basePremium: planRecord.aur_base_premium ?? undefined,
    minimumSumInsured: planRecord.aur_minimum_sum_insured ?? undefined,
    maximumSumInsured: planRecord.aur_maximum_sum_insured ?? undefined,
    cealing: planRecord.aur_cealing ?? undefined,
    floor: planRecord.aur_floor ?? undefined,
  }
}

function mapRuleRecord(rule: Awaited<ReturnType<typeof Aur_business_rulesesService.getAll>>['data'][number], ruleNames: Map<string, string>): AdminCatalogItem {
  const parentId = rule._aur_properties_value?.replace(/[{}]/g, '').trim().toLowerCase()
  const propertyName = (parentId ? ruleNames.get(parentId) : undefined)
    || rule.aur_propertiesname
    || (rule as unknown as Record<string, string>)['_aur_properties_value@OData.Community.Display.V1.FormattedValue']
  return {
    id: rule.aur_business_rulesid.replace(/[{}]/g, '').trim().toLowerCase(),
    name: rule.aur_name,
    description: propertyName || 'No linked property rule yet.',
    propertyRuleName: propertyName || '',
    status: rule.statuscodename ?? 'Active',
    context: rule.aur_categoriesname ?? 'Rule Library',
    detail: 'Underwriting rule',
  }
}

async function getAllProductBusinessRules() {
  const rules: Awaited<ReturnType<typeof Aur_business_rulesesService.getAll>>['data'] = []
  let skipToken: string | undefined
  do {
    const result = await Aur_business_rulesesService.getAll({ maxPageSize: 500, skipToken })
    assertProductOperation(result, 'Unable to load business rules.')
    rules.push(...(result.data ?? []))
    skipToken = result.skipToken
  } while (skipToken)
  return rules
}

export async function getProductWorkspace(productId?: string): Promise<ProductWorkspace> {
  const [productResult, plansResult, rulesResult, associatedRuleIds] = await Promise.all([
    productId ? Aur_productsesService.get(productId.replace(/[{}]/g, '').trim().toLowerCase()) : Promise.resolve(undefined),
    Aur_plansService.getAll(),
    getAllProductBusinessRules(),
    productId ? getProductRuleIds(productId) : Promise.resolve([]),
  ])

  if (productResult) assertProductOperation(productResult, 'Unable to load product.')
  const current = productResult?.data
  if (productId && !current) throw new Error('Product not found.')
  const ruleNames = new Map(rulesResult.map((rule) => [rule.aur_business_rulesid.replace(/[{}]/g, '').trim().toLowerCase(), rule.aur_name]))

  return {
    summary: current ? mapProductSummary(current) : undefined,
    metadata: current
      ? {
          arabicName: current.aur_product_name_ar ?? '',
          premiumPercentage: current.aur_premium ?? '',
          details: current.aur_details ?? '',
          shortDetails: current.aur_short_details ?? '',
          heading: current.aur_heading ?? '',
          buyHeading: current.aur_buy_heading ?? '',
        buyButton: current.aur_buy_button ?? '',
        slogan: current.aur_slogan ?? '',
        remarks: current.aur_remarks ?? '',
        terms: current.aur_terms_conditions ?? '',
        emailAddress: current.aur_incomingemailaddress ?? '',
        order: current.aur_order ?? '',
        status: current.aur_product_status === 751820001 ? 'publish' : 'draft',
        applyActionAutomatically: Boolean((current as typeof current & { aur_apply_action_automatically?: boolean | null }).aur_apply_action_automatically),
        duplicateCriteria: current.aur_duplicate_inquiry_criteria ?? '',
      }
      : {
          arabicName: '',
          premiumPercentage: '',
          details: '',
          shortDetails: '',
          heading: '',
          buyHeading: '',
          buyButton: '',
          slogan: '',
          remarks: '',
          terms: '',
          emailAddress: '',
          order: '',
          status: 'draft',
          applyActionAutomatically: false,
          duplicateCriteria: '',
        },
    availablePlans: (plansResult.data ?? [])
      .filter((plan) => !productId || plan._aur_product_value === productId)
      .map(mapPlanRecord),
    availableRules: rulesResult.map((rule) => mapRuleRecord(rule, ruleNames)),
    associatedRuleIds,
  }
}

export async function saveProductWorkspace(payload: {
  id?: string
  name: string
  shortDetails?: string
  details?: string
  heading?: string
  slogan?: string
  emailAddress?: string
  buyHeading?: string
  buyButton?: string
  terms?: string
  remarks?: string
  arabicName?: string
  order?: string
  premiumPercentage?: string
  status?: 'draft' | 'publish'
  applyActionAutomatically?: boolean
  duplicateCriteria?: string
}) {
  if (payload.duplicateCriteria !== undefined && parseDuplicateCriteria(payload.duplicateCriteria).state !== 'ready') {
    throw new Error('Complete the duplicate inquiry rule before saving it.')
  }
  const productStatus: 751820000 | 751820001 =
    payload.status === 'publish' ? 751820001 : 751820000
  const statusCode: 1 | 751820001 = payload.status === 'publish' ? 751820001 : 1
  const record = {
    aur_name: payload.name,
    aur_short_details: payload.shortDetails,
    aur_details: payload.details,
    aur_heading: payload.heading,
    aur_slogan: payload.slogan,
    aur_incomingemailaddress: payload.emailAddress,
    aur_buy_heading: payload.buyHeading,
    aur_buy_button: payload.buyButton,
    aur_terms_conditions: payload.terms,
    aur_remarks: payload.remarks,
    aur_product_name_ar: payload.arabicName,
    aur_order: payload.order,
    aur_premium: payload.premiumPercentage,
    aur_product_status: productStatus,
    statuscode: statusCode,
    ...(payload.duplicateCriteria !== undefined ? { aur_duplicate_inquiry_criteria: payload.duplicateCriteria } : {}),
  }

  if (payload.id) {
    const result = await Aur_productsesService.update(payload.id.replace(/[{}]/g, '').trim().toLowerCase(), record)
    assertProductOperation(result, 'Unable to save product.')
    return
  }

  const result = await Aur_productsesService.create(record as never)
  assertProductOperation(result, 'Unable to create product.')
}

export async function updateProductAutoActionSetting(productId: string, applyAutomatically: boolean) {
  const result = await Aur_productsesService.update(
    productId,
    {
      aur_apply_action_automatically: applyAutomatically,
    } as never,
  )
  assertProductOperation(result, 'Unable to update the auto-action setting.')
}

interface SaveProductPlanInput {
  name: string
  description: string
  basePremium?: string
  minimumSumInsured?: string
  maximumSumInsured?: string
  cealing?: string
  floor?: string
}

function buildPlanPayload(input: SaveProductPlanInput) {
  return {
    aur_name: input.name,
    aur_description: input.description,
    aur_base_premium: parseOptionalNumber(input.basePremium),
    aur_minimum_sum_insured: parseOptionalNumber(input.minimumSumInsured),
    aur_maximum_sum_insured: parseOptionalNumber(input.maximumSumInsured),
    aur_cealing: parseOptionalNumber(input.cealing),
    aur_floor: parseOptionalNumber(input.floor),
  }
}

export async function createProductPlan(productId: string, input: SaveProductPlanInput) {
  await Aur_plansService.create({
    ...buildPlanPayload(input),
    'aur_product@odata.bind': `/aur_productses(${productId})`,
  } as never)
}

export async function updateProductPlan(planId: string, input: SaveProductPlanInput) {
  await Aur_plansService.update(planId, buildPlanPayload(input) as never)
}

export async function deleteProductPlan(planId: string) {
  await Aur_plansService.delete(planId)
}

export async function saveProductRuleAssociations(input: {
  productId: string
  productName: string
  selectedRuleIds: string[]
}) {
  await associateProductRules(input.productId, input.selectedRuleIds)
}

export async function removeProductRuleAssociation(input: {
  productId: string
  businessRuleId: string
}) {
  await disassociateProductRule(input.productId, input.businessRuleId)
}
