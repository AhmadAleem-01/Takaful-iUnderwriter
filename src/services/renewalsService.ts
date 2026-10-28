import { Aur_consequences_resultsService } from '../generated/services/Aur_consequences_resultsService'
import { Aur_quotesService } from '../generated/services/Aur_quotesService'
import { Aur_policiesService } from '../generated/services/Aur_policiesService'
import type { RenewalSummary } from '../domain/app'

export async function listRenewals(): Promise<RenewalSummary[]> {
  const [policiesResult, quotesResult, consequenceResults] = await Promise.all([
    Aur_policiesService.getAll({
      orderBy: ['aur_expiry_date asc'],
    }),
    Aur_quotesService.getAll(),
    Aur_consequences_resultsService.getAll(),
  ])

  const policies = policiesResult.data ?? []
  const quotes = quotesResult.data ?? []
  const results = consequenceResults.data ?? []
  return policies.map((policy) => {
    const linkedInquiryId = policy._aur_inquiry_value
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
    const expiryValue = policy.aur_expiry_date ?? ''
    const expiryDate = new Date(expiryValue)
    const daysRemaining = Math.ceil((expiryDate.getTime() - Date.now()) / 86400000)

    return {
      id: policy.aur_policyid,
      policyNumber: policy.aur_policy_number ?? `POL-${policy.aur_policyid.slice(0, 8).toUpperCase()}`,
      client: policy.aur_customer_idname ?? 'No customer linked',
      product: policy.aur_productname ?? linkedQuote?.aur_productname ?? 'No Product Linked',
      expiryDate: expiryValue,
      daysRemaining,
      status: buildRenewalStatus(daysRemaining),
      reminderCount,
      reminderSent: policy.aur_reminder_sent ?? false,
      premiumTotal: policy.aur_premium_amount ?? linkedQuote?.aur_total_premium ?? 0,
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
    'aur_inquiry@odata.bind': `/aur_inquiries(${inquiryId})`,
  } as never)
  await Aur_policiesService.update(policyId, {
    aur_reminder_sent: true,
  })
}

function buildRenewalStatus(daysRemaining: number) {
  if (daysRemaining < 0) return 'Overdue'
  if (daysRemaining <= 7) return 'Due Soon'
  if (daysRemaining <= 30) return 'Due in 30 Days'
  return 'Monitored'
}
