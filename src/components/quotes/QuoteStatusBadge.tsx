import { Badge } from '../ui/Badge'

export function QuoteStatusBadge({ status, statusCode, prominent = false }: { status: string; statusCode?: number; prominent?: boolean }) {
  const normalized = status.replace(/\s+/g, '').toLowerCase()
  const isLost = statusCode === 751820002 || normalized === 'quotelost'
  const isWon = statusCode === 751820001 || normalized === 'quotewon'
  const isInactive = statusCode === 2 || normalized === 'inactive'
  const variant = isLost
    ? 'rejected'
    : isWon
      ? 'approved'
      : 'neutral'
  if (prominent) {
    const tone = isLost
      ? 'border-danger/40 bg-danger/12 text-danger'
      : isWon
        ? 'border-success/40 bg-success/12 text-success'
        : isInactive
          ? 'border-border bg-surface-muted text-foreground'
          : 'border-primary/40 bg-primary/10 text-primary'
    return <Badge variant={variant} className={`gap-2 px-3.5 py-2 text-[13px] font-bold shadow-sm ${tone}`}>
      <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-current" />
      {status}
    </Badge>
  }
  return <Badge variant={variant}>{status}</Badge>
}
