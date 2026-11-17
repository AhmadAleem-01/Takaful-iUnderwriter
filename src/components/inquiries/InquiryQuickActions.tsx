import { ArrowRight, ArrowUp, CircleX, LoaderCircle, Pencil, Save, Zap } from 'lucide-react'
import { Button } from '../ui/Button'

export type QuickInquiryDisposition = 'RefertoUnderwriter' | 'EscalatetoHeadofAviation' | 'Decline'

const actions = [
  { disposition: 'RefertoUnderwriter', label: 'Refer', icon: ArrowRight },
  { disposition: 'EscalatetoHeadofAviation', label: 'Escalate', icon: ArrowUp },
  { disposition: 'Decline', label: 'Decline', icon: CircleX },
] as const

export function InquiryQuickActions({ editing, busy, pendingAction, saving, onEdit, onSave, onCancel, onAction }: {
  editing: boolean
  busy: boolean
  pendingAction: string | null
  saving: boolean
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  onAction: (disposition: QuickInquiryDisposition) => void
}) {
  return (
    <section aria-label="Quick Actions" className="rounded-xl border border-border-soft bg-white p-4 dark:bg-surface">
      <div className="flex items-center gap-2.5"><Zap aria-hidden="true" className="h-[18px] w-[18px] text-primary dark:text-primary-light" /><h2 className="text-[16px] font-semibold text-foreground">Quick Actions</h2></div>
      <p className="mt-2 text-[12px] font-normal leading-5 text-muted-foreground">Take an immediate action on this inquiry.</p>
      <div className="mt-4 space-y-2">
        <Button type="button" variant="outline" className="h-10 w-full justify-start rounded-lg border-primary/15 px-3 text-[12px] font-normal text-primary hover:bg-primary/[0.04] dark:text-primary-light" disabled={busy || editing} onClick={onEdit}><Pencil aria-hidden="true" className="h-4 w-4" />{editing ? 'Editing Inquiry' : 'Edit Inquiry'}</Button>
        {editing ? <div aria-label="Inquiry editing controls" className="space-y-2">
          <Button type="button" disabled={busy} aria-busy={saving} onClick={onSave} className="h-10 w-full rounded-lg text-[12px] font-normal"><Save aria-hidden="true" className="h-4 w-4" />{saving ? 'Saving...' : 'Save Inquiry'}</Button>
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel} className="h-9 w-full rounded-lg text-[12px] font-normal">Cancel</Button>
          <p className="py-1 text-[12px] font-normal leading-5 text-muted-foreground">Selecting an action also saves your current changes.</p>
        </div> : null}
        {actions.map(({ disposition, label, icon: Icon }) => {
          const pending = pendingAction === 'quick:' + disposition
          const decline = disposition === 'Decline'
          return (
            <Button key={disposition} type="button" variant="outline" aria-busy={pending} disabled={busy} onClick={() => onAction(disposition)} className={'h-10 w-full justify-start rounded-lg border-border-soft px-3 text-[12px] font-normal ' + (decline ? 'text-danger hover:border-danger/20 hover:bg-danger/5' : 'text-primary hover:border-primary/20 hover:bg-primary/[0.04] dark:text-primary-light')}>
              <span aria-hidden="true" className={'flex h-6 w-6 shrink-0 items-center justify-center rounded-full ' + (decline ? 'bg-danger/10' : 'bg-primary/[0.08]')}>{pending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" /> : <Icon className="h-3.5 w-3.5" />}</span>
              {pending ? label + '...' : label}
            </Button>
          )
        })}
      </div>
    </section>
  )
}
