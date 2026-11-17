import { Skeleton } from './Skeleton'
import { cn } from '../../lib/cn'

export function CardSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn('rounded-xl border border-[#E1E7EF] bg-[#E7EDF5] motion-reduce:animate-none dark:border-[#2A4055] dark:bg-[#24384C]', className)} />
}
