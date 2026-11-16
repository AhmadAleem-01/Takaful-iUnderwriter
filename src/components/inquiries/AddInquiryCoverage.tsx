import { useState } from 'react'
import { addExistingInquiryCoverage, getPlanCoverages, getProductPlans } from '../../services/inquiryCoveragesService'
import { useAsyncData } from '../../hooks/useAsyncData'
import { Button } from '../ui/Button'

export function AddInquiryCoverage({ inquiryId, productId, existingIds, onAdded }: {
  inquiryId: string
  productId: string
  existingIds: string[]
  onAdded: () => void
}) {
  const [planId, setPlanId] = useState('')
  const [addingId, setAddingId] = useState<string | null>(null)
  const [addedIds, setAddedIds] = useState<string[]>([])
  const [actionError, setActionError] = useState<string | null>(null)
  const plans = useAsyncData(() => getProductPlans(productId), [productId])

  async function handleAdd(coverageId: string) {
    setActionError(null)
    setAddingId(coverageId)
    try {
      await addExistingInquiryCoverage(inquiryId, productId, planId, coverageId)
      setAddedIds((current) => [...current, coverageId])
      onAdded()
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Unable to add the coverage.')
    } finally {
      setAddingId(null)
    }
  }

  return <div className="space-y-4 rounded-2xl border border-border-soft bg-surface-soft/50 p-4">
    <div><h3 className="text-base font-semibold">Add existing coverage</h3><p className="mt-1 text-sm text-muted-foreground">Choose a plan for this product, then add one of its coverages.</p></div>
    {plans.loading ? <p role="status" className="text-sm text-muted-foreground">Loading product plans...</p>
      : plans.error ? <p role="alert" className="text-sm text-danger">{plans.error}</p>
        : !plans.data?.length ? <p className="text-sm text-muted-foreground">No plans are linked to this product.</p>
          : <div className="space-y-2"><p className="text-sm font-medium">Related plans</p><div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto">{plans.data.map((plan) => <Button key={plan.id} type="button" variant={planId === plan.id ? 'primary' : 'outline'} size="sm" aria-pressed={planId === plan.id} disabled={Boolean(addingId)} onClick={() => { setPlanId(plan.id); setActionError(null) }}>{plan.name}</Button>)}</div></div>}
    {planId ? <PlanCoverageOptions key={planId} productId={productId} planId={planId} planName={plans.data?.find((plan) => plan.id === planId)?.name ?? 'selected plan'} linkedIds={new Set([...existingIds, ...addedIds])} addingId={addingId} onAdd={(coverageId) => { void handleAdd(coverageId) }} /> : null}
    {actionError ? <p role="alert" className="text-sm text-danger">{actionError}</p> : null}
  </div>
}

function PlanCoverageOptions({ productId, planId, planName, linkedIds, addingId, onAdd }: {
  productId: string
  planId: string
  planName: string
  linkedIds: Set<string>
  addingId: string | null
  onAdd: (coverageId: string) => void
}) {
  const coverages = useAsyncData(() => getPlanCoverages(productId, planId), [productId, planId])
  return <div className="space-y-3 border-t border-border-soft pt-4">
    <p className="text-sm font-medium">Coverages in {planName}</p>
    {coverages.loading ? <p role="status" className="text-sm text-muted-foreground">Loading plan coverages...</p>
      : coverages.error ? <p role="alert" className="text-sm text-danger">{coverages.error}</p>
        : !coverages.data?.length ? <p className="text-sm text-muted-foreground">No active coverages are linked to this plan.</p>
          : <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{coverages.data.map((coverage) => <div key={coverage.id} className="flex items-center justify-between gap-3 rounded-xl border border-border-soft bg-surface p-3"><div className="min-w-0"><p className="text-sm font-semibold">{coverage.name}</p><p className="text-xs text-muted-foreground">{coverage.coverageType}</p></div><Button type="button" variant="outline" size="sm" disabled={linkedIds.has(coverage.id) || Boolean(addingId)} onClick={() => onAdd(coverage.id)}>{linkedIds.has(coverage.id) ? 'Added' : addingId === coverage.id ? 'Adding...' : 'Add'}</Button></div>)}</div>}
  </div>
}
