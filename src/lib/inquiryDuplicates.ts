export interface DuplicateCriteria {
  version: 1
  insured: { operator: 'normalizedEqual'; sources: string[] }
  identifiers: { operator: 'anyOverlap'; groups: Array<{ key: string; label?: string; sources: string[] }> }
  period: { operator: 'overlapOrRenewalEqual'; startSources: string[]; endSources: string[]; renewalSources: string[] }
}

export interface DuplicateInquiryRecord {
  id: string
  name: string
  inquiryNumber?: string
  parentProductId?: string
  insuredName?: string
  createdOn?: string
  receivedOn?: string
  receivedSource?: 'email' | 'inquiry'
  brokerName?: string
  responses?: Array<{ businessRuleId?: string; businessRuleName: string; response: string; evidence?: string }>
}

export interface InquiryDuplicateFinding {
  id: string
  label: string
  status: 'potentialDuplicate' | 'manualReview' | 'separate'
  reason: string
  brokerName?: string
  currentPriorityOn?: string
  currentPrioritySource?: 'email' | 'inquiry'
  receivedOn?: string
  receivedSource?: 'email' | 'inquiry'
  currentIsProvisionalPreferred: boolean | null
  matchedIdentifiers: Array<{ key: string; values: string[] }>
  identifierComparisons: Array<{ key: string; label: string; currentValues: string[]; relatedValues: string[]; matchedValues: string[] }>
}

const object = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
const id = (value?: string) => (value ?? '').replace(/[{}]/g, '').toLowerCase()
export const normalizeInsuredName = (value?: string) =>
  (value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en')
const label = (value: string) => normalizeInsuredName(value).replace(/[^a-z0-9]/g, '')
const validSource = (source: unknown): source is string => {
  if (typeof source !== 'string' || source.length > 200) return false
  if (source === 'inquiry.insuredName') return true
  const named = source.match(/^(response|evidence):(.+)$/)
  if (named) return !!named[2].trim()
  const byId = source.match(/^(responseId|evidenceId):(.+)$/)
  return !!byId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(byId[2])
}
const validSources = (value: unknown, allowEmpty = false): value is string[] =>
  Array.isArray(value) && (allowEmpty || value.length > 0) && value.length <= 30 && value.every(validSource)

export function parseDuplicateCriteria(raw?: string): { state: 'ready'; criteria: DuplicateCriteria } | { state: 'notConfigured' | 'invalid'; message: string } {
  if (!raw?.trim()) return { state: 'notConfigured', message: 'Duplicate inquiry criteria are not configured for this line of business.' }
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return { state: 'invalid', message: 'Duplicate inquiry criteria must be valid JSON.' } }
  const root = object(parsed)
  const insured = object(root?.insured)
  const identifiers = object(root?.identifiers)
  const period = object(root?.period)
  const groups = identifiers?.groups
  const validGroups = Array.isArray(groups) && groups.length > 0 && groups.length <= 20 && groups.every((group) => {
    const item = object(group)
    return typeof item?.key === 'string' && /^[a-zA-Z][a-zA-Z0-9_]*$/.test(item.key)
      && (item.label === undefined || typeof item.label === 'string' && !!item.label.trim() && item.label.length <= 80)
      && validSources(item.sources) && item.sources.every((source: string) => source !== 'inquiry.insuredName')
  }) && new Set(groups.map((group) => (group as { key: string }).key)).size === groups.length
  if (root?.version !== 1 || insured?.operator !== 'normalizedEqual' || !validSources(insured.sources)
    || identifiers?.operator !== 'anyOverlap' || !validGroups || period?.operator !== 'overlapOrRenewalEqual'
    || !validSources(period.startSources, true) || !validSources(period.endSources, true)
    || !validSources(period.renewalSources, true)
    || [...(period.startSources as string[]), ...(period.endSources as string[]), ...(period.renewalSources as string[])].some((source) => source === 'inquiry.insuredName')
    || !(period.startSources as string[]).length && !(period.renewalSources as string[]).length
    || !!(period.startSources as string[]).length !== !!(period.endSources as string[]).length) {
    return { state: 'invalid', message: 'Duplicate inquiry criteria have an unsupported version, operator, or field source.' }
  }
  return { state: 'ready', criteria: parsed as DuplicateCriteria }
}

function sourceValues(record: DuplicateInquiryRecord, source: string): unknown[] {
  if (source === 'inquiry.insuredName') return [record.insuredName]
  const [kind, rule] = source.split(/:(.*)/s, 2)
  const byId = kind.endsWith('Id')
  const field = kind.startsWith('evidence') ? 'evidence' : 'response'
  return (record.responses ?? [])
    .filter((row) => byId ? id(row.businessRuleId) === id(rule) : label(row.businessRuleName) === label(rule))
    .map((row) => row[field])
}

