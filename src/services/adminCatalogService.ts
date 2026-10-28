import {
  AccountsService,
  Aur_benefitsesService,
  Aur_business_rulesesService,
  Aur_custom_document_templatesesService,
  Aur_coveragesesService,
  Aur_deductiblesesService,
  Aur_exclusionsesService,
  Aur_inclusionsesService,
  Aur_consequencesesService,
  Aur_plan_pricing_ordersService,
  Aur_plansService,
  Aur_productsesService,
  Aur_warrantiesesService,
  BusinessunitsService,
  ContactsService,
  TemplatesService,
  Aur_policiesService,
  SystemusersService,
} from '../generated'
import { Accountsaur_account_type } from '../generated/models/AccountsModel'
import { Businessunitsaur_businessunittype } from '../generated/models/BusinessunitsModel'
import {
  Aur_business_rulesesaur_categories,
} from '../generated/models/Aur_business_rulesesModel'
import {
  Aur_coveragesesaur_applicable,
  Aur_coveragesesaur_type,
} from '../generated/models/Aur_coveragesesModel'
import { Templatestemplatetypecode } from '../generated/models/TemplatesModel'
import {
  Systemusersaccessmode,
  Systemusersincomingemaildeliverymethod,
  Systemusersoutgoingemaildeliverymethod,
} from '../generated/models/SystemusersModel'
import type {
  AdminCatalogDataset,
  AdminCatalogItem,
  AdminEntityKey,
  ProductWorkspace,
} from '../domain/app'
import { mapProductSummary } from './dataMappers'

export interface AdminFormPayload {
  id?: string
  name: string
  description?: string
  productId?: string
  planId?: string
  company?: string
  isBaseCover?: boolean
  applicable?: string
  coverageType?: string
  category?: string
  email?: string
  phone?: string
  website?: string
  accountType?: string
  subject?: string
  body?: string
  isActive?: boolean
  firstName?: string
  lastName?: string
  jobTitle?: string
  content?: string
  domainName?: string
  internalEmail?: string
  businessUnitId?: string
  accessMode?: string
  customerName?: string
  customerId?: string
  issueDate?: string
  expiryDate?: string
  premiumAmount?: string
  basePremium?: string
  minimumSumInsured?: string
  maximumSumInsured?: string
  cealing?: string
  floor?: string
  statusText?: string
  reminderSent?: boolean
  inquiryId?: string
  pricingOrderItems?: PlanPricingOrderItem[]
}

export interface PlanPricingOrderItem {
  key: string
  consequenceId: string
  businessRuleId: string
  businessRuleName: string
  consequenceName: string
  action: string
  actionValue: string
  addAmount?: number
  multiplyValue?: number
  order: number
}

const ENTITY_META: Record<
  AdminEntityKey,
  { title: string; description: string; createLabel: string }
> = {
  policies: {
    title: 'Policies',
    description: 'Issued policy records connected to customer, product, inquiry, and renewal servicing workflows.',
    createLabel: 'Add Policy',
  },
  plans: {
    title: 'Plans',
    description: 'Reference plans linked to products for underwriting and quote composition.',
    createLabel: 'Add Plan',
  },
  coverages: {
    title: 'Coverages',
    description: 'Coverage library with plan and product linkage for quote composition.',
    createLabel: 'Add Coverage',
  },
  benefits: {
    title: 'Benefits',
    description: 'Benefit records linked to plans for quote-ready insurance packaging.',
    createLabel: 'Add Benefit',
  },
  inclusions: {
    title: 'Inclusions',
    description: 'Inclusion library aligned to plans and quote workbench requirements.',
    createLabel: 'Add Inclusion',
  },
  exclusions: {
    title: 'Exclusions',
    description: 'Exclusion catalog used during quote composition and risk explanation.',
    createLabel: 'Add Exclusion',
  },
  warranties: {
    title: 'Warranties',
    description: 'Warranty clauses assigned to plans for underwriting and servicing control.',
    createLabel: 'Add Warranty',
  },
  deductibles: {
    title: 'Deductibles',
    description: 'Deductible options mapped into plan-level product structures.',
    createLabel: 'Add Deductible',
  },
  'business-rules': {
    title: 'Business Rules',
    description: 'Eligibility and underwriting rules used for operational guidance and AI outcomes.',
    createLabel: 'Add Rule',
  },
  accounts: {
    title: 'Accounts',
    description: 'Customer and broker account records used across inquiries, quotes, and servicing.',
    createLabel: 'Add Account',
  },
  contacts: {
    title: 'Contacts',
    description: 'Primary insured and stakeholder contacts connected to inquiry and account workflows.',
    createLabel: 'Add Contact',
  },
  brokers: {
    title: 'Brokers',
    description: 'Broker master records surfaced in underwriting intake and operational administration.',
    createLabel: 'Add Broker',
  },
  'business-units': {
    title: 'Business Units',
    description: 'Operating units and branches used for governance, routing, and ownership structure.',
    createLabel: 'Add Business Unit',
  },
  users: {
    title: 'Users',
    description: 'Platform users mapped to business units for operational ownership and administration.',
    createLabel: 'Add User',
  },
  'email-templates': {
    title: 'Email Templates',
    description: 'Reusable communication templates for inquiry, quote, policy, and reminder workflows.',
    createLabel: 'Add Template',
  },
  'document-templates': {
    title: 'Document Templates',
    description: 'Document-generation templates used in quote and servicing output workflows.',
    createLabel: 'Add Template',
  },
}

