export type EvaluationRecord = Record<string, unknown>

export function evaluationNumber(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && !value.trim()) return null
  const number = typeof value === 'number' ? value : Number(value.replace(/[, %]/g, ''))
  return Number.isFinite(number) && number >= 0 ? number : null
}

export function calculateMemberPremium(data: EvaluationRecord): EvaluationRecord {
  const base = evaluationNumber(data.basePremium)
  if (!Array.isArray(data.additionalCharges)) return data
  const charges = evaluationRows(data.additionalCharges)
  const rates = charges.map((charge) => evaluationNumber(charge.percentage))
  if (base === null || rates.some((rate) => rate === null)) return data
  const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
  const percentage = rates.reduce<number>((sum, rate) => sum + (rate ?? 0), 0)
  const calculatedCharges = charges.map((charge, i) => ({ ...charge, amount: round(base * (rates[i] ?? 0) / 100) }))
  const total = round(calculatedCharges.reduce((sum, charge) => sum + charge.amount, 0))
  return { ...data, basePremium: base, additionalCharges: calculatedCharges, totalAdditionalPercentage: percentage, totalAdditionalCharges: total, finalPremium: round(base + total), calculationStatus: 'CalculatedFromMemberBase' }
}

export function evaluationObject(value: unknown): EvaluationRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as EvaluationRecord : {}
}

export function evaluationRows(value: unknown): EvaluationRecord[] {
  return Array.isArray(value) ? value.filter((item) => item !== null && typeof item === 'object' && !Array.isArray(item)) as EvaluationRecord[] : []
}

export function evaluationText(value: unknown, fallback = 'Not provided'): string {
  return typeof value === 'string' && value.trim() ? value.trim() : typeof value === 'number' && Number.isFinite(value) ? String(value) : fallback
}

export function declaredMedicalConditions(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (typeof entry === 'string') {
      return entry.trim() ? [{ condition: entry.trim(), diagnosed: '', status: '' }] : []
    }
    const record = evaluationObject(entry)
    const condition = evaluationText(record.condition, '')
    const diagnosed = evaluationText(record.diagnosed, '')
    const status = evaluationText(record.status, '')
    return condition || diagnosed || status ? [{ condition: condition || 'Medical condition', diagnosed, status }] : []
  })
}

export function parseHealthAiEvaluation(raw?: string): EvaluationRecord | null {
  try {
    const value = JSON.parse(raw ?? '')
    const result = evaluationObject(value)
    return ['insuredMembers', 'businessRuleEvaluation', 'memberBusinessRuleEvaluations', 'policyPremiumBreakdown', 'evaluationSummary'].some((key) => key in result) ? result : null
  } catch { return null }
}

export function memberEvaluationRows(rows: unknown, member: EvaluationRecord) {
  return evaluationRows(rows).filter((row) => member.memberId
    ? row.memberId === member.memberId
    : !!member.memberName && row.memberName === member.memberName)
}

export function uniqueEvaluationRules(rows: unknown) {
  const seen = new Set<string>()
  return evaluationRows(rows).filter((row) => {
    const key = JSON.stringify([row.memberId, row.ruleName, row.status, row.ConditionMet, row.response, row.evidence])
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
