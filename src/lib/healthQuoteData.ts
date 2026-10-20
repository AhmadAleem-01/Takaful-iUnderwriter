import type { InquiryDetail } from '../domain/app'
import { calculateMemberPremium, declaredMedicalConditions, evaluationNumber, evaluationObject, evaluationRows, evaluationText, memberEvaluationRows, parseHealthAiEvaluation } from './healthAiEvaluation'
import { customerObject, healthAnswer, healthChoice, parseHealthCustomerData, tpaNetworkPremiumAdjustment } from './healthInquiry'

export function healthQuoteData(inquiry: InquiryDetail) {
  const evaluation = parseHealthAiEvaluation(inquiry.aiEvaluationJsonResponse)
  const customer = parseHealthCustomerData(inquiry.customerData)
  const evaluatedMembers = evaluationRows(evaluation?.insuredMembers)
  const submittedMembers = [
    ...(customer && customer.applicant.insured !== false ? [{ ...customer.applicant, relationship: 'Applicant' }] : []),
    ...(customer?.members ?? []).filter((member) => member.insured !== false).map((member) => ({ ...customerObject(member.confirmedDetails), ...member })),
  ]
  const source = [...(evaluatedMembers.length ? evaluatedMembers : submittedMembers)].sort((left, right) => {
    const isApplicant = (person: Record<string, unknown>) => ['applicant', 'primary applicant', 'self'].includes(evaluationText(person.relationship, '').toLowerCase())
    return Number(isApplicant(right)) - Number(isApplicant(left))
  })
  const members = source.map((member) => {
    const premiums = memberEvaluationRows(evaluation?.memberPremiumBreakdown, member)[0] ?? {}
    // Only use a submitted premium when the member identity matches, never by array position.
    const name = evaluationText(member.memberName, evaluationText(member.fullName, ''))
    const nameMatches = name ? submittedMembers.filter((item) => evaluationText(item.fullName, '').trim().toLowerCase() === name.trim().toLowerCase()) : []
    const matchingSubmitted = nameMatches.length === 1 ? nameMatches[0] : undefined
    const premium = calculateMemberPremium({ ...premiums, basePremium: evaluationNumber(premiums.basePremium) ?? evaluationNumber(matchingSubmitted?.referencePremium) })
    return {
      id: evaluationText(member.memberId, evaluationText(member.id, name)),
      name: name || 'Insured member',
      relationship: healthChoice(member.relationship),
      age: healthAnswer(member.age),
      gender: healthChoice(member.gender),
      conditions: declaredMedicalConditions(member.declaredConditions).map((finding) => finding.condition),
      premium,
    }
  })
  return {
    members,
    applicantName: healthAnswer(customer?.applicant.fullName),
    applicantAge: healthAnswer(customer?.applicant.age),
    applicantGender: healthChoice(customer?.applicant.gender),
    email: healthAnswer(customer?.applicant.email),
    mobile: healthAnswer(customer?.applicant.mobile),
    coverage: healthChoice(customer?.coverageTarget),
    emirate: healthAnswer(customer?.visaEmirate),
    tpa: inquiry.tpa || 'Not provided',
    network: inquiry.tpaNetworkLabel || 'Not provided',
    networkAdjustment: tpaNetworkPremiumAdjustment(inquiry.tpaNetworkLabel),
    policyPremium: evaluationObject(evaluation?.policyPremiumBreakdown),
    premiumToCharge: inquiry.totalCharge,
  }
}
