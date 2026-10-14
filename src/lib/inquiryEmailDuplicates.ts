import type { InquiryEmailSummary } from '../domain/app'

function emailKey(email: InquiryEmailSummary) {
  const normalized = (value?: string) => (value ?? '').trim().replace(/\s+/g, ' ')
  return JSON.stringify([
    normalized(email.regardingId).toLowerCase(),
    normalized(email.subject).toLowerCase() || email.id,
  ])
}

export function preferReceivedInquiryEmails(emails: InquiryEmailSummary[]): InquiryEmailSummary[] {
  const grouped = new Map<string, InquiryEmailSummary>()
  for (const email of emails) {
    const key = emailKey(email)
    const previous = grouped.get(key)
    if (!previous) {
      grouped.set(key, { ...email, attachments: [...email.attachments] })
      continue
    }
    const isReceived = (item: InquiryEmailSummary) => item.status?.trim().toLowerCase() === 'received'
    const preferred = isReceived(email) && !isReceived(previous) ? email : previous
    const attachments = [...previous.attachments]
    for (const attachment of email.attachments) {
      const exists = attachments.some((item) =>
        item.id === attachment.id ||
        (item.name === attachment.name && item.mimeType === attachment.mimeType && item.sizeLabel === attachment.sizeLabel),
      )
      if (!exists) attachments.push(attachment)
    }
    grouped.set(key, { ...preferred, attachments })
  }
  return [...grouped.values()].sort((left, right) => new Date(right.createdOn ?? 0).getTime() - new Date(left.createdOn ?? 0).getTime())
}
