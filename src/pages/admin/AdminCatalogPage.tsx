import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ArrowDown, ArrowUp, GripVertical, Plus, RefreshCw, Trash2 } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { PageHeader } from '../../components/layout/PageHeader'
import { FilterBar } from '../../components/ui/FilterBar'
import { DataTable } from '../../components/ui/DataTable'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { EmptyState } from '../../components/ui/EmptyState'
import { Select } from '../../components/ui/Select'
import { useAsyncData } from '../../hooks/useAsyncData'
import type { AdminCatalogItem, AdminEntityKey } from '../../domain/app'
import { Link } from 'react-router-dom'
import {
  deleteAdminRecord,
  getAdminCatalog,
  getAdminRecord,
  getPlanRatingPricingOrder,
  saveAdminRecord,
  type AdminFormPayload,
  type PlanPricingOrderItem,
} from '../../services/adminCatalogService'
import { AccountsService, Aur_inquiriesService, Aur_plansService, Aur_productsesService } from '../../generated'

interface AdminCatalogPageProps {
  entity: AdminEntityKey
  icon: LucideIcon
}

interface EditorState extends AdminFormPayload {
  open: boolean
}

const defaultEditor: EditorState = {
  open: false,
  name: '',
  description: '',
  productId: '',
  planId: '',
  company: '',
  applicable: '',
  coverageType: '',
  category: '',
  isBaseCover: false,
  email: '',
  phone: '',
  website: '',
  accountType: '',
  subject: '',
  body: '',
  isActive: false,
  firstName: '',
  lastName: '',
  jobTitle: '',
  content: '',
  domainName: '',
  internalEmail: '',
  businessUnitId: '',
  accessMode: '',
  customerName: '',
  customerId: '',
  issueDate: '',
  expiryDate: '',
  premiumAmount: '',
  basePremium: '',
  minimumSumInsured: '',
  maximumSumInsured: '',
  cealing: '',
  floor: '',
  statusText: '',
  reminderSent: false,
  inquiryId: '',
  pricingOrderItems: [],
}

