import aviationTemplate from '../../config/duplicate-inquiry/aviation.json'
import { parseDuplicateCriteria, type DuplicateCriteria } from './inquiryDuplicates'

export function createAviationCriteria(): DuplicateCriteria {
  const result = parseDuplicateCriteria(JSON.stringify(aviationTemplate))
  if (result.state !== 'ready') throw new Error('The Aviation duplicate rule template is invalid.')
  return structuredClone(result.criteria)
}

export function createBlankCriteria(): DuplicateCriteria {
  return {
    version: 1,
    insured: { operator: 'normalizedEqual', sources: ['inquiry.insuredName'] },
    identifiers: { operator: 'anyOverlap', groups: [{ key: 'identifier1', label: 'Risk identifier', sources: ['evidence:'] }] },
    period: { operator: 'overlapOrRenewalEqual', startSources: [], endSources: [], renewalSources: ['evidence:'] },
  }
}

export function serializeDuplicateCriteria(criteria: DuplicateCriteria): string {
  const json = JSON.stringify(criteria, null, 2)
  if (parseDuplicateCriteria(json).state !== 'ready') {
    throw new Error('Complete each identifier source and provide a valid policy date range or renewal date before saving.')
  }
  return json
}
