import { parseAiSummary } from './aiResponsePresentation'

export function quoteSummaryText(storedValue: string): string {
  return parseAiSummary(storedValue).summary
}

export function saveQuoteSummaryText(storedValue: string, editedText: string): string {
  if (editedText === quoteSummaryText(storedValue)) return storedValue

  try {
    const parsed: unknown = JSON.parse(storedValue)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && typeof (parsed as Record<string, unknown>).summary === 'string') {
      return JSON.stringify({ ...parsed, summary: editedText })
    }
  } catch {
    // Plain-text summaries can be saved directly.
  }

  return editedText
}
