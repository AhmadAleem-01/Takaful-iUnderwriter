import type { InquirySummary } from '../domain/app'
import { INQUIRY_STATUS_OPTIONS } from '../services/inquiryStatusOptions'

export const HEALTH_INQUIRY_FILTERS = [
  { key: 'intake', label: 'Intake', statuses: [1, 751820006, 751820007, 751820020] },
  { key: 'verification', label: 'Verification', statuses: [751820017, 751820018] },
  { key: 'kyc', label: 'KYC Required', statuses: [751820019] },
  { key: 'processing', label: 'AI Processing', statuses: [751820001, 751820008] },
  { key: 'review', label: 'Awaiting Review', statuses: [751820009] },
  { key: 'sent', label: 'Quote Sent', statuses: [751820016] },
]

export function matchesHealthInquiryFilter(record: Pick<InquirySummary, 'inquiryStatusValue' | 'status'>, key: string) {
  const status = record.inquiryStatusValue ?? INQUIRY_STATUS_OPTIONS.find((option) => option.label.toLowerCase() === record.status.trim().toLowerCase())?.value
  return status !== undefined && (HEALTH_INQUIRY_FILTERS.find((filter) => filter.key === key)?.statuses.includes(status) ?? false)
}
