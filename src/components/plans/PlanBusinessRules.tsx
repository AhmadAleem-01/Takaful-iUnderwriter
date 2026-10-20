import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Check, ChevronDown, FileText, GitBranch, LoaderCircle, RefreshCw, ShieldCheck, X } from 'lucide-react'
import { getProductWorkspace } from '../../services/productWorkspaceService'
import { RULE_GROUPS, categorizeRule, type RuleGroup } from '../../lib/productRuleGroups'
import { useAsyncData } from '../../hooks/useAsyncData'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

const groupIcons = { 'Mandatory Field': Check, 'Required Document': FileText, Inclusion: ShieldCheck, Exclusion: X, Conditional: GitBranch } satisfies Record<RuleGroup, unknown>
const normalizeId = (value: string) => value.replace(/[{}]/g, '').trim().toLowerCase()

export function PlanBusinessRules({ productId, productName }: { productId: string; productName: string }) {
  const [refresh, setRefresh] = useState(0)
  const load = useAsyncData(() => productId ? getProductWorkspace(productId) : Promise.resolve(null), [productId, refresh])
  const ids = new Set((load.data?.associatedRuleIds ?? []).map(normalizeId))
  const linked = (load.data?.availableRules ?? []).filter((rule) => ids.has(normalizeId(rule.id)))

  return <Card className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-3"><h2 className="text-xl font-bold">Business Rules</h2>{!load.loading && !load.error ? <Badge variant="review">{linked.length}</Badge> : null}</div><p className="mt-1 text-sm text-muted-foreground">Underwriting rules inherited from {productName || 'the linked product'}, grouped by category.</p></div><div className="flex flex-wrap gap-2">{productId ? <Button type="button" variant="outline" size="sm" asChild><Link to={`/admin/products/${productId}/edit`}>View Product<ArrowUpRight className="h-3.5 w-3.5" /></Link></Button> : null}<Button type="button" variant="secondary" size="sm" disabled={!productId || load.loading} onClick={() => setRefresh((value) => value + 1)}><RefreshCw className={`h-3.5 w-3.5 ${load.loading ? 'animate-spin' : ''}`} />Refresh Rules</Button></div></div>
    {!productId ? <Empty title="No product linked" description="Select a linked product in Plan Details to view its business rules." /> : load.loading ? <p role="status" className="flex items-center gap-3 rounded-xl bg-surface-soft p-6 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin text-primary" />Loading linked business rules...</p> : load.error ? <div role="alert" className="space-y-3 rounded-xl border border-danger/20 bg-danger/5 p-4"><p className="text-sm text-danger">{load.error}</p><Button type="button" variant="outline" size="sm" onClick={() => setRefresh((value) => value + 1)}>Try Again</Button></div> : <>
      {load.data?.relationshipNotice ? <p className="rounded-xl border border-warning/20 bg-warning/10 p-4 text-sm">{load.data.relationshipNotice}</p> : null}
      {!linked.length ? <Empty title="No business rules associated" description="Rules associated with the linked product will appear here. Manage associations on the Product page." /> : <div className="space-y-4">{RULE_GROUPS.map((group) => {
        const rules = linked.filter((rule) => categorizeRule(rule.name, rule.context, rule.description) === group)
        const Icon = groupIcons[group]
        return <details key={group} className="group overflow-hidden rounded-[22px] border border-border-soft bg-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-[22px] px-5 py-4 outline-none transition hover:bg-primary/[0.04] focus-visible:ring-2 focus-visible:ring-primary/30 [&::-webkit-details-marker]:hidden"><span className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span><span><span className="block font-semibold">{group}</span><span className="block text-sm text-muted-foreground">{rules.length} linked rules in this category.</span></span></span><span className="flex items-center gap-3"><Badge variant="neutral">{rules.length}</Badge><ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" /></span></summary>
          <div className="border-t border-border-soft px-5 py-5">{rules.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{rules.map((rule) => <Card key={rule.id} className="space-y-3 rounded-[20px] bg-surface-soft/70 p-4 shadow-none"><div className="flex flex-wrap items-start justify-between gap-3"><p className="min-w-0 flex-1 text-sm font-semibold leading-5">{rule.name}</p><Badge variant="info">{group}</Badge></div><p className="whitespace-pre-line text-xs leading-5 text-muted-foreground">{rule.description}</p><span className="inline-block rounded-full border border-border-soft bg-surface px-3 py-1 text-xs text-muted-foreground">Inherited from Product</span></Card>)}</div> : <p className="text-sm text-muted-foreground">No linked rules in this category.</p>}</div>
        </details>
      })}</div>}
    </>}
  </Card>
}

function Empty({ title, description }: { title: string; description: string }) {
  return <div className="rounded-[22px] border border-dashed border-border bg-surface-soft/70 p-7 text-center"><GitBranch className="mx-auto h-7 w-7 text-primary" /><h3 className="mt-3 text-base font-semibold">{title}</h3><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{description}</p></div>
}
