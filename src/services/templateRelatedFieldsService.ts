import { getClient } from '@microsoft/power-apps/data'
import type { EntityMetadata } from '@microsoft/power-apps/data/metadata/dataverse'
import { dataSourcesInfo } from '../../.power/schemas/appschemas/dataSourcesInfo'
import type { TemplateFieldTable } from '../lib/emailTemplateFields'
import type { QuotationTemplateContext } from '../lib/quotationTemplate'
import { parseTemplateFieldPath, templateLookupContextKey, TEMPLATE_FIELD_TOKEN_SOURCE } from '../lib/templateFieldPaths'
import { getEmailTemplateFieldTables } from './emailTemplateFieldsService'

export interface TemplateLookupTarget { table: string; label: string; polymorphic: boolean }
type Relationship = { ReferencingAttribute: string; ReferencedEntity: string }
const metadataCache = new Map<string, Promise<Relationship[]>>()

async function relationships(table: TemplateFieldTable): Promise<Relationship[]> {
  if (!table.entitySet) throw new Error(`Related fields are unavailable for ${table.label}.`)
  const entitySet = table.entitySet
  let pending = metadataCache.get(entitySet)
  if (!pending) {
    pending = (async () => {
      const result = await getClient(dataSourcesInfo).executeAsync<unknown, Partial<EntityMetadata>>({
        dataverseRequest: { action: 'getEntityMetadata', parameters: { tableName: entitySet, options: { metadata: ['LogicalName'], schema: { manyToOne: true } } } },
      })
      if (!result.success || !result.data || !Array.isArray(result.data.ManyToOneRelationships)) throw new Error(`Related fields for ${table.label} could not be loaded. Please retry.`)
      return result.data.ManyToOneRelationships
    })().catch((error) => { metadataCache.delete(entitySet); throw error })
    metadataCache.set(entitySet, pending)
  }
  return pending
}

export async function getTemplateLookupTargets(table: TemplateFieldTable, lookup: string, tables: TemplateFieldTable[]): Promise<TemplateLookupTarget[]> {
  if (!table.fields.some((field) => field.name === lookup && field.type === 'Lookup')) return []
  const targets = [...new Set((await relationships(table)).filter((item) => item.ReferencingAttribute === lookup).map((item) => item.ReferencedEntity))]
  if (!targets.length) {
    const field = table.fields.find((item) => item.name === lookup)!
    throw new Error(`The ${field.label} lookup does not match the current ${table.label} metadata. The app's table schema needs refreshing.`)
  }
  return targets.flatMap((name) => {
    const target = tables.find((item) => item.name === name && item.entitySet)
    return target ? [{ table: target.name, label: target.label, polymorphic: targets.length > 1 }] : []
  })
}

export async function resolveRelatedTemplateContext(context: QuotationTemplateContext, entity: string, content: string): Promise<QuotationTemplateContext> {
  const paths = [...content.matchAll(new RegExp(TEMPLATE_FIELD_TOKEN_SOURCE, 'gi'))]
    .map((match) => parseTemplateFieldPath(match[0])).filter((path) => path && path.entity === entity && path.lookups.length > 0)
  if (!paths.length) return context
  const tables = await getEmailTemplateFieldTables()
  const result = { ...context }
  const rootGroups: Record<string, string> = { aur_quote: 'Quote', aur_inquiry: 'Inquiry', aur_products: 'Product', aur_plan: 'Plan' }
  const root = context[entity] ?? context[rootGroups[entity]]
  if (!root) throw new Error('The record for this template could not be loaded.')
  const rows = new Map<string, Promise<Record<string, unknown>>>()
  const resolvedPaths = new Map<string, Record<string, unknown>>()
  // Reuse the current product/plan snapshots, including visible quote edits.
  for (const [tableName, group, idField] of [['aur_quote', 'Quote', 'aur_quoteid'], ['aur_products', 'Product', 'aur_productsid'], ['aur_plan', 'Plan', 'aur_planid'], ['aur_inquiry', 'Inquiry', 'aur_inquiryid']]) {
    const row = context[group]
    if (row?.[idField]) rows.set(`${tableName}:${normalizeId(row[idField])}`, Promise.resolve(row))
  }
  for (const path of paths) {
    if (!path) continue
    const leafTable = tables.find((table) => table.name === path.lookups.at(-1)?.table)
    if (!leafTable?.fields.some((field) => field.name === path.field)) throw new Error('A related field in this template is no longer available. Reinsert it from the template editor.')
    let parent = root
    let sourceTable = tables.find((table) => table.name === entity)
    for (let index = 0; index < path.lookups.length; index += 1) {
      const step = path.lookups[index]
      const key = templateLookupContextKey(entity, path.lookups.slice(0, index + 1))
      const targetTable = tables.find((table) => table.name === step.table)
      if (!sourceTable || !targetTable?.entitySet) throw new Error('A related table in this template is no longer available.')
      const targets = await getTemplateLookupTargets(sourceTable, step.field, tables)
      const target = targets.find((item) => item.table === step.table)
      if (!target) throw new Error('A related field in this template does not match the table relationship. Reinsert the field from the template editor.')
      const actualTable = parent[`_${step.field}_value@Microsoft.Dynamics.CRM.lookuplogicalname`]
      const id = normalizeId(parent[`_${step.field}_value`] ?? parent[step.field])
      if (!id || (typeof actualTable === 'string' && actualTable.toLowerCase() !== step.table)) {
        result[key] = {}
        break
      }
      if (target.polymorphic && !actualTable) throw new Error('The related record type is unavailable for a lookup in this template. Refresh the quote and try again.')
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) throw new Error('A related record has an invalid identifier.')
      let row = resolvedPaths.get(key)
      if (!row) {
        const rowKey = `${step.table}:${id}`
        let pending = rows.get(rowKey)
        if (!pending) {
          const entitySet = targetTable.entitySet
          pending = getClient(dataSourcesInfo).retrieveRecordAsync<Record<string, unknown>>(entitySet, id).then((response) => {
            if (!response.success || !response.data) throw new Error(`The related ${targetTable.label} record could not be loaded. Check access and try again.`)
            return response.data
          })
          rows.set(rowKey, pending)
        }
        row = await pending
        resolvedPaths.set(key, row)
      }
      result[key] = row
      parent = row
      sourceTable = targetTable
    }
  }
  return result
}

function normalizeId(value: unknown) {
  return typeof value === 'string' ? value.replace(/[{}]/g, '').trim().toLowerCase() : ''
}
