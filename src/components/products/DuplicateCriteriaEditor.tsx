import { Plus, ShieldAlert, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { BusinessRulePicker } from './BusinessRulePicker'
import { createAviationCriteria, createBlankCriteria } from '../../lib/duplicateCriteriaEditor'
import { parseDuplicateCriteria, type DuplicateCriteria } from '../../lib/inquiryDuplicates'

interface Props {
  value: DuplicateCriteria | null
  savedText: string
  isAviation: boolean
  rules: Array<{ id: string; name: string }>
  onChange: (value: DuplicateCriteria) => void
}

function SourceEditor({ title, help, sources, onChange, rules, allowInquiryInsured = false }: {
  title: string
  help: string
  sources: string[]
  onChange: (sources: string[]) => void
  rules: Array<{ id: string; name: string }>
  allowInquiryInsured?: boolean
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{help}</p>
      </div>
      {sources.map((source, index) => {
        const kind = source === 'inquiry.insuredName' ? 'inquiry' : source.startsWith('evidence') ? 'evidence' : 'response'
        const byId = source.startsWith('evidenceId:') || source.startsWith('responseId:')
        const selected = source.slice(source.indexOf(':') + 1)
        return <div key={index} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            aria-label={`${title} source ${index + 1}`}
            className="sm:w-52"
            value={kind}
            onValueChange={(next) => onChange(sources.map((item, position) => position === index
              ? next === 'inquiry' ? 'inquiry.insuredName' : `${next}${byId && kind !== 'inquiry' ? 'Id' : ''}:${kind === 'inquiry' ? '' : selected}`
              : item))}
            options={[
              ...(allowInquiryInsured ? [{ value: 'inquiry', label: 'Inquiry insured name' }] : []),
              { value: 'response', label: 'AI answer' },
              ...(!allowInquiryInsured || kind === 'evidence' ? [{ value: 'evidence', label: 'AI evidence' }] : []),
            ]}
          />
          {kind !== 'inquiry' && <BusinessRulePicker
            label={`${title} field ${index + 1}`}
            source={source}
            kind={kind}
            rules={rules}
            onChange={(nextSource) => onChange(sources.map((item, position) => position === index ? nextSource : item))}
          />}
          <Button type="button" variant="ghost" size="sm" aria-label={`Remove ${title} source ${index + 1}`} onClick={() => onChange(sources.filter((_, position) => position !== index))}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      })}
      <Button type="button" variant="secondary" size="sm" disabled={sources.length >= 30} onClick={() => onChange([...sources, allowInquiryInsured ? 'response:' : 'evidence:'])}>
        <Plus className="h-4 w-4" /> Add source
      </Button>
    </div>
  )
}

export function DuplicateCriteriaEditor({ value, savedText, isAviation, rules, onChange }: Props) {
  const saved = parseDuplicateCriteria(savedText)
  if (!value) return (
    <Card className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Duplicate inquiry rules</p>
        <h2 className="mt-2 text-xl font-bold">Set up how this line of business finds repeat submissions</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          A potential duplicate needs the same insured, at least one matching risk identifier, and the same or overlapping placement period. Different policy periods are separate; incomplete aircraft evidence and conflicting details go to underwriter review.
        </p>
      </div>
      {saved.state === 'invalid' && <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        <div className="flex items-center gap-2 font-semibold"><ShieldAlert className="h-4 w-4" /> Existing criteria need conversion</div>
        <p className="mt-1">This product currently stores plain text or unsupported JSON. Starting guided setup will replace it when you save the product.</p>
        <details className="mt-3"><summary className="cursor-pointer font-medium">View existing criteria</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs">{savedText}</pre></details>
      </div>}
      <div className="flex flex-wrap gap-3">
        {isAviation && <Button type="button" onClick={() => onChange(createAviationCriteria())}>Use Aviation starting rule</Button>}
        <Button type="button" variant={isAviation ? 'secondary' : 'primary'} onClick={() => onChange(createBlankCriteria())}>Build a custom rule</Button>
      </div>
    </Card>
  )

  const updateGroups = (groups: DuplicateCriteria['identifiers']['groups']) => onChange({ ...value, identifiers: { ...value.identifiers, groups } })
  const updatePeriod = (key: 'startSources' | 'endSources' | 'renewalSources', sources: string[]) =>
    onChange({ ...value, period: { ...value.period, [key]: sources } })
  const valid = parseDuplicateCriteria(JSON.stringify(value)).state === 'ready'

  return <div className="space-y-5">
    <Card className="space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">How the decision works</p>
        <h2 className="mt-2 text-xl font-bold">Duplicate inquiry rule</h2>
        <p className="mt-2 text-sm text-muted-foreground">The app compares saved AI answers or their evidence from the same business rules on inquiries under this parent product. The duplicate check makes no new LLM request.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border-soft bg-surface-soft p-4"><p className="text-sm font-semibold">1. Same insured</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Compare insured names from the inquiry or a saved AI business rule after ignoring case and extra spaces.</p></div>
        <div className="rounded-xl border border-border-soft bg-surface-soft p-4"><p className="text-sm font-semibold">2. Same risk</p><p className="mt-1 text-xs leading-5 text-muted-foreground">At least one identifier below must match, even if the brokers differ.</p></div>
        <div className="rounded-xl border border-border-soft bg-surface-soft p-4"><p className="text-sm font-semibold">3. Same placement</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Policy date ranges must overlap, or renewal dates must match.</p></div>
      </div>
      <p className="text-sm text-muted-foreground">Missing or contradictory values require manual review. An evidence excerpt may cover only part of a fleet, so different excerpt values alone do not prove separate risks. The earliest received broker email is shown as a provisional preference, with inquiry creation time as a fallback.</p>
    </Card>

    <Card className="space-y-4">
      <h3 className="text-lg font-bold">Insured identity</h3>
      <SourceEditor title="Insured name" help="Use the inquiry insured name, or choose a business rule whose saved AI answer contains the insured name as an exact value." sources={value.insured.sources} rules={rules} allowInquiryInsured onChange={(sources) => onChange({ ...value, insured: { ...value.insured, sources } })} />
    </Card>

    <Card className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="text-lg font-bold">Risk identifiers</h3><p className="mt-1 text-sm text-muted-foreground">Add the fields that identify the same insured risk. A match in any one identifier is enough to pass this check.</p></div>
        <Button type="button" variant="secondary" size="sm" disabled={value.identifiers.groups.length >= 20} onClick={() => {
          const used = new Set(value.identifiers.groups.map((group) => group.key))
          let number = 1
          while (used.has(`identifier${number}`)) number++
          updateGroups([...value.identifiers.groups, { key: `identifier${number}`, label: 'New identifier', sources: ['evidence:'] }])
        }}><Plus className="h-4 w-4" /> Add identifier</Button>
      </div>
      {value.identifiers.groups.map((group, index) => <div key={group.key} className="space-y-4 rounded-xl border border-border-soft p-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(12rem,15rem)_1fr_auto] sm:items-end">
          <label className="space-y-2"><span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Identifier type</span>
            <Select value={group.key === 'registration' || group.key === 'serial' ? group.key : 'other'} onValueChange={(kind) => {
              const used = new Set(value.identifiers.groups.map((item) => item.key))
              let number = 1
              while (used.has(`identifier${number}`)) number++
              updateGroups(value.identifiers.groups.map((item, position) => position === index ? {
                ...item,
                key: kind === 'other' ? `identifier${number}` : kind,
                label: kind === 'registration' ? 'Aircraft registration' : kind === 'serial' ? 'Aircraft serial number' : item.label,
              } : item))
            }} options={[
              { value: 'registration', label: 'Aircraft registration', disabled: value.identifiers.groups.some((item, position) => position !== index && item.key === 'registration') },
              { value: 'serial', label: 'Aircraft serial number', disabled: value.identifiers.groups.some((item, position) => position !== index && item.key === 'serial') },
              { value: 'other', label: 'Other identifier' },
            ]} />
          </label>
          <label className="flex-1 space-y-2"><span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Identifier name</span>
            <Input value={group.label ?? group.key} placeholder="e.g. Vehicle VIN" onChange={(event) => updateGroups(value.identifiers.groups.map((item, position) => position === index ? { ...item, label: event.target.value } : item))} />
          </label>
          <Button type="button" variant="ghost" size="sm" aria-label={`Remove ${group.label ?? group.key}`} onClick={() => updateGroups(value.identifiers.groups.filter((_, position) => position !== index))}><Trash2 className="h-4 w-4" /></Button>
        </div>
        <SourceEditor title={group.label || `Identifier ${index + 1}`} help="Choose the business rule whose saved answer or evidence contains the identifier itself. Evidence is useful when the answer only summarizes a document." sources={group.sources} rules={rules} onChange={(sources) => updateGroups(value.identifiers.groups.map((item, position) => position === index ? { ...item, sources } : item))} />
      </div>)}
    </Card>

    <Card className="space-y-6">
      <div><h3 className="text-lg font-bold">Policy period or renewal date</h3><p className="mt-1 text-sm text-muted-foreground">Use a start and end date together, a renewal date, or both. Exact ISO dates in answers and written month dates in evidence can be compared; unclear dates require manual review.</p></div>
      <div className="grid gap-6 lg:grid-cols-2">
        <SourceEditor title="Policy start date" help="First day of the policy period." sources={value.period.startSources} rules={rules} onChange={(sources) => updatePeriod('startSources', sources)} />
        <SourceEditor title="Policy end date" help="Last day of the policy period. Required when a start date is mapped." sources={value.period.endSources} rules={rules} onChange={(sources) => updatePeriod('endSources', sources)} />
      </div>
      <SourceEditor title="Renewal date" help="Used when a complete policy date range is unavailable." sources={value.period.renewalSources} rules={rules} onChange={(sources) => updatePeriod('renewalSources', sources)} />
    </Card>

    <Card className="space-y-3">
      <h3 className="text-lg font-bold">Review and save</h3>
      {valid ? <p role="status" className="text-sm text-success">Rule is ready. Save Product to write it to the parent product’s duplicate inquiry criteria field.</p>
        : <p role="alert" className="text-sm text-amber-800">Complete every identifier source and provide a full policy date range or a renewal date before saving.</p>}
      <details><summary className="cursor-pointer text-sm font-semibold text-primary">View generated JSON</summary><pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(value, null, 2)}</pre></details>
    </Card>
  </div>
}
