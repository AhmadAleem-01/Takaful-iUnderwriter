import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { ReceiptText } from 'lucide-react'
import { useAsyncData } from '../../hooks/useAsyncData'
import { listQuotes } from '../../services/quotesService'
import type { QuoteSummary } from '../../domain/app'
import { PageHeader } from '../../components/layout/PageHeader'
import { FilterBar } from '../../components/ui/FilterBar'
import { DataTable } from '../../components/ui/DataTable'
import { QuoteStatusBadge } from '../../components/quotes/QuoteStatusBadge'
import { formatCurrency, formatDate } from '../../lib/formatters'

const columns: ColumnDef<QuoteSummary>[] = [
  {
    header: 'Quote Number',
    cell: ({ row }) => (
      <Link
        to={`/quotes/${row.original.id}/edit`}
        className="font-semibold text-primary transition hover:text-primary/80 hover:underline"
      >
        {row.original.name}
      </Link>
    ),
  },
  { header: 'Product', accessorKey: 'productName' },
  { header: 'Plan', accessorKey: 'planName' },
  { header: 'Status', cell: ({ row }) => <QuoteStatusBadge status={row.original.status} statusCode={row.original.quoteStatusValue} /> },
  { header: 'Premium', cell: ({ row }) => formatCurrency(row.original.totalPremium) },
  { header: 'Created', cell: ({ row }) => formatDate(row.original.createdOn) },
]

export function QuotesPage() {
  const [search, setSearch] = useState('')
  const { data, loading, error } = useAsyncData(listQuotes, [])

  const filtered = useMemo(() => {
    const records = data ?? []
    if (!search.trim()) return records
    const query = search.toLowerCase()
    return records.filter((record) =>
      [record.name, record.productName, record.planName, record.status]
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [data, search])

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ReceiptText}
        title="Quotes"
        description="Quote production workspace with linked inquiry, product, and plan context."
      />
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search quotes by name, product, or plan"
      />
      {loading ? (
        <div className="rounded-[22px] border border-border-soft bg-surface p-6 text-sm text-muted-foreground">
          Loading quote records from Dataverse...
        </div>
      ) : error ? (
        <div className="rounded-[22px] border border-danger/25 bg-danger/5 p-6 text-sm text-danger">
          {error}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          emptyTitle="No quotes found"
          emptyDescription="Quote records linked to inquiries will be listed here."
        />
      )}
    </div>
  )
}
