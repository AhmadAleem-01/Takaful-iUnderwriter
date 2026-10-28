import { useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { ClipboardList, Filter, Plus, RotateCcw, Search, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useAsyncData } from '../../hooks/useAsyncData'
import { createInquiry, getInquiryEditorOptions, listInquiries } from '../../services/inquiriesService'
import { INQUIRY_TYPE_OPTIONS } from '../../services/inquiryTypeOptions'
import type { InquirySummary } from '../../domain/app'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import type { SelectOption } from '../../components/ui/Select'
import { formatCurrency, formatDate } from '../../lib/formatters'
import { inquiryProductKind } from '../../lib/healthInquiry'
import { HEALTH_INQUIRY_FILTERS, matchesHealthInquiryFilter } from '../../lib/healthInquiryFilters'

type ColumnFilterKey = 'inquiry' | 'broker' | 'product' | 'status' | 'riskScore' | 'premium' | 'updated'

type InquiryColumnFilters = {
  inquiry: { operator: 'contains' | 'equals'; value: string }
  broker: { value: string }
  product: { value: string }
  status: { value: string }
  riskScore: { min: string; max: string }
  premium: { min: string; max: string }
  updated: { from: string; to: string }
}

const defaultColumnFilters: InquiryColumnFilters = {
  inquiry: { operator: 'contains', value: '' },
  broker: { value: '' },
  product: { value: '' },
  status: { value: '' },
  riskScore: { min: '', max: '' },
  premium: { min: '', max: '' },
  updated: { from: '', to: '' },
}

const NO_PRODUCT_LINKED_LABEL = 'No Product Linked'

export function InquiriesPage() {
  const [params, setParams] = useSearchParams()
  const requestedProduct = params.get('product')?.trim() ?? ''
  const [search, setSearch] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [activeFilterKey, setActiveFilterKey] = useState<ColumnFilterKey | null>(null)
  const [columnFilters, setColumnFilters] = useState<InquiryColumnFilters>(defaultColumnFilters)
  const [createOpen, setCreateOpen] = useState(false)
  const [createBusy, setCreateBusy] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState({
    name: '',
    inquiryType: String(INQUIRY_TYPE_OPTIONS[0]?.value ?? ''),
    statusCode: '1',
    productId: '',
    planId: '',
  })
  const { data, loading, error } = useAsyncData(() => listInquiries(), [refreshKey])
  const optionsLoad = useAsyncData(() => getInquiryEditorOptions(), [])

  const populatedProducts = useMemo(() => {
    const products = new Map<string, { name: string; count: number }>()
    for (const record of data ?? []) {
      const name = record.productName.trim()
      if (!name || normalizeFilterValue(name) === normalizeFilterValue(NO_PRODUCT_LINKED_LABEL)) continue
      const key = normalizeFilterValue(name)
      const existing = products.get(key)
      products.set(key, { name: existing?.name ?? name, count: (existing?.count ?? 0) + 1 })
    }
    return [...products.values()].sort((left, right) => left.name.localeCompare(right.name))
  }, [data])

  const selectedProduct = populatedProducts.find(
    (product) => normalizeFilterValue(product.name) === normalizeFilterValue(requestedProduct),
  )?.name ?? ''
  const selectedProductKind = selectedProduct ? inquiryProductKind(selectedProduct) : 'other'
  const productViewLabel = selectedProduct || 'All'
  const healthStage = params.get('stage')
  const scope = selectedProductKind === 'health'
    ? HEALTH_INQUIRY_FILTERS.find((filter) => filter.key === healthStage)?.key
    : params.get('type') ?? undefined
  const scopeLabel = selectedProductKind === 'health'
    ? HEALTH_INQUIRY_FILTERS.find((filter) => filter.key === scope)?.label
    : scope

  const productRecords = useMemo(
    () => selectedProduct
      ? (data ?? []).filter(
          (record) => normalizeFilterValue(record.productName) === normalizeFilterValue(selectedProduct),
        )
      : (data ?? []),
    [data, selectedProduct],
  )

  const scopeFiltered = useMemo(() => {
    const records = productRecords
    if (!scope) return records
    if (selectedProductKind === 'health') return records.filter((record) => matchesHealthInquiryFilter(record, scope))
    return records.filter((record) => record.inquiryType.toLowerCase() === scope.toLowerCase())
  }, [productRecords, scope, selectedProductKind])

  const filtered = useMemo(() => {
    const records = scopeFiltered
    const query = search.trim().toLowerCase()

    return records.filter((record) => {
      const matchesSearch =
        !query ||
        [
          record.name,
          record.inquiryNumber,
          record.accountName,
          record.contactName,
          record.productName,
          record.planName,
        ]
          .join(' ')
          .toLowerCase()
          .includes(query)

      if (!matchesSearch) return false

      const inquiryValue = record.name.trim().toLowerCase()
      const inquiryFilterValue = columnFilters.inquiry.value.trim().toLowerCase()
      if (inquiryFilterValue) {
        const matchesInquiry =
          columnFilters.inquiry.operator === 'equals'
            ? inquiryValue === inquiryFilterValue
            : inquiryValue.includes(inquiryFilterValue)
        if (!matchesInquiry) return false
      }

      const brokerValue = normalizeFilterValue(record.brokerName)
      const brokerFilterValue = normalizeFilterValue(columnFilters.broker.value)
      if (brokerFilterValue && brokerValue !== brokerFilterValue) return false

      const productValue = normalizeFilterValue(record.productName)
      const productFilterValue = normalizeFilterValue(columnFilters.product.value)
      if (productFilterValue && productValue !== productFilterValue) return false

      const statusValue = normalizeFilterValue(record.status)
      const statusFilterValue = normalizeFilterValue(columnFilters.status.value)
      if (statusFilterValue && statusValue !== statusFilterValue) return false

      const riskMin = columnFilters.riskScore.min ? Number(columnFilters.riskScore.min) : null
      const riskMax = columnFilters.riskScore.max ? Number(columnFilters.riskScore.max) : null
      if (riskMin !== null && record.riskScore < riskMin) return false
      if (riskMax !== null && record.riskScore > riskMax) return false

      const premiumMin = columnFilters.premium.min ? Number(columnFilters.premium.min) : null
      const premiumMax = columnFilters.premium.max ? Number(columnFilters.premium.max) : null
      if (premiumMin !== null && record.grossPremium < premiumMin) return false
      if (premiumMax !== null && record.grossPremium > premiumMax) return false

      const recordDate = toDateValue(record.createdOn)
      if (columnFilters.updated.from && (!recordDate || recordDate < columnFilters.updated.from)) return false
      if (columnFilters.updated.to && (!recordDate || recordDate > columnFilters.updated.to)) return false

      return true
    })
  }, [columnFilters, scopeFiltered, search])

  const counts = useMemo(() => {
    const records = productRecords
    return new Map(
      INQUIRY_TYPE_OPTIONS.map((option) => [
        option.value,
        records.filter((record) =>
          record.inquiryTypeValue === option.value ||
          record.inquiryType.toLowerCase() === option.label.toLowerCase(),
        ).length,
      ]),
    )
  }, [productRecords])

  const premiumTotal = filtered.reduce((sum, item) => sum + item.grossPremium, 0)
  const averageRiskScore =
    filtered.length === 0
      ? 0
      : Math.round(filtered.reduce((sum, item) => sum + item.riskScore, 0) / filtered.length)

  const statusOptions = useMemo(
    () =>
      [...new Set(productRecords.map((record) => record.status).filter(Boolean))]
        .sort()
        .map((option) => ({ label: option, value: normalizeFilterValue(option) })),
    [productRecords],
  )
  const brokerOptions = useMemo(
    () =>
      [...new Set(productRecords.map((record) => record.brokerName).filter(Boolean))]
        .sort()
        .map((option) => ({ label: option, value: normalizeFilterValue(option) })),
    [productRecords],
  )
  const productOptions = useMemo(
    () =>
      [...new Set(productRecords
        .map((record) => record.productName)
        .filter((name) => name && normalizeFilterValue(name) !== normalizeFilterValue(NO_PRODUCT_LINKED_LABEL)))]
        .sort()
        .map((option) => ({ label: option, value: normalizeFilterValue(option) })),
    [productRecords],
  )

  const activeFilterCount = countActiveFilters(columnFilters)

  const columns = useMemo<ColumnDef<InquirySummary>[]>(
    () => [
      {
        id: 'inquiry',
        header: () => (
          <FilterHeader
            label="Inquiry"
            active={isColumnFilterActive('inquiry', columnFilters)}
            isOpen={activeFilterKey === 'inquiry'}
            onToggle={() => setActiveFilterKey((current) => (current === 'inquiry' ? null : 'inquiry'))}
            onClose={() => setActiveFilterKey(null)}
          >
            <ColumnFilterPanel
              activeKey="inquiry"
              filters={columnFilters}
              brokerOptions={brokerOptions}
              productOptions={productOptions}
              statusOptions={statusOptions}
              onChange={setColumnFilters}
            />
          </FilterHeader>
        ),
        cell: ({ row }) => (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-info/10 bg-info/10 px-2 py-1 text-[12px] font-semibold text-info">
                {row.original.inquiryNumber}
              </span>
              <Link
                to={`/inquiries/${row.original.id}`}
                className="font-semibold text-primary transition hover:text-primary/80 hover:underline"
              >
                {row.original.name}
              </Link>
            </div>
            <p className="line-clamp-2 max-w-[340px] text-[12px] text-muted-foreground">{row.original.summary}</p>
          </div>
        ),
      },
      {
        id: 'broker',
        header: () => (
          <FilterHeader
            label="Broker"
            active={isColumnFilterActive('broker', columnFilters)}
            isOpen={activeFilterKey === 'broker'}
            onToggle={() => setActiveFilterKey((current) => (current === 'broker' ? null : 'broker'))}
            onClose={() => setActiveFilterKey(null)}
          >
            <ColumnFilterPanel
              activeKey="broker"
              filters={columnFilters}
              brokerOptions={brokerOptions}
              productOptions={productOptions}
              statusOptions={statusOptions}
              onChange={setColumnFilters}
            />
          </FilterHeader>
        ),
        cell: ({ row }) => (
          <div className="space-y-1">
            <p className="font-medium">{row.original.brokerName}</p>
            <p className="text-[12px] text-muted-foreground">{row.original.accountName}</p>
          </div>
        ),
      },
      {
        id: 'product',
        header: () => (
          <FilterHeader
            label="Product"
            active={isColumnFilterActive('product', columnFilters)}
            isOpen={activeFilterKey === 'product'}
            onToggle={() => setActiveFilterKey((current) => (current === 'product' ? null : 'product'))}
            onClose={() => setActiveFilterKey(null)}
          >
            <ColumnFilterPanel
              activeKey="product"
              filters={columnFilters}
              brokerOptions={brokerOptions}
              productOptions={productOptions}
              statusOptions={statusOptions}
              onChange={setColumnFilters}
            />
          </FilterHeader>
        ),
        cell: ({ row }) => (
          <div className="space-y-1">
            <p className="font-medium">{row.original.productName}</p>
            <p className="text-[12px] text-muted-foreground">{row.original.planName}</p>
          </div>
        ),
      },
      {
        id: 'status',
        header: () => (
          <FilterHeader
            label="Status"
            active={isColumnFilterActive('status', columnFilters)}
            isOpen={activeFilterKey === 'status'}
            onToggle={() => setActiveFilterKey((current) => (current === 'status' ? null : 'status'))}
            onClose={() => setActiveFilterKey(null)}
          >
            <ColumnFilterPanel
              activeKey="status"
              filters={columnFilters}
              brokerOptions={brokerOptions}
              productOptions={productOptions}
              statusOptions={statusOptions}
              onChange={setColumnFilters}
            />
          </FilterHeader>
        ),
        cell: ({ row }) => <Badge variant={badgeForStatus(row.original.status)}>{row.original.status}</Badge>,
      },
      {
        id: 'riskScore',
        header: () => (
          <FilterHeader
            label="Risk Score"
            active={isColumnFilterActive('riskScore', columnFilters)}
            isOpen={activeFilterKey === 'riskScore'}
            onToggle={() => setActiveFilterKey((current) => (current === 'riskScore' ? null : 'riskScore'))}
            onClose={() => setActiveFilterKey(null)}
          >
            <ColumnFilterPanel
              activeKey="riskScore"
              filters={columnFilters}
              brokerOptions={brokerOptions}
              productOptions={productOptions}
              statusOptions={statusOptions}
              onChange={setColumnFilters}
            />
          </FilterHeader>
        ),
        cell: ({ row }) => (
          <div className="min-w-[84px]">
            <div className="flex items-center justify-between text-sm font-semibold">
              <span>{row.original.riskScore}</span>
              <span className="text-[12px] text-muted-foreground">{riskLabel(row.original.riskScore)}</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-surface-muted">
              <div
                className={`h-1.5 rounded-full ${riskBarClass(row.original.riskScore)}`}
                style={{ width: `${Math.max(8, Math.min(row.original.riskScore, 100))}%` }}
              />
            </div>
          </div>
        ),
      },
      {
        id: 'premium',
        header: () => (
          <FilterHeader
            label="Premium"
            active={isColumnFilterActive('premium', columnFilters)}
            isOpen={activeFilterKey === 'premium'}
            onToggle={() => setActiveFilterKey((current) => (current === 'premium' ? null : 'premium'))}
            onClose={() => setActiveFilterKey(null)}
          >
            <ColumnFilterPanel
              activeKey="premium"
              filters={columnFilters}
              brokerOptions={brokerOptions}
              productOptions={productOptions}
              statusOptions={statusOptions}
              onChange={setColumnFilters}
            />
          </FilterHeader>
        ),
        cell: ({ row }) => formatCurrency(row.original.grossPremium),
      },
      {
        id: 'updated',
        header: () => (
          <FilterHeader
            label="Updated"
            active={isColumnFilterActive('updated', columnFilters)}
            isOpen={activeFilterKey === 'updated'}
            onToggle={() => setActiveFilterKey((current) => (current === 'updated' ? null : 'updated'))}
            onClose={() => setActiveFilterKey(null)}
          >
            <ColumnFilterPanel
              activeKey="updated"
              filters={columnFilters}
              brokerOptions={brokerOptions}
              productOptions={productOptions}
              statusOptions={statusOptions}
              onChange={setColumnFilters}
            />
          </FilterHeader>
        ),
        cell: ({ row }) => formatDate(row.original.createdOn),
      },
    ],
    [activeFilterKey, brokerOptions, columnFilters, productOptions, statusOptions],
  )

  function clearAllFilters() {
    setColumnFilters(defaultColumnFilters)
    setActiveFilterKey(null)
  }

  function changeProductView(productName?: string) {
    if ((productName ?? '') === selectedProduct) return
    setSearch('')
    clearAllFilters()
    const next = new URLSearchParams(params)
    next.delete('view')
    if (productName) next.set('product', productName)
    else next.delete('product')
    next.delete('type')
    next.delete('stage')
    setParams(next)
  }

  function scopeLink(type?: string) {
    const next = new URLSearchParams(params)
    next.delete('view')
    if (selectedProduct) next.set('product', selectedProduct)
    else next.delete('product')
    const filterParam = selectedProductKind === 'health' ? 'stage' : 'type'
    next.delete(selectedProductKind === 'health' ? 'type' : 'stage')
    if (type) next.set(filterParam, type)
    else next.delete(filterParam)
    return `/inquiries?${next.toString()}`
  }

  async function handleCreateInquiry() {
    if (!createForm.name.trim()) {
      setCreateError('Inquiry name is required.')
      return
    }
    setCreateBusy(true)
    setCreateError(null)
    try {
      await createInquiry({
        name: createForm.name.trim(),
        inquiryType: createForm.inquiryType ? Number(createForm.inquiryType) : undefined,
        statusCode: createForm.statusCode ? Number(createForm.statusCode) : undefined,
        productId: createForm.productId || undefined,
        planId: createForm.planId || undefined,
      })
      setCreateOpen(false)
      setCreateForm({
        name: '',
        inquiryType: String(INQUIRY_TYPE_OPTIONS[0]?.value ?? ''),
        statusCode: '1',
        productId: '',
        planId: '',
      })
      setRefreshKey((value) => value + 1)
    } catch (cause) {
      setCreateError(cause instanceof Error ? cause.message : 'Unable to create inquiry.')
    } finally {
      setCreateBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ClipboardList}
        title={selectedProduct ? `${selectedProduct} Inquiries` : 'All Inquiries'}
        description={scopeLabel
          ? `${scopeLabel} inquiries${selectedProduct ? ` for ${selectedProduct}` : ''}.`
          : selectedProduct
            ? `Browse and manage inquiries for ${selectedProduct}.`
            : 'Browse and manage inquiries across all populated products.'}
        actions={
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Create Inquiry
          </Button>
        }
      />
      <div className="space-y-3 rounded-2xl border border-border-soft bg-surface p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="group" aria-label="Filter inquiries by product" className="flex w-full flex-wrap gap-1 rounded-xl bg-surface-muted p-1 sm:ml-auto sm:w-auto sm:justify-end">
          <Button type="button" size="sm" variant={!selectedProduct ? 'primary' : 'ghost'} aria-pressed={!selectedProduct} onClick={() => changeProductView()} className="min-h-10 flex-1 rounded-lg px-3 text-xs shadow-none sm:flex-none">
            All Products
            {!loading && !error ? <span className={`rounded-md px-1.5 py-0.5 text-[10px] tabular-nums ${!selectedProduct ? 'bg-white/20 text-white' : 'bg-surface text-muted-foreground'}`}>{(data ?? []).length}</span> : null}
          </Button>
          {populatedProducts.map((product) => {
            const active = product.name === selectedProduct
            return <Button key={normalizeFilterValue(product.name)} type="button" size="sm" variant={active ? 'primary' : 'ghost'} aria-pressed={active} onClick={() => changeProductView(product.name)} className="min-h-10 flex-1 rounded-lg px-3 text-xs shadow-none sm:flex-none">
              {product.name}
              <span className={`rounded-md px-1.5 py-0.5 text-[10px] tabular-nums ${active ? 'bg-white/20 text-white' : 'bg-surface text-muted-foreground'}`}>{product.count}</span>
            </Button>
          })}
        </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-border-soft pt-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <ScopeChip label="All Inquiries" count={productRecords.length} active={!scope} to={scopeLink()} />
            {selectedProductKind === 'health' ? HEALTH_INQUIRY_FILTERS.map((filter) => (
              <ScopeChip key={filter.key} label={filter.label}
                count={productRecords.filter((record) => matchesHealthInquiryFilter(record, filter.key)).length}
                active={scope === filter.key} to={scopeLink(filter.key)} />
            )) : INQUIRY_TYPE_OPTIONS.map((option) => (
              <ScopeChip key={option.value} label={option.label} count={counts.get(option.value) ?? 0}
                active={scope?.toLowerCase() === option.label.toLowerCase()} to={scopeLink(option.label)} />
            ))}
          </div>
        <div className="flex w-full shrink-0 items-center gap-2 lg:w-auto">
          <label className="relative min-w-0 flex-1 lg:w-56 lg:flex-none">
            <span className="sr-only">Search {productViewLabel.toLowerCase()} inquiries</span>
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search inquiries..." className="h-10 rounded-lg pl-9 text-xs" />
          </label>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-10 shrink-0 rounded-lg bg-surface"
          disabled={activeFilterCount === 0 && !search.trim()}
          onClick={() => {
            setSearch('')
            clearAllFilters()
          }}
        >
          <RotateCcw className="h-4 w-4" />
          Clear Filters
        </Button>
        </div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <MiniMetric label="Visible Records" value={String(filtered.length)} helper="Current queue after scope and search." />
        <MiniMetric label="Premium Total" value={formatCurrency(premiumTotal)} helper="Gross premium from the visible queue." />
        <MiniMetric label="Avg Risk Score" value={String(averageRiskScore)} helper="Average underwriting risk across visible records." />
      </div>
      {loading ? (
        <div className="rounded-[22px] border border-border-soft bg-surface p-6 text-sm text-muted-foreground">
          Loading inquiry queue from Dataverse...
        </div>
      ) : error ? (
        <div className="rounded-[22px] border border-danger/25 bg-danger/5 p-6 text-sm text-danger">
          {error}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          emptyTitle={selectedProduct ? `No ${selectedProduct.toLowerCase()} inquiries found` : 'No inquiries found'}
          emptyDescription="Try adjusting the type, product, column filters, or search."
          preserveHeaderOnEmpty
        />
      )}
      {createOpen ? (
        <CreateInquiryModal
          form={createForm}
          options={optionsLoad.data ?? undefined}
          busy={createBusy}
          error={createError}
          onChange={setCreateForm}
          onClose={() => {
            if (createBusy) return
            setCreateOpen(false)
            setCreateError(null)
          }}
          onCreate={() => void handleCreateInquiry()}
        />
      ) : null}
    </div>
  )
}

function CreateInquiryModal({
  form,
  options,
  busy,
  error,
  onChange,
  onClose,
  onCreate,
}: {
  form: {
    name: string
    inquiryType: string
    statusCode: string
    productId: string
    planId: string
  }
  options?: Awaited<ReturnType<typeof getInquiryEditorOptions>>
  busy: boolean
  error: string | null
  onChange: Dispatch<SetStateAction<{
    name: string
    inquiryType: string
    statusCode: string
    productId: string
    planId: string
  }>>
  onClose: () => void
  onCreate: () => void
}) {
  const availablePlans = (options?.plans ?? []).filter((plan) => !form.productId || plan.productId === form.productId)

  return createPortal(
    <div className="fixed inset-0 z-50 !mt-0 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <Card variant="premium" className="w-full max-w-2xl overflow-hidden p-0">
        <div className="flex items-start justify-between gap-4 border-b border-border-soft px-6 py-5">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Inquiry Intake</p>
            <h2 className="mt-1 text-2xl font-bold">Create Inquiry</h2>
            <p className="mt-1 text-sm text-muted-foreground">Add a basic inquiry record. Detailed underwriting actions can be completed after opening the workspace.</p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} disabled={busy}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {error ? <div className="rounded-[16px] border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</div> : null}
          <div className="grid gap-4 md:grid-cols-2">
            <CreateField label="Inquiry Name">
              <Input
                value={form.name}
                onChange={(event) => onChange((current) => ({ ...current, name: event.target.value }))}
                placeholder="e.g. Inquiry for Aviation - client@email.com"
                required
              />
            </CreateField>
            <CreateField label="Inquiry Type">
              <Select
                value={form.inquiryType}
                onChange={(event) => onChange((current) => ({ ...current, inquiryType: event.target.value }))}
                options={(options?.inquiryTypes ?? []).map((item) => ({ value: String(item.value), label: item.label }))}
                placeholder="Select inquiry type"
              />
            </CreateField>
            <CreateField label="Initial Status">
              <Select
                value={form.statusCode}
                onChange={(event) => onChange((current) => ({ ...current, statusCode: event.target.value }))}
                options={(options?.inquiryStatuses ?? []).map((item) => ({ value: String(item.value), label: item.label }))}
                placeholder="Select status"
              />
            </CreateField>
            <CreateField label="Product">
              <Select
                value={form.productId}
                onChange={(event) => onChange((current) => ({ ...current, productId: event.target.value, planId: '' }))}
                options={(options?.products ?? []).map((item) => ({ value: item.id, label: item.name }))}
                placeholder="Select product"
              />
            </CreateField>
            <CreateField label="Plan">
              <Select
                value={form.planId}
                onChange={(event) => onChange((current) => ({ ...current, planId: event.target.value }))}
                options={availablePlans.map((item) => ({ value: item.id, label: item.name }))}
                placeholder="Select plan"
                disabled={!availablePlans.length}
              />
            </CreateField>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border-soft bg-white/95 px-6 py-4 dark:bg-[#1E293B]/95">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={onCreate} disabled={busy}>
            {busy ? 'Creating...' : 'Create Inquiry'}
          </Button>
        </div>
      </Card>
    </div>,
    document.body,
  )
}

function CreateField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

function FilterHeader({
  label,
  active,
  isOpen,
  onToggle,
  onClose,
  children,
}: {
  label: string
  active: boolean
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  children: ReactNode
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const popupRef = useRef<HTMLDivElement | null>(null)
  const [popupStyle, setPopupStyle] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (!isOpen) return

    function updatePopupPosition() {
      if (!triggerRef.current) return
      const rect = triggerRef.current.getBoundingClientRect()
      const popupWidth = 280
      const viewportPadding = 12
      const left = Math.min(
        Math.max(viewportPadding, rect.right - popupWidth),
        window.innerWidth - popupWidth - viewportPadding,
      )

      setPopupStyle({
        top: rect.bottom + 10,
        left,
      })
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      const elementTarget = event.target instanceof Element ? event.target : null
      if (
        triggerRef.current?.contains(target) ||
        popupRef.current?.contains(target) ||
        elementTarget?.closest('[data-codex-select-content="true"]')
      ) {
        return
      }
      onClose()
    }

    updatePopupPosition()
    window.addEventListener('resize', updatePopupPosition)
    window.addEventListener('scroll', updatePopupPosition, true)
    document.addEventListener('mousedown', handlePointerDown)

    return () => {
      window.removeEventListener('resize', updatePopupPosition)
      window.removeEventListener('scroll', updatePopupPosition, true)
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [isOpen, onClose])

  return (
    <div ref={containerRef} className="relative flex items-center gap-2">
      <span>{label}</span>
      <button
        ref={triggerRef}
        type="button"
        onClick={onToggle}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-full border transition ${
          active
            ? 'border-primary/20 bg-primary/10 text-primary'
            : 'border-transparent bg-transparent text-muted-foreground hover:border-border-soft hover:bg-surface'
        }`}
        aria-label={`Filter ${label} column`}
      >
        <Filter className="h-3.5 w-3.5" />
      </button>
      {isOpen && popupStyle
        ? createPortal(
            <div
              ref={popupRef}
              className="fixed z-[80] w-[280px]"
              style={{ top: popupStyle.top, left: popupStyle.left }}
            >
              <Card className="space-y-3 rounded-[20px] border-border-soft bg-white p-3 shadow-[0_18px_40px_rgba(15,23,42,0.14)] dark:bg-[#102033]">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Filter</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{label}</p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border-soft text-muted-foreground transition hover:bg-surface-soft hover:text-foreground"
                    aria-label={`Close ${label} filter`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {children}
              </Card>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

function ColumnFilterPanel({
  activeKey,
  filters,
  brokerOptions,
  productOptions,
  statusOptions,
  onChange,
}: {
  activeKey: ColumnFilterKey
  filters: InquiryColumnFilters
  brokerOptions: SelectOption[]
  productOptions: SelectOption[]
  statusOptions: SelectOption[]
  onChange: Dispatch<SetStateAction<InquiryColumnFilters>>
}) {
  const [draftFilters, setDraftFilters] = useState<InquiryColumnFilters>(filters)

  useEffect(() => {
    setDraftFilters(filters)
  }, [activeKey, filters])

  function applyDraft() {
    onChange(() => draftFilters)
  }

  function clearDraft() {
    const nextDraft = clearSingleFilter(activeKey, draftFilters)
    setDraftFilters(nextDraft)
    onChange(() => clearSingleFilter(activeKey, filters))
  }

  if (activeKey === 'inquiry') {
    const current = draftFilters.inquiry
    return (
      <div className="space-y-3">
        <Select
          className="h-10 rounded-xl"
          contentClassName="z-[120]"
          value={current.operator}
          onValueChange={(value) =>
            setDraftFilters((prev) => ({
              ...prev,
              inquiry: {
                ...prev.inquiry,
                operator: value as 'contains' | 'equals',
              },
            }))
          }
          options={[
            { value: 'contains', label: 'Contains' },
            { value: 'equals', label: 'Equals' },
          ]}
        />
        <Input
          className="h-10 rounded-xl"
          value={current.value}
          onChange={(event) =>
            setDraftFilters((prev) => ({
              ...prev,
              inquiry: {
                ...prev.inquiry,
                value: event.target.value,
              },
            }))
          }
          placeholder="Enter inquiry name"
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" className="rounded-full bg-white dark:bg-[#1E293B]" onClick={clearDraft}>
            Clear
          </Button>
          <Button type="button" size="sm" className="rounded-full" onClick={applyDraft}>
            Apply
          </Button>
        </div>
      </div>
    )
  }

  if (activeKey === 'broker' || activeKey === 'product' || activeKey === 'status') {
    const options =
      activeKey === 'broker'
        ? brokerOptions
        : activeKey === 'product'
          ? productOptions
          : statusOptions

    return (
      <div className="space-y-3">
        <Select
          className="h-10 rounded-xl"
          contentClassName="z-[120]"
          value={draftFilters[activeKey].value}
          onValueChange={(value) =>
            setDraftFilters((prev) => ({
              ...prev,
              [activeKey]: { value },
            }))
          }
          placeholder={`Select ${filterTitle(activeKey).toLowerCase()}`}
          options={[
            { value: '', label: `All ${filterTitle(activeKey)}` },
            ...options,
          ]}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" className="rounded-full bg-white dark:bg-[#1E293B]" onClick={clearDraft}>
            Clear
          </Button>
          <Button type="button" size="sm" className="rounded-full" onClick={applyDraft}>
            Apply
          </Button>
        </div>
      </div>
    )
  }

  if (activeKey === 'riskScore' || activeKey === 'premium') {
    const current = draftFilters[activeKey]
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input
            className="h-10 rounded-xl"
            type="number"
            value={current.min}
            onChange={(event) =>
              setDraftFilters((prev) => ({
                ...prev,
                [activeKey]: {
                  ...prev[activeKey],
                  min: event.target.value,
                },
              }))
            }
            placeholder="Minimum"
          />
          <Input
            className="h-10 rounded-xl"
            type="number"
            value={current.max}
            onChange={(event) =>
              setDraftFilters((prev) => ({
                ...prev,
                [activeKey]: {
                  ...prev[activeKey],
                  max: event.target.value,
                },
              }))
            }
            placeholder="Maximum"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" className="rounded-full bg-white dark:bg-[#1E293B]" onClick={clearDraft}>
            Clear
          </Button>
          <Button type="button" size="sm" className="rounded-full" onClick={applyDraft}>
            Apply
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Input
          className="h-10 rounded-xl"
          type="date"
          value={draftFilters.updated.from}
          onChange={(event) =>
            setDraftFilters((prev) => ({
              ...prev,
              updated: {
                ...prev.updated,
                from: event.target.value,
              },
            }))
          }
        />
        <Input
          className="h-10 rounded-xl"
          type="date"
          value={draftFilters.updated.to}
          onChange={(event) =>
            setDraftFilters((prev) => ({
              ...prev,
              updated: {
                ...prev.updated,
                to: event.target.value,
              },
            }))
          }
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" className="rounded-full bg-white dark:bg-[#1E293B]" onClick={clearDraft}>
          Clear
        </Button>
        <Button type="button" size="sm" className="rounded-full" onClick={applyDraft}>
          Apply
        </Button>
      </div>
    </div>
  )
}

function ScopeChip({
  label,
  count,
  active,
  to,
}: {
  label: string
  count: number
  active: boolean
  to: string
}) {
  return (
    <Button asChild variant={active ? 'primary' : 'secondary'} size="sm" className="rounded-full">
      <Link to={to}>
        {label}
        <span className={`rounded-full px-1.5 py-0.5 text-[11px] ${active ? 'bg-white/20 text-white' : 'bg-surface text-muted-foreground'}`}>
          {count}
        </span>
      </Link>
    </Button>
  )
}

function MiniMetric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-[18px] border border-border-soft bg-surface-soft p-4">
      <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-3 text-2xl font-bold">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{helper}</p>
    </div>
  )
}

function badgeForStatus(status: string) {
  const normalized = status.toLowerCase()
  if (normalized === 'inactive' || normalized === 'draft') return 'neutral'
  if (normalized === 'quote generated successfully' || normalized === 'quote provided' || normalized === 'quote sent to customer') return 'approved'
  if (normalized === 'ai processing' || normalized === 'generating quote') return 'pending'
  if (normalized === 'further clarification required' || normalized === 'more information required') return 'pending'
  if (normalized === 'refer to underwriter' || normalized === 'escalate to head of aviation' || normalized === 'property or reinsurance team') return 'review'
  if (normalized === 'ready to generate quote' || normalized === 'product match' || normalized === 'determined inquiry') return 'info'
  if (normalized.includes('approve') || normalized.includes('won')) return 'approved'
  if (normalized.includes('review')) return 'review'
  if (normalized.includes('declin') || normalized.includes('reject') || normalized.includes('lost')) return 'rejected'
  if (normalized.includes('pending') || normalized.includes('await')) return 'pending'
  return 'new'
}

function riskLabel(score: number) {
  if (score >= 80) return 'High'
  if (score >= 60) return 'Watch'
  return 'Open'
}

function riskBarClass(score: number) {
  if (score >= 80) return 'bg-danger'
  if (score >= 60) return 'bg-warning'
  return 'bg-primary'
}

function isColumnFilterActive(key: ColumnFilterKey, filters: InquiryColumnFilters) {
  if (key === 'status') return Boolean(filters.status.value)
  if (key === 'updated') return Boolean(filters.updated.from || filters.updated.to)
  if (key === 'riskScore' || key === 'premium') return Boolean(filters[key].min || filters[key].max)
  return Boolean(filters[key].value)
}

function countActiveFilters(filters: InquiryColumnFilters) {
  return (['inquiry', 'broker', 'product', 'status', 'riskScore', 'premium', 'updated'] as ColumnFilterKey[]).reduce(
    (count, key) => count + (isColumnFilterActive(key, filters) ? 1 : 0),
    0,
  )
}

function clearSingleFilter(key: ColumnFilterKey, filters: InquiryColumnFilters): InquiryColumnFilters {
  return {
    ...filters,
    [key]: defaultColumnFilters[key],
  }
}

function filterTitle(key: ColumnFilterKey) {
  if (key === 'inquiry') return 'Inquiry'
  if (key === 'broker') return 'Broker'
  if (key === 'product') return 'Product'
  if (key === 'status') return 'Status'
  if (key === 'riskScore') return 'Risk Score'
  if (key === 'premium') return 'Premium'
  return 'Updated'
}

function toDateValue(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function normalizeFilterValue(value: string) {
  return value.trim().toLowerCase()
}
