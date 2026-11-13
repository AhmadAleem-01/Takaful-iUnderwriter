import { AccountsService } from '../generated/services/AccountsService'
import { Aur_inquiriesService } from '../generated/services/Aur_inquiriesService'
import { Aur_productsesService } from '../generated/services/Aur_productsesService'
import { EmailsService } from '../generated/services/EmailsService'
import type { Aur_inquiries } from '../generated/models/Aur_inquiriesModel'
import { evaluateInquiryDuplicates, hasInsuredValue, normalizeInsuredName, parseDuplicateCriteria, type DuplicateInquiryRecord } from '../lib/inquiryDuplicates'
import { getInquiryAiExtractedResponses } from './inquiriesService'

const normalizeId = (value?: string) => (value ?? '').replace(/[{}]/g, '').toLowerCase()

async function originalReceipt(id: string): Promise<string | undefined> {
  let skipToken: string | undefined
  let earliest: number | undefined
  do {
    const result = await EmailsService.getAll({
      filter: `_regardingobjectid_value eq ${id}`,
      select: ['activityid', '_regardingobjectid_value', 'directioncode', 'createdon'],
      ...(skipToken ? { skipToken } : {}),
    })
    if (!result.success || result.error) throw new Error('Unable to check original inquiry receipt time.')
    for (const email of result.data ?? []) {
      if (normalizeId(email._regardingobjectid_value) !== id || email.directioncode !== false) continue
      const time = Date.parse(email.createdon ?? '')
      if (Number.isFinite(time) && (earliest === undefined || time < earliest)) earliest = time
    }
    skipToken = result.skipToken
  } while (skipToken)
  return earliest === undefined ? undefined : new Date(earliest).toISOString()
}

export async function getInquiryDuplicateWarnings(id: string) {
  const inquiryId = normalizeId(id)
  const result = await Aur_inquiriesService.get(inquiryId)
  if (!result.success || result.error || !result.data) throw new Error('Unable to check inquiry duplicates.')
  const current = result.data
  const parentProductId = normalizeId(current._aur_line_of_business_value)
  if (!parentProductId) return { inquiryId, state: 'notConfigured' as const, message: 'This inquiry has no line of business parent product.', findings: [] }

  const product = await Aur_productsesService.get(parentProductId)
  if (!product.success || product.error || !product.data) throw new Error('Unable to load duplicate inquiry criteria.')
  const config = parseDuplicateCriteria(product.data.aur_duplicate_inquiry_criteria)
  if (config.state !== 'ready') return { inquiryId, state: config.state, message: config.message, findings: [] }

  const accounts = new Map<string, string>()
  let accountToken: string | undefined
  do {
    const page = await AccountsService.getAll({ select: ['accountid', 'name'], ...(accountToken ? { skipToken: accountToken } : {}) })
    if (!page.success || page.error) throw new Error('Unable to check insured names for duplicates.')
    for (const account of page.data ?? []) accounts.set(normalizeId(account.accountid), account.name ?? '')
    accountToken = page.skipToken
  } while (accountToken)

  const mapRecord = (record: Aur_inquiries): DuplicateInquiryRecord => ({
    id: record.aur_inquiryid, name: record.aur_name, inquiryNumber: record.aur_inquiry_number,
    parentProductId: normalizeId(record._aur_line_of_business_value),
    insuredName: accounts.get(normalizeId(record._aur_insured_company_value)) || record.aur_insured_companyname
      || (record as unknown as Record<string, string>)['_aur_insured_company_value@OData.Community.Display.V1.FormattedValue'],
    createdOn: record.createdon, brokerName: accounts.get(normalizeId(record._aur_broker_company_value)) || record.aur_broker_companyname
      || (record as unknown as Record<string, string>)['_aur_broker_company_value@OData.Community.Display.V1.FormattedValue'],
  })
  const mapped = mapRecord(current)
  const nameOnly = config.criteria.insured.sources.length === 1 && config.criteria.insured.sources[0] === 'inquiry.insuredName'
  if (nameOnly && !normalizeInsuredName(mapped.insuredName)) return { inquiryId, state: 'insufficientData' as const, message: 'Insured name is missing; duplicate inquiry check needs review.', findings: [] }
  const candidates: DuplicateInquiryRecord[] = []
  let skipToken: string | undefined
  do {
    const page = await Aur_inquiriesService.getAll({
      filter: `_aur_line_of_business_value eq ${parentProductId}`,
      select: ['aur_inquiryid', 'aur_name', 'aur_inquiry_number', '_aur_line_of_business_value', '_aur_insured_company_value', '_aur_broker_company_value', 'createdon'],
      ...(skipToken ? { skipToken } : {}),
    })
    if (!page.success || page.error) throw new Error('Unable to check inquiries for this line of business.')
    for (const record of page.data ?? []) {
      const candidate = mapRecord(record)
      if (normalizeId(candidate.id) !== inquiryId && (!nameOnly || normalizeInsuredName(candidate.insuredName) === normalizeInsuredName(mapped.insuredName))) candidates.push(candidate)
    }
    skipToken = page.skipToken
  } while (skipToken)

  const records = [mapped, ...candidates]
  for (let offset = 0; offset < records.length; offset += 5) {
    await Promise.all(records.slice(offset, offset + 5).map(async (record) => {
        const [responses, receivedOn] = await Promise.all([
          getInquiryAiExtractedResponses(record.id), candidates.length ? originalReceipt(normalizeId(record.id)) : Promise.resolve(undefined),
        ])
        record.responses = responses
        record.receivedOn = receivedOn
        record.receivedSource = receivedOn ? 'email' : 'inquiry'
    }))
  }
  if (!hasInsuredValue(mapped, config.criteria)) return { inquiryId, state: 'insufficientData' as const, message: 'Configured insured identity is missing; duplicate inquiry check needs review.', findings: [] }
  return { inquiryId, state: 'ready' as const, findings: evaluateInquiryDuplicates(mapped, candidates, config.criteria) }
}
