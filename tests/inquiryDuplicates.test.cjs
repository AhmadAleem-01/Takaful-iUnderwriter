const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function load(file, dependencies = {}) {
  const context = { exports: {}, require: (name) => dependencies[name] ?? {}, console }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context)
  return context.exports
}
const logic = load('lib/inquiryDuplicates.ts')
const template = fs.readFileSync(path.join(__dirname, '../config/duplicate-inquiry/aviation.json'), 'utf8')
const parsed = logic.parseDuplicateCriteria(template)
assert.equal(parsed.state, 'ready')
const criteria = parsed.criteria
const fleetRuleId = 'd9ba0e82-96d3-f111-a05d-6045bd69bb57'
const periodRuleId = 'f8a55dc7-94d3-f111-a05b-70a8a5212770'
const fleetRuleName = 'Fleet Schedule (Reg No, Pass/Crew Seat, Attachment date, Status)'
const fleet = (registration, serial) => `R12: B737-800 | ${registration} / MSN ${serial} | 20,000,000 | 01/11/2026 | 01/11/2027`
const responses = (registration = 'I-NEOU', serial = '29887', start = '1 November 2026', end = '1 November 2027') => [
  { businessRuleId: fleetRuleId, businessRuleName: fleetRuleName, response: 'Registrations and schedule-period dates are provided.', evidence: fleet(registration, serial) },
  { businessRuleId: periodRuleId, businessRuleName: 'Policy Period', response: 'The policy inception and expiry dates are stated.', evidence: `From ${start}\nTo:\n${end}` },
]
const old = { id: 'old', name: 'Old', parentProductId: 'aviation', insuredName: 'XYZ Airlines', createdOn: '2026-01-02T00:00:00Z', brokerName: 'Marsh', responses: responses() }
const now = { ...old, id: 'new', name: 'New', createdOn: '2026-01-03T00:00:00Z', brokerName: 'Willis' }
const compare = (current = now, candidate = old, rule = criteria) => logic.evaluateInquiryDuplicates(current, [candidate], rule)[0]

test('template validates and rejects customer information or malformed rule sources', () => {
  assert.equal(logic.parseDuplicateCriteria('').state, 'notConfigured')
  assert.equal(logic.parseDuplicateCriteria('plain English').state, 'invalid')
  assert.equal(logic.parseDuplicateCriteria(JSON.stringify({ ...criteria, version: 2 })).state, 'invalid')
  assert.equal(logic.parseDuplicateCriteria(JSON.stringify({ ...criteria, identifiers: { ...criteria.identifiers, groups: [{ key: 'registration', sources: ['customerData.aircraft[].registration'] }] } })).state, 'invalid')
  assert.equal(logic.parseDuplicateCriteria(JSON.stringify({ ...criteria, identifiers: { ...criteria.identifiers, groups: [{ key: 'registration', sources: ['evidenceId:not-a-guid'] }] } })).state, 'invalid')
})

test('matches actual-style Fleet Schedule evidence across brokers and normalizes registrations', () => {
  const finding = compare({ ...now, insuredName: '  xyz  AIRLINES ', responses: responses('i-neou', '29887') })
  assert.equal(finding.status, 'potentialDuplicate')
  assert.equal(finding.matchedIdentifiers.some((group) => group.key === 'Aircraft serial number'), true)
  assert.equal(finding.currentIsProvisionalPreferred, false)
  const registrationFinding = compare({ ...now, responses: responses('I-NEOU', '29887') })
  assert.equal(registrationFinding.matchedIdentifiers.some((group) => group.key === 'Aircraft registration'), true)
})

test('matching serial is sufficient after a registration change', () => {
  const finding = compare({ ...now, responses: responses('I-NEWX', '29887') })
  assert.equal(finding.status, 'potentialDuplicate')
  assert.deepEqual(JSON.parse(JSON.stringify(finding.identifierComparisons.map(({ label, currentValues, relatedValues, matchedValues }) => ({ label, currentValues, relatedValues, matchedValues })))), [
    { label: 'Aircraft registration', currentValues: ['I-NEWX'], relatedValues: ['I-NEOU'], matchedValues: [] },
    { label: 'Aircraft serial number', currentValues: ['29887'], relatedValues: ['29887'], matchedValues: ['29887'] },
  ])
})

test('insured identity can come from each inquiry\'s saved AI answer', () => {
  const rule = { ...criteria, insured: { operator: 'normalizedEqual', sources: ['response:Insured Name'] } }
  const withInsuredAnswer = (record) => ({ ...record, insuredName: undefined, responses: [
    { businessRuleName: 'Insured Name', response: 'XYZ Airlines' },
    ...record.responses,
  ] })
  assert.equal(compare(withInsuredAnswer(now), withInsuredAnswer(old), rule).status, 'potentialDuplicate')
})

test('different aircraft excerpts cannot prove that whole fleets are separate', () => {
  assert.equal(compare({ ...now, responses: responses('I-NEWX', '99999') }).status, 'manualReview')
})

test('complete direct answer identifiers can establish separate risks', () => {
  const rule = { ...criteria, identifiers: { operator: 'anyOverlap', groups: [
    { key: 'registration', sources: ['response:Aircraft Registration'] },
    { key: 'serial', sources: ['response:Aircraft Serial'] },
  ] } }
  const direct = (registration, serial) => [
    { businessRuleName: 'Aircraft Registration', response: registration },
    { businessRuleName: 'Aircraft Serial', response: serial },
    responses()[1],
  ]
  assert.equal(compare({ ...now, responses: direct('I-NEWX', '99999') }, { ...old, responses: direct('I-NEOU', '29887') }, rule).status, 'separate')
})

