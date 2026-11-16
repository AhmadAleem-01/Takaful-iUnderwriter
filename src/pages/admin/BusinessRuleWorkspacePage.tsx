import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  BellRing,
  CheckCircle2,
  FilePenLine,
  FileText,
  Mail,
  Pencil,
  Plus,
  Save,
  ShieldAlert,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { useAsyncData } from '../../hooks/useAsyncData'
import {
  BUSINESS_RULE_CATEGORY_OPTIONS,
  BUSINESS_RULE_INQUIRY_TYPE_OPTIONS,
  CONSEQUENCE_ACTION_OPTIONS,
  CONSEQUENCE_ACTIONS_BY_TYPE,
  CONSEQUENCE_TYPE_OPTIONS,
  deleteBusinessRuleConsequence,
  getBusinessRuleWorkspace,
  requiresNotificationText,
  saveBusinessRule,
  saveBusinessRuleConsequence,
  type BusinessRuleConsequence,
} from '../../services/businessRulesService'

interface BusinessRuleFormState {
  name: string
  categoryValue: string
  parentRuleId: string
  inquiryTypeValue: string
}

interface ConsequenceEditorState {
  open: boolean
  id?: string
  typeValue: string
  actionValue: string
  notificationText: string
  riskScore: string
  riskSummary: string
  ratingAdd: string
  ratingMultiply: string
  documentTemplateId: string
  emailTemplateId: string
}

const emptyConsequenceEditor: ConsequenceEditorState = {
  open: false,
  typeValue: '',
  actionValue: '',
  notificationText: '',
  riskScore: '',
  riskSummary: '',
  ratingAdd: '',
  ratingMultiply: '',
  documentTemplateId: '',
  emailTemplateId: '',
}

