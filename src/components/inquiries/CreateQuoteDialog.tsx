import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { CheckCircle2, ChevronDown, X } from 'lucide-react'
import { getPlanCoverages, getProductPlans } from '../../services/inquiryCoveragesService'
import { useAsyncData } from '../../hooks/useAsyncData'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'

export function CreateQuoteDialog({ inquiryName, productId, productName, onClose, onCreate }: {
  inquiryName: string
  productId: string
  productName: string
  onClose: () => void
  onCreate: (planId: string) => Promise<void>
}) {
  const [planId, setPlanId] = useState('')
  const [expandedPlanId, setExpandedPlanId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const plans = useAsyncData(() => getProductPlans(productId), [productId, refresh])
  const coverages = useAsyncData(async () => ({
    planId,
    records: planId ? await getPlanCoverages(productId, planId) : [],
  }), [productId, planId, refresh])
  const selectedPlan = plans.data?.find((plan) => plan.id === planId)
  const currentCoverages = coverages.data?.planId === planId ? coverages.data.records : null
  const canCreate = Boolean(selectedPlan && currentCoverages?.length && !plans.loading && !plans.error && !coverages.loading && !coverages.error && !busy)

  async function create() {
    if (!canCreate) return
    setBusy(true)
    setError(null)
    try {
      await onCreate(planId)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create the quote.')
    } finally {
      setBusy(false)
    }
  }

  return <Dialog.Root open onOpenChange={(open) => { if (!open && !busy) onClose() }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[100] bg-slate-950/55 backdrop-blur-sm" />
      <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] flex max-h-[min(90vh,760px)] w-[min(760px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[24px] border border-border bg-surface text-foreground shadow-2xl outline-none">
        <div className="flex items-start justify-between gap-4 border-b border-border-soft p-6">
          <div>
            <Dialog.Title className="text-xl font-semibold">Create Quote</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted-foreground">Choose a plan for {productName || 'this product'}, review its coverages, then create a quote for {inquiryName}.</Dialog.Description>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="Close create quote dialog" disabled={busy} onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
          <div><h3 className="font-semibold">Plans for {productName || 'this product'}</h3><p className="mt-1 text-sm text-muted-foreground">Select a plan to expand its coverages and review them before generating the quote.</p></div>
          {!productId ? <p className="rounded-xl border border-border-soft p-4 text-sm text-muted-foreground">Set a product on this inquiry before creating a quote.</p>
            : plans.loading ? <p role="status" className="text-sm text-muted-foreground">Loading plans...</p>
              : plans.error ? <div role="alert" className="rounded-xl border border-danger/20 bg-danger/5 p-4 text-sm text-danger">{plans.error}<Button type="button" variant="outline" size="sm" className="ml-3" onClick={() => setRefresh((value) => value + 1)}>Retry</Button></div>
                : !plans.data?.length ? <p className="rounded-xl border border-border-soft p-4 text-sm text-muted-foreground">No plans are linked to this product.</p>
                  : <div className="space-y-3">{plans.data.map((plan) => {
                    const selected = planId === plan.id
                    const expanded = expandedPlanId === plan.id
                    return <div key={plan.id} className={`overflow-hidden rounded-2xl border transition ${selected ? 'border-primary/50 bg-primary/5' : 'border-border-soft bg-surface'}`}>
                      <button type="button" aria-pressed={selected} aria-expanded={expanded} disabled={busy} onClick={() => { setPlanId(plan.id); setExpandedPlanId(expanded ? '' : plan.id); setError(null) }} className="flex min-h-16 w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-primary/5">
                        <span className="flex items-center gap-3 font-semibold">{selected ? <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" /> : <span className="h-5 w-5 shrink-0 rounded-full border border-border" />}{plan.name}</span>
                        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
                      </button>
                      {expanded ? <div className="space-y-4 border-t border-border-soft bg-surface px-4 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="font-semibold">Coverages</h4><p className="mt-1 text-sm text-muted-foreground">Active coverages in {plan.name}.</p></div>{currentCoverages ? <Badge variant="review">{currentCoverages.length} coverages</Badge> : null}</div>
                        {coverages.loading ? <p role="status" className="text-sm text-muted-foreground">Loading coverages...</p>
                          : coverages.error ? <div role="alert" className="rounded-xl border border-danger/20 bg-danger/5 p-4 text-sm text-danger">{coverages.error}<Button type="button" variant="outline" size="sm" className="ml-3" onClick={() => setRefresh((value) => value + 1)}>Retry</Button></div>
                            : !currentCoverages ? <p role="status" className="text-sm text-muted-foreground">Loading coverages...</p>
                              : !currentCoverages.length ? <p className="rounded-xl border border-border-soft p-4 text-sm text-muted-foreground">This plan has no active coverages. Add coverages to the plan before creating a quote.</p>
                                : <div className="grid gap-3 sm:grid-cols-2">{currentCoverages.map((coverage) => <div key={coverage.id} className="rounded-xl border border-border-soft bg-surface-soft/50 p-4"><p className="font-semibold">{coverage.name}</p><p className="mt-1 text-xs text-muted-foreground">{coverage.coverageType}</p></div>)}</div>}
                      </div> : null}
                    </div>
                  })}</div>}
        </div>

        {error ? <p role="alert" className="mx-6 mb-4 rounded-xl border border-danger/20 bg-danger/5 p-3 text-sm text-danger">{error}</p> : null}
        <div className="flex flex-wrap justify-end gap-3 border-t border-border-soft px-6 py-4">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={!canCreate} onClick={() => { void create() }}>{busy ? 'Creating...' : 'Generate Quote'}</Button>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}
