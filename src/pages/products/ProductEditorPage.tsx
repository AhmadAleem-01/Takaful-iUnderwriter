import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  GitBranch,
  Layers3,
  PackagePlus,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { Select } from '../../components/ui/Select'
import { useAsyncData } from '../../hooks/useAsyncData'
import {
  createProductPlan,
  deleteProductPlan,
  getProductWorkspace,
  removeProductRuleAssociation,
  saveProductWorkspace,
  saveProductRuleAssociations,
  updateProductAutoActionSetting,
  updateProductPlan,
} from '../../services/productWorkspaceService'
import { formatCompactNumber } from '../../lib/formatters'
import { RULE_GROUPS, categorizeRule, type RuleGroup } from '../../lib/productRuleGroups'

interface ProductFormState {
  name: string
  arabicName: string
  premiumPercentage: string
  shortDetails: string
  details: string
  heading: string
  slogan: string
  emailAddress: string
  buyHeading: string
  buyButton: string
  terms: string
  remarks: string
  order: string
  status: 'draft' | 'publish'
  applyActionAutomatically: boolean
}

interface PlanDraftState {
  open: boolean
  id?: string
  name: string
  description: string
  basePremium: string
  minimumSumInsured: string
  maximumSumInsured: string
  cealing: string
  floor: string
}

const emptyPlanDraft: PlanDraftState = {
  open: false,
  name: '',
  description: '',
  basePremium: '',
  minimumSumInsured: '',
  maximumSumInsured: '',
  cealing: '',
  floor: '',
}