export async function getAdminCatalog(entity: AdminEntityKey): Promise<AdminCatalogDataset> {
  const [productsResult, plansResult] = await Promise.all([
    Aur_productsesService.getAll(),
    Aur_plansService.getAll(),
  ])

  const products = productsResult.data ?? []
  const plans = plansResult.data ?? []
  const productMap = new Map(products.map((product) => [product.aur_productsid, product]))
  const planMap = new Map(plans.map((plan) => [plan.aur_planid, plan]))

  let records: AdminCatalogItem[] = []

  if (entity === 'policies') {
    const result = await Aur_policiesService.getAll({
      orderBy: ['aur_expiry_date asc'],
    })
    records = (result.data ?? []).map((policy) => ({
      id: policy.aur_policyid,
      name: policy.aur_policy_number ?? `POL-${policy.aur_policyid.slice(0, 8).toUpperCase()}`,
      description: policy.aur_customer_idname ?? 'No customer linked',
      status: policy.statuscodename ?? policy.statecodename ?? 'Active',
      context: policy.aur_productname ?? 'No Product Linked',
      detail: [
        policy.aur_cession_statusname,
        policy.aur_expiry_date ? `Expires ${new Date(policy.aur_expiry_date).toLocaleDateString('en')}` : '',
        typeof policy.aur_premium_amount === 'number' ? `Premium ${policy.aur_premium_amount.toLocaleString('en')}` : '',
      ]
        .filter(Boolean)
        .join(' • '),
      productId: policy._aur_product_value,
    }))
  }

  if (entity === 'plans') {
    records = plans.map((plan) => ({
      ...mapPlanPricingFields(plan),
      id: plan.aur_planid,
      name: plan.aur_name ?? 'Unnamed plan',
      description: plan.aur_description ?? 'No plan description has been captured yet.',
      status: plan.statuscodename ?? 'Active',
      context: plan.aur_productname ?? resolveProductName(productMap, plan._aur_product_value),
      detail: plan.createdon ? `Created ${new Date(plan.createdon).toLocaleDateString('en')}` : 'Product-linked plan',
      productId: plan._aur_product_value,
    }))
  }

  if (entity === 'coverages') {
    const result = await Aur_coveragesesService.getAll()
    records = (result.data ?? []).map((coverage) => ({
      id: coverage.aur_coveragesid,
      name: coverage.aur_name,
      description: coverage.aur_description ?? 'No coverage description has been captured yet.',
      status: coverage.statuscodename ?? 'Active',
      context: [coverage.aur_productname, coverage.aur_planname].filter(Boolean).join(' • ') || 'Unassigned',
      detail: [coverage.aur_typename, coverage.aur_applicablename, coverage.aur_base_covername]
        .filter(Boolean)
        .join(' • '),
      productId: coverage._aur_product_value,
      planId: coverage._aur_plan_value,
    }))
  }

  if (entity === 'benefits') {
    const result = await Aur_benefitsesService.getAll()
    records = (result.data ?? []).map((benefit) => ({
      id: benefit.aur_benefitsid,
      name: benefit.aur_name,
      description: benefit.aur_description ?? 'No benefit description has been captured yet.',
      status: benefit.statuscodename ?? 'Active',
      context: benefit.aur_planname ?? resolvePlanName(planMap, benefit._aur_plan_value),
      detail: 'Plan-linked benefit',
      planId: benefit._aur_plan_value,
    }))
  }

  if (entity === 'inclusions') {
    const result = await Aur_inclusionsesService.getAll()
    records = (result.data ?? []).map((inclusion) => ({
      id: inclusion.aur_inclusionsid,
      name: inclusion.aur_name,
      description: inclusion.aur_description ?? 'No inclusion description has been captured yet.',
      status: inclusion.statuscodename ?? 'Active',
      context: inclusion.aur_planname ?? resolvePlanName(planMap, inclusion._aur_plan_value),
      detail: 'Plan-linked inclusion',
      planId: inclusion._aur_plan_value,
    }))
  }

  if (entity === 'exclusions') {
    const result = await Aur_exclusionsesService.getAll()
    records = (result.data ?? []).map((exclusion) => ({
      id: exclusion.aur_exclusionsid,
      name: exclusion.aur_name,
      description: exclusion.aur_description ?? 'No exclusion description has been captured yet.',
      status: exclusion.statuscodename ?? 'Active',
      context: exclusion.aur_planname ?? resolvePlanName(planMap, exclusion._aur_plan_value),
      detail: 'Plan-linked exclusion',
      planId: exclusion._aur_plan_value,
    }))
  }

  if (entity === 'warranties') {
    const result = await Aur_warrantiesesService.getAll()
    records = (result.data ?? []).map((warranty) => ({
      id: warranty.aur_warrantiesid,
      name: warranty.aur_name,
      description: warranty.aur_description ?? 'No warranty description has been captured yet.',
      status: warranty.statuscodename ?? 'Active',
      context: warranty.aur_planname ?? resolvePlanName(planMap, warranty._aur_plan_value),
      detail: 'Plan-linked warranty',
      planId: warranty._aur_plan_value,
    }))
  }

  if (entity === 'deductibles') {
    const result = await Aur_deductiblesesService.getAll()
    records = (result.data ?? []).map((deductible) => ({
      id: deductible.aur_deductiblesid,
      name: deductible.aur_name,
      description: deductible.aur_description ?? 'No deductible description has been captured yet.',
      status: deductible.statuscodename ?? 'Active',
      context: deductible.aur_planname ?? resolvePlanName(planMap, deductible._aur_plan_value),
      detail: 'Plan-linked deductible',
      planId: deductible._aur_plan_value,
    }))
  }

  if (entity === 'business-rules') {
    const result = await Aur_business_rulesesService.getAll()
    records = (result.data ?? []).map((rule) => ({
      id: rule.aur_business_rulesid,
      name: rule.aur_name,
      description: rule.aur_propertiesname ?? 'No linked property rule yet.',
      status: rule.statuscodename ?? 'Active',
      context: rule.aur_categoriesname ?? resolveRuleCategory(rule.aur_categories),
      detail: 'Rule library',
    }))
  }

  if (entity === 'accounts') {
    const result = await AccountsService.getAll()
    records = (result.data ?? []).map((account) => ({
      id: account.accountid,
      name: account.name,
      description: account.description ?? account.emailaddress1 ?? 'No account description captured yet.',
      status: account.statuscodename ?? 'Active',
      context: account.aur_account_typename ?? 'Unassigned',
      detail: [account.telephone1, account.websiteurl].filter(Boolean).join(' • ') || account.address1_city || 'Account record',
    }))
  }

  if (entity === 'contacts') {
    const [result, accountsResult] = await Promise.all([
      ContactsService.getAll(),
      AccountsService.getAll({
        select: ['accountid', 'name'],
        orderBy: ['name asc'],
      }),
    ])
    const accountMap = new Map(
      (accountsResult.data ?? []).map((account) => [
        normalizeDataverseId(account.accountid),
        account.name ?? 'Unnamed account',
      ]),
    )
    records = (result.data ?? []).map((contact) => ({
      id: contact.contactid,
      name: contact.fullname ?? (`${contact.firstname ?? ''} ${contact.lastname}`.trim() || contact.lastname),
      description: contact.jobtitle ?? contact.emailaddress1 ?? 'No role or email captured yet.',
      status: contact.statuscodename ?? 'Active',
      context:
        accountMap.get(
          normalizeDataverseId(contact._msa_managingpartnerid_value ?? contact._accountid_value),
        ) ??
        contact.msa_managingpartneridname ??
        contact.accountidname ??
        contact.parentcustomeridname ??
        contact.company ??
        'Unassigned',
      detail: [contact.mobilephone ?? contact.telephone1, contact.jobtitle].filter(Boolean).join(' • ') || 'Contact record',
    }))
  }

  if (entity === 'brokers') {
    const result = await AccountsService.getAll()
    records = (result.data ?? [])
      .filter((account) => account.aur_account_type === 751820000 || account.aur_account_typename?.toLowerCase() === 'broker')
      .map((broker) => ({
      id: broker.accountid,
      name: broker.name ?? 'Unnamed broker',
      description: broker.emailaddress1 ?? 'No broker email captured yet.',
      status: broker.statuscodename ?? 'Active',
      context: 'Broker Directory',
      detail: broker.createdon ? `Created ${new Date(broker.createdon).toLocaleDateString('en')}` : 'Broker record',
    }))
  }

  if (entity === 'business-units') {
    const result = await BusinessunitsService.getAll()
    records = (result.data ?? []).map((unit) => ({
      id: unit.businessunitid,
      name: unit.name,
      description: unit.description ?? unit.emailaddress ?? 'No business unit description captured yet.',
      status: unit.isdisabled ? 'Inactive' : 'Active',
      context: unit.aur_businessunittypename ?? 'Organization Unit',
      detail:
        [unit.parentbusinessunitidname, unit.address1_city].filter(Boolean).join(' • ') ||
        unit.websiteurl ||
        'Business unit record',
    }))
  }

  if (entity === 'users') {
    const result = await SystemusersService.getAll()
    records = (result.data ?? []).map((user) => ({
      id: user.systemuserid,
      name: user.fullname ?? `${user.firstname} ${user.lastname}`.trim(),
      description: user.internalemailaddress ?? user.domainname,
      status: user.isdisabled ? 'Inactive' : 'Active',
      context: user.businessunitidname ?? 'Unassigned',
      detail: [user.accessmodename, user.jobtitle].filter(Boolean).join(' • ') || 'System user',
    }))
  }

  if (entity === 'email-templates') {
    const result = await TemplatesService.getAll()
    records = (result.data ?? []).map((template) => ({
      id: template.templateid,
      name: template.title,
      description: template.subject ?? '',
      status: template.componentstate === 0 ? 'Published' : 'Unpublished',
      context: template.templatetypecodename ?? 'Email template',
      detail: template.description ?? 'Communication template',
    }))
  }

  if (entity === 'document-templates') {
    const result = await Aur_custom_document_templatesesService.getAll()
    records = (result.data ?? []).map((template) => ({
      id: template.aur_custom_document_templatesid,
      name: template.aur_name ?? 'Untitled template',
      description: template.aur_template_content?.slice(0, 120) ?? 'No template content captured yet.',
      status: template.statuscodename ?? 'Active',
      context: 'Document Workspace',
      detail: template.createdon ? `Updated ${new Date(template.createdon).toLocaleDateString('en')}` : 'Document template',
    }))
  }

  const stats = {
    total: records.length,
    active: records.filter((record) => record.status.toLowerCase() === 'active').length,
    linked: records.filter((record) => record.context && record.context !== 'Unassigned').length,
    unassigned: records.filter((record) => !record.context || record.context === 'Unassigned').length,
  }

  return {
    entity,
    title: ENTITY_META[entity].title,
    description: ENTITY_META[entity].description,
    createLabel: ENTITY_META[entity].createLabel,
    records,
    stats,
  }
}

