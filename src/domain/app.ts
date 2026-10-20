import type { LucideIcon } from 'lucide-react'

export type AppRole = 'underwriter' | 'seniorUnderwriter' | 'administrator'

export type AccessBucket = 'leads' | 'products' | 'admin'

export interface RouteDefinition {
  path: string
  label: string
  bucket?: AccessBucket
  icon: LucideIcon
  group: string
  disabled?: boolean
}

export interface AppUser {
  name: string
  initials: string
  role: AppRole
  roleLabel: string
  email?: string
  phone?: string
}

export interface TableQueryState {
  search: string
  sortBy?: string
  descending?: boolean
}

export interface ProductSummary {
  id: string
  name: string
  shortDetails: string
  status: string
  inquiryVolume: number
  premiumTotal: number
  insuredTotal: number
  emailAddress: string
  heading: string
}

export type AdminEntityKey =
  | 'policies'
  | 'plans'
  | 'coverages'
  | 'benefits'
  | 'inclusions'
  | 'exclusions'
  | 'warranties'
  | 'deductibles'
  | 'business-rules'
  | 'accounts'
  | 'contacts'
  | 'brokers'
  | 'business-units'
  | 'users'
  | 'email-templates'
  | 'document-templates'

export interface AdminCatalogItem {
  id: string
  name: string
  description: string
  status: string
  context: string
  contextTone?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info'
  detail?: string
  productId?: string
  planId?: string
  basePremium?: number
  minimumSumInsured?: number
  maximumSumInsured?: number
  cealing?: number
  floor?: number
}

export interface AdminCatalogStats {
  total: number
  active: number
  linked: number
  unassigned: number
}

export interface AdminCatalogDataset {
  entity: AdminEntityKey
  title: string
  description: string
  createLabel: string
  records: AdminCatalogItem[]
  stats: AdminCatalogStats
}

export interface ProductWorkspace {
  summary?: ProductSummary
  metadata?: {
    arabicName: string
    premiumPercentage: string
    details: string
    shortDetails: string
    heading: string
    buyHeading: string
    buyButton: string
    slogan: string
    remarks: string
    terms: string
    emailAddress: string
    order: string
    status: 'draft' | 'publish'
    applyActionAutomatically: boolean
  }
  availablePlans: AdminCatalogItem[]
  availableRules: AdminCatalogItem[]
  associatedRuleIds: string[]
  relationshipNotice?: string
}

export interface InquirySummary {
  id: string
  name: string
  inquiryNumber: string
  inquiryType: string
  inquiryTypeValue?: number
  status: string
  inquiryStatusValue?: number
  accountId?: string
  accountName: string
  contactName: string
  brokerId?: string
  brokerName: string
  productId?: string
  productName: string
  planId?: string
  planName: string
  riskScore: number
  grossPremium: number
  totalInsured: number
  createdOn: string
  summary: string
  sharepointUrl: string
}

export interface InquiryDetail extends InquirySummary {
  riskDescription: string
  paymentTerm: string
  territorialScope: string
  coverType: string
  planDetails: string
  fee: number
  declaredValue: number
  basePremium: number
  vehicleValue?: string
  customerData?: string
  aiEvaluationJsonResponse?: string
  tpa?: string
  tpaNetworkValue?: number | null
  tpaNetworkLabel?: string
  underwriterActionStatus?: number | null
  underwriterSubAction?: number | null
  totalCharge: number
  actionApplied?: boolean
  aiSummary: string
  account?: RelatedParty
  contact?: RelatedParty
  broker?: RelatedParty
  quotes: QuoteSummary[]
  quoteDetails: QuoteResponse[]
  readiness: ReadinessMetric[]
  workflow: WorkflowStep[]
  consequences: ConsequenceDefinition[]
  consequenceResults: ConsequenceResultSummary[]
  aiRuleGroups: InquiryRuleGroup[]
  notificationNotice?: {
    title: string
    messages: string[]
  }
  productRuleLinkNotice?: string
  emailTimeline: InquiryEmailSummary[]
  riCapacityChecks: RiCapacityCheckSummary[]
}

