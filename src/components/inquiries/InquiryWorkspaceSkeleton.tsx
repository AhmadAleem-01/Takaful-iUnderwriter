import { CardSkeleton } from '../ui/CardSkeleton'

export function InquiryWorkspaceSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading inquiry">
      <span className="sr-only">Loading inquiry details...</span>
      <div aria-hidden="true" className="min-w-0 space-y-6 lg:pr-[72px]">
        <CardSkeleton className="h-[140px]" />
        <CardSkeleton className="h-[380px] sm:h-[220px] lg:h-[200px] 2xl:h-[110px]" />
        <CardSkeleton className="h-14 lg:fixed lg:bottom-6 lg:right-4 lg:top-[88px] lg:my-auto lg:h-[360px] lg:max-h-[calc(100dvh-112px)] lg:w-14" />
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(260px,3fr)]">
          <div className="min-w-0 space-y-3">
            <CardSkeleton className="h-[240px]" />
            <CardSkeleton className="h-[520px] md:h-[370px]" />
            <CardSkeleton className="h-[260px]" />
            <CardSkeleton className="h-[220px]" />
          </div>
          <div className="min-w-0 space-y-4">
            <CardSkeleton className="h-[250px]" />
            <CardSkeleton className="h-[300px]" />
            <CardSkeleton className="h-[230px]" />
          </div>
        </div>
      </div>
    </div>
  )
}
