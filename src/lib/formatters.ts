export function formatAmount(value: string | number | null | undefined, maximumFractionDigits = 20) {
  if (value == null || String(value).trim() === '') return ''
  const number = Number(String(value).replace(/,/g, ''))
  return Number.isFinite(number)
    ? new Intl.NumberFormat('en-AE', { maximumFractionDigits }).format(number)
    : String(value)
}

export function formatCurrency(value?: number | null) {
  const amount = Number.isFinite(value ?? NaN) ? Number(value) : 0
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatCompactNumber(value?: number | null) {
  const amount = Number.isFinite(value ?? NaN) ? Number(value) : 0
  return new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount)
}

export function formatDate(value?: string | null) {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export function formatPercent(value?: number | null) {
  const amount = Number.isFinite(value ?? NaN) ? Number(value) : 0
  return `${Math.round(amount)}%`
}

export function formatRelativeDays(value?: number | null) {
  if (value == null) return 'Unknown'
  if (value < 0) return `${Math.abs(value)} days overdue`
  if (value === 0) return 'Due today'
  return `${value} days remaining`
}