export interface RiCapacityCheckSummary {
  id: string
  name: string
  outcome: string
  calculationSource: string
  sumInsured: number
  retainedAmount: number
  treatyAbsorbed: number
  excessToPlace: number
  treatyName: string
  calculatedOn?: string
  createdOn?: string
}

export interface InquiryRuleGroup {
  category: string
  rules: Array<{
    id: string
    name: string
    response: string
    evidence: string
    conditionMet: string
  }>
}

export interface InquiryEmailSummary {
  id: string
  subject: string
  body: string
  sender: string
  toRecipients: string
  regardingId?: string
  status: string
  direction: 'sent' | 'received'
  createdOn?: string
  attachments: InquiryEmailAttachment[]
}

export interface InquiryEmailAttachment {
  id: string
  name: string
  mimeType?: string
  sizeLabel?: string
}

export interface QuoteSummary {
  id: string
  inquiryId: string
  name: string
  status: string
  quoteStatusValue?: number
  productName: string
  planName: string
  totalPremium: number
  grossPremium: number
  vat: number
  aiSummary: string
  reason: string
  createdOn: string
}

export interface QuoteDetail extends QuoteSummary {
  loadingPremium: number
  benefitsName: string
  coverageName: string
  deductibleName: string
  exclusionName: string
  inclusionName: string
  warrantyName: string
  inquiry?: InquirySummary
  responses: QuoteResponse[]
  emailTemplates: EmailTemplateSummary[]
  documentTemplates: DocumentTemplateSummary[]
}

export interface QuotePlanComparison {
  id: string
  name: string
  response: string
  suggestedPlanDetails: string
  unmatchedPlanDetails: string
  quoteId?: string
  quoteName?: string
  createdOn?: string
}

export interface PolicyConversionSummary {
  id: string
  name: string
  paymentAmount: number
  customerName: string
  stage: string
  stageStatus: string
  createdOn: string
}

export interface AmlScreeningFormState {
  id?: string
  assignedToId: string
  clientName: string
  clientEmail: string
  clientType: string
  emailDate: string
  emailSubject: string
  premium: string
  remarks: string
  screeningStatus: string
  tradeLicense: string
  typeOfPolicy: string
}

export interface PolicyBookingFormState {
  id?: string
  productId: string
  customerContactId: string
  hundredPercentPremium: string
  hundredPercentSi: string
  adntcSharePremium: string
  branchId: string
  brokerCommissionPercent: string
  cedingCommissionPercent: string
  currentOldPolicyNo: string
  departmentId: string
  installments: string
  insuredAddress: string
  insuredCountry: string
  insuredEmirates: string
  insuredName: string
  insuredNationality: string
  inwardPolicyNo: string
  inwardRefNo: string
  newPolicyNo: string
  ourSharePercent: string
  periodFrom: string
  periodTo: string
  remarks: string
  requestNo: string
  transactionCurrencyId: string
  taxPercent: string
  transactionType: string
}

export interface PolicyConversionDetail extends PolicyConversionSummary {
  quoteId?: string
  quoteName?: string
  paymentLink: string
  paymentReference: string
  paymentStatus: string
  customerId?: string
  customerType?: 'account' | 'contact'
  notes: string
  aml: AmlScreeningFormState
  booking: PolicyBookingFormState
  emails: InquiryEmailSummary[]
}

export interface QuoteResponse {
  id: string
  businessRuleId?: string
  businessRuleName: string
  businessRuleCategory: string
  name: string
  response: string
  evidence: string
  conditionMet: string
  status: string
  confidenceScore?: number
}

export interface RenewalSummary {
  id: string
  policyNumber: string
  client: string
  product: string
  expiryDate: string
  daysRemaining: number
  status: string
  reminderCount: number
  premiumTotal: number
  reminderSent?: boolean
  inquiryId?: string
  quoteId?: string
}

export interface PolicyWorkspace {
  id: string
  policyNumber: string
  customerName: string
  customerEmail: string
  customerPhone: string
  productName: string
  productId?: string
  issueDate: string
  expiryDate: string
  daysRemaining: number
  premiumAmount: number
  status: string
  reminderSent: boolean
  reminderCount: number
  notes: string
  inquiryId?: string
  inquiryName?: string
  quoteId?: string
  quoteName?: string
}

