import type { ProductSummary } from '../domain/app'

export interface ProductHierarchyGroup {
  product: ProductSummary
  children: ProductSummary[]
}

function normalizeId(value: string) {
  return value.trim().replace(/[{}]/g, '').toLowerCase()
}

export function buildProductHierarchy(products: ProductSummary[], search = ''): ProductHierarchyGroup[] {
  const groups = products
    .filter((product) => !product.lineOfBusinessId?.trim())
    .map((product) => ({ product, children: [] as ProductSummary[] }))
  const parents = new Map(groups.map((group) => [normalizeId(group.product.id), group]))

  for (const product of products) {
    if (!product.lineOfBusinessId?.trim()) continue
    const parent = parents.get(normalizeId(product.lineOfBusinessId))
    if (parent) parent.children.push(product)
    // Keep products visible when their referenced line of business is unavailable.
    else groups.push({ product, children: [] })
  }

  const query = search.trim().toLowerCase()
  if (!query) return groups
  const matches = (product: ProductSummary) =>
    [product.name, product.shortDetails, product.status].join(' ').toLowerCase().includes(query)

  return groups.flatMap((group) => {
    if (matches(group.product)) return [group]
    const children = group.children.filter(matches)
    return children.length ? [{ ...group, children }] : []
  })
}
