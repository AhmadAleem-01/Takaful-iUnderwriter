import type { ChartDatum } from '../domain/app'

const TYPES = ['New', 'Renewal', 'Endorsement', 'Claims']
export const INQUIRY_MIX_COLORS = ['#194F90', '#C5E0E8', '#719FC2', '#9AAAC0', '#4386B5', '#72AFAF']

export function normalizeInquiryMix(items: ChartDatum[]): ChartDatum[] {
  const counts = new Map(TYPES.map((label) => [label, 0]))
  for (const item of items) {
    const rawLabel = item.label.trim() || 'Unknown'
    const label = TYPES.find((type) => type.toLowerCase() === rawLabel.toLowerCase()) ?? rawLabel
    const value = Number.isFinite(item.value) ? Math.max(0, item.value) : 0
    counts.set(label, (counts.get(label) ?? 0) + value)
  }
  return [...counts].map(([label, value]) => ({ label, value }))
}

export function inquiryMixShare(value: number, total: number): number {
  return total > 0 ? Math.round(value / total * 100) : 0
}

export function inquiryMixTooltip(label: string, value: number, total: number): string {
  return label + ' · ' + value + ' ' + (value === 1 ? 'inquiry' : 'inquiries') + ' · ' + inquiryMixShare(value, total) + '% of intake'
}
