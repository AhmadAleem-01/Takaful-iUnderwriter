import { Aur_consequences_resultsService } from '../generated/services/Aur_consequences_resultsService'
import { Aur_quotesService } from '../generated/services/Aur_quotesService'
import { Aur_quotesesService } from '../generated/services/Aur_quotesesService'
import { Cr058_policiesService } from '../generated/services/Cr058_policiesService'
import type { PolicyWorkspace } from '../domain/app'

export async function getPolicyWorkspace(id: string): Promise<PolicyWorkspace> {
  const [policyResult, inquiryResult, quotesResult, consequenceResults] = await Promise.all([
    Cr058_policiesService.get(id),
    Aur_quotesesService.getAll(),
    Aur_quotesService.getAll(),
    Aur_consequences_resultsService.getAll(),
  ])

  const policy = policyResult.data
  if (!policy) throw new Error('Policy not found.')

  const inquiry = (inquiryResult.data ?? []).find((item) => item.aur_quotesid === policy._cr058_inquiry_value)
  const quote = (quotesResult.data ?? []).find((item) => item._aur_quotes_value === policy._cr058_inquiry_value)
  const reminderCount = policy._cr058_inquiry_value
    ? (consequenceResults.data ?? []).filter(
        (result) =>
          result._aur_inquiry_value === policy._cr058_inquiry_value &&
          result.aur_actionname?.toLowerCase() === 'email',
      ).length
    : 0

  return {
    id: policy.cr058_policyid,
    policyNumber: policy.cr058_policynumber,
    customerName: policy.cr058_customername,
    customerEmail: policy.cr058_customeremail ?? '',
    customerPhone: policy.cr058_customerphone ?? '',
    productName: policy.cr058_productname ?? quote?.aur_productname ?? inquiry?.aur_productname ?? 'No Product Linked',
    productId: policy._cr058_product_value,
    issueDate: policy.cr058_issuedate,
    expiryDate: policy.cr058_expirydate,
    daysRemaining: Math.ceil((new Date(policy.cr058_expirydate).getTime() - Date.now()) / 86400000),
    premiumAmount: policy.cr058_premiumamount ?? quote?.aur_total_premium ?? 0,
    status: policy.cr058_status ?? policy.statuscodename ?? policy.statecodename ?? 'Active',
    reminderSent: policy.cr058_remindersent ?? false,
    reminderCount,
    notes: policy.cr058_notes ?? '',
    inquiryId: policy._cr058_inquiry_value,
    inquiryName: inquiry?.aur_name ?? inquiry?.aur_quote_number ?? policy.cr058_inquiryname,
    quoteId: quote?.aur_quoteid,
    quoteName: quote?.aur_name,
  }
}

export async function savePolicyWorkspace(
  id: string,
  input: {
    customerName: string
    customerEmail: string
    customerPhone: string
    issueDate: string
    expiryDate: string
    premiumAmount: number
    status: string
    reminderSent: boolean
    notes: string
  },
) {
  await Cr058_policiesService.update(id, {
    cr058_customername: input.customerName,
    cr058_customeremail: input.customerEmail,
    cr058_customerphone: input.customerPhone,
    cr058_issuedate: input.issueDate,
    cr058_expirydate: input.expiryDate,
    cr058_premiumamount: input.premiumAmount,
    cr058_status: input.status,
    cr058_remindersent: input.reminderSent,
    cr058_notes: input.notes,
  })
}
