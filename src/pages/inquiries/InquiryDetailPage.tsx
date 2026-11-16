import { useParams } from 'react-router-dom'
import { FileStack, ArrowLeft, FileText, History, LayoutGrid } from 'lucide-react'
import { useAsyncData } from '../../hooks/useAsyncData'
import { getInquiryDetail } from '../../services/inquiriesService'
import { Card } from '../../components/ui/Card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs'
import { Badge } from '../../components/ui/Badge'
import { QuoteStatusBadge } from '../../components/quotes/QuoteStatusBadge'
import { Button } from '../../components/ui/Button'
import { formatCurrency, formatDate, formatPercent } from '../../lib/formatters'
import { parseAiSummary } from '../../lib/aiResponsePresentation'
import { Link } from 'react-router-dom'

export function InquiryDetailPage() {
  const { id = '' } = useParams()
  const { data, loading, error } = useAsyncData(() => getInquiryDetail(id), [id])

  if (loading) {
    return <Card>Loading inquiry workspace...</Card>
  }

  if (error || !data) {
    return <Card>{error ?? 'Inquiry not found.'}</Card>
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/inquiries">
          <ArrowLeft className="h-4 w-4" />
          Back to inquiries
        </Link>
      </Button>

      <Card variant="premium" className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="new">{data.inquiryNumber}</Badge>
              <Badge variant="review">{data.inquiryType}</Badge>
              <Badge variant="pending">{data.status}</Badge>
            </div>
            <div>
              <h1 className="text-[30px] font-bold">{data.name}</h1>
              <p className="text-sm text-muted-foreground">
                {data.productName} · {data.planName} · {formatDate(data.createdOn)}
              </p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {data.readiness.map((item) => (
              <Card key={item.label} className="min-w-[220px]">
                <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  {item.label}
                </p>
                <div className="mt-3 flex items-end justify-between">
                  <p className="text-3xl font-bold">{formatPercent(item.value)}</p>
                  <div className="h-2 w-24 rounded-full bg-surface-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${item.value}%` }}
                    />
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
              </Card>
            ))}
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-4">
          <MetricCard label="Declared Value" value={formatCurrency(data.declaredValue)} />
          <MetricCard label="Gross Premium" value={formatCurrency(data.grossPremium)} />
          <MetricCard label="Fee" value={formatCurrency(data.fee)} />
          <MetricCard label="Total Charge" value={formatCurrency(data.totalCharge)} />
        </div>
      </Card>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details" icon={LayoutGrid}>Details</TabsTrigger>
          <TabsTrigger value="ai" icon={FileStack}>AI Extracted Response</TabsTrigger>
          <TabsTrigger value="quotes" icon={FileText}>Quotes</TabsTrigger>
          <TabsTrigger value="history" icon={History}>History</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="mt-4">
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="space-y-4">
              <h3 className="text-xl font-semibold">Underwriting Summary</h3>
              <p className="text-sm leading-7 text-muted-foreground">{data.summary}</p>
              <div className="grid gap-4 md:grid-cols-2">
                <MetricCard label="Account" value={data.accountName} />
                <MetricCard label="Contact" value={data.contactName} />
                <MetricCard label="Broker" value={data.brokerName} />
                <MetricCard label="Risk Score" value={String(data.riskScore)} />
                <MetricCard label="Payment Term" value={data.paymentTerm} />
                <MetricCard label="Territorial Scope" value={data.territorialScope} />
              </div>
            </Card>
            <Card className="space-y-4">
              <h3 className="text-xl font-semibold">Relationship Context</h3>
              <RelatedCard label="Account" value={data.account?.name ?? 'No account linked'} />
              <RelatedCard label="Contact" value={data.contact?.name ?? 'No contact linked'} />
              <RelatedCard label="Broker" value={data.broker?.name ?? 'No broker linked'} />
              <RelatedCard label="SharePoint" value={data.sharepointUrl || 'No document URL linked'} />
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="ai" className="mt-4">
          <Card className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/12 text-secondary">
                <FileStack className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">AI Extracted Response</h3>
                <p className="text-sm text-muted-foreground">
                  Existing Dataverse summary, response evidence, and rule context.
                </p>
              </div>
            </div>
            <p className="text-sm leading-7 text-muted-foreground">{parseAiSummary(data.aiSummary).summary}</p>
            <div className="space-y-3">
              {data.quoteDetails.map((item) => (
                <Card key={item.id} className="bg-surface-soft">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold">{item.businessRuleName}</p>
                      <p className="text-sm text-muted-foreground">{item.response}</p>
                    </div>
                    <Badge variant="info">{item.conditionMet}</Badge>
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="quotes" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {data.quotes.map((quote) => (
              <Card key={quote.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{quote.name}</h3>
                  <QuoteStatusBadge status={quote.status} statusCode={quote.quoteStatusValue} />
                </div>
                <p className="text-sm text-muted-foreground">{parseAiSummary(quote.aiSummary).summary}</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <MetricCard label="Plan" value={quote.planName} />
                  <MetricCard label="Premium" value={formatCurrency(quote.totalPremium)} />
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <Card className="space-y-3">
            <h3 className="text-xl font-semibold">History</h3>
            <p className="text-sm text-muted-foreground">
              This first wave keeps the history timeline read-first. Save/update workflow actions will be added in the next implementation wave.
            </p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border-soft bg-surface-soft p-4">
      <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-base font-semibold">{value}</p>
    </div>
  )
}

function RelatedCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border-soft bg-surface-soft p-4">
      <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium">{value}</p>
    </div>
  )
}
