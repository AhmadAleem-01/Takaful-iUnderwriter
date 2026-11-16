export interface TemplateField {
  name: string
  label: string
  type: string
  token: string
}

export interface TemplateFieldTable {
  name: string
  label: string
  entitySet?: string
  fields: TemplateField[]
}

interface FieldSchema {
  type?: string
  title?: string
  'x-ms-dataverse-attribute'?: string
  'x-ms-dataverse-type'?: string
  'x-ms-read-only'?: boolean
}

export interface TemplateTableSchema {
  name?: string
  title?: string
  schema?: { items?: {
    'x-ms-dataverse-entity'?: boolean
    'x-ms-dataverse-entityset'?: string
    properties?: Record<string, FieldSchema>
  } }
}

const FIELD_TYPES: Record<string, string> = {
  StringType: 'Text', MemoType: 'Text', EntityNameType: 'Text',
  PicklistType: 'Choice', MultiSelectPicklistType: 'Choices', StateType: 'Choice', StatusType: 'Choice',
  BooleanType: 'Yes / no', LookupType: 'Lookup', OwnerType: 'Lookup', CustomerType: 'Lookup',
  DateTimeType: 'Date', MoneyType: 'Currency', DecimalType: 'Number', DoubleType: 'Number',
  IntegerType: 'Number', BigIntType: 'Number', UniqueidentifierType: 'ID',
}

export function templateFieldToken(table: string, field: string, type: string): string {
  const displayNameTypes = ['PicklistType', 'MultiSelectPicklistType', 'StateType', 'StatusType', 'BooleanType', 'LookupType', 'OwnerType', 'CustomerType']
  const format = displayNameTypes.includes(type) ? '/@name' : type === 'DateTimeType' ? '/@date' : ''
  return `{!${table}:${field}${format};}`
}

export function parseTemplateFieldTable(source: TemplateTableSchema): TemplateFieldTable | null {
  const item = source.schema?.items
  if (!source.name || !item?.['x-ms-dataverse-entity']) return null
  const fields = Object.entries(item.properties ?? {}).flatMap(([key, field]) => {
    const name = field['x-ms-dataverse-attribute']
    const type = field['x-ms-dataverse-type'] ?? ''
    // Exclude binary data, navigation properties, and generated formatted-value
    // companions; lookup and choice fields insert their display names directly.
    if (!name || !FIELD_TYPES[type] || field.type === 'object' || field.type === 'array') return []
    if (field['x-ms-read-only'] && field.title === key && /(?:name|yominame)$/.test(key)) return []
    return [{ name, label: field.title || name, type: FIELD_TYPES[type], token: templateFieldToken(source.name!, name, type) }]
  }).sort((a, b) => a.label.localeCompare(b.label))
  return fields.length ? { name: source.name, label: source.title || source.name, entitySet: item['x-ms-dataverse-entityset'], fields } : null
}

export function insertTemplateToken(value: string, token: string, start = value.length, end = start) {
  const from = Math.max(0, Math.min(start, value.length))
  const to = Math.max(from, Math.min(end, value.length))
  return { value: value.slice(0, from) + token + value.slice(to), caret: from + token.length }
}
