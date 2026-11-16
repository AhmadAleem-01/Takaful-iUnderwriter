import {
  createTakafulM2MRequest,
  MAX_TAKAFUL_M2M_RELATED_IDS,
  runTakafulM2MOperation,
  type TakafulM2MContext,
} from './takafulM2MDebugger'

const normalizeId = (id: string) => id.replace(/[{}]/g, '').trim().toLowerCase()
const PRODUCT_RULE_RELATIONSHIP = 'aur_products_aur_business_rules_aur_business_rules'

function getContext(productId: string): TakafulM2MContext {
  if (!normalizeId(productId)) throw new Error('A product ID is required to manage business rules.')
  return {
    targetTable: 'aur_products',
    targetId: normalizeId(productId),
    relationshipName: PRODUCT_RULE_RELATIONSHIP,
    targetColumns: ['aur_productsid', 'aur_name'],
    relatedColumns: ['aur_business_rulesid'],
  }
}

async function retrieveRuleIds(context: TakafulM2MContext): Promise<string[]> {
  const ids = new Set<string>()
  let pageNumber = 1
  let pagingCookie = ''
  for (;;) {
    const { result } = await runTakafulM2MOperation('Retrieve', context, [], { pageSize: 500, pageNumber, pagingCookie })
    for (const record of result.records) {
      const id = record.id ?? record.attributes?.aur_business_rulesid ?? record.aur_business_rulesid
      if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalizeId(id))) {
        throw new Error('The product relationship API returned a business rule without a valid ID.')
      }
      ids.add(normalizeId(id))
    }
    if (!result.moreRecords) return [...ids]
    pageNumber += 1
    pagingCookie = result.pagingCookie ?? ''
  }
}

export async function getProductRuleIds(productId: string): Promise<string[]> {
  return retrieveRuleIds(getContext(productId))
}

export async function associateProductRules(productId: string, selectedRuleIds: string[]): Promise<void> {
  const context = getContext(productId)
  const selected = [...new Set(selectedRuleIds.map(normalizeId))]
  // Validate every ID before sending any mutation, including IDs in later batches.
  for (const id of selected) createTakafulM2MRequest('Associate', context, [id])
  const existing = new Set(await retrieveRuleIds(context))
  const added = selected.filter((id) => !existing.has(id))
  for (let offset = 0; offset < added.length; offset += MAX_TAKAFUL_M2M_RELATED_IDS) {
    await runTakafulM2MOperation('Associate', context, added.slice(offset, offset + MAX_TAKAFUL_M2M_RELATED_IDS))
  }
}

export async function disassociateProductRule(productId: string, businessRuleId: string): Promise<void> {
  await runTakafulM2MOperation('Disassociate', getContext(productId), [normalizeId(businessRuleId)])
}
