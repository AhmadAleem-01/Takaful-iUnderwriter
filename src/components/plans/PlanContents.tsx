import { useState } from 'react'
import { BadgeCheck, ChevronDown, CircleMinus, FileCheck2, Layers3, ListChecks, LoaderCircle, RefreshCw, Search, ShieldCheck, type LucideIcon } from 'lucide-react'
import { getQuotePlanLinkedSections, type QuotePlanLinkedEntityKey } from '../../services/quotesService'
import { useAsyncData } from '../../hooks/useAsyncData'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Input } from '../ui/Input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs'

const categories: { key: QuotePlanLinkedEntityKey; title: string; icon: LucideIcon; description: string }[] = [
  { key: 'coverages', title: 'Coverages', icon: ShieldCheck, description: 'The protection provided by this plan.' },
  { key: 'benefits', title: 'Benefits', icon: BadgeCheck, description: 'The benefits available under this plan.' },
  { key: 'inclusions', title: 'Inclusions', icon: ListChecks, description: 'Items included in the plan.' },
  { key: 'exclusions', title: 'Exclusions', icon: CircleMinus, description: 'Items excluded from the plan.' },
  { key: 'warranties', title: 'Warranties', icon: FileCheck2, description: 'Warranties and obligations linked to the plan.' },
  { key: 'deductibles', title: 'Deductibles', icon: Layers3, description: 'Deductibles associated with this plan.' },
]

export function PlanContents({ planId }: { planId: string }) {
  const [category, setCategory] = useState('coverages')
  const [search, setSearch] = useState('')
  const [refresh, setRefresh] = useState(0)
  const load = useAsyncData(() => getQuotePlanLinkedSections(planId), [planId, refresh])
  const total = (load.data ?? []).reduce((sum, section) => sum + section.records.length, 0)

  return <Card padding="none" className="overflow-hidden border-border shadow-none">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border-soft p-5 sm:px-6">
      <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Layers3 className="h-5 w-5" /></span><div><h2 className="text-base font-semibold">Plan Contents</h2><p className="mt-1 text-xs text-muted-foreground">Explore the protection, terms and benefits linked to this plan.</p></div></div>
      <div className="flex items-center gap-3">{!load.loading && !load.error ? <span className="rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary">{total} linked {total === 1 ? 'record' : 'records'}</span> : null}<Button type="button" size="sm" variant="outline" disabled={load.loading} onClick={() => setRefresh((current) => current + 1)}><RefreshCw className={`h-3.5 w-3.5 ${load.loading ? 'animate-spin' : ''}`} />Refresh Contents</Button></div>
    </header>
    {load.loading ? <div role="status" className="flex min-h-52 items-center justify-center gap-3 p-6 text-sm text-muted-foreground"><LoaderCircle className="h-5 w-5 animate-spin text-primary" />Loading related plan records...</div> : load.error ? <div role="alert" className="space-y-3 p-6"><p className="text-sm text-danger">Unable to load plan contents: {load.error}</p><Button type="button" variant="outline" size="sm" onClick={() => setRefresh((current) => current + 1)}>Try Again</Button></div> : <Tabs value={category} onValueChange={(value) => { setCategory(value); setSearch('') }} className="grid md:grid-cols-[220px_minmax(0,1fr)]">
      <TabsList aria-label="Related plan categories" className="h-fit !grid grid-cols-2 gap-2 rounded-none border-0 bg-surface-soft/60 p-4 sm:grid-cols-3 md:!flex md:!flex-col md:items-stretch">
        {categories.map(({ key, title, icon: Icon }) => <TabsTrigger key={key} value={key} className="min-w-0 justify-start rounded-xl px-3 py-3 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 [&>span]:flex [&>span]:w-full [&>span]:items-center [&>span]:gap-2 [&>span]:whitespace-normal"><Icon className="h-4 w-4 shrink-0" /><span className="flex-1">{title}</span><span className="rounded-md bg-current/5 px-1.5 py-0.5 text-[10px] tabular-nums">{load.data?.find((section) => section.key === key)?.records.length ?? 0}</span></TabsTrigger>)}
      </TabsList>
      <div className="min-w-0 border-t border-border-soft p-4 md:border-l md:border-t-0 sm:p-6">
        {categories.map(({ key, title, icon: Icon, description }) => {
          const records = load.data?.find((section) => section.key === key)?.records ?? []
          const query = search.trim().toLowerCase()
          const filtered = records.filter((record) => `${record.name} ${record.description}`.toLowerCase().includes(query))
          return <TabsContent key={key} value={key} className="space-y-5 outline-none">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div><label className="relative w-full sm:w-64"><span className="sr-only">Search {title.toLowerCase()}</span><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input type="search" className="pl-9 text-xs" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault() }} placeholder={`Search ${title.toLowerCase()}...`} /></label></div>
            {filtered.length ? <div className="space-y-3">{filtered.map((record) => <details key={record.id} className="group rounded-xl border border-border-soft bg-surface transition-colors open:border-primary/25 hover:border-primary/25 motion-reduce:transition-none">
              <summary className="flex cursor-pointer list-none items-start gap-3 rounded-xl p-4 outline-none focus-visible:ring-2 focus-visible:ring-primary/30 [&::-webkit-details-marker]:hidden"><span className="rounded-lg bg-primary/[0.06] p-2 text-primary"><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block break-words text-[13px] font-semibold leading-5">{record.name || 'Unnamed record'}</span><span className="mt-1 line-clamp-2 whitespace-pre-line text-xs leading-5 text-muted-foreground group-open:hidden">{record.description || 'No description provided.'}</span></span><ChevronDown aria-hidden="true" className="mt-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" /></summary>
              <div className="border-t border-border-soft px-4 py-4 sm:pl-16"><p className="whitespace-pre-wrap break-words text-[13px] leading-6 text-muted-foreground">{record.description || 'No description provided.'}</p></div>
            </details>)}</div> : <div className="rounded-xl border border-dashed border-border p-8 text-center"><Icon className="mx-auto h-7 w-7 text-primary/60" /><h4 className="mt-3 text-sm font-semibold">{query ? 'No matching records' : `No ${title.toLowerCase()} linked`}</h4><p className="mt-2 text-xs leading-5 text-muted-foreground">{query ? 'Try a different name or description.' : `Records linked to this plan will appear here.`}</p>{query ? <Button type="button" size="sm" variant="ghost" className="mt-3" onClick={() => setSearch('')}>Clear Search</Button> : null}</div>}
            {records.length ? <p className="text-[11px] text-muted-foreground">{filtered.length} of {records.length} {title.toLowerCase()} · Select a record to read the full description.</p> : null}
          </TabsContent>
        })}
      </div>
    </Tabs>}
  </Card>
}
