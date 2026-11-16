import { Aur_coveragesesService } from '../generated/services/Aur_coveragesesService'
import { Aur_coveragesesaur_coverage_type } from '../generated/models/Aur_coveragesesModel'
import type { AdminCatalogItem } from '../domain/app'

const normalizeId = (id: string) => id.replace(/[{}]/g, '').trim().toLowerCase()

export interface ProductCoverage extends AdminCatalogItem {
  coverageType: string
}

export function coverageTypeLabel(coverage: object): string {
  const record = coverage as Record<string, unknown>
  for (const key of ['aur_coverage_typename', 'aur_coverage_type@OData.Community.Display.V1.FormattedValue']) {
    const label = record[key]
    if (typeof label === 'string' && label.trim()) return label.trim()
  }
  const value = record.aur_coverage_type
  const choice = Number(value)
  if (Object.hasOwn(Aur_coveragesesaur_coverage_type, choice)) {
    return Aur_coveragesesaur_coverage_type[choice as keyof typeof Aur_coveragesesaur_coverage_type].replace('RIConditions', 'RI Conditions')
  }
  if (typeof value === 'string' && value.trim() && !/^\d+$/.test(value.trim()) && !/^[{]?[0-9a-f-]{36}[}]?$/i.test(value.trim())) return value.trim()
  return 'Uncategorized'
}

export async function getProductCoverages(productId?: string): Promise<ProductCoverage[]> {
  if (!productId) return []
  const id = normalizeId(productId)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error('A valid product ID is required to load coverages.')
  }
  const coverages: ProductCoverage[] = []
  let skipToken: string | undefined
  do {
    const result = await Aur_coveragesesService.getAll({
      filter: `_aur_product_value eq ${id}`,
      orderBy: ['aur_name asc'],
      maxPageSize: 500,
      skipToken,
    })
    if (!result.success || result.error) throw new Error(result.error?.message || 'Unable to load product coverages.')
    coverages.push(...(result.data ?? [])
      .filter((coverage) => normalizeId(coverage._aur_product_value ?? '') === id)
      .map((coverage) => ({
        id: coverage.aur_coveragesid,
        name: coverage.aur_name,
        coverageType: coverageTypeLabel(coverage),
        description: coverage.aur_description ?? '',
        status: coverage.statuscodename ?? (coverage.statecode === 1 ? 'Inactive' : 'Active'),
        context: coverage.aur_typename ?? 'Not specified',
        detail: coverage.aur_applicablename ?? 'Not specified',
        productId: id,
      })))
    skipToken = result.skipToken
  } while (skipToken)
  return coverages
}