export interface RelatedParty {
  id: string
  name: string
  email?: string
  phone?: string
  subtitle?: string
}

export interface ReadinessMetric {
  label: string
  value: number
  description: string
}

export interface WorkflowStep {
  label: string
  complete: boolean
  tone?: 'primary' | 'success' | 'warning' | 'secondary' | 'info'
}

export interface ConsequenceDefinition {
  id: string
  businessRuleId?: string
  businessRuleName: string
  name: string
  action: string
  type: string
  notificationText: string
  documentTemplateId?: string
  documentTemplateName?: string
  emailTemplateId?: string
  emailTemplateName?: string
  riskScore?: number
  riskSummary?: string
  ratingAdd?: number
  ratingMultiply?: number
}

export interface ConsequenceResultSummary {
  id: string
  consequenceId?: string
  consequenceName: string
  name: string
  action: string
  type: string
  typeValue?: string
  actionStatusValue?: number
  actionStatusLabel?: string
  documentTemplateId?: string
  documentTemplateName?: string
  emailTemplateId?: string
  emailTemplateName?: string
  riskScore?: number
  riskSummary?: string
  ratingAdd?: number
  ratingMultiply?: number
  createdOn?: string
}

export interface EmailTemplateSummary {
  id: string
  name: string
  subject: string
  body: string
  category: string
  isActive: boolean
}

export interface DocumentTemplateSummary {
  id: string
  name: string
  content: string
}

export interface AdminDetailField {
  label: string
  value: string
}

export interface AdminDetailRecord {
  id: string
  title: string
  description: string
  status: string
  eyebrow: string
  fields: AdminDetailField[]
}

export interface KpiMetric {
  label: string
  value: number
  helper: string
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'secondary' | 'info'
}

export interface ChartDatum {
  label: string
  value: number
}

export interface DashboardMetrics {
  previewMode: boolean
  greeting: string
  heroDescription: string
  heroMetrics: KpiMetric[]
  brokerEmailCount: number
  brokerEmailByInquiry: ChartDatum[]
  emailStatusMix: ChartDatum[]
  totalInquiries: number
  totalQuotes: number
  wonQuotes: number
  wonPremiumTotal: number
  inquiryToQuoteConversionRate: number
  quoteToWonConversionRate: number
  brokerEmailTrend: ChartDatum[]
  wonPremiumByProduct: ChartDatum[]
  wonPremiumByPlan: ChartDatum[]
  inquiryByBrokers: ChartDatum[]
  inquiryKpis: KpiMetric[]
  quoteKpis: KpiMetric[]
  renewalKpis: KpiMetric[]
  inquiryMix: ChartDatum[]
  quoteStatusMix: ChartDatum[]
  topProducts: ChartDatum[]
  recentInquiries: InquirySummary[]
  recentQuotes: QuoteSummary[]
  insightCards: Array<{
    title: string
    text: string
    tone: KpiMetric['tone']
  }>
}

export interface AnalyticsSnapshot {
  totalPremium: number
  averageRiskScore: number
  renewalLoad: number
  quoteWinRate: number
  inquiryTrend: ChartDatum[]
  premiumTrend: ChartDatum[]
  productDistribution: ChartDatum[]
  statusDistribution: ChartDatum[]
  riskDistribution: ChartDatum[]
  drilldown: Array<{
    label: string
    inquiries: number
    quotes: number
    premium: number
  }>
  conversionFunnel: Array<{
    label: string
    value: number
    helper: string
    tone: 'primary' | 'success' | 'warning' | 'danger' | 'secondary' | 'info'
  }>
}

export interface EmailQueueSummary {
  id: string
  name: string
  mailbox: string
  inquiryId?: string
  inquiryName: string
  bodyPreview: string
  status: string
  createdOn?: string
  modifiedOn?: string
}

export interface EmailQueueDetail extends EmailQueueSummary {
  emailBody: string
}
