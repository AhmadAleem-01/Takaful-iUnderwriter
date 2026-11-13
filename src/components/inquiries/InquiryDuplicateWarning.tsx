import { ChevronDown, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAsyncData } from '../../hooks/useAsyncData'
import type { InquiryDuplicateFinding } from '../../lib/inquiryDuplicates'
import { getInquiryDuplicateWarnings } from '../../services/inquiryDuplicatesService'

function ComparedIdentifiers({ finding }: { finding: InquiryDuplicateFinding }) {
  return <div className="mt-3 overflow-x-auto rounded-xl border border-current/15 bg-white/70 dark:bg-black/10">
    <table className="w-full min-w-[30rem] table-fixed text-left text-xs">
      <caption className="px-3 pt-3 text-left text-sm font-semibold">Identifier values used in this comparison</caption>
      <thead>
        <tr className="border-b border-current/15 text-muted-foreground">
          <th scope="col" className="w-1/4 px-3 py-2 font-semibold">Identifier</th>
          <th scope="col" className="w-1/3 px-3 py-2 font-semibold">This inquiry</th>
          <th scope="col" className="w-1/3 px-3 py-2 font-semibold">Related inquiry</th>
          <th scope="col" className="px-3 py-2 font-semibold">Comparison</th>
        </tr>
      </thead>
      <tbody>
        {finding.identifierComparisons.map((identifier) => <tr key={identifier.key} className="border-b border-current/10 last:border-b-0">
          <th scope="row" className="px-3 py-2 align-top font-medium">{identifier.label}</th>
          <td className="break-words px-3 py-2 align-top">{identifier.currentValues.length ? identifier.currentValues.join(', ') : <span className="text-muted-foreground">No value extracted</span>}</td>
          <td className="break-words px-3 py-2 align-top">{identifier.relatedValues.length ? identifier.relatedValues.join(', ') : <span className="text-muted-foreground">No value extracted</span>}</td>
          <td className="px-3 py-2 align-top font-medium">{identifier.matchedValues.length ? 'Match' : identifier.currentValues.length && identifier.relatedValues.length ? 'No overlap found' : 'Incomplete'}</td>
        </tr>)}
      </tbody>
    </table>
  </div>
}

function Finding({ finding }: { finding: InquiryDuplicateFinding }) {
  return <li className={`rounded-xl border p-3 ${finding.status === 'separate' ? 'border-slate-200' : 'border-amber-200'}`}>
    <div className="flex flex-wrap items-center gap-2">
      <Link className="font-semibold underline" to={`/inquiries/${encodeURIComponent(finding.id)}`}>{finding.label}</Link>
      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${finding.status === 'separate' ? 'border-slate-300' : 'border-amber-400'}`}>
        {finding.status === 'potentialDuplicate' ? 'Potential duplicate' : finding.status === 'manualReview' ? 'Manual review' : 'Separate'}
      </span>
    </div>
    <details className="group mt-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden">
        <ChevronDown aria-hidden="true" className="h-4 w-4 transition-transform group-open:rotate-180" />
        View inquiry details
      </summary>
      <div className="mt-3 border-t border-current/15 pt-3">
        {finding.brokerName && <p>Broker: {finding.brokerName}</p>}
        {finding.currentPriorityOn && <p className="mt-1">This inquiry: {new Date(finding.currentPriorityOn).toLocaleString('en')} ({finding.currentPrioritySource === 'email' ? 'received email' : 'inquiry created'})</p>}
        {finding.receivedOn && <p className="mt-1">Related inquiry: {new Date(finding.receivedOn).toLocaleString('en')} ({finding.receivedSource === 'email' ? 'received email' : 'inquiry created'})</p>}
        <p className="mt-2">{finding.reason}</p>
        <ComparedIdentifiers finding={finding} />
        {finding.status === 'potentialDuplicate' && finding.currentIsProvisionalPreferred !== null &&
          <p className="mt-3 font-medium">Provisional preference: {finding.currentIsProvisionalPreferred ? 'this inquiry' : finding.label}. Underwriter review may override this.</p>}
      </div>
    </details>
  </li>
}

export function InquiryDuplicateWarning({ inquiryId, refreshKey = 0 }: { inquiryId: string; refreshKey?: number }) {
  const { data, loading, error } = useAsyncData(() => getInquiryDuplicateWarnings(inquiryId), [inquiryId, refreshKey])
  if (loading) return <p role="status" className="text-xs text-muted-foreground">Checking for possible duplicate inquiries...</p>
  if (error) return <p role="status" className="text-sm text-amber-800">Duplicate check unavailable. {error}</p>
  if (!data || data.inquiryId !== inquiryId.replace(/[{}]/g, '').toLowerCase()) return null
  if (data.state !== 'ready') return <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">{data.message}</p>
  const findings = data.findings
  if (!findings.length) return null
  const potential = findings.some((finding) => finding.status === 'potentialDuplicate')
  const review = findings.some((finding) => finding.status === 'manualReview')
  const needsAttention = potential || review
  return <section role={needsAttention ? 'alert' : 'status'} className={`rounded-2xl border p-5 ${needsAttention ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-slate-200 bg-slate-50 text-slate-800'}`}>
    <div className="flex items-center gap-2 font-semibold">
      {needsAttention && <ShieldAlert aria-hidden="true" className="h-5 w-5" />}
      {potential ? 'Potential Duplicate Inquiry Detected' : review ? 'Duplicate inquiry review required' : 'Compared inquiries are separate'}
    </div>
    {potential ? <p className="mt-2 text-sm">An existing inquiry has been identified for the same insured and matching aircraft details. Please review the related inquiry, aircraft registration or serial number, broker, and policy period before proceeding.</p>
      : review ? <p className="mt-2 text-sm">An existing inquiry has been identified for the same insured, but the aircraft details or policy period need review. Please review the related inquiry, aircraft registration or serial number, broker, and policy period before proceeding.</p>
        : <p className="mt-2 text-sm">The compared inquiries have different risk details or policy periods. Open the inquiry details to review the comparison.</p>}
    <ul className="mt-3 space-y-3 text-sm">{findings.map((finding) => <Finding key={finding.id} finding={finding} />)}</ul>
  </section>
}
