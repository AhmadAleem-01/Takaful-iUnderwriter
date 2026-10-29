export const underwriterActions = [
  { value: 1, label: 'In Progress' },
  { value: 2, label: 'Lost' },
  { value: 3, label: 'Converted' },
  { value: 4, label: 'Invalid' },
]

export const lostSubActions = [
  { value: 14, label: 'Rejected by UW - Non GCC (TPL cover only)' },
  { value: 13, label: 'Customer Not Interested - Quote Sent' },
  { value: 12, label: 'No Response - from Sales Agent' },
  { value: 11, label: 'Rejected by UW - Vehicle Manufacture Year (TPL cover only)' },
  { value: 10, label: 'Rejected by UW - Claims History Exists' },
  { value: 9, label: 'Rejected by UW - Driving License Less Than 1 Year (TPL cover only)' },
  { value: 8, label: 'Rejected by UW - Driver Age Below 25 (TPL cover only)' },
  { value: 7, label: 'No Response - From Customer' },
  { value: 6, label: 'Rejected by UW - Restricted Vehicle (TPL cover only)' },
  { value: 5, label: 'Rejected by UW - Restricted for Outside Agency Repair Only' },
  { value: 4, label: 'Lost to Competitor - High Premium' },
]

export const convertedSubActions = [
  { value: 1, label: 'Motor Insurance - TPL' },
  { value: 2, label: 'Motor Insurance - Non-Agency' },
  { value: 3, label: 'Motor Insurance - Agency' },
]

export function getUnderwriterSubActions(action: string) {
  return action === '2' ? lostSubActions : action === '3' ? convertedSubActions : []
}

export function vehicleValueAverage(value?: string | null): string {
  if (!value?.trim()) return ''
  const parts = value.replace(/,/g, '').trim().split(/\s*[-\u2013\u2014]\s*/)
  if (parts.length > 2 || parts.some((part) => !/^\d+(?:\.\d+)?$/.test(part))) return ''
  const numbers = parts.map(Number)
  const average = numbers.reduce((sum, number) => sum + number, 0) / numbers.length
  return Number.isFinite(average) ? String(Math.round(average * 100) / 100) : ''
}
