export function aiConditionResult(value: unknown) {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (['true', 'yes', '1', 'met', 'condition met'].includes(normalized)) return { label: 'Condition met', tone: 'met' as const }
  if (['false', 'no', '0', 'not met', 'condition not met'].includes(normalized)) return { label: 'Condition not met', tone: 'unmet' as const }
  if (!normalized || ['pending', 'pending evaluation', 'not evaluated'].includes(normalized)) return { label: 'Not evaluated', tone: 'pending' as const }
  return { label: 'Needs review', tone: 'pending' as const }
}

export function isConditionalPropertyRule(value?: string) {
  const label = (value ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
  return ['conditional', 'conditional rule', 'conditional rules'].includes(label)
}

export function aiConfidence(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null
}

export function isNoEvidenceFound(evidence: unknown) {
  return typeof evidence === 'string' && ['no evidence found', 'evidence not found'].includes(evidence.trim().replace(/\s+/g, ' ').toLowerCase())
}

type AiResponseFilterRecord = { evidence?: unknown; businessRulePropertyName?: string }

function propertyFilter(value?: string) {
  const label = (value ?? '').trim().replace(/\s+/g, ' ')
  return { value: `property:${label.toLowerCase()}`, label }
}

export function getAiResponseFilters(records: AiResponseFilterRecord[]) {
  const properties = new Map<string, { value: string; label: string; count: number }>()
  for (const record of records) {
    const property = propertyFilter(record.businessRulePropertyName)
    if (!property.label) continue
    const existing = properties.get(property.value)
    if (existing) existing.count += 1
    else properties.set(property.value, { ...property, count: 1 })
  }
  return [
    { value: 'All', label: 'All', count: records.length },
    ...Array.from(properties.values()).sort((a, b) => a.label.localeCompare(b.label)),
    { value: 'No Evidence Found', label: 'No Evidence Found', count: records.filter((record) => isNoEvidenceFound(record.evidence)).length },
  ]
}

export function filterAiResponses<T extends AiResponseFilterRecord>(records: T[], responseFilter = 'All') {
  if (responseFilter === 'All') return records
  if (responseFilter === 'No Evidence Found') return records.filter((record) => isNoEvidenceFound(record.evidence))
  return records.filter((record) => propertyFilter(record.businessRulePropertyName).value === responseFilter)
}

export function searchAiResponses<T extends { id: string; name: string; businessRuleName: string; response: string }>(records: T[], search: string, drafts: Record<string, string> = {}) {
  const query = search.trim().toLowerCase()
  if (!query) return records
  return records.filter((item) => [item.name, item.businessRuleName, item.response, drafts[item.id] ?? '']
    .some((value) => value.toLowerCase().includes(query)))
}
