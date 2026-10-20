import { Aur_consequences_resultsService } from '../generated/services/Aur_consequences_resultsService'
import { Aur_quotesService } from '../generated/services/Aur_quotesService'
import { Cr058_policiesService } from '../generated/services/Cr058_policiesService'
import type { RenewalSummary } from '../domain/app'

export async function listRenewals(): Promise<RenewalSummary[]> {
  const [policiesResult, quotesResult, consequenceResults] = await Promise.all([
    Cr058_policiesService.getAll({
      orderBy: ['cr058_expirydate asc'],
    }),
    Aur_quotesService.getAll(),
    Aur_consequences_resultsService.getAll(),
  ])

  const policies = policiesResult.data ?? []
  const quotes = quotesResult.data ?? []
  const results = consequenceResults.data ?? []
  return policies.map((policy) => {
    const linkedInquiryId = policy._cr058_inquiry_value
    const linkedQuote = linkedInquiryId
      ? quotes.find((quote) => quote._aur_quotes_value === linkedInquiryId)
      : undefined
    const reminderCount = linkedInquiryId
      ? results.filter(
          (result) =>
            result._aur_inquiry_value === linkedInquiryId &&
            result.aur_actionname?.toLowerCase() === 'email',
        ).length
      : 0
    const expiryDate = new Date(policy.cr058_expirydate)
    const daysRemaining = Math.ceil((expiryDate.getTime() - Date.now()) / 86400000)

    return {
      id: policy.cr058_policyid,
      policyNumber: policy.cr058_policynumber,
      client: policy.cr058_customername,
      product: policy.cr058_productname ?? linkedQuote?.aur_productname ?? 'No Product Linked',
      expiryDate: policy.cr058_expirydate,
      daysRemaining,
      status: buildRenewalStatus(daysRemaining),
      reminderCount,
      reminderSent: policy.cr058_remindersent ?? false,
      premiumTotal: policy.cr058_premiumamount ?? linkedQuote?.aur_total_premium ?? 0,
      inquiryId: linkedInquiryId,
      quoteId: linkedQuote?.aur_quoteid,
    }
  })
}

export async function createRenewalReminder(policyId: string, inquiryId: string, policyNumber: string) {
  await Aur_consequences_resultsService.create({
    aur_name: `Reminder Sent - ${policyNumber}`,
    aur_action: 10,
    aur_type: 2,
    'aur_inquiry@odata.bind': `/aur_quoteses(${inquiryId})`,
  } as never)
  await Cr058_policiesService.update(policyId, {
    cr058_remindersent: true,
  })
}

function buildRenewalStatus(daysRemaining: number) {
  if (daysRemaining < 0) return 'Overdue'
  if (daysRemaining <= 7) return 'Due Soon'
  if (daysRemaining <= 30) return 'Due in 30 Days'
  return 'Monitored'
}
