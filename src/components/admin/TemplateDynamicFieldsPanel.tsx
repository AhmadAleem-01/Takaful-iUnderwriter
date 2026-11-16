import { Braces, Check, Database, Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Skeleton } from '../ui/Skeleton'
import { cn } from '../../lib/cn'
import type { TemplateField, TemplateFieldTable } from '../../lib/emailTemplateFields'
import { getEmailTemplateFieldTables } from '../../services/emailTemplateFieldsService'

export type TemplateInsertionTarget = 'subject' | 'body'

export function TemplateDynamicFieldsPanel({ target, onTargetChange, onInsert, onTablesLoaded }: {
  target: TemplateInsertionTarget
  onTargetChange: (target: TemplateInsertionTarget) => void
  onInsert: (token: string, label?: string) => void
  onTablesLoaded?: (tables: TemplateFieldTable[]) => void
}) {
  const [tables, setTables] = useState<TemplateFieldTable[]>([])
  const [tableName, setTableName] = useState('aur_inquiry')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    getEmailTemplateFieldTables().then((loaded) => {
      if (!active) return
      setTables(loaded)
      onTablesLoaded?.(loaded)
      setTableName((current) => loaded.some((table) => table.name === current) ? current : loaded[0]?.name ?? '')
    }).catch(() => {
      if (active) setError('Fields could not be loaded. Try again.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [retry, onTablesLoaded])

  const selectedTable = tables.find((table) => table.name === tableName)
  const fields = useMemo(() => selectedTable?.fields.filter((field) =>
    `${field.label} ${field.name} ${field.type}`.toLowerCase().includes(search.trim().toLowerCase())) ?? [], [selectedTable, search])

  function insert(field: TemplateField) {
    onInsert(field.token, field.label)
    setAnnouncement(`${field.label} inserted into ${target === 'subject' ? 'subject' : 'email body'}.`)
  }

  return (
    <aside aria-label="Dynamic fields" className="min-w-0 overflow-hidden rounded-[24px] border border-border-soft bg-surface-soft lg:sticky lg:top-0">
      <div className="space-y-4 border-b border-border-soft p-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Braces className="h-4 w-4" /></span>
          <div className="min-w-0"><h3 className="text-sm font-semibold">Dynamic fields</h3><p className="text-xs text-muted-foreground">Make every email personal</p></div>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">Choose a table, then click a field to insert it at your cursor.</p>
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Insert into</p>
          <div role="group" aria-label="Insert dynamic fields into" className="flex rounded-xl border border-border-soft bg-surface p-1">
            {(['subject', 'body'] as const).map((value) => (
              <button key={value} type="button" aria-pressed={target === value} onClick={() => onTargetChange(value)}
                className={cn('flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40', target === value ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                {value === 'subject' ? 'Subject' : 'Body'}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground"><Database className="h-3.5 w-3.5" />Table</p>
          <Select aria-label="Dynamic field table" value={tableName} disabled={loading || Boolean(error) || !tables.length} placeholder="Select a table"
            className="h-10 min-w-0 [&>span:first-child]:truncate" contentClassName="max-w-[320px]"
            onValueChange={(value) => { setTableName(value); setSearch(''); setAnnouncement('') }}
            options={tables.map((table) => ({ value: table.name, label: table.label }))} />
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search dynamic fields" placeholder="Search fields…" value={search} disabled={loading || Boolean(error)} onChange={(event) => setSearch(event.target.value)} className="h-10 pl-9 text-xs" />
        </div>
      </div>
      <div className="p-2">
        {loading ? <div aria-label="Loading fields" className="space-y-2 p-2">{[1, 2, 3, 4].map((key) => <Skeleton key={key} className="h-14 rounded-xl" />)}</div>
          : error ? <div role="alert" className="space-y-3 p-3 text-xs"><p className="text-danger">{error}</p><Button type="button" variant="outline" size="sm" onClick={() => setRetry((value) => value + 1)}>Retry</Button></div>
          : <>
            <p className="px-2 pb-2 pt-1 text-[11px] text-muted-foreground">{fields.length} {fields.length === 1 ? 'field' : 'fields'}{search ? ' found' : ' available'}</p>
            <div className="max-h-[300px] space-y-1 overflow-y-auto overscroll-contain lg:max-h-[36vh]">
              {fields.map((field) => <button key={field.name} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => insert(field)}
                title={`Insert ${selectedTable?.label} · ${field.label}`} aria-label={`Insert ${field.label} into ${target}`}
                className="group flex w-full items-start gap-2 rounded-xl border border-transparent p-2.5 text-left transition hover:border-primary/15 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40">
                <div className="min-w-0 flex-1"><p className="break-words text-xs font-semibold leading-5 group-hover:text-primary">{field.label}</p><p className="truncate text-[10px] text-muted-foreground" title={field.name}>{field.name}</p><p className="mt-1 text-[10px] text-muted-foreground">{field.type}</p></div>
                <Plus className="mt-1 h-3.5 w-3.5 shrink-0 text-primary opacity-60 group-hover:opacity-100" />
              </button>)}
              {!fields.length && <div className="space-y-2 px-3 py-8 text-center"><Search className="mx-auto h-5 w-5 text-muted-foreground" /><p className="text-xs font-medium">No fields found</p><p className="text-xs text-muted-foreground">Try another search or table.</p></div>}
            </div>
          </>}
      </div>
      <div className="border-t border-border-soft p-4">
        <p className="text-[11px] leading-5 text-muted-foreground">Fields are replaced with record values when the template is used.</p>
        <p role="status" aria-live="polite" className="mt-2 flex min-h-4 items-start gap-1.5 text-[11px] leading-4 text-success">{announcement && <><Check className="h-3.5 w-3.5 shrink-0" />{announcement}</>}</p>
      </div>
    </aside>
  )
}
