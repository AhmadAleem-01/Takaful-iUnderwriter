import {
  Aur_business_rulesesService,
  Aur_consequencesesService,
  Aur_custom_document_templatesesService,
  TemplatesService,
} from '../generated'
import { Aur_business_rulesesaur_categories } from '../generated/models/Aur_business_rulesesModel'
import type { Aur_consequenceses } from '../generated/models/Aur_consequencesesModel'
import { INQUIRY_TYPE_OPTIONS } from './inquiryTypeOptions'

export interface BusinessRuleListItem {
  id: string
  name: string
  categoryLabel: string
  parentRuleName: string
  inquiryTypeLabel: string
  inquiryTypeValue: string
  status: string
  identifier: string
  consequenceCount: number
  createdOn?: string
}

export interface BusinessRuleWorkspace {
  rule?: {
    id: string
    name: string
    categoryValue: string
    parentRuleId: string
    inquiryTypeValue: string
    parentRuleName: string
    status: string
    createdOn?: string
    modifiedOn?: string
  }
  rules: Array<{
    id: string
    name: string
    categoryValue: string
    categoryLabel: string
    parentRuleId: string
    parentRuleName: string
  }>
  parentRuleOptions: Array<{
    value: string
    label: string
  }>
  documentTemplateOptions: Array<{
    value: string
    label: string
  }>
  emailTemplateOptions: Array<{
    value: string
    label: string
  }>
  consequences: BusinessRuleConsequence[]
}

export interface BusinessRuleConsequence {
  id: string
  name: string
  typeValue: string
  typeLabel: string
  actionValue: string
  actionLabel: string
  notificationText: string
  riskScore: string
  riskSummary: string
  ratingAdd: string
  ratingMultiply: string
  documentTemplateId: string
  documentTemplateName: string
  emailTemplateId: string
  emailTemplateName: string
  businessRuleId: string
  businessRuleName: string
  createdOn?: string
  modifiedOn?: string
}

export interface SaveBusinessRuleInput {
  id?: string
  name: string
  categoryValue?: string
  parentRuleId?: string
  inquiryTypeValue?: string
}

export interface SaveConsequenceInput {
  id?: string
  businessRuleId: string
  typeValue: string
  actionValue?: string
  notificationText?: string
  riskScore?: string
  riskSummary?: string
  ratingAdd?: string
  ratingMultiply?: string
  documentTemplateId?: string
  emailTemplateId?: string
}

export interface BusinessRuleImportIssue {
  rowNumber: number
  message: string
}

export interface BusinessRuleImportResult {
  createdIds: string[]
  createdNames: string[]
  confirmedNames: string[]
  missingNames: string[]
  issues: BusinessRuleImportIssue[]
  processedRows: number
}

export const BUSINESS_RULE_CATEGORY_OPTIONS = [
  { value: '1', label: 'Eligibility & Appetite' },
  { value: '2', label: 'Domicile' },
  { value: '3', label: 'Submission Completeness' },
  { value: '4', label: 'Risk' },
  { value: '5', label: 'History' },
  { value: '6', label: 'Financial & Capacity Limits' },
  { value: '7', label: 'Contractual Terms & Clauses' },
] as const

export const BUSINESS_RULE_INQUIRY_TYPE_OPTIONS = INQUIRY_TYPE_OPTIONS.map((option) => ({
  value: String(option.value),
  label: option.label,
}))

export const CONSEQUENCE_TYPE_OPTIONS = [
  { value: '1', label: 'Case Control' },
  { value: '2', label: 'Notification' },
  { value: '3', label: 'Document' },
  { value: '4', label: 'Risk' },
  { value: '5', label: 'Email' },
  { value: '6', label: 'Rating' },
] as const

export const CONSEQUENCE_ACTION_OPTIONS = [
  { value: '1', label: 'Decline' },
  { value: '2', label: 'Refer to Underwriter' },
  { value: '3', label: 'Escalate to Head of Aviation' },
  { value: '4', label: 'Property or Reinsurance Team' },
  { value: '5', label: 'Request Missing Information' },
  { value: '6', label: 'Document' },
  { value: '7', label: 'Generate Decline Letter' },
  { value: '8', label: 'Generate Notice of Cancellation' },
  { value: '9', label: 'Update Risk Score' },
  { value: '751820001', label: 'Update Risk Summary' },
  { value: '10', label: 'Email' },
  { value: '751820002', label: 'Add' },
  { value: '751820003', label: 'Multiply' },
] as const

