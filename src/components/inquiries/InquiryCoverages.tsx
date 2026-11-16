import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Layers3, Plus, Trash2, X } from 'lucide-react'
import { deactivateInquiryCoverage, getInquiryCoverages } from '../../services/inquiryCoveragesService'
import { useAsyncData } from '../../hooks/useAsyncData'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { CoverageGroups } from '../ui/CoverageGroups'
import { AddInquiryCoverage } from './AddInquiryCoverage'

export function InquiryCoverages({ inquiryId, productId }: { inquiryId: string; productId?: string }) {
  const [refresh, setRefresh] = useState(0)
  const [showAdd, setShowAdd] = useState(false)
  const [coverageToRemove, setCoverageToRemove] = useState<{ id: string; name: string } | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const load = useAsyncData(() => getInquiryCoverages(inquiryId), [inquiryId, refresh])
  async function handleRemove() {
    const coverage = coverageToRemove
    if (!coverage) return
    setRemoveError(null)
    setRemovingId(coverage.id)
    try {
      await deactivateInquiryCoverage(inquiryId, coverage.id)
      setCoverageToRemove(null)
      setRefresh((value) => value + 1)
    } catch (cause) {
      setRemoveError(cause instanceof Error ? cause.message : 'Unable to remove the inquiry coverage.')
      setRefresh((value) => value + 1)
    } finally {
      setRemovingId(null)
    }
  }
  return <Card className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><div className="flex items-center gap-3"><h2 className="text-xl font-bold">Coverages</h2>{!load.loading && !load.error ? <Badge variant="review">{load.data?.length ?? 0}</Badge> : null}</div><p className="mt-1 text-sm text-muted-foreground">Coverages linked to this inquiry, grouped by coverage type.</p></div>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="primary" disabled={!productId || load.loading || Boolean(load.error)} onClick={() => setShowAdd((value) => !value)}><Plus aria-hidden="true" className="h-4 w-4" />{showAdd ? 'Close picker' : 'Add existing coverage'}</Button><Button type="button" variant="secondary" disabled={load.loading} onClick={() => setRefresh((value) => value + 1)}>Refresh</Button></div>
    </div>
    {!productId ? <p className="text-sm text-muted-foreground">Set a product on this inquiry to add coverages.</p> : null}
    {showAdd && productId ? <AddInquiryCoverage key={productId} inquiryId={inquiryId} productId={productId} existingIds={load.data?.map((coverage) => coverage.id) ?? []} onAdded={() => setRefresh((value) => value + 1)} /> : null}
    {load.loading ? <p role="status" className="text-sm text-muted-foreground">Loading related coverages...</p> : load.error ? <div role="alert" className="space-y-3 rounded-xl border border-danger/20 bg-danger/5 p-4"><p className="text-sm text-danger">{load.error}</p><Button type="button" variant="outline" size="sm" onClick={() => setRefresh((value) => value + 1)}>Try Again</Button></div> : !load.data?.length ? <Card className="border-dashed border-border bg-surface-soft/70 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Layers3 className="h-6 w-6" /></div><h3 className="mt-4 text-lg font-semibold">No related coverages</h3><p className="mt-2 text-sm text-muted-foreground">Coverages linked to this inquiry will appear here.</p></Card> : <CoverageGroups records={load.data} onRemove={(coverage) => { setRemoveError(null); setCoverageToRemove(coverage) }} removingId={removingId} />}
    <Dialog.Root open={Boolean(coverageToRemove)} onOpenChange={(open) => { if (!open && !removingId) { setCoverageToRemove(null); setRemoveError(null) } }}>
      {coverageToRemove ? <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-slate-950/55 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] w-[min(440px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 text-foreground shadow-2xl outline-none">
          <div className="flex items-start justify-between gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-danger/10 text-danger"><Trash2 aria-hidden="true" className="h-5 w-5" /></span>
            <Button type="button" variant="ghost" size="icon" className="-mr-2 -mt-2 h-8 w-8" aria-label="Close remove coverage dialog" disabled={Boolean(removingId)} onClick={() => setCoverageToRemove(null)}><X aria-hidden="true" className="h-4 w-4" /></Button>
          </div>
          <Dialog.Title className="mt-4 text-xl font-semibold">Remove coverage?</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">Remove <span className="font-semibold text-foreground">{coverageToRemove.name}</span> from this inquiry? It will no longer appear in the active coverages list.</Dialog.Description>
          {removeError ? <p role="alert" className="mt-4 rounded-xl border border-danger/20 bg-danger/5 p-3 text-sm text-danger">{removeError}</p> : null}
          <div className="mt-6 flex justify-end gap-2"><Button type="button" variant="outline" disabled={Boolean(removingId)} onClick={() => setCoverageToRemove(null)}>Cancel</Button><Button type="button" variant="destructive" disabled={Boolean(removingId)} onClick={() => { void handleRemove() }}><Trash2 aria-hidden="true" className="h-4 w-4" />{removingId ? 'Removing...' : 'Remove coverage'}</Button></div>
        </Dialog.Content>
      </Dialog.Portal> : null}
    </Dialog.Root>
  </Card>
}