export async function saveAdminRecord(entity: AdminEntityKey, payload: AdminFormPayload) {
  const data = buildPayload(entity, payload)
  if (entity === 'plans') {
    const result = payload.id
      ? await updateEntity(entity, payload.id, data)
      : await createEntity(entity, data)
    const planId =
      payload.id ||
      ((result as { data?: { aur_planid?: string } } | undefined)?.data?.aur_planid ?? '')
    if (planId && payload.pricingOrderItems) {
      await savePlanPricingOrder(planId, payload.pricingOrderItems)
    }
    return
  }

  if (payload.id) {
    await updateEntity(entity, payload.id, data)
    return
  }
  await createEntity(entity, data)
}

export async function getAdminRecord(entity: AdminEntityKey, id: string): Promise<AdminFormPayload> {
  if (entity === 'policies') {
    const record = (await Aur_policiesService.get(id)).data
    if (!record) throw new Error('Policy not found.')
    return {
      id: record.aur_policyid,
      name: record.aur_policy_number ?? '',
      customerId: record._aur_customer_id_value ?? '',
      customerName: record.aur_customer_idname ?? '',
      issueDate: record.aur_issue_date ? record.aur_issue_date.slice(0, 10) : '',
      expiryDate: record.aur_expiry_date ? record.aur_expiry_date.slice(0, 10) : '',
      premiumAmount: typeof record.aur_premium_amount === 'number' ? String(record.aur_premium_amount) : '',
      reminderSent: record.aur_reminder_sent ?? false,
      description: record.aur_notes ?? '',
      productId: record._aur_product_value ?? '',
      inquiryId: record._aur_inquiry_value ?? '',
    }
  }
  if (entity === 'plans') {
    const record = (await Aur_plansService.get(id)).data
    if (!record) throw new Error('Plan not found.')
    const pricing = mapPlanPricingFields(record)
    return {
      id: record.aur_planid,
      name: record.aur_name ?? '',
      description: record.aur_description ?? '',
      productId: record._aur_product_value ?? '',
      basePremium: pricing.basePremium != null ? String(pricing.basePremium) : '',
      minimumSumInsured: pricing.minimumSumInsured != null ? String(pricing.minimumSumInsured) : '',
      maximumSumInsured: pricing.maximumSumInsured != null ? String(pricing.maximumSumInsured) : '',
      cealing: pricing.cealing != null ? String(pricing.cealing) : '',
      floor: pricing.floor != null ? String(pricing.floor) : '',
      pricingOrderItems: await getPlanRatingPricingOrder(record.aur_planid, record._aur_product_value),
    }
  }
  if (entity === 'accounts') {
    const record = (await AccountsService.get(id)).data
    if (!record) throw new Error('Account not found.')
    return {
      id: record.accountid,
      name: record.name,
      description: record.description ?? '',
      email: record.emailaddress1 ?? '',
      phone: record.telephone1 ?? '',
      website: record.websiteurl ?? '',
      accountType: record.aur_account_typename ?? '',
    }
  }
  if (entity === 'contacts') {
    const record = (await ContactsService.get(id)).data
    if (!record) throw new Error('Contact not found.')
    return {
      id: record.contactid,
      name: record.fullname ?? `${record.firstname ?? ''} ${record.lastname}`.trim(),
      firstName: record.firstname ?? '',
      lastName: record.lastname,
      email: record.emailaddress1 ?? '',
      phone: record.mobilephone ?? record.telephone1 ?? '',
      description: record.description ?? '',
      jobTitle: record.jobtitle ?? '',
      company: record.msa_managingpartneridname ?? record.parentcustomeridname ?? record.company ?? '',
    }
  }
  if (entity === 'brokers') {
    const record = (await AccountsService.get(id)).data
    if (!record) throw new Error('Broker not found.')
    return {
      id: record.accountid,
      name: record.name ?? '',
      email: record.emailaddress1 ?? '',
    }
  }
  if (entity === 'business-units') {
    const record = (await BusinessunitsService.get(id)).data
    if (!record) throw new Error('Business unit not found.')
    return {
      id: record.businessunitid,
      name: record.name,
      description: record.description ?? '',
      email: record.emailaddress ?? '',
      website: record.websiteurl ?? '',
      phone: record.address1_telephone1 ?? '',
      accountType: record.aur_businessunittypename ?? '',
    }
  }
  if (entity === 'users') {
    const record = (await SystemusersService.get(id)).data
    if (!record) throw new Error('User not found.')
    return {
      id: record.systemuserid,
      name: record.fullname ?? `${record.firstname} ${record.lastname}`.trim(),
      firstName: record.firstname,
      lastName: record.lastname,
      email: record.personalemailaddress ?? '',
      internalEmail: record.internalemailaddress,
      domainName: record.domainname,
      phone: record.mobilephone ?? record.address1_telephone1 ?? '',
      jobTitle: record.jobtitle ?? '',
      businessUnitId: record._businessunitid_value ?? '',
      accessMode: record.accessmodename ?? '',
    }
  }
  if (entity === 'email-templates') {
    const record = (await TemplatesService.get(id)).data
    if (!record) throw new Error('Email template not found.')
    return {
      id: record.templateid,
      name: record.title,
      description: record.description ?? '',
      subject: record.subject ?? '',
      body: record.body ?? '',
      category: record.templatetypecodename ?? '',
      isActive: record.componentstate === 0,
    }
  }
  if (entity === 'document-templates') {
    const record = (await Aur_custom_document_templatesesService.get(id)).data
    if (!record) throw new Error('Document template not found.')
    return {
      id: record.aur_custom_document_templatesid,
      name: record.aur_name ?? 'Untitled template',
      content: record.aur_template_content ?? '',
    }
  }
  throw new Error('Record hydration is only required for admin operations entities.')
}

