import { useEffect, useRef, useState, type ReactNode, type FormEvent } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, Bot, BrainCircuit, CheckCircle2, ChevronDown, ChevronUp, Download, FileSearch, FileText, FileWarning, Gem, History, Layers3, Pencil, RefreshCw, Save, ShieldAlert, ShieldCheck, Sparkles, TicketSlash, Trash2, UploadCloud, XCircle } from 'lucide-react'
import { useAsyncData } from '../../hooks/useAsyncData'
import {
  deleteQuotePlanLinkedRecord,
  getQuoteDetail,
  getQuoteEditorOptions,
  getQuotePlanLinkedSections,
  listQuotePlanComparisons,
  saveQuoteDetail,
  sendGeneratedQuoteToCustomer,
  analyzeQuotePlanComparison,
  updateQuotePlanLinkedDescription,
  updateQuotePlanLinkedRecordDetails,
  updateQuoteStatus,
  type QuotePlanLinkedEntityKey,
  type QuotePlanLinkedSection,
  type QuotePlanComparisonUploadPayload,
} from '../../services/quotesService'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs'
import { Badge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Input'
import { formatAmount, formatCurrency } from '../../lib/formatters'
import { AmountInput } from '../../components/ui/AmountInput'
import { generateQuotePdf } from '../../lib/quotePdf'
import { generateHealthQuotePdf } from '../../lib/healthMemberCardPdf'
import { getInquiryDetailCore } from '../../services/inquiriesService'
import nextcareLogoSrc from '../../assets/nextcarelogo.png?inline'
import healthHeaderSrc from '../../assets/insureAIHealthLogo.png.png?inline'
import alBuhairaHeaderSrc from '../../assets/al-buhaira-logo.png?inline'
import { inquiryProductKind } from '../../lib/healthInquiry'
import type { QuotePlanComparison } from '../../domain/app'

interface QuoteFormState {
  name: string
  totalPremium: string
  grossPremium: string
  vat: string
  loadingPremium: string
  reason: string
  aiSummary: string
  productId: string
  planId: string
  coverageId: string
  benefitsId: string
  inclusionsId: string
  exclusionsId: string
  deductiblesId: string
  warrantiesId: string
  quoteStatus: 'QuoteWon' | 'QuoteLost' | ''
}

export function QuoteWorkbenchPage() {
  const { id = '' } = useParams()
  const location = useLocation()
  const fromInquiryId =
    (location.state as { fromInquiryId?: string } | null)?.fromInquiryId ?? ''
  const backTarget = fromInquiryId ? `/inquiries/${fromInquiryId}` : '/quotes'
  const backLabel = fromInquiryId ? 'Back to Inquiry' : 'Back to Quotes'
  const [refreshKey, setRefreshKey] = useState(0)
  const [form, setForm] = useState<QuoteFormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [statusBusy, setStatusBusy] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportPhase, setExportPhase] = useState<'generating' | 'sending'>('generating')
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [expandedPlanSections, setExpandedPlanSections] = useState<Record<string, boolean>>({
    benefits: false,
    inclusions: false,
    exclusions: false,
    deductibles: false,
    warranties: false,
    coverages: false,
  })
  const [editingPlanRecordKey, setEditingPlanRecordKey] = useState<string | null>(null)
  const [editingPlanRecordName, setEditingPlanRecordName] = useState('')
  const [editingPlanRecordDescription, setEditingPlanRecordDescription] = useState('')
  const [planActionBusyKey, setPlanActionBusyKey] = useState<string | null>(null)
  const [planActionError, setPlanActionError] = useState<string | null>(null)
  const [comparisonApplyBusyKey, setComparisonApplyBusyKey] = useState<string | null>(null)
  const [comparisonAppliedKeys, setComparisonAppliedKeys] = useState<Record<string, boolean>>({})
  const [planSectionsLocal, setPlanSectionsLocal] = useState<QuotePlanLinkedSection[] | null>(null)
  const [planSectionsRefreshKey, setPlanSectionsRefreshKey] = useState(0)
  const [comparisonRefreshKey, setComparisonRefreshKey] = useState(0)
  const [selectedComparisonId, setSelectedComparisonId] = useState<string | null>(null)
  const [comparisonUploadMode, setComparisonUploadMode] = useState(false)
  const [comparisonUploadState, setComparisonUploadState] = useState<'idle' | 'reading' | 'analyzing' | 'ready'>('idle')
  const [comparisonUploadError, setComparisonUploadError] = useState<string | null>(null)
  const [comparisonUploadPayload, setComparisonUploadPayload] = useState<QuotePlanComparisonUploadPayload | null>(null)
  const { data, loading, error } = useAsyncData(async () => {
    const [detail, options] = await Promise.all([getQuoteDetail(id), getQuoteEditorOptions()])
    setForm({
      name: detail.name,
      totalPremium: String(detail.totalPremium || 0),
      grossPremium: String(detail.grossPremium || 0),
      vat: String(detail.vat || 0),
      loadingPremium: String(detail.loadingPremium || 0),
      reason: detail.reason,
      aiSummary: detail.aiSummary,
      productId: options.products.find((item) => item.name === detail.productName)?.id ?? '',
      planId: options.plans.find((item) => item.name === detail.planName)?.id ?? '',
      coverageId: options.coverages.find((item) => item.name === detail.coverageName)?.id ?? '',
      benefitsId: options.benefits.find((item) => item.name === detail.benefitsName)?.id ?? '',
      inclusionsId: options.inclusions.find((item) => item.name === detail.inclusionName)?.id ?? '',
      exclusionsId: options.exclusions.find((item) => item.name === detail.exclusionName)?.id ?? '',
      deductiblesId: options.deductibles.find((item) => item.name === detail.deductibleName)?.id ?? '',
      warrantiesId: options.warranties.find((item) => item.name === detail.warrantyName)?.id ?? '',
      quoteStatus:
        detail.quoteStatusValue === 751820000
          ? 'QuoteWon'
          : detail.quoteStatusValue === 751820001
            ? 'QuoteLost'
            : normalizeQuoteStatus(detail.status),
    })
    return { detail, options }
  }, [id, refreshKey])
  const {
    data: planSections,
    loading: planSectionsLoading,
  } = useAsyncData(
    () => getQuotePlanLinkedSections(form?.planId ?? ''),
    [form?.planId, planSectionsRefreshKey],
  )
  const {
    data: planComparisons,
    loading: planComparisonsLoading,
    error: planComparisonsError,
  } = useAsyncData(
    () => listQuotePlanComparisons(id),
    [id, comparisonRefreshKey],
  )

  useEffect(() => {
    if (comparisonUploadMode || selectedComparisonId || !planComparisons?.length) return
    setSelectedComparisonId(planComparisons[0].id)
  }, [comparisonUploadMode, planComparisons, selectedComparisonId])

  useEffect(() => {
    setPlanSectionsLocal(planSections ?? null)
  }, [planSections])

  if (loading) return <Card>Loading quote workbench...</Card>
  if (error || !data || !form) return <Card>{error ?? 'Quote not found.'}</Card>
  const currentForm = form
  const currentDetail = data.detail
  const visiblePlanSections = planSectionsLocal ?? planSections ?? []

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form) return
    const currentForm = form
    try {
      setSaving(true)
      setSaveError(null)
      await saveQuoteDetail(id, {
        name: currentForm.name,
        totalPremium: Number(currentForm.totalPremium) || 0,
        grossPremium: Number(currentForm.grossPremium) || 0,
        vat: Number(currentForm.vat) || 0,
        loadingPremium: Number(currentForm.loadingPremium) || 0,
        reason: currentForm.reason,
        aiSummary: currentForm.aiSummary,
        productId: currentForm.productId || undefined,
        planId: currentForm.planId || undefined,
        coverageId: currentForm.coverageId || undefined,
        benefitsId: currentForm.benefitsId || undefined,
        inclusionsId: currentForm.inclusionsId || undefined,
        exclusionsId: currentForm.exclusionsId || undefined,
        deductiblesId: currentForm.deductiblesId || undefined,
        warrantiesId: currentForm.warrantiesId || undefined,
        quoteStatus: currentForm.quoteStatus || undefined,
      })
      setRefreshKey((value) => value + 1)
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Unable to save quote.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRenamePlanRecord(entity: QuotePlanLinkedEntityKey, recordId: string) {
    if (!editingPlanRecordName.trim()) return
    const busyKey = `rename:${entity}:${recordId}`
    try {
      setPlanActionBusyKey(busyKey)
      setPlanActionError(null)
      await updateQuotePlanLinkedRecordDetails(entity, recordId, {
        name: editingPlanRecordName.trim(),
        description: editingPlanRecordDescription.trim(),
      })
      setEditingPlanRecordKey(null)
      setEditingPlanRecordName('')
      setEditingPlanRecordDescription('')
      setPlanSectionsRefreshKey((value) => value + 1)
    } catch (cause) {
      setPlanActionError(cause instanceof Error ? cause.message : 'Unable to update the record details.')
    } finally {
      setPlanActionBusyKey(null)
    }
  }

  async function handleQuoteStatusChange(nextStatus: 'QuoteWon' | 'QuoteLost') {
    try {
      setStatusBusy(true)
      setSaveError(null)
      setForm((current) => (current ? { ...current, quoteStatus: nextStatus } : current))
      await updateQuoteStatus(id, nextStatus)
      setRefreshKey((value) => value + 1)
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Unable to update quote status.')
    } finally {
      setStatusBusy(false)
    }
  }

  async function handleDeletePlanRecord(entity: QuotePlanLinkedEntityKey, recordId: string) {
    const busyKey = `delete:${entity}:${recordId}`
    try {
      setPlanActionBusyKey(busyKey)
      setPlanActionError(null)
      await deleteQuotePlanLinkedRecord(entity, recordId)
      setPlanSectionsRefreshKey((value) => value + 1)
    } catch (cause) {
      setPlanActionError(cause instanceof Error ? cause.message : 'Unable to delete the record.')
    } finally {
      setPlanActionBusyKey(null)
    }
  }

  async function handleExportPdf() {
    if (isExporting) return
    let downloaded = false
    try {
      setIsExporting(true)
      setExportPhase('generating')
      setExportMessage(null)
      setExportError(null)
      if (!currentDetail.inquiryId) throw new Error('Link this quote to an inquiry before generating and emailing it.')
      const isHealth = inquiryProductKind(data?.options.products.find((product) => product.id === currentForm.productId)?.name ?? currentDetail.productName) === 'health'
      const pdf = isHealth ? await generateHealthQuotePdf({
        detail: currentDetail,
        inquiry: await getInquiryDetailCore(currentDetail.inquiryId),
        form: currentForm,
        planName: data?.options.plans.find((plan) => plan.id === currentForm.planId)?.name ?? currentDetail.planName,
        planSections: visiblePlanSections,
        healthLogoSrc: healthHeaderSrc,
        nextcareLogoSrc,
      }) : await generateQuotePdf({
        detail: currentDetail,
        form: currentForm,
        planSections: visiblePlanSections,
        headerImageSrc: inquiryProductKind(
          data?.options.products.find((product) => product.id === currentForm.productId)?.name ?? currentDetail.productName,
        ) === 'health' ? healthHeaderSrc : alBuhairaHeaderSrc,
      })
      downloaded = true
      setExportPhase('sending')
      await sendGeneratedQuoteToCustomer(currentDetail.inquiryId, pdf)
      setExportMessage('Quote downloaded and customer email flow started successfully.')
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to generate and email the quote.'
      setExportError(downloaded ? `The PDF was downloaded, but the customer email flow failed: ${message}` : message)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to={backTarget}>
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
      </Button>
      <Card variant="premium" className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="approved">{data.detail.status}</Badge>
              <Badge variant="info">{currentDetail.productName}</Badge>
            </div>
            <h1 className="mt-2 text-[24px] font-bold tracking-[-0.02em]">{data.detail.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Linked inquiry: {currentDetail.inquiry?.name ?? 'No inquiry linked'} - Plan: {currentDetail.planName}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <QuoteStatusChip
                active={form.quoteStatus === 'QuoteWon'}
                disabled={statusBusy}
                icon={CheckCircle2}
                label="Quote Won"
                onClick={() => void handleQuoteStatusChange('QuoteWon')}
              />
              <QuoteStatusChip
                active={form.quoteStatus === 'QuoteLost'}
                disabled={statusBusy}
                icon={XCircle}
                label="Quote Lost"
                tone="danger"
                onClick={() => void handleQuoteStatusChange('QuoteLost')}
              />
            </div>
          </div>
          <div className="space-y-2.5">
            <div className="grid gap-3 md:grid-cols-3">
            <Metric label="Total Premium" value={formatCurrency(currentDetail.totalPremium)} />
            <Metric label="Gross Premium" value={formatCurrency(currentDetail.grossPremium)} />
            <Metric label="VAT" value={`${formatAmount(currentDetail.vat)}%`} />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" className="bg-white hover:bg-surface" disabled={isExporting} onClick={() => void handleExportPdf()}>
                <Download className="h-4 w-4" />
                {isExporting ? exportPhase === 'sending' ? 'Sending to customer...' : 'Generating...' : 'Generate Quote'}
              </Button>
            </div>
          </div>
        </div>
      </Card>
      {exportMessage ? <p role="status" className="rounded-xl border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">{exportMessage}</p> : null}
      {exportError ? <p role="alert" className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{exportError}</p> : null}
      <form onSubmit={handleSave} className="space-y-6">
        <Tabs defaultValue="quote-details">
          <TabsList>
            <TabsTrigger value="quote-details" icon={FileText}>Quote Details</TabsTrigger>
            <TabsTrigger value="plan-details" icon={Layers3}>Plan Details</TabsTrigger>
            <TabsTrigger value="compare-plans" icon={BrainCircuit}>Compare Plans</TabsTrigger>
          </TabsList>
          <TabsContent value="quote-details" className="mt-4">
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <Card className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl font-semibold">Quote Summary</h3>
                  <Button type="submit" disabled={saving}>
                    <Save className="h-4 w-4" />
                    {saving ? 'Saving...' : 'Save Quote'}
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Quote Name">
                    <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                  </Field>
                  <Field label="Total Premium">
                    <AmountInput value={form.totalPremium} onValueChange={(value) => setForm({ ...form, totalPremium: value })} />
                  </Field>
                  <Field label="Gross Premium">
                    <AmountInput value={form.grossPremium} onValueChange={(value) => setForm({ ...form, grossPremium: value })} />
                  </Field>
                  <Field label="VAT">
                    <AmountInput value={form.vat} suffix="%" suffixPlacement="after-value" onValueChange={(value) => setForm({ ...form, vat: value })} />
                  </Field>
                  <Field label="Loading Premium">
                    <AmountInput value={form.loadingPremium} onValueChange={(value) => setForm({ ...form, loadingPremium: value })} />
                  </Field>
                </div>
                <Field label="Outcome Reason">
                  <textarea
                    className="form-field-surface min-h-24 w-full rounded-[16px] border border-border px-3 py-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                    value={form.reason}
                    onChange={(event) => setForm({ ...form, reason: event.target.value })}
                  />
                </Field>
                <Field label="AI Summary">
                  <textarea
                    className="form-field-surface min-h-32 w-full rounded-[16px] border border-border px-3 py-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                    value={form.aiSummary}
                    onChange={(event) => setForm({ ...form, aiSummary: event.target.value })}
                  />
                </Field>
                {saveError ? <p className="text-sm text-danger">{saveError}</p> : null}
              </Card>
              <Card className="space-y-4">
                <h3 className="text-xl font-semibold">Captured Responses</h3>
                {data.detail.responses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No quote rule responses are stored yet for this quote.
                  </p>
                ) : (
                  data.detail.responses.map((response) => (
                    <Card key={response.id} className="bg-surface-soft">
                      <p className="font-semibold">{response.businessRuleName}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{response.response}</p>
                      <Badge className="mt-3" variant="review">
                        {response.conditionMet}
                      </Badge>
                    </Card>
                  ))
                )}
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="plan-details" className="mt-4">
            <div className="space-y-6">
              <Card className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">Plan-linked Catalog</h3>
                    <p className="text-sm text-muted-foreground">
                      Each accordion shows records whose `aur_plan` matches the plan selected on this quote.
                    </p>
                  </div>
                  {form.planId ? <Badge variant="info">Plan linked</Badge> : <Badge variant="neutral">No plan selected</Badge>}
                </div>
                {planActionError ? <p className="text-sm text-danger">{planActionError}</p> : null}
                {!form.planId ? (
                  <p className="text-sm text-muted-foreground">Select a plan on the quote first to load related records.</p>
                ) : planSectionsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading plan-linked records...</p>
                ) : (
                  <div className="space-y-3">
                    {visiblePlanSections.map((section) => {
                      const isExpanded = expandedPlanSections[section.key] ?? false
                      const SectionIcon = planSectionIcon(section.key)
                      return (
                        <div key={section.key} className="overflow-hidden rounded-[24px] border border-border-soft bg-white shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:bg-slate-950/95 dark:shadow-[0_12px_28px_rgba(2,6,23,0.22)]">
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-surface-soft/70"
                            onClick={() =>
                              setExpandedPlanSections((current) => ({
                                ...current,
                                [section.key]: !isExpanded,
                              }))
                            }
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                <SectionIcon className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="text-base font-semibold">{section.title}</p>
                                <p className="text-sm text-muted-foreground">Plan-linked records</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge variant="review">{section.records.length}</Badge>
                              {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                            </div>
                          </button>
                          {isExpanded ? (
                            <div className="border-t border-border-soft px-5 py-5">
                              {section.records.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No {section.title.toLowerCase()} records are linked to this plan yet.</p>
                              ) : (
                                <div className="grid gap-3 xl:grid-cols-4">
                                  {section.records.map((record) => {
                                    const recordKey = `${section.key}:${record.id}`
                                    const isEditing = editingPlanRecordKey === recordKey
                                    const renameBusy = planActionBusyKey === `rename:${section.key}:${record.id}`
                                    const deleteBusy = planActionBusyKey === `delete:${section.key}:${record.id}`
                                    return (
                                      <Card key={record.id} variant="interactive" className="space-y-3 rounded-[20px] border border-border-soft bg-surface px-4 py-4 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0 flex-1">
                                            {isEditing ? (
                                              <div className="space-y-3">
                                                <Input value={editingPlanRecordName} onChange={(event) => setEditingPlanRecordName(event.target.value)} />
                                                <textarea
                                                  className="form-field-surface min-h-[88px] w-full resize-y rounded-[16px] border border-border px-3 py-2.5 text-sm leading-6 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                                                  value={editingPlanRecordDescription}
                                                  placeholder="Description"
                                                  onChange={(event) => setEditingPlanRecordDescription(event.target.value)}
                                                />
                                              </div>
                                            ) : (
                                              <div className="space-y-1.5">
                                                <h4 className="truncate text-sm font-semibold leading-6">{record.name}</h4>
                                                <p className="line-clamp-3 text-xs leading-5 text-muted-foreground">
                                                  {record.description || 'No description captured yet.'}
                                                </p>
                                              </div>
                                            )}
                                          </div>
                                          {!isEditing ? (
                                            <div className="flex items-center gap-1">
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-full bg-white text-muted-foreground hover:bg-surface-soft hover:text-primary"
                                                onClick={() => {
                                                  setEditingPlanRecordKey(recordKey)
                                                  setEditingPlanRecordName(record.name)
                                                  setEditingPlanRecordDescription(record.description)
                                                }}
                                              >
                                                <Pencil className="h-4 w-4" />
                                              </Button>
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-full bg-white text-muted-foreground hover:bg-danger/10 hover:text-danger"
                                                disabled={deleteBusy}
                                                onClick={() => void handleDeletePlanRecord(section.key, record.id)}
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            </div>
                                          ) : null}
                                        </div>
                                        <div className="flex flex-wrap justify-end gap-2">
                                          {isEditing ? (
                                            <>
                                              <Button
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                className="bg-white hover:bg-surface"
                                                onClick={() => {
                                                  setEditingPlanRecordKey(null)
                                                  setEditingPlanRecordName('')
                                                  setEditingPlanRecordDescription('')
                                                }}
                                              >
                                                Cancel
                                              </Button>
                                              <Button
                                                type="button"
                                                size="sm"
                                                disabled={renameBusy}
                                                onClick={() => void handleRenamePlanRecord(section.key, record.id)}
                                              >
                                                <Save className="h-4 w-4" />
                                                {renameBusy ? 'Saving...' : 'Save'}
                                              </Button>
                                            </>
                                          ) : null}
                                        </div>
                                      </Card>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="compare-plans" className="mt-4">
            <ComparePlansWorkspace
              quoteName={currentDetail.name}
              comparisons={planComparisons ?? []}
              loading={planComparisonsLoading}
              error={planComparisonsError}
              selectedComparisonId={selectedComparisonId}
              uploadState={comparisonUploadState}
              uploadError={comparisonUploadError}
              uploadPayload={comparisonUploadPayload}
              planSections={visiblePlanSections}
              applyBusyKey={comparisonApplyBusyKey}
              appliedKeys={comparisonAppliedKeys}
              onApplyMatch={async (sectionKey, recordId, description, applyKey) => {
                try {
                  setPlanActionError(null)
                  setComparisonApplyBusyKey(applyKey)
                  await updateQuotePlanLinkedDescription(sectionKey, recordId, description)
                  setPlanSectionsLocal((current) =>
                    (current ?? visiblePlanSections).map((section) =>
                      section.key === sectionKey
                        ? {
                            ...section,
                            records: section.records.map((record) =>
                              record.id === recordId ? { ...record, description } : record,
                            ),
                          }
                        : section,
                    ),
                  )
                  setComparisonAppliedKeys((current) => ({ ...current, [applyKey]: true }))
                } catch (cause) {
                  setPlanActionError(cause instanceof Error ? cause.message : 'Unable to apply matched plan detail.')
                } finally {
                  setComparisonApplyBusyKey(null)
                }
              }}
              onSelectComparison={(comparisonId) => {
                setComparisonUploadMode(false)
                setSelectedComparisonId(comparisonId)
                setComparisonUploadPayload(null)
                setComparisonUploadError(null)
                setComparisonUploadState('idle')
              }}
              onRefresh={() => setComparisonRefreshKey((value) => value + 1)}
              onUploadAnother={() => {
                setComparisonUploadMode(true)
                setComparisonUploadPayload(null)
                setComparisonUploadError(null)
                setComparisonUploadState('idle')
                setSelectedComparisonId(null)
              }}
              onFileSelected={async (file) => {
                try {
                  setComparisonUploadError(null)
                  setComparisonUploadState('reading')
                  const fileContent = await readFileAsBase64(file)
                  const payload: QuotePlanComparisonUploadPayload = {
                    recordId: id,
                    uploadedFile: {
                      fileName: file.name,
                      fileType: file.type || 'application/octet-stream',
                      fileContent,
                    },
                  }
                  setComparisonUploadPayload(payload)
                  setComparisonUploadMode(true)
                  setSelectedComparisonId(null)
                  setComparisonUploadState('analyzing')
                  const result = await analyzeQuotePlanComparison(payload)
                  await delay(1600)
                  setSelectedComparisonId(result.comparisonId ?? null)
                  setComparisonRefreshKey((value) => value + 1)
                  setComparisonUploadPayload(null)
                  setComparisonUploadState('ready')
                } catch (cause) {
                  setComparisonUploadError(cause instanceof Error ? cause.message : 'Unable to prepare the file for analysis.')
                  setComparisonUploadState('idle')
                }
              }}
            />
          </TabsContent>
        </Tabs>
      </form>
    </div>
  )
}

function ComparePlansWorkspace({
  quoteName,
  comparisons,
  loading,
  error,
  selectedComparisonId,
  uploadState,
  uploadError,
  uploadPayload,
  planSections,
  applyBusyKey,
  appliedKeys,
  onApplyMatch,
  onSelectComparison,
  onRefresh,
  onUploadAnother,
  onFileSelected,
}: {
  quoteName: string
  comparisons: QuotePlanComparison[]
  loading: boolean
  error: string | null
  selectedComparisonId: string | null
  uploadState: 'idle' | 'reading' | 'analyzing' | 'ready'
  uploadError: string | null
  uploadPayload: QuotePlanComparisonUploadPayload | null
  planSections: QuotePlanLinkedSection[]
  applyBusyKey: string | null
  appliedKeys: Record<string, boolean>
  onApplyMatch: (sectionKey: QuotePlanLinkedEntityKey, recordId: string, description: string, applyKey: string) => Promise<void>
  onSelectComparison: (comparisonId: string) => void
  onRefresh: () => void
  onUploadAnother: () => void
  onFileSelected: (file: File) => Promise<void>
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const selectedComparison = comparisons.find((comparison) => comparison.id === selectedComparisonId)
  const showingUploadResult = uploadPayload && uploadState === 'ready'
  const isBusy = uploadState === 'reading' || uploadState === 'analyzing'

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(280px,0.34fr)_minmax(0,1fr)]">
      <Card className="overflow-hidden rounded-[30px] p-0 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)]">
        <div className="border-b border-border-soft bg-[linear-gradient(135deg,rgba(40,108,255,0.09),rgba(255,255,255,0.96)_52%,rgba(168,85,247,0.08))] px-5 py-5 dark:bg-[linear-gradient(135deg,rgba(40,108,255,0.18),rgba(15,23,42,0.98)_48%,rgba(88,28,135,0.20))]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-glow">
                <History className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Comparison History</p>
                <h3 className="mt-1 text-lg font-bold">Existing analyses</h3>
              </div>
            </div>
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-2xl bg-white/70 dark:bg-white/10" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="scrollbar-sleek max-h-[420px] overflow-y-auto p-4 pr-3 xl:max-h-[calc(100vh-17rem)]">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-24 animate-pulse rounded-[22px] bg-surface-soft" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-[20px] border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          ) : comparisons.length ? (
            <div className="space-y-3">
              {comparisons.map((comparison, index) => {
                const active = selectedComparisonId === comparison.id
                return (
                  <button
                    key={comparison.id}
                    type="button"
                    className={`w-full rounded-[22px] border px-4 py-4 text-left transition duration-200 ${
                      active
                        ? 'border-primary/25 bg-primary/8'
                        : 'border-border-soft bg-white hover:-translate-y-0.5 hover:border-primary/20 hover:bg-primary/5 dark:bg-surface'
                    }`}
                    onClick={() => onSelectComparison(comparison.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-bold">{comparison.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{comparison.createdOn ? `Created ${formatShortDate(comparison.createdOn)}` : 'Analysis record'}</p>
                      </div>
                      <span className="rounded-full border border-primary/10 bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                        #{index + 1}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-3 text-xs leading-5 text-muted-foreground">
                      {plainTextPreview(comparison.response)}
                    </p>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="rounded-[24px] border border-dashed border-border-soft bg-surface-soft/60 px-5 py-10 text-center">
              <FileSearch className="mx-auto h-8 w-8 text-primary" />
              <p className="mt-3 font-semibold">No comparisons yet</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Upload a plan document to start comparing available plan details for this quote.
              </p>
            </div>
          )}
        </div>
      </Card>

      <Card className="relative overflow-hidden rounded-[34px] border-primary/10 p-0">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(40,108,255,0.08),transparent_30%),radial-gradient(circle_at_88%_8%,rgba(168,85,247,0.07),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,251,255,0.84))] dark:bg-[radial-gradient(circle_at_20%_0%,rgba(79,152,255,0.10),transparent_30%),radial-gradient(circle_at_88%_8%,rgba(168,85,247,0.10),transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(30,41,59,0.90))]" />
        <div className="relative space-y-6 p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-white text-primary shadow-[0_18px_36px_rgba(40,108,255,0.16)] dark:bg-white/10 dark:text-[#93C5FD]">
                <BrainCircuit className="h-7 w-7" />
              </div>
              <div>
                <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-primary">AI Plan Comparison</p>
                <h3 className="mt-1 text-2xl font-bold tracking-[-0.03em]">Compare plans for this quote</h3>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
                  Upload a plan schedule or coverage document. The analyzer will compare file content against the quote’s plan structure and return a plan-level summary.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
              <Badge variant="info">{quoteName}</Badge>
              <Button type="button" variant="secondary" className="bg-white dark:bg-surface" onClick={onUploadAnother}>
                <UploadCloud className="h-4 w-4" />
                Upload Another Document
              </Button>
            </div>
          </div>

          {!selectedComparison && !showingUploadResult ? (
            isBusy ? (
              <PlanComparisonAnalyzingScreen fileName={uploadPayload?.uploadedFile.fileName} state={uploadState} />
            ) : (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
              <button
                type="button"
                className="group relative min-h-[360px] overflow-hidden rounded-[32px] border border-primary/15 bg-white/82 px-6 py-8 text-left shadow-[0_24px_70px_rgba(40,108,255,0.14)] transition duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_30px_85px_rgba(40,108,255,0.20)] dark:bg-surface/80"
                onClick={() => inputRef.current?.click()}
              >
                <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(79,152,255,0.10),transparent)] opacity-0 transition duration-500 group-hover:opacity-100" />
                <span className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/12 blur-2xl" />
                <span className="pointer-events-none absolute -bottom-16 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full bg-[#A855F7]/12 blur-3xl" />
                <div className="relative flex h-full min-h-[304px] flex-col items-center justify-center text-center">
                  <div className="flex h-24 w-24 items-center justify-center rounded-[32px] bg-primary text-white shadow-glow transition duration-300 group-hover:scale-105">
                    <UploadCloud className="h-10 w-10" />
                  </div>
                  <h4 className="mt-6 text-2xl font-bold tracking-[-0.03em]">Upload plan document</h4>
                  <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">
                    Attach a plan schedule, coverage document, or comparison file. We will prepare the document for AI plan matching against this quote.
                  </p>
                  <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                    {['PDF', 'DOCX', 'XLSX', 'PNG'].map((type) => (
                      <span key={type} className="rounded-full border border-primary/10 bg-primary/8 px-3 py-1 text-xs font-semibold text-primary">
                        {type}
                      </span>
                    ))}
                  </div>
                </div>
              </button>

              <div className="grid gap-3">
                {[
                  { icon: FileText, label: 'Extract plan content', text: 'Read benefits, coverage, inclusions, and exclusions.' },
                  { icon: Bot, label: 'Compare with quote', text: 'Match extracted plan content against this quote.' },
                  { icon: Sparkles, label: 'Generate response', text: 'Show a clean comparison narrative.' },
                ].map((step, index) => (
                  <div key={step.label} className="rounded-[24px] border border-border-soft bg-white/78 px-4 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)] dark:bg-surface/75">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <step.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-muted-foreground">0{index + 1}</span>
                        <p className="font-semibold">{step.label}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.text}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )
          ) : (
            <ComparisonResponsePanel
              comparison={selectedComparison}
              uploadPayload={showingUploadResult ? uploadPayload : null}
              planSections={planSections}
              applyBusyKey={applyBusyKey}
              appliedKeys={appliedKeys}
              onApplyMatch={onApplyMatch}
            />
          )}

          {uploadError ? (
            <div className="rounded-[20px] border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
              {uploadError}
            </div>
          ) : null}

          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.xlsx,.xls,.png,.jpg,.jpeg"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void onFileSelected(file)
            }}
          />
        </div>
      </Card>
    </div>
  )
}

function ComparisonResponsePanel({
  comparison,
  uploadPayload,
  planSections,
  applyBusyKey,
  appliedKeys,
  onApplyMatch,
}: {
  comparison?: QuotePlanComparison
  uploadPayload: QuotePlanComparisonUploadPayload | null
  planSections: QuotePlanLinkedSection[]
  applyBusyKey: string | null
  appliedKeys: Record<string, boolean>
  onApplyMatch: (sectionKey: QuotePlanLinkedEntityKey, recordId: string, description: string, applyKey: string) => Promise<void>
}) {
  const [activeInsightTab, setActiveInsightTab] = useState<'matches' | 'suggested' | 'unmatched'>('matches')
  const response = comparison
    ? comparison.response || buildEmptyComparisonMessage()
    : buildPendingComparisonMessage(uploadPayload)
  const parsedSections = parsePlanComparisonResponse(response)
  const totalMatches = parsedSections.reduce((sum, section) => sum + section.items.length, 0)
  const averageConfidence = calculateAverageConfidence(parsedSections)
  const suggestedItems = parseLoosePlanDetails(comparison?.suggestedPlanDetails ?? '')
  const unmatchedItems = parseLoosePlanDetails(comparison?.unmatchedPlanDetails ?? '')

  return (
    <div className="overflow-hidden rounded-[30px] border border-primary/10 bg-white/95 shadow-[0_18px_45px_rgba(15,23,42,0.08)] dark:bg-surface/90">
      <div className="flex flex-col gap-3 border-b border-border-soft pb-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3 px-5 pt-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#286CFF,#A855F7)] text-white shadow-[0_16px_32px_rgba(40,108,255,0.22)]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-primary">Plan Match Intelligence</p>
            <h4 className="mt-1 text-xl font-bold">{comparison?.name || uploadPayload?.uploadedFile.fileName || 'Plan comparison'}</h4>
            <p className="mt-1 text-xs text-muted-foreground">AI-reviewed plan comparison output</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 px-5 pt-5">
          <span className="rounded-full border border-primary/10 bg-primary/8 px-3 py-1.5 text-xs font-bold text-primary">{totalMatches} matches</span>
          <span className="rounded-full border border-[#A855F7]/15 bg-[#A855F7]/10 px-3 py-1.5 text-xs font-bold text-[#A855F7]">{averageConfidence}% avg confidence</span>
        </div>
      </div>
      <div className="p-5">
        <div className="mb-5 flex flex-wrap gap-2 rounded-[22px] border border-border-soft bg-surface-soft/55 p-1.5 dark:bg-white/5">
          {[
            { id: 'matches', label: 'Matched Details', count: totalMatches },
            { id: 'suggested', label: 'AI Suggested Plan Details', count: suggestedItems.length },
            { id: 'unmatched', label: 'Unmatched Plan Details', count: unmatchedItems.length },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`inline-flex items-center gap-2 rounded-[16px] px-4 py-2 text-sm font-semibold transition ${
                activeInsightTab === tab.id
                  ? 'bg-white text-primary shadow-[0_10px_24px_rgba(40,108,255,0.10)] dark:bg-surface'
                  : 'text-muted-foreground hover:bg-white/70 hover:text-foreground dark:hover:bg-white/10'
              }`}
              onClick={() => setActiveInsightTab(tab.id as 'matches' | 'suggested' | 'unmatched')}
            >
              {tab.label}
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">{tab.count}</span>
            </button>
          ))}
        </div>

        {activeInsightTab === 'matches' ? (
          <div className="space-y-5">
            {parsedSections.length ? (
              parsedSections.map((section) => (
                <div key={section.title} className="overflow-hidden rounded-[26px] border border-primary/10 bg-[linear-gradient(135deg,rgba(248,251,255,0.98),rgba(255,255,255,0.98))] dark:bg-white/5">
                  <div className="flex items-center justify-between gap-3 border-b border-primary/10 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Layers3 className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="font-bold">{section.title}</p>
                        <p className="text-xs text-muted-foreground">{section.items.length} matched plan detail{section.items.length === 1 ? '' : 's'}</p>
                      </div>
                    </div>
                    <Badge variant="info">Matched</Badge>
                  </div>
                  <div className="grid gap-4 p-4">
                    {section.items.map((item, index) => (
                      <MatchedPlanDetailCard
                        key={`${section.title}-${item.systemPlanName}-${index}`}
                        sectionTitle={section.title}
                        item={item}
                        index={index}
                        planSections={planSections}
                        applyBusyKey={applyBusyKey}
                        appliedKeys={appliedKeys}
                        onApplyMatch={onApplyMatch}
                      />
                    ))}
                  </div>
                </div>
              ))
            ) : (
              response.split(/\n{2,}/).map((paragraph) => (
                <p key={paragraph} className="whitespace-pre-wrap text-sm leading-7 text-foreground/90">
                  {paragraph}
                </p>
              ))
            )}
          </div>
        ) : null}

        {activeInsightTab === 'suggested' ? (
          <PlanInsightPanel
            title="AI Suggested Plan Details"
            tone="suggested"
            emptyText="No suggested plan details were returned for this comparison."
            items={suggestedItems}
          />
        ) : null}

        {activeInsightTab === 'unmatched' ? (
          <PlanInsightPanel
            title="Unmatched Plan Details"
            tone="unmatched"
            emptyText="No unmatched plan details were returned for this comparison."
            items={unmatchedItems}
          />
        ) : null}
      </div>
    </div>
  )
}

function MatchedPlanDetailCard({
  sectionTitle,
  item,
  index,
  planSections,
  applyBusyKey,
  appliedKeys,
  onApplyMatch,
}: {
  sectionTitle: string
  item: MatchedPlanDetail
  index: number
  planSections: QuotePlanLinkedSection[]
  applyBusyKey: string | null
  appliedKeys: Record<string, boolean>
  onApplyMatch: (sectionKey: QuotePlanLinkedEntityKey, recordId: string, description: string, applyKey: string) => Promise<void>
}) {
  const sectionKey = planComparisonSectionKey(sectionTitle)
  const matchedRecord = sectionKey
    ? planSections
        .find((section) => section.key === sectionKey)
        ?.records.find((record) => {
          const recordName = normalizePlanText(record.name)
          const extractedName = normalizePlanText(item.systemPlanName)
          return recordName === extractedName || recordName.includes(extractedName) || extractedName.includes(recordName)
        })
    : undefined
  const applyKey = sectionKey && matchedRecord ? `${sectionKey}:${matchedRecord.id}:${normalizePlanText(item.uploadedDocumentMatch)}` : ''
  const isApplied =
    Boolean(applyKey && appliedKeys[applyKey]) ||
    Boolean(matchedRecord?.description && normalizePlanText(matchedRecord.description) === normalizePlanText(item.uploadedDocumentMatch))
  const isBusy = applyBusyKey === applyKey
  const canApply = Boolean(sectionKey && matchedRecord && item.uploadedDocumentMatch)

  return (
    <div className={`rounded-[24px] border bg-white p-4 transition duration-200 hover:border-primary/20 dark:bg-surface ${isApplied ? 'border-emerald-200/80 bg-emerald-50/30 dark:border-emerald-400/20' : 'border-border-soft'}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#A855F7]/10 text-[11px] font-bold text-[#A855F7]">{index + 1}</span>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-5">{item.systemPlanName}</p>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ConfidencePill score={item.confidenceScore} />
          <Button
            type="button"
            size="sm"
            className={`h-8 rounded-full px-3 text-xs transition ${isApplied ? 'bg-emerald-600 hover:bg-emerald-600' : ''}`}
            disabled={!canApply || isApplied || isBusy}
            onClick={() => {
              if (sectionKey && matchedRecord) void onApplyMatch(sectionKey, matchedRecord.id, item.uploadedDocumentMatch, applyKey)
            }}
          >
            {isBusy ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Applying
              </>
            ) : isApplied ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Applied
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                Apply
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-[18px] border border-primary/10 bg-primary/5 px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">Current Plan Detail</p>
          <p className="mt-2 text-sm leading-6 text-foreground/90">
            {matchedRecord?.description || item.systemPlanDescription || 'No current plan description captured yet.'}
          </p>
        </div>
        <div className="rounded-[18px] border border-[#A855F7]/10 bg-[#A855F7]/5 px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#A855F7]">Uploaded Document Match</p>
          <p className="mt-2 text-sm leading-6 text-foreground/90">{item.uploadedDocumentMatch || 'No matching document wording found.'}</p>
        </div>
      </div>
      {!matchedRecord ? (
        <p className="mt-2 text-xs text-warning">No matching plan record found for this item.</p>
      ) : null}
    </div>
  )
}

function ConfidencePill({ score }: { score: number }) {
  const safeScore = Math.max(0, Math.min(100, Math.round(score)))
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#A855F7]/15 bg-[#A855F7]/8 px-2.5 text-xs font-bold text-[#A855F7]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#A855F7]" />
      {safeScore}% confidence
    </span>
  )
}

function PlanInsightPanel({
  title,
  items,
  emptyText,
  tone,
}: {
  title: string
  items: Array<{ name: string; description: string }>
  emptyText: string
  tone: 'suggested' | 'unmatched'
}) {
  const toneClass =
    tone === 'suggested'
      ? 'border-emerald-200/70 bg-emerald-50/80 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-950/20 dark:text-emerald-200'
      : 'border-amber-200/80 bg-amber-50/80 text-amber-700 dark:border-amber-400/20 dark:bg-amber-950/20 dark:text-amber-200'

  return (
    <div className="rounded-[26px] border border-border-soft bg-white p-4 dark:bg-surface">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${toneClass}`}>
            {tone === 'suggested' ? <Sparkles className="h-4 w-4" /> : <FileWarning className="h-4 w-4" />}
          </span>
          <div>
            <p className="font-bold">{title}</p>
            <p className="text-xs text-muted-foreground">{items.length} item{items.length === 1 ? '' : 's'}</p>
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {items.length ? (
          items.map((item, index) => (
            <div key={`${title}-${item.name}-${index}`} className="rounded-[18px] border border-border-soft bg-surface-soft/60 px-4 py-3">
              <p className="text-sm font-semibold">{item.name}</p>
              {item.description ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p> : null}
            </div>
          ))
        ) : (
          <p className="rounded-[18px] border border-dashed border-border-soft bg-surface-soft/50 px-4 py-5 text-sm leading-6 text-muted-foreground">
            {emptyText}
          </p>
        )}
      </div>
    </div>
  )
}

function PlanComparisonAnalyzingScreen({
  fileName,
  state,
}: {
  fileName?: string
  state: 'idle' | 'reading' | 'analyzing' | 'ready'
}) {
  const isReading = state === 'reading'

  return (
    <div className="relative min-h-[430px] overflow-hidden rounded-[32px] border border-primary/15 bg-white/86 px-5 py-8 shadow-[0_24px_70px_rgba(40,108,255,0.14)] dark:bg-surface/85">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(40,108,255,0.18),transparent_24%),radial-gradient(circle_at_34%_30%,rgba(168,85,247,0.16),transparent_24%),radial-gradient(circle_at_70%_72%,rgba(14,165,233,0.14),transparent_22%)]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/10 bg-primary/5 blur-2xl" />

      <div className="relative mx-auto flex max-w-4xl flex-col items-center text-center">
        <div className="relative h-64 w-full max-w-[720px]">
          <div className="absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/10" />
          <div className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#A855F7]/15" />
          <div className="absolute left-1/2 top-1/2 z-20 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[34px] bg-primary text-white shadow-[0_24px_50px_rgba(40,108,255,0.34)]">
            <span className="absolute inset-0 rounded-[34px] bg-white/20 animate-ping" />
            <span className="absolute -inset-3 rounded-[42px] border border-primary/30 animate-pulse" />
            <BrainCircuit className="relative h-12 w-12" />
          </div>

          {[
            'left-[8%] top-[23%]',
            'left-[16%] top-[68%]',
            'right-[10%] top-[24%]',
            'right-[16%] top-[69%]',
          ].map((position, index) => (
            <div key={position} className={`absolute ${position} z-10 flex h-16 w-16 items-center justify-center rounded-[22px] border border-primary/15 bg-white text-primary shadow-[0_18px_35px_rgba(40,108,255,0.12)] transition duration-500 ${index % 2 === 0 ? 'animate-pulse' : ''} dark:bg-surface`}>
              {index % 2 === 0 ? <FileText className="h-7 w-7" /> : <Layers3 className="h-7 w-7" />}
            </div>
          ))}

          <span className="absolute left-[18%] top-[35%] h-[2px] w-[29%] origin-right rotate-[10deg] overflow-hidden rounded-full bg-primary/10">
            <span className="absolute inset-y-0 left-0 w-1/2 animate-pulse rounded-full bg-gradient-to-r from-transparent via-primary to-[#A855F7]" />
          </span>
          <span className="absolute left-[25%] top-[62%] h-[2px] w-[24%] origin-right -rotate-[15deg] overflow-hidden rounded-full bg-[#A855F7]/10">
            <span className="absolute inset-y-0 right-0 w-1/2 animate-pulse rounded-full bg-gradient-to-r from-transparent via-[#A855F7] to-primary" />
          </span>
          <span className="absolute right-[19%] top-[35%] h-[2px] w-[29%] origin-left -rotate-[10deg] overflow-hidden rounded-full bg-primary/10">
            <span className="absolute inset-y-0 right-0 w-1/2 animate-pulse rounded-full bg-gradient-to-l from-transparent via-primary to-[#A855F7]" />
          </span>
          <span className="absolute right-[25%] top-[62%] h-[2px] w-[24%] origin-left rotate-[15deg] overflow-hidden rounded-full bg-[#A855F7]/10">
            <span className="absolute inset-y-0 left-0 w-1/2 animate-pulse rounded-full bg-gradient-to-l from-transparent via-[#A855F7] to-primary" />
          </span>

          <span className="absolute left-[39%] top-[34%] h-3 w-3 animate-ping rounded-full bg-primary/70" />
          <span className="absolute right-[39%] top-[64%] h-3 w-3 animate-ping rounded-full bg-[#A855F7]/70" />
          <span className="absolute left-[47%] top-[20%] h-2 w-2 animate-pulse rounded-full bg-sky-400" />
          <span className="absolute right-[47%] bottom-[17%] h-2 w-2 animate-pulse rounded-full bg-[#A855F7]" />
        </div>

        <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-primary">
          {isReading ? 'Preparing Upload' : 'Analyzing Document'}
        </p>
        <h4 className="mt-2 text-2xl font-bold tracking-[-0.03em]">
          {isReading ? 'Reading your file securely' : 'AI is comparing plan details'}
        </h4>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
          {fileName ? `${fileName} is being prepared for plan comparison.` : 'Your file is being prepared for plan comparison.'} We are matching the uploaded document against the quote context and existing plan structure.
        </p>

        <div className="mt-7 grid w-full max-w-3xl gap-3 md:grid-cols-3">
          {[
            ['Extracting', 'Reading plan and schedule content'],
            ['Matching', 'Comparing benefits and coverage'],
            ['Summarizing', 'Preparing a concise response'],
          ].map(([title, text], index) => (
            <div key={title} className="rounded-[22px] border border-primary/10 bg-white/78 px-4 py-4 text-left shadow-[0_12px_30px_rgba(15,23,42,0.06)] dark:bg-white/5">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-primary/10 text-xs font-bold text-primary">
                  0{index + 1}
                </span>
                <p className="font-semibold">{title}</p>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border-soft bg-surface-soft p-4">
      <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-base font-semibold">{value}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

function planSectionIcon(key: QuotePlanLinkedEntityKey) {
  if (key === 'benefits') return Gem
  if (key === 'inclusions') return BadgeCheck
  if (key === 'exclusions') return TicketSlash
  if (key === 'deductibles') return FileWarning
  if (key === 'warranties') return ShieldCheck
  return ShieldAlert
}

function QuoteStatusChip({
  active,
  disabled,
  icon: Icon,
  label,
  onClick,
  tone = 'primary',
}: {
  active: boolean
  disabled?: boolean
  icon: typeof CheckCircle2
  label: string
  onClick: () => void
  tone?: 'primary' | 'danger'
}) {
  const activeClass =
    tone === 'danger'
      ? 'border-danger/30 bg-danger/10 text-danger'
      : 'border-primary/30 bg-primary/10 text-primary'
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${active ? activeClass : 'border-border-soft bg-white text-muted-foreground hover:bg-surface-soft'} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      <span className={`flex h-5 w-5 items-center justify-center rounded-full ${active ? (tone === 'danger' ? 'bg-danger/15' : 'bg-primary/15') : 'bg-surface-soft'}`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      {label}
    </button>
  )
}

function normalizeQuoteStatus(value: string) {
  const normalized = value.replace(/\s+/g, '').trim().toLowerCase()
  if (normalized === 'quotewon') return 'QuoteWon'
  if (normalized === 'quotelost') return 'QuoteLost'
  return ''
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Unable to read the selected file.'))
    reader.onload = () => {
      const value = String(reader.result ?? '')
      resolve(value.includes(',') ? value.split(',').pop() ?? '' : value)
    }
    reader.readAsDataURL(file)
  })
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function formatShortDate(value?: string) {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function plainTextPreview(value: string) {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'No comparison response captured yet.'
}

interface MatchedPlanDetail {
  systemPlanName: string
  systemPlanDescription: string
  uploadedDocumentMatch: string
  confidenceScore: number
}

function parsePlanComparisonResponse(value: string) {
  const normalized = value.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []

  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const sections: Array<{
    title: string
    items: MatchedPlanDetail[]
  }> = []
  let current: {
    title: string
    items: MatchedPlanDetail[]
  } | null = null

  for (const line of lines) {
    if (/^[A-Za-z][A-Za-z\s/&-]+:$/.test(line)) {
      current = { title: line.replace(/:$/, ''), items: [] }
      sections.push(current)
      continue
    }

    if (!current) {
      current = { title: 'Comparison Notes', items: [] }
      sections.push(current)
    }

    const parsed = parseMatchedPlanLineV2(line)
    current.items.push(parsed)
  }

  return sections.filter((section) => section.items.length)
}

function parseMatchedPlanLine(line: string) {
  const parts = line.split('|').map((part) => part.trim())
  const systemPart = parts.find((part) => /^System Plan Detail:/i.test(part))
  const uploadedPart = parts.find((part) => /^Uploaded Document Match:/i.test(part))
  const confidencePart = parts.find((part) => /^Confidence Score:/i.test(part))
  const fallbackParts = line.split(/\s+—\s+|\s+-\s+/)

  return {
    systemPlanDetail:
      stripPlanPrefix(systemPart, 'System Plan Detail') ||
      fallbackParts[0]?.trim() ||
      'Plan detail',
    uploadedDocumentMatch:
      stripPlanPrefix(uploadedPart, 'Uploaded Document Match') ||
      fallbackParts.slice(1).join(' - ').trim(),
    confidenceScore: parseConfidenceScore(stripPlanPrefix(confidencePart, 'Confidence Score')),
  }
}

function parseMatchedPlanLineV2(line: string): MatchedPlanDetail {
  const parts = line.split('|').map((part) => part.trim())
  const systemPart = parts.find((part) => /^System Plan Detail:/i.test(part))
  const uploadedPart = parts.find((part) => /^Uploaded Document Match:/i.test(part))
  const confidencePart = parts.find((part) => /^Confidence Score:/i.test(part))
  const fallbackParts = line.split(/\s+—\s+|\s+-\s+/)
  const legacyParsed = parseMatchedPlanLine(line)
  const systemPlanDetail =
    stripPlanPrefix(systemPart, 'System Plan Detail') ||
    legacyParsed.systemPlanDetail ||
    fallbackParts[0]?.trim() ||
    'Plan detail'
  const [systemPlanName, ...descriptionParts] = systemPlanDetail.split(/\s+—\s+|\s+-\s+/)

  return {
    systemPlanName: systemPlanName?.trim() || 'Plan detail',
    systemPlanDescription: descriptionParts.join(' - ').trim(),
    uploadedDocumentMatch:
      stripPlanPrefix(uploadedPart, 'Uploaded Document Match') ||
      legacyParsed.uploadedDocumentMatch ||
      fallbackParts.slice(1).join(' - ').trim(),
    confidenceScore:
      parseConfidenceScore(stripPlanPrefix(confidencePart, 'Confidence Score')) ||
      legacyParsed.confidenceScore,
  }
}

function stripPlanPrefix(value: string | undefined, label: string) {
  return value?.replace(new RegExp(`^${label}:`, 'i'), '').trim() ?? ''
}

function parseConfidenceScore(value: string | undefined) {
  const score = Number(String(value ?? '').match(/\d+(\.\d+)?/)?.[0] ?? 0)
  return Number.isFinite(score) ? score : 0
}

function planComparisonSectionKey(sectionTitle: string): QuotePlanLinkedEntityKey | null {
  const normalized = sectionTitle.trim().toLowerCase()
  if (normalized.includes('benefit')) return 'benefits'
  if (normalized.includes('inclusion')) return 'inclusions'
  if (normalized.includes('exclusion')) return 'exclusions'
  if (normalized.includes('deductible')) return 'deductibles'
  if (normalized.includes('warrant')) return 'warranties'
  if (normalized.includes('coverage') || normalized.includes('coverages')) return 'coverages'
  return null
}

function normalizePlanText(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function calculateAverageConfidence(
  sections: Array<{ items: Array<{ confidenceScore: number }> }>,
) {
  const scores = sections.flatMap((section) => section.items.map((item) => item.confidenceScore)).filter((score) => score > 0)
  if (!scores.length) return 0
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
}

function parseLoosePlanDetails(value: string) {
  const normalized = value.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []

  return normalized
    .split(/\n{2,}|\n(?=[A-Za-z].*?(?:—|-))/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((line) => {
      const cleanLine = line.replace(/^[-*•\d.)\s]+/, '').trim()
      const [name, ...descriptionParts] = cleanLine.split(/\s+—\s+|\s+-\s+/)
      return {
        name: name?.replace(/:$/, '').trim() || 'Plan detail',
        description: descriptionParts.join(' - ').trim(),
      }
    })
}

function buildPendingComparisonMessage(payload: QuotePlanComparisonUploadPayload | null) {
  if (!payload) return 'Upload a plan document or select an existing comparison to view the generated response.'

  return [
    'Your file has been prepared for plan comparison.',
    `File: ${payload.uploadedFile.fileName}`,
    `Type: ${payload.uploadedFile.fileType}`,
    'The new comparison result will appear here after the analysis service returns the generated record.',
  ].join('\n\n')
}

function buildEmptyComparisonMessage() {
  return [
    'No comparable plan details were found in this document.',
    'The uploaded file may not contain recognizable benefits, coverages, inclusions, exclusions, deductibles, or warranties for this quote.',
    'Please upload a relevant plan schedule or policy document and try the comparison again.',
  ].join('\n\n')
}
