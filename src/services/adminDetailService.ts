import {
  AccountsService,
  BusinessunitsService,
  ContactsService,
  SystemusersService,
  Aur_custom_document_templatesesService,
} from '../generated'
import type { AdminDetailRecord, AdminEntityKey, DocumentTemplateSummary } from '../domain/app'

export async function getAdminDetail(entity: Extract<AdminEntityKey, 'business-units' | 'users' | 'accounts' | 'contacts'>, id: string): Promise<AdminDetailRecord> {
  if (entity === 'business-units') {
    const record = (await BusinessunitsService.get(id)).data
    if (!record) throw new Error('Business unit not found.')
    return {
      id: record.businessunitid,
      title: record.name,
      description: record.description ?? 'Business unit governance record.',
      status: record.isdisabled ? 'Inactive' : 'Active',
      eyebrow: 'Business Unit Detail',
      fields: [
        { label: 'Unit Type', value: record.aur_businessunittypename ?? 'Not set' },
        { label: 'Parent Unit', value: record.parentbusinessunitidname ?? 'Not linked' },
        { label: 'Email', value: record.emailaddress ?? 'Not set' },
        { label: 'Phone', value: record.address1_telephone1 ?? 'Not set' },
        { label: 'Website', value: record.websiteurl ?? 'Not set' },
        { label: 'City', value: record.address1_city ?? 'Not set' },
        { label: 'Address', value: record.address1_line1 ?? 'Not set' },
      ],
    }
  }

  if (entity === 'users') {
    const record = (await SystemusersService.get(id)).data
    if (!record) throw new Error('User not found.')
    return {
      id: record.systemuserid,
      title: record.fullname ?? `${record.firstname} ${record.lastname}`.trim(),
      description: record.jobtitle ?? 'Platform user record.',
      status: record.isdisabled ? 'Inactive' : 'Active',
      eyebrow: 'User Detail',
      fields: [
        { label: 'Business Unit', value: record.businessunitidname ?? 'Not linked' },
        { label: 'Access Mode', value: record.accessmodename ?? 'Not set' },
        { label: 'Internal Email', value: record.internalemailaddress ?? 'Not set' },
        { label: 'Personal Email', value: record.personalemailaddress ?? 'Not set' },
        { label: 'Domain Name', value: record.domainname ?? 'Not set' },
        { label: 'Phone', value: record.mobilephone ?? record.address1_telephone1 ?? 'Not set' },
        { label: 'Job Title', value: record.jobtitle ?? 'Not set' },
      ],
    }
  }

  if (entity === 'accounts') {
    const record = (await AccountsService.get(id)).data
    if (!record) throw new Error('Account not found.')
    return {
      id: record.accountid,
      title: record.name,
      description: record.description ?? 'Account master record.',
      status: record.statuscodename ?? 'Active',
      eyebrow: 'Account Detail',
      fields: [
        { label: 'Account Type', value: record.aur_account_typename ?? 'Not set' },
        { label: 'Account Number', value: record.accountnumber ?? 'Not set' },
        { label: 'Email', value: record.emailaddress1 ?? 'Not set' },
        { label: 'Phone', value: record.telephone1 ?? 'Not set' },
        { label: 'Website', value: record.websiteurl ?? 'Not set' },
        { label: 'City', value: record.address1_city ?? 'Not set' },
        { label: 'Address', value: record.address1_line1 ?? 'Not set' },
      ],
    }
  }

  const record = (await ContactsService.get(id)).data
  if (!record) throw new Error('Contact not found.')
  return {
    id: record.contactid,
    title: record.fullname ?? `${record.firstname ?? ''} ${record.lastname}`.trim(),
    description: record.jobtitle ?? 'Contact master record.',
    status: record.statuscodename ?? 'Active',
    eyebrow: 'Contact Detail',
    fields: [
      { label: 'Company', value: record.parentcustomeridname ?? record.company ?? 'Not linked' },
      { label: 'Email', value: record.emailaddress1 ?? 'Not set' },
      { label: 'Mobile', value: record.mobilephone ?? 'Not set' },
      { label: 'Phone', value: record.telephone1 ?? 'Not set' },
      { label: 'Job Title', value: record.jobtitle ?? 'Not set' },
      { label: 'City', value: record.address1_city ?? 'Not set' },
      { label: 'Address', value: record.address1_line1 ?? 'Not set' },
    ],
  }
}

export async function getDocumentTemplatePreview(templateId: string): Promise<DocumentTemplateSummary> {
  const record = (await Aur_custom_document_templatesesService.get(templateId)).data
  if (!record) throw new Error('Document template not found.')
  return {
    id: record.aur_custom_document_templatesid,
    name: record.aur_name ?? 'Untitled template',
    content: record.aur_template_content ?? '',
  }
}