export const CONSEQUENCE_ACTIONS_BY_TYPE: Record<string, string[]> = {
  '1': ['1', '2', '3', '4'],
  '2': ['5'],
  '3': ['6'],
  '4': ['9', '751820001'],
  '5': ['10'],
  '6': ['751820002', '751820003'],
}

const PROPERTY_RULE_EXCLUSIONS = new Set([
  'Inclusion Rules',
  'Exclusion Rules',
  'Inquiry',
  'Risk Assessment Score',
])

export async function getBusinessRulesCatalog() {
  const [rulesResult, consequencesResult] = await Promise.all([
    Aur_business_rulesesService.getAll(),
    Aur_consequencesesService.getAll(),
  ])

  const rules = rulesResult.data ?? []
  const consequences = consequencesResult.data ?? []
  const ruleNameById = new Map(
    rules.map((rule) => [normalizeDataverseId(rule.aur_business_rulesid), rule.aur_name]),
  )
  const consequenceCountByRule = consequences.reduce((map, consequence) => {
    const ruleId = normalizeDataverseId(consequence._aur_business_rule_value)
    if (!ruleId) return map
    map.set(ruleId, (map.get(ruleId) ?? 0) + 1)
    return map
  }, new Map<string, number>())

  return rules
    .map((rule) => ({
      id: rule.aur_business_rulesid,
      name: rule.aur_name,
      categoryLabel: resolveRuleCategoryLabel(rule.aur_categories),
      parentRuleName:
        (rule._aur_properties_value
          ? ruleNameById.get(normalizeDataverseId(rule._aur_properties_value))
          : undefined) ??
        rule.aur_propertiesname ??
        '',
      inquiryTypeLabel:
        BUSINESS_RULE_INQUIRY_TYPE_OPTIONS.find(
          (option) => option.value === getBusinessRuleInquiryTypeValue(rule as unknown as { aur_inquiry_type?: unknown }),
        )?.label ?? 'All inquiry types',
      inquiryTypeValue: getBusinessRuleInquiryTypeValue(rule as unknown as { aur_inquiry_type?: unknown }),
      status: rule.statuscodename ?? 'Active',
      identifier: shortIdentifier(rule.aur_business_rulesid),
      consequenceCount: consequenceCountByRule.get(normalizeDataverseId(rule.aur_business_rulesid)) ?? 0,
      createdOn: rule.createdon,
    }))
    .sort((left, right) => {
      const leftTime = left.createdOn ? new Date(left.createdOn).getTime() : 0
      const rightTime = right.createdOn ? new Date(right.createdOn).getTime() : 0
      return rightTime - leftTime
    })
}

export async function getBusinessRuleWorkspace(ruleId?: string): Promise<BusinessRuleWorkspace> {
  const [rulesResult, consequencesResult, documentTemplatesResult, emailTemplatesResult] = await Promise.all([
    Aur_business_rulesesService.getAll(),
    Aur_consequencesesService.getAll(),
    Aur_custom_document_templatesesService.getAll().catch(() => ({ data: [] })),
    TemplatesService.getAll().catch(() => ({ data: [] })),
  ])

  const rules = rulesResult.data ?? []
  const consequences = consequencesResult.data ?? []
  const documentTemplates = documentTemplatesResult.data ?? []
  const emailTemplates = emailTemplatesResult.data ?? []
  const currentRule = ruleId
    ? rules.find((rule) => normalizeDataverseId(rule.aur_business_rulesid) === normalizeDataverseId(ruleId))
    : undefined

  const normalizedRules = rules
    .map((rule) => ({
      id: rule.aur_business_rulesid,
      name: rule.aur_name,
      categoryValue: rule.aur_categories ? String(rule.aur_categories) : '',
      inquiryTypeValue: getBusinessRuleInquiryTypeValue(rule as unknown as { aur_inquiry_type?: unknown }),
      categoryLabel: resolveRuleCategoryLabel(rule.aur_categories),
      parentRuleId: rule._aur_properties_value ?? '',
      parentRuleName: rule.aur_propertiesname ?? '',
    }))
    .sort((left, right) => left.name.localeCompare(right.name))

  const parentRuleOptions = normalizedRules
    .filter((rule) => rule.id !== currentRule?.aur_business_rulesid)
    .filter((rule) => !rule.parentRuleId)
    .filter((rule) => !PROPERTY_RULE_EXCLUSIONS.has(rule.name))
    .map((rule) => ({
      value: rule.id,
      label: rule.name,
    }))

  const workspaceConsequences = consequences
    .filter(
      (consequence) =>
        normalizeDataverseId(consequence._aur_business_rule_value) ===
        normalizeDataverseId(currentRule?.aur_business_rulesid),
    )
    .map((consequence) => mapConsequence(consequence))
    .sort((left, right) => left.name.localeCompare(right.name))

  return {
    rule: currentRule
      ? {
          id: currentRule.aur_business_rulesid,
          name: currentRule.aur_name,
          categoryValue: currentRule.aur_categories ? String(currentRule.aur_categories) : '',
          inquiryTypeValue: getBusinessRuleInquiryTypeValue(
            currentRule as unknown as { aur_inquiry_type?: unknown },
          ),
          parentRuleId: currentRule._aur_properties_value ?? '',
          parentRuleName: currentRule.aur_propertiesname ?? '',
          status: currentRule.statuscodename ?? 'Active',
          createdOn: currentRule.createdon,
          modifiedOn: currentRule.modifiedon,
        }
      : undefined,
    rules: normalizedRules,
    parentRuleOptions,
    documentTemplateOptions: documentTemplates
      .filter((item) => Number(item.statuscode ?? 1) === 1)
      .map((item) => ({
        value: item.aur_custom_document_templatesid,
        label: item.aur_name ?? 'Untitled template',
      }))
      .sort((left, right) => left.label.localeCompare(right.label)),
    emailTemplateOptions: emailTemplates
      .filter((item) => item.componentstate === 0)
      .map((item) => ({
        value: item.templateid,
        label: item.title,
      }))
      .sort((left, right) => left.label.localeCompare(right.label)),
    consequences: workspaceConsequences,
  }
}

