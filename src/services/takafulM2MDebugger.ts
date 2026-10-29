import { Aur_TakafulManageManyToManyService } from '../generated/services/Aur_TakafulManageManyToManyService'

export type TakafulM2MOperation = 'Retrieve' | 'Associate' | 'Disassociate'

export interface TakafulM2MContext {
  targetTable: string
  targetId?: string
  relationshipName: string
  targetColumns: string[]
  relatedColumns: string[]
}

export interface TakafulM2MRequestPayload {
  Operation: TakafulM2MOperation
  RelationshipName: string
  TargetTable: string
  TargetId?: string
  TargetColumnsJson: string
  RelatedIdsJson: string
  PageSize: number
  PageNumber: number
  PagingCookie: string
  ColumnsJson: string
}

export interface TakafulM2MRecord {
  id?: string
  attributes?: Record<string, unknown>
  formattedValues?: Record<string, unknown>
  relatedRecords?: TakafulM2MRecord[]
  [key: string]: unknown
}

export interface TakafulM2MResult {
  success?: boolean
  operation?: string
  relatedTable?: string
  targetTable?: string
  targetRecord?: TakafulM2MRecord | null
  count: number
  records: TakafulM2MRecord[]
  pageNumber: number
  moreRecords: boolean
  pagingCookie?: string | null
  [key: string]: unknown
}

export const MAX_TAKAFUL_M2M_RELATED_IDS = 100

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const LOGICAL_NAME_PATTERN = /^[a-z][a-z0-9_]*$/i

export function validateTakafulM2MContext(context: TakafulM2MContext, operation: TakafulM2MOperation): void {
  if (!LOGICAL_NAME_PATTERN.test(context.targetTable.trim())) {
    throw new Error('Enter a valid target table logical name, such as account or aur_products.')
  }
  if (context.targetId?.trim() && !GUID_PATTERN.test(context.targetId.trim())) {
    throw new Error('Enter a valid target record GUID without braces.')
  }
  if (!context.targetId?.trim() && operation !== 'Retrieve') {
    throw new Error('A target record GUID is required for Associate and Disassociate.')
  }
  if (!LOGICAL_NAME_PATTERN.test(context.relationshipName.trim())) {
    throw new Error('Enter a valid many-to-many relationship schema name.')
  }
  for (const column of [...context.targetColumns, ...context.relatedColumns]) {
    if (!LOGICAL_NAME_PATTERN.test(column)) throw new Error(`Invalid related-table column logical name: ${column}`)
  }
}

export function createTakafulM2MRequest(
  operation: TakafulM2MOperation,
  context: TakafulM2MContext,
  relatedIds: string[] = [],
  paging: { pageSize?: number; pageNumber?: number; pagingCookie?: string } = {},
): TakafulM2MRequestPayload {
  validateTakafulM2MContext(context, operation)
  if (relatedIds.length > MAX_TAKAFUL_M2M_RELATED_IDS) {
    throw new Error(`A maximum of ${MAX_TAKAFUL_M2M_RELATED_IDS} related record IDs can be sent per operation.`)
  }
  if (relatedIds.some((id) => !GUID_PATTERN.test(id))) throw new Error('Every related record ID must be a valid GUID.')
  const pageSize = paging.pageSize ?? 100
  const pageNumber = paging.pageNumber ?? 1
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500) throw new Error('PageSize must be an integer from 1 to 500.')
  if (!Number.isInteger(pageNumber) || pageNumber < 1) throw new Error('PageNumber must be a positive integer.')

  return {
    Operation: operation,
    RelationshipName: context.relationshipName.trim(),
    TargetTable: context.targetTable.trim(),
    ...(context.targetId?.trim() ? { TargetId: context.targetId.trim() } : {}),
    RelatedIdsJson: JSON.stringify(relatedIds),
    PageSize: pageSize,
    PageNumber: pageNumber,
    PagingCookie: paging.pagingCookie ?? '',
    ColumnsJson: JSON.stringify(context.relatedColumns),
    TargetColumnsJson: JSON.stringify(context.targetColumns),
  }
}

export function parseRelatedIds(value: string): string[] {
  const ids = value.split(/[\s,;]+/).map((id) => id.trim()).filter(Boolean)
  if (ids.some((id) => !GUID_PATTERN.test(id))) throw new Error('Enter valid GUIDs separated by commas or new lines.')
  return [...new Set(ids)]
}

export async function runTakafulM2MOperation(
  operation: TakafulM2MOperation,
  context: TakafulM2MContext,
  relatedIds: string[] = [],
  paging: { pageSize?: number; pageNumber?: number; pagingCookie?: string } = {},
): Promise<{ request: TakafulM2MRequestPayload; result: TakafulM2MResult }> {
  const request = createTakafulM2MRequest(operation, context, relatedIds, paging)
  // Keep this mapping aligned with the generated positional SDK signature.
  const response = await Aur_TakafulManageManyToManyService.aur_TakafulManageManyToMany(
    request.Operation,
    request.RelationshipName,
    request.TargetTable,
    request.RelatedIdsJson,
    request.PageSize,
    request.PageNumber,
    request.PagingCookie,
    request.ColumnsJson,
    request.TargetId,
    request.TargetColumnsJson,
  )
  const responseData: unknown = response.data
  if (!response.success || response.error || hasApiFailure(responseData)) {
    throw new Error(formatApiError(response.error ?? responseData))
  }
  console.debug('[M2M debugger] Raw Dataverse action response:', responseData)
  const result = extractResult(responseData)
  if (!result) {
    const returnedKeys = responseData && typeof responseData === 'object'
      ? Object.keys(responseData).join(', ') || '(no enumerable properties)'
      : `${typeof responseData}: ${String(responseData)}`
    throw new Error(`Could not find ResultJson or a parsed result in the custom API response. Returned fields: ${returnedKeys}. Raw response: ${safeJson(responseData)}`)
  }
  console.info('[M2M debugger] Result:', result)
  console.table(result.records)
  return { request, result }
}

function formatApiError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    const value = error as Record<string, unknown>
    const nested = value.error
    if (nested && nested !== error) return formatApiError(nested)
    const message = value.message ?? value.Message
    if (message) return String(message)
    return safeJson(error)
  }
  return String(error ?? 'Unknown Dataverse custom API error.')
}

function hasApiFailure(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const body = value as Record<string, unknown>
  return body.success === false || Boolean(body.error)
}

function extractResult(value: unknown, depth = 0): TakafulM2MResult | null {
  if (depth > 4 || value == null) return null

  if (typeof value === 'string') {
    try {
      return extractResult(JSON.parse(value), depth + 1)
    } catch {
      return null
    }
  }

  if (typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const normalizedEntry = Object.entries(record).find(([key]) => key.toLowerCase() === 'resultjson')
  if (normalizedEntry) {
    const parsed = extractResult(normalizedEntry[1], depth + 1)
    if (parsed) return parsed
  }

  if (Array.isArray(record.records) && ('operation' in record || 'relatedTable' in record || 'targetRecord' in record || 'targetTable' in record || 'success' in record)) {
    return record as unknown as TakafulM2MResult
  }

  for (const [key, nested] of Object.entries(record)) {
    if (['result', 'data', 'body', 'value'].includes(key.toLowerCase())) {
      const parsed = extractResult(nested, depth + 1)
      if (parsed) return parsed
    }
  }
  return null
}

function safeJson(value: unknown) {
  try { return JSON.stringify(value) ?? String(value) } catch { return String(value) }
}
