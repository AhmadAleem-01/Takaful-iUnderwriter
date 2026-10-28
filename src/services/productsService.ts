import { Aur_productsesService } from '../generated/services/Aur_productsesService'
import { Aur_inquiriesService } from '../generated/services/Aur_inquiriesService'
import { mapProductSummary } from './dataMappers'
import type { ProductSummary } from '../domain/app'

export async function getProductsSummary(): Promise<ProductSummary[]> {
  const [productsResult, inquiriesResult] = await Promise.all([
    Aur_productsesService.getAll(),
    Aur_inquiriesService.getAll(),
  ])

  const products = productsResult.data ?? []
  const inquiries = inquiriesResult.data ?? []

  return products.map((product) => {
    const related = inquiries.filter((inquiry) => inquiry._aur_product_value === product.aur_productsid)
    return mapProductSummary(product, {
      inquiryVolume: related.length,
      premiumTotal: related.reduce((sum, item) => sum + (item.aur_total_premium_to_be_charged ?? 0), 0),
      insuredTotal: related.reduce((sum, item) => sum + (item.aur_total_sum_insured ?? 0), 0),
    })
  })
}
