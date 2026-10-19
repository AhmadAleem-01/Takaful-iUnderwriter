import { useId, useRef, useState, type ReactNode } from 'react'
import { AlertCircle, BadgeCheck, ChevronDown, LayoutDashboard, RefreshCw, Sparkles, Users, Wallet } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Button } from '../ui/Button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs'
import { cn } from '../../lib/cn'
import { calculateMemberPremium, evaluationObject as object, evaluationRows as rows, evaluationText as text, memberEvaluationRows, parseHealthAiEvaluation, uniqueEvaluationRules, type EvaluationRecord } from '../../lib/healthAiEvaluation'

function money(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
    : 'Not available'
}

function Chip({ children, review = false }: { children: ReactNode; review?: boolean }) {
  return <span className={cn('inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium', review ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'bg-surface-soft text-muted-foreground')}>{children}</span>
}

function Rules({ items, evidence }: { items: EvaluationRecord[]; evidence: (value: string) => ReactNode }) {
  return items.length ? <div className="space-y-2">{items.map((rule, i) => {
    const review = rule.requiresInternalReview === true || text(rule.status, '').toLowerCase() === 'missing'
    const condition = text(rule.ConditionMet, 'Not determined')
    const confidence = Number.parseFloat(text(rule.confidenceScore, ''))
    return <details key={`${text(rule.ruleName)}-${i}`} className="group rounded-xl border border-border-soft bg-surface transition-colors open:border-secondary/25 open:bg-secondary/[0.02] hover:border-secondary/25 motion-reduce:transition-none">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl p-4 outline-none focus-visible:ring-2 focus-visible:ring-secondary/40 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1"><p className="text-[13px] font-medium leading-5">{text(rule.ruleName)}</p><p className="mt-1 text-[11px] text-muted-foreground">{text(rule.status)} · Condition {condition.toLowerCase()}</p></div>
        <div className="flex shrink-0 flex-col items-end gap-2"><Chip review={review}>{review ? 'Review required' : condition}</Chip>{Number.isFinite(confidence) ? <div className="w-20 space-y-1"><p className="text-right text-[10px] tabular-nums text-muted-foreground">{Math.min(100, Math.max(0, confidence))}% confidence</p><div aria-hidden="true" className="h-1 overflow-hidden rounded-full bg-secondary/10"><div className="h-full rounded-full bg-secondary/70" style={{ width: `${Math.min(100, Math.max(0, confidence))}%` }} /></div></div> : null}</div>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <div className="space-y-3 border-t border-border-soft p-4 text-left"><p className="text-[13px] leading-6">{text(rule.response)}</p>{text(rule.evidence, '') ? <div className="text-left text-xs leading-6 text-muted-foreground [&>div]:ml-1 [&>div]:align-middle">{text(rule.evidence)}{' '}{evidence(text(rule.evidence))}</div> : null}</div>
    </details>
  })}</div> : <Empty>No business rule evaluations are available.</Empty>
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-border-soft p-5 text-[13px] leading-6 text-muted-foreground">{children}</p>
}