export async function deleteAdminRecord(entity: AdminEntityKey, id: string) {
  if (entity === 'policies') return Aur_policiesService.delete(id)
  if (entity === 'accounts') return AccountsService.delete(id)
  if (entity === 'contacts') return ContactsService.delete(id)
  if (entity === 'brokers') return AccountsService.delete(id)
  if (entity === 'business-units') return BusinessunitsService.delete(id)
  if (entity === 'users') return SystemusersService.delete(id)
  if (entity === 'email-templates') return TemplatesService.delete(id)
  if (entity === 'document-templates') return Aur_custom_document_templatesesService.delete(id)
  if (entity === 'plans') return Aur_plansService.delete(id)
  if (entity === 'coverages') return Aur_coveragesesService.delete(id)
  if (entity === 'benefits') return Aur_benefitsesService.delete(id)
  if (entity === 'inclusions') return Aur_inclusionsesService.delete(id)
  if (entity === 'exclusions') return Aur_exclusionsesService.delete(id)
  if (entity === 'warranties') return Aur_warrantiesesService.delete(id)
  if (entity === 'deductibles') return Aur_deductiblesesService.delete(id)
  return Aur_business_rulesesService.delete(id)
}

export async function getProductWorkspace(productId?: string): Promise<ProductWorkspace> {
  const [productsResult, plansDataset, rulesDataset] = await Promise.all([
    Aur_productsesService.getAll(),
    getAdminCatalog('plans'),
    getAdminCatalog('business-rules'),
  ])

  const products = productsResult.data ?? []
  const current = productId ? products.find((product) => product.aur_productsid === productId) : undefined
  const summary = current ? mapProductSummary(current) : undefined

  return {
    summary,
    availablePlans: plansDataset.records.filter((plan) => !productId || plan.productId === productId),
    availableRules: rulesDataset.records,
    associatedRuleIds: [],
    relationshipNotice: undefined,
  }
}

