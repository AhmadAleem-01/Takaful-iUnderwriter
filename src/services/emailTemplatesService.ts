import { TemplatesService } from '../generated/services/TemplatesService'
import { Templatestemplatetypecode, type Templates } from '../generated/models/TemplatesModel'

type NativeTemplateCategory = (typeof Templatestemplatetypecode)[keyof typeof Templatestemplatetypecode]
export type TemplateCategory = Exclude<NativeTemplateCategory, 'User'> | 'Global'

const TABLE_NAMES: Record<TemplateCategory, string> = {
  Account: 'account', Contact: 'contact', SystemJob: 'asyncoperation', Global: 'systemuser',
  Lead: 'lead', CampaignActivity: 'campaignactivity', Case: 'incident', Contract: 'contract',
  ServiceActivity: 'serviceappointment', Entitlement: 'entitlement', Opportunity: 'opportunity',
  Quote: 'quote', Order: 'salesorder', Invoice: 'invoice',
}

function removeLegacyCategoryTag(description: string): string {
  // Clean up tags written by the previous Inquiry category implementation.
  return description.replace(/^(?:\[InsureAI:category=Inquiry\](?:\r?\n|$))+/, '')
}

export function emailTemplateDescription(record: Templates): string {
  return removeLegacyCategoryTag(record.description ?? '')
}

export const EMAIL_TEMPLATE_CATEGORY_OPTIONS = (Object.keys(TABLE_NAMES) as TemplateCategory[])
  .map((category) => ({ value: category, label: category }))

export function emailTemplateCategory(record: Templates): TemplateCategory {
  const value = String(record.templatetypecode)
  const category = Object.entries(TABLE_NAMES).find(([, table]) => table === value)?.[0]
  const nativeCategory = Templatestemplatetypecode[record.templatetypecode]
  return (category as TemplateCategory | undefined)
    ?? (nativeCategory === 'User' ? 'Global' : nativeCategory)
    ?? record.templatetypecodename as TemplateCategory
}

export async function saveEmailTemplate(draft: {
  id?: string
  templateName: string
  subject: string
  description: string
  body: string
  categoryKey: TemplateCategory | ''
}) {
  if (!draft.categoryKey || !Object.hasOwn(TABLE_NAMES, draft.categoryKey)) {
    throw new Error('Select a valid template category.')
  }
  const description = removeLegacyCategoryTag(draft.description).trim()
  if (description.length > 2000) {
    throw new Error('Template description is too long. Shorten it before saving.')
  }
  const payload = {
    title: draft.templateName.trim(),
    subjectsafehtml: draft.subject.trim(),
    description,
    safehtml: draft.body,
    languagecode: 1033,
    ispersonal: false,
    // EntityNameType is a logical table name in the Web API. The generated model
    // incorrectly describes it as a numeric choice; keep the workaround here.
    templatetypecode: TABLE_NAMES[draft.categoryKey],
  }
  const result = draft.id
    ? await TemplatesService.update(draft.id, payload as unknown as Parameters<typeof TemplatesService.update>[1])
    : await TemplatesService.create(payload as unknown as Parameters<typeof TemplatesService.create>[0])
  if (!result.success || result.error) {
    throw new Error(result.error?.message || 'Dataverse could not save the email template.')
  }
  if (!draft.id && !result.data?.templateid) {
    throw new Error('Dataverse did not return a template ID. Refresh the template list before retrying to avoid duplicates.')
  }
  return result.data
}