export function BusinessRuleWorkspacePage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isCreate = !id || id === 'create'
  const [refreshKey, setRefreshKey] = useState(0)
  const [form, setForm] = useState<BusinessRuleFormState | null>(null)
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [consequenceEditor, setConsequenceEditor] = useState<ConsequenceEditorState>(emptyConsequenceEditor)
  const [consequenceBusy, setConsequenceBusy] = useState<string | null>(null)
  const [consequenceError, setConsequenceError] = useState<string | null>(null)
  const [consequenceFilter, setConsequenceFilter] = useState('All')

  const { data, loading, error } = useAsyncData(
    () => getBusinessRuleWorkspace(isCreate ? undefined : id),
    [id, isCreate, refreshKey],
  )

  useEffect(() => {
    if (!data) return
    setForm({
      name: data.rule?.name ?? '',
      categoryValue: data.rule?.categoryValue ?? '',
      parentRuleId: data.rule?.parentRuleId ?? '',
      inquiryTypeValue: data.rule?.inquiryTypeValue ?? '',
    })
    setConsequenceEditor(emptyConsequenceEditor)
    setConsequenceError(null)
    setConsequenceFilter('All')
  }, [data])

  useEffect(() => {
    if (!saveSuccess) return
    const timeout = window.setTimeout(() => {
      setSaveSuccess(null)
    }, 2500)

    return () => window.clearTimeout(timeout)
  }, [saveSuccess])

  const consequenceStats = useMemo(() => {
    const consequences = data?.consequences ?? []
    return [
      { label: 'Linked Consequences', value: String(consequences.length), helper: 'Outcome records attached to this business rule.' },
      {
        label: 'Case Control',
        value: String(consequences.filter((item) => item.typeValue === '1').length),
        helper: 'Escalation, referral, and decline actions.',
      },
      {
        label: 'Notifications',
        value: String(consequences.filter((item) => item.typeValue === '2' || item.typeValue === '5').length),
        helper: 'Email and missing-information follow-ups.',
      },
      {
        label: 'Documents & Risk',
        value: String(consequences.filter((item) => item.typeValue === '3' || item.typeValue === '4').length),
        helper: 'Document generation and risk-score updates.',
      },
    ]
  }, [data?.consequences])

  const allowedActionOptions = useMemo(
    () =>
      CONSEQUENCE_ACTION_OPTIONS.filter((option) =>
        (CONSEQUENCE_ACTIONS_BY_TYPE[consequenceEditor.typeValue] ?? []).includes(option.value),
      ),
    [consequenceEditor.typeValue],
  )

  const consequenceFilters = useMemo(
    () => [
      { label: 'All', count: data?.consequences.length ?? 0 },
      ...CONSEQUENCE_TYPE_OPTIONS.map((option) => ({
        label: option.label,
        count: (data?.consequences ?? []).filter((item) => item.typeValue === option.value).length,
      })),
    ],
    [data?.consequences],
  )
  const filteredConsequences = useMemo(() => {
    if (consequenceFilter === 'All') return data?.consequences ?? []
    const matchedType = CONSEQUENCE_TYPE_OPTIONS.find((option) => option.label === consequenceFilter)
    if (!matchedType) return data?.consequences ?? []
    return (data?.consequences ?? []).filter((item) => item.typeValue === matchedType.value)
  }, [consequenceFilter, data?.consequences])

  if (loading || !form) return <BusinessRuleWorkspaceSkeleton />
  if (error) {
    return <Card className="border-danger/20 bg-danger/5 text-sm text-danger">{error}</Card>
  }
  const formState = form
  const workspaceData = data
  const currentRuleId = data?.rule?.id
  const selectedPropertyRuleName =
    workspaceData?.rules.find((rule) => rule.id === formState.parentRuleId)?.name ??
    workspaceData?.parentRuleOptions.find((rule) => rule.value === formState.parentRuleId)?.label ??
    ''
  const showConsequencesSection = Boolean(currentRuleId)
  const hideActionField =
    consequenceEditor.typeValue === '3' || consequenceEditor.typeValue === '5'
  const showRiskScoreField =
    consequenceEditor.typeValue === '4' && consequenceEditor.actionValue === '9'
  const showRiskSummaryField =
    consequenceEditor.typeValue === '4' && consequenceEditor.actionValue === '751820001'
  const showRatingAddField =
    consequenceEditor.typeValue === '6' && consequenceEditor.actionValue === '751820002'
  const showRatingMultiplyField =
    consequenceEditor.typeValue === '6' && consequenceEditor.actionValue === '751820003'
  const showDocumentTemplateField = consequenceEditor.typeValue === '3'
  const showEmailTemplateField = consequenceEditor.typeValue === '5'

  async function persistBusinessRuleChanges(options?: { showSuccess?: boolean }) {
    if (!formState.name.trim()) {
      throw new Error('Rule name is required.')
    }

    setSaveBusy(true)
    setSaveError(null)
    if (options?.showSuccess) {
      setSaveSuccess(null)
    }

    try {
      const savedId = await saveBusinessRule({
        id: data?.rule?.id,
        name: formState.name,
        categoryValue: formState.categoryValue,
        parentRuleId: formState.parentRuleId,
        inquiryTypeValue: formState.inquiryTypeValue,
      })

      if (options?.showSuccess) {
        setSaveSuccess('Business rule saved successfully.')
      }

      return savedId
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to save business rule.'
      setSaveError(message)
      throw new Error(message)
    } finally {
      setSaveBusy(false)
    }
  }

  async function handleRuleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      const savedId = await persistBusinessRuleChanges({ showSuccess: true })
      if (isCreate) {
        navigate(`/admin/business-rules/${savedId}/edit`, { replace: true })
        return
      }
      setRefreshKey((value) => value + 1)
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Unable to save business rule.')
    }
  }

  async function handleConsequenceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!consequenceEditor.typeValue) {
      setConsequenceError('Select a consequence type first.')
      return
    }
    if (!hideActionField && !consequenceEditor.actionValue) {
      setConsequenceError('Select both a consequence type and an action.')
      return
    }
    if (requiresNotificationText(consequenceEditor.actionValue) && !consequenceEditor.notificationText.trim()) {
      setConsequenceError('Notification text is required for Request Missing Information.')
      return
    }
    if (showRiskScoreField && !consequenceEditor.riskScore.trim()) {
      setConsequenceError('Risk Score is required for Update Risk Score.')
      return
    }
    if (showRiskSummaryField && !consequenceEditor.riskSummary.trim()) {
      setConsequenceError('Risk Summary is required for Update Risk Summary.')
      return
    }
    if (showRatingAddField && !consequenceEditor.ratingAdd.trim()) {
      setConsequenceError('Add amount is required for rating add actions.')
      return
    }
    if (showRatingMultiplyField && !consequenceEditor.ratingMultiply.trim()) {
      setConsequenceError('Multiplier is required for rating multiply actions.')
      return
    }
    if (showDocumentTemplateField && !consequenceEditor.documentTemplateId) {
      setConsequenceError('Select a document template.')
      return
    }
    if (showEmailTemplateField && !consequenceEditor.emailTemplateId) {
      setConsequenceError('Select an email template.')
      return
    }

    setConsequenceBusy(consequenceEditor.id ?? 'create')
    setConsequenceError(null)
    try {
      const savedRuleId = await persistBusinessRuleChanges()
      if (isCreate) {
        navigate(`/admin/business-rules/${savedRuleId}/edit`, { replace: true })
      }
      await saveBusinessRuleConsequence({
        id: consequenceEditor.id,
        businessRuleId: savedRuleId,
        typeValue: consequenceEditor.typeValue,
        actionValue: consequenceEditor.actionValue,
        notificationText: consequenceEditor.notificationText,
        riskScore: consequenceEditor.riskScore,
        riskSummary: consequenceEditor.riskSummary,
        ratingAdd: consequenceEditor.ratingAdd,
        ratingMultiply: consequenceEditor.ratingMultiply,
        documentTemplateId: consequenceEditor.documentTemplateId,
        emailTemplateId: consequenceEditor.emailTemplateId,
      })
      setConsequenceEditor(emptyConsequenceEditor)
      setRefreshKey((value) => value + 1)
    } catch (cause) {
      setConsequenceError(cause instanceof Error ? cause.message : 'Unable to save consequence.')
    } finally {
      setConsequenceBusy(null)
    }
  }

  async function handleDeleteConsequence(consequence: BusinessRuleConsequence) {
    const confirmed = window.confirm(`Delete "${consequence.name}" from this business rule?`)
    if (!confirmed) return
    setConsequenceBusy(consequence.id)
    setConsequenceError(null)
    try {
      await deleteBusinessRuleConsequence(consequence.id)
      if (consequenceEditor.id === consequence.id) {
        setConsequenceEditor(emptyConsequenceEditor)
      }
      setRefreshKey((value) => value + 1)
    } catch (cause) {
      setConsequenceError(cause instanceof Error ? cause.message : 'Unable to delete consequence.')
    } finally {
      setConsequenceBusy(null)
    }
  }

  function openCreateConsequence() {
    setConsequenceError(null)
    setConsequenceEditor({
      open: true,
      typeValue: '',
      actionValue: '',
      notificationText: '',
      riskScore: '',
      riskSummary: '',
      ratingAdd: '',
      ratingMultiply: '',
      documentTemplateId: '',
      emailTemplateId: '',
    })
  }

  function openEditConsequence(consequence: BusinessRuleConsequence) {
    setConsequenceError(null)
    setConsequenceEditor({
      open: true,
      id: consequence.id,
      typeValue: consequence.typeValue,
      actionValue: consequence.actionValue,
      notificationText: consequence.notificationText,
      riskScore: consequence.riskScore,
      riskSummary: consequence.riskSummary,
      ratingAdd: consequence.ratingAdd,
      ratingMultiply: consequence.ratingMultiply,
      documentTemplateId: consequence.documentTemplateId,
      emailTemplateId: consequence.emailTemplateId,
    })
  }

  function handleTypeChange(nextType: string) {
    setConsequenceEditor((current) => ({
      ...current,
      typeValue: nextType,
      actionValue: nextType === '3' ? '6' : nextType === '5' ? '10' : '',
      notificationText: '',
      riskScore: '',
      riskSummary: '',
      ratingAdd: '',
      ratingMultiply: '',
      documentTemplateId: '',
      emailTemplateId: '',
    }))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FilePenLine}
        eyebrow="Admin Workspace"
        title={isCreate ? 'Create Business Rule' : 'Edit Business Rule'}
        description="Maintain the business rule itself, then manage the downstream consequence actions that should trigger when this underwriting rule is matched."
        actions={
          <>
            <Button variant="secondary" asChild className="bg-white dark:bg-[#1E293B]">
              <Link to="/admin/business-rules">
                <ArrowLeft className="h-4 w-4" />
                Back to Rules
              </Link>
            </Button>
            <Button type="submit" form="business-rule-form" disabled={saveBusy}>
              <Save className="h-4 w-4" />
              {saveBusy ? 'Saving...' : 'Save Changes'}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {consequenceStats.map((stat) => (
          <Card key={stat.label} variant="interactive" className="space-y-2">
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{stat.label}</p>
            <p className="text-3xl font-bold">{stat.value}</p>
            <p className="text-sm text-muted-foreground">{stat.helper}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
        <Card variant="premium" className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Rule Details</p>
              <h2 className="mt-1 text-2xl font-bold">Business rule definition</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Update the rule metadata first. The consequences below inherit their linkage from this record.
              </p>
            </div>
            {!isCreate && data?.rule ? <Badge variant="approved">{data.rule.status}</Badge> : null}
          </div>

          {saveError ? <InlineAlert tone="danger" text={saveError} /> : null}
          {saveSuccess ? <InlineAlert tone="success" text={saveSuccess} /> : null}

          <form id="business-rule-form" className="space-y-6" onSubmit={handleRuleSave}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Rule name *">
                <Input
                  value={formState.name}
                  onChange={(event) => setForm((current) => (current ? { ...current, name: event.target.value } : current))}
                  placeholder="Enter business rule name"
                  required
                />
              </Field>

              <Field label="Category">
                <Select
                  value={formState.categoryValue}
                  onValueChange={(value) =>
                    setForm((current) => (current ? { ...current, categoryValue: value } : current))
                  }
                  placeholder="Select category"
                  options={[
                    { value: '', label: 'No category selected' },
                    ...BUSINESS_RULE_CATEGORY_OPTIONS.map((option) => ({
                      value: option.value,
                      label: option.label,
                    })),
                  ]}
                />
              </Field>

              <Field label="Property">
                <Select
                  value={formState.parentRuleId}
                  onValueChange={(value) =>
                    setForm((current) => (current ? { ...current, parentRuleId: value } : current))
                  }
                  placeholder="Select related property rule"
                  options={[
                    { value: '', label: 'No property rule linked' },
                    ...(data?.parentRuleOptions ?? []).map((option) => ({
                      value: option.value,
                      label: option.label,
                    })),
                  ]}
                />
              </Field>

              <Field label="Inquiry Type">
                <Select
                  value={formState.inquiryTypeValue}
                  onValueChange={(value) =>
                    setForm((current) => (current ? { ...current, inquiryTypeValue: value } : current))
                  }
                  placeholder="Select inquiry type"
                  options={[
                    { value: '', label: 'All inquiry types' },
                    ...BUSINESS_RULE_INQUIRY_TYPE_OPTIONS.map((option) => ({
                      value: option.value,
                      label: option.label,
                    })),
                  ]}
                />
              </Field>

            </div>
          </form>
        </Card>

        <div className="space-y-6">
          <Card className="space-y-4">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Rule health</p>
              <h3 className="mt-1 text-xl font-semibold">Classification snapshot</h3>
            </div>
            <div className="space-y-4">
              <SummaryRow
                label="Category"
                value={
                  BUSINESS_RULE_CATEGORY_OPTIONS.find((option) => option.value === formState.categoryValue)?.label ??
                  'Uncategorized'
                }
              />
              <SummaryRow
                label="Property"
                value={
                  selectedPropertyRuleName || 'No property rule selected'
                }
              />
              <SummaryRow
                label="Inquiry Type"
                value={
                  BUSINESS_RULE_INQUIRY_TYPE_OPTIONS.find((option) => option.value === formState.inquiryTypeValue)
                    ?.label ?? 'All inquiry types'
                }
              />
              <SummaryRow label="Consequences" value={String(data?.consequences.length ?? 0)} />
            </div>
          </Card>
        </div>
      </div>

      {showConsequencesSection ? (
        <Card variant="premium" className="space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Related Consequences</p>
            <h2 className="mt-1 text-2xl font-bold">Outcome workflow setup</h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Add, edit, or remove the downstream actions that should happen when this rule is matched in underwriting or admin flows.
            </p>
          </div>
          <Button
            onClick={openCreateConsequence}
            disabled={!currentRuleId}
            className="self-start"
          >
            <Plus className="h-4 w-4" />
            Add New Consequence
          </Button>
          </div>

        {!currentRuleId ? (
          <InlineAlert
            tone="warning"
            text="Save the business rule first. Consequences can only be linked after the rule record exists."
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {consequenceFilters.map((filter) => {
            const active = consequenceFilter === filter.label
            return (
              <button
                key={filter.label}
                type="button"
                onClick={() => setConsequenceFilter(filter.label)}
                className={
                  active
                    ? 'inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-glow'
                    : 'inline-flex items-center gap-2 rounded-full border border-border-soft bg-white px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary/20 hover:bg-surface-soft dark:bg-[#1E293B]'
                }
              >
                <span>{filter.label}</span>
                <span
                  className={
                    active
                      ? 'inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/20 px-1.5 text-[11px]'
                      : 'inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-muted px-1.5 text-[11px] text-muted-foreground'
                  }
                >
                  {filter.count}
                </span>
              </button>
            )
          })}
        </div>

        {consequenceEditor.open ? (
          <Card className="space-y-5 border-primary/15 bg-primary/5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-primary">
                  {consequenceEditor.id ? 'Edit Consequence' : 'Add New Consequence'}
                </p>
                <h3 className="mt-1 text-xl font-semibold">
                  {consequenceEditor.id ? 'Update linked action' : 'Create linked action'}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Configure the consequence behavior, templates, and risk payload based on the selected type.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="bg-white dark:bg-[#1E293B]"
                onClick={() => setConsequenceEditor(emptyConsequenceEditor)}
              >
                Cancel
              </Button>
            </div>

            {consequenceError ? <InlineAlert tone="danger" text={consequenceError} /> : null}

            <form className="space-y-5" onSubmit={handleConsequenceSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Type *">
                  <Select
                    value={consequenceEditor.typeValue}
                    onValueChange={handleTypeChange}
                    placeholder="Select consequence type"
                    options={CONSEQUENCE_TYPE_OPTIONS.map((option) => ({
                      value: option.value,
                      label: option.label,
                    }))} 
                  />
                </Field>

                {!hideActionField ? (
                  <Field label="Action *">
                    <Select
                      value={consequenceEditor.actionValue}
                      onValueChange={(value) =>
                        setConsequenceEditor((current) => ({
                          ...current,
                          actionValue: value,
                          notificationText: requiresNotificationText(value) ? current.notificationText : '',
                          riskScore: value === '9' ? current.riskScore : '',
                          riskSummary: value === '751820001' ? current.riskSummary : '',
                          ratingAdd: value === '751820002' ? current.ratingAdd : '',
                          ratingMultiply: value === '751820003' ? current.ratingMultiply : '',
                        }))
                      }
                      placeholder={
                        consequenceEditor.typeValue ? 'Select valid action' : 'Select type first'
                      }
                      disabled={!consequenceEditor.typeValue}
                      options={allowedActionOptions.map((option) => ({
                        value: option.value,
                        label: option.label,
                      }))}
                    />
                  </Field>
                ) : null}

                {showRiskScoreField ? (
                  <Field label="Risk Score">
                    <Input
                      type="number"
                      value={consequenceEditor.riskScore}
                      onChange={(event) =>
                        setConsequenceEditor((current) => ({
                          ...current,
                          riskScore: event.target.value,
                        }))
                      }
                      placeholder="Enter risk score"
                    />
                  </Field>
                ) : null}

                {showRiskSummaryField ? (
                  <Field label="Risk Summary">
                    <textarea
                      value={consequenceEditor.riskSummary}
                      onChange={(event) =>
                        setConsequenceEditor((current) => ({
                          ...current,
                          riskSummary: event.target.value,
                        }))
                      }
                      className="form-field-surface min-h-[110px] w-full rounded-[18px] border border-border px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                      placeholder="Enter the risk summary that should be applied."
                    />
                  </Field>
                ) : null}

                {showRatingAddField ? (
                  <Field label="Add Amount">
                    <Input
                      type="number"
                      step="0.01"
                      value={consequenceEditor.ratingAdd}
                      onChange={(event) =>
                        setConsequenceEditor((current) => ({
                          ...current,
                          ratingAdd: event.target.value,
                        }))
                      }
                      placeholder="Enter rating amount"
                    />
                  </Field>
                ) : null}

                {showRatingMultiplyField ? (
                  <Field label="Multiplier">
                    <Input
                      type="number"
                      step="0.01"
                      value={consequenceEditor.ratingMultiply}
                      onChange={(event) =>
                        setConsequenceEditor((current) => ({
                          ...current,
                          ratingMultiply: event.target.value,
                        }))
                      }
                      placeholder="Enter multiplier value"
                    />
                  </Field>
                ) : null}

                {showDocumentTemplateField ? (
                  <Field label="Template">
                    <Select
                      value={consequenceEditor.documentTemplateId}
                      onValueChange={(value) =>
                        setConsequenceEditor((current) => ({
                          ...current,
                          documentTemplateId: value,
                        }))
                      }
                      placeholder="Select document template"
                      options={workspaceData!.documentTemplateOptions.map((option) => ({
                        value: option.value,
                        label: option.label,
                      }))}
                    />
                  </Field>
                ) : null}

                {showEmailTemplateField ? (
                  <Field label="Template">
                    <Select
                      value={consequenceEditor.emailTemplateId}
                      onValueChange={(value) =>
                        setConsequenceEditor((current) => ({
                          ...current,
                          emailTemplateId: value,
                        }))
                      }
                      placeholder="Select email template"
                      options={workspaceData!.emailTemplateOptions.map((option) => ({
                        value: option.value,
                        label: option.label,
                      }))}
                    />
                  </Field>
                ) : null}
              </div>

              {requiresNotificationText(consequenceEditor.actionValue) ? (
                <div className="pt-2">
                  <Field label="Notification Text">
                    <textarea
                      value={consequenceEditor.notificationText}
                      onChange={(event) =>
                        setConsequenceEditor((current) => ({
                          ...current,
                          notificationText: event.target.value,
                        }))
                      }
                      className="form-field-surface min-h-[110px] w-full rounded-[18px] border border-border px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                      placeholder="Enter the message that should be used when this rule requests missing information."
                    />
                  </Field>
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  className="bg-white dark:bg-[#1E293B]"
                  onClick={() => setConsequenceEditor(emptyConsequenceEditor)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={consequenceBusy === (consequenceEditor.id ?? 'create')}>
                  <Save className="h-4 w-4" />
                  {consequenceBusy === (consequenceEditor.id ?? 'create')
                    ? 'Saving...'
                    : consequenceEditor.id
                      ? 'Save Consequence'
                      : 'Create Consequence'}
                </Button>
              </div>
            </form>
          </Card>
        ) : null}

        {filteredConsequences.length ? (
          <div className="space-y-4">
            {filteredConsequences.map((consequence) => (
              <Card
                key={consequence.id}
                variant="interactive"
                className="space-y-4 border-border-soft/90 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)] dark:bg-[#0f172a]"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <ConsequenceTypeChip typeValue={consequence.typeValue} typeLabel={consequence.typeLabel} />
                      <Badge variant="new">{consequence.actionLabel}</Badge>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">{consequence.name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {getConsequencePreview(consequence)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                      <span>Created {consequence.createdOn ? new Date(consequence.createdOn).toLocaleDateString('en') : 'recently'}</span>
                      <span className="text-border-soft">•</span>
                      <span>Linked to {consequence.businessRuleName}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="bg-white dark:bg-[#1E293B]"
                      onClick={() => openEditConsequence(consequence)}
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="bg-white text-danger hover:bg-danger/10 hover:text-danger dark:bg-[#1E293B]"
                      onClick={() => void handleDeleteConsequence(consequence)}
                      disabled={consequenceBusy === consequence.id}
                    >
                      <Trash2 className="h-4 w-4" />
                      {consequenceBusy === consequence.id ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            title={consequenceFilter === 'All' ? 'No consequences linked' : `No ${consequenceFilter.toLowerCase()} consequences yet`}
            description={
              consequenceFilter === 'All'
                ? 'Create the first consequence to define what operational step should happen when this business rule is triggered.'
                : `No consequence records match the ${consequenceFilter} filter for this business rule yet.`
            }
            actionLabel="Add New Consequence"
            onAction={openCreateConsequence}
          />
        )}
      </Card>
      ) : null}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      {children}
    </label>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-border-soft bg-surface-soft/75 px-4 py-3">
      <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  )
}

function InlineAlert({
  tone,
  text,
}: {
  tone: 'success' | 'warning' | 'danger'
  text: string
}) {
  const config =
    tone === 'success'
      ? {
          icon: CheckCircle2,
          className: 'border-success/20 bg-success/10 text-success',
        }
      : tone === 'warning'
        ? {
            icon: AlertCircle,
            className: 'border-warning/20 bg-warning/10 text-warning',
          }
        : {
            icon: ShieldAlert,
            className: 'border-danger/20 bg-danger/10 text-danger',
          }

  const Icon = config.icon
  return (
    <div className={`flex items-start gap-3 rounded-[18px] border px-4 py-3 text-sm ${config.className}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{text}</p>
    </div>
  )
}

function ConsequenceTypeChip({
  typeValue,
  typeLabel,
}: {
  typeValue: string
  typeLabel: string
}) {
  const config =
    typeValue === '1'
      ? { icon: ShieldAlert, variant: 'pending' as const }
      : typeValue === '2'
        ? { icon: BellRing, variant: 'info' as const }
        : typeValue === '3'
          ? { icon: FileText, variant: 'review' as const }
          : typeValue === '4'
            ? { icon: Sparkles, variant: 'approved' as const }
            : { icon: Mail, variant: 'neutral' as const }

  const Icon = config.icon
  return (
    <Badge variant={config.variant} className="gap-1.5">
      <Icon className="h-3.5 w-3.5" />
      {typeLabel}
    </Badge>
  )
}

function getConsequencePreview(consequence: BusinessRuleConsequence) {
  if (consequence.ratingAdd) return `Rating add amount: ${Number(consequence.ratingAdd).toLocaleString('en')}`
  if (consequence.ratingMultiply) return `Rating multiplier: ${consequence.ratingMultiply}`
  return (
    consequence.notificationText ||
    consequence.documentTemplateName ||
    consequence.emailTemplateName ||
    consequence.riskSummary ||
    (consequence.riskScore ? `Risk score: ${consequence.riskScore}` : 'No notification text is required for this consequence.')
  )
}

function BusinessRuleWorkspaceSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="h-36 animate-pulse bg-surface-soft/70" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="h-28 animate-pulse bg-surface-soft/70" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
        <Card className="h-[340px] animate-pulse bg-surface-soft/70" />
        <div className="space-y-6">
          <Card className="h-56 animate-pulse bg-surface-soft/70" />
          <Card className="h-80 animate-pulse bg-surface-soft/70" />
        </div>
      </div>
      <Card className="h-[420px] animate-pulse bg-surface-soft/70" />
    </div>
  )
}