function scalarValues(record: DuplicateInquiryRecord, sources: string[]): string[] {
  const scalar = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.flatMap(scalar)
    if (value && typeof value === 'object') {
      const wrapper = value as Record<string, unknown>
      return scalar(wrapper.value ?? wrapper.answer ?? wrapper.response)
    }
    if (typeof value !== 'string' && typeof value !== 'number') return []
    if (typeof value === 'string' && (value.trim().startsWith('[') || value.trim().startsWith('{'))) {
      try { return scalar(JSON.parse(value)) } catch { return [] }
    }
    return String(value).split(/[,;\n|]+/).map((part) => part.trim()).filter(Boolean)
  }
  return sources.flatMap((source) => sourceValues(record, source).flatMap(scalar))
}

function textValues(record: DuplicateInquiryRecord, sources: string[]): string[] {
  return sources.flatMap((source) => sourceValues(record, source)).flatMap((value) => {
    if (typeof value === 'string' || typeof value === 'number') return [String(value)]
    return []
  })
}

export function hasInsuredValue(record: DuplicateInquiryRecord, criteria: DuplicateCriteria): boolean {
  return textValues(record, criteria.insured.sources).some((value) => !!normalizeInsuredName(value))
}

const placeholders = new Set(['NA', 'NONE', 'NULL', 'UNKNOWN', 'PENDING', 'TBC', 'TBD', 'NOTPROVIDED', 'NOTAVAILABLE', 'REGISTRATION', 'REGISTRATIONS', 'SERIAL', 'SERIALS'])
const isEvidence = (source: string) => source.startsWith('evidence:') || source.startsWith('evidenceId:')