export async function saveProduct(payload: {
  id?: string
  name: string
  shortDetails?: string
  details?: string
  heading?: string
  slogan?: string
  emailAddress?: string
  buyHeading?: string
  terms?: string
  status?: 'draft' | 'publish'
}) {
  const productStatus: 751820000 | 751820001 =
    payload.status === 'publish' ? 751820001 : 751820000
  const statusCode: 1 | 751820001 = payload.status === 'publish' ? 751820001 : 1
  const record = {
    aur_name: payload.name,
    aur_short_details: payload.shortDetails,
    aur_details: payload.details,
    aur_heading: payload.heading,
    aur_slogan: payload.slogan,
    aur_incomingemailaddress: payload.emailAddress,
    aur_buy_heading: payload.buyHeading,
    aur_terms_conditions: payload.terms,
    aur_product_status: productStatus,
    statuscode: statusCode,
  }

  if (payload.id) {
    await Aur_productsesService.update(payload.id, record)
    return
  }

  await Aur_productsesService.create(record as never)
}

function resolveProductName(productMap: Map<string, { aur_name: string }>, productId?: string) {
  if (!productId) return 'Unassigned'
  return productMap.get(productId)?.aur_name ?? 'Unassigned'
}

function resolvePlanName(planMap: Map<string, { aur_name?: string }>, planId?: string) {
  if (!planId) return 'Unassigned'
  return planMap.get(planId)?.aur_name ?? 'Unassigned'
}

