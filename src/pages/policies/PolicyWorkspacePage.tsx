import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowLeft, BellRing, FileStack, FileText, Link2, NotebookPen, Save, ShieldCheck } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs'
import { useAsyncData } from '../../hooks/useAsyncData'
import { formatCurrency, formatDate, formatRelativeDays } from '../../lib/formatters'
import { getPolicyWorkspace, savePolicyWorkspace } from '../../services/policiesService'

interface PolicyFormState {
  issueDate: string
  expiryDate: string
  premiumAmount: string
  reminderSent: boolean
  notes: string
}

export function PolicyWorkspacePage() {
  const { id = '' } = useParams()
  const [refreshKey, setRefreshKey] = useState(0)
  const [form, setForm] = useState<PolicyFormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const { data, loading, error } = useAsyncData(() => getPolicyWorkspace(id), [id, refreshKey])

  useEffect(() => {
    if (!data) return
    setForm({
      issueDate: data.issueDate.slice(0, 10),
      expiryDate: data.expiryDate.slice(0, 10),
      premiumAmount: String(data.premiumAmount || 0),
      reminderSent: data.reminderSent,
      notes: data.notes,
    })
  }, [data])

  if (loading) return <Card>Loading policy workspace...</Card>
  if (error || !data || !form) return <Card>{error ?? 'Policy not found.'}</Card>

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form) return
    const currentForm = form
    try {
      setSaving(true)
      setSaveError(null)
      await savePolicyWorkspace(id, {
        issueDate: currentForm.issueDate,
        expiryDate: currentForm.expiryDate,
        premiumAmount: Number(currentForm.premiumAmount) || 0,
        reminderSent: currentForm.reminderSent,
        notes: currentForm.notes,
      })
      setRefreshKey((value) => value + 1)
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Unable to save policy.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/renewals">
          <ArrowLeft className="h-4 w-4" />
          Back to renewals
        </Link>
      </Button>

      <Card variant="premium" className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="new">{data.policyNumber}</Badge>
              <Badge variant="info">{data.productName}</Badge>
              <Badge variant={data.reminderSent ? 'approved' : 'pending'}>
                {data.reminderSent ? 'Reminder Sent' : data.status}
              </Badge>
            </div>
            <div>
              <h1 className="text-[30px] font-bold">{data.customerName}</h1>
              <p className="text-sm text-muted-foreground">
                Policy workspace for issued coverage, renewal actions, and linked inquiry records.
              </p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard label="Premium" value={formatCurrency(data.premiumAmount)} />
            <MetricCard label="Expiry" value={formatDate(data.expiryDate)} />
            <MetricCard label="Remaining" value={formatRelativeDays(data.daysRemaining)} />
          </div>
        </div>
        <div className="grid gap-3 xl:grid-cols-4">
          <StatusCard label="Reminder Count" value={String(data.reminderCount)} helper="Recorded reminder outcomes against the linked inquiry." />
          <StatusCard label="Reminder Flag" value={data.reminderSent ? 'Yes' : 'No'} helper="Operational servicing signal on the policy record." />
          <StatusCard label="Issued On" value={formatDate(data.issueDate)} helper="Original policy issue date from Dataverse." />
          <StatusCard label="Current Status" value={data.status} helper="Current Dataverse policy status." />
        </div>
      </Card>

      <form onSubmit={handleSave} className="space-y-6">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview" icon={FileText}>Overview</TabsTrigger>
            <TabsTrigger value="servicing" icon={ShieldCheck}>Servicing</TabsTrigger>
            <TabsTrigger value="linked-records" icon={Link2}>Linked Records</TabsTrigger>
            <TabsTrigger value="notes" icon={NotebookPen}>Notes</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <Card className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl font-semibold">Policy Overview</h3>
                  <Button type="submit" disabled={saving}>
                    <Save className="h-4 w-4" />
                    {saving ? 'Saving...' : 'Save Policy'}
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Customer Name">
                    <Input value={data.customerName} readOnly />
                  </Field>
                  <Field label="Customer Email">
                    <Input value={data.customerEmail} readOnly />
                  </Field>
                  <Field label="Customer Phone">
                    <Input value={data.customerPhone} readOnly />
                  </Field>
                  <Field label="Status">
                    <Input value={data.status} readOnly />
                  </Field>
                  <Field label="Issue Date">
                    <Input type="date" value={form.issueDate} onChange={(event) => setForm({ ...form, issueDate: event.target.value })} />
                  </Field>
                  <Field label="Expiry Date">
                    <Input type="date" value={form.expiryDate} onChange={(event) => setForm({ ...form, expiryDate: event.target.value })} />
                  </Field>
                  <Field label="Premium Amount">
                    <Input value={form.premiumAmount} onChange={(event) => setForm({ ...form, premiumAmount: event.target.value })} />
                  </Field>
                  <label className="flex items-center gap-3 rounded-[14px] border border-border-soft bg-surface-soft px-4 py-3 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={form.reminderSent}
                      onChange={(event) => setForm({ ...form, reminderSent: event.target.checked })}
                    />
                    Reminder sent flag
                  </label>
                </div>
                {saveError ? <p className="text-sm text-danger">{saveError}</p> : null}
              </Card>
              <Card className="space-y-4">
                <h3 className="text-xl font-semibold">Coverage Context</h3>
                <MetricCard label="Policy Number" value={data.policyNumber} />
                <MetricCard label="Product" value={data.productName} />
                <MetricCard label="Days Remaining" value={formatRelativeDays(data.daysRemaining)} />
                <MetricCard label="Premium" value={formatCurrency(data.premiumAmount)} />
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="servicing" className="mt-4">
            <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
              <Card className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/12 text-warning">
                    <BellRing className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">Renewal Servicing</h3>
                    <p className="text-sm text-muted-foreground">
                      Keep reminder state and servicing notes aligned to the live policy record.
                    </p>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <StatusCard label="Reminder Sent" value={form.reminderSent ? 'Yes' : 'No'} helper="Operational renewal communication state." />
                  <StatusCard label="Reminder Results" value={String(data.reminderCount)} helper="Logged reminder-type outcomes from related consequence results." />
                </div>
                <Button
                  type="button"
                  variant={form.reminderSent ? 'secondary' : 'primary'}
                  onClick={() => setForm({ ...form, reminderSent: !form.reminderSent })}
                >
                  {form.reminderSent ? 'Clear Reminder Flag' : 'Mark Reminder Sent'}
                </Button>
              </Card>
              <Card className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/12 text-success">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">Servicing Guidance</h3>
                    <p className="text-sm text-muted-foreground">
                      This workspace can now hold live policy state while renewals remain linked to inquiry and quote context.
                    </p>
                  </div>
                </div>
                <p className="text-sm leading-7 text-muted-foreground">
                  Use this page to keep policy dates, premium, notes, and reminder state aligned. Customer contact details come from the linked Account record.
                </p>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="linked-records" className="mt-4">
            <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
              <Card className="space-y-4">
                <div className="flex items-center gap-3">
                  <FileStack className="h-5 w-5 text-primary" />
                  <h3 className="text-xl font-semibold">Linked Inquiry</h3>
                </div>
                <MetricCard label="Inquiry" value={data.inquiryName ?? 'No inquiry linked'} />
                {data.inquiryId ? (
                  <Button variant="secondary" asChild>
                    <Link to={`/inquiries/${data.inquiryId}`}>Open Inquiry Workspace</Link>
                  </Button>
                ) : null}
              </Card>
              <Card className="space-y-4">
                <div className="flex items-center gap-3">
                  <FileStack className="h-5 w-5 text-info" />
                  <h3 className="text-xl font-semibold">Linked Quote</h3>
                </div>
                <MetricCard label="Quote" value={data.quoteName ?? 'No quote linked'} />
                {data.quoteId ? (
                  <Button variant="outline" asChild>
                    <Link to={`/quotes/${data.quoteId}/edit`}>Open Quote Workbench</Link>
                  </Button>
                ) : null}
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="notes" className="mt-4">
            <Card className="space-y-4">
              <h3 className="text-xl font-semibold">Servicing Notes</h3>
              <textarea
                className="form-field-surface min-h-40 w-full rounded-[16px] border border-border px-3 py-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder="Capture renewal servicing notes, exceptions, or policy commentary."
              />
            </Card>
          </TabsContent>
        </Tabs>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border-soft bg-surface-soft p-4">
      <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-base font-semibold">{value}</p>
    </div>
  )
}

function StatusCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <Card className="space-y-3 bg-surface-soft">
      <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground">{helper}</p>
    </Card>
  )
}