function Premium({ data, policy = false, members = [] }: { data: EvaluationRecord; policy?: boolean; members?: EvaluationRecord[] }) {
  return <div className="space-y-4"><dl className="grid gap-3 sm:grid-cols-3">{[
    [policy ? 'Original Premium' : 'Base Premium', money(policy ? data.originalPremium : data.basePremium)],
    ['Additional Charges', `${typeof data.totalAdditionalPercentage === 'number' ? `${data.totalAdditionalPercentage}% · ` : ''}${money(data.totalAdditionalCharges)}`], ['Final Premium', money(data.finalPremium)],
  ].map(([label, value]) => <div key={label} className={cn('rounded-xl border p-4', label === 'Final Premium' ? 'border-secondary/20 bg-secondary/[0.06]' : 'border-border-soft bg-surface-soft/50')}><dt className="text-[11px] text-muted-foreground">{label}</dt><dd className={cn('mt-2 break-words text-[13px] font-semibold tabular-nums', label === 'Final Premium' && 'text-secondary')}>{value}</dd></div>)}</dl>
    {!policy && data.calculationStatus === 'NotAvailable' ? <p className="text-xs leading-5 text-muted-foreground">Individual pricing is unavailable. Any policy-level charges below belong to the overall policy and are not individual member premiums.</p> : null}
    {!policy && data.calculationStatus === 'CalculatedFromMemberBase' ? <p className="text-xs leading-5 text-muted-foreground">Member estimate: loadings are added together and calculated against this member's base premium without compounding. Policy pricing remains separate.</p> : null}
    {rows(data.additionalCharges).map((charge, i) => <div key={i} className="rounded-xl border border-border-soft p-4"><div className="flex items-start justify-between gap-4"><p className="text-[13px] font-medium leading-5">{text(charge.ruleName)}</p><span className="shrink-0 font-semibold text-secondary">{text(charge.percentage, '—')}%</span></div>{charge.reason ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{text(charge.reason)}</p> : null}<div className="mt-3 flex flex-wrap justify-between gap-2 text-xs"><span className="text-muted-foreground">{policy ? 'Policy-level charge' : text(charge.calculationScope, 'Calculation scope unavailable')}{Array.isArray(charge.triggeredByMemberIds) ? ` · ${charge.triggeredByMemberIds.map((id) => text(members.find((member) => member.memberId === id)?.memberName, String(id))).join(', ')}` : ''}</span><span>{money(charge.amount)}</span></div></div>)}
  </div>
}

export function HealthAiEvaluation({ value, loading, onReevaluate, renderEvidence }: { value?: string; loading?: boolean; onReevaluate: () => void; renderEvidence: (value: string) => ReactNode }) {
  const [view, setView] = useState('members')
  const [selected, setSelected] = useState<number | null>(null)
  const [detailTab, setDetailTab] = useState('rules')
  const scope = useId()
  const evaluationRef = useRef<HTMLDivElement>(null)
  const data = parseHealthAiEvaluation(value)
  const members = rows(data?.insuredMembers)
  const member = selected !== null ? members[selected] ?? {} : {}
  const rules = uniqueEvaluationRules(memberEvaluationRows(data?.memberBusinessRuleEvaluations, member))
  const reducedMotion = useReducedMotion()
  const premium = calculateMemberPremium(memberEvaluationRows(data?.memberPremiumBreakdown, member)[0] ?? {})
  const navClass = 'min-h-10 rounded-lg text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40 data-[state=active]:!bg-secondary/10 data-[state=active]:!text-secondary motion-reduce:transition-none'
  const overviewNavClass = 'min-h-10 rounded-lg text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40 data-[state=active]:!bg-secondary data-[state=active]:!text-white motion-reduce:transition-none'
  return (
    <section aria-labelledby={`${scope}-heading`} className="overflow-hidden rounded-2xl border border-border bg-surface">
      <header className="relative flex flex-wrap items-center justify-between gap-4 rounded-t-[23px] border-b border-border-soft bg-white px-5 py-5 dark:bg-surface sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-secondary/15 bg-surface text-secondary"><Sparkles className="h-5 w-5" /></span>
          <div><h2 id={`${scope}-heading`} className="text-sm font-semibold">AI Extracted Response</h2><p className="mt-1 text-[11px] text-muted-foreground">Health underwriting <span className="mx-1.5 text-border">/</span> {members.length} insured {members.length === 1 ? 'member' : 'members'}</p></div>
        </div>
        <Button type="button" size="sm" className="rounded-lg bg-secondary shadow-none hover:bg-secondary/90" onClick={onReevaluate}><RefreshCw className="h-3.5 w-3.5" />Re-evaluate AI Extraction</Button>
      </header>
      <div className="p-4 sm:p-6">
        {!data ? <Empty>{loading ? 'Loading health evaluation…' : value?.trim() ? 'The health evaluation could not be displayed. Please check the evaluation response or re-evaluate extraction.' : 'The health AI evaluation is not available yet.'}</Empty> : (
          <Tabs value={view} onValueChange={setView}>
            <TabsList aria-label="Health evaluation view" className="mb-5 rounded-xl border-0 bg-surface-muted/70 p-1">
              <TabsTrigger value="members" icon={Users} className={overviewNavClass}>Members <span className={cn('ml-1.5 rounded-md px-1.5 py-0.5 text-[10px] tabular-nums', view === 'members' ? 'bg-white/20 text-white' : 'bg-secondary/10 text-secondary')}>{members.length}</span></TabsTrigger>
              <TabsTrigger value="policy" icon={LayoutDashboard} className={overviewNavClass}>Policy Overview</TabsTrigger>
            </TabsList>
            <TabsContent value="members" className="outline-none">
              {!members.length ? <Empty>No insured members were included in this evaluation.</Empty> : (
                <Tabs value={selected === null ? '' : String(selected)} onValueChange={(next) => { setSelected(Number(next)); setDetailTab('rules') }}>
                  <p className="mb-3 text-xs text-muted-foreground">Select a member to explore their business rules and premium.</p>
                  <TabsList aria-label="Insured members" className="mb-5 !grid auto-rows-fr grid-cols-1 items-stretch gap-3 rounded-none border-0 bg-transparent p-0 sm:grid-cols-2 lg:grid-cols-3">
                    {members.map((item, i) => (
                      <TabsTrigger key={text(item.memberId, String(i))} value={String(i)}
                        onMouseDown={(event) => { if (selected === i && event.button === 0 && !event.ctrlKey) { event.preventDefault(); setSelected(null) } }}
                        onKeyDown={(event) => { if (selected === i && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setSelected(null) } }}
                        className="group h-full min-w-0 self-stretch items-stretch justify-start rounded-xl border border-border-soft px-4 py-4 text-left font-normal hover:bg-surface-soft data-[state=active]:!border-secondary/40 data-[state=active]:!bg-secondary/[0.06] data-[state=active]:!text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40 motion-reduce:transition-none [&>span]:flex [&>span]:h-full [&>span]:w-full [&>span]:flex-col [&>span]:items-start [&>span]:gap-3 [&>span]:whitespace-normal">
                        <span className="flex w-full items-center gap-3"><span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-[11px] font-semibold text-secondary group-data-[state=active]:bg-secondary group-data-[state=active]:text-white">{text(item.memberName, '?').split(/\s+/).map((part) => part[0]).slice(0, 2).join('')}</span>
                          <span className="min-w-0 flex-1"><span className="block break-words text-[12px] font-semibold">{text(item.memberName)}</span><span className="mt-1 block text-[10px] capitalize text-muted-foreground">{text(item.relationship)}{item.age !== undefined ? ` · Age ${text(item.age)}` : ''}</span></span>
                          {item.requiresInternalReview === true ? <AlertCircle aria-label="Review required" className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" /> : <BadgeCheck aria-label="No review flagged" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                        </span>
                        <span className="block text-[11px] leading-5 text-muted-foreground">{text(item.medicalSummary, 'No medical summary was supplied.')}</span>
                        {Array.isArray(item.declaredConditions) && item.declaredConditions.length ? <span className="flex flex-wrap gap-1.5">{item.declaredConditions.map((condition, n) => <span key={n} className="rounded-md border border-secondary/10 bg-surface px-2 py-1 text-[10px] text-foreground">{text(condition)}</span>)}</span> : null}
                        <span className="mt-auto flex w-full items-center justify-between border-t border-border-soft pt-3 text-[11px] font-medium text-secondary">{selected === i ? 'Collapse evaluation' : 'View evaluation'}<ChevronDown className={cn('h-3.5 w-3.5 transition-transform motion-reduce:transition-none', selected === i && 'rotate-180')} /></span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  <AnimatePresence mode="wait" initial={false}>
                  {selected !== null && members[selected] ? <motion.div ref={evaluationRef} key={text(member.memberId, String(selected))}
                    variants={{ collapsed: { height: 0, opacity: 0 }, expanded: { height: 'auto', opacity: 1 } }}
                    initial="collapsed" animate="expanded" exit="collapsed"
                    onAnimationComplete={(phase) => {
                      if (phase !== 'expanded' || !evaluationRef.current) return
                      const top = evaluationRef.current.getBoundingClientRect().top
                      const distance = Math.min(120, Math.max(0, top - window.innerHeight * 0.6))
                      if (distance > 0) window.scrollBy({ top: distance, behavior: reducedMotion ? 'instant' : 'smooth' })
                    }}
                    transition={{ duration: reducedMotion ? 0 : 0.25, ease: 'easeInOut' }} className="scroll-mt-28 overflow-hidden">
                    <TabsContent value={String(selected)} forceMount className="outline-none">
                    <div className="overflow-hidden rounded-xl border border-border-soft">
                      <div className="p-4 sm:p-5">
                        <Tabs value={detailTab} onValueChange={setDetailTab}>
                          <TabsList aria-label="Member evaluation details" className="mb-5 gap-1 rounded-lg border-0 bg-surface-soft p-1">
                            <TabsTrigger value="rules" icon={BadgeCheck} className={navClass}>Business Rules</TabsTrigger>
                            <TabsTrigger value="premium" icon={Wallet} className={navClass}>Premium</TabsTrigger>
                          </TabsList>
                          <TabsContent value="rules" className="space-y-3 outline-none"><div className="flex items-center justify-between gap-3"><h4 className="text-xs font-semibold">Business rule evaluations</h4><span className="rounded-md bg-surface-muted px-2 py-1 text-[10px] tabular-nums text-muted-foreground">{rules.length} findings</span></div><Rules items={rules} evidence={renderEvidence} /></TabsContent>
                          <TabsContent value="premium" className="outline-none"><Premium data={premium} /></TabsContent>
                        </Tabs>
                      </div>
                    </div>
                  </TabsContent></motion.div> : null}
                  </AnimatePresence>
                </Tabs>
              )}
            </TabsContent>
            <TabsContent value="policy" className="outline-none"><Policy data={data} members={members} /></TabsContent>
          </Tabs>
        )}
      </div>
    </section>
  )
}

function Policy({ data, members }: { data: EvaluationRecord; members: EvaluationRecord[] }) {
  const policy = object(data.policyPremiumBreakdown)
  return <div className="space-y-5">
    <section className="overflow-hidden rounded-xl border border-border-soft">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border-soft bg-white p-4 dark:bg-surface sm:px-5">
        <div className="flex items-center gap-3"><span className="rounded-lg border border-secondary/15 bg-surface p-2 text-secondary"><LayoutDashboard className="h-4 w-4" /></span><div><h3 className="text-sm font-semibold">Policy Evaluation Summary</h3><p className="mt-1 text-[11px] text-muted-foreground">An overview of the AI findings across insured members</p></div></div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-secondary/10 bg-surface px-2.5 py-1 text-[11px] text-secondary"><Users className="h-3.5 w-3.5" />{members.length} {members.length === 1 ? 'member' : 'members'}</span>
      </header>
      <p className="whitespace-pre-line p-4 text-[13px] leading-7 text-muted-foreground sm:p-5">{text(data.evaluationSummary, 'No policy summary was supplied.')}</p>
    </section>
    <section className="rounded-xl border border-border-soft p-4 sm:p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="rounded-lg bg-secondary/10 p-2 text-secondary"><Wallet className="h-4 w-4" /></span><div><h3 className="text-sm font-semibold">Policy Premium</h3><p className="mt-1 text-[11px] text-muted-foreground">Original premium, applied loadings and the evaluated total</p></div></div><span className="rounded-md bg-surface-muted px-2 py-1 text-[10px] text-muted-foreground">{rows(policy.additionalCharges).length} loading {rows(policy.additionalCharges).length === 1 ? 'rule' : 'rules'}</span></div>
      <Premium data={policy} policy members={members} />
    </section>
  </div>
}