export async function saveBusinessRule(input: SaveBusinessRuleInput) {
  const payload = {
    aur_name: input.name.trim(),
    ...(input.categoryValue ? { aur_categories: Number(input.categoryValue) as keyof typeof Aur_business_rulesesaur_categories } : {}),
    ...(input.inquiryTypeValue ? { aur_inquiry_type: Number(input.inquiryTypeValue) } : { aur_inquiry_type: null }),
    ...(input.parentRuleId ? { 'aur_properties@odata.bind': `/aur_business_ruleses(${input.parentRuleId})` } : { 'aur_properties@odata.bind': null }),
  }

  if (input.id) {
    await Aur_business_rulesesService.update(input.id, payload as never)
    return input.id
  }

  const created = await Aur_business_rulesesService.create(payload as never)
  const createdId = created.data?.aur_business_rulesid
  if (!createdId) {
    throw new Error('Business rule was created, but no record id was returned.')
  }
  return createdId
}

export async function importBusinessRulesWorkbook(file: File): Promise<BusinessRuleImportResult> {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const firstSheet = workbook.SheetNames[0]

  if (!firstSheet) {
    throw new Error('The uploaded workbook does not contain any sheets.')
  }

  const worksheet = workbook.Sheets[firstSheet]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' })

  if (!rows.length) {
    throw new Error('The uploaded workbook is empty. Add at least one business rule row.')
  }

  const [workspace, existingCatalog] = await Promise.all([
    getBusinessRuleWorkspace(),
    getBusinessRulesCatalog(),
  ])
  const existingNames = new Set(existingCatalog.map((item) => normalizeImportHeader(item.name)))
  const createdIds: string[] = []
  const createdNames: string[] = []
  const issues: BusinessRuleImportIssue[] = []
  let processedRows = 0

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2
    const ruleName = getImportCellValue(row, ['Rule Name', 'Rule', 'Name'])

    if (!ruleName) {
      continue
    }

    processedRows += 1

    try {
      const categoryValue = resolveImportOptionValue(
        getImportCellValue(row, ['Category Value']),
        getImportCellValue(row, ['Category']),
        BUSINESS_RULE_CATEGORY_OPTIONS,
        'Category',
      )
      const inquiryTypeValue = resolveImportOptionValue(
        getImportCellValue(row, ['Inquiry Type Value']),
        getImportCellValue(row, ['Inquiry Type']),
        BUSINESS_RULE_INQUIRY_TYPE_OPTIONS,
        'Inquiry Type',
      )
      const propertyRuleId = resolvePropertyRuleId(
        getImportCellValue(row, ['Property Rule Name', 'Property']),
        workspace.parentRuleOptions,
      )

      const createdId = await saveBusinessRule({
        name: ruleName,
        categoryValue,
        parentRuleId: propertyRuleId,
        inquiryTypeValue,
      })

      createdIds.push(createdId)
      createdNames.push(ruleName)
    } catch (cause) {
      issues.push({
        rowNumber,
        message: cause instanceof Error ? cause.message : 'Unable to create the business rule from this row.',
      })
    }
  }

  if (!processedRows) {
    throw new Error('No data rows were found. Add values under the template headers and upload again.')
  }

  const confirmedNames = await verifyImportedBusinessRules(createdNames, existingNames)
  const missingNames = createdNames.filter(
    (name) => !confirmedNames.some((confirmedName) => normalizeImportHeader(confirmedName) === normalizeImportHeader(name)),
  )

  return {
    createdIds,
    createdNames,
    confirmedNames,
    missingNames,
    issues,
    processedRows,
  }
}

