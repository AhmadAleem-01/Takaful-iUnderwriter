import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useParams, Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { Archive, ArrowLeft, BellRing, Bold, Calculator, CheckCircle2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, CopyPlus, FileImage, FileSpreadsheet, FileStack, FileText, FolderOpen, GitBranch, History, Italic, LayoutGrid, List, LoaderCircle, Mail, MailCheck, MailPlus, Paperclip, Rows3, Save, SendHorizontal, ShieldAlert, Sparkles, Underline, X } from 'lucide-react'
import type { InquiryDetail, RiCapacityCheckSummary } from '../../domain/app'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useRole } from '../../hooks/useRole'
import {
  applyInquiryConsequenceResult,
  applyInquiryRatingOrder,
  copyQuotesToInquiry,
  createQuoteFromInquiry,
  createInquiryEmail,
  getConsequenceLinkedTemplatePreview,
  getInquiryDetailCore,
  getInquiryDetailSupplementary,
  getInquiryEditorOptions,
  listWonQuotesForProduct,
  recalculateRiCapacityChecks,
  saveInquiryDetail,
  updateInquiryQuoteDetailResponse,
} from '../../services/inquiriesService'
import type { ConsequenceTemplatePreview } from '../../services/inquiriesService'
import type { PlanPricingOrderItem } from '../../services/adminCatalogService'
import { getSharePointSiteUrl } from '../../services/sharePointSiteService'
import { Card } from '../../components/ui/Card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { getUnderwriterSubActions, underwriterActions, vehicleValueAverage } from '../../lib/inquiryUnderwriting'
import { formatAmount, formatCurrency, formatDate, formatPercent } from '../../lib/formatters'
import { AmountInput } from '../../components/ui/AmountInput'
import { parseMotorCustomerData, motorDriverFields, motorVehicleFields, motorAnswer } from '../../lib/motorInquiry'

interface InquiryFormState {
  name: string
  productId: string
  inquiryType: string
  inquiryStatus: string
  planId: string
  brokerId: string
  brokerAgentName: string
  planDetails: string
  coverType: string
  riskScore: string
  riskDescription: string
  totalSumInsured: string
  territorialScope: string
  noOfItems: string
  basePremium: string
  underwriterActionStatus: string
  underwriterSubAction: string
  premiumToBeCharged: string
  brokerage: string
  grossPremium: string
  paymentTerm: string
  fee: string
  totalDeduction: string
}

interface EmailComposerState {
  sender: string
  toRecipients: string
  subject: string
  description: string
}

const emptyEditorOptions = {
  products: [] as Array<{ id: string; name: string }>,
  plans: [] as Array<{ id: string; name: string; productId: string }>,
  brokers: [] as Array<{ id: string; name: string }>,
  inquiryTypes: [] as Array<{ value: number; label: string }>,
  inquiryStatuses: [] as Array<{ value: number; label: string }>,
  coverTypes: [] as Array<{ value: number; label: string }>,
  paymentTerms: [] as Array<{ value: number; label: string }>,
}