export function ProductEditorPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isCreate = !id || id === 'create'
  const [refreshKey, setRefreshKey] = useState(0)
  const [form, setForm] = useState<ProductFormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('details')
  const [planDraft, setPlanDraft] = useState<PlanDraftState>(emptyPlanDraft)
  const [planBusyId, setPlanBusyId] = useState<string | null>(null)
  const [ruleSearch, setRuleSearch] = useState('')
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([])
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false)
  const [rulesSaving, setRulesSaving] = useState(false)
  const [autoActionSaving, setAutoActionSaving] = useState(false)
  const [autoActionError, setAutoActionError] = useState<string | null>(null)
  const [expandedRuleGroups, setExpandedRuleGroups] = useState<Record<string, boolean>>({
    'Mandatory Field': false,
    'Required Document': false,
    Inclusion: false,
    Exclusion: false,
    Conditional: false,
  })
  const [expandedRuleModalGroups, setExpandedRuleModalGroups] = useState<Record<string, boolean>>({
    'Mandatory Field': false,
    'Required Document': false,
    Inclusion: false,
    Exclusion: false,
    Conditional: false,
  })

  const { data, loading, error } = useAsyncData(async () => {
    const workspace = await getProductWorkspace(isCreate ? undefined : id)
    setForm({
      name: workspace.summary?.name ?? '',
      arabicName: workspace.metadata?.arabicName ?? '',
      premiumPercentage: workspace.metadata?.premiumPercentage ?? '',
      shortDetails: workspace.metadata?.shortDetails ?? '',
      details: workspace.metadata?.details ?? '',
      heading: workspace.metadata?.heading ?? '',
      slogan: workspace.metadata?.slogan ?? '',
      emailAddress: workspace.metadata?.emailAddress ?? '',
      buyHeading: workspace.metadata?.buyHeading ?? '',
      buyButton: workspace.metadata?.buyButton ?? '',
      terms: workspace.metadata?.terms ?? '',
      remarks: workspace.metadata?.remarks ?? '',
      order: workspace.metadata?.order ?? '',
      status: workspace.metadata?.status ?? 'draft',
      applyActionAutomatically: workspace.metadata?.applyActionAutomatically ?? false,
    })
    return workspace
  }, [id, isCreate, refreshKey])

  useEffect(() => {
    setSelectedRuleIds(data?.associatedRuleIds ?? [])
  }, [data?.associatedRuleIds])

  const linkedStats = useMemo(() => {
    const planCount = data?.availablePlans.length ?? 0
    const ruleCount = selectedRuleIds.length
    return [
      { label: 'Linked Plans', value: formatCompactNumber(planCount), helper: 'Direct child plan records for this product.' },
      { label: 'Business Rules', value: formatCompactNumber(ruleCount), helper: 'Prepared underwriting rules grouped for association.' },
      { label: 'Status', value: form?.status === 'publish' ? 'Live' : 'Draft', helper: 'Current publishing posture for this product.' },
    ]
  }, [data?.availablePlans.length, form?.status, selectedRuleIds.length])

  const categorizedRules = useMemo(() => {
    const grouped = new Map<RuleGroup, NonNullable<typeof data>['availableRules']>()
    for (const group of RULE_GROUPS) grouped.set(group, [])

    for (const rule of data?.availableRules ?? []) {
      const group = categorizeRule(rule.name, rule.context, rule.description)
      const bucket = grouped.get(group) ?? []
      bucket.push(rule)
      grouped.set(group, bucket)
    }

    return grouped
  }, [data?.availableRules])

  const associatedRuleGroups = useMemo(
    () =>
      RULE_GROUPS.map((group) => ({
        label: group,
        rules: (categorizedRules.get(group) ?? []).filter((rule) => selectedRuleIds.includes(rule.id)),
      })),
    [categorizedRules, selectedRuleIds],
  )

  const filteredRuleGroups = useMemo(() => {
    const query = ruleSearch.trim().toLowerCase()
    return RULE_GROUPS.map((group) => ({
      label: group,
      rules: (categorizedRules.get(group) ?? []).filter((rule) =>
        !query
          ? true
          : [rule.name, rule.description, rule.context, rule.detail]
              .join(' ')
              .toLowerCase()
              .includes(query),
      ),
    }))
  }, [categorizedRules, ruleSearch])

  const associatedRuleIdSet = useMemo(() => new Set(data?.associatedRuleIds ?? []), [data?.associatedRuleIds])

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form) return
    setSaving(true)
    setSaveError(null)
    try {
      await saveProductWorkspace({ id: isCreate ? undefined : id, ...form })
      if (isCreate) {
        navigate('/admin/products')
      } else {
        setRefreshKey((value) => value + 1)
      }
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Unable to save product.')
    } finally {
      setSaving(false)
    }
  }

  async function handlePlanSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isCreate || !id) {
      setSaveError('Save the product first before managing linked plans.')
      return
    }

    try {
      setPlanBusyId(planDraft.id ?? 'create')
      if (planDraft.id) {
        await updateProductPlan(planDraft.id, {
          name: planDraft.name,
          description: planDraft.description,
          basePremium: planDraft.basePremium,
          minimumSumInsured: planDraft.minimumSumInsured,
          maximumSumInsured: planDraft.maximumSumInsured,
          cealing: planDraft.cealing,
          floor: planDraft.floor,
        })
      } else {
        await createProductPlan(id, {
          name: planDraft.name,
          description: planDraft.description,
          basePremium: planDraft.basePremium,
          minimumSumInsured: planDraft.minimumSumInsured,
          maximumSumInsured: planDraft.maximumSumInsured,
          cealing: planDraft.cealing,
          floor: planDraft.floor,
        })
      }
      setPlanDraft(emptyPlanDraft)
      setRefreshKey((value) => value + 1)
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Unable to save plan.')
    } finally {
      setPlanBusyId(null)
    }
  }

  async function handleDeletePlan(planId: string) {
    const confirmed = window.confirm('Delete this plan from the product workspace?')
    if (!confirmed) return
    try {
      setPlanBusyId(planId)
      await deleteProductPlan(planId)
      setRefreshKey((value) => value + 1)
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Unable to delete plan.')
    } finally {
      setPlanBusyId(null)
    }
  }

  function toggleRuleSelection(ruleId: string) {
    setSelectedRuleIds((current) =>
      current.includes(ruleId) ? current.filter((id) => id !== ruleId) : [...current, ruleId],
    )
  }

  async function handleSaveRuleAssociations() {
    if (isCreate || !id || !data?.summary?.name) return
    try {
      setRulesSaving(true)
      setSaveError(null)
      await saveProductRuleAssociations({
        productId: id,
        productName: data.summary.name,
        selectedRuleIds,
      })
      setIsRuleModalOpen(false)
      setRefreshKey((value) => value + 1)
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Unable to save business rule associations.')
    } finally {
      setRulesSaving(false)
    }
  }

  async function handleRemoveRuleAssociation(ruleId: string) {
    if (isCreate || !id) return
    try {
      setRulesSaving(true)
      setSaveError(null)
      await removeProductRuleAssociation({
        productId: id,
        businessRuleId: ruleId,
      })
      setSelectedRuleIds((current) => current.filter((currentId) => currentId !== ruleId))
      setRefreshKey((value) => value + 1)
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Unable to remove business rule association.')
    } finally {
      setRulesSaving(false)
    }
  }

  async function handleAutoActionToggle(nextValue: boolean) {
    if (!form) return

    setForm((current) => (current ? { ...current, applyActionAutomatically: nextValue } : current))
    setAutoActionError(null)

    if (isCreate || !id) {
      return
    }

    try {
      setAutoActionSaving(true)
      await updateProductAutoActionSetting(id, nextValue)
      setRefreshKey((value) => value + 1)
    } catch (cause) {
      setForm((current) => (current ? { ...current, applyActionAutomatically: !nextValue } : current))
      setAutoActionError(
        cause instanceof Error ? cause.message : 'Unable to update the auto-action setting.',
      )
    } finally {
      setAutoActionSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-glow">
            <PackagePlus className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Product Workspace
            </p>
            <h1 className="text-[28px] font-bold leading-tight">
              {isCreate ? 'Create Product' : data?.summary?.name ?? 'Product Editor'}
            </h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Manage product metadata, direct child plans, and grouped business-rule assignment from one premium product workspace.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-start gap-3 lg:items-end">
          <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" className="bg-white dark:bg-[#1E293B]" asChild>
            <Link to="/admin/products">
              <ArrowLeft className="h-4 w-4" />
              Back to Products
            </Link>
          </Button>
          <Button type="submit" form="product-editor-form" disabled={saving || !form}>
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Product'}
          </Button>
          </div>
          {form ? (
            <div className="rounded-[20px] border border-border-soft bg-white/92 px-3 py-3 dark:border-white/10 dark:bg-[#1E293B]">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    Auto Apply Actions
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Decide whether linked actions should run automatically.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      form.applyActionAutomatically
                        ? 'border-primary/18 bg-primary text-white shadow-[0_12px_26px_rgba(37,99,235,0.18)]'
                        : 'border-border-soft bg-white text-muted-foreground hover:bg-surface-soft dark:bg-[#243247]'
                    }`}
                    disabled={autoActionSaving}
                    onClick={() => void handleAutoActionToggle(true)}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full ${
                        form.applyActionAutomatically
                          ? 'bg-white/20 text-white'
                          : 'bg-surface-soft text-muted-foreground'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    Yes
                  </button>
                  <button
                    type="button"
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      !form.applyActionAutomatically
                        ? 'border-primary/18 bg-primary text-white shadow-[0_12px_26px_rgba(37,99,235,0.18)]'
                        : 'border-border-soft bg-white text-muted-foreground hover:bg-surface-soft dark:bg-[#243247]'
                    }`}
                    disabled={autoActionSaving}
                    onClick={() => void handleAutoActionToggle(false)}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full ${
                        !form.applyActionAutomatically
                          ? 'bg-white/20 text-white'
                          : 'bg-surface-soft text-muted-foreground'
                      }`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </span>
                    No
                  </button>
                </div>
              </div>
              {autoActionSaving ? (
                <p className="mt-2 text-[11px] font-medium text-primary">Updating auto-action setting...</p>
              ) : null}
              {autoActionError ? (
                <p className="mt-2 text-[11px] font-medium text-danger">{autoActionError}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {linkedStats.map((stat) => (
          <Card key={stat.label} variant="interactive" className="space-y-3">
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{stat.label}</p>
            <p className="text-4xl font-bold leading-none">{stat.value}</p>
            <p className="text-sm text-muted-foreground">{stat.helper}</p>
          </Card>
        ))}
      </div>

      {loading ? (
        <Card className="text-sm text-muted-foreground">Loading product workspace...</Card>
      ) : error ? (
        <Card className="border-danger/20 bg-danger/5 text-sm text-danger">{error}</Card>
      ) : !form ? (
        <Card className="text-sm text-muted-foreground">Preparing product editor...</Card>
      ) : (
        <form id="product-editor-form" className="space-y-6" onSubmit={handleSave}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
            <TabsList>
              <TabsTrigger value="details" icon={FileText}>Product Details</TabsTrigger>
              <TabsTrigger value="plans" icon={Layers3}>Plans</TabsTrigger>
              <TabsTrigger value="rules" icon={GitBranch}>Business Rule</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6">
              <Card className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <Field label="Product Name">
                    <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Enter product name" required />
                  </Field>
                  <Field label="Arabic Name">
                    <Input value={form.arabicName} onChange={(event) => setForm({ ...form, arabicName: event.target.value })} placeholder="Arabic product name" />
                  </Field>
                  <Field label="Incoming Email">
                    <Input value={form.emailAddress} onChange={(event) => setForm({ ...form, emailAddress: event.target.value })} placeholder="product@company.com" />
                  </Field>
                  <Field label="Heading">
                    <Input value={form.heading} onChange={(event) => setForm({ ...form, heading: event.target.value })} placeholder="Workspace hero heading" />
                  </Field>
                  <Field label="Buy Heading">
                    <Input value={form.buyHeading} onChange={(event) => setForm({ ...form, buyHeading: event.target.value })} placeholder="Commercial CTA heading" />
                  </Field>
                  <Field label="Buy Button">
                    <Input value={form.buyButton} onChange={(event) => setForm({ ...form, buyButton: event.target.value })} placeholder="Get Quote" />
                  </Field>
                  <Field label="Short Details">
                    <Input value={form.shortDetails} onChange={(event) => setForm({ ...form, shortDetails: event.target.value })} placeholder="One-line admin summary" />
                  </Field>
                  <Field label="Premium Percentage">
                    <Input value={form.premiumPercentage} onChange={(event) => setForm({ ...form, premiumPercentage: event.target.value })} placeholder="12.5" />
                  </Field>
                  <Field label="Display Order">
                    <Input value={form.order} onChange={(event) => setForm({ ...form, order: event.target.value })} placeholder="1" />
                  </Field>
                  <Field label="Status">
                    <Select
                      value={form.status}
                      onValueChange={(value) => setForm({ ...form, status: value as ProductFormState['status'] })}
                      options={[
                        { value: 'draft', label: 'Draft' },
                        { value: 'publish', label: 'Publish' },
                      ]}
                    >
                    </Select>
                  </Field>
                </div>

                <Field label="Detailed Description">
                  <textarea
                    className="form-field-surface min-h-32 w-full rounded-[16px] border border-border px-3 py-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                    value={form.details}
                    onChange={(event) => setForm({ ...form, details: event.target.value })}
                    placeholder="Long-form product positioning and operational detail"
                  />
                </Field>

                <Field label="Slogan">
                  <textarea
                    className="form-field-surface min-h-24 w-full rounded-[16px] border border-border px-3 py-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                    value={form.slogan}
                    onChange={(event) => setForm({ ...form, slogan: event.target.value })}
                    placeholder="Short premium marketing or internal slogan"
                  />
                </Field>

                <Field label="Remarks">
                  <textarea
                    className="form-field-surface min-h-24 w-full rounded-[16px] border border-border px-3 py-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                    value={form.remarks}
                    onChange={(event) => setForm({ ...form, remarks: event.target.value })}
                    placeholder="Internal operational notes or product remarks"
                  />
                </Field>

                <Field label="Terms and Conditions">
                  <textarea
                    className="form-field-surface min-h-32 w-full rounded-[16px] border border-border px-3 py-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                    value={form.terms}
                    onChange={(event) => setForm({ ...form, terms: event.target.value })}
                    placeholder="Optional terms, constraints, or underwriting conditions"
                  />
                </Field>

                {saveError ? <p className="text-sm text-danger">{saveError}</p> : null}
              </Card>
            </TabsContent>

            <TabsContent value="plans" className="space-y-6">
              <Card className="space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold">Plans</h2>
                      <Badge variant="review">{data?.availablePlans.length ?? 0}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Plans are direct child records of this product and can be created, edited, and deleted from here.
                    </p>
                  </div>
                  <Button type="button" variant="secondary" className="bg-white dark:bg-[#1E293B]" onClick={() => setPlanDraft({ ...emptyPlanDraft, open: true })} disabled={isCreate}>
                    <Plus className="h-4 w-4" />
                    Add Plan
                  </Button>
                </div>

                {(data?.availablePlans.length ?? 0) === 0 ? (
                  <Card className="border-dashed border-border bg-surface-soft/70 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Layers3 className="h-6 w-6" />
                    </div>
                    <h4 className="mt-4 text-lg font-semibold">No plans yet</h4>
                    <p className="mt-2 text-sm text-muted-foreground">Create the first plan for this product to start structuring quote options.</p>
                  </Card>
                ) : (
                  <div className="overflow-hidden rounded-[24px] border border-border-soft">
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-collapse">
                        <thead className="bg-surface-muted/80">
                          <tr>
                            <th className="px-4 py-3 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Name</th>
                            <th className="px-4 py-3 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Description</th>
                            <th className="px-4 py-3 text-right text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(data?.availablePlans ?? []).map((plan) => (
                            <tr key={plan.id} className="border-b border-border-soft/80 bg-surface transition duration-150 hover:bg-primary/5">
                              <td className="px-4 py-4">
                                <div className="space-y-1">
                                  <Link
                                    to={`/admin/plans/${plan.id}/edit${plan.productId ? `?productId=${encodeURIComponent(plan.productId)}` : ''}`}
                                    className="font-semibold text-primary transition hover:text-primary/80 hover:underline"
                                  >
                                    {plan.name}
                                  </Link>
                                  <p className="text-[12px] text-muted-foreground">{plan.detail}</p>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-sm text-muted-foreground">{plan.description}</td>
                              <td className="px-4 py-4">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-9 w-9 rounded-full border border-border-soft bg-white p-0 text-danger hover:bg-danger/10 hover:text-danger dark:bg-slate-950/50"
                                    disabled={planBusyId === plan.id}
                                    onClick={() => void handleDeletePlan(plan.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </Card>
            </TabsContent>

            <TabsContent value="rules" className="space-y-6">
              <Card className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold">Business Rules</h2>
                      <Badge variant="review">{selectedRuleIds.length}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Associate reusable underwriting rules to this product in grouped form-builder buckets.
                    </p>
                  </div>
                  <Button type="button" variant="secondary" className="bg-white dark:bg-[#1E293B]" onClick={() => setIsRuleModalOpen(true)} disabled={isCreate}>
                    <Plus className="h-4 w-4" />
                    Associate Business Rules
                  </Button>
                </div>

                {saveError ? <p className="text-sm text-danger">{saveError}</p> : null}

                {data?.relationshipNotice ? (
                  <div className="rounded-[18px] border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning">
                    {data.relationshipNotice}
                  </div>
                ) : null}

                {selectedRuleIds.length === 0 ? (
                  <Card className="border-dashed border-border bg-surface-soft/70 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
                      <GitBranch className="h-6 w-6" />
                    </div>
                    <h4 className="mt-4 text-lg font-semibold">No business rules associated</h4>
                    <p className="mt-2 text-sm text-muted-foreground">Select rules from the grouped library to prepare product-specific underwriting logic.</p>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {associatedRuleGroups.map((group) => (
                      <Card key={group.label} className="overflow-hidden p-0">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-primary/4"
                          onClick={() =>
                            setExpandedRuleGroups((current) => ({
                              ...current,
                              [group.label]: !current[group.label],
                            }))
                          }
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                              {ruleGroupIcon(group.label)}
                            </span>
                            <div>
                              <p className="font-semibold">{group.label}</p>
                              <p className="text-sm text-muted-foreground">{group.rules.length} linked rules in this category.</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="neutral">{group.rules.length}</Badge>
                            {expandedRuleGroups[group.label] ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          </div>
                        </button>

                        {expandedRuleGroups[group.label] && group.rules.length > 0 ? (
                          <div className="grid gap-3 border-t border-border-soft px-5 py-5 md:grid-cols-2 xl:grid-cols-3">
                            {group.rules.map((rule) => (
                              <Card key={rule.id} className="space-y-3 rounded-[20px] bg-surface-soft/70 p-4 shadow-none">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold leading-5">{rule.name}</p>
                                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{rule.description}</p>
                                  </div>
                                  <Badge variant="info" className="shrink-0">{group.label}</Badge>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <span className="rounded-full border border-border-soft bg-white px-3 py-1 text-xs text-muted-foreground dark:bg-slate-950/60">
                                    Available in Form Builder
                                  </span>
                                </div>
                                <div className="flex justify-end">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-9 w-9 rounded-full border border-border-soft bg-white p-0 text-danger hover:bg-danger/10 hover:text-danger dark:bg-slate-950/50"
                                    disabled={rulesSaving}
                                    onClick={() => void handleRemoveRuleAssociation(rule.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </Card>
                            ))}
                          </div>
                        ) : null}
                      </Card>
                    ))}
                  </div>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </form>
      )}

      {isRuleModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          style={{ marginTop: 0, marginBottom: 0 }}
        >
          <Card className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden p-0">
            <div className="border-b border-border-soft px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Association workspace</p>
                  <h3 className="mt-2 text-2xl font-semibold">Associate Business Rules</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Search the live rule library, group by underwriting category, and prepare selected rules for this product.
                  </p>
                </div>
                <Button type="button" variant="ghost" size="icon" className="rounded-full border border-border-soft bg-white dark:bg-slate-950/60" onClick={() => setIsRuleModalOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-4">
                  <div className="rounded-[22px] border border-border-soft bg-surface-soft/75 p-4">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input className="pl-10" placeholder="Search business rules..." value={ruleSearch} onChange={(event) => setRuleSearch(event.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-3">
                    {filteredRuleGroups.map((group) => (
                      <Card key={group.label} className="overflow-hidden p-0">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-primary/4"
                          onClick={() =>
                            setExpandedRuleModalGroups((current) => ({
                              ...current,
                              [group.label]: !current[group.label],
                            }))
                          }
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                              {ruleGroupIcon(group.label)}
                            </span>
                            <div>
                              <p className="font-semibold">{group.label}</p>
                              <p className="text-sm text-muted-foreground">{group.rules.length} rules</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="neutral">{group.rules.length}</Badge>
                            {expandedRuleModalGroups[group.label] ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          </div>
                        </button>

                        {expandedRuleModalGroups[group.label] ? (
                          <div className="space-y-2 border-t border-border-soft px-5 py-4">
                            {group.rules.length === 0 ? (
                              <div className="rounded-[16px] border border-dashed border-border-soft bg-surface-soft/60 px-4 py-4 text-sm text-muted-foreground">
                                No rules found in this category for the current search.
                              </div>
                            ) : (
                              group.rules.map((rule) => {
                                const selected = selectedRuleIds.includes(rule.id)
                                const alreadyAssociated = associatedRuleIdSet.has(rule.id)
                                return (
                                  <button
                                    key={rule.id}
                                    type="button"
                                    onClick={() => {
                                      if (alreadyAssociated) return
                                      toggleRuleSelection(rule.id)
                                    }}
                                    disabled={alreadyAssociated}
                                    className={`flex w-full items-center justify-between gap-4 rounded-[18px] border px-4 py-3 text-left transition ${
                                      alreadyAssociated
                                        ? 'cursor-not-allowed border-border-soft bg-slate-100/95 text-foreground/80 dark:bg-slate-900/80'
                                        : selected
                                          ? 'border-border-soft bg-slate-100/95 text-foreground dark:bg-slate-900/80'
                                          : 'border-border-soft bg-white hover:border-primary/20 hover:bg-primary/4 dark:bg-slate-950/45'
                                    }`}
                                  >
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-semibold">{rule.name}</p>
                                      <div className="mt-1 flex flex-wrap items-center gap-2">
                                        <p className="truncate text-xs text-muted-foreground">{rule.description}</p>
                                        {alreadyAssociated ? (
                                          <span className="rounded-full border border-border-soft bg-white/80 px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground dark:bg-slate-950/70">
                                            Already associated
                                          </span>
                                        ) : selected ? (
                                          <span className="rounded-full border border-border-soft bg-white/80 px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground dark:bg-slate-950/70">
                                            Selected
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>
                                    <span
                                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                                        alreadyAssociated || selected
                                          ? 'border-slate-300 bg-slate-700 text-white dark:border-slate-600 dark:bg-slate-200 dark:text-slate-900'
                                          : 'border-border-soft bg-surface text-transparent'
                                      }`}
                                    >
                                      <Check className="h-4 w-4" />
                                    </span>
                                  </button>
                                )
                              })
                            )}
                          </div>
                        ) : null}
                      </Card>
                    ))}
                  </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-border-soft px-6 py-5">
              <p className="text-sm text-muted-foreground">{selectedRuleIds.length} business rules currently selected.</p>
              <div className="flex items-center gap-3">
                <Button type="button" variant="secondary" className="bg-white dark:bg-[#1E293B]" onClick={() => setIsRuleModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" disabled={rulesSaving || isCreate} onClick={() => void handleSaveRuleAssociations()}>
                  {rulesSaving ? 'Saving...' : 'Save Associations'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {planDraft.open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          style={{ marginTop: 0, marginBottom: 0 }}
        >
          <Card className="max-h-[90vh] w-full max-w-3xl overflow-hidden p-0">
            <div className="border-b border-border-soft px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Plan workspace</p>
                  <h3 className="mt-2 text-2xl font-semibold">{planDraft.id ? 'Edit Plan' : 'Create Plan'}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">Maintain plan records directly from the product setup hub.</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="rounded-full border border-border-soft bg-white dark:bg-slate-950/60"
                  onClick={() => setPlanDraft(emptyPlanDraft)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <form className="max-h-[calc(90vh-112px)] space-y-5 overflow-y-auto px-6 py-5" onSubmit={handlePlanSubmit}>
              <Field label="Plan Name">
                <Input
                  value={planDraft.name}
                  onChange={(event) => setPlanDraft((current) => ({ ...current, name: event.target.value }))}
                  required
                />
              </Field>
              <Field label="Description">
                <textarea
                  className="form-field-surface min-h-28 w-full rounded-[16px] border border-border px-3 py-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                  value={planDraft.description}
                  onChange={(event) => setPlanDraft((current) => ({ ...current, description: event.target.value }))}
                />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Base Premium">
                  <Input
                    type="number"
                    step="0.01"
                    value={planDraft.basePremium}
                    onChange={(event) => setPlanDraft((current) => ({ ...current, basePremium: event.target.value }))}
                    placeholder="Enter base premium"
                  />
                </Field>
                <Field label="Minimum Sum Insured">
                  <Input
                    type="number"
                    step="0.01"
                    value={planDraft.minimumSumInsured}
                    onChange={(event) => setPlanDraft((current) => ({ ...current, minimumSumInsured: event.target.value }))}
                    placeholder="Enter minimum sum insured"
                  />
                </Field>
                <Field label="Maximum Sum Insured">
                  <Input
                    type="number"
                    step="0.01"
                    value={planDraft.maximumSumInsured}
                    onChange={(event) => setPlanDraft((current) => ({ ...current, maximumSumInsured: event.target.value }))}
                    placeholder="Enter maximum sum insured"
                  />
                </Field>
                <Field label="Ceiling">
                  <Input
                    type="number"
                    step="0.01"
                    value={planDraft.cealing}
                    onChange={(event) => setPlanDraft((current) => ({ ...current, cealing: event.target.value }))}
                    placeholder="Enter ceiling"
                  />
                </Field>
                <Field label="Floor">
                  <Input
                    type="number"
                    step="0.01"
                    value={planDraft.floor}
                    onChange={(event) => setPlanDraft((current) => ({ ...current, floor: event.target.value }))}
                    placeholder="Enter floor"
                  />
                </Field>
              </div>
              <div className="flex justify-end gap-3 border-t border-border-soft pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  className="bg-white dark:bg-[#1E293B]"
                  onClick={() => setPlanDraft(emptyPlanDraft)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={planBusyId === (planDraft.id ?? 'create')}>
                  {planBusyId === (planDraft.id ?? 'create') ? 'Saving...' : planDraft.id ? 'Save Plan' : 'Create Plan'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      ) : null}
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

function ruleGroupIcon(group: RuleGroup) {
  if (group === 'Required Document') return <FileText className="h-4 w-4" />
  if (group === 'Inclusion') return <ShieldCheck className="h-4 w-4" />
  if (group === 'Exclusion') return <X className="h-4 w-4" />
  if (group === 'Mandatory Field') return <Check className="h-4 w-4" />
  return <GitBranch className="h-4 w-4" />
}
