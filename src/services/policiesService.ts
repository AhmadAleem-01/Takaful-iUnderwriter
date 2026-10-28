import { Aur_consequences_resultsService } from '../generated/services/Aur_consequences_resultsService'
import { Aur_quotesService } from '../generated/services/Aur_quotesService'
import { Aur_inquiriesService } from '../generated/services/Aur_inquiriesService'
import { Aur_policiesService } from '../generated/services/Aur_policiesService'
import { AccountsService } from '../generated/services/AccountsService'
import type { PolicyWorkspace } from '../domain/app'

export async function getPolicyWorkspace(id: string): Promise<PolicyWorkspace> {
  const [policyResult, inquiryResult, quotesResult, consequenceResults, accountsResult] = await Promise.all([
    Aur_policiesService.get(id),
    Aur_inquiriesService.getAll(),
    Aur_quotesService.getAll(),
    Aur_consequences_resultsService.getAll(),
    AccountsService.getAll(),
  ])

  const policy = policyResult.data
  if (!policy) throw new Error('Policy not found.')

  const inquiryId = normalizeDataverseId(policy._aur_inquiry_value)
  const customerId = normalizeDataverseId(policy._aur_customer_id_value)
  const inquiry = (inquiryResult.data ?? []).find((item) => normalizeDataverseId(item.aur_inquiryid) === inquiryId)
  const quote = (quotesResult.data ?? []).find((item) => normalizeDataverseId(item._aur_quotes_value) === inquiryId)
  const customer = (accountsResult.data ?? []).find((item) => normalizeDataverseId(item.accountid) === customerId)
  const reminderCount = inquiryId
    ? (consequenceResults.data ?? []).filter(
        (result) =>
          normalizeDataverseId(result._aur_inquiry_value) === inquiryId &&
          result.aur_actionname?.toLowerCase() === 'email',
      ).length
    : 0
  const expiryDate = policy.aur_expiry_date ?? ''

  return {
    id: policy.aur_policyid,
    policyNumber: policy.aur_policy_number ?? `POL-${policy.aur_policyid.slice(0, 8).toUpperCase()}`,
    customerName: policy.aur_customer_idname ?? customer?.name ?? inquiry?.aur_accountname ?? 'No customer linked',
    customerEmail: customer?.emailaddress1 ?? '',
    customerPhone: customer?.telephone1 ?? customer?.telephone2 ?? '',
    productName: policy.aur_productname ?? quote?.aur_productname ?? inquiry?.aur_productname ?? 'No Product Linked',
    productId: policy._aur_product_value,
    issueDate: policy.aur_issue_date ?? '',
    expiryDate,
    daysRemaining: expiryDate ? Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000) : 0,
    premiumAmount: policy.aur_premium_amount ?? quote?.aur_total_premium ?? 0,
    status: policy.statuscodename ?? policy.statecodename ?? 'Active',
    reminderSent: policy.aur_reminder_sent ?? false,
    reminderCount,
    notes: policy.aur_notes ?? '',
    inquiryId: policy._aur_inquiry_value,
    inquiryName: inquiry?.aur_name ?? inquiry?.aur_inquiry_number ?? policy.aur_inquiryname,
    quoteId: quote?.aur_quoteid,
    quoteName: quote?.aur_name,
  }
}

export async function savePolicyWorkspace(
  id: string,
  input: {
    issueDate: string
    expiryDate: string
    premiumAmount: number
    reminderSent: boolean
    notes: string
  },
) {
  await Aur_policiesService.update(id, {
    aur_issue_date: input.issueDate,
    aur_expiry_date: input.expiryDate,
    aur_premium_amount: input.premiumAmount,
    aur_reminder_sent: input.reminderSent,
    aur_notes: input.notes,
  })
}

function normalizeDataverseId(value?: string | null) {
  return (value ?? '').replace(/[{}]/g, '').trim().toLowerCase()
}
