import { ArrowLeft, ArrowUpRight, ChevronRight, Database, GripVertical, Link2, Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Input } from '../ui/Input'
import { Skeleton } from '../ui/Skeleton'
import type { TemplateField, TemplateFieldTable } from '../../lib/emailTemplateFields'
import { MAX_TEMPLATE_LOOKUP_DEPTH, relatedTemplateField, type TemplateLookupStep } from '../../lib/templateFieldPaths'
import { getTemplateLookupTargets, type TemplateLookupTarget } from '../../services/templateRelatedFieldsService'
import { cn } from '../../lib/cn'

export function DocumentTemplateFieldsPanel({ tables, entity, loading, onInsert }: {
  tables: TemplateFieldTable[]
  entity: string
  loading: boolean
  onInsert: (field: TemplateField) => void
}) {
  const [path, setPath] = useState<Array<TemplateLookupStep & { label: string }>>([])
  const [search, setSearch] = useState('')
  const [busyLookup, setBusyLookup] = useState('')
  const [error, setError] = useState('')
  const [pendingLookup, setPendingLookup] = useState<TemplateField | null>(null)
  const [targets, setTargets] = useState<TemplateLookupTarget[] | null>(null)
  const requestRef = useRef(0)
  const fieldsRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => () => { requestRef.current += 1 }, [])
  const root = tables.find((table) => table.name === entity)
  const current = tables.find((table) => table.name === (path.at(-1)?.table ?? entity))
  const isRelated = path.length > 0
  const parent = tables.find((table) => table.name === (path.at(-2)?.table ?? entity))
  const fields = useMemo(() => current?.fields.filter((field) => `${field.label} ${field.name} ${field.type}`.toLowerCase().includes(search.trim().toLowerCase())) ?? [], [current, search])

  function clearLookup() {
    if (fieldsRef.current) fieldsRef.current.scrollTop = 0
    requestRef.current += 1
    setPendingLookup(null)
    setTargets(null)
    setBusyLookup('')
    setError('')
    setSearch('')
  }

  function navigate(field: TemplateField, target: TemplateLookupTarget) {
    clearLookup()
    setPath((steps) => [...steps, { field: field.name, table: target.table, label: field.label }])
  }

  function returnTo(depth: number) {
    clearLookup()
    setPath((steps) => steps.slice(0, depth))
  }

  async function browse(field: TemplateField) {
    if (!current) return
    const request = ++requestRef.current
    setPendingLookup(field)
    setBusyLookup(field.name)
    setError('')
    setTargets(null)
    try {
      const loaded = await getTemplateLookupTargets(current, field.name, tables)
      if (request !== requestRef.current) return
      if (loaded.length === 1) navigate(field, loaded[0])
      else setTargets(loaded)
    } catch (cause) {
      if (request === requestRef.current) setError(cause instanceof Error ? cause.message : 'Related fields could not be loaded. Please retry.')
    } finally {
      if (request === requestRef.current) setBusyLookup('')
    }
  }

  function insertionField(field: TemplateField) {
    return relatedTemplateField(entity, path, field, [...path.map((step) => step.label), field.label].join(' › '))
  }

  return (
    <Card variant="premium" className="overflow-hidden rounded-[28px] p-0">
      <div className="space-y-4 border-b border-border-soft px-5 py-5">
        <div className="flex items-center gap-2"><Database className="h-4 w-4 text-primary" /><h2 className="text-xl font-semibold">Template Fields</h2></div>
        <p className="text-sm leading-6 text-muted-foreground">{root ? isRelated ? 'Choose a field from the related record below. Its connection is included in the inserted badge.' : 'Insert a field, or use “Choose related fields” on a record link to browse that record.' : 'Select an entity above to browse its fields.'}</p>
        {current ? <div aria-label="Current field source" aria-live="polite" className={cn('rounded-2xl border p-3.5', isRelated ? 'border-violet-200 bg-violet-50/80 dark:border-violet-400/25 dark:bg-violet-400/10' : 'border-border-soft bg-surface-soft')}>
          <div className="flex items-center gap-2">
            {isRelated ? <Link2 className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300" /> : <Database className="h-4 w-4 shrink-0 text-primary" />}
            <Badge variant={isRelated ? 'review' : 'info'} className={isRelated ? 'border-violet-200 bg-violet-100 text-violet-800 dark:border-violet-400/30 dark:bg-violet-400/15 dark:text-violet-200' : undefined}>{isRelated ? 'Related record' : 'Main record'}</Badge>
          </div>
          <h3 className="mt-2 text-base font-semibold">{current.label}</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{isRelated ? <>Linked through <strong className="font-semibold text-foreground">{path.at(-1)?.label}</strong> on <strong className="font-semibold text-foreground">{parent?.label}</strong>.</> : 'These fields belong directly to your template’s entity.'}</p>
        </div> : null}
        {root && isRelated ? <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Record path</p>
          <nav aria-label="Field relationship path" className="flex flex-wrap items-center gap-1 text-xs">
            <button type="button" className="rounded-lg px-1.5 py-1 font-semibold text-primary hover:bg-primary/10" onMouseDown={(event) => event.preventDefault()} onClick={() => returnTo(0)}>{root.label}</button>
            {path.map((step, index) => <span key={index} className="flex min-w-0 items-center gap-1"><ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" /><button type="button" aria-current={index === path.length - 1 ? 'location' : undefined} className="rounded-lg px-1.5 py-1 text-left font-semibold text-primary hover:bg-primary/10 aria-[current=location]:bg-violet-100 aria-[current=location]:text-violet-800 dark:aria-[current=location]:bg-violet-400/15 dark:aria-[current=location]:text-violet-200" onMouseDown={(event) => event.preventDefault()} onClick={() => returnTo(index + 1)}>{step.label}</button></span>)}
          </nav>
          <Button type="button" variant="ghost" size="sm" className="h-auto max-w-full justify-start rounded-lg px-1.5 py-1 text-left" onMouseDown={(event) => event.preventDefault()} onClick={() => returnTo(path.length - 1)}><ArrowLeft className="h-3.5 w-3.5 shrink-0" /><span className="min-w-0 break-words">Back to {parent?.label}</span></Button>
        </div> : null}
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 text-muted-foreground -translate-y-1/2" />
          <Input aria-label="Search document fields" value={search} onChange={(event) => { setSearch(event.target.value); if (fieldsRef.current) fieldsRef.current.scrollTop = 0 }} placeholder={current ? `Search ${current.label} fields` : 'Search fields'} className="pl-11" disabled={!current} />
        </div>
        {busyLookup ? <p role="status" className="text-xs text-muted-foreground">Loading related fields...</p> : null}
        {error ? <div role="alert" className="space-y-2 text-xs text-danger"><p>{error}</p><Button type="button" size="sm" variant="ghost" onClick={() => pendingLookup && void browse(pendingLookup)}>Retry</Button></div> : null}
        {targets && pendingLookup ? <div className="space-y-2 rounded-xl border border-border-soft bg-surface-soft p-3">
          <p className="text-xs font-medium">{targets.length ? `Choose the related table for ${pendingLookup.label}` : 'No connected related tables are available for this lookup.'}</p>
          {targets.map((target) => <Button key={target.table} type="button" size="sm" variant="secondary" className="mr-2" onMouseDown={(event) => event.preventDefault()} onClick={() => navigate(pendingLookup, target)}>{target.label}</Button>)}
        </div> : null}
      </div>
      <div ref={fieldsRef} className="max-h-[500px] space-y-2 overflow-y-auto px-4 py-5">
        {loading ? <Skeleton className="h-24 rounded-xl" /> : !current ? <p className="text-sm text-muted-foreground">Choose an entity to get started.</p> : <>
          <p className="mb-3 text-xs text-muted-foreground">{fields.length} fields from <span className="font-semibold text-foreground">{current.label}</span></p>
          {fields.map((field) => <div key={field.name} className={cn('overflow-hidden rounded-xl border bg-surface-soft/75', isRelated ? 'border-violet-200/80 dark:border-violet-400/20' : 'border-border-soft')}>
            <button type="button" draggable aria-label={`Insert ${[...path.map((step) => step.label), field.label].join(' › ')}`}
              title={field.type === 'Lookup' ? `Insert the ${field.label} record name` : `Insert ${field.label} from ${current.label}`}
              onDragStart={(event) => { event.dataTransfer.setData('application/json', JSON.stringify({ token: insertionField(field).token })); event.dataTransfer.effectAllowed = 'copy' }}
              onMouseDown={(event) => event.preventDefault()} onClick={() => onInsert(insertionField(field))}
              className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40">
              <GripVertical className="h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold">{field.label}</span><span className="text-xs text-muted-foreground">{field.type === 'Lookup' ? 'Insert record name' : field.type}{isRelated ? ` · ${current.label}` : ''}</span></span>
              {field.type === 'Lookup' ? <Link2 className="h-3.5 w-3.5 shrink-0 text-violet-600 dark:text-violet-300" /> : <Plus className="h-3.5 w-3.5 shrink-0 text-primary" />}
            </button>
            {field.type === 'Lookup' && path.length < MAX_TEMPLATE_LOOKUP_DEPTH ? <button type="button" aria-label={`Browse related fields for ${field.label}`} disabled={Boolean(busyLookup)} onMouseDown={(event) => event.preventDefault()} onClick={() => void browse(field)} className="flex w-full items-center justify-between gap-2 border-t border-violet-200/70 bg-violet-50/80 px-3 py-2.5 text-left text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200 dark:hover:bg-violet-400/20"><span className="flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5 shrink-0" />Choose related fields</span><ArrowUpRight className="h-3.5 w-3.5 shrink-0" /></button> : null}
          </div>)}
          {!fields.length ? <p className="text-sm text-muted-foreground">No fields found. Try another search.</p> : null}
        </>}
      </div>
    </Card>
  )
}
