import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, FileText, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import type { DocumentTemplateSummary } from '../../domain/app'
import { quotationDocumentHtml, renderQuotationTemplate, type QuotationTemplateContext } from '../../lib/quotationTemplate'
import { getQuotationTemplateContext, type QuotationValues } from '../../services/quotationTemplatesService'
import type { QuotePlanLinkedSection } from '../../services/quotesService'
import { getEmailTemplateFieldTables } from '../../services/emailTemplateFieldsService'
import { templateFieldLabel, templateFieldLabelMap } from '../../lib/templateFieldBadges'

interface Props {
  quoteId: string
  values: QuotationValues
  sections: QuotePlanLinkedSection[]
  sectionsLoading: boolean
  sectionsError: string | null
  templates: DocumentTemplateSummary[]
}

export function QuotationTemplateDialog(props: Props) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button type="button" variant="secondary" disabled={props.sectionsLoading}><FileText className="h-4 w-4" />Custom Template</Button>
      </Dialog.Trigger>
      {open ? <QuotationTemplateContent {...props} /> : null}
    </Dialog.Root>
  )
}

function QuotationTemplateContent({ quoteId, values, sections, sectionsLoading, sectionsError, templates }: Props) {
  const [templateId, setTemplateId] = useState('')
  const [context, setContext] = useState<QuotationTemplateContext | null>(null)
  const [fieldLabels, setFieldLabels] = useState<ReadonlyMap<string, string>>(() => new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [downloaded, setDownloaded] = useState(false)
  const selected = templates.find((template) => template.id === templateId)
  const selectedContent = selected?.content
  // Capture the visible quote values when the dialog opens. Closing and reopening refreshes them.
  const [snapshot] = useState(() => ({ quoteId, values, sections }))
  useEffect(() => {
    let active = true
    if (selectedContent === undefined) { setContext(null); setLoading(false); return }
    setLoading(true)
    setError(null)
    Promise.all([getQuotationTemplateContext(snapshot.quoteId, snapshot.values, snapshot.sections, selectedContent), getEmailTemplateFieldTables()]).then(
      ([result, tables]) => { if (active) { setContext(result); setFieldLabels(templateFieldLabelMap(tables)); setLoading(false) } },
      (cause) => { if (active) { setError(cause instanceof Error ? cause.message : 'Unable to load quote data.'); setLoading(false) } },
    )
    return () => { active = false }
  }, [snapshot, retry, selectedContent])
  const preview = useMemo(() => selected && context ? renderQuotationTemplate(selected.content, context) : null, [selected, context])
  const documentHtml = useMemo(() => preview ? quotationDocumentHtml(preview.html) : '', [preview])
  const blockedFields = [...(preview?.missingFields ?? []), ...(preview?.unsupportedFields ?? [])]
  const canDownload = Boolean(preview?.hasContent && !blockedFields.length && !loading && !error && !sectionsLoading && !sectionsError)

  async function download() {
    if (!canDownload || !preview || downloading) return
    setDownloading(true)
    setDownloadError(null)
    setDownloaded(false)
    try {
      const { downloadQuotationTemplatePdf } = await import('../../lib/quotationTemplatePdf')
      await downloadQuotationTemplatePdf(preview.html, snapshot.values.name)
      setDownloaded(true)
    } catch (cause) {
      setDownloadError(cause instanceof Error ? cause.message : 'Unable to download the quotation PDF.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm" />
      <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[94vh] w-[min(1100px,96vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl border border-border-soft bg-surface p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Dialog.Title className="text-xl font-semibold">Generate quotation from a template</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">Select a saved template to populate it with this quote's current values and linked records. Review the quotation before downloading.</Dialog.Description>
          </div>
          <Dialog.Close asChild><Button type="button" size="icon" variant="ghost" aria-label="Close quotation preview"><X className="h-4 w-4" /></Button></Dialog.Close>
        </div>
        <div className="mt-5 min-h-0 space-y-4 overflow-y-auto">
          <label className="block space-y-2"><span className="text-sm font-medium">Document template</span>
            <Select aria-label="Document template" value={templateId} onValueChange={(value) => { setTemplateId(value); setDownloadError(null); setDownloaded(false) }} placeholder="Select an active template" options={templates.map((template) => ({ value: template.id, label: template.name }))} disabled={downloading} />
          </label>
          {!templates.length ? <p className="text-sm text-muted-foreground">No active quotation templates are available. An administrator can select Quotes as the entity in <Link className="text-primary underline" to="/admin/document-templates">Document Templates</Link>, create and save an active template, then refresh this quote.</p> : null}
          {loading || sectionsLoading ? <p role="status" className="text-sm text-muted-foreground">Loading quotation data...</p> : null}
          {error ? <div role="alert" className="text-sm text-danger">{error} <Button type="button" size="sm" variant="ghost" onClick={() => setRetry((value) => value + 1)}>Retry</Button></div> : null}
          {sectionsError ? <p role="alert" className="text-sm text-danger">Plan details could not be loaded. Close this dialog and refresh the quote before generating.</p> : null}
          {selected && preview && !preview.hasContent ? <p role="alert" className="text-sm text-danger">This template is empty. Add content in Document Templates before generating a quotation.</p> : null}
          {blockedFields.length ? <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Some fields have no value or cannot be resolved for this quotation. Update the linked records or remove these fields from the template before downloading:<div className="mt-2 flex flex-wrap gap-2">{[...new Set(blockedFields)].map((token) => <span key={token} className="rounded-full border border-amber-300 px-2 py-1 text-xs font-semibold">{templateFieldLabel(token, fieldLabels)}</span>)}</div>{preview?.unsupportedFields.length ? <p className="mt-1">Placeholders must appear in the document text, rather than in links or formatting attributes.</p> : null}</div> : null}
          {preview && !loading && !error ? <>
            <p className="text-sm text-muted-foreground">{preview.resolvedCount} fields populated. PDF output uses A4 pages.</p>
            <div className="overflow-x-auto rounded-xl border border-border-soft bg-surface-soft p-3">
              <iframe title="Populated quotation preview" sandbox="" srcDoc={documentHtml} className="mx-auto h-[52vh] min-h-[300px] w-[794px] border-0 bg-white" />
            </div>
          </> : null}
          {downloadError ? <p role="alert" className="text-sm text-danger">{downloadError}</p> : null}
          {downloaded ? <p role="status" className="text-sm text-success">Quotation PDF downloaded.</p> : null}
        </div>
        <div className="mt-5 flex justify-end gap-3 border-t border-border-soft pt-4">
          <Dialog.Close asChild><Button type="button" variant="ghost">Close</Button></Dialog.Close>
          <Button type="button" disabled={!canDownload || downloading} onClick={() => void download()}><Download className="h-4 w-4" />{downloading ? 'Generating PDF...' : 'Download Quotation PDF'}</Button>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  )
}