test('non-overlapping policy evidence identifies separate transactions', () => {
  assert.equal(compare({ ...now, responses: responses('I-NEOU', '29887', '1 January 2028', '1 January 2029') }).status, 'separate')
})

test('saved exact renewal answers can replace unavailable policy periods', () => {
  const rule = { ...criteria, period: { operator: 'overlapOrRenewalEqual', startSources: [], endSources: [], renewalSources: ['response:Renewal Date'] } }
  const renewal = [{ businessRuleName: fleetRuleName, response: '', evidence: fleet('I-NEOU', '29887') }, { businessRuleName: 'Renewal Date', response: '2027-11-01' }]
  assert.equal(compare({ ...now, responses: renewal }, { ...old, responses: renewal }, rule).status, 'potentialDuplicate')
})

test('missing identifiers or period evidence require manual review', () => {
  const finding = compare({ ...now, responses: [responses()[1]] })
  assert.equal(finding.status, 'manualReview')
  assert.equal(finding.identifierComparisons.every((item) => item.currentValues.length === 0 && item.relatedValues.length > 0), true)
  assert.equal(compare({ ...now, responses: [responses()[0]] }).status, 'manualReview')
})

test('matching registration with conflicting serials requires manual review', () => {
  assert.equal(compare({ ...now, responses: responses('I-NEOU', '99999') }).status, 'manualReview')
})

test('business rule IDs identify saved evidence even when rule names change', () => {
  const rule = { ...criteria, identifiers: { ...criteria.identifiers, groups: criteria.identifiers.groups.map((group) => ({ ...group, sources: [`evidenceId:${fleetRuleId}`] })) },
    period: { ...criteria.period, startSources: [`evidenceId:${periodRuleId}`], endSources: [`evidenceId:${periodRuleId}`] } }
  const renamed = responses().map((item) => ({ ...item, businessRuleName: 'Renamed business rule' }))
  assert.equal(compare({ ...now, responses: renamed }, { ...old, responses: renamed }, rule).status, 'potentialDuplicate')
})

test('summary prose is not treated as an aircraft identifier or a policy date', () => {
  const answerOnly = responses().map(({ businessRuleId, businessRuleName, response }) => ({ businessRuleId, businessRuleName, response }))
  assert.equal(compare({ ...now, responses: answerOnly }, { ...old, responses: answerOnly }).status, 'manualReview')
})

test('customer information is ignored even when it contains a matching aircraft', () => {
  const current = { ...now, responses: [], customerData: JSON.stringify({ aircraft: [{ registrationNumber: 'I-NEOU', serialNumber: '29887' }] }) }
  assert.equal(compare(current).status, 'manualReview')
})

test('earliest original received email outranks inquiry creation; creation time is fallback', () => {
  const current = { ...now, receivedOn: '2026-01-01T01:00:00Z', receivedSource: 'email' }
  assert.equal(compare(current).currentIsProvisionalPreferred, true)
  assert.equal(compare(now, old).receivedSource, 'inquiry')
})

test('different parent products and insureds are excluded', () => {
  assert.equal(logic.evaluateInquiryDuplicates(now, [{ ...old, parentProductId: 'marine' }], criteria).length, 0)
  assert.equal(logic.evaluateInquiryDuplicates(now, [{ ...old, insuredName: 'Other' }], criteria).length, 0)
})

test('service reads only stored extraction data and never requests customer information', async () => {
  const calls = { filter: '', selected: [], extracted: [] }
  const inquiry = (id, date) => ({ aur_inquiryid: id, aur_name: id, _aur_line_of_business_value: 'aviation', _aur_insured_company_value: 'insured', createdon: date })
  const service = load('services/inquiryDuplicatesService.ts', {
    '../generated/services/Aur_inquiriesService': { Aur_inquiriesService: {
      get: async () => ({ success: true, data: inquiry('new', '2026-01-03T00:00:00Z') }),
      getAll: async (query) => { calls.filter = query.filter; calls.selected = query.select; return { success: true, data: [inquiry('old', '2026-01-02T00:00:00Z')] } },
    } },
    '../generated/services/Aur_productsesService': { Aur_productsesService: { get: async () => ({ success: true, data: { aur_duplicate_inquiry_criteria: template } }) } },
    '../generated/services/AccountsService': { AccountsService: { getAll: async () => ({ success: true, data: [{ accountid: 'insured', name: 'XYZ Airlines' }] }) } },
    '../generated/services/EmailsService': { EmailsService: { getAll: async () => ({ success: true, data: [] }) } },
    '../lib/inquiryDuplicates': logic,
    './inquiriesService': { getInquiryAiExtractedResponses: async (id) => { calls.extracted.push(id); return responses() } },
  })
  const result = await service.getInquiryDuplicateWarnings('new')
  assert.equal(result.state, 'ready')
  assert.equal(result.findings[0].status, 'potentialDuplicate')
  assert.equal(calls.filter, '_aur_line_of_business_value eq aviation')
  assert.equal(calls.selected.includes('aur_customer_information'), false)
  assert.deepEqual(calls.extracted.sort(), ['new', 'old'])
})

test('unconfigured rules stop before loading saved responses', async () => {
  const service = load('services/inquiryDuplicatesService.ts', {
    '../generated/services/Aur_inquiriesService': { Aur_inquiriesService: { get: async () => ({ success: true, data: { _aur_line_of_business_value: 'aviation' } }) } },
    '../generated/services/Aur_productsesService': { Aur_productsesService: { get: async () => ({ success: true, data: {} }) } },
    '../lib/inquiryDuplicates': logic,
  })
  assert.equal((await service.getInquiryDuplicateWarnings('new')).state, 'notConfigured')
})