export function AdminCatalogPage({ entity, icon }: AdminCatalogPageProps) {
  const [search, setSearch] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [editor, setEditor] = useState<EditorState>(defaultEditor)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [pricingOrderLoading, setPricingOrderLoading] = useState(false)
  const [draggedPricingIndex, setDraggedPricingIndex] = useState<number | null>(null)

  const { data, loading, error } = useAsyncData(async () => {
    const [dataset, productsResult, plansResult, inquiriesResult, accountsResult] = await Promise.all([
      getAdminCatalog(entity),
      Aur_productsesService.getAll(),
      Aur_plansService.getAll(),
      Aur_inquiriesService.getAll(),
      AccountsService.getAll(),
    ])
    return {
      dataset,
      products: (productsResult.data ?? []).map((product) => ({
        value: product.aur_productsid,
        label: product.aur_name,
      })),
      plans: (plansResult.data ?? []).map((plan) => ({
        value: plan.aur_planid,
        label: plan.aur_name ?? 'Unnamed plan',
      })),
      inquiries: (inquiriesResult.data ?? []).map((inquiry) => ({
        value: inquiry.aur_inquiryid,
        label: inquiry.aur_inquiry_number ?? inquiry.aur_name,
      })),
      accounts: (accountsResult.data ?? []).map((account) => ({
        value: account.accountid,
        label: account.name,
      })),
    }
  }, [entity, refreshKey])

  const filteredRecords = useMemo(() => {
    const records = data?.dataset.records ?? []
    if (!search.trim()) return records
    const query = search.toLowerCase()
    return records.filter((record) =>
      [record.name, record.description, record.context, record.detail, record.status]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [data, search])

  const columns = useMemo<ColumnDef<AdminCatalogItem>[]>(
    () => [
      {
        header: data?.dataset.title ?? 'Record',
        cell: ({ row }) => (
          <div className="space-y-1">
            {entity === 'document-templates' ? (
              <Link
                to={`/admin/document-templates/preview/${row.original.id}`}
                className="font-semibold text-primary transition hover:text-primary/80 hover:underline"
              >
                {row.original.name}
              </Link>
            ) : entity === 'policies' ? (
              <Link
                to={`/policies/${row.original.id}`}
                className="font-semibold text-primary transition hover:text-primary/80 hover:underline"
              >
                {row.original.name}
              </Link>
            ) : entity === 'plans' ? (
              <Link
                to={`/admin/plans/${row.original.id}/edit${row.original.productId ? `?productId=${encodeURIComponent(row.original.productId)}` : ''}`}
                className="font-semibold text-primary transition hover:text-primary/80 hover:underline"
              >
                {row.original.name}
              </Link>
            ) : entity === 'business-units' || entity === 'users' || entity === 'accounts' || entity === 'contacts' ? (
              <Link
                to={`/admin/${entity}/${row.original.id}`}
                className="font-semibold text-primary transition hover:text-primary/80 hover:underline"
              >
                {row.original.name}
              </Link>
            ) : (
              <button
                type="button"
                className="font-semibold text-primary transition hover:text-primary/80 hover:underline"
                onClick={() => void openEditor(row.original)}
              >
                {row.original.name}
              </button>
            )}
            <p className="text-[12px] text-muted-foreground">{row.original.description}</p>
          </div>
        ),
      },
      {
        header: entity === 'contacts' ? 'Account' : 'Context',
        cell: ({ row }) => (
          <div className="space-y-1">
            <p className="text-sm font-medium">{row.original.context || 'Unassigned'}</p>
            <p className="text-[12px] text-muted-foreground">{row.original.detail ?? 'Library record'}</p>
          </div>
        ),
      },
      {
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.status.toLowerCase() === 'active' ? 'approved' : 'neutral'}>
            {row.original.status}
          </Badge>
        ),
      },
      {
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-danger hover:bg-danger/10 hover:text-danger"
              onClick={() => void handleDelete(row.original)}
              aria-label={`Delete ${row.original.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [data?.dataset.title],
  )

  async function handleDelete(record: AdminCatalogItem) {
    const confirmed = window.confirm(`Delete "${record.name}" from ${data?.dataset.title ?? 'this list'}?`)
    if (!confirmed) return
    await deleteAdminRecord(entity, record.id)
    setRefreshKey((value) => value + 1)
  }

  async function openEditor(record?: AdminCatalogItem) {
    setSubmitError(null)
    if (!record) {
      setEditor(defaultEditor)
      setEditor((current) => ({ ...current, open: true }))
      return
    }
    const hydrated =
      entity === 'accounts' ||
      entity === 'policies' ||
      entity === 'contacts' ||
      entity === 'brokers' ||
      entity === 'business-units' ||
      entity === 'users' ||
      entity === 'plans' ||
      entity === 'email-templates' ||
      entity === 'document-templates'
        ? await getAdminRecord(entity, record.id)
        : {}
    setEditor({
      open: true,
      id: record.id,
      name: record.name,
      description: record.description,
      productId: record.productId ?? '',
      planId: record.planId ?? '',
      company: '',
      applicable: '',
      coverageType: '',
      category: entity === 'business-rules' ? record.context : '',
      isBaseCover: record.detail?.toLowerCase().includes('true') ?? false,
      email: '',
      phone: '',
      website: '',
      accountType: '',
      subject: '',
      body: '',
      isActive: false,
      firstName: '',
      lastName: '',
      jobTitle: '',
      content: '',
      domainName: '',
      internalEmail: '',
      businessUnitId: '',
      accessMode: '',
      customerName: '',
      customerId: '',
      issueDate: '',
      expiryDate: '',
      premiumAmount: '',
      basePremium: '',
      minimumSumInsured: '',
      maximumSumInsured: '',
      cealing: '',
      floor: '',
      statusText: '',
      reminderSent: false,
      inquiryId: '',
      pricingOrderItems: [],
      ...hydrated,
    })
  }

  function closeEditor() {
    setEditor(defaultEditor)
    setSubmitError(null)
    setDraggedPricingIndex(null)
  }

  async function handlePlanProductChange(productId: string) {
    setEditor((current) => ({ ...current, productId, pricingOrderItems: [] }))
    if (entity !== 'plans' || !editor.id || !productId) return
    setPricingOrderLoading(true)
    try {
      const items = await getPlanRatingPricingOrder(editor.id, productId)
      setEditor((current) => ({ ...current, pricingOrderItems: items }))
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : 'Unable to load pricing order list.')
    } finally {
      setPricingOrderLoading(false)
    }
  }

  function movePricingItem(fromIndex: number, toIndex: number) {
    setEditor((current) => ({
      ...current,
      pricingOrderItems: reorderPricingItems(current.pricingOrderItems ?? [], fromIndex, toIndex),
    }))
  }

  function handlePricingDrop(toIndex: number) {
    if (draggedPricingIndex === null) return
    movePricingItem(draggedPricingIndex, toIndex)
    setDraggedPricingIndex(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setSubmitError(null)
    try {
      await saveAdminRecord(entity, editor)
      closeEditor()
      setRefreshKey((value) => value + 1)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to save record.'
      setSubmitError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const dataset = data?.dataset
  const emailMergeTokens = ['ClientName', 'InquiryNumber', 'ProductName', 'PlanName', 'QuotePremium', 'ExpiryDate']
  const documentMergeTokens = ['QuoteName', 'ClientName', 'ProductName', 'PlanName', 'PolicyNumber', 'PremiumAmount']
  const emailPreview = renderTemplate(editor.body, {
    ClientName: editor.customerName || 'Anees Ur Rehman',
    InquiryNumber: editor.inquiryId || 'INQ-0129',
    ProductName: data?.products.find((item) => item.value === editor.productId)?.label ?? 'Commercial Property Insurance',
    PlanName: data?.plans.find((item) => item.value === editor.planId)?.label ?? 'Executive Plan',
    QuotePremium: editor.premiumAmount || 'AED 293,400',
    ExpiryDate: editor.expiryDate || '2026-12-31',
  })
  const documentPreview = renderTemplate(editor.content, {
    QuoteName: editor.name || 'Commercial Property Quote',
    ClientName: editor.customerName || 'Anees Ur Rehman',
    ProductName: data?.products.find((item) => item.value === editor.productId)?.label ?? 'Commercial Property Insurance',
    PlanName: data?.plans.find((item) => item.value === editor.planId)?.label ?? 'Executive Plan',
    PolicyNumber: editor.name || 'POL-0001',
    PremiumAmount: editor.premiumAmount || 'AED 293,400',
  })

  return (
    <div className="space-y-6">
      <PageHeader
        icon={icon}
        title={dataset?.title ?? 'Library'}
        description={dataset?.description ?? 'Loading library workspace...'}
        actions={
          <Button onClick={() => void openEditor()}>
            <Plus className="h-4 w-4" />
            {dataset?.createLabel ?? 'Add Record'}
          </Button>
        }
      />

      {dataset ? (
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="Total Records" value={String(dataset.stats.total)} helper="Live Dataverse rows" />
          <StatCard label="Active" value={String(dataset.stats.active)} helper="Operationally available" />
          <StatCard label="Linked" value={String(dataset.stats.linked)} helper="Connected to plan or product context" />
          <StatCard label="Unassigned" value={String(dataset.stats.unassigned)} helper="Needs reference linkage" />
        </div>
      ) : null}

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={`Search ${dataset?.title?.toLowerCase() ?? 'records'}`}
      />

      {loading ? (
        <Card className="text-sm text-muted-foreground">Loading {dataset?.title?.toLowerCase() ?? 'records'}...</Card>
      ) : error ? (
        <Card className="border-danger/20 bg-danger/5 text-sm text-danger">{error}</Card>
      ) : (
        <DataTable
          columns={columns}
          data={filteredRecords}
          emptyTitle={`No ${dataset?.title?.toLowerCase() ?? 'records'} found`}
          emptyDescription="The datasource is connected, but there are no matching records for this view yet."
        />
      )}

      {editor.open ? (
        <div className="fixed inset-0 z-50 !mt-0 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <Card variant="premium" className="max-h-[82vh] w-full max-w-3xl overflow-hidden p-0">
            <form className="flex max-h-[82vh] flex-col" onSubmit={handleSubmit}>
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border-soft px-5 py-3.5">
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    Admin Workspace
                  </p>
                  <h2 className="mt-1 text-xl font-bold">
                    {editor.id ? 'Edit record' : 'Create record'}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Maintain {dataset?.title?.toLowerCase() ?? 'reference data'} using the shared premium admin form pattern.
                  </p>
                </div>
                <Button type="button" variant="ghost" onClick={closeEditor}>
                  Close
                </Button>
              </div>

              <div className="scrollbar-sleek min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
                <div className="grid gap-4 md:grid-cols-2">
                <Field label={entity === 'policies' ? 'Policy Number' : 'Name'}>
                  <Input
                    value={editor.name}
                    onChange={(event) => setEditor((current) => ({ ...current, name: event.target.value }))}
                    placeholder={entity === 'policies' ? 'Enter policy number' : 'Enter record name'}
                    required
                  />
                </Field>
                {entity === 'policies' ? (
                  <Field label="Linked Customer">
                    <Select
                      value={editor.customerId}
                      onChange={(event) => setEditor((current) => ({ ...current, customerId: event.target.value }))}
                    >
                      <option value="">No customer selected</option>
                      {(data?.accounts ?? []).map((account) => (
                        <option key={account.value} value={account.value}>
                          {account.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : entity === 'business-rules' ? (
                  <Field label="Category">
                    <Select
                      value={editor.category}
                      onChange={(event) => setEditor((current) => ({ ...current, category: event.target.value }))}
                    >
                      <option value="">Select category</option>
                      {['Eligibility_Appetite', 'Domicile', 'SubmissionCompleteness', 'Risk', 'History', 'Financial_CapacityLimits', 'ContractualTerms_Clauses'].map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : entity === 'coverages' ? (
                  <Field label="Company">
                    <Input
                      value={editor.company}
                      onChange={(event) => setEditor((current) => ({ ...current, company: event.target.value }))}
                      placeholder="Carrier or coverage company"
                    />
                  </Field>
                ) : entity === 'accounts' ? (
                  <Field label="Account Type">
                    <Select
                      value={editor.accountType}
                      onChange={(event) => setEditor((current) => ({ ...current, accountType: event.target.value }))}
                    >
                      <option value="">Select type</option>
                      <option value="Broker">Broker</option>
                      <option value="Customer">Customer</option>
                    </Select>
                  </Field>
                ) : entity === 'contacts' ? (
                  <Field label="Last Name">
                    <Input
                      value={editor.lastName}
                      onChange={(event) => setEditor((current) => ({ ...current, lastName: event.target.value }))}
                      placeholder="Enter last name"
                      required
                    />
                  </Field>
                ) : entity === 'brokers' ? (
                  <Field label="Broker Email">
                    <Input
                      value={editor.email}
                      onChange={(event) => setEditor((current) => ({ ...current, email: event.target.value }))}
                      placeholder="broker@company.com"
                    />
                  </Field>
                ) : entity === 'business-units' ? (
                  <Field label="Unit Type">
                    <Select
                      value={editor.accountType}
                      onChange={(event) => setEditor((current) => ({ ...current, accountType: event.target.value }))}
                    >
                      <option value="">Select type</option>
                      {['Organization', 'Branch', 'Department', 'Division'].map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : entity === 'users' ? (
                  <Field label="Last Name">
                    <Input
                      value={editor.lastName}
                      onChange={(event) => setEditor((current) => ({ ...current, lastName: event.target.value }))}
                      placeholder="Enter last name"
                      required
                    />
                  </Field>
                ) : entity === 'email-templates' ? (
                  <Field label="Category">
                    <Select
                      value={editor.category}
                      onChange={(event) => setEditor((current) => ({ ...current, category: event.target.value }))}
                    >
                      <option value="">Select category</option>
                      {['Inquiry', 'Quote', 'Policy', 'Reminder', 'General'].map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : entity === 'document-templates' ? (
                  <Field label="Template Scope">
                    <Input value="Document Generation" readOnly />
                  </Field>
                ) : entity === 'plans' ? null : (
                  <Field label="Linked Plan">
                    <Select
                      value={editor.planId}
                      onChange={(event) => setEditor((current) => ({ ...current, planId: event.target.value }))}
                    >
                      <option value="">No plan selected</option>
                      {(data?.plans ?? []).map((plan) => (
                        <option key={plan.value} value={plan.value}>
                          {plan.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}

                {(entity === 'plans' || entity === 'coverages' || entity === 'policies') && (
                  <Field label="Linked Product">
                      <Select
                        value={editor.productId}
                        onChange={(event) =>
                          entity === 'plans'
                            ? void handlePlanProductChange(event.target.value)
                            : setEditor((current) => ({ ...current, productId: event.target.value }))
                        }
                      >
                      <option value="">No product selected</option>
                      {(data?.products ?? []).map((product) => (
                        <option key={product.value} value={product.value}>
                          {product.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}

                {entity === 'plans' && (
                  <>
                    <Field label="Base Premium">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editor.basePremium}
                        onChange={(event) => setEditor((current) => ({ ...current, basePremium: event.target.value }))}
                        placeholder="Enter base premium"
                      />
                    </Field>
                    <Field label="Minimum Sum Insured">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editor.minimumSumInsured}
                        onChange={(event) => setEditor((current) => ({ ...current, minimumSumInsured: event.target.value }))}
                        placeholder="Enter minimum sum insured"
                      />
                    </Field>
                    <Field label="Maximum Sum Insured">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editor.maximumSumInsured}
                        onChange={(event) => setEditor((current) => ({ ...current, maximumSumInsured: event.target.value }))}
                        placeholder="Enter maximum sum insured"
                      />
                    </Field>
                    <Field label="Ceiling">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editor.cealing}
                        onChange={(event) => setEditor((current) => ({ ...current, cealing: event.target.value }))}
                        placeholder="Enter ceiling"
                      />
                    </Field>
                    <Field label="Floor">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editor.floor}
                        onChange={(event) => setEditor((current) => ({ ...current, floor: event.target.value }))}
                        placeholder="Enter floor"
                      />
                    </Field>
                  </>
                )}

                {entity === 'policies' && (
                  <>
                    <Field label="Issue Date">
                      <Input
                        type="date"
                        value={editor.issueDate}
                        onChange={(event) => setEditor((current) => ({ ...current, issueDate: event.target.value }))}
                        required
                      />
                    </Field>
                    <Field label="Expiry Date">
                      <Input
                        type="date"
                        value={editor.expiryDate}
                        onChange={(event) => setEditor((current) => ({ ...current, expiryDate: event.target.value }))}
                        required
                      />
                    </Field>
                    <Field label="Premium Amount">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editor.premiumAmount}
                        onChange={(event) => setEditor((current) => ({ ...current, premiumAmount: event.target.value }))}
                        placeholder="0.00"
                      />
                    </Field>
                    <Field label="Inquiry Id">
                      <Select
                        value={editor.inquiryId}
                        onChange={(event) => setEditor((current) => ({ ...current, inquiryId: event.target.value }))}
                      >
                        <option value="">No inquiry selected</option>
                        {(data?.inquiries ?? []).map((inquiry) => (
                          <option key={inquiry.value} value={inquiry.value}>
                            {inquiry.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <label className="flex items-center gap-3 rounded-[14px] border border-border-soft bg-surface-soft px-4 py-3 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={editor.reminderSent ?? false}
                        onChange={(event) => setEditor((current) => ({ ...current, reminderSent: event.target.checked }))}
                      />
                      Reminder already sent
                    </label>
                  </>
                )}

                {entity === 'coverages' && (
                  <>
                    <Field label="Applicability">
                      <Select
                        value={editor.applicable}
                        onChange={(event) => setEditor((current) => ({ ...current, applicable: event.target.value }))}
                      >
                        <option value="">Select applicability</option>
                        <option value="MandatoryCover">Mandatory Cover</option>
                        <option value="OptionalCover">Optional Cover</option>
                      </Select>
                    </Field>
                    <Field label="Coverage Type">
                      <Select
                        value={editor.coverageType}
                        onChange={(event) => setEditor((current) => ({ ...current, coverageType: event.target.value }))}
                      >
                        <option value="">Select type</option>
                        <option value="FullCoverage">Full Coverage</option>
                        <option value="_75_Coverage">75% Coverage</option>
                        <option value="_50_Coverage">50% Coverage</option>
                        <option value="_25_Coverage">25% Coverage</option>
                      </Select>
                    </Field>
                    <label className="flex items-center gap-3 rounded-[14px] border border-border-soft bg-surface-soft px-4 py-3 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={editor.isBaseCover}
                        onChange={(event) => setEditor((current) => ({ ...current, isBaseCover: event.target.checked }))}
                      />
                      Mark as base cover
                    </label>
                  </>
                )}

                {entity === 'accounts' && (
                  <>
                    <Field label="Primary Email">
                      <Input
                        value={editor.email}
                        onChange={(event) => setEditor((current) => ({ ...current, email: event.target.value }))}
                        placeholder="account@company.com"
                      />
                    </Field>
                    <Field label="Phone">
                      <Input
                        value={editor.phone}
                        onChange={(event) => setEditor((current) => ({ ...current, phone: event.target.value }))}
                        placeholder="+971 ..."
                      />
                    </Field>
                    <Field label="Website">
                      <Input
                        value={editor.website}
                        onChange={(event) => setEditor((current) => ({ ...current, website: event.target.value }))}
                        placeholder="https://..."
                      />
                    </Field>
                  </>
                )}

                {entity === 'contacts' && (
                  <>
                    <Field label="First Name">
                      <Input
                        value={editor.firstName}
                        onChange={(event) => setEditor((current) => ({ ...current, firstName: event.target.value }))}
                        placeholder="Enter first name"
                      />
                    </Field>
                    <Field label="Email">
                      <Input
                        value={editor.email}
                        onChange={(event) => setEditor((current) => ({ ...current, email: event.target.value }))}
                        placeholder="contact@company.com"
                      />
                    </Field>
                    <Field label="Phone">
                      <Input
                        value={editor.phone}
                        onChange={(event) => setEditor((current) => ({ ...current, phone: event.target.value }))}
                        placeholder="+971 ..."
                      />
                    </Field>
                    <Field label="Job Title">
                      <Input
                        value={editor.jobTitle}
                        onChange={(event) => setEditor((current) => ({ ...current, jobTitle: event.target.value }))}
                        placeholder="Operations Manager"
                      />
                    </Field>
                    <Field label="Company">
                      <Input
                        value={editor.company}
                        onChange={(event) => setEditor((current) => ({ ...current, company: event.target.value }))}
                        placeholder="Linked customer or company"
                      />
                    </Field>
                  </>
                )}

                {entity === 'business-units' && (
                  <>
                    <Field label="Unit Email">
                      <Input
                        value={editor.email}
                        onChange={(event) => setEditor((current) => ({ ...current, email: event.target.value }))}
                        placeholder="businessunit@company.com"
                      />
                    </Field>
                    <Field label="Phone">
                      <Input
                        value={editor.phone}
                        onChange={(event) => setEditor((current) => ({ ...current, phone: event.target.value }))}
                        placeholder="+971 ..."
                      />
                    </Field>
                    <Field label="Website">
                      <Input
                        value={editor.website}
                        onChange={(event) => setEditor((current) => ({ ...current, website: event.target.value }))}
                        placeholder="https://..."
                      />
                    </Field>
                  </>
                )}

                {entity === 'users' && (
                  <>
                    <Field label="First Name">
                      <Input
                        value={editor.firstName}
                        onChange={(event) => setEditor((current) => ({ ...current, firstName: event.target.value }))}
                        placeholder="Enter first name"
                      />
                    </Field>
                    <Field label="Business Unit Id">
                      <Input
                        value={editor.businessUnitId}
                        onChange={(event) => setEditor((current) => ({ ...current, businessUnitId: event.target.value }))}
                        placeholder="Linked business unit id"
                      />
                    </Field>
                    <Field label="Domain Name">
                      <Input
                        value={editor.domainName}
                        onChange={(event) => setEditor((current) => ({ ...current, domainName: event.target.value }))}
                        placeholder="user@tenant.onmicrosoft.com"
                      />
                    </Field>
                    <Field label="Internal Email">
                      <Input
                        value={editor.internalEmail}
                        onChange={(event) => setEditor((current) => ({ ...current, internalEmail: event.target.value }))}
                        placeholder="user@company.com"
                      />
                    </Field>
                    <Field label="Personal Email">
                      <Input
                        value={editor.email}
                        onChange={(event) => setEditor((current) => ({ ...current, email: event.target.value }))}
                        placeholder="person@example.com"
                      />
                    </Field>
                    <Field label="Phone">
                      <Input
                        value={editor.phone}
                        onChange={(event) => setEditor((current) => ({ ...current, phone: event.target.value }))}
                        placeholder="+971 ..."
                      />
                    </Field>
                    <Field label="Job Title">
                      <Input
                        value={editor.jobTitle}
                        onChange={(event) => setEditor((current) => ({ ...current, jobTitle: event.target.value }))}
                        placeholder="Administrator"
                      />
                    </Field>
                    <Field label="Access Mode">
                      <Select
                        value={editor.accessMode}
                        onChange={(event) => setEditor((current) => ({ ...current, accessMode: event.target.value }))}
                      >
                        <option value="">Select mode</option>
                        {['Read_Write', 'Administrative', 'Read', 'SupportUser', 'Non_interactive', 'DelegatedAdmin'].map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </>
                )}

                {entity === 'email-templates' && (
                  <>
                    <label className="flex items-center gap-3 rounded-[14px] border border-border-soft bg-surface-soft px-4 py-3 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={editor.isActive ?? false}
                        onChange={(event) => setEditor((current) => ({ ...current, isActive: event.target.checked }))}
                      />
                      Mark template as active
                    </label>
                    <Field label="Subject">
                      <Input
                        value={editor.subject}
                        onChange={(event) => setEditor((current) => ({ ...current, subject: event.target.value }))}
                        placeholder="Enter email subject"
                        required
                      />
                    </Field>
                  </>
                )}
              </div>

              <Field label="Description">
                <textarea
                  className="form-field-surface min-h-28 w-full rounded-[16px] border border-border px-3 py-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                  value={editor.description}
                  onChange={(event) => setEditor((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Add the operational description for this record"
                />
              </Field>

              {entity === 'plans' && editor.id ? (
                <Card className="space-y-4 border-border-soft bg-white/90 dark:bg-[#1E293B]">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                        Rating Pricing Order
                      </p>
                      <h4 className="mt-1 text-lg font-semibold">Reorder linked rating consequences</h4>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Drag items or use the arrow buttons. The sequence is saved when you click Save Changes.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="bg-white dark:bg-[#1E293B]"
                      disabled={!editor.productId || pricingOrderLoading}
                      onClick={() => void handlePlanProductChange(editor.productId ?? '')}
                    >
                      <RefreshCw className={`h-4 w-4 ${pricingOrderLoading ? 'animate-spin' : ''}`} />
                      Refresh List
                    </Button>
                  </div>

                  {pricingOrderLoading ? (
                    <div className="rounded-[18px] border border-dashed border-border-soft bg-surface-soft/70 px-4 py-6 text-center text-sm text-muted-foreground">
                      Loading linked rating consequences...
                    </div>
                  ) : (editor.pricingOrderItems ?? []).length ? (
                    <div className="space-y-2">
                      {(editor.pricingOrderItems ?? []).map((item, index) => (
                        <div
                          key={item.key}
                          draggable
                          onDragStart={() => setDraggedPricingIndex(index)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => handlePricingDrop(index)}
                          onDragEnd={() => setDraggedPricingIndex(null)}
                          className={`group grid gap-3 rounded-[18px] border px-3 py-3 transition md:grid-cols-[36px_minmax(0,1fr)_auto] md:items-center ${
                            draggedPricingIndex === index
                              ? 'border-primary/40 bg-primary/5'
                              : 'border-border-soft bg-surface-soft/70 hover:border-primary/20 hover:bg-primary/4'
                          }`}
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border-soft bg-white text-muted-foreground group-hover:text-primary dark:bg-slate-950/60">
                            <GripVertical className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="new" className="px-2 py-0.5 text-[10px]">
                                #{index + 1}
                              </Badge>
                              <Badge variant="review" className="px-2 py-0.5 text-[10px]">
                                Rating
                              </Badge>
                              <Badge variant="info" className="px-2 py-0.5 text-[10px]">
                                {item.action}
                              </Badge>
                            </div>
                            <p className="mt-2 line-clamp-2 text-sm font-semibold">{item.consequenceName}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{item.businessRuleName}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 md:justify-end">
                            <span className="rounded-full border border-border-soft bg-white px-3 py-1.5 text-xs font-semibold text-foreground dark:bg-slate-950/60">
                              {item.action === 'Add'
                                ? formatCurrencyValue(item.addAmount)
                                : `${item.multiplyValue ?? 0}x`}
                            </span>
                            <Button
                              type="button"
                              variant="secondary"
                              size="icon"
                              className="h-8 w-8 rounded-full bg-white dark:bg-slate-950/60"
                              disabled={index === 0}
                              onClick={() => movePricingItem(index, index - 1)}
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="icon"
                              className="h-8 w-8 rounded-full bg-white dark:bg-slate-950/60"
                              disabled={index === (editor.pricingOrderItems?.length ?? 0) - 1}
                              onClick={() => movePricingItem(index, index + 1)}
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[18px] border border-dashed border-border-soft bg-surface-soft/70 px-4 py-6 text-center">
                      <p className="text-sm font-semibold">No rating consequences found</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Link Rating consequences to this plan&apos;s product business rules to configure pricing order.
                      </p>
                    </div>
                  )}
                </Card>
              ) : null}

              {entity === 'email-templates' && (
                <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
                  <div className="space-y-5">
                    <div className="rounded-[18px] border border-border-soft bg-surface-soft p-4">
                      <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Merge fields</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {emailMergeTokens.map((token) => (
                          <button
                            key={token}
                            type="button"
                            className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-primary transition hover:border-primary hover:bg-primary/5"
                            onClick={() => setEditor((current) => ({ ...current, body: `${current.body} {{${token}}}`.trim() }))}
                          >
                            {`{{${token}}}`}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Field label="Email Body">
                      <textarea
                        className="form-field-surface min-h-40 w-full rounded-[16px] border border-border px-3 py-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                        value={editor.body}
                        onChange={(event) => setEditor((current) => ({ ...current, body: event.target.value }))}
                        placeholder="Write the reusable email body"
                      />
                    </Field>
                  </div>
                  <Card className="space-y-4 bg-surface-soft">
                    <div>
                      <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Rendered preview</p>
                      <p className="mt-2 text-lg font-semibold">{editor.subject || 'Email subject preview'}</p>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                      {emailPreview || 'Template content will appear here as you compose it.'}
                    </p>
                  </Card>
                </div>
              )}

              {entity === 'document-templates' && (
                <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
                  <div className="space-y-5">
                    <div className="rounded-[18px] border border-border-soft bg-surface-soft p-4">
                      <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Merge fields</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {documentMergeTokens.map((token) => (
                          <button
                            key={token}
                            type="button"
                            className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-primary transition hover:border-primary hover:bg-primary/5"
                            onClick={() => setEditor((current) => ({ ...current, content: `${current.content} {{${token}}}`.trim() }))}
                          >
                            {`{{${token}}}`}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Field label="Template Content">
                      <textarea
                        className="form-field-surface min-h-44 w-full rounded-[16px] border border-border px-3 py-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                        value={editor.content}
                        onChange={(event) => setEditor((current) => ({ ...current, content: event.target.value }))}
                        placeholder="Write the reusable document template content"
                      />
                    </Field>
                  </div>
                  <Card className="space-y-4 bg-surface-soft">
                    <div>
                      <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Rendered preview</p>
                      <p className="mt-2 text-lg font-semibold">{editor.name || 'Document template preview'}</p>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                      {documentPreview || 'Document template content will appear here as you compose it.'}
                    </p>
                  </Card>
                </div>
              )}

              {submitError ? <p className="text-sm text-danger">{submitError}</p> : null}

              </div>

              <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border-soft bg-white/95 px-5 py-3.5 dark:bg-[#1E293B]/95">
                <Button type="button" variant="secondary" onClick={closeEditor}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Saving...' : editor.id ? 'Save Changes' : 'Create Record'}
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

function StatCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <Card variant="interactive" className="space-y-3">
      <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="text-4xl font-bold leading-none">{value}</p>
      <p className="text-sm text-muted-foreground">{helper}</p>
    </Card>
  )
}

export function MissingAdminDependency({ title, text }: { title: string; text: string }) {
  return <EmptyState title={title} description={text} />
}

function renderTemplate(template: string | undefined, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (output, [key, value]) => output.replaceAll(`{{${key}}}`, value),
    template ?? '',
  )
}

function reorderPricingItems(items: PlanPricingOrderItem[], fromIndex: number, toIndex: number) {
  if (toIndex < 0 || toIndex >= items.length || fromIndex === toIndex) return items
  const next = [...items]
  const [moved] = next.splice(fromIndex, 1)
  if (!moved) return items
  next.splice(toIndex, 0, moved)
  return next.map((item, index) => ({ ...item, order: index + 1 }))
}

function formatCurrencyValue(value?: number) {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency: 'AED',
    maximumFractionDigits: 0,
  }).format(value ?? 0)
}
