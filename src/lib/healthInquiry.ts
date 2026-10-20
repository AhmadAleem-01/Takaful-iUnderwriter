export type CustomerAnswers = Record<string, unknown>

export interface HealthCustomerData extends CustomerAnswers {
  applicant: CustomerAnswers
  members: CustomerAnswers[]
  premium: CustomerAnswers
  product: CustomerAnswers
  plan: CustomerAnswers
}

export function customerObject(value: unknown): CustomerAnswers {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as CustomerAnswers
    : {}
}

export function inquiryProductKind(name?: string): 'motor' | 'health' | 'other' {
  const normalized = name?.trim().replace(/\s+/g, ' ').toLowerCase()
  return normalized === 'motor insurance' ? 'motor' : normalized === 'health insurance' || normalized === 'medical insurance' ? 'health' : 'other'
}

export function parseHealthCustomerData(raw?: string): HealthCustomerData | null {
  if (!raw?.trim()) return null
  try {
    const data = customerObject(JSON.parse(raw))
    if (!('applicant' in data) && !('coverageTarget' in data) && !('members' in data)) return null
    return {
      ...data,
      applicant: customerObject(data.applicant),
      members: Array.isArray(data.members)
        ? data.members.filter((member) => member && typeof member === 'object' && !Array.isArray(member)).map(customerObject)
        : [],
      premium: customerObject(data.premium),
      product: customerObject(data.product),
      plan: customerObject(data.plan),
    }
  } catch {
    return null
  }
}

export function healthAnswer(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return typeof value === 'string' && value.trim() ? value : 'Not provided'
}

export function healthChoice(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return healthAnswer(value)
  return value.replace(/_/g, ' ').replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
}

export function healthMoney(value: unknown, currency: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Not provided'
  const currencyCode = typeof currency === 'string' && /^[A-Z]{3}$/.test(currency) ? currency : 'AED'
  try {
    return new Intl.NumberFormat('en-AE', { style: 'currency', currency: currencyCode, maximumFractionDigits: 2 }).format(value)
  } catch {
    return `${currencyCode} ${value.toLocaleString('en-AE')}`
  }
}

export function healthBirthDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Not provided'
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return 'Not provided'
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
}
export function tpaNetworkPremiumAdjustment(label?: string): string {
  const network = label?.trim().replace(/\s+/g, ' ').toLowerCase()
  if (network === 'basic network' || network === 'basic') return '0%'
  if (network === 'standard network' || network === 'standard') return '+10%'
  if (network === 'premium network' || network === 'premium') return '+20%'
  return 'Not available'
}

