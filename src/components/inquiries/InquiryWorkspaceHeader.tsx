import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { InquiryDetail } from '../../domain/app'
import { formatDate } from '../../lib/formatters'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'

type HeaderInquiry = Pick<InquiryDetail, 'name' | 'inquiryNumber' | 'inquiryType' | 'status' | 'createdOn'>

export function InquiryWorkspaceHeader({ inquiry }: { inquiry: HeaderInquiry }) {
  return (
    <section aria-label="Inquiry header" className="min-w-0 rounded-xl border border-border-soft bg-white px-4 py-4 sm:px-6 dark:bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="h-8 shrink-0 rounded-lg px-2 text-[12px] font-normal text-primary dark:text-primary-light">
          <Link to="/inquiries"><ArrowLeft aria-hidden="true" className="h-4 w-4" />Back to Inquiries</Link>
        </Button>
        <div aria-label="Inquiry number, type, and status" className="ml-auto flex min-w-0 max-w-full flex-wrap justify-end gap-2 [&>span]:max-w-full [&>span]:break-words [&>span]:text-[12px] [&>span]:font-normal [&>span]:shadow-none">
          <Badge variant="new">{inquiry.inquiryNumber}</Badge>
          <Badge variant="neutral">{inquiry.inquiryType}</Badge>
          <Badge variant="pending">{inquiry.status}</Badge>
        </div>
      </div>
      <div className="mt-4 min-w-0 space-y-2">
        <h1 className="break-words text-[26px] font-semibold leading-snug text-foreground">{inquiry.name}</h1>
        <p className="text-[12px] font-normal leading-5 text-muted-foreground">Inquiry Received <span>{formatDate(inquiry.createdOn)}</span></p>
      </div>
    </section>
  )
}