function parseOptionalNumber(value?: string) {
  if (!value?.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function mapPlanPricingFields(plan: Awaited<ReturnType<typeof Aur_plansService.getAll>>['data'][number]) {
  const planRecord = plan as typeof plan & {
    aur_base_premium?: number | null
    aur_minimum_sum_insured?: number | null
    aur_maximum_sum_insured?: number | null
    aur_cealing?: number | null
    aur_floor?: number | null
  }
  return {
    basePremium: planRecord.aur_base_premium ?? undefined,
    minimumSumInsured: planRecord.aur_minimum_sum_insured ?? undefined,
    maximumSumInsured: planRecord.aur_maximum_sum_insured ?? undefined,
    cealing: planRecord.aur_cealing ?? undefined,
    floor: planRecord.aur_floor ?? undefined,
  }
}

function resolveRuleCategory(value?: number) {
  if (!value) return 'Uncategorized'
  return Aur_business_rulesesaur_categories[value as keyof typeof Aur_business_rulesesaur_categories] ?? 'Uncategorized'
}

function buildPayload(entity: AdminEntityKey, payload: AdminFormPayload) {
  if (entity === 'policies') {
    return {
      aur_policy_number: payload.name,
      aur_issue_date: payload.issueDate,
      aur_expiry_date: payload.expiryDate,
      aur_premium_amount: payload.premiumAmount ? Number(payload.premiumAmount) : undefined,
      aur_reminder_sent: payload.reminderSent,
      aur_notes: payload.description,
      ...(payload.customerId ? { 'aur_customer_id@odata.bind': `/accounts(${payload.customerId})` } : {}),
      ...(payload.productId ? { 'aur_product@odata.bind': `/aur_productses(${payload.productId})` } : {}),
      ...(payload.inquiryId ? { 'aur_inquiry@odata.bind': `/aur_inquiries(${payload.inquiryId})` } : {}),
    }
  }
  if (entity === 'plans') {
    return {
      aur_name: payload.name,
      aur_description: payload.description,
      aur_base_premium: parseOptionalNumber(payload.basePremium),
      aur_minimum_sum_insured: parseOptionalNumber(payload.minimumSumInsured),
      aur_maximum_sum_insured: parseOptionalNumber(payload.maximumSumInsured),
      aur_cealing: parseOptionalNumber(payload.cealing),
      aur_floor: parseOptionalNumber(payload.floor),
      ...(payload.productId ? { 'aur_product@odata.bind': `/aur_productses(${payload.productId})` } : {}),
    }
  }

  if (entity === 'coverages') {
    const applicable = findOptionKey(Aur_coveragesesaur_applicable, payload.applicable)
    const coverageType = findOptionKey(Aur_coveragesesaur_type, payload.coverageType)
    return {
      aur_name: payload.name,
      aur_description: payload.description,
      aur_company: payload.company,
      aur_base_cover: payload.isBaseCover,
      ...(applicable ? { aur_applicable: applicable } : {}),
      ...(coverageType ? { aur_type: coverageType } : {}),
      ...(payload.productId ? { 'aur_product@odata.bind': `/aur_productses(${payload.productId})` } : {}),
      ...(payload.planId ? { 'aur_plan@odata.bind': `/aur_plans(${payload.planId})` } : {}),
    }
  }

  if (entity === 'benefits') {
    return buildPlanLinkedPayload(payload)
  }
  if (entity === 'inclusions') {
    return buildPlanLinkedPayload(payload)
  }
  if (entity === 'exclusions') {
    return buildPlanLinkedPayload(payload)
  }
  if (entity === 'deductibles') {
    return buildPlanLinkedPayload(payload)
  }
  if (entity === 'warranties') {
    return {
      aur_name: payload.name,
      aur_description: payload.description,
      ...(payload.planId ? { 'aur_Plan@odata.bind': `/aur_plans(${payload.planId})` } : {}),
    }
  }
  if (entity === 'accounts') {
    return {
      name: payload.name,
      description: payload.description,
      emailaddress1: payload.email,
      telephone1: payload.phone,
      websiteurl: payload.website,
      ...(findOptionKey(Accountsaur_account_type, payload.accountType)
        ? { aur_account_type: findOptionKey(Accountsaur_account_type, payload.accountType) }
        : {}),
    }
  }
  if (entity === 'contacts') {
    return {
      firstname: payload.firstName,
      lastname: payload.lastName || payload.name || 'Contact',
      emailaddress1: payload.email,
      mobilephone: payload.phone,
      jobtitle: payload.jobTitle,
      description: payload.description,
      company: payload.company,
    }
  }
  if (entity === 'brokers') {
    return {
      name: payload.name,
      emailaddress1: payload.email,
      aur_account_type: 751820000,
    }
  }
  if (entity === 'business-units') {
    return {
      name: payload.name,
      description: payload.description,
      emailaddress: payload.email,
      websiteurl: payload.website,
      address1_telephone1: payload.phone,
      ...(findOptionKey(Businessunitsaur_businessunittype, payload.accountType)
        ? { aur_businessunittype: findOptionKey(Businessunitsaur_businessunittype, payload.accountType) }
        : {}),
    }
  }
  if (entity === 'users') {
    return {
      firstname: payload.firstName || payload.name,
      lastname: payload.lastName || 'User',
      internalemailaddress: payload.internalEmail,
      personalemailaddress: payload.email,
      domainname: payload.domainName,
      mobilephone: payload.phone,
      jobtitle: payload.jobTitle,
      ...(payload.businessUnitId
        ? { 'BusinessUnitId@odata.bind': `/businessunits(${payload.businessUnitId})` }
        : {}),
      ...(findOptionKey(Systemusersaccessmode, payload.accessMode)
        ? { accessmode: findOptionKey(Systemusersaccessmode, payload.accessMode) }
        : {}),
    }
  }
  if (entity === 'email-templates') {
    return {
      title: payload.name,
      subject: payload.subject,
      body: payload.body,
      description: payload.description,
      languagecode: 1033,
      ispersonal: false,
      templatetypecode: findOptionKey(Templatestemplatetypecode, payload.category) ?? 1084,
    }
  }
  if (entity === 'document-templates') {
    return {
      aur_name: payload.name,
      aur_template_content: payload.content,
    }
  }
  return {
    aur_name: payload.name,
    aur_categories: findOptionKey(Aur_business_rulesesaur_categories, payload.category),
  }
}

function buildPlanLinkedPayload(payload: AdminFormPayload) {
  return {
    aur_name: payload.name,
    aur_description: payload.description,
    ...(payload.planId ? { 'aur_plan@odata.bind': `/aur_plans(${payload.planId})` } : {}),
  }
}

export async function getPlanRatingPricingOrder(planId: string, productId?: string): Promise<PlanPricingOrderItem[]> {
  if (!productId) return []

  const [rulesResult, consequencesResult, savedOrderResult] = await Promise.all([
    Aur_business_rulesesService.getAll(),
    Aur_consequencesesService.getAll(),
    Aur_plan_pricing_ordersService.getAll().catch(() => ({ data: [] })),
  ])

  const linkedRuleIds = new Set(
    (savedOrderResult.data ?? [])
      .filter((order) => normalizeDataverseId(order._aur_plan_value) === normalizeDataverseId(planId))
      .map((order) => normalizeDataverseId(order._aur_business_rule_value))
      .filter(Boolean),
  )

  const ruleNameById = new Map(
    (rulesResult.data ?? []).map((rule) => [
      normalizeDataverseId(rule.aur_business_rulesid),
      rule.aur_name ?? 'Business Rule',
    ]),
  )

  const savedOrderByConsequenceId = new Map(
    (savedOrderResult.data ?? [])
      .filter((order) => normalizeDataverseId(order._aur_plan_value) === normalizeDataverseId(planId))
      .map((order) => [
        normalizeDataverseId(order._aur_consequences_value),
        Number(order.aur_order) || Number.MAX_SAFE_INTEGER,
      ]),
  )

  return (consequencesResult.data ?? [])
    .map((consequence) => {
      const consequenceRecord = consequence as typeof consequence & {
        aur_add?: number | null
        aur_multiply?: number | null
      }
      const businessRuleId = normalizeDataverseId(consequence._aur_business_rule_value)
      const actionValue = consequence.aur_action ? String(consequence.aur_action) : ''
      const typeValue = consequence.aur_type ? String(consequence.aur_type) : ''
      return {
        key: consequence.aur_consequencesid,
        consequenceId: consequence.aur_consequencesid,
        businessRuleId: consequence._aur_business_rule_value ?? '',
        businessRuleName: ruleNameById.get(businessRuleId) ?? consequence.aur_business_rulename ?? 'Business Rule',
        consequenceName: consequence.aur_name ?? resolvePricingActionLabel(actionValue),
        action: resolvePricingActionLabel(actionValue),
        actionValue,
        addAmount: consequenceRecord.aur_add ?? undefined,
        multiplyValue: consequenceRecord.aur_multiply ?? undefined,
        order: savedOrderByConsequenceId.get(normalizeDataverseId(consequence.aur_consequencesid)) ?? Number.MAX_SAFE_INTEGER,
        typeValue,
      }
    })
    .filter((item) => linkedRuleIds.has(normalizeDataverseId(item.businessRuleId)) && item.typeValue === '6')
    .sort((left, right) => left.order - right.order || left.businessRuleName.localeCompare(right.businessRuleName))
    .map((item, index) => ({
      ...item,
      order: index + 1,
    }))
}

async function savePlanPricingOrder(planId: string, items: PlanPricingOrderItem[]) {
  const existing = (await Aur_plan_pricing_ordersService.getAll().catch(() => ({ data: [] }))).data ?? []
  const currentPlanOrders = existing.filter((order) => normalizeDataverseId(order._aur_plan_value) === normalizeDataverseId(planId))

  for (const order of currentPlanOrders) {
    await Aur_plan_pricing_ordersService.delete(order.aur_plan_pricing_orderid)
  }

  for (const [index, item] of items.entries()) {
    await Aur_plan_pricing_ordersService.create({
      aur_name: `${item.businessRuleName} - ${item.consequenceName}`,
      aur_order: String(index + 1),
      'aur_plan@odata.bind': `/aur_plans(${planId})`,
      'aur_business_rule@odata.bind': `/aur_business_ruleses(${item.businessRuleId})`,
      'aur_consequences@odata.bind': `/aur_consequenceses(${item.consequenceId})`,
    } as never)
  }
}

function resolvePricingActionLabel(value?: string | number) {
  if (Number(value) === 751820002) return 'Add'
  if (Number(value) === 751820003) return 'Multiply'
  return String(value || 'Rating')
}

function createEntity(entity: AdminEntityKey, data: Record<string, unknown>) {
  if (entity === 'policies') return Aur_policiesService.create(data as never)
  if (entity === 'accounts') return AccountsService.create(data as never)
  if (entity === 'contacts') return ContactsService.create(data as never)
  if (entity === 'brokers') return AccountsService.create(data as never)
  if (entity === 'business-units') return createBusinessUnit(data)
  if (entity === 'users') return createSystemUser(data)
  if (entity === 'email-templates') return TemplatesService.create(data as never)
  if (entity === 'document-templates') return Aur_custom_document_templatesesService.create(data as never)
  if (entity === 'plans') return Aur_plansService.create(data as never)
  if (entity === 'coverages') return Aur_coveragesesService.create(data as never)
  if (entity === 'benefits') return Aur_benefitsesService.create(data as never)
  if (entity === 'inclusions') return Aur_inclusionsesService.create(data as never)
  if (entity === 'exclusions') return Aur_exclusionsesService.create(data as never)
  if (entity === 'warranties') return Aur_warrantiesesService.create(data as never)
  if (entity === 'deductibles') return Aur_deductiblesesService.create(data as never)
  return Aur_business_rulesesService.create(data as never)
}

function updateEntity(entity: AdminEntityKey, id: string, data: Record<string, unknown>) {
  if (entity === 'policies') return Aur_policiesService.update(id, data)
  if (entity === 'accounts') return AccountsService.update(id, data)
  if (entity === 'contacts') return ContactsService.update(id, data)
  if (entity === 'brokers') return AccountsService.update(id, data)
  if (entity === 'business-units') return BusinessunitsService.update(id, data)
  if (entity === 'users') return SystemusersService.update(id, data)
  if (entity === 'email-templates') return TemplatesService.update(id, data)
  if (entity === 'document-templates') return Aur_custom_document_templatesesService.update(id, data)
  if (entity === 'plans') return Aur_plansService.update(id, data)
  if (entity === 'coverages') return Aur_coveragesesService.update(id, data)
  if (entity === 'benefits') return Aur_benefitsesService.update(id, data)
  if (entity === 'inclusions') return Aur_inclusionsesService.update(id, data)
  if (entity === 'exclusions') return Aur_exclusionsesService.update(id, data)
  if (entity === 'warranties') return Aur_warrantiesesService.update(id, data)
  if (entity === 'deductibles') return Aur_deductiblesesService.update(id, data)
  return Aur_business_rulesesService.update(id, data)
}

function findOptionKey(source: Record<number, string>, label?: string) {
  if (!label) return undefined
  const entry = Object.entries(source).find(([, value]) => value === label)
  return entry ? Number(entry[0]) : undefined
}

function normalizeDataverseId(value?: string) {
  return (value ?? '').replace(/[{}]/g, '').toLowerCase()
}

async function createBusinessUnit(data: Record<string, unknown>) {
  const units = (await BusinessunitsService.getAll()).data ?? []
  const parent = units[0]?._organizationid_value ?? units[0]?.businessunitid
  if (!parent) throw new Error('A parent business unit is required before creating a new business unit.')
  return BusinessunitsService.create({
    aur_businessunittype: 751820000,
    isdisabled: false,
    'ParentBusinessUnitId@odata.bind': `/businessunits(${parent})`,
    ...data,
  } as never)
}

async function createSystemUser(data: Record<string, unknown>) {
  const units = (await BusinessunitsService.getAll()).data ?? []
  const businessUnitId =
    typeof data['BusinessUnitId@odata.bind'] === 'string'
      ? data['BusinessUnitId@odata.bind']
      : units[0]
        ? `/businessunits(${units[0].businessunitid})`
        : undefined
  if (!businessUnitId) throw new Error('A business unit is required before creating a new user.')
  return SystemusersService.create({
    accessmode: findOptionKey(Systemusersaccessmode, 'Read_Write') ?? 0,
    azurestate: 0,
    caltype: 0,
    emailrouteraccessapproval: 0,
    incomingemaildeliverymethod: findOptionKey(Systemusersincomingemaildeliverymethod, 'None') ?? 0,
    invitestatuscode: 0,
    isintegrationuser: false,
    islicensed: true,
    issyncwithdirectory: false,
    outgoingemaildeliverymethod: findOptionKey(Systemusersoutgoingemaildeliverymethod, 'None') ?? 0,
    setupuser: false,
    systemmanagedusertype: 0,
    userlicensetype: 0,
    'BusinessUnitId@odata.bind': businessUnitId,
    ...data,
  } as never)
}
