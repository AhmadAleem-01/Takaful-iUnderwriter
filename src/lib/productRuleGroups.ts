export const RULE_GROUPS = ['Mandatory Field', 'Required Document', 'Inclusion', 'Exclusion', 'Conditional', 'Uncategorized'] as const
export type RuleGroup = string

export function groupProductRules<T extends { propertyRuleName?: string }>(rules: T[]) {
  const grouped = new Map<RuleGroup, T[]>()
  for (const rule of rules) {
    const label = categorizeRule(rule.propertyRuleName ?? '')
    const bucket = grouped.get(label) ?? []
    bucket.push(rule)
    grouped.set(label, bucket)
  }
  const rank = (label: string) => label === 'Uncategorized' ? Number.MAX_SAFE_INTEGER
    : RULE_GROUPS.findIndex((group) => group === label) < 0 ? RULE_GROUPS.length
    : RULE_GROUPS.findIndex((group) => group === label)
  return [...grouped].sort(([left], [right]) => rank(left) - rank(right) || left.localeCompare(right))
    .map(([label, groupedRules]) => ({ label, rules: groupedRules }))
}

export function groupLinkedProductRules<T extends { id: string; propertyRuleName?: string }>(rules: T[], linkedIds: string[]) {
  const normalizeId = (id: string) => id.replace(/[{}]/g, '').trim().toLowerCase()
  const ids = new Set(linkedIds.map(normalizeId))
  const linked = rules.filter((rule) => ids.has(normalizeId(rule.id)))
  return groupProductRules(linked)
}

export function categorizeRule(propertyRuleName: string): RuleGroup {
  const groups: Record<string, RuleGroup> = {
    'mandatory field': 'Mandatory Field', 'mandatory fields': 'Mandatory Field',
    'required document': 'Required Document', 'required documents': 'Required Document',
    inclusion: 'Inclusion', 'inclusion rule': 'Inclusion', 'inclusion rules': 'Inclusion',
    exclusion: 'Exclusion', 'exclusion rule': 'Exclusion', 'exclusion rules': 'Exclusion',
    conditional: 'Conditional', 'conditional rule': 'Conditional', 'conditional rules': 'Conditional',
  }
  const normalized = propertyRuleName.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
  return groups[normalized] ?? (propertyRuleName.trim() || 'Uncategorized')
}