export async function saveBusinessRuleConsequence(input: SaveConsequenceInput) {
  const effectiveActionValue =
    input.typeValue === '3'
      ? '6'
      : input.typeValue === '5'
        ? '10'
        : input.actionValue

  const actionLabel = resolveConsequenceActionLabel(effectiveActionValue)
  const payload: Record<string, unknown> = {
    aur_name: actionLabel,
    ...(effectiveActionValue ? { aur_action: Number(effectiveActionValue) } : {}),
    aur_type: Number(input.typeValue) as never,
    aur_notification_text: requiresNotificationText(effectiveActionValue)
      ? input.notificationText?.trim() || undefined
      : undefined,
    aur_riskscore:
      effectiveActionValue === '9' && input.riskScore?.trim()
        ? Number(input.riskScore)
        : null,
    aur_risksummary:
      effectiveActionValue === '751820001'
        ? input.riskSummary?.trim() || null
        : null,
    aur_add:
      effectiveActionValue === '751820002' && input.ratingAdd?.trim()
        ? Number(input.ratingAdd)
        : null,
    aur_multiply:
      effectiveActionValue === '751820003' && input.ratingMultiply?.trim()
        ? Number(input.ratingMultiply)
        : null,
    'aur_DocumentTemplate@odata.bind':
      input.typeValue === '3' && input.documentTemplateId
        ? `/aur_custom_document_templateses(${input.documentTemplateId})`
        : null,
    'aur_EmailTemplate@odata.bind':
      input.typeValue === '5' && input.emailTemplateId
        ? `/templates(${input.emailTemplateId})`
        : null,
    ...(input.id ? {} : { 'aur_business_rule@odata.bind': `/aur_business_ruleses(${input.businessRuleId})` }),
  }

  if (input.id) {
    await Aur_consequencesesService.update(input.id, payload as never)
    return input.id
  }

  const created = await Aur_consequencesesService.create({
    ...payload,
    'aur_business_rule@odata.bind': `/aur_business_ruleses(${input.businessRuleId})`,
  } as never)
  const createdId = created.data?.aur_consequencesid
  if (!createdId) {
    throw new Error('Consequence was created, but no record id was returned.')
  }
  return createdId
}

export async function deleteBusinessRuleConsequence(id: string) {
  await Aur_consequencesesService.delete(id)
}

export function resolveRuleCategoryLabel(value?: string | number) {
  if (value === undefined || value === null || value === '') return 'Uncategorized'
  const match = BUSINESS_RULE_CATEGORY_OPTIONS.find((option) => option.value === String(value))
  return match?.label ?? humanizeToken(Aur_business_rulesesaur_categories[value as keyof typeof Aur_business_rulesesaur_categories] ?? String(value))
}

export function resolveConsequenceTypeLabel(value?: string | number) {
  if (value === undefined || value === null || value === '') return 'Unknown type'
  return (
    CONSEQUENCE_TYPE_OPTIONS.find((option) => option.value === String(value))?.label ??
    humanizeToken(String(value))
  )
}

export function resolveConsequenceActionLabel(value?: string | number) {
  if (value === undefined || value === null || value === '') return 'Unknown action'
  return (
    CONSEQUENCE_ACTION_OPTIONS.find((option) => option.value === String(value))?.label ??
    humanizeToken(String(value))
  )
}

export function requiresNotificationText(actionValue?: string) {
  return actionValue === '5'
}

