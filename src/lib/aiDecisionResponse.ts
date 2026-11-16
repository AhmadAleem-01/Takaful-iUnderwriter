import { Aur_ai_decision_responsesaur_decision_category } from '../generated/models/Aur_ai_decision_responsesModel'
import type { Aur_ai_decision_responses } from '../generated/models/Aur_ai_decision_responsesModel'

export type AiDecisionCategory = number
export interface AiDecisionSelection { product: string; confidenceScore?: number; selectionReason: string }

export interface AiDecisionSuggestion {
  id: string
  category: AiDecisionCategory
  fieldName?: string
  selection: AiDecisionSelection | null
  alternatives?: AiDecisionSelection[]
}

export function aiDecisionFieldKey(name: string) {
  return name.replace(/^aur_/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase()
}

export function aiDecisionForField(suggestions: AiDecisionSuggestion[], fieldName: string) {
  return suggestions.find((item) => aiDecisionFieldKey(item.fieldName
    ?? (Aur_ai_decision_responsesaur_decision_category as Record<number, string>)[item.category] ?? '') === aiDecisionFieldKey(fieldName))
}

function property(record: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    const key = Object.keys(record).find((key) => aiDecisionFieldKey(key) === aiDecisionFieldKey(name))
    if (key !== undefined && record[key] != null) return record[key]
  }
}

function decisionSelection(value: unknown, fieldName: string): AiDecisionSelection | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const product = property(record, [fieldName, 'value', 'name', 'label', 'product'])
  const { confidenceScore, selectionReason } = record
  if (typeof product !== 'string' || !product.trim()) return null
  return {
    product: product.trim(),
    confidenceScore: typeof confidenceScore === 'number' && Number.isFinite(confidenceScore) && confidenceScore >= 0 && confidenceScore <= 100
      ? confidenceScore : undefined,
    selectionReason: typeof selectionReason === 'string' ? selectionReason.trim() : '',
  }
}

export function parseAiDecisionSelection(json?: string, fieldName = 'Product'): AiDecisionSuggestion['selection'] {
  try {
    const value: unknown = JSON.parse(json ?? '')
    if (!value || typeof value !== 'object') return null
    const selection = property(value as Record<string, unknown>, [`bestSuitable${aiDecisionFieldKey(fieldName)}`, 'bestSuitableOption', 'bestSuitableValue', 'bestSuitableProduct'])
    return decisionSelection(selection, fieldName)
  } catch {
    return null
  }
}

export function parseAiDecisionAlternatives(json?: string, fieldName = 'Product'): AiDecisionSelection[] {
  try {
    const value: unknown = JSON.parse(json ?? '')
    if (!value || typeof value !== 'object') return []
    const fieldKey = aiDecisionFieldKey(fieldName)
    const items = property(value as Record<string, unknown>, [`all${fieldKey}s`, `all${fieldKey}`, 'allOptions', 'allProducts'])
    if (!Array.isArray(items)) return []
    const selected = parseAiDecisionSelection(json, fieldName)?.product.toLowerCase()
    const seen = new Set<string>()
    return items.flatMap((item: unknown) => {
      const selection = decisionSelection(item, fieldName)
      const name = selection?.product.toLowerCase()
      if (!selection || !name || name === selected || seen.has(name)) return []
      seen.add(name)
      return [selection]
    })
  } catch {
    return []
  }
}

export function aiDecisionMatchingOption(product: string, options: Array<{ value: string; label: string }>) {
  const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase()
  const matches = options.filter((option) => normalize(option.label) === normalize(product))
  return matches.length === 1 ? matches[0] : undefined
}

// Input is ordered newest first. Do not revive an older decision when the latest JSON is invalid.
export function latestAiDecisionSuggestions(records: Aur_ai_decision_responses[]): AiDecisionSuggestion[] {
  const latest = new Map<string, AiDecisionSuggestion>()
  for (const record of records) {
    if (record.aur_decision_category == null) continue
    const category = Number(record.aur_decision_category)
    const formattedName = (record as unknown as Record<string, unknown>)['aur_decision_category@OData.Community.Display.V1.FormattedValue']
    const fieldName = (typeof formattedName === 'string' ? formattedName.trim() : '') || record.aur_decision_categoryname?.trim()
      || (Aur_ai_decision_responsesaur_decision_category as Record<number, string>)[category]
    if (!Number.isFinite(category) || !fieldName) continue
    const fieldKey = aiDecisionFieldKey(fieldName)
    if (!fieldKey || latest.has(fieldKey)) continue
    latest.set(fieldKey, { id: record.aur_ai_decision_responseid, category, fieldName, selection: parseAiDecisionSelection(record.aur_ai_decision_response_json, fieldName), alternatives: parseAiDecisionAlternatives(record.aur_ai_decision_response_json, fieldName) })
  }
  return [...latest.values()]
}
