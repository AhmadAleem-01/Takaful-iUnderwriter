import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Boxes,
  GripVertical,
  LoaderCircle,
  RefreshCw,
  Save,
} from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import { useAsyncData } from '../../hooks/useAsyncData'
import { Aur_plansService, Aur_productsesService } from '../../generated'
import {
  getAdminCatalog,
  getAdminRecord,
  getPlanRatingPricingOrder,
  saveAdminRecord,
  type PlanPricingOrderItem,
} from '../../services/adminCatalogService'
import { formatCurrency } from '../../lib/formatters'
import { PlanContents } from '../../components/plans/PlanContents'
import { PlanBusinessRules } from '../../components/plans/PlanBusinessRules'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs'

interface PlanFormState {
  name: string
  productId: string
  productName: string
  description: string
  basePremium: string
  minimumSumInsured: string
  maximumSumInsured: string
  cealing: string
  floor: string
  pricingOrderItems: PlanPricingOrderItem[]
}

const emptyPlanForm: PlanFormState = {
  name: '',
  productId: '',
  productName: '',
  description: '',
  basePremium: '',
  minimumSumInsured: '',
  maximumSumInsured: '',
  cealing: '',
  floor: '',
  pricingOrderItems: [],
}

export function PlanWorkspacePage() {
  const { id = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [form, setForm] = useState<PlanFormState>(emptyPlanForm)
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pricingBusy, setPricingBusy] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const load = useAsyncData(async () => {
    const [record, planLookupResult, productsResult, plansResult, plansCatalog] = await Promise.all([
      getAdminRecord('plans', id),
      Aur_plansService.get(id, {
        select: [
          'aur_planid',
          'aur_name',
          'aur_description',
          '_aur_product_value',
          'aur_productname',
        ],
      }).catch(() => ({ data: undefined })),
      Aur_productsesService.getAll(),
      Aur_plansService.getAll(),
      getAdminCatalog('plans'),
    ])
    const products = (productsResult.data ?? []).map((product) => ({
      id: product.aur_productsid,
      name: product.aur_name ?? 'Unnamed product',
    }))
    const planListRecord = (plansResult.data ?? []).find((plan) => normalizeId(plan.aur_planid) === normalizeId(id))
    const catalogRecord = plansCatalog.records.find((plan) => normalizeId(plan.id) === normalizeId(id))
    const directPlanRecord = planLookupResult.data
    const productName =
      readFormattedLookupName(directPlanRecord, '_aur_product_value') ||
      directPlanRecord?.aur_productname ||
      readFormattedLookupName(planListRecord, '_aur_product_value') ||
      planListRecord?.aur_productname ||
      catalogRecord?.context ||
      ''
    const routeProductId = searchParams.get('productId') ?? ''
    const resolvedProductId =
      routeProductId ||
      readLookupId(directPlanRecord, '_aur_product_value') ||
      record.productId ||
      readLookupId(planListRecord, '_aur_product_value') ||
      planListRecord?._aur_product_value ||
      catalogRecord?.productId ||
      products.find((product) => isSameProductName(product.name, productName))?.id ||
      ''
    const productId =
      products.find((product) => normalizeId(product.id) === normalizeId(resolvedProductId))?.id ||
      products.find((product) => isSameProductName(product.name, productName))?.id ||
      resolvedProductId
    const productOptions =
      productId && !products.some((product) => normalizeId(product.id) === normalizeId(productId))
        ? [
            ...products,
            {
              id: productId,
              name: productName || catalogRecord?.context || 'Linked Product',
            },
          ]
        : products
    const pricingOrderItems =
      productId && !(record.pricingOrderItems ?? []).length
        ? await getPlanRatingPricingOrder(id, productId)
        : record.pricingOrderItems ?? []

    return {
      record: {
        ...record,
        productId,
        productName,
        pricingOrderItems,
      },
      products: productOptions,
    }
  }, [id, searchParams])

  useEffect(() => {
    if (!load.data?.record) return
    const record = load.data.record
    setForm({
      name: record.name ?? '',
      productId: record.productId ?? '',
      productName: record.productName ?? '',
      description: record.description ?? '',
      basePremium: record.basePremium ?? '',
      minimumSumInsured: record.minimumSumInsured ?? '',
      maximumSumInsured: record.maximumSumInsured ?? '',
      cealing: record.cealing ?? '',
      floor: record.floor ?? '',
      pricingOrderItems: record.pricingOrderItems ?? [],
    })
  }, [load.data])

  async function handleProductChange(productId: string) {
    setForm((current) => ({ ...current, productId, pricingOrderItems: [] }))
    if (!productId) return
    setPricingBusy(true)
    setSaveError(null)
    try {
      const items = await getPlanRatingPricingOrder(id, productId)
      setForm((current) => ({ ...current, pricingOrderItems: items }))
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Unable to load pricing order list.')
    } finally {
      setPricingBusy(false)
    }
  }

  function movePricingItem(fromIndex: number, toIndex: number) {
    setForm((current) => ({
      ...current,
      pricingOrderItems: reorderPricingItems(current.pricingOrderItems, fromIndex, toIndex),
    }))
  }

  function handlePricingDrop(toIndex: number) {
    if (draggedIndex === null) return
    movePricingItem(draggedIndex, toIndex)
    setDraggedIndex(null)
  }

  async function handleRefreshPricingOrder() {
    if (!form.productId) return
    setPricingBusy(true)
    setSaveError(null)
    try {
      const items = await getPlanRatingPricingOrder(id, form.productId)
      setForm((current) => ({ ...current, pricingOrderItems: items }))
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Unable to refresh pricing order list.')
    } finally {
      setPricingBusy(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaveBusy(true)
    setSaveError(null)
    try {
      await saveAdminRecord('plans', {
        id,
        name: form.name,
        productId: form.productId,
        description: form.description,
        basePremium: form.basePremium,
        minimumSumInsured: form.minimumSumInsured,
        maximumSumInsured: form.maximumSumInsured,
        cealing: form.cealing,
        floor: form.floor,
        pricingOrderItems: form.pricingOrderItems,
      })
      navigate('/admin/plans')
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Unable to save plan.')
    } finally {
      setSaveBusy(false)
    }
  }

  if (load.loading) {
    return (
      <div className="space-y-6">
        <Card className="flex items-center gap-3 text-sm text-muted-foreground">
          <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
          Loading plan workspace...
        </Card>
      </div>
    )
  }

  if (load.error) {
    return (
      <Card className="border-danger/20 bg-danger/5 text-sm text-danger">
        {load.error}
      </Card>
    )
  }

  const productName =
    load.data?.products.find((product) => product.id === form.productId)?.name ||
    form.productName ||
    'No Product Linked'
  const productOptions = buildProductOptions(load.data?.products ?? [], form.productId, form.productName)

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <PageHeader
        icon={Boxes}
        eyebrow="Product Management"
        title={form.name || 'Edit Plan'}
        description={`${productName} · Manage plan settings, pricing order and related coverage details.`}
        actions={
          <>
            <Button type="button" variant="secondary" className="bg-white dark:bg-[#1E293B]" asChild>
              <Link to="/admin/plans">
                <ArrowLeft className="h-4 w-4" />
                Back to Plans
              </Link>
            </Button>
            <Button type="submit" disabled={saveBusy}>
              {saveBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saveBusy ? 'Saving...' : 'Save Plan'}
            </Button>
          </>
        }
      />

      {saveError ? <Card className="border-danger/20 bg-danger/5 text-sm text-danger">{saveError}</Card> : null}

      <Tabs defaultValue="details">
        <TabsList aria-label="Plan workspace" className="mb-6">
          <TabsTrigger value="details">Plan Details</TabsTrigger>
          <TabsTrigger value="contents">Plan Contents</TabsTrigger>
          <TabsTrigger value="rules">Business Rules</TabsTrigger>
        </TabsList>
        <TabsContent value="details" forceMount className="data-[state=inactive]:hidden">
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Card className="space-y-5">
          <div>
            <h2 className="text-base font-semibold">Plan Setup</h2>
            <p className="mt-1 text-sm text-muted-foreground">Edit the product link, pricing limits, and plan description.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Plan Name">
              <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
            </Field>
            <Field label="Linked Product">
              <Select
                key={form.productId || form.productName || 'linked-product'}
                value={form.productId}
                onChange={(event) => void handleProductChange(event.target.value)}
                options={productOptions}
                placeholder={form.productName || 'Select product'}
              />
            </Field>
            <Field label="Base Premium">
              <Input type="number" value={form.basePremium} onChange={(event) => setForm((current) => ({ ...current, basePremium: event.target.value }))} />
            </Field>
            <Field label="Minimum Sum Insured">
              <Input type="number" value={form.minimumSumInsured} onChange={(event) => setForm((current) => ({ ...current, minimumSumInsured: event.target.value }))} />
            </Field>
            <Field label="Maximum Sum Insured">
              <Input type="number" value={form.maximumSumInsured} onChange={(event) => setForm((current) => ({ ...current, maximumSumInsured: event.target.value }))} />
            </Field>
            <Field label="Ceiling">
              <Input type="number" value={form.cealing} onChange={(event) => setForm((current) => ({ ...current, cealing: event.target.value }))} />
            </Field>
            <Field label="Floor">
              <Input type="number" value={form.floor} onChange={(event) => setForm((current) => ({ ...current, floor: event.target.value }))} />
            </Field>
          </div>

          <Field label="Description">
            <textarea
              className="form-field-surface min-h-36 w-full rounded-[16px] border border-border px-3 py-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            />
          </Field>
        </Card>

        <Card className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Rating Pricing Order</h2>
              <p className="mt-1 text-sm text-muted-foreground">Sequence rating consequences from the product’s business rules.</p>
            </div>
            <Button type="button" variant="secondary" className="bg-white dark:bg-[#1E293B]" onClick={() => void handleRefreshPricingOrder()} disabled={!form.productId || pricingBusy}>
              <RefreshCw className={`h-4 w-4 ${pricingBusy ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {pricingBusy ? (
            <div className="rounded-[22px] border border-border-soft bg-surface-soft px-4 py-6 text-sm text-muted-foreground">
              Loading linked rating consequences...
            </div>
          ) : form.pricingOrderItems.length ? (
            <div className="max-h-[620px] space-y-3 overflow-y-auto pr-1 scrollbar-sleek">
              {form.pricingOrderItems.map((item, index) => (
                <div
                  key={item.key}
                  draggable
                  onDragStart={() => setDraggedIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handlePricingDrop(index)}
                  className="rounded-[22px] border border-border-soft bg-surface px-4 py-4 transition hover:border-primary/25 hover:bg-primary/5"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <GripVertical className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="new">#{index + 1}</Badge>
                        <Badge variant="review">Rating</Badge>
                        <Badge variant="info">{item.action}</Badge>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm font-semibold">{item.consequenceName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.businessRuleName}</p>
                      <p className="mt-2 text-sm font-bold text-primary">
                        {item.actionValue === '751820002'
                          ? `Add ${formatCurrency(item.addAmount ?? 0)}`
                          : item.actionValue === '751820003'
                            ? `Multiply ${item.multiplyValue ?? 0}x`
                            : 'Rating action'}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      <Button type="button" variant="ghost" size="sm" aria-label={`Move ${item.consequenceName} up`} className="h-8 w-8 rounded-full border border-border-soft bg-white p-0 dark:bg-slate-950/50" disabled={index === 0} onClick={() => movePricingItem(index, index - 1)}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="sm" aria-label={`Move ${item.consequenceName} down`} className="h-8 w-8 rounded-full border border-border-soft bg-white p-0 dark:bg-slate-950/50" disabled={index === form.pricingOrderItems.length - 1} onClick={() => movePricingItem(index, index + 1)}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[24px] border border-dashed border-border-soft bg-surface-soft px-5 py-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Boxes className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">No rating consequences found</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Link rating consequences to this plan’s product business rules, then refresh this order list.
              </p>
            </div>
          )}
        </Card>
      </div>
        </TabsContent>
        <TabsContent value="contents">
          <PlanContents key={id} planId={id} />
        </TabsContent>
        <TabsContent value="rules">
          <PlanBusinessRules key={form.productId} productId={form.productId} productName={productName} />
        </TabsContent>
      </Tabs>
    </form>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

function reorderPricingItems(items: PlanPricingOrderItem[], fromIndex: number, toIndex: number) {
  if (toIndex < 0 || toIndex >= items.length || fromIndex === toIndex) return items
  const nextItems = [...items]
  const [moved] = nextItems.splice(fromIndex, 1)
  nextItems.splice(toIndex, 0, moved)
  return nextItems.map((item, index) => ({ ...item, order: index + 1 }))
}

function normalizeId(value?: string | null) {
  return (value ?? '').replace(/[{}]/g, '').trim().toLowerCase()
}

function normalizeName(value?: string | null) {
  return (value ?? '').trim().toLowerCase()
}

function readLookupId(record: unknown, lookupKey: string) {
  if (!record || typeof record !== 'object') return ''
  const value = (record as Record<string, unknown>)[lookupKey]
  return typeof value === 'string' ? value : ''
}

function readFormattedLookupName(record: unknown, lookupKey: string) {
  if (!record || typeof record !== 'object') return ''
  const value = (record as Record<string, unknown>)[`${lookupKey}@OData.Community.Display.V1.FormattedValue`]
  return typeof value === 'string' ? value : ''
}

function isSameProductName(left?: string | null, right?: string | null) {
  const leftName = normalizeName(left)
  const rightName = normalizeName(right)
  if (!leftName || !rightName || rightName === 'unassigned') return false
  return leftName === rightName || leftName.includes(rightName) || rightName.includes(leftName)
}

function buildProductOptions(
  products: Array<{ id: string; name: string }>,
  selectedProductId: string,
  linkedProductName: string,
) {
  const options = products.map((product) => ({ value: product.id, label: product.name }))
  if (selectedProductId && !options.some((option) => normalizeId(option.value) === normalizeId(selectedProductId))) {
    options.push({ value: selectedProductId, label: linkedProductName || 'Linked Product' })
  }
  return options
}
