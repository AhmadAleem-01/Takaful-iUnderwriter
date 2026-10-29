import {
  Aur_business_rulesesService,
  Aur_plansService,
  Aur_productsesService,
} from '../generated'
import type { AdminCatalogItem, ProductWorkspace } from '../domain/app'
import { mapProductSummary } from './dataMappers'

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

function mapRuleRecord(rule: Awaited<ReturnType<typeof Aur_business_rulesesService.getAll>>['data'][number]): AdminCatalogItem {
  return {
    id: rule.aur_business_rulesid,
    name: rule.aur_name,
    description: rule.aur_propertiesname ?? 'No linked property rule yet.',
    status: rule.statuscodename ?? 'Active',
    context: rule.aur_categoriesname ?? 'Rule Library',
    detail: 'Underwriting rule',
  }
}

export async function getProductWorkspace(productId?: string): Promise<ProductWorkspace> {
  const [productsResult, plansResult, rulesResult] = await Promise.all([
    Aur_productsesService.getAll(),
    Aur_plansService.getAll(),
    Aur_business_rulesesService.getAll(),
  ])

  const products = productsResult.data ?? []
  const current = productId ? products.find((product) => product.aur_productsid === productId) : undefined

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
        status: current.aur_product_statusname?.toLowerCase().includes('publish') ? 'publish' : 'draft',
        applyActionAutomatically: Boolean((current as typeof current & { aur_apply_action_automatically?: boolean | null }).aur_apply_action_automatically),
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
        },
    availablePlans: (plansResult.data ?? [])
      .filter((plan) => !productId || plan._aur_product_value === productId)
      .map(mapPlanRecord),
    availableRules: (rulesResult.data ?? []).map(mapRuleRecord),
    associatedRuleIds: [],
    relationshipNotice: productId
      ? 'Product-to-business-rule associations will load through the custom Web API once it is configured.'
      : undefined,
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
}) {
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
    aur_apply_action_automatically: payload.applyActionAutomatically ?? false,
  }

  if (payload.id) {
    await Aur_productsesService.update(payload.id, record)
    return
  }

  await Aur_productsesService.create(record as never)
}

export async function updateProductAutoActionSetting(productId: string, applyAutomatically: boolean) {
  await Aur_productsesService.update(
    productId,
    {
      aur_apply_action_automatically: applyAutomatically,
    } as never,
  )
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
  void input
  throw new Error('The product-to-business-rule custom Web API has not been configured in this app yet.')
}

export async function removeProductRuleAssociation(input: {
  productId: string
  businessRuleId: string
}) {
  void input
  throw new Error('The product-to-business-rule custom Web API has not been configured in this app yet.')
}