export function InquiryWorkspacePage() {
  const composerEditorRef = useRef<HTMLDivElement | null>(null)
  const composerSectionRef = useRef<HTMLDivElement | null>(null)
  const notificationMenuRef = useRef<HTMLDivElement | null>(null)
  const { user } = useRole()
  const { id = '' } = useParams()
  const [supplementaryRefreshKey, setSupplementaryRefreshKey] = useState(0)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [inquiryState, setInquiryState] = useState<InquiryDetail | null>(null)
  const [form, setForm] = useState<InquiryFormState | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [emailSearch, setEmailSearch] = useState('')
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const [composerEditorVersion, setComposerEditorVersion] = useState(0)
  const [composeBusy, setComposeBusy] = useState(false)
  const [composeError, setComposeError] = useState<string | null>(null)
  const [expandedEmailIds, setExpandedEmailIds] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState('details')
  const [aiView, setAiView] = useState<'card' | 'table'>('card')
  const [emailPanelMode, setEmailPanelMode] = useState<'expanded' | 'collapsed'>('expanded')
  const [isNarrowViewport, setIsNarrowViewport] = useState(false)
  const [aiCategory, setAiCategory] = useState('All')
  const [quoteView, setQuoteView] = useState<'card' | 'table'>('table')
  const [isCopyQuotesOpen, setIsCopyQuotesOpen] = useState(false)
  const [selectedWonQuoteIds, setSelectedWonQuoteIds] = useState<string[]>([])
  const [copyQuotesBusy, setCopyQuotesBusy] = useState(false)
  const [copyQuotesError, setCopyQuotesError] = useState<string | null>(null)
  const [appliedConsequenceIds, setAppliedConsequenceIds] = useState<string[]>([])
  const [quoteDetailDrafts, setQuoteDetailDrafts] = useState<Record<string, string>>({})
  const [quoteDetailSaveState, setQuoteDetailSaveState] = useState<
    Record<string, { saving?: boolean; success?: string | null; error?: string | null }>
  >({})
  const [isAiReevaluateOpen, setIsAiReevaluateOpen] = useState(false)
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false)
  const [expandedActionGroups, setExpandedActionGroups] = useState<Record<string, boolean>>({})
  const [templatePreview, setTemplatePreview] = useState<ConsequenceTemplatePreview | null>(null)
  const [templatePreviewBusy, setTemplatePreviewBusy] = useState(false)
  const [templatePreviewError, setTemplatePreviewError] = useState<string | null>(null)
  const [riCapacityBusy, setRiCapacityBusy] = useState(false)
  const [riCapacityMessage, setRiCapacityMessage] = useState<string | null>(null)
  const [composer, setComposer] = useState<EmailComposerState>({
    sender: 'underwriting@insureai.com',
    toRecipients: '',
    subject: '',
    description: '',
  })
  const coreLoad = useAsyncData(async () => getInquiryDetailCore(id), [id])
  const optionsLoad = useAsyncData(async () => getInquiryEditorOptions(), [])
  const sharePointSiteLoad = useAsyncData(getSharePointSiteUrl, [])
  const supplementaryLoad = useAsyncData(async () => getInquiryDetailSupplementary(id), [id, supplementaryRefreshKey])
  const copySourceProductId = form?.productId || inquiryState?.productId || coreLoad.data?.productId || ''
  const productWonQuotesLoad = useAsyncData(
    async () => (copySourceProductId ? listWonQuotesForProduct(copySourceProductId) : []),
    [copySourceProductId, supplementaryRefreshKey],
  )
  const inquiryRatingOrderItems = useMemo(
    () =>
      (inquiryState?.consequenceResults ?? [])
        .filter((result) => result.type === 'Rating' && (result.action === 'Add' || result.action === 'Multiply'))
        .map((result, index): PlanPricingOrderItem => ({
          key: result.id,
          consequenceId: result.consequenceId ?? '',
          businessRuleId: '',
          businessRuleName: splitBusinessRuleName(result.name),
          consequenceName: result.consequenceName,
          action: result.action,
          actionValue: result.action === 'Add' ? '751820002' : '751820003',
          addAmount: result.ratingAdd,
          multiplyValue: result.ratingMultiply,
          order: index + 1,
        })),
    [inquiryState?.consequenceResults],
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    const syncViewport = () => {
      const narrow = window.innerWidth < 1440
      setIsNarrowViewport(narrow)
      setEmailPanelMode((current) => (narrow ? 'collapsed' : current))
    }

    syncViewport()
    window.addEventListener('resize', syncViewport)
    return () => window.removeEventListener('resize', syncViewport)
  }, [])

  useEffect(() => {
    if (!coreLoad.data) return
    const inquiry = coreLoad.data
    setInquiryState(inquiry)
    setIsEditing(false)
    setActionSuccess(null)
    const nextForm = buildFormState(inquiry, emptyEditorOptions)
    nextForm.brokerAgentName = inquiry.contact?.name || inquiry.contactName || 'No broker agent linked'
    setForm(nextForm)
    setComposeError(null)
    setIsComposerOpen(false)
    setComposerEditorVersion((value) => value + 1)
    setEmailSearch('')
    setAiCategory('All')
    setExpandedEmailIds([])
    setIsCopyQuotesOpen(false)
    setSelectedWonQuoteIds([])
    setCopyQuotesError(null)
    setQuoteDetailDrafts({})
    setQuoteDetailSaveState({})
    setIsAiReevaluateOpen(false)
    setIsNotificationMenuOpen(false)
    setExpandedActionGroups({})
    setEmailPanelMode(isNarrowViewport ? 'collapsed' : 'expanded')
    setComposer({
      sender: user.email ?? 'underwriting@insureai.com',
      toRecipients: inquiry.contact?.email ?? inquiry.account?.email ?? '',
      subject: `Regarding ${inquiry.inquiryNumber}`,
      description: '',
    })
  }, [coreLoad.data, isNarrowViewport, user.email])

  useEffect(() => {
    if (!supplementaryLoad.data) return

    setInquiryState((current) => {
      if (!current) return current
      const merged = {
        ...current,
        ...supplementaryLoad.data,
      }
      return merged
    })
  }, [supplementaryLoad.data])

  useEffect(() => {
    if (!inquiryState || isEditing) return
    const nextForm = buildFormState(inquiryState, optionsLoad.data ?? emptyEditorOptions)
    nextForm.brokerAgentName = inquiryState.contact?.name || inquiryState.contactName || 'No broker agent linked'
    setForm(nextForm)
  }, [inquiryState, isEditing, optionsLoad.data])

  useEffect(() => {
    if (!inquiryState?.quoteDetails?.length) {
      setQuoteDetailDrafts({})
      return
    }

    setQuoteDetailDrafts((current) => {
      const next = { ...current }
      for (const detail of inquiryState.quoteDetails) {
        if (!(detail.id in next)) {
          next[detail.id] = detail.response ?? ''
        }
      }
      return next
    })
  }, [inquiryState?.quoteDetails])

  useEffect(() => {
    if (!inquiryState?.consequenceResults?.length) {
      setAppliedConsequenceIds([])
      return
    }

    setAppliedConsequenceIds(
      inquiryState.consequenceResults
        .filter((result) => isConsequenceApplied(result.actionStatusValue))
        .map((result) => result.id),
    )
  }, [inquiryState?.consequenceResults])

  useEffect(() => {
    if (!isComposerOpen || !composerEditorRef.current) return
    if (composerEditorRef.current.innerHTML !== composer.description) {
      composerEditorRef.current.innerHTML = composer.description
    }
  }, [composer.description, isComposerOpen])

  useEffect(() => {
    if (!isComposerOpen || emailPanelMode !== 'expanded') return

    const timeoutId = window.setTimeout(() => {
      composerSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
        inline: 'nearest',
      })
      composerEditorRef.current?.focus()
    }, 220)

    return () => window.clearTimeout(timeoutId)
  }, [isComposerOpen, emailPanelMode, composerEditorVersion])

  useEffect(() => {
    if (!isNotificationMenuOpen) return

    function handlePointerDown(event: MouseEvent) {
      if (!notificationMenuRef.current) return
      if (notificationMenuRef.current.contains(event.target as Node)) return
      setIsNotificationMenuOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [isNotificationMenuOpen])

  const detailSource = inquiryState ?? coreLoad.data
  const quoteDetails = detailSource?.quoteDetails ?? []
  const emailTimeline = detailSource?.emailTimeline ?? []

  const filteredEmails = useMemo(() => {
    const emails = emailTimeline
    if (!emailSearch.trim()) return emails
    const query = emailSearch.toLowerCase()
    return emails.filter((email) =>
      [email.subject, email.body, email.sender, email.toRecipients, email.status ?? '']
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [emailSearch, emailTimeline])

  const groupedQuoteDetails = useMemo(() => {
    const grouped = new Map<string, typeof quoteDetails>()
    for (const detail of quoteDetails) {
      const category = detail.businessRuleCategory || 'Uncategorized'
      const bucket = grouped.get(category) ?? []
      bucket.push(detail)
      grouped.set(category, bucket)
    }
    return Array.from(grouped.entries()).map(([category, items]) => ({
      category,
      items,
    }))
  }, [quoteDetails])

  const aiCategoryFilters = useMemo(
    () => [
      { label: 'All', count: quoteDetails.length },
      ...groupedQuoteDetails.map((group) => ({
        label: group.category,
        count: group.items.length,
      })),
    ],
    [groupedQuoteDetails, quoteDetails.length],
  )

  const visibleQuoteDetailGroups = useMemo(() => {
    if (aiCategory === 'All') return groupedQuoteDetails
    return groupedQuoteDetails.filter((group) => group.category === aiCategory)
  }, [aiCategory, groupedQuoteDetails])

  const visibleQuoteDetails = useMemo(() => {
    if (aiCategory === 'All') return quoteDetails
    return visibleQuoteDetailGroups.flatMap((group) => group.items)
  }, [aiCategory, quoteDetails, visibleQuoteDetailGroups])
  const consequenceResults = detailSource?.consequenceResults ?? []
  const groupedConsequenceResults = useMemo(() => {
    const groups = new Map<
      string,
      { ruleName: string; results: typeof consequenceResults; actionableCount: number }
    >()

    for (const result of consequenceResults) {
      const ruleName = getConsequenceRuleName(result.name)
      const existing = groups.get(ruleName)
      const actionable = canApplyConsequence(result.type, result.action) ? 1 : 0

      if (existing) {
        existing.results.push(result)
        existing.actionableCount += actionable
      } else {
        groups.set(ruleName, {
          ruleName,
          results: [result],
          actionableCount: actionable,
        })
      }
    }

    return Array.from(groups.values())
  }, [consequenceResults])

  const quoteVersionById = useMemo(() => {
    const sortedQuotes = [...(detailSource?.quotes ?? [])].sort((left, right) => {
      const leftTime = left.createdOn ? new Date(left.createdOn).getTime() : 0
      const rightTime = right.createdOn ? new Date(right.createdOn).getTime() : 0
      return leftTime - rightTime
    })

    return Object.fromEntries(
      sortedQuotes.map((quote, index) => [quote.id, `1.${index}`]),
    ) as Record<string, string>
  }, [detailSource?.quotes])

  const missingQuoteDetails = useMemo(
    () =>
      quoteDetails.filter((detail) =>
        detail.response.replace(/\s+/g, ' ').trim().toLowerCase() === 'no information provided',
      ),
    [quoteDetails],
  )
  const wonQuotes = useMemo(
    () =>
      (productWonQuotesLoad.data ?? []).filter(
        (quote) =>
          quote.quoteStatusValue === 751820000 ||
          quote.status.trim().toLowerCase() === 'quote won' ||
          quote.status.replace(/\s+/g, '').trim().toLowerCase() === 'quotewon',
      ),
    [productWonQuotesLoad.data],
  )

  function triggerWorkspaceRefresh() {
    setSupplementaryRefreshKey((value) => value + 1)
  }

  const error = coreLoad.error || optionsLoad.error || productWonQuotesLoad.error
  if (error) return <Card>{error}</Card>
  if (coreLoad.loading || !detailSource || !form) return <InquiryWorkspaceSkeleton />

  const inquiry = detailSource
  const sharePointFolderUrl = inquiry.sharepointUrl && sharePointSiteLoad.data
    ? `${sharePointSiteLoad.data}/${inquiry.sharepointUrl.trim().replace(/^\/+/, '')}`
    : null
  const inquiryRecordId = inquiry.id || id
  const notifications = inquiry.notificationNotice?.messages.map((message, index) => ({
    serial: index + 1,
    message,
  })) ?? []
  const options = optionsLoad.data ?? emptyEditorOptions
  const isHydratingSupplementary =
    supplementaryLoad.loading &&
    !inquiry.quotes.length &&
    !inquiry.quoteDetails.length &&
    !inquiry.emailTimeline.length &&
    !inquiry.consequenceResults.length
  const resetForm = () => {
    setIsEditing(false)
    setSaveError(null)
    const nextForm = buildFormState(inquiry, options)
    nextForm.brokerAgentName = inquiry.contact?.name || inquiry.contactName || 'No broker agent linked'
    setForm(nextForm)
  }

  async function handleDisposition(
    disposition: 'Decline' | 'RefertoUnderwriter' | 'EscalatetoHeadofAviation' | 'PropertyorReinsuranceTeam',
    key: string,
  ) {
    if (!form) return
    try {
      setPendingAction(key)
      setActionError(null)
      setActionSuccess(null)
      await saveInquiryDetail(inquiryRecordId, buildInquirySavePayload(form, {
        inquiryStatus: inquiryStatusValueForDisposition(disposition),
      }))
      const nextStatus = inquiryStatusLabelForDisposition(disposition)
      setInquiryState((current) =>
        current
          ? {
              ...current,
              status: nextStatus,
              inquiryStatusValue: inquiryStatusValueForDisposition(disposition),
            }
          : current,
      )
      setForm((current) =>
        current
          ? {
              ...current,
              inquiryStatus: String(inquiryStatusValueForDisposition(disposition)),
            }
          : current,
      )
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Unable to update inquiry disposition.')
    } finally {
      setPendingAction(null)
    }
  }

  async function handleCreateQuote() {
    if (!form) return
    try {
      setPendingAction('quote')
      setActionError(null)
      setActionSuccess(null)
      await createQuoteFromInquiry(inquiryRecordId, {
        productId: form.productId || undefined,
        planId: form.planId || undefined,
        premiumToBeCharged: Number(form.premiumToBeCharged) || 0,
      })
      setActionSuccess('Quote created and linked to this inquiry.')
      triggerWorkspaceRefresh()
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Unable to create quote from inquiry.')
    } finally {
      setPendingAction(null)
    }
  }

  function openCopyQuotesModal() {
    if (!wonQuotes.length) return
    setSelectedWonQuoteIds(wonQuotes.map((quote) => quote.id))
    setCopyQuotesError(null)
    setIsCopyQuotesOpen(true)
  }

  function toggleWonQuoteSelection(quoteId: string) {
    setSelectedWonQuoteIds((current) =>
      current.includes(quoteId)
        ? current.filter((id) => id !== quoteId)
        : [...current, quoteId],
    )
  }

  async function handleCopyQuotes() {
    if (!selectedWonQuoteIds.length) {
      setCopyQuotesError('Select at least one won quote to copy.')
      return
    }

    try {
      setCopyQuotesBusy(true)
      setCopyQuotesError(null)
      setActionError(null)
      setActionSuccess(null)
      const createdIds = await copyQuotesToInquiry(inquiryRecordId, selectedWonQuoteIds)
      setActionSuccess(
        createdIds.length === 1
          ? '1 quote was copied into this inquiry as a new active quote.'
          : `${createdIds.length} quotes were copied into this inquiry as new active quotes.`,
      )
      setIsCopyQuotesOpen(false)
      setSelectedWonQuoteIds([])
      triggerWorkspaceRefresh()
    } catch (cause) {
      setCopyQuotesError(cause instanceof Error ? cause.message : 'Unable to copy the selected quotes.')
    } finally {
      setCopyQuotesBusy(false)
    }
  }

  async function handleSaveDetails() {
    if (!form) return
    try {
      setSaveBusy(true)
      setSaveError(null)
      setActionSuccess(null)
      await saveInquiryDetail(inquiryRecordId, {
        name: form.name,
        productId: form.productId || undefined,
        inquiryType: form.inquiryType ? Number(form.inquiryType) : undefined,
        inquiryStatus: form.inquiryStatus ? Number(form.inquiryStatus) : undefined,
        planId: form.planId || undefined,
        brokerId: form.brokerId || undefined,
        planDetails: form.planDetails,
        coverType: form.coverType ? Number(form.coverType) : undefined,
        riskScore: Number(form.riskScore) || 0,
        riskDescription: form.riskDescription,
        totalSumInsured: Number(form.totalSumInsured) || 0,
        territorialScope: form.territorialScope,
        noOfItems: form.noOfItems,
        basePremium: Number(form.basePremium) || 0,
        underwriterActionStatus: form.underwriterActionStatus ? Number(form.underwriterActionStatus) : null,
        underwriterSubAction: form.underwriterSubAction ? Number(form.underwriterSubAction) : null,
        premiumToBeCharged: Number(form.premiumToBeCharged) || 0,
        brokerage: Number(form.brokerage) || 0,
        grossPremium: Number(form.grossPremium) || 0,
        paymentTerm: form.paymentTerm ? Number(form.paymentTerm) : undefined,
        fee: Number(form.fee) || 0,
        totalDeduction: Number(form.totalDeduction) || 0,
        riskSummary: form.riskDescription,
      })
      setIsEditing(false)
      setInquiryState((current) =>
        current
          ? {
              ...current,
              name: form.name,
              productId: form.productId || undefined,
              productName: findOptionName(options.products, form.productId, current.productName),
              inquiryType: findOptionLabel(options.inquiryTypes, form.inquiryType, current.inquiryType),
              inquiryTypeValue: form.inquiryType ? Number(form.inquiryType) : current.inquiryTypeValue,
              status: findOptionLabel(options.inquiryStatuses, form.inquiryStatus, current.status),
              inquiryStatusValue: form.inquiryStatus ? Number(form.inquiryStatus) : current.inquiryStatusValue,
              planId: form.planId || undefined,
              planName: findOptionName(options.plans.map((item) => ({ id: item.id, name: item.name })), form.planId, current.planName),
              planDetails: form.planDetails,
              brokerId: form.brokerId || undefined,
              brokerName: findOptionName(options.brokers, form.brokerId, current.brokerName),
              coverType: findOptionLabel(options.coverTypes, form.coverType, current.coverType),
              riskScore: Number(form.riskScore) || 0,
              riskDescription: form.riskDescription,
              aiSummary: form.riskDescription,
              totalInsured: Number(form.totalSumInsured) || 0,
              territorialScope: form.territorialScope,
              basePremium: Number(form.basePremium) || 0,
              underwriterActionStatus: form.underwriterActionStatus ? Number(form.underwriterActionStatus) : null,
              underwriterSubAction: form.underwriterSubAction ? Number(form.underwriterSubAction) : null,
              totalCharge: Number(form.premiumToBeCharged) || 0,
              grossPremium: Number(form.grossPremium) || 0,
              paymentTerm: findOptionLabel(options.paymentTerms, form.paymentTerm, current.paymentTerm),
              fee: Number(form.fee) || 0,
            }
          : current,
      )
      setActionSuccess('Inquiry details updated successfully.')
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Unable to save inquiry details.')
    } finally {
      setSaveBusy(false)
    }
  }

  async function handleRiCapacityCheck() {
    if (!form) return
    const productId = form.productId || inquiry.productId || ''
    const totalSumInsured = Number(form.totalSumInsured) || 0

    if (!productId) {
      setSaveError('Select a product before checking RI Capacity.')
      return
    }
    if (!totalSumInsured || totalSumInsured <= 0) {
      setSaveError('Enter Total Sum Insured before checking RI Capacity.')
      return
    }

    try {
      setRiCapacityBusy(true)
      setSaveError(null)
      setRiCapacityMessage(null)
      await recalculateRiCapacityChecks({
        inquiryId: inquiryRecordId,
        productId,
        totalSumInsured,
      })
      setRiCapacityMessage('RI Capacity check requested successfully.')
      setSupplementaryRefreshKey((value) => value + 1)
      window.setTimeout(() => setRiCapacityMessage(null), 3500)
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Unable to run RI Capacity check.')
    } finally {
      setRiCapacityBusy(false)
    }
  }

  async function handleApplyConsequence(consequenceId: string) {
    if (!form) return
    const record = inquiry.consequenceResults.find((item) => item.id === consequenceId)
    if (!record || appliedConsequenceIds.includes(consequenceId)) return

    try {
      setPendingAction(consequenceId)
      setActionError(null)
      setActionSuccess(null)

      if (record.type === 'Case Control') {
        const disposition = toDisposition(record.action)
        if (!disposition) {
          throw new Error('This case control consequence cannot be applied to inquiry status.')
        }

        const nextStatusCode = inquiryStatusValueForDisposition(disposition)
        await applyInquiryConsequenceResult({
          inquiryId: inquiryRecordId,
          consequenceResultId: consequenceId,
          statusCode: nextStatusCode,
        })
        const nextStatusLabel = inquiryStatusLabelForDisposition(disposition)
        setForm((current) =>
          current
            ? {
                ...current,
                inquiryStatus: String(nextStatusCode),
              }
            : current,
        )
        setInquiryState((current) =>
          current
            ? {
                ...current,
                status: nextStatusLabel,
                inquiryStatusValue: nextStatusCode,
                consequenceResults: current.consequenceResults.map((item) =>
                  item.id === consequenceId
                    ? {
                        ...item,
                        actionStatusValue: APPLIED_ACTION_STATUS_VALUE,
                        actionStatusLabel: 'Applied',
                      }
                    : item,
                ),
              }
            : current,
        )
        setActionSuccess(`Applied ${record.action} to inquiry status.`)
      } else if (record.type === 'Risk') {
        if (record.action === 'Update Risk Score') {
          const increment = Number(record.riskScore ?? 0)
          if (!increment) {
            throw new Error('This risk-score consequence does not have a risk score configured.')
          }

          const updated = await applyInquiryConsequenceResult({
            inquiryId: inquiryRecordId,
            consequenceResultId: consequenceId,
            riskScoreIncrement: increment,
          })

          setForm((current) =>
            current
              ? {
                  ...current,
                  riskScore: String(updated.riskScore),
                }
              : current,
          )
          setInquiryState((current) =>
            current
              ? {
                  ...current,
                  riskScore: updated.riskScore,
                  consequenceResults: current.consequenceResults.map((item) =>
                    item.id === consequenceId
                      ? {
                          ...item,
                          actionStatusValue: APPLIED_ACTION_STATUS_VALUE,
                          actionStatusLabel: 'Applied',
                        }
                      : item,
                  ),
                }
              : current,
          )
          setActionSuccess(`Applied risk consequence. Risk Score updated to ${updated.riskScore}.`)
        } else if (record.action === 'Update Risk Summary') {
          const appendedSummary = record.riskSummary?.trim()
          if (!appendedSummary) {
            throw new Error('This risk-summary consequence does not have a risk summary configured.')
          }

          const updated = await applyInquiryConsequenceResult({
            inquiryId: inquiryRecordId,
            consequenceResultId: consequenceId,
            riskSummaryAppend: appendedSummary,
          })

          setInquiryState((current) =>
            current
              ? {
                  ...current,
                  aiSummary: updated.riskSummary,
                  consequenceResults: current.consequenceResults.map((item) =>
                    item.id === consequenceId
                      ? {
                          ...item,
                          actionStatusValue: APPLIED_ACTION_STATUS_VALUE,
                          actionStatusLabel: 'Applied',
                        }
                      : item,
                  ),
                }
              : current,
          )
          setActionSuccess('Applied risk consequence. Risk summary has been appended to the inquiry.')
        }
      } else if (record.type === 'Rating') {
        const currentBasePremium = Number(form.basePremium) || 0
        let nextBasePremium = currentBasePremium

        if (record.action === 'Add') {
          const addAmount = Number(record.ratingAdd ?? 0)
          if (!addAmount) {
            throw new Error('This rating consequence does not have an add amount configured.')
          }
          nextBasePremium = addAmount
        } else if (record.action === 'Multiply') {
          const multiplier = Number(record.ratingMultiply ?? 0)
          if (!multiplier) {
            throw new Error('This rating consequence does not have a multiplier configured.')
          }
          nextBasePremium = currentBasePremium * multiplier
        } else {
          throw new Error('This rating consequence cannot be applied.')
        }

        const updated = await applyInquiryConsequenceResult({
          inquiryId: inquiryRecordId,
          consequenceResultId: consequenceId,
          basePremium: nextBasePremium,
        })

        const premiumValue = String(updated.basePremium ?? nextBasePremium)
        setForm((current) =>
          current
            ? {
                ...current,
                basePremium: premiumValue,
                premiumToBeCharged: premiumValue,
              }
            : current,
        )
        setInquiryState((current) =>
          current
            ? {
                ...current,
                basePremium: updated.basePremium ?? nextBasePremium,
                totalCharge: updated.basePremium ?? nextBasePremium,
                consequenceResults: current.consequenceResults.map((item) =>
                  item.id === consequenceId
                    ? {
                        ...item,
                        actionStatusValue: APPLIED_ACTION_STATUS_VALUE,
                        actionStatusLabel: 'Applied',
                      }
                    : item,
                ),
              }
            : current,
        )
        setActionSuccess('Applied rating consequence. Base premium has been updated.')
      }

      setAppliedConsequenceIds((current) => [...new Set([...current, consequenceId])])
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Unable to apply consequence.')
    } finally {
      setPendingAction(null)
    }
  }

  async function handleApplyRatingOrder() {
    if (!form || inquiry.actionApplied || !inquiryRatingOrderItems.length) return

    try {
      setPendingAction('rating-order')
      setActionError(null)
      setActionSuccess(null)

      const basePremium = Number(form.basePremium) || 0
      const addedPremium = inquiryRatingOrderItems
        .filter((item) => item.action === 'Add')
        .reduce((sum, item) => sum + Number(item.addAmount ?? 0), basePremium)
      const nextPremium = inquiryRatingOrderItems
        .filter((item) => item.action === 'Multiply')
        .reduce((value, item) => value * (Number(item.multiplyValue ?? 1) || 1), addedPremium)

      const updated = await applyInquiryRatingOrder({
        inquiryId: inquiryRecordId,
        premiumToBeCharged: nextPremium,
      })

      setForm((current) =>
        current
          ? {
              ...current,
              premiumToBeCharged: String(updated.premiumToBeCharged),
            }
          : current,
      )
      setInquiryState((current) =>
        current
          ? {
              ...current,
              totalCharge: updated.premiumToBeCharged,
              actionApplied: updated.actionApplied,
            }
          : current,
      )
      setActionSuccess('Premium rating order applied successfully.')
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Unable to apply rating order.')
    } finally {
      setPendingAction(null)
    }
  }

  async function handleComposeEmail() {
    try {
      const descriptionHtml = composerEditorRef.current?.innerHTML?.trim() || composer.description.trim()
      if (!composer.subject.trim() || !composer.toRecipients.trim()) {
        throw new Error('Recipient and subject are required before composing the email.')
      }
      setComposeBusy(true)
      setComposeError(null)
      setActionSuccess(null)
      await createInquiryEmail(inquiryRecordId, {
        sender: composer.sender.trim(),
        toRecipients: composer.toRecipients.trim(),
        subject: composer.subject.trim(),
        description: descriptionHtml,
      })
      setActionSuccess('Email activity created and linked to this inquiry.')
      setIsComposerOpen(false)
      setComposer((current) => ({
        ...current,
        subject: `Regarding ${inquiry.inquiryNumber}`,
        description: '',
      }))
      if (composerEditorRef.current) composerEditorRef.current.innerHTML = ''
      triggerWorkspaceRefresh()
    } catch (cause) {
      setComposeError(cause instanceof Error ? cause.message : 'Unable to compose the inquiry email.')
    } finally {
      setComposeBusy(false)
    }
  }

  function toggleEmail(emailId: string) {
    setExpandedEmailIds((current) =>
      current.includes(emailId) ? current.filter((id) => id !== emailId) : [...current, emailId],
    )
  }

  function applyComposerFormat(command: 'bold' | 'italic' | 'underline' | 'insertUnorderedList') {
    if (!composerEditorRef.current) return
    composerEditorRef.current.focus()
    document.execCommand(command)
    setComposer((current) => ({
      ...current,
      description: composerEditorRef.current?.innerHTML ?? current.description,
    }))
  }

  function handleMakeDraft() {
    const missingRuleNames = Array.from(
      new Set(
        missingQuoteDetails.map((detail) => detail.businessRuleName).filter(Boolean),
      ),
    )
    if (missingRuleNames.length === 0) return

    const brokerContactName = form?.brokerAgentName && form.brokerAgentName !== 'No broker agent linked'
      ? form.brokerAgentName
      : 'Broker'
    const extractedEmail = extractEmailAddress(inquiry.name)
    const recipientEmail = extractedEmail || inquiry.contact?.email || inquiry.account?.email || composer.toRecipients
    const senderEmail = user.email ?? composer.sender ?? 'underwriting@insureai.com'
    const senderPhone = user.phone ?? '+971 4 000 0000'
    const subject = `Missing information required - ${inquiry.productName} - ${inquiry.inquiryNumber}`
    const missingItemsHtml = missingRuleNames.map((name) => `<li>${escapeHtml(name)}</li>`).join('')
    const referenceNames = missingRuleNames
      .map(
        (name) => `
          <li>
            <strong>${escapeHtml(name)}</strong>
          </li>`,
      )
      .join('')
    const description = `
      <p>Dear ${escapeHtml(brokerContactName)},</p>
      <p>Thank you for your submission for <strong>${escapeHtml(inquiry.name)}</strong> (${escapeHtml(
        inquiry.inquiryNumber,
      )}) for <strong>${escapeHtml(inquiry.productName)}</strong>.</p>
      <p>Our underwriting review has identified the following outstanding item(s) required before we can proceed with this submission:</p>
      <ul>${missingItemsHtml}</ul>
      <p><strong>Reference details:</strong></p>
      <p>&nbsp;</p>
      <ol>${referenceNames}</ol>
      <p>Please provide the above at your earliest convenience.</p>
      <p>If any of the above is not applicable or you require clarification on a specific item, please let us know and we will be happy to assist.</p>
      <p>Kind regards,</p>
      <p>${escapeHtml(user.name)}<br/>Underwriting Team<br/>InsureAI<br/>${escapeHtml(senderEmail)} | ${escapeHtml(
        senderPhone,
      )}</p>
    `.replace(/\n\s+/g, '')

    setComposer({
      sender: senderEmail,
      toRecipients: recipientEmail,
      subject,
      description,
    })
    setComposeError(null)
    setComposerEditorVersion((value) => value + 1)
    setActiveTab('details')
    setEmailPanelMode('expanded')
    setIsComposerOpen(true)
  }

  function handleQuoteDetailDraftChange(quoteDetailId: string, value: string) {
    setQuoteDetailDrafts((current) => ({
      ...current,
      [quoteDetailId]: value,
    }))
    setQuoteDetailSaveState((current) => ({
      ...current,
      [quoteDetailId]: {
        ...current[quoteDetailId],
        success: null,
        error: null,
      },
    }))
  }

  async function handleSaveQuoteDetailResponse(quoteDetailId: string) {
    const currentDetail = inquiry.quoteDetails.find((detail) => detail.id === quoteDetailId)
    if (!currentDetail) return

    const nextResponse = quoteDetailDrafts[quoteDetailId] ?? currentDetail.response ?? ''
    if (nextResponse === currentDetail.response) return

    try {
      setQuoteDetailSaveState((current) => ({
        ...current,
        [quoteDetailId]: {
          saving: true,
          success: null,
          error: null,
        },
      }))

      await updateInquiryQuoteDetailResponse(quoteDetailId, nextResponse)

      setInquiryState((current) =>
        current
          ? {
              ...current,
              quoteDetails: current.quoteDetails.map((detail) =>
                detail.id === quoteDetailId
                  ? {
                      ...detail,
                      response: nextResponse,
                    }
                  : detail,
              ),
            }
          : current,
      )
      setQuoteDetailDrafts((current) => ({
        ...current,
        [quoteDetailId]: nextResponse,
      }))
      setQuoteDetailSaveState((current) => ({
        ...current,
        [quoteDetailId]: {
          saving: false,
          success: 'Saved',
          error: null,
        },
      }))
      window.setTimeout(() => {
        setQuoteDetailSaveState((current) => ({
          ...current,
          [quoteDetailId]: {
            ...current[quoteDetailId],
            success: null,
          },
        }))
      }, 2200)
    } catch (cause) {
      setQuoteDetailSaveState((current) => ({
        ...current,
        [quoteDetailId]: {
          saving: false,
          success: null,
          error: cause instanceof Error ? cause.message : 'Unable to save response.',
        },
      }))
    }
  }

  async function handleOpenConsequenceTemplate(
    consequenceId: string,
    preferredKind: 'document' | 'email',
  ) {
    try {
      setTemplatePreviewBusy(true)
      setTemplatePreviewError(null)
      const result = await getConsequenceLinkedTemplatePreview(consequenceId, preferredKind)
      setTemplatePreview(result)
    } catch (cause) {
      setTemplatePreview(null)
      setTemplatePreviewError(
        cause instanceof Error ? cause.message : 'Unable to load the linked template.',
      )
    } finally {
      setTemplatePreviewBusy(false)
    }
  }

  function toggleEmailPanel() {
    setEmailPanelMode((current) => (current === 'expanded' ? 'collapsed' : 'expanded'))
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/inquiries">
          <ArrowLeft className="h-4 w-4" />
          Back to inquiries
        </Link>
      </Button>

      <section className="space-y-5 rounded-[28px] border border-border-soft bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(245,248,252,0.9)_100%)] px-6 py-6 shadow-soft dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.9)_0%,rgba(15,23,42,0.78)_100%)]">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="new">{inquiry.inquiryNumber}</Badge>
              <Badge variant="review">{inquiry.inquiryType}</Badge>
              <Badge variant="pending">{inquiry.status}</Badge>
            </div>
            <div>
              <h1 className="text-[22px] font-bold tracking-[-0.02em]">{inquiry.name}</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {inquiry.productName} - {inquiry.planName} - {formatDate(inquiry.createdOn)}
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="rounded-[20px] border border-primary/12 bg-white/70 px-4 py-3 shadow-soft dark:bg-slate-950/35">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    Overall Completeness
                  </p>
                  <p className="mt-1 text-[34px] font-bold leading-none">{formatPercent(inquiry.readiness[0]?.value ?? 0)}</p>
                </div>
                <div className="h-12 w-12 rounded-full border-[3px] border-primary/12 p-1">
                  <div
                    className="h-full rounded-full bg-gradient-to-br from-primary to-info"
                    style={{ clipPath: `inset(${100 - (inquiry.readiness[0]?.value ?? 0)}% 0 0 0)` }}
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              {isEditing ? (
                <>
                  <Button type="button" variant="secondary" size="sm" disabled={saveBusy} onClick={resetForm}>
                    Cancel
                  </Button>
                  <Button type="button" size="sm" disabled={saveBusy} onClick={() => void handleSaveDetails()}>
                    <Save className="h-4 w-4" />
                    {saveBusy ? 'Saving...' : 'Save Inquiry'}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="bg-white hover:bg-surface dark:bg-surface dark:hover:bg-surface-soft"
                  onClick={() => setIsEditing(true)}
                >
                  Edit Inquiry
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                className="bg-white hover:bg-surface dark:bg-surface dark:hover:bg-surface-soft"
                disabled={pendingAction === 'refer'}
                onClick={() => void handleDisposition('RefertoUnderwriter', 'refer')}
              >
                Refer
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-white hover:bg-surface dark:bg-surface dark:hover:bg-surface-soft"
                disabled={pendingAction === 'escalate'}
                onClick={() => void handleDisposition('EscalatetoHeadofAviation', 'escalate')}
              >
                Escalate
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-white hover:bg-surface dark:bg-surface dark:hover:bg-surface-soft"
                disabled={pendingAction === 'decline'}
                onClick={() => void handleDisposition('Decline', 'decline')}
              >
                Decline
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="bg-white hover:bg-surface dark:bg-surface dark:hover:bg-surface-soft"
                disabled={!wonQuotes.length}
                onClick={openCopyQuotesModal}
              >
                <CopyPlus className="h-4 w-4" />
                Copy Quotes
              </Button>
              {notifications.length ? (
                <div ref={notificationMenuRef} className="relative">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="relative gap-2 rounded-full border border-primary/12 bg-white text-foreground hover:border-primary/20 hover:bg-primary/[0.04] dark:border-white/10 dark:bg-surface dark:text-slate-100 dark:hover:bg-surface-soft"
                    onClick={() => setIsNotificationMenuOpen((current) => !current)}
                  >
                    <BellRing className="h-4 w-4 text-primary" />
                    Notifications
                    <span className="inline-flex min-w-[1.4rem] items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-bold text-white shadow-soft">
                      {notifications.length}
                    </span>
                  </Button>
                  {isNotificationMenuOpen ? (
                    <div className="absolute right-0 top-[calc(100%+0.7rem)] z-50 w-[360px] overflow-hidden rounded-[24px] border border-border-soft bg-white shadow-[0_22px_48px_rgba(15,23,42,0.16)] dark:border-white/10 dark:bg-[#1E293B]">
                      <div className="border-b border-border-soft bg-[linear-gradient(180deg,rgba(245,248,252,0.95)_0%,rgba(255,255,255,0.92)_100%)] px-4 py-4 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.92)_0%,rgba(30,41,59,0.82)_100%)]">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
                            <BellRing className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">Notifications</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {notifications.length} active workflow item{notifications.length === 1 ? '' : 's'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="max-h-[282px] overflow-y-auto bg-[linear-gradient(180deg,rgba(248,250,252,0.9)_0%,rgba(255,255,255,0.96)_100%)] p-3 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.8)_0%,rgba(15,23,42,0.56)_100%)]">
                        {notifications.map((notification) => {
                          return (
                            <div
                              key={notification.serial}
                              className="mb-3 rounded-2xl border border-border-soft bg-white/95 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/15 hover:shadow-[0_14px_30px_rgba(37,99,235,0.12)] dark:border-white/10 dark:bg-white/5"
                            >
                              <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                                    {notification.serial}
                                  </span>
                                  <div className="flex min-w-0 items-center gap-2">
                                    <span className="inline-flex rounded-full border border-primary/12 bg-primary/[0.06] px-2.5 py-1 text-[11px] font-semibold text-primary dark:border-primary/20 dark:bg-primary/15 dark:text-slate-100">
                                      Workflow notice
                                    </span>
                                  </div>
                                </div>
                                <p className="text-sm font-medium leading-6 text-foreground">
                                  {notification.message}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            {actionError ? <p className="text-sm text-danger lg:text-right">{actionError}</p> : null}
            {saveError ? <p className="text-sm text-danger lg:text-right">{saveError}</p> : null}
            {actionSuccess ? <p className="text-sm text-success lg:text-right">{actionSuccess}</p> : null}
          </div>
        </div>
      </section>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="details" icon={LayoutGrid}>Details</TabsTrigger>
          <TabsTrigger value="actions" icon={ShieldAlert}>Actions</TabsTrigger>
          <TabsTrigger value="quotes" icon={FileText}>Quotes</TabsTrigger>
          <TabsTrigger value="ri-capacity" icon={Calculator}>RI Capacity Checks</TabsTrigger>
          <TabsTrigger value="documents" icon={FolderOpen}>Documents</TabsTrigger>
          <TabsTrigger value="history" icon={History}>History</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="mt-4">
          {!form ? null : (
            <div className="space-y-6">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
                <div className="space-y-6">
                  <Card className="space-y-5">
                    <SectionHeader title="Details" description="Core inquiry identity, product, and relationship fields." />
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Name">
                        {isEditing ? (
                          <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                        ) : (
                          <ReadOnlyValue value={form.name} />
                        )}
                      </Field>
                      <Field label="Product">
                        {isEditing ? (
                          <SelectField value={form.productId} onChange={(value) => setForm({ ...form, productId: value })} options={options.products} />
                        ) : (
                          <ReadOnlyValue value={inquiry.productName} />
                        )}
                      </Field>
                      <Field label="Inquiry Type">
                        {isEditing ? (
                          <SelectField value={form.inquiryType} onChange={(value) => setForm({ ...form, inquiryType: value })} options={options.inquiryTypes} />
                        ) : (
                          <ReadOnlyValue value={findOptionLabel(options.inquiryTypes, form.inquiryType, inquiry.inquiryType)} />
                        )}
                      </Field>
                      <Field label="Inquiry Status">
                        {isEditing ? (
                          <SelectField value={form.inquiryStatus} onChange={(value) => setForm({ ...form, inquiryStatus: value })} options={options.inquiryStatuses} />
                        ) : (
                          <ReadOnlyValue value={findOptionLabel(options.inquiryStatuses, form.inquiryStatus, inquiry.status)} />
                        )}
                      </Field>
                      <Field label="Plan">
                        {isEditing ? (
                          <SelectField value={form.planId} onChange={(value) => setForm({ ...form, planId: value })} options={options.plans.map((item) => ({ id: item.id, name: item.name }))} />
                        ) : (
                          <ReadOnlyValue value={inquiry.planName} />
                        )}
                      </Field>
                      <Field label="Broker">
                        {isEditing ? (
                          <SelectField value={form.brokerId} onChange={(value) => setForm({ ...form, brokerId: value })} options={options.brokers} />
                        ) : (
                          <ReadOnlyValue value={inquiry.brokerName} />
                        )}
                      </Field>
                      <Field label="Broker Agent">
                        <ReadOnlyValue value={form.brokerAgentName} />
                      </Field>
                      <div className="md:col-span-2">
                        <Field label="Plan Details">
                          {isEditing ? (
                            <textarea
                              className="form-field-surface min-h-[118px] w-full rounded-[16px] border border-border-soft px-4 py-3 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                              value={form.planDetails}
                              onChange={(event) => setForm({ ...form, planDetails: event.target.value })}
                              placeholder="Enter plan details"
                            />
                          ) : (
                            <PlanDetailsPreview value={form.planDetails} />
                          )}
                        </Field>
                      </div>
                    </div>
                  </Card>

                  <Card className="space-y-5">
                    <SectionHeader title="Underwriting Action" description="Record the underwriting decision and its associated reason." />
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Underwriter Action Status">
                        {isEditing ? (
                          <SelectField value={form.underwriterActionStatus} options={underwriterActions} onChange={(value) => setForm({ ...form, underwriterActionStatus: value, underwriterSubAction: '' })} />
                        ) : (
                          <ReadOnlyValue value={findOptionLabel(underwriterActions, form.underwriterActionStatus, 'Not selected')} />
                        )}
                      </Field>
                      <Field label="Underwriter Sub Action">
                        {isEditing ? (
                          <SelectField value={form.underwriterSubAction} options={getUnderwriterSubActions(form.underwriterActionStatus)} disabled={!form.underwriterActionStatus} onChange={(value) => setForm({ ...form, underwriterSubAction: value })} />
                        ) : (
                          <ReadOnlyValue value={findOptionLabel(getUnderwriterSubActions(form.underwriterActionStatus), form.underwriterSubAction, 'Not selected')} />
                        )}
                      </Field>
                    </div>
                  </Card>

                  <Card className="space-y-5">
                    <SectionHeader title="Risk" description="Exposure, scope, and risk intelligence inputs for underwriting." />
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Cover Type">
                        {isEditing ? (
                          <SelectField value={form.coverType} onChange={(value) => setForm({ ...form, coverType: value })} options={options.coverTypes} />
                        ) : (
                          <ReadOnlyValue value={findOptionLabel(options.coverTypes, form.coverType, inquiry.coverType)} />
                        )}
                      </Field>
                      <Field label="Risk Score">
                        {isEditing ? (
                          <Input type="number" value={form.riskScore} onChange={(event) => setForm({ ...form, riskScore: event.target.value })} />
                        ) : (
                          <ReadOnlyValue value={form.riskScore} />
                        )}
                      </Field>
                      <div className="md:col-span-2">
                        <Field label="Total Sum Insured">
                          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                            {isEditing ? (
                              <Input type="number" value={form.totalSumInsured} onChange={(event) => setForm({ ...form, totalSumInsured: event.target.value })} />
                            ) : (
                              <ReadOnlyValue value={form.totalSumInsured} />
                            )}
                            <Button
                              type="button"
                              className="h-[46px] shrink-0 rounded-[16px] bg-[linear-gradient(135deg,#286CFF,#4F98FF)] px-5 shadow-[0_16px_30px_rgba(40,108,255,0.22)] transition hover:-translate-y-0.5"
                              disabled={riCapacityBusy}
                              onClick={() => void handleRiCapacityCheck()}
                            >
                              {riCapacityBusy ? (
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                              ) : (
                                <Calculator className="h-4 w-4" />
                              )}
                              {riCapacityBusy ? 'Checking RI Capacity...' : 'Check RI - Capacity'}
                            </Button>
                          </div>
                          {riCapacityMessage ? (
                            <p className="mt-2 text-xs font-semibold text-primary">{riCapacityMessage}</p>
                          ) : null}
                        </Field>
                      </div>
                      <Field label="Territorial Scope">
                        {isEditing ? (
                          <Input value={form.territorialScope} onChange={(event) => setForm({ ...form, territorialScope: event.target.value })} />
                        ) : (
                          <ReadOnlyValue value={form.territorialScope} />
                        )}
                      </Field>
                      <Field label="No of Items">
                        {isEditing ? (
                          <Input value={form.noOfItems} onChange={(event) => setForm({ ...form, noOfItems: event.target.value })} />
                        ) : (
                          <ReadOnlyValue value={form.noOfItems || 'Not provided'} />
                        )}
                      </Field>
                      <div className="md:col-span-2">
                        <Field label="Risk Summary">
                          {isEditing ? (
                            <textarea
                              className="form-field-surface min-h-28 w-full rounded-[16px] border border-border px-3 py-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                              value={form.riskDescription}
                              onChange={(event) => setForm({ ...form, riskDescription: event.target.value })}
                            />
                          ) : (
                            <ReadOnlyText value={form.riskDescription} />
                          )}
                        </Field>
                      </div>
                    </div>
                  </Card>

                  {findOptionName(options.products, form.productId, inquiry.productName).trim().toLowerCase() === 'motor insurance' ? (
                    <>
                      <MotorInformationSection title="Driver Information" data={inquiry.customerData} driver />
                      <MotorInformationSection title="Vehicle Information" data={inquiry.customerData} />
                    </>
                  ) : null}
                  <Card className="space-y-5">
                    <SectionHeader title="Premium" description="Commercial premium and deduction controls for the inquiry." />
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Base Premium Percentage">
                        {isEditing ? (
                          <AmountInput value={form.basePremium} suffix="%" maximumFractionDigits={0} onValueChange={(value) => setForm({ ...form, basePremium: value })} />
                        ) : (
                          <ReadOnlyValue value={`${formatAmount(form.basePremium, 0)}%`} />
                        )}
                      </Field>
                      <div className="relative space-y-2.5">
                        <div className="pr-8">
                          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Premium to be Charged</p>
                          <div className="absolute right-0 top-[-3px]">
                          <PlanPricingOrderPopover
                            items={inquiryRatingOrderItems}
                            loading={isHydratingSupplementary}
                            planName={inquiry.planName}
                            canApply={!inquiry.actionApplied && inquiryRatingOrderItems.length > 0}
                            applying={pendingAction === 'rating-order'}
                            onApply={() => void handleApplyRatingOrder()}
                          />
                          </div>
                        </div>
                        {isEditing ? (
                          <AmountInput value={form.premiumToBeCharged} onValueChange={(value) => setForm({ ...form, premiumToBeCharged: value })} />
                        ) : (
                          <ReadOnlyValue value={formatAmount(form.premiumToBeCharged)} />
                        )}
                      </div>
                      <Field label="Brokerage">
                        {isEditing ? (
                          <Input type="number" value={form.brokerage} onChange={(event) => setForm({ ...form, brokerage: event.target.value })} />
                        ) : (
                          <ReadOnlyValue value={form.brokerage} />
                        )}
                      </Field>
                      <Field label="Gross Premium">
                        {isEditing ? (
                          <AmountInput value={form.grossPremium} onValueChange={(value) => setForm({ ...form, grossPremium: value })} />
                        ) : (
                          <ReadOnlyValue value={formatAmount(form.grossPremium)} />
                        )}
                      </Field>
                      <Field label="Payment Term">
                        {isEditing ? (
                          <SelectField value={form.paymentTerm} onChange={(value) => setForm({ ...form, paymentTerm: value })} options={options.paymentTerms} />
                        ) : (
                          <ReadOnlyValue value={findOptionLabel(options.paymentTerms, form.paymentTerm, inquiry.paymentTerm)} />
                        )}
                      </Field>
                      <Field label="Fee">
                        {isEditing ? (
                          <AmountInput value={form.fee} onValueChange={(value) => setForm({ ...form, fee: value })} />
                        ) : (
                          <ReadOnlyValue value={formatAmount(form.fee)} />
                        )}
                      </Field>
                      <Field label="Total Deduction">
                        {isEditing ? (
                          <Input type="number" value={form.totalDeduction} onChange={(event) => setForm({ ...form, totalDeduction: event.target.value })} />
                        ) : (
                          <ReadOnlyValue value={form.totalDeduction} />
                        )}
                      </Field>
                      <Field label="Vehicle Value">
                        <ReadOnlyValue value={formatAmount(vehicleValueAverage(inquiry.vehicleValue)) || 'Not available'} />
                      </Field>
                    </div>
                  </Card>

                  <Card className="mt-5 space-y-5 rounded-[28px] border border-[#E9D5FF] bg-gradient-to-b from-[#FDF7FF] via-white to-white p-4 dark:border-white/10 dark:from-[#2A123D] dark:via-[#231735] dark:to-[#1E293B] sm:p-5">
                    <div className="flex flex-col gap-4 border-b border-[#E9D5FF] pb-5 md:flex-row md:items-start md:justify-between dark:border-white/10">
                      <div className="flex items-center gap-3">
                        <Sparkles className="h-6 w-6 text-[#A855F7]" />
                        <div>
                          <h3 className="text-xl font-semibold">AI Extracted Response</h3>
                          <p className="text-sm text-muted-foreground">Editable underwriting responses captured against this inquiry.</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 md:justify-end">
                        <Button
                          type="button"
                          variant="ai"
                          className="whitespace-nowrap bg-[#A855F7] text-white shadow-[0_14px_30px_rgba(168,85,247,0.24)] hover:bg-[#9333EA]"
                          onClick={() => setIsAiReevaluateOpen(true)}
                        >
                          <Sparkles className="h-4 w-4" />
                          Re-evaluate AI Extraction
                        </Button>
                        {missingQuoteDetails.length ? (
                          <Button
                            type="button"
                            variant="secondary"
                            className="whitespace-nowrap border-[#E9D5FF] bg-white text-[#7E22CE] hover:bg-[#FDF4FF] dark:border-white/10 dark:bg-[#1E293B] dark:text-[#E9D5FF]"
                            onClick={handleMakeDraft}
                          >
                            <MailPlus className="h-4 w-4" />
                            Request a Draft
                          </Button>
                        ) : null}
                        <div className="inline-flex items-center gap-1 rounded-full border border-[#E9D5FF] bg-white/90 p-1 shadow-[0_8px_22px_rgba(168,85,247,0.08)] dark:border-white/10 dark:bg-[#241533]/90">
                          <Button
                            type="button"
                            variant={aiView === 'card' ? 'ai' : 'ghost'}
                            size="sm"
                            className={aiView === 'card' ? 'h-9 w-9 rounded-full px-0' : 'h-9 w-9 rounded-full px-0 text-[#A855F7] hover:bg-[#F5E8FF] hover:text-[#7E22CE] dark:text-[#E9D5FF] dark:hover:bg-white/10'}
                            onClick={() => setAiView('card')}
                            aria-label="Card view"
                            title="Card view"
                          >
                            <LayoutGrid className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant={aiView === 'table' ? 'ai' : 'ghost'}
                            size="sm"
                            className={aiView === 'table' ? 'h-9 w-9 rounded-full px-0' : 'h-9 w-9 rounded-full px-0 text-[#A855F7] hover:bg-[#F5E8FF] hover:text-[#7E22CE] dark:text-[#E9D5FF] dark:hover:bg-white/10'}
                            onClick={() => setAiView('table')}
                            aria-label="Table view"
                            title="Table view"
                          >
                            <Rows3 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[22px] border border-[#E9D5FF] bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(253,247,255,0.98)_100%)] px-5 py-4 shadow-[0_10px_26px_rgba(168,85,247,0.08)] dark:border-[#6D28D9]/30 dark:bg-[linear-gradient(180deg,rgba(42,18,61,0.96)_0%,rgba(30,41,59,0.94)_100%)]">
                      <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">AI Generated Summary</p>
                      <p className="mt-3 text-sm leading-7 text-foreground/90">
                        {inquiry.summary || 'No AI generated summary is available for this inquiry yet.'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {aiCategoryFilters.map((filter) => (
                        <Button
                          key={filter.label}
                          type="button"
                          variant={aiCategory === filter.label ? 'ai' : 'secondary'}
                          size="sm"
                          className={
                            aiCategory === filter.label
                              ? 'rounded-full'
                              : 'rounded-full border-[#E9D5FF] bg-white/90 text-[#7E22CE] hover:bg-[#FDF4FF] dark:border-white/10 dark:bg-[#241533]/85 dark:text-[#E9D5FF] dark:hover:bg-white/10'
                          }
                          onClick={() => setAiCategory(filter.label)}
                        >
                          {filter.label}
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[11px] ${
                              aiCategory === filter.label
                                ? 'bg-white/20 text-white'
                                : 'bg-[#F5E8FF] text-[#7E22CE] dark:bg-white/10 dark:text-[#E9D5FF]'
                            }`}
                          >
                            {filter.count}
                          </span>
                        </Button>
                      ))}
                    </div>

                    {isHydratingSupplementary ? (
                      <InlineSectionLoading
                        title="Loading AI responses"
                        description="We are syncing extracted responses and business-rule context for this inquiry."
                      />
                    ) : quoteDetails.length === 0 ? (
                      <Card className="border-dashed border-border bg-surface-soft/70 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
                          <FileStack className="h-6 w-6" />
                        </div>
                        <h4 className="mt-4 text-lg font-semibold">No AI extracted responses found</h4>
                        <p className="mt-2 text-sm text-muted-foreground">No extracted AI response records are available for this inquiry yet.</p>
                      </Card>
                    ) : visibleQuoteDetailGroups.length === 0 ? (
                      <Card className="border-dashed border-border bg-surface-soft/70 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
                          <FileStack className="h-6 w-6" />
                        </div>
                        <h4 className="mt-4 text-lg font-semibold">No responses in this category</h4>
                        <p className="mt-2 text-sm text-muted-foreground">
                          No AI extracted responses match the selected category filter right now.
                        </p>
                      </Card>
                    ) : aiView === 'card' ? (
                      <div
                        className={`grid items-stretch gap-3 ${
                          emailPanelMode === 'expanded'
                            ? 'md:grid-cols-1 xl:grid-cols-2'
                            : 'md:grid-cols-2 2xl:grid-cols-3'
                        }`}
                      >
                        {visibleQuoteDetails.map((detail) => {
                          const draftValue = quoteDetailDrafts[detail.id] ?? detail.response ?? ''
                          const dirty = draftValue !== (detail.response ?? '')
                          const saveState = quoteDetailSaveState[detail.id]
                          const highlighted = draftValue.trim().toLowerCase() === 'no information provided'

                          return (
                            <div key={detail.id} className="relative z-0 h-full hover:z-30 focus-within:z-30">
                              <Card
                                variant="interactive"
                                className={`overflow-visible flex h-full flex-col gap-3 rounded-[20px] border px-3.5 py-3.5 shadow-[0_10px_24px_rgba(168,85,247,0.08)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(168,85,247,0.12)] dark:shadow-[0_10px_24px_rgba(2,6,23,0.22)] dark:hover:shadow-[0_14px_30px_rgba(76,29,149,0.26)] ${
                                  highlighted
                                    ? 'border-[#F3C4CF] bg-[#FFF1F4] dark:border-rose-400/25 dark:bg-rose-950/30'
                                    : 'border-[#E9D5FF] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,245,255,0.96)_100%)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(44,26,63,0.92)_0%,rgba(30,41,59,0.96)_100%)]'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="min-w-0">
                                      <div className="flex items-start gap-2">
                                        <p className={`line-clamp-2 text-sm font-semibold leading-5 ${highlighted ? 'text-rose-700 dark:text-rose-300' : 'text-foreground'}`}>
                                          {detail.name}
                                        </p>
                                        {detail.evidence ? <EvidenceTooltip evidence={detail.evidence} compact /> : null}
                                      </div>
                                      <div className="mt-1 flex flex-wrap gap-2">
                                        <span className="inline-flex items-center rounded-full border border-[#E9D5FF] bg-[#F9F1FF] px-2 py-0.5 text-[10px] font-semibold text-[#7E22CE] dark:border-white/10 dark:bg-white/10 dark:text-[#E9D5FF]">
                                          {detail.businessRuleCategory}
                                        </span>
                                        {dirty ? <span className="inline-flex items-center rounded-full border border-[#D8B4FE] bg-[#F5E8FF] px-2 py-0.5 text-[10px] font-semibold text-[#7E22CE] dark:border-white/10 dark:bg-white/10 dark:text-[#E9D5FF]">Unsaved</span> : null}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 flex-col items-center gap-1">
                                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#A855F7] dark:text-[#E9D5FF]">
                                      Confidence
                                    </span>
                                    {detail.confidenceScore !== undefined ? (
                                      <ConfidenceScoreIndicator score={detail.confidenceScore} />
                                    ) : null}
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <textarea
                                    className={`min-h-[54px] w-full resize-y rounded-[14px] border px-3 py-2 text-sm leading-5 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 ${
                                      highlighted
                                        ? 'border-[#F3C4CF] bg-[#FFF1F4] text-rose-700 placeholder:text-rose-400 focus:border-rose-300 focus:ring-rose-100 dark:border-rose-400/25 dark:bg-rose-950/25 dark:text-rose-200'
                                        : 'border-[#E9D5FF] bg-[#FCF7FF] text-[#4C1D95] placeholder:text-[#A78BFA] focus:border-[#C084FC] focus:ring-[#E9D5FF] dark:border-white/10 dark:bg-[#261738] dark:text-[#F3E8FF] dark:placeholder:text-[#C4B5FD]'
                                    }`}
                                    value={draftValue}
                                    onChange={(event) => handleQuoteDetailDraftChange(detail.id, event.target.value)}
                                  />
                                  <div className="min-h-[12px] text-xs leading-4">
                                    {saveState?.error ? <span className="text-danger">{saveState.error}</span> : null}
                                    {!saveState?.error && saveState?.success ? <span className="text-success">{saveState.success}</span> : null}
                                  </div>
                                </div>

                                <div className="mt-auto flex items-center justify-end pt-0">
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="rounded-full"
                                    disabled={!dirty || saveState?.saving}
                                    onClick={() => void handleSaveQuoteDetailResponse(detail.id)}
                                  >
                                    <Save className="h-4 w-4" />
                                    {saveState?.saving ? 'Saving...' : 'Save'}
                                  </Button>
                                </div>
                              </Card>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-[24px] border border-[#E9D5FF] bg-white/96 shadow-[0_10px_26px_rgba(168,85,247,0.08)] dark:border-white/10 dark:bg-[#20152E]/88">
                        <div className="overflow-x-auto">
                          <table className="min-w-[1180px] w-full border-collapse">
                            <thead className="bg-[#FCF7FF] dark:bg-[#261738]">
                              <tr>
                                <th className="px-4 py-3 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Quote Detail</th>
                                <th className="px-4 py-3 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Category</th>
                                <th className="px-4 py-3 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Confidence</th>
                                <th className="px-4 py-3 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Response</th>
                                <th className="px-4 py-3 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Source</th>
                                <th className="px-4 py-3 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {visibleQuoteDetails.map((detail) => {
                                const draftValue = quoteDetailDrafts[detail.id] ?? detail.response ?? ''
                                const dirty = draftValue !== (detail.response ?? '')
                                const saveState = quoteDetailSaveState[detail.id]
                                const highlighted = draftValue.trim().toLowerCase() === 'no information provided'

                                return (
                                  <tr key={detail.id} className="border-b border-[#F3E8FF] bg-white/90 align-top transition duration-150 hover:bg-[#FDF4FF] dark:border-white/10 dark:bg-transparent dark:hover:bg-white/5">
                                    <td className="px-4 py-3">
                                      <div className="space-y-0.5">
                                        <p className={`text-sm font-semibold ${highlighted ? 'text-rose-700 dark:text-rose-300' : 'text-foreground'}`}>{detail.name}</p>
                                        <Badge variant="approved">{detail.status}</Badge>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="inline-flex items-center rounded-full border border-[#E9D5FF] bg-[#F9F1FF] px-2.5 py-1 text-[12px] font-semibold text-[#7E22CE] dark:border-white/10 dark:bg-white/10 dark:text-[#E9D5FF]">
                                        {detail.businessRuleCategory}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      {detail.confidenceScore !== undefined ? (
                                        <ConfidenceScoreIndicator score={detail.confidenceScore} />
                                      ) : (
                                        <span className="text-xs text-muted-foreground">N/A</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      <textarea
                                        className={`min-h-[72px] w-full min-w-[240px] rounded-[16px] border px-3 py-2 text-sm leading-5 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 ${
                                          highlighted
                                            ? 'border-[#F3C4CF] bg-[#FFF1F4] text-rose-700 placeholder:text-rose-400 focus:border-rose-300 focus:ring-rose-100 dark:border-rose-400/25 dark:bg-rose-950/25 dark:text-rose-200'
                                            : 'border-[#E9D5FF] bg-[#FCF7FF] text-[#4C1D95] placeholder:text-[#A78BFA] focus:border-[#C084FC] focus:ring-[#E9D5FF] dark:border-white/10 dark:bg-[#261738] dark:text-[#F3E8FF] dark:placeholder:text-[#C4B5FD]'
                                        }`}
                                        value={draftValue}
                                        onChange={(event) => handleQuoteDetailDraftChange(detail.id, event.target.value)}
                                      />
                                      <div className="mt-1.5 min-h-[16px] text-xs">
                                        {saveState?.error ? <span className="text-danger">{saveState.error}</span> : null}
                                        {!saveState?.error && saveState?.success ? <span className="text-success">{saveState.success}</span> : null}
                                        {!saveState?.error && !saveState?.success && dirty ? <span className="text-muted-foreground">Unsaved changes</span> : null}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      {detail.evidence ? <EvidenceTooltip evidence={detail.evidence} compact /> : <span className="text-xs text-muted-foreground">N/A</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                      <Button type="button" size="sm" className="whitespace-nowrap" disabled={!dirty || saveState?.saving} onClick={() => void handleSaveQuoteDetailResponse(detail.id)}>
                                        <Save className="h-4 w-4" />
                                        {saveState?.saving ? 'Saving...' : 'Save'}
                                      </Button>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </Card>
                </div>

                <div className={`${emailPanelMode === 'collapsed' ? 'xl:w-[86px]' : 'xl:w-[min(47vw,710px)]'} transition-[width] duration-300`}>
                {emailPanelMode === 'collapsed' ? (
                  <CollapsedEmailRail
                    emailCount={emailTimeline.length}
                    inquiryNumber={inquiry.inquiryNumber}
                    latestEmailSubject={emailTimeline[0]?.subject}
                    onExpand={toggleEmailPanel}
                  />
                ) : (
                <Card variant="glass" className="space-y-5 overflow-hidden">
                  <div className="flex flex-col gap-4 border-b border-border-soft pb-5 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Email Activity Timeline</p>
                      <h3 className="text-2xl font-semibold tracking-[-0.02em]">Inquiry communications</h3>
                      <p className="text-sm text-muted-foreground">
                        All email activity linked to {inquiry.inquiryNumber} from the Dataverse email timeline.
                      </p>
                    </div>
                    <div className="hidden rounded-[18px] border border-border-soft bg-surface-soft px-4 py-3 text-sm">
                      <p className="font-semibold">{inquiry.accountName}</p>
                      <p className="mt-1 text-muted-foreground">{inquiry.productName} · {inquiry.planName}</p>
                      <p className="mt-1 text-muted-foreground">Broker: {inquiry.brokerName}</p>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="rounded-full border border-border-soft bg-white/90" onClick={toggleEmailPanel}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 lg:flex-row">
                      <Input
                        value={emailSearch}
                        onChange={(event) => setEmailSearch(event.target.value)}
                        placeholder="Search email activity..."
                      />
                      <Button type="button" variant={isComposerOpen ? 'secondary' : 'primary'} className="whitespace-nowrap" onClick={() => setIsComposerOpen((value) => !value)}>
                        <MailPlus className="h-4 w-4" />
                        {isComposerOpen ? 'Hide Composer' : 'Compose Email'}
                      </Button>
                    </div>

                    {isComposerOpen ? (
                      <div ref={composerSectionRef}>
                      <Card className="space-y-4 border border-primary/12 bg-[linear-gradient(180deg,rgba(37,99,235,0.06)_0%,rgba(255,255,255,0.6)_100%)] dark:bg-[linear-gradient(180deg,rgba(37,99,235,0.08)_0%,rgba(15,23,42,0.4)_100%)]">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Compose</p>
                            <p className="mt-1 text-sm text-muted-foreground">Create a new email activity and link it directly to this inquiry.</p>
                          </div>
                          <Badge variant="review">{inquiry.inquiryNumber}</Badge>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <Field label="Sender">
                            <Input value={composer.sender} onChange={(event) => setComposer({ ...composer, sender: event.target.value })} />
                          </Field>
                          <Field label="To Recipients">
                            <Input value={composer.toRecipients} onChange={(event) => setComposer({ ...composer, toRecipients: event.target.value })} />
                          </Field>
                        </div>
                        <Field label="Subject">
                          <Input value={composer.subject} onChange={(event) => setComposer({ ...composer, subject: event.target.value })} />
                        </Field>
                        <Field label="Description">
                          <div className="overflow-hidden rounded-[18px] border border-border bg-surface">
                            <div className="flex flex-wrap items-center gap-2 border-b border-border-soft bg-surface-soft px-3 py-2">
                              <Button type="button" variant="ghost" size="sm" className="rounded-xl" onClick={() => applyComposerFormat('bold')}>
                                <Bold className="h-4 w-4" />
                                Bold
                              </Button>
                              <Button type="button" variant="ghost" size="sm" className="rounded-xl" onClick={() => applyComposerFormat('italic')}>
                                <Italic className="h-4 w-4" />
                                Italic
                              </Button>
                              <Button type="button" variant="ghost" size="sm" className="rounded-xl" onClick={() => applyComposerFormat('underline')}>
                                <Underline className="h-4 w-4" />
                                Underline
                              </Button>
                              <Button type="button" variant="ghost" size="sm" className="rounded-xl" onClick={() => applyComposerFormat('insertUnorderedList')}>
                                <List className="h-4 w-4" />
                                Bullet List
                              </Button>
                            </div>
                            <div
                              key={composerEditorVersion}
                              ref={composerEditorRef}
                              contentEditable
                              suppressContentEditableWarning
                              className="min-h-32 px-4 py-3 text-sm outline-none prose prose-sm max-w-none dark:prose-invert"
                              dangerouslySetInnerHTML={{ __html: composer.description }}
                              onInput={(event) => {
                                const description = event.currentTarget.innerHTML
                                setComposer((current) => ({
                                  ...current,
                                  description,
                                }))
                              }}
                            />
                          </div>
                        </Field>
                        {composeError ? <p className="text-sm text-danger">{composeError}</p> : null}
                        <div className="flex flex-wrap justify-end gap-3">
                          <Button type="button" variant="secondary" onClick={() => setIsComposerOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="button" disabled={composeBusy} onClick={() => void handleComposeEmail()}>
                            <SendHorizontal className="h-4 w-4" />
                            {composeBusy ? 'Creating...' : 'Create Email Activity'}
                          </Button>
                        </div>
                      </Card>
                      </div>
                    ) : null}

                    {isHydratingSupplementary ? (
                      <InlineSectionLoading
                        title="Loading email activity"
                        description="Linked email conversations and attachments are still syncing."
                      />
                    ) : filteredEmails.length === 0 ? (
                      <Card className="border-dashed border-border bg-surface-soft/70 text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <MailCheck className="h-7 w-7" />
                        </div>
                        <h4 className="mt-4 text-lg font-semibold">No linked email activity</h4>
                        <p className="mt-2 text-sm text-muted-foreground">
                          This inquiry does not have any standard Dataverse email activity yet. Use compose to create the first linked email.
                        </p>
                      </Card>
                    ) : (
                      <div className="space-y-4">
                        {filteredEmails.map((email) => (
                          <div key={email.id} className="grid gap-4 md:grid-cols-[88px_40px_minmax(0,1fr)]">
                            <div className="flex flex-col items-start gap-2 pt-3 text-[12px] text-muted-foreground">
                              <span className="font-semibold">{formatDate(email.createdOn)}</span>
                              <span className="rounded-full border border-border-soft bg-surface-soft px-2.5 py-1 text-[11px] font-semibold text-foreground/80">
                                {email.status || 'Unknown'}
                              </span>
                            </div>
                            <div className="relative hidden justify-center pt-1 md:flex">
                              <div
                                className={`flex h-12 w-12 shrink-0 aspect-square items-center justify-center rounded-full border-4 border-white shadow-sm transition duration-300 ${expandedEmailIds.includes(email.id) ? 'bg-primary text-white shadow-[0_16px_30px_rgba(37,99,235,0.28)]' : 'bg-surface-soft text-primary'}`}
                              >
                                <Mail className="h-5 w-5" />
                              </div>
                              <div
                                className={`absolute top-14 w-[2px] ${expandedEmailIds.includes(email.id) ? 'bg-gradient-to-b from-primary to-primary/10' : 'bg-gradient-to-b from-border-soft to-transparent'}`}
                                style={{ height: 'calc(100% + 1rem)' }}
                              />
                            </div>
                            <Card variant="interactive" className="rounded-[24px] border border-border-soft bg-white shadow-[0_8px_22px_rgba(15,23,42,0.06)] dark:bg-slate-950/90 dark:shadow-[0_10px_24px_rgba(2,6,23,0.18)]">
                              <button
                                type="button"
                                className="flex w-full flex-col gap-4 text-left"
                                onClick={() => toggleEmail(email.id)}
                              >
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                  <div className="space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                                        {inquiry.inquiryNumber}
                                      </span>
                                      <span className="rounded-full border border-border-soft bg-surface-soft px-2.5 py-1 text-[11px] font-semibold text-foreground/80">
                                        {email.status || 'Unknown'}
                                      </span>
                                    </div>
                                    <h4 className="text-lg font-semibold">{email.subject}</h4>
                                    <div className="space-y-1 text-sm text-muted-foreground">
                                      <p>From: {email.sender}</p>
                                      <p>To: {email.toRecipients}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-start gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border-soft bg-surface-soft text-muted-foreground">
                                      {expandedEmailIds.includes(email.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </div>
                                  </div>
                                </div>
                                {!expandedEmailIds.includes(email.id) ? (
                                  <p className="line-clamp-2 text-sm leading-7 text-muted-foreground">
                                    {getEmailPreview(getPrimaryEmailText(email.body))}
                                  </p>
                                ) : null}
                              </button>
                              {email.attachments.length > 0 ? (
                                <div className="mt-4 border-t border-border-soft pt-5">
                                  <div className="flex items-center gap-2 text-sm font-semibold">
                                    <Paperclip className="h-4 w-4 text-primary" />
                                    Attachments ({email.attachments.length})
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2.5">
                                    {email.attachments.map((attachment) => (
                                      <div
                                        key={attachment.id}
                                        className="inline-flex max-w-full items-center gap-2 rounded-full border border-border-soft bg-surface-soft/90 px-3 py-2"
                                      >
                                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${attachmentAccent(attachment.mimeType).tone}`}>
                                          {attachmentAccent(attachment.mimeType).icon}
                                        </span>
                                        <div className="min-w-0">
                                          <p className="truncate text-sm font-semibold">{attachment.name}</p>
                                          <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                                            {attachment.sizeLabel ? <span>{attachment.sizeLabel}</span> : null}
                                            {attachment.mimeType ? <span>{attachment.mimeType}</span> : null}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                              {expandedEmailIds.includes(email.id) ? (
                                <div className="mt-4 border-t border-border-soft pt-5">
                                  <div
                                    className="prose prose-sm max-w-none whitespace-normal text-muted-foreground dark:prose-invert prose-p:leading-7 prose-div:leading-7 prose-li:leading-7"
                                    dangerouslySetInnerHTML={{ __html: getPrimaryEmailHtml(email.body) }}
                                  />
                                </div>
                              ) : null}
                            </Card>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
                )}
                </div>
              </div>
            </div>
          )}
        </TabsContent>
        <TabsContent value="ai" className="mt-4">
          <Card className="space-y-5">
            <div className="flex flex-col gap-4 border-b border-border-soft pb-5 md:flex-row md:items-start md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/12 text-secondary">
                  <FileStack className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">AI Extracted Response</h3>
                  <p className="text-sm text-muted-foreground">Captured responses, evidence, and business-rule decisions for this inquiry.</p>
                </div>
                <Badge variant="review">
                  <Sparkles className="mr-1 h-3.5 w-3.5" />
                  AI Layer
                </Badge>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ai"
                  size="sm"
                  className="whitespace-nowrap bg-[#A855F7] text-white shadow-[0_14px_30px_rgba(168,85,247,0.24)] hover:bg-[#9333EA]"
                  onClick={() => setIsAiReevaluateOpen(true)}
                >
                  <Sparkles className="h-4 w-4" />
                  Re-evaluate AI Extraction
                </Button>
                {missingQuoteDetails.length > 0 ? (
                  <Button type="button" variant="primary" size="sm" className="rounded-full" onClick={handleMakeDraft}>
                    <MailPlus className="h-4 w-4" />
                    Request a Draft
                  </Button>
                ) : null}
                <ViewToggle value={aiView} onChange={setAiView} />
              </div>
            </div>
            <div className="rounded-[22px] border border-border-soft bg-surface-soft/70 px-5 py-4 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(35,23,53,0.96)_0%,rgba(30,41,59,0.92)_100%)]">
              <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">AI Generated Summary</p>
              <p className="mt-3 text-sm leading-7 text-foreground/90">
                {inquiry.summary || 'No AI generated summary is available for this inquiry yet.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {aiCategoryFilters.map((filter) => (
                <Button
                  key={filter.label}
                  type="button"
                  variant={aiCategory === filter.label ? 'primary' : 'secondary'}
                  size="sm"
                  className="rounded-full"
                  onClick={() => setAiCategory(filter.label)}
                >
                  {filter.label}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[11px] ${
                      aiCategory === filter.label ? 'bg-white/20 text-white' : 'bg-surface text-muted-foreground'
                    }`}
                  >
                    {filter.count}
                  </span>
                </Button>
              ))}
            </div>
            {inquiry.quoteDetails.length === 0 ? (
              <Card className="border-dashed border-border bg-surface-soft/70 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
                  <FileStack className="h-6 w-6" />
                </div>
                <h4 className="mt-4 text-lg font-semibold">No AI extracted responses found</h4>
                <p className="mt-2 text-sm text-muted-foreground">No extracted AI response records are available for this inquiry yet.</p>
              </Card>
            ) : visibleQuoteDetailGroups.length === 0 ? (
              <Card className="border-dashed border-border bg-surface-soft/70 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
                  <FileStack className="h-6 w-6" />
                </div>
                <h4 className="mt-4 text-lg font-semibold">No responses in this category</h4>
                <p className="mt-2 text-sm text-muted-foreground">
                  No AI extracted responses match the selected category filter right now.
                </p>
              </Card>
            ) : aiView === 'card' ? (
              aiCategory === 'All' ? (
                <div className="grid gap-4 xl:grid-cols-3">
                  {visibleQuoteDetails.map((detail) => (
                    <Card key={detail.id} variant="interactive" className="space-y-4 rounded-[24px] border border-border-soft bg-white shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:bg-slate-950/95 dark:shadow-[0_12px_28px_rgba(2,6,23,0.22)]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2">
                          <h4 className="text-lg font-semibold">{detail.name}</h4>
                          <p className="text-sm text-muted-foreground">{detail.businessRuleName}</p>
                        </div>
                        <Badge variant="approved">{detail.status}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="neutral">{detail.businessRuleCategory}</Badge>
                        <Badge variant="info">{detail.conditionMet}</Badge>
                      </div>
                      <div className="space-y-3 rounded-[18px] border border-border-soft bg-surface-soft/80 p-4">
                        <div>
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Response</p>
                            {detail.evidence ? <EvidenceTooltip evidence={detail.evidence} /> : null}
                          </div>
                          <p className={`mt-2 text-sm ${getResponseTextClass(detail.response)}`}>
                            {detail.response || 'No response captured.'}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="space-y-5">
                  {visibleQuoteDetailGroups.map((group) => (
                    <section key={group.category} className="space-y-4">
                      <div className="grid gap-4 xl:grid-cols-3">
                        {group.items.map((detail) => (
                          <Card key={detail.id} variant="interactive" className="space-y-4 rounded-[24px] border border-border-soft bg-white shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:bg-slate-950/95 dark:shadow-[0_12px_28px_rgba(2,6,23,0.22)]">
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-2">
                                <h4 className="text-lg font-semibold">{detail.name}</h4>
                                <p className="text-sm text-muted-foreground">{detail.businessRuleName}</p>
                              </div>
                              <Badge variant="approved">{detail.status}</Badge>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="neutral">{detail.businessRuleCategory}</Badge>
                              <Badge variant="info">{detail.conditionMet}</Badge>
                            </div>
                            <div className="space-y-3 rounded-[18px] border border-border-soft bg-surface-soft/80 p-4">
                              <div>
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Response</p>
                                  {detail.evidence ? <EvidenceTooltip evidence={detail.evidence} /> : null}
                                </div>
                                <p className={`mt-2 text-sm ${getResponseTextClass(detail.response)}`}>
                                  {detail.response || 'No response captured.'}
                                </p>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )
            ) : (
              aiCategory === 'All' ? (
                <div className="overflow-hidden rounded-[24px] border border-border-soft">
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse">
                      <thead className="bg-surface-muted/80">
                        <tr>
                          <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Name</th>
                          <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Category</th>
                          <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Business Rule</th>
                          <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Response</th>
                          <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Evidence</th>
                          <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Condition</th>
                          <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inquiry.quoteDetails.map((detail) => (
                          <tr key={detail.id} className="border-b border-border-soft/80 bg-surface transition duration-150 hover:bg-primary/5">
                            <td className="px-4 py-4 text-sm font-semibold">{detail.name}</td>
                            <td className="px-4 py-4"><Badge variant="neutral">{detail.businessRuleCategory}</Badge></td>
                            <td className="px-4 py-4 text-sm text-muted-foreground">{detail.businessRuleName}</td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm ${getResponseTextClass(detail.response)}`}>
                                  {detail.response || 'No response captured.'}
                                </span>
                                {detail.evidence ? <EvidenceTooltip evidence={detail.evidence} compact /> : null}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-sm text-muted-foreground">{detail.evidence || 'No evidence provided.'}</td>
                            <td className="px-4 py-4"><Badge variant="info">{detail.conditionMet}</Badge></td>
                            <td className="px-4 py-4"><Badge variant="approved">{detail.status}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {visibleQuoteDetailGroups.map((group) => (
                    <section key={group.category} className="overflow-hidden rounded-[24px] border border-border-soft">
                      <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse">
                          <thead className="bg-surface-muted/80">
                            <tr>
                              <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Name</th>
                              <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Business Rule</th>
                              <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Response</th>
                              <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Evidence</th>
                              <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Condition</th>
                              <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.items.map((detail) => (
                              <tr key={detail.id} className="border-b border-border-soft/80 bg-surface transition duration-150 hover:bg-primary/5">
                                <td className="px-4 py-4 text-sm font-semibold">{detail.name}</td>
                                <td className="px-4 py-4 text-sm text-muted-foreground">{detail.businessRuleName}</td>
                                <td className="px-4 py-4">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm ${getResponseTextClass(detail.response)}`}>
                                      {detail.response || 'No response captured.'}
                                    </span>
                                    {detail.evidence ? <EvidenceTooltip evidence={detail.evidence} compact /> : null}
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-sm text-muted-foreground">{detail.evidence || 'No evidence provided.'}</td>
                                <td className="px-4 py-4"><Badge variant="info">{detail.conditionMet}</Badge></td>
                                <td className="px-4 py-4"><Badge variant="approved">{detail.status}</Badge></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ))}
                </div>
              )
            )}
          </Card>
        </TabsContent>
        <TabsContent value="actions" className="mt-4">
          <Card className="space-y-5">
            <div className="flex flex-col gap-4 border-b border-border-soft pb-5 md:flex-row md:items-start md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/12 text-warning">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">Actions</h3>
                  <p className="text-sm text-muted-foreground">Operational consequences and risk-control actions available for this inquiry.</p>
                </div>
              </div>
              <Badge variant="neutral">{groupedConsequenceResults.length} rule groups</Badge>
            </div>
            {isHydratingSupplementary ? (
              <InlineSectionLoading
                title="Loading action records"
                description="Consequence and risk action records are still being prepared for this inquiry."
              />
            ) : inquiry.consequenceResults.length === 0 ? (
              <Card className="border-dashed border-border bg-surface-soft/70 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-warning/10 text-warning">
                  <GitBranch className="h-6 w-6" />
                </div>
                <h4 className="mt-4 text-lg font-semibold">No action records found</h4>
                <p className="mt-2 text-sm text-muted-foreground">No consequence or risk action records are available for this inquiry yet.</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {groupedConsequenceResults.map((group) => {
                  const expanded = expandedActionGroups[group.ruleName] ?? false

                  return (
                    <Card key={group.ruleName} className="overflow-hidden rounded-[24px] border border-border-soft p-0">
                      <button
                        type="button"
                        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition hover:bg-primary/4"
                        onClick={() =>
                          setExpandedActionGroups((current) => ({
                            ...current,
                            [group.ruleName]: !expanded,
                          }))
                        }
                      >
                        <div className="min-w-0 space-y-2">
                          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                            Business Rule
                          </p>
                          <h4 className="text-base font-semibold leading-7">{group.ruleName}</h4>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <Badge variant="neutral">{group.results.length} actions</Badge>
                          {group.actionableCount ? <Badge variant="info">{group.actionableCount} apply</Badge> : null}
                          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </button>

                      {expanded ? (
                        <div className="border-t border-border-soft px-5 py-5">
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {group.results.map((result) => (
                              <Card
                                key={result.id}
                                variant="interactive"
                                className="flex h-full flex-col gap-3 rounded-[20px] border border-border-soft bg-white px-4 py-4 shadow-[0_8px_20px_rgba(15,23,42,0.05)] dark:bg-slate-950/90 dark:shadow-[0_10px_22px_rgba(2,6,23,0.18)]"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 space-y-1">
                                    <p className="line-clamp-2 text-sm font-semibold leading-6">{result.consequenceName}</p>
                                    <div className="flex flex-wrap gap-2">
                                      <Badge variant="review" className="px-2 py-0.5 text-[10px]">
                                        {result.type}
                                      </Badge>
                                      <Badge variant="info" className="max-w-[180px] px-2 py-0.5 text-[10px]">
                                        <span className="truncate">{result.action}</span>
                                      </Badge>
                                    </div>
                                  </div>
                                </div>

                                {result.type === 'Risk' && result.action === 'Update Risk Score' ? (
                                  <div className="rounded-[16px] border border-border-soft bg-surface-soft/70 px-3.5 py-3">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Risk Score</p>
                                    <p className="mt-1 text-sm font-semibold">{String(result.riskScore ?? 0)}</p>
                                  </div>
                                ) : null}

                                {result.type === 'Risk' && result.action === 'Update Risk Summary' ? (
                                  <div className="rounded-[16px] border border-border-soft bg-surface-soft/70 px-3.5 py-3">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Risk Summary</p>
                                    <p className="mt-1 text-sm leading-6 text-foreground/90">
                                      {result.riskSummary?.trim() || 'No risk summary configured'}
                                    </p>
                                  </div>
                                ) : null}

                                {result.type === 'Rating' && result.action === 'Add' ? (
                                  <div className="rounded-[16px] border border-border-soft bg-surface-soft/70 px-3.5 py-3">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Add Amount</p>
                                    <p className="mt-1 text-sm font-semibold">{formatCurrency(result.ratingAdd ?? 0)}</p>
                                  </div>
                                ) : null}

                                {result.type === 'Rating' && result.action === 'Multiply' ? (
                                  <div className="rounded-[16px] border border-border-soft bg-surface-soft/70 px-3.5 py-3">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Multiplier</p>
                                    <p className="mt-1 text-sm font-semibold">{result.ratingMultiply ?? 0}</p>
                                  </div>
                                ) : null}

                                {result.consequenceId &&
                                isConsequenceTemplateResult(result.type, result.action) ? (
                                  <div className="rounded-[16px] border border-border-soft bg-surface-soft/70 px-3.5 py-3">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                                      {result.type === 'Email' || result.action === 'Email'
                                        ? 'Email Template'
                                        : 'Document Template'}
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-2.5">
                                      <button
                                        type="button"
                                        className="inline-flex max-w-full items-center gap-2 rounded-full border border-border-soft bg-white px-3 py-2 text-left transition hover:border-primary/25 hover:bg-primary/5 dark:bg-slate-950/70"
                                        onClick={() =>
                                          void handleOpenConsequenceTemplate(
                                            result.consequenceId!,
                                            result.type === 'Email' || result.action === 'Email'
                                              ? 'email'
                                              : 'document',
                                          )
                                        }
                                      >
                                        <span
                                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                                            result.type === 'Email' || result.action === 'Email'
                                              ? 'bg-primary/10 text-primary'
                                              : 'bg-danger/10 text-danger'
                                          }`}
                                        >
                                          {result.type === 'Email' || result.action === 'Email' ? (
                                            <Mail className="h-4 w-4" />
                                          ) : (
                                            <FileText className="h-4 w-4" />
                                          )}
                                        </span>
                                        <div className="min-w-0">
                                          <p className="truncate text-sm font-semibold">
                                            {result.type === 'Email' || result.action === 'Email'
                                              ? result.emailTemplateName || 'Open email template'
                                              : result.documentTemplateName || 'Open document template'}
                                          </p>
                                          <p className="text-[11px] text-muted-foreground">Click to preview</p>
                                        </div>
                                      </button>
                                    </div>
                                  </div>
                                ) : null}

                                <div className="rounded-[16px] border border-border-soft bg-surface-soft/65 px-3.5 py-3 text-[12px] leading-6 text-muted-foreground">
                                  {canApplyConsequence(result.type, result.action)
                                    ? isConsequenceApplied(result.actionStatusValue) || appliedConsequenceIds.includes(result.id)
                                      ? 'Applied to the inquiry.'
                                      : result.type === 'Risk' && result.action === 'Update Risk Score'
                                        ? `Adds ${result.riskScore ?? 0} to the inquiry risk score.`
                                        : result.type === 'Risk' && result.action === 'Update Risk Summary'
                                          ? 'Appends the configured risk summary to the inquiry.'
                                        : 'Updates the inquiry status to match this action.'
                                    : 'Outcome recorded for reference only.'}
                                </div>

                                <div className="mt-auto flex items-center justify-between gap-3">
                                  <span className="text-[12px] text-muted-foreground">Recorded on {formatDate(result.createdOn)}</span>
                                  {canApplyConsequence(result.type, result.action) ? (
                                    isConsequenceApplied(result.actionStatusValue) || appliedConsequenceIds.includes(result.id) ? (
                                      <Button type="button" variant="secondary" size="sm" className="rounded-full bg-white" disabled>
                                        Applied
                                      </Button>
                                    ) : (
                                      <Button
                                        type="button"
                                        variant="primary"
                                        size="sm"
                                        className="rounded-full"
                                        disabled={pendingAction === result.id}
                                        onClick={() => void handleApplyConsequence(result.id)}
                                      >
                                        {pendingAction === result.id ? 'Applying...' : 'Apply'}
                                      </Button>
                                    )
                                  ) : null}
                                </div>
                              </Card>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </Card>
                  )
                })}
              </div>
            )}
          </Card>
        </TabsContent>
        <TabsContent value="quotes" className="mt-4">
          <Card className="space-y-5">
            <div className="flex flex-col gap-4 border-b border-border-soft pb-5 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-xl font-semibold">Quotes</h3>
                <p className="mt-1 text-sm text-muted-foreground">Review linked quotes in either a compact table or a richer card layout.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="primary"
                  disabled={pendingAction === 'quote'}
                  onClick={() => void handleCreateQuote()}
                >
                  Create Quote
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="bg-white dark:bg-[#1E293B]"
                  disabled={!wonQuotes.length}
                  onClick={openCopyQuotesModal}
                >
                  <CopyPlus className="h-4 w-4" />
                  Copy Quotes
                </Button>
                <ViewToggle value={quoteView} onChange={setQuoteView} />
              </div>
            </div>
            {isHydratingSupplementary ? (
              <InlineSectionLoading
                title="Loading linked quotes"
                description="Quotes, pricing summaries, and quote status details are still syncing."
              />
            ) : inquiry.quotes.length === 0 ? (
              <Card className="border-dashed border-border bg-surface-soft/70 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <FileStack className="h-6 w-6" />
                </div>
                <h4 className="mt-4 text-lg font-semibold">No linked quotes found</h4>
                <p className="mt-2 text-sm text-muted-foreground">Create a quote from this inquiry to start building the pricing workbench.</p>
              </Card>
            ) : quoteView === 'table' ? (
              <div className="overflow-hidden rounded-[24px] border border-border-soft">
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse">
                    <thead className="bg-surface-muted/80">
                      <tr>
                        <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Version</th>
                        <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Quote</th>
                        <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Plan</th>
                        <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Premium</th>
                        <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Status</th>
                        <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inquiry.quotes.map((quote) => (
                        <tr key={quote.id} className="border-b border-border-soft/80 bg-surface transition duration-150 hover:bg-primary/5">
                          <td className="px-4 py-4 text-sm font-semibold text-foreground/85">
                            {quoteVersionById[quote.id] ?? '1.0'}
                          </td>
                          <td className="px-4 py-4">
                            <div className="space-y-1">
                              <Link
                                to={`/quotes/${quote.id}/edit`}
                                state={{ fromInquiryId: inquiry.id }}
                                className="font-semibold text-primary transition hover:text-primary/80 hover:underline"
                              >
                                {quote.name}
                              </Link>
                              <p className="text-[12px] text-muted-foreground line-clamp-2">{quote.aiSummary}</p>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-muted-foreground">{quote.planName}</td>
                          <td className="px-4 py-4 text-sm font-semibold">{formatCurrency(quote.totalPremium)}</td>
                          <td className="px-4 py-4"><Badge variant="approved">{quote.status}</Badge></td>
                          <td className="px-4 py-4 text-sm text-muted-foreground">{formatDate(quote.createdOn)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {inquiry.quotes.map((quote) => (
                  <Card key={quote.id} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">{quote.name}</h3>
                      <Badge variant="approved">{quote.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{quote.aiSummary}</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <MetricCard label="Plan" value={quote.planName} />
                      <MetricCard label="Premium" value={formatCurrency(quote.totalPremium)} />
                    </div>
                    <Button variant="secondary" asChild>
                      <Link to={`/quotes/${quote.id}/edit`} state={{ fromInquiryId: inquiry.id }}>
                        Open Quote Workbench
                      </Link>
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
        <TabsContent value="ri-capacity" className="mt-4">
          <RiCapacityChecksPanel
            checks={inquiry.riCapacityChecks ?? []}
            loading={isHydratingSupplementary || riCapacityBusy}
            onRecalculate={() => void handleRiCapacityCheck()}
            recalculating={riCapacityBusy}
          />
        </TabsContent>
        <TabsContent value="documents" className="mt-4">
          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <Card className="space-y-4">
              <div className="flex items-center gap-3">
                <MailCheck className="h-5 w-5 text-primary" />
                <h3 className="text-xl font-semibold">Communication Context</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                SharePoint, generated outputs, and downstream email actions should stay visible directly in the underwriting workspace.
              </p>
              <div className="rounded-2xl border border-border-soft bg-surface-soft p-4">
                <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">SharePoint URL</p>
                {sharePointFolderUrl ? (
                  <a
                    href={sharePointFolderUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 flex items-center gap-3 rounded-2xl border border-border-soft bg-white px-4 py-3 text-primary shadow-soft transition hover:border-primary/30 hover:bg-primary/5 dark:bg-slate-950/65"
                    aria-label="Open SharePoint folder"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                      <FolderOpen className="h-7 w-7" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {getSharePointFolderName(inquiry.sharepointUrl)}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {inquiry.sharepointUrl}
                      </span>
                    </span>
                  </a>
                ) : sharePointSiteLoad.loading && inquiry.sharepointUrl ? (
                  <p className="mt-3 text-sm text-muted-foreground">Loading SharePoint location...</p>
                ) : sharePointSiteLoad.error && inquiry.sharepointUrl ? (
                  <p className="mt-3 text-sm text-danger">{sharePointSiteLoad.error}</p>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">No SharePoint location available.</p>
                )}
              </div>
            </Card>
            <Card className="space-y-4">
              <h3 className="text-xl font-semibold">Document & Review Notes</h3>
              <p className="text-sm text-muted-foreground">{inquiry.riskDescription}</p>
              <MetricCard label="Territorial Scope" value={inquiry.territorialScope} />
              <MetricCard label="Payment Term" value={inquiry.paymentTerm} />
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <Card className="space-y-4">
              <h3 className="text-xl font-semibold">Workflow History</h3>
              <div className="space-y-3">
                {inquiry.workflow.map((step) => (
                  <Card key={step.label} className="bg-surface-soft">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{step.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {step.complete ? 'Completed in the current underwriting progression.' : 'Still waiting in the current underwriting progression.'}
                        </p>
                      </div>
                      <Badge variant={step.complete ? 'approved' : 'neutral'}>{step.complete ? 'Done' : 'Pending'}</Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
            <Card className="space-y-4">
              <h3 className="text-xl font-semibold">Consequence Activity</h3>
              {inquiry.consequenceResults.length === 0 ? (
                <p className="text-sm text-muted-foreground">No consequence activity has been recorded yet for this inquiry.</p>
              ) : (
                <div className="space-y-3">
                  {inquiry.consequenceResults.map((item) => (
                    <Card key={item.id} className="bg-surface-soft">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold">{item.name}</p>
                          <p className="text-sm text-muted-foreground">{item.consequenceName}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="info">{item.action}</Badge>
                          <p className="mt-2 text-[12px] text-muted-foreground">{formatDate(item.createdOn)}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {isCopyQuotesOpen ? (
        <div className="fixed inset-0 z-50 m-0 mt-0 flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-md !mt-0">
          <div
            className="absolute inset-0"
            onClick={() => {
              if (copyQuotesBusy) return
              setIsCopyQuotesOpen(false)
            }}
          />
          <Card
            variant="premium"
            className="relative z-[1] w-full max-w-3xl overflow-hidden border border-primary/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(245,248,252,0.96)_100%)] p-0 shadow-[0_32px_90px_rgba(15,23,42,0.28)] dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.98)_0%,rgba(15,23,42,0.94)_100%)]"
          >
            <div className="relative overflow-hidden border-b border-border-soft px-6 py-6">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.12),transparent_42%),radial-gradient(circle_at_left,rgba(124,58,237,0.08),transparent_34%)]" />
              <div className="relative flex items-start justify-between gap-4">
                <div className="space-y-3">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
                    <CopyPlus className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Quote duplication</p>
                    <h3 className="mt-1 text-2xl font-bold">Copy won quotes into this inquiry</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
                      Select one or more won quotes from this product. We will duplicate the same quote details and linked lookups into fresh active quote records for this inquiry.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="rounded-full bg-white/80 dark:bg-slate-900/60"
                  disabled={copyQuotesBusy}
                  onClick={() => setIsCopyQuotesOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-5 px-6 py-6">
              {copyQuotesError ? (
                <div className="rounded-[18px] border border-danger/15 bg-danger/8 px-4 py-3 text-sm text-danger">
                  {copyQuotesError}
                </div>
              ) : null}

              <div className="max-h-[420px] overflow-y-auto pr-1">
                <div className="space-y-3">
                {wonQuotes.map((quote) => {
                  const selected = selectedWonQuoteIds.includes(quote.id)
                  return (
                    <button
                      key={quote.id}
                      type="button"
                      onClick={() => toggleWonQuoteSelection(quote.id)}
                      className={`group w-full rounded-[24px] border px-5 py-4 text-left transition ${
                        selected
                          ? 'border-primary/30 bg-primary/6'
                          : 'border-border-soft bg-white/92 hover:border-primary/20 hover:bg-primary/5 dark:bg-slate-950/35'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-start gap-4">
                          <span
                            className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
                              selected
                                ? 'border-primary bg-primary text-white'
                                : 'border-border-soft bg-surface text-transparent group-hover:border-primary/30'
                            }`}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-semibold text-foreground">{quote.name}</p>
                              <Badge variant="approved">Quote Won</Badge>
                              <Badge variant="neutral">{quote.productName}</Badge>
                            </div>
                            <p className="text-sm font-medium text-muted-foreground">
                              {formatCurrency(quote.totalPremium)}
                            </p>
                            {quote.aiSummary ? (
                              <p className="line-clamp-2 max-w-[620px] text-sm leading-6 text-muted-foreground">
                                {quote.aiSummary}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Status</p>
                          <p className="mt-1 text-sm font-semibold">{quote.status}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-border-soft pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  The duplicated quotes will be created as new <span className="font-semibold text-foreground">active</span> records for this inquiry.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    className="bg-white dark:bg-[#1E293B]"
                    disabled={copyQuotesBusy}
                    onClick={() => setIsCopyQuotesOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    disabled={!selectedWonQuoteIds.length || copyQuotesBusy}
                    onClick={() => void handleCopyQuotes()}
                  >
                    <CopyPlus className="h-4 w-4" />
                    {copyQuotesBusy ? 'Copying...' : `Copy Quotes (${selectedWonQuoteIds.length})`}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {isAiReevaluateOpen ? (
        <AiReevaluationConfirmDialog
          onClose={() => setIsAiReevaluateOpen(false)}
          onConfirm={() => setIsAiReevaluateOpen(false)}
          onReject={() => setIsAiReevaluateOpen(false)}
        />
      ) : null}

      {(templatePreview || templatePreviewBusy || templatePreviewError) ? (
        <div
          className="fixed inset-0 z-[70] !mt-0 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          onClick={() => {
            if (templatePreviewBusy) return
            setTemplatePreview(null)
            setTemplatePreviewError(null)
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-[860px] overflow-hidden rounded-[30px] border border-border-soft bg-surface shadow-[0_40px_90px_rgba(15,23,42,0.28)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border-soft px-6 py-5">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  {templatePreview?.kind === 'document' ? (
                    <FileText className="h-5 w-5" />
                  ) : (
                    <Mail className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    {templatePreview?.kind === 'document' ? 'Document Template' : 'Email Template'}
                  </p>
                  <h3 className="mt-1 text-2xl font-semibold">
                    {templatePreview?.name || 'Loading template preview'}
                  </h3>
                  {templatePreview?.subject ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Subject: {templatePreview.subject}
                    </p>
                  ) : null}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (templatePreviewBusy) return
                  setTemplatePreview(null)
                  setTemplatePreviewError(null)
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="max-h-[calc(90vh-92px)] overflow-y-auto px-6 py-5">
              {templatePreviewBusy ? (
                <div className="flex min-h-[260px] items-center justify-center">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
                    Loading linked template...
                  </div>
                </div>
              ) : templatePreviewError ? (
                <Card className="rounded-[22px] border border-danger/20 bg-danger/5">
                  <p className="font-semibold text-danger">{templatePreviewError}</p>
                </Card>
              ) : templatePreview ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="approved">{templatePreview.status}</Badge>
                    {templatePreview.category ? <Badge variant="review">{templatePreview.category}</Badge> : null}
                  </div>
                  {templatePreview.description ? (
                    <Card className="rounded-[22px] border border-border-soft bg-surface-soft/70">
                      <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                        Description
                      </p>
                      <p className="mt-2 text-sm leading-7 text-foreground/90">
                        {templatePreview.description}
                      </p>
                    </Card>
                  ) : null}
                  <Card className="rounded-[22px] border border-border-soft bg-white dark:bg-slate-950/85">
                    <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      Preview
                    </p>
                    <div
                      className="prose prose-sm mt-4 max-w-none text-foreground dark:prose-invert"
                      dangerouslySetInnerHTML={{
                        __html:
                          templatePreview.content?.trim() ||
                          '<p>No template content available.</p>',
                      }}
                    />
                  </Card>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

    </div>
  )
}

function AiReevaluationConfirmDialog({
  onClose,
  onConfirm,
  onReject,
}: {
  onClose: () => void
  onConfirm: () => void
  onReject: () => void
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[80] !mt-0 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card
        variant="premium"
        className="relative w-full max-w-[520px] overflow-hidden rounded-[28px] border border-[#E9D5FF] bg-white p-0 shadow-[0_34px_90px_rgba(15,23,42,0.28)] dark:border-white/10 dark:bg-[#1E293B]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative overflow-hidden border-b border-[#E9D5FF] bg-gradient-to-br from-[#FDF7FF] via-white to-white px-6 py-5 dark:border-white/10 dark:from-[#2A123D] dark:via-[#231735] dark:to-[#1E293B]">
          <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-[#A855F7]/14 blur-2xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#A855F7] text-white shadow-[0_16px_34px_rgba(168,85,247,0.26)]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#A855F7] dark:text-[#E9D5FF]">
                  AI Extraction
                </p>
                <h3 className="mt-1 text-2xl font-bold tracking-[-0.02em] text-foreground">
                  Re-evaluate AI Extraction?
                </h3>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-2xl bg-white/80 text-muted-foreground hover:bg-[#F5E8FF] hover:text-[#A855F7] dark:bg-white/10 dark:hover:bg-white/15"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm font-normal leading-7 text-foreground">
            Please confirm if you want re-evaluate AI Extraction. This will override existing data.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-border-soft bg-surface-soft/70 px-6 py-4 sm:flex-row sm:justify-end dark:border-white/10 dark:bg-white/5">
          <Button
            type="button"
            variant="secondary"
            className="rounded-2xl bg-white dark:bg-[#1E293B]"
            onClick={onReject}
          >
            Reject
          </Button>
          <Button
            type="button"
            variant="ai"
            className="rounded-2xl bg-[#A855F7] text-white shadow-[0_14px_30px_rgba(168,85,247,0.22)] hover:bg-[#9333EA]"
            onClick={onConfirm}
          >
            <Sparkles className="h-4 w-4" />
            Confirm
          </Button>
        </div>
      </Card>
    </div>,
    document.body,
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border-soft bg-surface-soft p-4">
      <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-base font-semibold">{value}</p>
    </div>
  )
}

function RiCapacityChecksPanel({
  checks,
  loading,
  recalculating,
  onRecalculate,
}: {
  checks: RiCapacityCheckSummary[]
  loading: boolean
  recalculating: boolean
  onRecalculate: () => void
}) {
  return (
    <Card className="space-y-5 overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-border-soft pb-5 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Calculator className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-xl font-semibold">RI Capacity Checks</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Review reinsurance capacity outcomes calculated against this inquiry.
            </p>
          </div>
        </div>
        <Button type="button" disabled={recalculating} onClick={onRecalculate}>
          {recalculating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
          {recalculating ? 'Checking...' : 'Run RI Capacity Check'}
        </Button>
      </div>

      {loading ? (
        <InlineSectionLoading
          title="Loading RI capacity checks"
          description="Capacity outcomes and treaty absorption details are refreshing."
        />
      ) : checks.length ? (
        <div className="overflow-hidden rounded-[24px] border border-border-soft">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="bg-surface-muted/80">
                <tr>
                  <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Check</th>
                  <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Outcome</th>
                  <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Sum Insured</th>
                  <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Retained</th>
                  <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Treaty Absorbed</th>
                  <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Excess to Place</th>
                  <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Treaty</th>
                  <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Calculated</th>
                </tr>
              </thead>
              <tbody>
                {checks.map((check) => (
                  <tr key={check.id} className="border-b border-border-soft/80 bg-surface transition duration-150 hover:bg-primary/5">
                    <td className="px-4 py-4">
                      <Link
                        to={`/reinsurance/ri-capacity-checks/${check.id}`}
                        className="inline-flex max-w-[260px] text-sm font-semibold text-primary transition hover:text-primary-dark hover:underline"
                      >
                        {check.name}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">{check.calculationSource}</p>
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant={riCapacityOutcomeTone(check.outcome)}>{check.outcome}</Badge>
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold">{formatCurrency(check.sumInsured)}</td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">{formatCurrency(check.retainedAmount)}</td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">{formatCurrency(check.treatyAbsorbed)}</td>
                    <td className="px-4 py-4 text-sm font-semibold text-primary">{formatCurrency(check.excessToPlace)}</td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">{check.treatyName}</td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">{formatDate(check.calculatedOn ?? check.createdOn ?? '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <Card className="border-dashed border-border bg-surface-soft/70 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Calculator className="h-6 w-6" />
          </div>
          <h4 className="mt-4 text-lg font-semibold">No RI capacity checks yet</h4>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Run a capacity check from Total Sum Insured or from this tab to generate the latest treaty and facultative placement outcome.
          </p>
        </Card>
      )}
    </Card>
  )
}

function riCapacityOutcomeTone(outcome: string): 'approved' | 'pending' | 'rejected' | 'info' | 'neutral' {
  const normalized = outcome.toLowerCase()
  if (normalized.includes('retention') || normalized.includes('treaty')) return 'approved'
  if (normalized.includes('facultative') || normalized.includes('refer')) return 'pending'
  if (normalized.includes('no treaty')) return 'rejected'
  if (normalized.includes('evaluated')) return 'neutral'
  return 'info'
}

function InquiryWorkspaceSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-9 w-36 rounded-full bg-surface-soft" />
      <section className="rounded-[28px] border border-border-soft bg-surface px-6 py-6 shadow-soft">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="h-7 w-24 rounded-full bg-surface-soft" />
              <div className="h-7 w-28 rounded-full bg-surface-soft" />
              <div className="h-7 w-24 rounded-full bg-surface-soft" />
            </div>
            <div className="space-y-3">
              <div className="h-4 w-40 rounded-full bg-surface-soft" />
              <div className="h-10 w-[420px] max-w-full rounded-2xl bg-surface-soft" />
              <div className="h-4 w-72 rounded-full bg-surface-soft" />
            </div>
          </div>
          <div className="space-y-4 lg:min-w-[320px]">
            <div className="rounded-[22px] border border-border-soft bg-surface-soft p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-3">
                  <div className="h-4 w-36 rounded-full bg-surface-muted" />
                  <div className="h-10 w-24 rounded-2xl bg-surface-muted" />
                  <div className="h-4 w-52 rounded-full bg-surface-muted" />
                </div>
                <div className="h-16 w-16 rounded-full bg-surface-muted" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <div className="h-10 w-28 rounded-full bg-surface-soft" />
              <div className="h-10 w-24 rounded-full bg-surface-soft" />
              <div className="h-10 w-28 rounded-full bg-surface-soft" />
              <div className="h-10 w-32 rounded-full bg-surface-soft" />
            </div>
          </div>
        </div>
      </section>
      <div className="h-12 w-full max-w-[760px] rounded-full bg-surface-soft" />
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <div className="rounded-[24px] border border-border-soft bg-surface p-6">
            <div className="h-5 w-32 rounded-full bg-surface-soft" />
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <div className="h-3 w-24 rounded-full bg-surface-soft" />
                  <div className="h-11 rounded-xl bg-surface-soft" />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[24px] border border-border-soft bg-surface p-6">
            <div className="h-5 w-24 rounded-full bg-surface-soft" />
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <div className="h-3 w-20 rounded-full bg-surface-soft" />
                  <div className="h-11 rounded-xl bg-surface-soft" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-[24px] border border-border-soft bg-surface p-6">
          <div className="h-5 w-48 rounded-full bg-surface-soft" />
          <div className="mt-5 space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-[22px] border border-border-soft bg-surface-soft p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="h-4 w-24 rounded-full bg-surface-muted" />
                    <div className="h-5 w-48 rounded-full bg-surface-muted" />
                    <div className="h-4 w-44 rounded-full bg-surface-muted" />
                  </div>
                  <div className="h-9 w-9 rounded-full bg-surface-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function PlanPricingOrderPopover({
  items,
  loading,
  planName,
  canApply,
  applying,
  onApply,
}: {
  items: PlanPricingOrderItem[]
  loading: boolean
  planName?: string
  canApply: boolean
  applying: boolean
  onApply: () => void
}) {
  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const orderedItems = [...items].sort((a, b) => a.order - b.order)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      if (popoverRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  return (
    <div ref={popoverRef} className="relative inline-flex">
      <button
        type="button"
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full border transition ${
          open
            ? 'border-primary/30 bg-primary text-white'
            : 'border-border-soft bg-white text-primary hover:border-primary/25 hover:bg-primary/5 dark:bg-surface'
        }`}
        aria-label="View plan pricing order"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <List className="h-3.5 w-3.5" />
      </button>
      {open ? (
      <div className="absolute right-0 top-[calc(100%+0.65rem)] z-50 w-[360px]">
        <div className="overflow-hidden rounded-[22px] border border-border-soft bg-white shadow-[0_22px_50px_rgba(15,23,42,0.16)] dark:bg-[#1E293B]">
          <div className="border-b border-border-soft bg-surface-soft/80 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <List className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold">Rating Order</p>
                  <p className="truncate text-xs text-muted-foreground">{planName || 'Selected plan'} · inquiry actions</p>
                </div>
              </div>
              {canApply ? (
                <Button type="button" size="sm" className="shrink-0 rounded-full" disabled={applying} onClick={onApply}>
                  {applying ? 'Applying...' : 'Apply'}
                </Button>
              ) : orderedItems.length ? (
                <Badge variant="approved">Applied</Badge>
              ) : null}
            </div>
          </div>
          <div className="max-h-[300px] overflow-y-auto p-3 scrollbar-sleek">
            {loading ? (
              <div className="flex items-center gap-2 rounded-[18px] border border-border-soft bg-surface-soft px-3 py-4 text-sm text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
                Loading pricing sequence...
              </div>
            ) : orderedItems.length ? (
              <div className="space-y-2.5">
                {orderedItems.map((item, index) => (
                  <div
                    key={item.key}
                    className="rounded-[18px] border border-border-soft bg-white px-3 py-3 transition group-hover/card:border-primary/20 dark:bg-surface"
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-primary px-2 text-xs font-bold text-white">
                        #{index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-semibold leading-5">{item.consequenceName}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{item.businessRuleName}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge variant="review">{item.action}</Badge>
                          <span className="rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-[11px] font-bold text-primary">
                            {item.actionValue === '751820002'
                              ? formatCurrency(item.addAmount ?? 0)
                              : item.actionValue === '751820003'
                                ? `${item.multiplyValue ?? 0}x`
                                : 'Rating'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[18px] border border-dashed border-border-soft bg-surface-soft px-3 py-5 text-center">
                <p className="text-sm font-semibold">No pricing order configured</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Rating consequences will appear here when they are available in the Actions tab for this inquiry.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      ) : null}
    </div>
  )
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2.5">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

function MotorInformationSection({ title, data, driver = false }: { title: string; data?: string; driver?: boolean }) {
  const parsed = parseMotorCustomerData(data)
  return (
    <Card className="space-y-5">
      <SectionHeader title={title} description={driver ? 'Driver details from the submitted insurance information.' : 'Vehicle details from the submitted insurance information.'} />
      {!parsed ? <p className="text-sm text-muted-foreground">Submitted information is not available for this inquiry.</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {(driver ? motorDriverFields : motorVehicleFields).map(([label, property]) => (
          <Field key={property} label={label}><ReadOnlyValue value={motorAnswer(parsed, property, driver)} /></Field>
        ))}
      </div>
    </Card>
  )
}

function ReadOnlyValue({ value }: { value: string }) {
  return (
    <div className="form-field-surface min-h-[46px] rounded-[16px] border border-border-soft px-4 py-3 text-sm font-medium text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
      {value || 'Not provided'}
    </div>
  )
}

function ReadOnlyText({ value }: { value: string }) {
  return (
    <div className="form-field-surface min-h-28 whitespace-pre-wrap rounded-[16px] border border-border-soft px-4 py-3 text-sm leading-7 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
      {value || 'Not provided'}
    </div>
  )
}

function PlanDetailsPreview({ value }: { value: string }) {
  const sections = parsePlanDetails(value)

  if (!sections.length) {
    return <ReadOnlyText value="No plan details captured" />
  }

  return (
    <div className="form-field-surface min-h-28 rounded-[16px] border border-border-soft px-4 py-4 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
      <div className="space-y-5">
        {sections.map((section) => (
          <div key={section.title} className="space-y-2">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-primary">
              {section.title}
            </p>
            <div className="space-y-2">
              {section.items.map((item) => (
                <p key={item} className="whitespace-pre-wrap text-sm leading-7 text-foreground/90">
                  {item}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function parsePlanDetails(value: string) {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const sections: Array<{ title: string; items: string[] }> = []

  for (const line of lines) {
    if (line.endsWith(':')) {
      sections.push({ title: line.replace(/:$/, ''), items: [] })
      continue
    }

    if (!sections.length) {
      sections.push({ title: 'Plan Details', items: [] })
    }
    sections[sections.length - 1].items.push(line)
  }

  return sections.filter((section) => section.items.length)
}

function SelectField({
  value,
  onChange,
  options,
  disabled = false,
}: {
  value: string
  onChange: (value: string) => void
  options: Array<{ id: string; name: string }> | Array<{ value: number; label: string }>
  disabled?: boolean
}) {
  return (
    <Select
      disabled={disabled}
      value={value}
      onValueChange={onChange}
      options={[
        { value: '', label: 'Select' },
        ...options.map((option) =>
          'id' in option
            ? { value: option.id, label: option.name }
            : { value: String(option.value), label: option.label },
        ),
      ]}
    >
    </Select>
  )
}

function InlineSectionLoading({ title, description }: { title: string; description: string }) {
  return (
    <Card className="border border-border-soft bg-surface-soft/70">
      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-[20px] border border-border-soft bg-white/80 px-4 py-4 dark:bg-slate-950/55">
              <div className="animate-pulse space-y-3">
                <div className="h-4 w-40 rounded-full bg-surface-soft" />
                <div className="h-3 w-28 rounded-full bg-surface-soft" />
                <div className="h-16 rounded-[16px] bg-surface-soft" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

function isConsequenceTemplateResult(type: string, action: string) {
  const normalizedType = type.trim().toLowerCase()
  const normalizedAction = action.trim().toLowerCase()
  return (
    normalizedType === 'document' ||
    normalizedType === 'email' ||
    normalizedAction === 'document' ||
    normalizedAction === 'email'
  )
}

function CollapsedEmailRail({
  emailCount,
  inquiryNumber,
  latestEmailSubject,
  onExpand,
}: {
  emailCount: number
  inquiryNumber: string
  latestEmailSubject?: string
  onExpand: () => void
}) {
  return (
    <div className="sticky top-24">
      <button
        type="button"
        onClick={onExpand}
        className="group flex min-h-[92px] w-full items-center justify-between gap-4 rounded-[28px] border border-border-soft bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(245,248,252,0.92)_100%)] px-4 py-4 shadow-soft transition hover:border-primary/20 hover:bg-primary/5 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.94)_0%,rgba(15,23,42,0.88)_100%)] xl:h-[520px] xl:flex-col xl:px-3 xl:py-5"
      >
        <div className="flex items-center gap-3 xl:flex-col">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-[0_18px_35px_rgba(37,99,235,0.26)]">
            <Mail className="h-6 w-6" />
          </span>
          <span className="rounded-full border border-primary/12 bg-primary/8 px-2.5 py-1 text-[11px] font-semibold text-primary">
            {emailCount}
          </span>
          <span className="hidden text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground xl:block [writing-mode:vertical-rl]">
            {inquiryNumber}
          </span>
        </div>
        <div className="relative hidden h-full items-center xl:flex">
          <div className="h-full w-[3px] rounded-full bg-gradient-to-b from-primary/70 via-primary/20 to-transparent" />
          <span className="absolute left-1/2 top-10 h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-white bg-primary shadow-[0_0_0_6px_rgba(37,99,235,0.12)]" />
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3 xl:flex-none xl:flex-col">
          <span className="line-clamp-2 text-left text-[11px] leading-5 text-muted-foreground xl:line-clamp-3 xl:text-center">
            {latestEmailSubject || 'Expand to review linked inquiry emails.'}
          </span>
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border-soft bg-white text-primary transition group-hover:border-primary/25 dark:bg-slate-900/70">
            <ChevronLeft className="h-4 w-4" />
          </span>
        </div>
      </button>
    </div>
  )
}

function canApplyConsequence(type: string, action?: string) {
  if (type === 'Risk') return true
  if (type !== 'Case Control') return false
  return toDisposition(action ?? '') !== null
}

function toDisposition(action: string) {
  const normalized = action.replace(/\s+/g, ' ').trim().toLowerCase()
  if (normalized === 'decline') return 'Decline' as const
  if (normalized === 'refer to underwriter') return 'RefertoUnderwriter' as const
  if (normalized === 'escalate to head of aviation') return 'EscalatetoHeadofAviation' as const
  if (normalized === 'property or reinsurance team') return 'PropertyorReinsuranceTeam' as const
  return null
}

const APPLIED_ACTION_STATUS_VALUE = 751820001

function inquiryStatusValueForDisposition(
  disposition: 'Decline' | 'RefertoUnderwriter' | 'EscalatetoHeadofAviation' | 'PropertyorReinsuranceTeam',
) {
  if (disposition === 'Decline') return 751820011
  if (disposition === 'RefertoUnderwriter') return 751820010
  if (disposition === 'EscalatetoHeadofAviation') return 751820013
  if (disposition === 'PropertyorReinsuranceTeam') return 751820014
  return 0
}

function inquiryStatusLabelForDisposition(
  disposition: 'Decline' | 'RefertoUnderwriter' | 'EscalatetoHeadofAviation' | 'PropertyorReinsuranceTeam',
) {
  if (disposition === 'Decline') return 'Decline'
  if (disposition === 'RefertoUnderwriter') return 'Refer to Underwriter'
  if (disposition === 'EscalatetoHeadofAviation') return 'Escalate to Head of Aviation'
  if (disposition === 'PropertyorReinsuranceTeam') return 'Property or Reinsurance Team'
  return 'Draft'
}

function splitBusinessRuleName(value?: string) {
  const [name] = (value ?? '').split('-')
  return name?.trim() || 'Business Rule'
}

function isConsequenceApplied(value?: number) {
  return value === APPLIED_ACTION_STATUS_VALUE
}

function findOptionLabel(
  options: Array<{ value: number; label: string }>,
  value: string,
  fallback: string,
) {
  return options.find((option) => String(option.value) === value)?.label ?? fallback
}

function findOptionName(
  options: Array<{ id: string; name: string }>,
  value: string,
  fallback: string,
) {
  return options.find((option) => option.id === value)?.name ?? fallback
}

function attachmentAccent(mimeType?: string) {
  const normalized = mimeType?.toLowerCase() ?? ''
  if (normalized.includes('pdf')) {
    return {
      tone: 'bg-danger/10 text-danger',
      icon: <FileText className="h-4 w-4" />,
    }
  }
  if (normalized.includes('image') || normalized.includes('png') || normalized.includes('jpg') || normalized.includes('jpeg')) {
    return {
      tone: 'bg-info/12 text-info',
      icon: <FileImage className="h-4 w-4" />,
    }
  }
  if (normalized.includes('sheet') || normalized.includes('excel') || normalized.includes('csv')) {
    return {
      tone: 'bg-success/12 text-success',
      icon: <FileSpreadsheet className="h-4 w-4" />,
    }
  }
  if (normalized.includes('zip') || normalized.includes('archive') || normalized.includes('rar')) {
    return {
      tone: 'bg-warning/12 text-warning',
      icon: <Archive className="h-4 w-4" />,
    }
  }
  return {
    tone: 'bg-primary/10 text-primary',
    icon: <Paperclip className="h-4 w-4" />,
  }
}

function EvidenceTooltip({ evidence, compact = false }: { evidence: string; compact?: boolean }) {
  const preview = evidence
    .replace(/Document Name:\s*/gi, '')
    .replace(/\s+Evidence:\s*/gi, '\n')
    .trim()
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open && !hovered) return

    const updatePosition = () => {
      if (!triggerRef.current) return
      const rect = triggerRef.current.getBoundingClientRect()
      const popoverWidth = 380
      const viewportPadding = 16
      const left = Math.min(
        Math.max(viewportPadding, rect.right - popoverWidth),
        window.innerWidth - popoverWidth - viewportPadding,
      )

      setPosition({
        top: rect.bottom + 12,
        left,
      })
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        popoverRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return
      }
      if (!popoverRef.current?.contains(target)) {
        setOpen(false)
      }
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [open, hovered])

  return (
    <div
      ref={popoverRef}
      className={`relative inline-flex ${open || hovered ? 'z-[120]' : 'z-[2]'}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        className={`inline-flex items-center justify-center rounded-full border border-border-soft bg-white text-muted-foreground transition hover:border-primary/20 hover:text-primary dark:bg-slate-900 ${
          compact ? 'h-7 w-7 shrink-0' : 'h-8 w-8'
        }`}
      >
        <FileText className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      </button>
      {(open || hovered) && position
        ? createPortal(
            <div
              className="fixed z-[160] w-[380px]"
              style={{ top: position.top, left: position.left }}
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
            >
              <div className="absolute right-5 top-[-10px] h-5 w-5 rotate-45 border-l border-t border-border-soft bg-white shadow-[-6px_-6px_18px_rgba(15,23,42,0.04)] dark:bg-[#102033]" />
              <div className="overflow-hidden rounded-[24px] border border-border-soft bg-white shadow-[0_26px_55px_rgba(15,23,42,0.18)] dark:bg-[#102033]">
                <div className="flex items-start justify-between gap-4 border-b border-border-soft bg-white px-4 py-3.5 dark:bg-[#102033]">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-300/15 dark:text-amber-200">
                      <FileText className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Evidence Preview</p>
                      <p className="text-xs text-muted-foreground">Extracted from document source</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border-soft bg-white text-muted-foreground transition hover:border-primary/20 hover:text-primary dark:bg-slate-900"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div
                  className="relative overflow-hidden rounded-b-[24px] bg-[#fbfaf5] px-5 py-5 dark:bg-[#f8f4ea]"
                  style={{
                    backgroundImage:
                      'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.7) 0, rgba(255,255,255,0) 22%), radial-gradient(circle at 80% 0%, rgba(0,0,0,0.02) 0, rgba(0,0,0,0) 24%)',
                  }}
                >
                  <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/10 via-black/5 to-transparent" />

                  <div className="relative text-[13px] leading-6 text-slate-700/40">
                    <p className="blur-[2.3px]">
                      This Tenancy Agreement is made by and between the parties stated herein, subject to applicable regulations, submitted schedules, and the related supporting documentation reviewed during underwriting.
                    </p>
                  </div>

                  <div className="relative mt-5">
                    <div className="absolute inset-y-1 left-0 right-0 rounded-[22px] bg-yellow-200/50 blur-xl" />
                    <div className="absolute inset-y-2 left-2 right-3 rounded-[18px] bg-yellow-100/80" />
                    <div className="relative px-1.5 font-serif text-[15px] leading-7 text-slate-900">
                      {preview}
                    </div>
                  </div>

                  <div className="relative mt-5 text-[13px] leading-6 text-slate-700/40">
                    <p className="blur-[2.3px]">
                      Interpretation of extracted language should be considered alongside the complete submission record, related attachments, endorsements, and the full originating document source.
                    </p>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

function getResponseTextClass(response?: string) {
  const normalized = (response ?? '').trim().toLowerCase()
  if (normalized === 'no information provided') {
    return 'inline-flex rounded-full border border-danger/20 bg-danger/10 px-3 py-1.5 font-medium text-danger'
  }

  return 'text-foreground/90'
}

function ConfidenceScoreIndicator({ score }: { score: number }) {
  const normalizedScore = normalizeConfidenceScore(score)
  const circumference = 2 * Math.PI * 16
  const dashOffset = circumference * (1 - normalizedScore / 100)
  const accent = getConfidenceAccent(normalizedScore)

  return (
    <div
      className="flex h-12 w-12 items-center justify-center rounded-full border"
      aria-label={`Confidence score ${normalizedScore}`}
      style={{
        borderColor: accent.border,
        backgroundColor: accent.background,
      }}
      title={`Confidence score ${normalizedScore}`}
    >
      <div className="relative h-10 w-10">
        <svg className="h-10 w-10 -rotate-90" viewBox="0 0 40 40" aria-hidden="true">
          <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(148,163,184,0.16)" strokeWidth="4" />
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="none"
            stroke={accent.stroke}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center text-[11px] font-bold"
          style={{ color: accent.stroke }}
        >
          {normalizedScore}
        </div>
      </div>
    </div>
  )
}

function normalizeConfidenceScore(score?: number) {
  if (score === undefined || Number.isNaN(score)) return 0
  if (score <= 1) return Math.round(Math.max(0, score) * 100)
  return Math.max(0, Math.min(100, Math.round(score)))
}

function getConfidenceAccent(score: number) {
  if (score >= 85) {
    return {
      stroke: '#A855F7',
      border: 'rgba(168,85,247,0.22)',
      background: 'rgba(245,232,255,0.95)',
    }
  }

  if (score >= 65) {
    return {
      stroke: '#C084FC',
      border: 'rgba(192,132,252,0.22)',
      background: 'rgba(250,245,255,0.96)',
    }
  }

  return {
    stroke: '#F472B6',
    border: 'rgba(244,114,182,0.2)',
    background: 'rgba(253,242,248,0.96)',
  }
}

function ViewToggle({
  value,
  onChange,
}: {
  value: 'card' | 'table'
  onChange: (value: 'card' | 'table') => void
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border-soft bg-surface-muted/80 p-1">
      <Button
        type="button"
        variant={value === 'card' ? 'primary' : 'ghost'}
        size="sm"
        className="rounded-full"
        onClick={() => onChange('card')}
      >
        <LayoutGrid className="h-4 w-4" />
        Card View
      </Button>
      <Button
        type="button"
        variant={value === 'table' ? 'primary' : 'ghost'}
        size="sm"
        className="rounded-full"
        onClick={() => onChange('table')}
      >
        <Rows3 className="h-4 w-4" />
        Table View
      </Button>
    </div>
  )
}

function choiceValue(options: Array<{ value: number; label: string }>, label: string) {
  return String(options.find((option) => option.label.toLowerCase() === label.toLowerCase())?.value ?? '')
}

function buildFormState(
  inquiry: {
    name: string
    productId?: string
    productName: string
    inquiryType: string
    inquiryTypeValue?: number
    status: string
    inquiryStatusValue?: number
    planId?: string
    planName: string
    brokerId?: string
    brokerName: string
    contactName: string
    coverType: string
    planDetails: string
    riskScore?: number
    riskDescription: string
    aiSummary: string
    totalInsured?: number
    territorialScope: string
    totalCharge?: number
    basePremium?: number
    underwriterActionStatus?: number | null
    underwriterSubAction?: number | null
    grossPremium?: number
    paymentTerm: string
    fee?: number
  },
  options: {
    products: Array<{ id: string; name: string }>
    plans: Array<{ id: string; name: string }>
    brokers: Array<{ id: string; name: string }>
    inquiryTypes: Array<{ value: number; label: string }>
    inquiryStatuses: Array<{ value: number; label: string }>
    coverTypes: Array<{ value: number; label: string }>
    paymentTerms: Array<{ value: number; label: string }>
  },
): InquiryFormState {
  return {
    name: inquiry.name,
    productId: inquiry.productId ?? options.products.find((item) => item.name === inquiry.productName)?.id ?? '',
    inquiryType:
      inquiry.inquiryTypeValue !== undefined
        ? String(inquiry.inquiryTypeValue)
        : choiceValue(options.inquiryTypes, inquiry.inquiryType),
    inquiryStatus:
      inquiry.inquiryStatusValue !== undefined
        ? String(inquiry.inquiryStatusValue)
        : choiceValue(options.inquiryStatuses, inquiry.status),
    planId: inquiry.planId ?? options.plans.find((item) => item.name === inquiry.planName)?.id ?? '',
    brokerId: inquiry.brokerId ?? options.brokers.find((item) => item.name === inquiry.brokerName)?.id ?? '',
    brokerAgentName: inquiry.contactName || 'No broker agent linked',
    planDetails: inquiry.planDetails ?? '',
    coverType: choiceValue(options.coverTypes, inquiry.coverType),
    riskScore: String(inquiry.riskScore ?? 0),
    riskDescription: inquiry.riskDescription,
    totalSumInsured: String(inquiry.totalInsured ?? 0),
    territorialScope: inquiry.territorialScope,
    noOfItems: '',
    basePremium: String(inquiry.basePremium ?? 0),
    underwriterActionStatus: inquiry.underwriterActionStatus == null ? '' : String(inquiry.underwriterActionStatus),
    underwriterSubAction: inquiry.underwriterSubAction == null ? '' : String(inquiry.underwriterSubAction),
    premiumToBeCharged: String(inquiry.totalCharge ?? 0),
    brokerage: '0',
    grossPremium: String(inquiry.grossPremium ?? 0),
    paymentTerm: choiceValue(options.paymentTerms, inquiry.paymentTerm),
    fee: String(inquiry.fee ?? 0),
    totalDeduction: '0',
  }
}

function buildInquirySavePayload(
  form: InquiryFormState,
  overrides?: Partial<{
    inquiryStatus: number
    riskScore: number
  }>,
) {
  return {
    name: form.name,
    productId: form.productId || undefined,
    inquiryType: form.inquiryType ? Number(form.inquiryType) : undefined,
    inquiryStatus:
      overrides?.inquiryStatus ??
      (form.inquiryStatus ? Number(form.inquiryStatus) : undefined),
    planId: form.planId || undefined,
    brokerId: form.brokerId || undefined,
    planDetails: form.planDetails,
    coverType: form.coverType ? Number(form.coverType) : undefined,
    riskScore: overrides?.riskScore ?? (Number(form.riskScore) || 0),
    riskDescription: form.riskDescription,
    totalSumInsured: Number(form.totalSumInsured) || 0,
    territorialScope: form.territorialScope,
    noOfItems: form.noOfItems,
    basePremium: Number(form.basePremium) || 0,
    premiumToBeCharged: Number(form.premiumToBeCharged) || 0,
    brokerage: Number(form.brokerage) || 0,
    grossPremium: Number(form.grossPremium) || 0,
    paymentTerm: form.paymentTerm ? Number(form.paymentTerm) : undefined,
    fee: Number(form.fee) || 0,
    totalDeduction: Number(form.totalDeduction) || 0,
  }
}

function getEmailPreview(value: string) {
  const text = htmlToPlainText(value)
  return text || 'No email body captured.'
}

function getPrimaryEmailText(value: string) {
  const html = getPrimaryEmailHtml(value)
  return htmlToPlainText(html)
}

function getPrimaryEmailHtml(value: string) {
  if (!value.trim()) return '<p>No email body captured.</p>'
  if (typeof DOMParser === 'undefined') {
    return `<p>${escapeHtml(value)}</p>`
  }

  const document = new DOMParser().parseFromString(value, 'text/html')
  const source = document.body.querySelector('.ck-content') ?? document.body
  const container = document.createElement('div')
  const children = Array.from(source.childNodes)

  for (const child of children) {
    const text = child.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    if (isQuotedThreadMarker(text)) break
    container.appendChild(child.cloneNode(true))
  }

  const html = container.innerHTML.trim()
  return html || '<p>No email body captured.</p>'
}

function htmlToPlainText(value: string) {
  if (!value.trim()) return ''
  if (typeof DOMParser === 'undefined') return value
  const document = new DOMParser().parseFromString(value, 'text/html')
  return document.body.textContent?.replace(/\s+/g, ' ').trim() ?? ''
}

function isQuotedThreadMarker(value: string) {
  if (!value) return false
  return [
    /\bFrom:\s/i,
    /\bSent:\s/i,
    /\bSubject:\s/i,
    /-{2,}\s*Original Message\s*-{2,}/i,
    /\bCAUTION:\s*External Email/i,
    /\bExternal Email\b/i,
  ].some((marker) => marker.test(value))
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function extractEmailAddress(value: string) {
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  return match?.[0] ?? ''
}

function getSharePointFolderName(value: string) {
  const clean = value.trim().replace(/\/+$/, '')
  if (!clean) return ''
  const parts = clean.split('/')
  return parts[parts.length - 1] ?? clean
}

function getConsequenceRuleName(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return 'Unnamed Business Rule'

  const separatorIndex = trimmed.lastIndexOf('-')
  if (separatorIndex <= 0) return trimmed

  return trimmed.slice(0, separatorIndex).trim().replace(/[.]+$/, '').trim() || trimmed
}
