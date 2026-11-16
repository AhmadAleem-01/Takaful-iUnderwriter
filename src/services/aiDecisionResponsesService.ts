import { Aur_ai_decision_responsesService } from '../generated/services/Aur_ai_decision_responsesService'
import type { Aur_ai_decision_responses } from '../generated/models/Aur_ai_decision_responsesModel'
import { latestAiDecisionSuggestions } from '../lib/aiDecisionResponse'

export async function getInquiryAiDecisionSuggestions(id: string) {
  const inquiryId = id.replace(/[{}]/g, '').toLowerCase()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(inquiryId)) {
    throw new Error('A valid inquiry ID is required to load AI suggestions.')
  }
  const records: Aur_ai_decision_responses[] = []
  let skipToken: string | undefined
  do {
    const result = await Aur_ai_decision_responsesService.getAll({
      filter: `_aur_ref_id_value eq ${inquiryId} and statecode eq 0`,
      select: ['aur_ai_decision_responseid', 'aur_decision_category', 'aur_ai_decision_response_json', 'createdon'],
      orderBy: ['createdon desc', 'aur_ai_decision_responseid desc'],
      maxPageSize: 500,
      ...(skipToken ? { skipToken } : {}),
    })
    if (!result.success || result.error) throw new Error(result.error?.message || 'Unable to load AI suggestions.')
    records.push(...(result.data ?? []))
    skipToken = result.skipToken
  } while (skipToken)
  return { inquiryId, suggestions: latestAiDecisionSuggestions(records) }
}