function mapConsequence(consequence: Aur_consequenceses): BusinessRuleConsequence {
  const consequenceRecord = consequence as Aur_consequenceses & {
    aur_riskscore?: number | string | null
    aur_risksummary?: string | null
    aur_add?: number | string | null
    aur_multiply?: number | string | null
    aur_emailtemplatename?: string
    _aur_emailtemplate_value?: string
  }
  return {
    id: consequence.aur_consequencesid,
    name: consequence.aur_name || resolveConsequenceActionLabel(consequence.aur_action),
    typeValue: consequence.aur_type ? String(consequence.aur_type) : '',
    typeLabel: consequence.aur_typename || resolveConsequenceTypeLabel(consequence.aur_type),
    actionValue: consequence.aur_action ? String(consequence.aur_action) : '',
    actionLabel: consequence.aur_actionname || resolveConsequenceActionLabel(consequence.aur_action),
    notificationText: consequence.aur_notification_text ?? '',
    riskScore:
      consequenceRecord.aur_riskscore === undefined || consequenceRecord.aur_riskscore === null
        ? ''
        : String(consequenceRecord.aur_riskscore),
    riskSummary: consequenceRecord.aur_risksummary ?? '',
    ratingAdd:
      consequenceRecord.aur_add === undefined || consequenceRecord.aur_add === null
        ? ''
        : String(consequenceRecord.aur_add),
    ratingMultiply:
      consequenceRecord.aur_multiply === undefined || consequenceRecord.aur_multiply === null
        ? ''
        : String(consequenceRecord.aur_multiply),
    documentTemplateId: consequence._aur_documenttemplate_value ?? '',
    documentTemplateName: consequence.aur_documenttemplatename ?? '',
    emailTemplateId: consequenceRecord._aur_emailtemplate_value ?? '',
    emailTemplateName: consequenceRecord.aur_emailtemplatename ?? '',
    businessRuleId: consequence._aur_business_rule_value ?? '',
    businessRuleName: consequence.aur_business_rulename ?? 'Business Rule',
    createdOn: consequence.createdon,
    modifiedOn: consequence.modifiedon,
  }
}

function shortIdentifier(id: string) {
  return id.replace(/[{}]/g, '').slice(0, 8).toUpperCase()
}

function humanizeToken(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
}

function getBusinessRuleInquiryTypeValue(rule: { aur_inquiry_type?: unknown }) {
  const rawValue = rule.aur_inquiry_type
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return ''
  }
  return String(rawValue)
}

function normalizeDataverseId(value?: string | null) {
  return value?.replace(/[{}]/g, '').toLowerCase() ?? ''
}

function getImportCellValue(row: Record<string, unknown>, headerCandidates: string[]) {
  const entries = Object.entries(row)
  for (const header of headerCandidates) {
    const normalizedHeader = normalizeImportHeader(header)
    const match = entries.find(([key]) => normalizeImportHeader(key) === normalizedHeader)
    if (!match) continue
    const value = String(match[1] ?? '').trim()
    if (value) {
      return value
    }
  }
  return ''
}

function resolveImportOptionValue(
  explicitValue: string,
  labelValue: string,
  options: readonly { value: string; label: string }[],
  fieldLabel: string,
) {
  if (explicitValue) {
    const matchedByValue = options.find((option) => option.value === explicitValue.trim())
    if (matchedByValue) {
      return matchedByValue.value
    }
    throw new Error(`${fieldLabel} value "${explicitValue}" is not valid.`)
  }

  if (labelValue) {
    const normalizedLabel = normalizeImportHeader(labelValue)
    const matchedByLabel = options.find(
      (option) => normalizeImportHeader(option.label) === normalizedLabel,
    )
    if (matchedByLabel) {
      return matchedByLabel.value
    }
    throw new Error(`${fieldLabel} label "${labelValue}" is not valid.`)
  }

  return ''
}

function resolvePropertyRuleId(
  propertyName: string,
  propertyOptions: Array<{ value: string; label: string }>,
) {
  if (!propertyName) return ''
  const normalizedName = normalizeImportHeader(propertyName)
  const matchedOption = propertyOptions.find(
    (option) => normalizeImportHeader(option.label) === normalizedName || normalizeDataverseId(option.value) === normalizeDataverseId(propertyName),
  )

  if (!matchedOption) {
    throw new Error(`Property "${propertyName}" is not available in the current Business Rule setup.`)
  }

  return matchedOption.value
}

function normalizeImportHeader(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

async function verifyImportedBusinessRules(createdNames: string[], existingNames: Set<string>) {
  if (!createdNames.length) return []

  const targetNames = createdNames.map((name) => normalizeImportHeader(name))
  let confirmed = new Set<string>()

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const catalog = await getBusinessRulesCatalog()
    confirmed = new Set(
      catalog
        .map((item) => item.name)
        .filter((name) => {
          const normalizedName = normalizeImportHeader(name)
          return targetNames.includes(normalizedName) && !existingNames.has(normalizedName)
        }),
    )

    if (confirmed.size >= createdNames.length) {
      break
    }

    await delay(700)
  }

  return Array.from(confirmed)
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}
