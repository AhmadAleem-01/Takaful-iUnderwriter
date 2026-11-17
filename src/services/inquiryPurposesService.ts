import { getClient } from '@microsoft/power-apps/data'
import { dataSourcesInfo } from '../../.power/schemas/appschemas/dataSourcesInfo'

type InquiryPurpose = { aur_inquiry_purposeid: string; aur_name?: string }

const client = getClient(dataSourcesInfo)

export async function getInquiryPurposeOptions() {
  const result = await client.retrieveMultipleRecordsAsync<InquiryPurpose>(
    'aur_inquiry_purposes',
    { select: ['aur_inquiry_purposeid', 'aur_name'], orderBy: ['aur_name asc'] },
  )
  if (!result.success || result.error) throw new Error(result.error?.message || 'Unable to load inquiry purposes.')
  return (result.data ?? []).map((record) => ({ value: record.aur_inquiry_purposeid, label: record.aur_name ?? 'Unnamed purpose' }))
}
