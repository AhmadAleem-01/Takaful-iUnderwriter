import { CardSkeleton as CardPlaceholder } from '../ui/CardSkeleton'

export function DashboardSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading dashboard">
      <span className="sr-only">Loading dashboard…</span>
      <div aria-hidden="true" className="space-y-6">
        <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <CardPlaceholder className="h-[460px]" />
          <div className="grid gap-3 xl:grid-rows-3">
            <CardPlaceholder className="min-h-[140px]" />
            <CardPlaceholder className="min-h-[140px]" />
            <CardPlaceholder className="min-h-[140px]" />
          </div>
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <CardPlaceholder className="h-[380px]" />
          <CardPlaceholder className="h-[380px]" />
          <CardPlaceholder className="h-[360px] xl:col-span-2" />
          <CardPlaceholder className="h-[380px]" />
          <CardPlaceholder className="h-[380px]" />
          <CardPlaceholder className="h-[380px] xl:col-span-2" />
        </div>
      </div>
    </div>
  )
}
