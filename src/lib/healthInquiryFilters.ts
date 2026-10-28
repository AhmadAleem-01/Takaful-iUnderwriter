import type { InquirySummary } from '../domain/app'
import { INQUIRY_STATUS_OPTIONS } from '../services/inquiryStatusOptions'

export const HEALTH_INQUIRY_FILTERS = [
  { key: 'active', label: 'Active', statuses: [1] },
  { key: 'inactive', label: 'Inactive', statuses: [2] },
]

export function matchesHealthInquiryFilter(record: Pick<InquirySummary, 'inquiryStatusValue' | 'status'>, key: string) {
  const status = record.inquiryStatusValue ?? INQUIRY_STATUS_OPTIONS.find((option) => option.label.toLowerCase() === record.status.trim().toLowerCase())?.value
  return status !== undefined && (HEALTH_INQUIRY_FILTERS.find((filter) => filter.key === key)?.statuses.includes(status) ?? false)
}
