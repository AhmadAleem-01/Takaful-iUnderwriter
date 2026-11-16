import type { TemplateField, TemplateFieldTable } from './emailTemplateFields'

export interface TemplateLookupStep { field: string; table: string }
export interface TemplateFieldPath {
  entity: string
  lookups: TemplateLookupStep[]
  field: string
  format?: string
}

export const MAX_TEMPLATE_LOOKUP_DEPTH = 5
export const TEMPLATE_FIELD_TOKEN_SOURCE = String.raw`\{![a-z0-9_]+:(?:[a-z0-9_]+\[[a-z0-9_]+\]\.)*[a-z0-9_]+(?:\/@(?:name|date|time))?;\}`

export function parseTemplateFieldPath(token: string): TemplateFieldPath | null {
  const match = new RegExp(`^${TEMPLATE_FIELD_TOKEN_SOURCE}$`, 'i').exec(token)
  if (!match) return null
  const [entity, raw] = token.slice(2, -2).toLowerCase().split(':')
  const [path, format] = raw.split('/@')
  const parts = path.split('.')
  let field = parts.pop()!
  let sourceTable = entity
  const lookups = parts.map((part) => {
    const step = /^(\w+)\[(\w+)\]$/.exec(part)!
    // Earlier local schemas called the Quote → Inquiry lookup aur_quotes.
    // Preserve saved templates while resolving against the current live column.
    const lookup = sourceTable === 'aur_quote' && step[1] === 'aur_quotes' && step[2] === 'aur_inquiry' ? 'aur_inquiry' : step[1]
    sourceTable = step[2]
    return { field: lookup, table: step[2] }
  })
  if (sourceTable === 'aur_quote' && field === 'aur_quotes') field = 'aur_inquiry'
  if (lookups.length > MAX_TEMPLATE_LOOKUP_DEPTH) return null
  return { entity, lookups, field, format }
}

export function relatedTemplateField(entity: string, lookups: TemplateLookupStep[], field: TemplateField, label: string): TemplateField {
  const parsed = parseTemplateFieldPath(field.token)
  if (!parsed) throw new Error('This field cannot be added to a document template.')
  const path = lookups.map((step) => `${step.field}[${step.table}]`).join('.')
  return { ...field, label, token: `{!${entity}:${path ? `${path}.` : ''}${parsed.field}${parsed.format ? `/@${parsed.format}` : ''};}` }
}

export function templateLookupContextKey(entity: string, lookups: TemplateLookupStep[]) {
  return `${entity}:${lookups.map((step) => `${step.field}[${step.table}]`).join('.')}`
}

export function templateFieldFromPath(token: string, tables: TemplateFieldTable[]): TemplateField | null {
  const parsed = parseTemplateFieldPath(token)
  if (!parsed) return null
  let table = tables.find((item) => item.name === parsed.entity)
  const labels: string[] = []
  for (const step of parsed.lookups) {
    const lookup = table?.fields.find((field) => field.name === step.field && field.type === 'Lookup')
    if (!lookup) return null
    labels.push(lookup.label)
    table = tables.find((item) => item.name === step.table)
  }
  const field = table?.fields.find((item) => item.name === parsed.field)
  if (!field) return null
  return { ...field, token, label: [...labels, field.label].join(' › ') }
}
