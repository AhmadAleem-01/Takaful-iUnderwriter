import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Layers3, Trash2 } from 'lucide-react'
import { Card } from './Card'
import { Badge } from './Badge'
import { Button } from './Button'

interface CoverageRecord {
  id: string
  name: string
  coverageType: string
}

export function CoverageGroups({ records, onRemove, removingId }: { records: CoverageRecord[]; onRemove?: (record: CoverageRecord) => void; removingId?: string | null }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const groups = useMemo(() => {
    const grouped = new Map<string, CoverageRecord[]>()
    for (const record of records) {
      const bucket = grouped.get(record.coverageType) ?? []
      bucket.push(record)
      grouped.set(record.coverageType, bucket)
    }
    return [...grouped].map(([label, coverages]) => ({ label, coverages }))
  }, [records])

  return <div className="space-y-4">{groups.map((group) => <Card key={group.label} className="overflow-hidden p-0">
    <button type="button" className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-primary/4" aria-expanded={Boolean(expanded[group.label])} onClick={() => setExpanded((current) => ({ ...current, [group.label]: !current[group.label] }))}>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Layers3 className="h-4 w-4" /></span>
        <div><p className="font-semibold">{group.label}</p><p className="text-sm text-muted-foreground">{group.coverages.length} linked coverages in this category.</p></div>
      </div>
      <div className="flex items-center gap-3"><Badge variant="neutral">{group.coverages.length}</Badge>{expanded[group.label] ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}</div>
    </button>
    {expanded[group.label] ? <div className="grid gap-3 border-t border-border-soft px-5 py-5 md:grid-cols-2 xl:grid-cols-3">{group.coverages.map((coverage) => <Card key={coverage.id} className="rounded-[20px] bg-surface-soft/70 p-4 shadow-none"><p className="text-sm font-semibold leading-5">{coverage.name}</p>{onRemove ? <Button type="button" variant="destructive" size="sm" className="mt-3" disabled={Boolean(removingId)} onClick={() => onRemove(coverage)}><Trash2 aria-hidden="true" className="h-3.5 w-3.5" />{removingId === coverage.id ? 'Removing...' : 'Remove'}</Button> : null}</Card>)}</div> : null}
  </Card>)}</div>
}