function evidenceIdentifiers(value: unknown, kind: string): string[] {
  if (typeof value !== 'string') return []
  if (kind === 'registration') {
    return [...value.toUpperCase().matchAll(/\b(?:[A-Z]{1,2}[0-9]?-[A-Z0-9]{2,6}|N[0-9]{1,5}[A-Z]{0,2})\b/g)].map((match) => match[0])
  }
  if (kind === 'serial') {
    return [...value.toUpperCase().matchAll(/\b(?:MSN|S\/N|SERIAL(?:\s+(?:NO|NUMBER))?)\s*[:#-]?\s*([A-Z0-9-]{3,30})\b/g)].map((match) => match[1])
  }
  return []
}

function identifiers(record: DuplicateInquiryRecord, sources: string[], kind: string): Map<string, string> {
  const result = new Map<string, string>()
  const rawValues = sources.flatMap((source) => isEvidence(source)
    ? sourceValues(record, source).flatMap((value) => evidenceIdentifiers(value, kind))
    : scalarValues(record, [source]))
  for (const raw of rawValues) {
    const display = raw.replace(/^(?:aircraft\s+)?(?:registration|serial(?: number)?|tail(?: number)?|msn)\s*:\s*/i, '').trim().toUpperCase()
    if (!/^[A-Z0-9]+(?:[- ][A-Z0-9]+)*$/.test(display) || display.length > 30) continue
    const key = display.replace(/[^A-Z0-9]/g, '')
    if (key.length < 3 || placeholders.has(key) || (display.includes(' ') && !/\d/.test(display))) continue
    result.set(key, display)
  }
  return result
}

const months = new Map('january february march april may june july august september october november december'.split(' ').map((month, index) => [month, index + 1]))
function datesFromEvidence(value: unknown): string[] {
  if (typeof value !== 'string') return []
  const found: Array<{ offset: number; date: string }> = []
  for (const match of value.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)) found.push({ offset: match.index, date: match[0] })
  for (const match of value.matchAll(/\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/gi)) {
    const month = months.get(match[2].toLowerCase())!
    found.push({ offset: match.index, date: `${match[3]}-${String(month).padStart(2, '0')}-${match[1].padStart(2, '0')}` })
  }
  return found.sort((a, b) => a.offset - b.offset).map((item) => item.date)
}

function dates(record: DuplicateInquiryRecord, sources: string[], role: 'start' | 'end' | 'renewal', shared: Set<string>): string[] {
  return [...new Set(sources.flatMap((source) => isEvidence(source) ? sourceValues(record, source).flatMap((value) => {
    const found = datesFromEvidence(value)
    if (found.length > 2 || (shared.has(source) && found.length < 2)) return []
    if (role === 'start') return found.slice(0, 1)
    if (role === 'end') return found.slice(-1)
    return found.length === 1 ? found : []
  }) : scalarValues(record, [source])).flatMap((raw) => {
    const date = raw.match(/^(\d{4}-\d{2}-\d{2})(?:T.*)?$/)?.[1]
    return date && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().startsWith(date) ? [date] : []
  }))]
}

function comparePeriod(left: DuplicateInquiryRecord, right: DuplicateInquiryRecord, rule: DuplicateCriteria['period']) {
  const shared = new Set(rule.startSources.filter((source) => rule.endSources.includes(source)))
  const starts = [left, right].map((record) => dates(record, rule.startSources, 'start', shared))
  const ends = [left, right].map((record) => dates(record, rule.endSources, 'end', shared))
  const renewals = [left, right].map((record) => dates(record, rule.renewalSources, 'renewal', shared))
  if ([...starts, ...ends, ...renewals].some((items) => items.length > 1)) return 'conflict'
  if (starts[0][0] && ends[0][0] && starts[1][0] && ends[1][0]) {
    if (starts[0][0] > ends[0][0] || starts[1][0] > ends[1][0]) return 'conflict'
    return starts[0][0] <= ends[1][0] && starts[1][0] <= ends[0][0] ? 'match' : 'different'
  }
  if (renewals[0][0] && renewals[1][0]) return renewals[0][0] === renewals[1][0] ? 'match' : 'different'
  return 'missing'
}

function priority(record: DuplicateInquiryRecord): { time: number; source: 'email' | 'inquiry' } | null {
  const received = Date.parse(record.receivedOn ?? '')
  if (Number.isFinite(received)) return { time: received, source: record.receivedSource ?? 'email' }
  const created = Date.parse(record.createdOn ?? '')
  return Number.isFinite(created) ? { time: created, source: 'inquiry' } : null
}

export function evaluateInquiryDuplicates(current: DuplicateInquiryRecord, candidates: DuplicateInquiryRecord[], criteria: DuplicateCriteria): InquiryDuplicateFinding[] {
  const insured = new Set(textValues(current, criteria.insured.sources).map(normalizeInsuredName).filter(Boolean))
  if (!insured.size) return []
  return candidates.flatMap((candidate): InquiryDuplicateFinding[] => {
    if (id(candidate.id) === id(current.id) || id(candidate.parentProductId) !== id(current.parentProductId)) return []
    if (!textValues(candidate, criteria.insured.sources).map(normalizeInsuredName).some((name) => insured.has(name))) return []
    const groups = criteria.identifiers.groups.map((group) => {
      const left = identifiers(current, group.sources, group.key)
      const right = identifiers(candidate, group.sources, group.key)
      return {
        key: group.key,
        label: group.label ?? group.key,
        currentValues: [...left.values()],
        relatedValues: [...right.values()],
        values: [...left.keys()].filter((key) => right.has(key)).map((key) => left.get(key)!),
        comparable: !!left.size && !!right.size,
      }
    })
    const matchedIdentifiers = groups.filter((group) => group.values.length).map(({ label, values }) => ({ key: label, values }))
    const identifierComparisons = groups.map(({ key, label, currentValues, relatedValues, values }) => ({
      key, label, currentValues, relatedValues, matchedValues: values,
    }))
    const riskMatch = !!matchedIdentifiers.length
    // Evidence is often a cited excerpt, not a complete fleet inventory. Only
    // direct answer values can establish that all configured identifiers differ.
    const completeIdentifiers = criteria.identifiers.groups.every((group) => group.sources.every((source) => !isEvidence(source)))
    const riskDifferent = !riskMatch && completeIdentifiers && groups.every((group) => group.comparable)
    const registration = groups.find((group) => group.key === 'registration')
    const serial = groups.find((group) => group.key === 'serial')
    const riskConflict = !!(registration?.values.length && serial?.comparable && !serial.values.length)
    const period = comparePeriod(current, candidate, criteria.period)
    let status: InquiryDuplicateFinding['status'] = 'manualReview'
    let reason = 'The insured matches, but risk identifiers or policy dates are incomplete or cannot establish a full fleet comparison.'
    if (riskConflict || period === 'conflict') reason = 'The insured matches, but supplied identifiers or dates conflict.'
    else if (riskDifferent) { status = 'separate'; reason = 'The insured matches, but known risk identifiers are different.' }
    else if (period === 'different') { status = 'separate'; reason = 'The insured may have the same risk, but policy periods or renewal dates differ.' }
    else if (riskMatch && period === 'match') {
      status = 'potentialDuplicate'
      reason = `Matching insured, ${matchedIdentifiers.map((group) => `${group.key}: ${group.values.join(', ')}`).join('; ')}, and policy period or renewal date.`
    }
    const leftPriority = priority(current)
    const rightPriority = priority(candidate)
    const currentIsProvisionalPreferred = status === 'potentialDuplicate' && leftPriority && rightPriority
      ? leftPriority.time < rightPriority.time || leftPriority.time === rightPriority.time && id(current.id) < id(candidate.id) : null
    return [{ id: candidate.id, label: candidate.inquiryNumber || candidate.name, status, reason, brokerName: candidate.brokerName,
      currentPriorityOn: leftPriority ? new Date(leftPriority.time).toISOString() : undefined, currentPrioritySource: leftPriority?.source,
      receivedOn: rightPriority ? new Date(rightPriority.time).toISOString() : undefined, receivedSource: rightPriority?.source,
      currentIsProvisionalPreferred, matchedIdentifiers, identifierComparisons }]
  }).sort((left, right) => {
    const order = { potentialDuplicate: 0, manualReview: 1, separate: 2 }
    return order[left.status] - order[right.status] || (Date.parse(left.receivedOn ?? '') || 0) - (Date.parse(right.receivedOn ?? '') || 0)
  })
}
