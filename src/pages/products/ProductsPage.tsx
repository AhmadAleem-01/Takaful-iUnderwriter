import { useMemo, useState, type ComponentType } from 'react'
import { Link } from 'react-router-dom'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  ArrowDownUp, ChevronRight, Filter, Layers3, LayoutGrid, List,
  MoreHorizontal, Package, PackageSearch, Pencil, Plus, Search, ShieldCheck, Trash2,
} from 'lucide-react'
import { useAsyncData } from '../../hooks/useAsyncData'
import { getProductsSummary } from '../../services/productsService'
import { Aur_productsesService } from '../../generated/services/Aur_productsesService'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { formatCurrency } from '../../lib/formatters'
import { buildProductHierarchy } from '../../lib/productHierarchy'
import type { ProductSummary } from '../../domain/app'

export function ProductsPage() {
  const [businessSearch, setBusinessSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('name-asc')
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [refreshKey, setRefreshKey] = useState(0)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const { data, loading, error } = useAsyncData(getProductsSummary, [refreshKey])

  const groups = useMemo(() => {
    const hierarchy = buildProductHierarchy(data ?? [])
    const businesses = hierarchy.filter(({ product }) => !product.lineOfBusinessId?.trim()).map(({ product, children }) => ({
      id: product.id, name: product.name, description: product.shortDetails,
      parent: product as ProductSummary | undefined, products: children,
    }))
    const unassigned = hierarchy.filter(({ product }) => product.lineOfBusinessId?.trim()).map(({ product }) => product)
    if (unassigned.length) businesses.push({
      id: 'unassigned-products', name: 'Unassigned products',
      description: 'The line of business referenced by these products is unavailable.',
      parent: undefined, products: unassigned,
    })
    return businesses
  }, [data])

  const visibleGroups = useMemo(() => {
    const query = businessSearch.trim().toLowerCase()
    return groups.filter((group) => group.name.toLowerCase().includes(query))
  }, [groups, businessSearch])
  const selected = visibleGroups.find((group) => group.id === selectedId) ?? visibleGroups[0]
  const statuses = useMemo(() => [...new Set((data ?? []).filter((product) => product.lineOfBusinessId).map((product) => product.status))].sort(), [data])
  const products = useMemo(() => {
    const query = productSearch.trim().toLowerCase()
    return (selected?.products ?? []).filter((product) =>
      (status === 'all' || product.status === status) &&
      [product.name, product.shortDetails].join(' ').toLowerCase().includes(query),
    ).sort((a, b) => {
      if (sort === 'inquiries') return b.inquiryVolume - a.inquiryVolume || a.name.localeCompare(b.name)
      if (sort === 'premium') return b.premiumTotal - a.premiumTotal || a.name.localeCompare(b.name)
      return sort === 'name-desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)
    })
  }, [selected, productSearch, status, sort])
  const totals = useMemo(() => {
    const records = selected ? [...(selected.parent ? [selected.parent] : []), ...selected.products] : []
    return records.reduce((sum, product) => ({
      inquiries: sum.inquiries + product.inquiryVolume,
      premium: sum.premium + product.premiumTotal,
      insured: sum.insured + product.insuredTotal,
    }), { inquiries: 0, premium: 0, insured: 0 })
  }, [selected])

  function selectBusiness(id: string) {
    setSelectedId(id)
    setProductSearch('')
    setStatus('all')
  }

  async function handleDelete(product: ProductSummary) {
    if (deletingId || !window.confirm(`Delete "${product.name}" from products?`)) return
    setActionError(null)
    setDeletingId(product.id)
    try {
      await Aur_productsesService.delete(product.id)
      setRefreshKey((value) => value + 1)
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Unable to delete product.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={PackageSearch}
        title="Products"
        description="Manage lines of business and their related products."
        actions={<Button asChild><Link to="/admin/products/create"><Plus className="h-4 w-4" />Add Product</Link></Button>}
      />
      {actionError ? <p role="alert" className="rounded-2xl border border-danger/20 bg-danger/5 p-4 text-sm text-danger">{actionError}</p> : null}
      {loading ? (
        <Card role="status" className="text-sm text-muted-foreground">Loading lines of business and products...</Card>
      ) : error ? (
        <Card role="alert" className="border-danger/25 bg-danger/5 text-sm text-danger">{error}</Card>
      ) : (
        <div className="grid items-stretch gap-5 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[290px_minmax(0,1fr)]">
          <Card padding="none" className="min-w-0 overflow-hidden lg:min-h-[540px]">
            <div className="px-5 pb-4 pt-5">
              <div className="mb-4 flex items-center gap-3 border-b border-border-soft pb-4">
                <Layers3 className="h-5 w-5 text-primary" aria-hidden="true" />
                <h2 className="flex-1 text-sm font-bold">Lines of Business</h2>
                <Badge variant="new">{groups.filter((group) => group.parent).length}</Badge>
              </div>
              <SearchField value={businessSearch} onChange={setBusinessSearch} placeholder="Search lines of business..." label="Search lines of business" />
            </div>
            <nav aria-label="Lines of business" className="max-h-72 space-y-2 overflow-y-auto px-3 pb-5 lg:max-h-none">
              {visibleGroups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => selectBusiness(group.id)}
                  aria-current={selected?.id === group.id ? 'true' : undefined}
                  className={`relative flex w-full items-center gap-3 overflow-hidden rounded-xl px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${selected?.id === group.id ? 'bg-primary/10 text-primary before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:rounded-full before:bg-primary' : 'text-muted-foreground hover:bg-surface-muted'}`}
                >
                  <Layers3 className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-semibold text-foreground">{group.name}</span>
                    <span className="mt-0.5 block text-xs">{group.products.length} {group.products.length === 1 ? 'product' : 'products'}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </button>
              ))}
              {!visibleGroups.length ? <p className="px-3 py-5 text-sm text-muted-foreground">{businessSearch.trim() ? 'No matching lines of business.' : 'No lines of business yet.'}</p> : null}
            </nav>
          </Card>

          {selected ? (
            <Card padding="none" className="min-w-0 p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Layers3 className="h-7 w-7" aria-hidden="true" /></div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{selected.parent ? 'Line of Business' : 'Products'}</p>
                    <h2 className="mt-1 break-words text-2xl font-bold leading-tight">{selected.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{selected.description}</p>
                  </div>
                </div>
                {selected.parent ? (
                  <div className="flex items-center gap-2">
                    <Button asChild variant="outline" size="sm"><Link to={`/admin/products/${selected.parent.id}/edit`}><Pencil className="h-4 w-4" />Edit Line of Business</Link></Button>
                    <ProductMenu product={selected.parent} disabled={deletingId !== null} onDelete={handleDelete} label="line of business" />
                  </div>
                ) : null}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 2xl:grid-cols-4">
                <OverviewStat icon={Package} label="Products" value={String(selected.products.length)} />
                <OverviewStat icon={Layers3} label="Inquiry Volume" value={String(totals.inquiries)} />
                <OverviewStat icon={ShieldCheck} label="Premium Total" value={formatCurrency(totals.premium)} />
                <OverviewStat icon={ShieldCheck} label="Insured Total" value={formatCurrency(totals.insured)} />
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border-soft pt-5">
                <div className="min-w-0 basis-full 2xl:basis-0 2xl:flex-1">
                  <SearchField value={productSearch} onChange={setProductSearch} placeholder={`Search products in ${selected.name}...`} label="Search products" />
                </div>
                <div className="min-w-[140px] flex-1">
                  <Select aria-label="Filter products by status" className="h-[42px] text-xs" value={status} onValueChange={setStatus} options={[
                    { value: 'all', label: <span className="flex items-center gap-2"><Filter className="h-3.5 w-3.5" />Status: All</span> },
                    ...statuses.map((value) => ({ value, label: `Status: ${value}` })),
                  ]} />
                </div>
                <div className="min-w-[175px] flex-1">
                  <Select aria-label="Sort products" className="h-[42px] text-xs" value={sort} onValueChange={setSort} options={[
                    { value: 'name-asc', label: <span className="flex items-center gap-2"><ArrowDownUp className="h-3.5 w-3.5" />Name (A-Z)</span> },
                    { value: 'name-desc', label: 'Name (Z-A)' },
                    { value: 'inquiries', label: 'Inquiry volume (high-low)' },
                    { value: 'premium', label: 'Premium total (high-low)' },
                  ]} />
                </div>
                <div role="group" aria-label="Product view" className="flex rounded-xl border border-border-soft p-1">
                  {([{ value: 'list', icon: List }, { value: 'grid', icon: LayoutGrid }] as const).map(({ value, icon: Icon }) => (
                    <button key={value} type="button" aria-label={`${value === 'list' ? 'List' : 'Grid'} view`} aria-pressed={view === value} onClick={() => setView(value)} className={`rounded-lg p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${view === value ? 'bg-primary/10 text-primary shadow-sm' : 'text-muted-foreground hover:bg-surface-muted'}`}><Icon className="h-4 w-4" /></button>
                  ))}
                </div>
              </div>

              <div className="mb-3 mt-4 text-xs text-muted-foreground" role="status">Showing {products.length} of {selected.products.length} products</div>
              {products.length ? (
                <div className={view === 'grid' ? 'grid gap-4 xl:grid-cols-2' : 'space-y-3'}>
                  {products.map((product) => (
                    <article key={product.id} className={`rounded-2xl border border-border-soft bg-surface p-4 transition hover:border-primary/25 hover:shadow-soft ${view === 'list' ? 'flex flex-wrap items-center gap-4' : 'space-y-5'}`}>
                      <div className={`flex min-w-0 items-center gap-4 ${view === 'list' ? 'basis-full xl:basis-0 xl:flex-1' : ''}`}>
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Package className="h-6 w-6" aria-hidden="true" /></div>
                        <div className="min-w-0">
                          <Link to={`/admin/products/${product.id}/edit`} className="break-words text-base font-bold transition hover:text-primary hover:underline">{product.name}</Link>
                          <p className="mt-0.5 text-xs text-muted-foreground">Product</p>
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground" title={product.shortDetails}>{product.shortDetails}</p>
                        </div>
                      </div>
                      <dl className={`grid min-w-0 grid-cols-3 gap-3 ${view === 'list' ? 'flex-1 xl:max-w-[340px] xl:border-l xl:border-border-soft xl:pl-4' : 'border-y border-border-soft py-4'}`}>
                        <ProductMetric label="Inquiry Volume" value={String(product.inquiryVolume)} />
                        <ProductMetric label="Premium Total" value={formatCurrency(product.premiumTotal)} />
                        <ProductMetric label="Insured Total" value={formatCurrency(product.insuredTotal)} />
                      </dl>
                      <div className={`flex items-center gap-3 ${view === 'grid' ? 'justify-between' : 'ml-auto'}`}>
                        <Badge variant={product.status.toLowerCase() === 'publish' ? 'approved' : product.status.toLowerCase() === 'draft' ? 'pending' : 'neutral'} className="py-0.5 text-[11px]">{product.status}</Badge>
                        <div className="flex items-center gap-1.5">
                          <Button asChild variant="outline" size="icon" className="h-8 w-8"><Link to={`/admin/products/${product.id}/edit`} aria-label={`Edit ${product.name}`}><Pencil className="h-3.5 w-3.5" /></Link></Button>
                          <ProductMenu product={product} disabled={deletingId !== null} onDelete={handleDelete} />
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border-soft p-8 text-center">
                  <PackageSearch className="mx-auto h-9 w-9 text-primary/60" aria-hidden="true" />
                  <h3 className="mt-3 font-semibold">{selected.products.length ? 'No matching products' : 'No products yet'}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{selected.products.length ? 'Try a different search or status filter.' : `Products linked to ${selected.name} will appear here.`}</p>
                  {selected.products.length ? <Button variant="ghost" size="sm" className="mt-3" onClick={() => { setProductSearch(''); setStatus('all') }}>Clear filters</Button> : null}
                </div>
              )}
            </Card>
          ) : (
            <EmptyState title={businessSearch.trim() ? 'No matching lines of business' : 'No products found'} description={businessSearch.trim() ? 'Try another line of business name.' : 'Add a product to start organizing your lines of business.'} />
          )}
        </div>
      )}
    </div>
  )
}

function SearchField({ value, onChange, placeholder, label }: { value: string; onChange: (value: string) => void; placeholder: string; label: string }) {
  return <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input type="search" aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="pl-9 text-xs" /></div>
}

function OverviewStat({ icon: Icon, label, value }: { icon: ComponentType<{ className?: string }>; label: string; value: string }) {
  return <div className="flex min-w-0 items-center gap-3 rounded-xl border border-primary/5 bg-primary/[0.035] px-4 py-3"><Icon className="h-5 w-5 shrink-0 text-primary" /><div className="min-w-0"><p className="text-[11px] font-medium text-muted-foreground">{label}</p><p className="mt-1 break-words text-lg font-bold tabular-nums">{value}</p></div></div>
}

function ProductMetric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-semibold tabular-nums">{value}</dd></div>
}

function ProductMenu({ product, disabled, onDelete, label = 'product' }: {
  product: ProductSummary
  disabled: boolean
  onDelete: (product: ProductSummary) => Promise<void>
  label?: string
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="outline" size="icon" className="h-8 w-8" aria-label={`More actions for ${product.name}`} disabled={disabled}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-40 rounded-xl border border-border-soft bg-surface p-1.5 shadow-card">
          <DropdownMenu.Item disabled={disabled} onSelect={() => void onDelete(product)} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger outline-none focus:bg-danger/10 data-[disabled]:opacity-50">
            <Trash2 className="h-4 w-4" />Delete {label}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
