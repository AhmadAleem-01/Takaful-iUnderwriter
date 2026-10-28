import * as Dialog from '@radix-ui/react-dialog'
import { Bug, CheckCircle2, Link2, LoaderCircle, RefreshCw, Unlink, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../ui/Button'
import {
  createTakafulM2MRequest,
  MAX_TAKAFUL_M2M_RELATED_IDS,
  parseRelatedIds,
  runTakafulM2MOperation,
  type TakafulM2MContext,
  type TakafulM2MOperation,
  type TakafulM2MRecord,
  type TakafulM2MRequestPayload,
  type TakafulM2MResult,
} from '../../services/takafulM2MDebugger'

const OPERATIONS: Array<{
  id: TakafulM2MOperation
  title: string
  description: string
  Icon: typeof RefreshCw
}> = [
  { id: 'Retrieve', title: 'Retrieve', description: 'Read current links', Icon: RefreshCw },
  { id: 'Associate', title: 'Associate', description: 'Add links', Icon: Link2 },
  { id: 'Disassociate', title: 'Disassociate', description: 'Remove links', Icon: Unlink },
]

const PARAMETER_HELP: Array<[keyof TakafulM2MRequestPayload, string]> = [
  ['Operation', 'Retrieve, Associate, or Disassociate.'],
  ['RelationshipName', 'The many-to-many relationship schema name.'],
  ['TargetTable', 'Logical name of the target table.'],
  ['TargetId', 'GUID of one target row; optional for Retrieve all and required for mutations.'],
  ['TargetColumnsJson', 'JSON string array of target-table columns; [] uses the target primary ID and name.'],
  ['RelatedIdsJson', 'JSON string array of related-row GUIDs; [] for Retrieve; maximum 100.'],
  ['PageSize', 'Retrieve page size (100, within the API range of 1–500).'],
  ['PageNumber', 'Retrieve page number (1 for this request).'],
  ['PagingCookie', 'Empty on page 1; later pages use the prior response cookie.'],
  ['ColumnsJson', 'JSON string array of related table columns requested.'],
]

const PARAMETER_TYPES: Record<keyof TakafulM2MRequestPayload, string> = {
  Operation: 'String',
  RelationshipName: 'String',
  TargetTable: 'String',
  TargetId: 'Optional Guid',
  TargetColumnsJson: 'String',
  RelatedIdsJson: 'String',
  PageSize: 'Integer (Int32)',
  PageNumber: 'Integer (Int32)',
  PagingCookie: 'String',
  ColumnsJson: 'String',
}

export function TakafulM2MDebugger() {
  const [open, setOpen] = useState(false)
  const [operation, setOperation] = useState<TakafulM2MOperation>('Retrieve')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TakafulM2MResult | null>(null)
  const [lastRequest, setLastRequest] = useState<TakafulM2MRequestPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [relatedIdsInput, setRelatedIdsInput] = useState('')
  const [selectedRelatedIds, setSelectedRelatedIds] = useState<string[]>([])
  const [confirmationIds, setConfirmationIds] = useState<string[]>([])
  const [confirming, setConfirming] = useState(false)
  const [targetTable, setTargetTable] = useState('')
  const [targetId, setTargetId] = useState('')
  const [relationshipName, setRelationshipName] = useState('')
  const [targetColumnsInput, setTargetColumnsInput] = useState('')
  const [relatedColumnsInput, setRelatedColumnsInput] = useState('')
  const [pageSize, setPageSize] = useState(100)
  const context: TakafulM2MContext = {
    targetTable,
    targetId,
    relationshipName,
    targetColumns: parseColumnNames(targetColumnsInput),
    relatedColumns: parseColumnNames(relatedColumnsInput),
  }

  const parsedInput = safelyParseIds(relatedIdsInput)
  const operationIds = uniqueIds([...selectedRelatedIds, ...parsedInput.ids])
  const tooManyRelatedIds = operationIds.length > MAX_TAKAFUL_M2M_RELATED_IDS
  const requestPreview = parsedInput.error || tooManyRelatedIds
    ? null
    : createRequestPreview(operation, context, operation === 'Retrieve' ? [] : operationIds, pageSize)
  const records = result?.records ?? []

  async function execute(
    operationToRun: TakafulM2MOperation,
    relatedIds: string[] = [],
    paging: { pageNumber?: number; pagingCookie?: string } = {},
  ) {
    setLoading(true)
    setError(null)
    setSuccessMessage(null)
    setConfirming(false)

    try {
      const response = await runTakafulM2MOperation(operationToRun, context, relatedIds, {
        pageSize,
        pageNumber: paging.pageNumber,
        pagingCookie: paging.pagingCookie,
      })
      setLastRequest(response.request)
      setResult(response.result)

      if (operationToRun !== 'Retrieve') {
        setSuccessMessage(`${operationToRun} completed successfully.`)
        setSelectedRelatedIds([])
        setRelatedIdsInput('')

        try {
          const refreshed = await runTakafulM2MOperation('Retrieve', context)
          setResult(refreshed.result)
          setSuccessMessage(`${operationToRun} completed and the relationship list was refreshed.`)
        } catch (refreshError) {
          setError(`The change succeeded, but refreshing the relationship list failed: ${getErrorMessage(refreshError)}`)
        }
      }
    } catch (requestError) {
      console.error(`[M2M debugger] ${operationToRun} request failed:`, requestError)
      setError(getErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) {
      setOperation('Retrieve')
      setConfirmationIds([])
      setSelectedRelatedIds([])
      setRelatedIdsInput('')
    }
  }

  function chooseOperation(nextOperation: TakafulM2MOperation) {
    setOperation(nextOperation)
    setError(null)
    setSuccessMessage(null)
    setConfirming(false)
    setConfirmationIds([])
    setSelectedRelatedIds([])
    setRelatedIdsInput('')

  }

  function beginMutationReview() {
    if (!isGuid(targetId)) {
      setError('Enter a valid target record GUID before associating or disassociating rows.')
      return
    }
    if (parsedInput.error) {
      setError(parsedInput.error)
      return
    }

    if (!operationIds.length) {
      setError('Select or enter at least one related record ID.')
      return
    }
    if (tooManyRelatedIds) {
      setError(`Select no more than ${MAX_TAKAFUL_M2M_RELATED_IDS} related records per operation.`)
      return
    }

    setError(null)
    setConfirmationIds(operationIds)
    setConfirming(true)
  }

  function toggleSelectedId(id: string) {
    setSelectedRelatedIds((current) => (
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    ))
    setError(null)
    setConfirming(false)
  }

  const confirmationLabel = operation === 'Associate' ? 'Associate records' : 'Disassociate records'

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Open many-to-many debugger"
          className="h-10 gap-2 rounded-full border-border-soft bg-white px-3 text-foreground shadow-soft hover:border-primary/30 hover:bg-surface-muted dark:border-white/10 dark:bg-surface dark:hover:bg-surface-soft"
        >
          <Bug className="h-4 w-4 text-primary" />
          <span className="hidden sm:inline">M2M debugger</span>
        </Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-slate-950/60 backdrop-blur-[3px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[91] flex max-h-[min(90vh,900px)] w-[min(1040px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-surface text-foreground shadow-2xl focus:outline-none">
          <header className="flex items-start justify-between gap-4 border-b border-border-soft px-5 py-4 sm:px-6">
            <div className="flex min-w-0 items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-primary/20">
                <Bug className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <Dialog.Title className="text-base font-semibold tracking-tight sm:text-lg">
                  Many-to-many relationship debugger
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  Configure the target and relationship. Choose columns for each side independently.
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close debugger"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </header>

          <div className="grid gap-2 border-b border-border-soft bg-surface-muted/60 px-5 py-3 text-xs sm:grid-cols-3 sm:px-6">
            <ContextValue label="Target table" value={targetTable || 'Not set'} />
            <ContextValue label="Target record ID" value={targetId || 'All rows (Retrieve)'} />
            <ContextValue label="Relationship" value={relationshipName || 'Not set'} />
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6" aria-busy={loading}>
            <section className="grid gap-3 rounded-xl border border-border-soft p-4 sm:grid-cols-2">
              <TextInput label="Target table logical name" placeholder="e.g. account or aur_products" value={targetTable} onChange={setTargetTable} />
              <TextInput label="Target record GUID (optional for Retrieve)" placeholder="Blank retrieves all rows" value={targetId} onChange={setTargetId} />
              <TextInput label="Many-to-many relationship schema name" placeholder="e.g. account_contact" value={relationshipName} onChange={setRelationshipName} />
              <TextInput label="Target table columns (optional)" placeholder="aur_name, statecode" value={targetColumnsInput} onChange={setTargetColumnsInput} />
              <TextInput label="Related table columns (optional)" placeholder="name, statuscode" value={relatedColumnsInput} onChange={setRelatedColumnsInput} />
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Page size (1–500)</span><input type="number" min={1} max={500} value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="form-field-surface w-full rounded-xl border border-border-soft px-3 py-2.5 font-mono text-xs text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15" /></label>
              <p className="text-xs leading-relaxed text-muted-foreground sm:col-span-2">Use Dataverse logical names. Blank or [] column lists request each table’s primary ID and name. Leave TargetId blank to retrieve target rows with nested related rows; mutations require one valid target GUID.</p>
              <div className="sm:col-span-2"><Button type="button" variant="primary" size="sm" disabled={loading || !canBuildContext(context)} onClick={() => void execute('Retrieve')}><RefreshCw className="h-3.5 w-3.5" /> {targetId.trim() ? 'Retrieve related rows' : 'Retrieve all rows and relationships'}</Button></div>
            </section>
            <div className="grid grid-cols-1 gap-2 rounded-xl border border-border-soft bg-surface-muted/40 p-2 sm:grid-cols-3" role="group" aria-label="Choose custom API operation">
              {OPERATIONS.map(({ id, title, description, Icon }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={operation === id}
                  onClick={() => chooseOperation(id)}
                  disabled={loading}
                  className={`flex min-h-14 items-center gap-3 rounded-lg px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60 ${
                    operation === id
                      ? 'bg-primary text-white shadow-soft'
                      : 'text-foreground hover:bg-surface-muted'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${operation === id ? 'text-white' : 'text-primary'}`} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{title}</span>
                    <span className={`block text-[11px] ${operation === id ? 'text-white/75' : 'text-muted-foreground'}`}>
                      {description}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            {operation === 'Associate' || operation === 'Disassociate' ? (
              <section className="space-y-3 rounded-xl border border-border-soft p-4">
                <div>
                  <h3 className="text-sm font-semibold">
                    {operation === 'Associate' ? 'Related row IDs to add' : 'Related row IDs to remove'}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {operation === 'Associate'
                      ? 'Paste related row GUIDs, separated by commas or new lines. This links existing rows; it does not create them.'
                      : 'Select related rows below, or paste GUIDs. This removes links only; it does not delete rows.'}
                  </p>
                </div>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Related row GUIDs</span>
                  <textarea
                    value={relatedIdsInput}
                    onChange={(event) => {
                      setRelatedIdsInput(event.target.value)
                      setError(null)
                      setConfirming(false)
                    }}
                    rows={3}
                    placeholder="Paste GUIDs here, one per line"
                    className="form-field-surface w-full resize-y rounded-xl border border-border-soft px-3 py-2.5 font-mono text-xs text-foreground outline-none transition placeholder:font-sans placeholder:text-muted-foreground/70 focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
                    aria-describedby="m2m-id-help"
                  />
                </label>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <p id="m2m-id-help" className={parsedInput.error ? 'text-danger' : 'text-muted-foreground'}>
                    {parsedInput.error ?? (tooManyRelatedIds
                      ? `Choose no more than ${MAX_TAKAFUL_M2M_RELATED_IDS} GUIDs in total.`
                      : `Maximum ${MAX_TAKAFUL_M2M_RELATED_IDS} GUIDs per operation.`)}
                  </p>
                  <p className="font-medium text-foreground">
                    {operationIds.length} selected
                    {operation === 'Disassociate' && selectedRelatedIds.length
                      ? ` (${selectedRelatedIds.length} selected from retrieved rows)`
                      : ''}
                  </p>
                </div>
              </section>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-soft bg-surface-muted/30 px-4 py-3">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Retrieve reads the configured target row’s current relationship links. It does not change relationships.
                </p>
                <Button type="button" variant="outline" size="sm" disabled={loading || !canBuildContext(context)} onClick={() => void execute('Retrieve')}>
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh links
                </Button>
              </div>
            )}

            {confirming ? (
              <div className={`rounded-xl border p-4 ${operation === 'Disassociate' ? 'border-amber-300 bg-amber-50/70 dark:border-amber-300/25 dark:bg-amber-300/5' : 'border-primary/20 bg-primary/5'}`}>
                <p className="text-sm font-semibold">Review {operation.toLowerCase()}</p>
                <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                  {confirmationIds.length} related {confirmationIds.length === 1 ? 'row' : 'rows'} for {targetTable} {targetId}
                </p>
                <ul className="mt-3 max-h-28 space-y-1 overflow-y-auto rounded-lg border border-border-soft bg-surface/80 p-3 text-xs">
                  {confirmationIds.map((id) => {
                    const record = records.find((item) => item.id?.toLowerCase() === id.toLowerCase())
                    const name = record && Object.entries(getRecordAttributes(record)).find(([key]) => /name/i.test(key))?.[1]
                    return (
                      <li key={id} className="break-all">
                        {name ? <span className="mr-2 font-medium">{String(name)}</span> : null}
                        <code className="font-mono text-[11px] text-muted-foreground">{id}</code>
                      </li>
                    )
                  })}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={operation === 'Disassociate' ? 'destructive' : 'primary'}
                    size="sm"
                    disabled={loading}
                    onClick={() => void execute(operation, confirmationIds)}
                  >
                    {operation === 'Associate' ? <Link2 className="h-3.5 w-3.5" /> : <Unlink className="h-3.5 w-3.5" />}
                    Confirm {confirmationLabel}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={loading}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : operation !== 'Retrieve' ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant={operation === 'Disassociate' ? 'destructive' : 'primary'}
                  size="sm"
                  disabled={loading || parsedInput.error != null || tooManyRelatedIds || operationIds.length === 0}
                  onClick={beginMutationReview}
                >
                  {operation === 'Associate' ? <Link2 className="h-3.5 w-3.5" /> : <Unlink className="h-3.5 w-3.5" />}
                  Review {operation === 'Associate' ? 'association' : 'disassociation'}
                </Button>
                <p className="text-[11px] text-muted-foreground">No relationship change is sent until you confirm.</p>
              </div>
            ) : null}

            {requestPreview ? <RequestDetails request={requestPreview} /> : (
              <div className="rounded-xl border border-amber-300/60 bg-amber-50/60 px-4 py-3 text-xs text-amber-900 dark:border-amber-300/20 dark:bg-amber-300/5 dark:text-amber-200">
                Fix the related record IDs to preview a valid request body.
              </div>
            )}

            {loading ? (
              <div className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-xl border border-border-soft text-center" role="status" aria-live="polite">
                <LoaderCircle className="h-6 w-6 animate-spin text-primary motion-reduce:animate-none" />
                <div>
                  <p className="text-sm font-semibold">Sending {operation} request</p>
                  <p className="mt-1 text-xs text-muted-foreground">Waiting for the Dataverse custom API.</p>
                </div>
              </div>
            ) : null}

            {successMessage ? (
              <div role="status" aria-live="polite" className="flex items-start gap-2 rounded-xl border border-emerald-300/60 bg-emerald-50/70 p-3 text-sm text-emerald-800 dark:border-emerald-300/20 dark:bg-emerald-300/5 dark:text-emerald-200">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{successMessage}</p>
              </div>
            ) : null}

            {error ? (
              <div role="alert" className="rounded-xl border border-danger/25 bg-danger/5 p-4">
                <p className="text-sm font-semibold text-danger">Request issue</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">{error}</p>
                {operation === 'Retrieve' ? (
                  <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => void execute('Retrieve')}>
                    Retry retrieval
                  </Button>
                ) : null}
              </div>
            ) : null}

            {result ? (
              <section className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {result.operation || 'Retrieved'}
                  </span>
                  <span className="rounded-full bg-surface-muted px-3 py-1.5 text-xs text-foreground">
                    {result.count} {result.count === 1 ? 'row' : 'rows'} on page {result.pageNumber}
                  </span>
                  <span className="rounded-full bg-surface-muted px-3 py-1.5 text-xs text-foreground">
                  Related table: <span className="font-mono">{result.relatedTable || 'from response'}</span>
                  </span>
                  {result.moreRecords ? (
                    <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:bg-amber-300/10 dark:text-amber-200">
                      More records available
                    </span>
                  ) : null}
                  {result.moreRecords ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={loading || !result.pagingCookie}
                      onClick={() => void execute('Retrieve', [], {
                        pageNumber: (result.pageNumber || lastRequest?.PageNumber || 1) + 1,
                        pagingCookie: result.pagingCookie ?? '',
                      })}
                    >
                      Next page
                    </Button>
                  ) : null}
                </div>

                {targetId.trim() && result.targetRecord ? (
                  <section className="space-y-2 rounded-xl border border-border-soft p-4">
                    <h3 className="text-sm font-semibold">Target record</h3>
                    <RecordAttributes record={result.targetRecord} />
                  </section>
                ) : null}

                {records.length ? (
                  <div className="overflow-hidden rounded-xl border border-border-soft">
                    <div className="max-h-[38vh] overflow-auto">
                      <table className="w-full min-w-[620px] border-collapse text-left text-sm">
                        <thead className="sticky top-0 z-10 bg-surface-muted text-[11px] uppercase tracking-wide text-muted-foreground">
                          <tr>
                            {operation === 'Disassociate' && targetId.trim() ? <th className="w-12 px-3 py-3"><span className="sr-only">Select</span></th> : null}
                            <th className="px-4 py-3 font-semibold">Record</th>
                            <th className="px-4 py-3 font-semibold">{targetId.trim() ? 'Fields' : 'Related rows'}</th>
                            <th className="px-4 py-3 font-semibold">Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-soft">
                          {records.map((record, index) => {
                            const attributes = record.attributes ?? {}
                            const name = getRecordName(record)
                            const recordId = record.id ?? ''
                            const selected = Boolean(recordId) && selectedRelatedIds.includes(recordId)
                            const relatedRecords = record.relatedRecords ?? []
                            const collectionMode = !targetId.trim()

                            return (
                              <tr key={recordId || index} className={`align-top hover:bg-surface-muted/50 ${selected ? 'bg-primary/5' : ''}`}>
                                {operation === 'Disassociate' && !collectionMode ? (
                                  <td className="px-3 py-3">
                                    <input
                                      type="checkbox"
                                      checked={selected}
                                      onChange={() => recordId && toggleSelectedId(recordId)}
                                      disabled={loading || confirming || !recordId}
                                      aria-label={`Select ${name} for disassociation`}
                                      className="h-4 w-4 rounded border-border text-primary accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                                    />
                                  </td>
                                ) : null}
                                <td className="max-w-56 px-4 py-3">
                                  <p className="font-medium">{name}</p>
                                  <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{recordId || 'Record ID not returned'}</p>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  {collectionMode
                                    ? `${relatedRecords.length} related ${relatedRecords.length === 1 ? 'row' : 'rows'}`
                                    : `${Object.keys(attributes).length} fields`}
                                </td>
                                <td className="px-4 py-3">
                                  <details>
                                    <summary className="cursor-pointer text-xs font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                                      {collectionMode ? 'View target and related rows' : 'View attributes'}
                                    </summary>
                                    <pre className="mt-2 max-w-[430px] overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-surface-muted p-3 font-mono text-[11px] leading-relaxed text-foreground">
                                      {JSON.stringify(collectionMode
                                        ? { targetRecord: { id: record.id, attributes, formattedValues: record.formattedValues }, relatedRecords }
                                        : { attributes, formattedValues: record.formattedValues }, null, 2)}
                                    </pre>
                                  </details>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
                    <p className="text-sm font-semibold">No related records on this page</p>
                    <p className="mt-1 text-xs text-muted-foreground">Use the request details below to review the paging settings.</p>
                  </div>
                )}
              </section>
            ) : null}

            {lastRequest ? <RequestDetails request={lastRequest} title="Last operation request sent" /> : null}

            {result ? (
              <details className="rounded-xl border border-border-soft">
                <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                  View complete response
                </summary>
                <pre className="max-h-64 overflow-auto border-t border-border-soft bg-surface-muted/50 p-4 font-mono text-[11px] leading-relaxed">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            ) : null}
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border-soft px-5 py-3 sm:px-6">
            <p className="text-[11px] text-muted-foreground">
              {operation === 'Retrieve'
                ? 'Retrieve is read-only.'
                : 'Association changes are sent only after you review and confirm.'}
            </p>
            <Dialog.Close asChild>
              <Button type="button" variant="secondary" size="sm">Close</Button>
            </Dialog.Close>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function ContextValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="text-muted-foreground">{label}</span>
      <p className="mt-1 break-all font-mono text-[11px] text-foreground sm:text-xs">{value}</p>
    </div>
  )
}

function TextInput({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted-foreground">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="form-field-surface w-full rounded-xl border border-border-soft px-3 py-2.5 font-mono text-xs text-foreground outline-none transition placeholder:font-sans placeholder:text-muted-foreground/70 focus:border-primary/50 focus:ring-2 focus:ring-primary/15" /></label>
}

function parseColumnNames(value: string) {
  return value.split(/[\s,;]+/).map((column) => column.trim()).filter(Boolean)
}

function getRecordAttributes(record: TakafulM2MRecord): Record<string, unknown> {
  if (record.attributes) return record.attributes
  return Object.fromEntries(Object.entries(record).filter(([key]) => !['id', 'formattedValues', 'relatedRecords'].includes(key)))
}

function getRecordName(record: TakafulM2MRecord) {
  const namedValue = Object.entries(getRecordAttributes(record)).find(([key]) => /name/i.test(key))?.[1]
  return String(namedValue ?? record.id ?? 'Unnamed record')
}

function canBuildContext(context: TakafulM2MContext) {
  return Boolean(context.targetTable.trim() && context.relationshipName.trim())
}

function createRequestPreview(operation: TakafulM2MOperation, context: TakafulM2MContext, relatedIds: string[], pageSize: number) {
  try { return createTakafulM2MRequest(operation, context, relatedIds, { pageSize }) } catch { return null }
}

function isGuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim())
}

function RecordAttributes({ record }: { record: TakafulM2MRecord }) {
  return (
    <details className="rounded-lg border border-border-soft">
      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-primary">{getRecordName(record)} · {record.id}</summary>
      <pre className="max-h-52 overflow-auto border-t border-border-soft bg-surface-muted/50 p-3 font-mono text-[11px] leading-relaxed">
        {JSON.stringify({ attributes: getRecordAttributes(record), formattedValues: record.formattedValues }, null, 2)}
      </pre>
    </details>
  )
}

function RequestDetails({ request, title = 'Request body preview' }: { request: TakafulM2MRequestPayload; title?: string }) {
  return (
    <details className="rounded-xl border border-border-soft">
      <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
        {title}
      </summary>
      <div className="space-y-3 border-t border-border-soft p-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          POST <code className="font-mono text-foreground">/api/data/v9.2/aur_TakafulManageManyToMany</code>
        </p>
        <pre className="max-h-56 overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-100">
          {JSON.stringify(request, null, 2)}
        </pre>
        <div className="overflow-x-auto rounded-lg border border-border-soft">
          <table className="w-full min-w-[600px] text-left text-[11px]">
            <thead className="bg-surface-muted text-muted-foreground">
              <tr><th className="px-3 py-2 font-semibold">Parameter</th><th className="px-3 py-2 font-semibold">Type</th><th className="px-3 py-2 font-semibold">Meaning</th></tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {PARAMETER_HELP.map(([parameter, meaning]) => (
                <tr key={parameter}>
                  <td className="px-3 py-2 font-mono text-foreground">{parameter}</td>
                  <td className="px-3 py-2 text-muted-foreground">{PARAMETER_TYPES[parameter]}</td>
                  <td className="px-3 py-2 text-muted-foreground">{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  )
}

function safelyParseIds(value: string) {
  try {
    return { ids: parseRelatedIds(value), error: null }
  } catch (error) {
    return { ids: [] as string[], error: getErrorMessage(error) }
  }
}

function uniqueIds(ids: string[]) {
  return [...new Set(ids)]
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String(error.message)
  return String(error)
}
