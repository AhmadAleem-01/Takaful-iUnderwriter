import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  ChevronUp,
  Database,
  Eye,
  FileBadge2,
  FileStack,
  GripVertical,
  Heading1,
  Heading2,
  Italic,
  List,
  ListOrdered,
  LoaderCircle,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trash2,
  Type,
  Underline,
  Upload,
  X,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Input'
import { Skeleton } from '../../components/ui/Skeleton'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useRole } from '../../hooks/useRole'
import { cn } from '../../lib/cn'
import { formatDate } from '../../lib/formatters'
import { Aur_quotesService } from '../../generated/services/Aur_quotesService'
import { Aur_business_rulesesService } from '../../generated/services/Aur_business_rulesesService'
import { Aur_productsesService } from '../../generated/services/Aur_productsesService'
import { Aur_custom_document_templatesesService } from '../../generated/services/Aur_custom_document_templatesesService'

type FieldGroupKey = 'Quote' | 'Business Rule' | 'Product'
type ExtractionPhase =
  | 'idle'
  | 'uploading'
  | 'reading'
  | 'extracting'
  | 'structuring'
  | 'preparing'
  | 'ready'

interface MergeFieldItem {
  id: string
  label: string
  token: string
  group: FieldGroupKey
}

interface MergeFieldGroup {
  group: FieldGroupKey
  description: string
  fields: MergeFieldItem[]
}

interface SavedTemplateRecord {
  id: string
  name: string
  content: string
  statusCode: number
  status: string
  updatedOn?: string
  createdBy?: string
}

const DEFAULT_WORKSPACE_HTML = `
  <h1><strong>Executive Insurance Template</strong></h1>
  <p><strong>Purpose:</strong> Upload a source document, refine the wording, and turn it into a reusable executive-grade insurance template.</p>
  <p>Use placeholders like <span data-merge-chip="true" contenteditable="false" class="merge-chip">{{Quote.aur_name}}</span> and <span data-merge-chip="true" contenteditable="false" class="merge-chip">{{Product.aur_name}}</span> to inject live quote, rule, and product data directly into the document.</p>
  <h2><strong>Suggested structure</strong></h2>
  <p><strong>Introduction:</strong> Open with the insured context, customer name, or quote summary.</p>
  <p><strong>Coverage narrative:</strong> Explain the policy or product positioning in concise, client-ready language.</p>
  <p><strong>Commercial summary:</strong> Add pricing, conditions, and any relevant rule-based commentary using merge fields.</p>
  <h2><strong>Workspace note</strong></h2>
  <p>This default draft is styled to give the page a stronger first view before a source document is uploaded or a saved template is reloaded.</p>
`

const EXTRACTION_STEPS: Array<{ key: ExtractionPhase; label: string }> = [
  { key: 'uploading', label: 'Uploading Document' },
  { key: 'reading', label: 'Reading Pages' },
  { key: 'extracting', label: 'Extracting Text' },
  { key: 'structuring', label: 'Identifying Structure' },
  { key: 'preparing', label: 'Preparing Template' },
  { key: 'ready', label: 'Ready' },
]

export function DocumentTemplatesPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const editorRef = useRef<HTMLDivElement | null>(null)
  const savedRangeRef = useRef<Range | null>(null)
  const extractionTimerRef = useRef<number | null>(null)
  const { user } = useRole()

  const [refreshKey, setRefreshKey] = useState(0)
  const [workspaceName, setWorkspaceName] = useState('Executive Insurance Template')
  const [workspaceContent, setWorkspaceContent] = useState(DEFAULT_WORKSPACE_HTML)
  const [workspaceStatus, setWorkspaceStatus] = useState<1 | 2>(1)
  const [fieldSearch, setFieldSearch] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<FieldGroupKey[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [uploadedFileName, setUploadedFileName] = useState<string>('')
  const [dragActive, setDragActive] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [extractionPhase, setExtractionPhase] = useState<ExtractionPhase>('idle')
  const [extractionProgress, setExtractionProgress] = useState(0)
  const [deleteTemplate, setDeleteTemplate] = useState<SavedTemplateRecord | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const { data, loading, error } = useAsyncData(async () => {
    const [quotesResult, rulesResult, productsResult, templatesResult] = await Promise.all([
      Aur_quotesService.getAll({ orderBy: ['createdon desc'] }),
      Aur_business_rulesesService.getAll({ orderBy: ['createdon desc'] }),
      Aur_productsesService.getAll({ orderBy: ['createdon desc'] }),
      Aur_custom_document_templatesesService.getAll({ orderBy: ['modifiedon desc', 'createdon desc'] }),
    ])

    return {
      quotes: quotesResult.data ?? [],
      rules: rulesResult.data ?? [],
      products: productsResult.data ?? [],
      templates: (templatesResult.data ?? []).map((item) => ({
        id: item.aur_custom_document_templatesid,
        name: item.aur_name ?? 'Untitled template',
        content: item.aur_template_content ?? '',
        statusCode: Number(item.statuscode ?? 1),
        status: item.statuscodename ?? (Number(item.statuscode) === 2 ? 'Inactive' : 'Active'),
        updatedOn: item.modifiedon ?? item.createdon,
        createdBy: item.createdbyname ?? item.owneridname,
      })),
    }
  }, [refreshKey])

  useEffect(() => {
    if (!editorRef.current) return
    if (editorRef.current.innerHTML !== workspaceContent) {
      editorRef.current.innerHTML = workspaceContent
    }
  }, [workspaceContent])

  useEffect(() => {
    return () => {
      if (extractionTimerRef.current) {
        window.clearTimeout(extractionTimerRef.current)
      }
    }
  }, [])

  const fieldGroups = useMemo<MergeFieldGroup[]>(() => {
    const quotes = data?.quotes ?? []
    const rules = data?.rules ?? []
    const products = data?.products ?? []

    return [
      {
        group: 'Quote',
        description: 'Premium merge fields',
        fields: buildFields('Quote', quotes[0] as unknown as Record<string, unknown> | undefined, [
          'aur_name',
          'aur_ai_generated_summary',
          'aur_total_premium',
          'aur_gross_premium',
          'aur_loading_premium',
          'aur_vat',
        ]),
      },
      {
        group: 'Business Rule',
        description: 'Premium merge fields',
        fields: buildFields('Business Rule', rules[0] as unknown as Record<string, unknown> | undefined, [
          'aur_name',
          'aur_categories',
        ]),
      },
      {
        group: 'Product',
        description: 'Premium merge fields',
        fields: buildFields('Product', products[0] as unknown as Record<string, unknown> | undefined, [
          'aur_name',
          'aur_heading',
          'aur_short_details',
          'aur_incomingemailaddress',
          'aur_terms_conditions',
          'aur_details',
        ]),
      },
    ]
  }, [data?.products, data?.quotes, data?.rules])

  const filteredFieldGroups = useMemo(() => {
    if (!fieldSearch.trim()) return fieldGroups
    const query = fieldSearch.trim().toLowerCase()
    return fieldGroups
      .map((group) => ({
        ...group,
        fields: group.fields.filter((field) =>
          [field.label, field.token, field.group].join(' ').toLowerCase().includes(query),
        ),
      }))
      .filter((group) => group.fields.length > 0)
  }, [fieldGroups, fieldSearch])

  const templates = data?.templates ?? []
  const activeTemplateCount = templates.filter((template) => template.statusCode === 1).length
  const extractedTemplateCount = templates.filter((template) => template.content.trim().length > 0).length

  const currentStepIndex = extractionPhase === 'idle'
    ? -1
    : EXTRACTION_STEPS.findIndex((step) => step.key === extractionPhase)
  const isExtracting = extractionPhase !== 'idle' && extractionPhase !== 'ready'

  function rememberSelection() {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0)
    if (!editorRef.current?.contains(range.commonAncestorContainer)) return
    savedRangeRef.current = range.cloneRange()
  }

  function restoreSelection() {
    const selection = window.getSelection()
    if (!selection || !savedRangeRef.current) return
    selection.removeAllRanges()
    selection.addRange(savedRangeRef.current)
  }

  function updateWorkspaceContentFromEditor() {
    if (!editorRef.current) return
    setWorkspaceContent(editorRef.current.innerHTML)
  }

  function insertMergeChip(field: MergeFieldItem) {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    restoreSelection()

    const selection = window.getSelection()
    if (!selection) return

    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : document.createRange()
    if (!selection.rangeCount) {
      range.selectNodeContents(editor)
      range.collapse(false)
    }

    const chip = createMergeChip(field)
    range.deleteContents()
    range.insertNode(chip)
    range.setStartAfter(chip)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
    savedRangeRef.current = range.cloneRange()
    updateWorkspaceContentFromEditor()
  }

  function applyEditorCommand(command: string, value?: string) {
    if (!editorRef.current) return
    editorRef.current.focus()
    restoreSelection()
    document.execCommand(command, false, value)
    rememberSelection()
    updateWorkspaceContentFromEditor()
  }

  async function handleFilePicked(file?: File | null) {
    if (!file) return
    setExtractionTimerRefClear()
    setUploadedFileName(file.name)
    setSaveMessage(null)
    setSaveError(null)
    setExtractionPhase('uploading')
    setExtractionProgress(8)
    setWorkspaceContent('')

    const phases: Array<{ key: ExtractionPhase; progress: number; delay: number }> = [
      { key: 'reading', progress: 24, delay: 420 },
      { key: 'extracting', progress: 48, delay: 520 },
      { key: 'structuring', progress: 69, delay: 560 },
      { key: 'preparing', progress: 86, delay: 520 },
      { key: 'ready', progress: 100, delay: 420 },
    ]

    let index = 0
    const content = await buildExtractedDocumentHtml(file)

    const runNext = () => {
      const next = phases[index]
      if (!next) {
        setWorkspaceContent(content)
        setSaveMessage(`Document extracted and loaded from ${file.name}.`)
        return
      }

      setExtractionTimerRefClear()
      extractionTimerRef.current = window.setTimeout(() => {
        setExtractionPhase(next.key)
        setExtractionProgress(next.progress)
        if (next.key === 'ready') {
          setWorkspaceContent(content)
          setSaveMessage(`Document extracted and loaded from ${file.name}.`)
        }
        index += 1
        runNext()
      }, next.delay)
    }

    runNext()
  }

  function setExtractionTimerRefClear() {
    if (extractionTimerRef.current) {
      window.clearTimeout(extractionTimerRef.current)
      extractionTimerRef.current = null
    }
  }

  async function handleSaveTemplate() {
    const content = editorRef.current?.innerHTML?.trim() || workspaceContent.trim()
    if (!workspaceName.trim()) {
      setSaveError('Template subject is required before saving.')
      return
    }
    if (!content) {
      setSaveError('Document workspace content is empty.')
      return
    }

    setSaveBusy(true)
    setSaveError(null)
    setSaveMessage(null)

    const payload = {
      aur_name: workspaceName.trim(),
      aur_template_content: content,
      statuscode: workspaceStatus,
    }

    try {
      if (selectedTemplateId) {
        await Aur_custom_document_templatesesService.update(selectedTemplateId, payload)
      } else {
        const result = await Aur_custom_document_templatesesService.create(payload as never)
        const createdId = result.data?.aur_custom_document_templatesid
        if (createdId) setSelectedTemplateId(createdId)
      }
      setSaveMessage('Document template saved successfully.')
      setRefreshKey((value) => value + 1)
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Unable to save the document template.')
    } finally {
      setSaveBusy(false)
    }
  }

  function loadTemplateIntoWorkspace(template: SavedTemplateRecord) {
    setSelectedTemplateId(template.id)
    setWorkspaceName(template.name)
    setWorkspaceStatus(template.statusCode === 2 ? 2 : 1)
    setWorkspaceContent(template.content || DEFAULT_WORKSPACE_HTML)
    setUploadedFileName(template.name)
    setExtractionPhase('ready')
    setExtractionProgress(100)
    setSaveMessage(`${template.name} loaded into the workspace.`)
    setSaveError(null)
  }

  function resetWorkspace() {
    setSelectedTemplateId(null)
    setWorkspaceName('Executive Insurance Template')
    setWorkspaceStatus(1)
    setWorkspaceContent(DEFAULT_WORKSPACE_HTML)
    setUploadedFileName('')
    setExtractionPhase('idle')
    setExtractionProgress(0)
    setSaveMessage(null)
    setSaveError(null)
  }

  async function handleDeleteTemplateConfirmed() {
    if (!deleteTemplate) return

    try {
      setDeleteBusy(true)
      setDeleteError(null)
      setSaveMessage(null)
      await Aur_custom_document_templatesesService.delete(deleteTemplate.id)

      const deletedTemplateName = deleteTemplate.name
      const deletedTemplateId = deleteTemplate.id
      setDeleteTemplate(null)
      if (selectedTemplateId === deletedTemplateId) {
        resetWorkspace()
      }
      setSaveMessage(`${deletedTemplateName} deleted successfully.`)
      setRefreshKey((value) => value + 1)
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : 'Unable to delete the document template.')
    } finally {
      setDeleteBusy(false)
    }
  }

  function handleDropOnEditor(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    const raw = event.dataTransfer.getData('application/json')
    if (!raw) return
    const field = JSON.parse(raw) as MergeFieldItem
    placeSelectionFromPoint(event.clientX, event.clientY, editorRef.current)
    insertMergeChip(field)
  }

  function handleUploadDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragActive(false)
    const file = event.dataTransfer.files?.[0]
    void handleFilePicked(file)
  }

  if (error) {
    return (
      <Card className="rounded-[24px] border border-danger/20 bg-danger/5">
        <p className="font-semibold text-danger">Unable to load document template workspace</p>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <section className="space-y-5 rounded-[30px] border border-border-soft bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(245,248,252,0.92)_100%)] px-6 py-6 shadow-soft dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.94)_0%,rgba(15,23,42,0.82)_100%)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <Badge variant="info">Admin workspace</Badge>
            <div className="space-y-2">
              <h1 className="text-[34px] font-bold tracking-[-0.03em]">Document Template</h1>
              <p className="max-w-3xl text-base leading-8 text-muted-foreground">
                Live Dataverse-backed document assembly with extracted content, merge-field mapping, and saved template previews.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="review">{templates.length} synced templates</Badge>
            <Button type="button" size="lg" disabled={saveBusy} onClick={() => void handleSaveTemplate()}>
              <Save className="h-4 w-4" />
              {saveBusy ? 'Saving...' : 'Save Template'}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.5fr_0.38fr]">
          <FieldBlock label="Template Subject">
            <Input
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              placeholder="Executive Insurance Template"
            />
          </FieldBlock>
          <FieldBlock label="Status">
            <div className="inline-flex rounded-full border border-border-soft bg-surface-muted/80 p-1">
              <Button
                type="button"
                variant={workspaceStatus === 1 ? 'primary' : 'ghost'}
                size="sm"
                className="rounded-full"
                onClick={() => setWorkspaceStatus(1)}
              >
                Active
              </Button>
              <Button
                type="button"
                variant={workspaceStatus === 2 ? 'primary' : 'ghost'}
                size="sm"
                className="rounded-full"
                onClick={() => setWorkspaceStatus(2)}
              >
                Inactive
              </Button>
            </div>
          </FieldBlock>
          <FieldBlock label="Workspace">
            <div className="flex gap-2">
              <Button type="button" variant="secondary" className="w-full" onClick={resetWorkspace}>
                <RefreshCw className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </FieldBlock>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.28fr_0.55fr_0.27fr]">
        <Card variant="premium" className="overflow-hidden rounded-[28px] p-0">
          <div className="border-b border-border-soft px-5 py-5">
            <h2 className="text-xl font-semibold">Template Fields</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              Drag Quote, Business Rule, and Product fields into the editor.
            </p>
            <div className="relative mt-5">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={fieldSearch}
                onChange={(event) => setFieldSearch(event.target.value)}
                placeholder="Search fields"
                className="pl-11"
              />
            </div>
          </div>

          <div className="space-y-4 px-4 py-5">
            {loading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-24 rounded-[24px]" />
              ))
            ) : (
              filteredFieldGroups.map((group) => {
                const expanded = expandedGroups.includes(group.group)
                return (
                  <motion.div
                    key={group.group}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28 }}
                    className="rounded-[24px] border border-border-soft bg-surface"
                  >
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                      onClick={() =>
                        setExpandedGroups((current) =>
                          current.includes(group.group)
                            ? current.filter((item) => item !== group.group)
                            : [...current, group.group],
                        )
                      }
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                          {group.group === 'Quote' ? <FileBadge2 className="h-4 w-4" /> : group.group === 'Business Rule' ? <Sparkles className="h-4 w-4" /> : <Database className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="font-semibold">{group.group}</p>
                          <p className="text-sm text-muted-foreground">{group.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-border-soft px-2 text-xs font-semibold">
                          {group.fields.length}
                        </span>
                        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </button>

                    <AnimatePresence initial={false}>
                      {expanded ? (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-3 border-t border-border-soft px-4 py-4">
                        {group.fields.map((field) => (
                          <button
                            key={field.id}
                            type="button"
                            draggable
                            onDragStart={(event) => {
                              event.dataTransfer.setData('application/json', JSON.stringify(field))
                              event.dataTransfer.effectAllowed = 'copy'
                            }}
                            onClick={() => insertMergeChip(field)}
                            className="flex w-full items-start gap-3 rounded-[20px] border border-border-soft bg-surface-soft/75 px-3 py-3 text-left transition hover:border-primary/20 hover:bg-surface-soft"
                          >
                            <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                              <GripVertical className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold">{field.label}</p>
                              <p className="truncate text-xs text-muted-foreground">{field.token}</p>
                            </div>
                          </button>
                        ))}
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </motion.div>
                )
              })
            )}
          </div>
        </Card>

        <Card variant="premium" className="overflow-hidden rounded-[28px] p-0">
          <div className="flex items-start justify-between gap-4 border-b border-border-soft px-6 py-5">
            <div>
              <h2 className="text-xl font-semibold">Document Workspace</h2>
              <p className="mt-1 text-sm leading-7 text-muted-foreground">
                Notion-style editing with merge-field chips and cursor-aware insertion.
              </p>
            </div>
            <Badge variant="neutral">Rich text editor</Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-border-soft px-4 py-3">
            <ToolbarButton onClick={() => applyEditorCommand('undo')} icon={<RefreshCw className="h-4 w-4 scale-x-[-1]" />} />
            <ToolbarButton onClick={() => applyEditorCommand('redo')} icon={<RefreshCw className="h-4 w-4" />} />
            <ToolbarButton onClick={() => applyEditorCommand('bold')} icon={<Bold className="h-4 w-4" />} />
            <ToolbarButton onClick={() => applyEditorCommand('italic')} icon={<Italic className="h-4 w-4" />} />
            <ToolbarButton onClick={() => applyEditorCommand('underline')} icon={<Underline className="h-4 w-4" />} />
            <ToolbarButton onClick={() => applyEditorCommand('formatBlock', '<h1>')} icon={<Heading1 className="h-4 w-4" />} />
            <ToolbarButton onClick={() => applyEditorCommand('formatBlock', '<h2>')} icon={<Heading2 className="h-4 w-4" />} />
            <ToolbarButton onClick={() => applyEditorCommand('formatBlock', '<p>')} icon={<Type className="h-4 w-4" />} />
            <ToolbarButton onClick={() => applyEditorCommand('insertUnorderedList')} icon={<List className="h-4 w-4" />} />
            <ToolbarButton onClick={() => applyEditorCommand('insertOrderedList')} icon={<ListOrdered className="h-4 w-4" />} />
            <ToolbarButton onClick={() => applyEditorCommand('justifyLeft')} icon={<AlignLeft className="h-4 w-4" />} />
            <ToolbarButton onClick={() => applyEditorCommand('justifyCenter')} icon={<AlignCenter className="h-4 w-4" />} />
            <ToolbarButton onClick={() => applyEditorCommand('justifyRight')} icon={<AlignRight className="h-4 w-4" />} />
          </div>

          <div className="bg-[linear-gradient(180deg,rgba(248,250,252,0.8)_0%,rgba(255,255,255,0.92)_100%)] p-6 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.45)_0%,rgba(15,23,42,0.2)_100%)]">
            <div className="relative overflow-hidden rounded-[30px]">
              <AnimatePresence>
                {isExtracting ? (
                  <motion.div
                    key="snake-border"
                    className="pointer-events-none absolute inset-0 rounded-[30px] p-[2px]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <motion.div
                      className="h-full w-full rounded-[30px] bg-[conic-gradient(from_180deg_at_50%_50%,rgba(37,99,235,0)_0deg,rgba(37,99,235,0.15)_80deg,rgba(37,99,235,0.95)_150deg,rgba(16,185,129,0.85)_220deg,rgba(37,99,235,0)_360deg)]"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2.2, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }}
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                dir="ltr"
                className="document-workspace prose prose-slate relative z-[1] max-w-none min-h-[560px] rounded-[28px] border border-primary/20 bg-white px-10 py-10 text-[15px] leading-7 shadow-[0_22px_70px_rgba(15,23,42,0.08)] outline-none [direction:ltr] [unicode-bidi:plaintext] prose-headings:tracking-[-0.02em] prose-h1:text-[2rem] prose-h1:font-semibold prose-h2:text-[1.45rem] prose-h2:font-semibold prose-p:my-3 prose-p:text-[15px] prose-p:leading-7 dark:prose-invert dark:bg-slate-950/70"
                dangerouslySetInnerHTML={{ __html: workspaceContent }}
                onMouseUp={rememberSelection}
                onKeyUp={rememberSelection}
                onBlur={rememberSelection}
                onInput={() => updateWorkspaceContentFromEditor()}
                onDragOver={(event) => {
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'copy'
                }}
                onDrop={handleDropOnEditor}
              />

              <AnimatePresence>
                {isExtracting ? (
                  <motion.div
                    key="extracting-overlay"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.24 }}
                    className="absolute inset-0 z-[2] flex items-center justify-center rounded-[28px] bg-white/76 backdrop-blur-sm dark:bg-slate-950/70"
                  >
                    <div className="w-full max-w-md space-y-5 px-6 text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white shadow-glow">
                        <LoaderCircle className="h-7 w-7 animate-spin" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">
                          {EXTRACTION_STEPS[Math.max(currentStepIndex, 0)]?.label ?? 'Preparing Workspace'}
                        </p>
                        <h3 className="text-xl font-semibold">Analyzing {uploadedFileName || 'document'}</h3>
                        <p className="text-sm leading-7 text-muted-foreground">
                          Building a clean editable draft inside the document workspace and preparing merge-ready structure.
                        </p>
                      </div>
                      <div className="overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                        <motion.div
                          className="h-2 rounded-full bg-gradient-to-r from-primary via-secondary to-success"
                          animate={{ width: `${extractionProgress}%` }}
                          transition={{ duration: 0.4 }}
                        />
                      </div>
                      <div className="flex justify-center gap-2">
                        {EXTRACTION_STEPS.map((step, index) => {
                          const active = index <= Math.max(currentStepIndex, 0)
                          return (
                            <motion.span
                              key={step.key}
                              className={cn(
                                'h-2.5 rounded-full',
                                active ? 'bg-primary' : 'bg-slate-300 dark:bg-white/15',
                              )}
                              animate={{ width: active ? 28 : 10, opacity: active ? 1 : 0.55 }}
                              transition={{ duration: 0.25 }}
                            />
                          )
                        })}
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card variant="premium" className="space-y-4 rounded-[28px]">
            <div>
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-primary" />
                <h3 className="text-xl font-semibold">AI Document Upload</h3>
              </div>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                Drop a source file or browse to start extraction.
              </p>
            </div>

            <label
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center rounded-[28px] border border-dashed px-6 py-14 text-center transition',
                dragActive ? 'border-primary bg-primary/5' : 'border-primary/35 bg-surface-soft/50',
              )}
              onDragOver={(event) => {
                event.preventDefault()
                setDragActive(true)
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleUploadDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                className="hidden"
                onChange={(event: ChangeEvent<HTMLInputElement>) => void handleFilePicked(event.target.files?.[0])}
              />
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white shadow-glow">
                <Upload className="h-7 w-7" />
              </div>
              <p className="mt-6 text-xl font-semibold">Drop document here or browse files</p>
              <p className="mt-2 text-sm text-muted-foreground">Supported: PDF, DOCX, DOC</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {['PDF', 'DOCX', 'DOC'].map((label) => (
                  <span key={label} className="rounded-full border border-border-soft bg-white px-3 py-1.5 text-sm dark:bg-slate-950/50">
                    {label}
                  </span>
                ))}
              </div>
            </label>
          </Card>

          <Card variant="premium" className="hidden space-y-4 rounded-[28px]">
            <div className="flex items-center gap-2">
              <FileStack className="h-4 w-4 text-primary" />
              <h3 className="text-2xl font-semibold">Saved Templates</h3>
            </div>
            <p className="text-sm leading-7 text-muted-foreground">
              Reusable executive templates synced from the current Dataverse model.
            </p>

            <div className="grid gap-3 grid-cols-3">
              <StatCard label="Total templates" value={templates.length} />
              <StatCard label="Active" value={activeTemplateCount} />
              <StatCard label="Extracted" value={extractedTemplateCount} />
            </div>

            <div className="space-y-3">
              {loading ? (
                Array.from({ length: 2 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-[24px]" />)
              ) : templates.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-border-soft bg-surface-soft/70 px-5 py-6 text-center">
                  <p className="font-semibold">No saved templates yet</p>
                  <p className="mt-2 text-sm text-muted-foreground">Save your current workspace to create the first reusable document template.</p>
                </div>
              ) : (
                templates.map((template) => (
                  <div key={template.id} className="rounded-[24px] border border-border-soft bg-surface-soft/75 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold">{template.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {template.statusCode === 1 ? 'Ready' : 'Inactive'} · {formatDate(template.updatedOn)}
                        </p>
                      </div>
                      <Badge variant={template.statusCode === 1 ? 'approved' : 'neutral'}>
                        {template.status}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                      <span>Created by {template.createdBy || user.name}</span>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <Button type="button" variant="ghost" size="sm" onClick={() => loadTemplateIntoWorkspace(template)}>
                        <Eye className="h-4 w-4" />
                        Load in workspace
                      </Button>
                      {selectedTemplateId === template.id ? (
                        <Badge variant="review">Loaded</Badge>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      <Card variant="premium" className="overflow-hidden rounded-[28px] p-0">
        <div className="border-b border-border-soft px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <FileStack className="h-4 w-4 text-primary" />
                <h3 className="text-xl font-semibold">Saved Templates</h3>
              </div>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                Reusable executive templates synced from the current Dataverse model.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 lg:min-w-[360px]">
              <StatCard label="Total templates" value={templates.length} />
              <StatCard label="Active" value={activeTemplateCount} />
              <StatCard label="Extracted" value={extractedTemplateCount} />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 px-6 py-5">
            {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-16 rounded-[18px]" />)}
          </div>
        ) : templates.length === 0 ? (
          <div className="px-6 py-8">
            <div className="rounded-[24px] border border-dashed border-border-soft bg-surface-soft/70 px-5 py-8 text-center">
              <p className="font-semibold">No saved templates yet</p>
              <p className="mt-2 text-sm text-muted-foreground">Save your current workspace to create the first reusable document template.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="bg-surface-muted/90">
                <tr>
                  <th className="px-6 py-4 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Template</th>
                  <th className="px-6 py-4 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Status</th>
                  <th className="px-6 py-4 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Updated</th>
                  <th className="px-6 py-4 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Created By</th>
                  <th className="px-6 py-4 text-right text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.id} className="border-b border-border-soft/80 bg-surface transition duration-150 hover:bg-primary/5">
                    <td className="px-6 py-4 align-middle">
                      <div className="space-y-1">
                        <p className="font-semibold">{template.name}</p>
                        <p className="text-[12px] text-muted-foreground">{template.statusCode === 1 ? 'Ready for use' : 'Inactive template'}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <Badge variant={template.statusCode === 1 ? 'approved' : 'neutral'}>
                        {template.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 align-middle text-sm text-muted-foreground">{formatDate(template.updatedOn)}</td>
                    <td className="px-6 py-4 align-middle text-sm text-muted-foreground">{template.createdBy || user.name}</td>
                    <td className="px-6 py-4 align-middle">
                      <div className="flex items-center justify-end gap-2">
                        {selectedTemplateId === template.id ? <Badge variant="review">Loaded</Badge> : null}
                        <Button type="button" variant="ghost" size="sm" className="bg-white dark:bg-[#1E293B]" onClick={() => loadTemplateIntoWorkspace(template)}>
                          <Eye className="h-4 w-4" />
                          Load in workspace
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="bg-white text-danger hover:bg-danger/10 hover:text-danger dark:bg-[#1E293B]"
                          onClick={() => {
                            setDeleteError(null)
                            setDeleteTemplate(template)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {saveMessage ? (
        <Card className="rounded-[22px] border border-success/20 bg-success/6">
          <p className="font-semibold text-success">{saveMessage}</p>
        </Card>
      ) : null}
      {saveError ? (
        <Card className="rounded-[22px] border border-danger/20 bg-danger/5">
          <p className="font-semibold text-danger">{saveError}</p>
        </Card>
      ) : null}

      <ModalShell
        open={Boolean(deleteTemplate)}
        onClose={() => {
          if (deleteBusy) return
          setDeleteTemplate(null)
          setDeleteError(null)
        }}
        widthClassName="max-w-[520px]"
      >
        {deleteTemplate ? (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[28px] font-semibold tracking-[-0.02em]">Delete Document Template</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Are you sure you want to delete <span className="font-semibold text-foreground">{deleteTemplate.name}</span>? This action cannot be undone.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (deleteBusy) return
                  setDeleteTemplate(null)
                  setDeleteError(null)
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {deleteError ? <p className="text-sm text-danger">{deleteError}</p> : null}

            <div className="flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  if (deleteBusy) return
                  setDeleteTemplate(null)
                  setDeleteError(null)
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={deleteBusy}
                onClick={() => void handleDeleteTemplateConfirmed()}
              >
                {deleteBusy ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        ) : null}
      </ModalShell>
    </div>
  )
}

function ModalShell({
  open,
  onClose,
  widthClassName,
  children,
}: {
  open: boolean
  onClose: () => void
  widthClassName: string
  children: ReactNode
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 !mt-0 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className={cn(
          'max-h-[92vh] w-full overflow-hidden rounded-[30px] border border-border-soft bg-surface shadow-[0_40px_90px_rgba(15,23,42,0.28)]',
          widthClassName,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="max-h-[92vh] overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  )
}

function buildFields(group: FieldGroupKey, firstRecord: Record<string, unknown> | undefined, fallbackKeys: string[]) {
  const keys = Array.from(
    new Set(
      fallbackKeys.filter((key) => {
        if (!firstRecord) return true
        return key in firstRecord
      }),
    ),
  )

  return keys.map((key) => ({
    id: `${group}-${key}`,
    label: humanizeFieldKey(key),
    token: `{{${group.replace(/\s+/g, '')}.${key}}}`,
    group,
  }))
}

function humanizeFieldKey(key: string) {
  return key
    .replace(/^aur_/, '')
    .replace(/^cr058_/, '')
    .replace(/name$/i, 'name')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim()
}

function createMergeChip(field: MergeFieldItem) {
  const chip = document.createElement('span')
  chip.className = 'merge-chip'
  chip.setAttribute('data-merge-chip', 'true')
  chip.setAttribute('contenteditable', 'false')
  chip.textContent = field.token
  chip.style.display = 'inline-flex'
  chip.style.alignItems = 'center'
  chip.style.padding = '0.28rem 0.78rem'
  chip.style.margin = '0 0.2rem'
  chip.style.borderRadius = '999px'
  chip.style.border = '1px solid rgba(37,99,235,0.28)'
  chip.style.background = 'rgba(37,99,235,0.09)'
  chip.style.color = '#0f4aa8'
  chip.style.fontWeight = '600'
  chip.style.whiteSpace = 'nowrap'
  return chip
}

function placeSelectionFromPoint(x: number, y: number, editor: HTMLDivElement | null) {
  if (!editor) return
  const selection = window.getSelection()
  if (!selection) return

  let range: Range | null = null
  const documentWithCaret = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
  }

  if (documentWithCaret.caretRangeFromPoint) {
    range = documentWithCaret.caretRangeFromPoint(x, y)
  } else if (documentWithCaret.caretPositionFromPoint) {
    const position = documentWithCaret.caretPositionFromPoint(x, y)
    if (position) {
      range = document.createRange()
      range.setStart(position.offsetNode, position.offset)
      range.collapse(true)
    }
  }

  if (!range || !editor.contains(range.commonAncestorContainer)) {
    range = document.createRange()
    range.selectNodeContents(editor)
    range.collapse(false)
  }

  selection.removeAllRanges()
  selection.addRange(range)
}

async function buildExtractedDocumentHtml(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension === 'txt' || file.type.startsWith('text/')) {
    const text = await file.text()
    const paragraphs = text
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 10)
      .map((part) => `<p>${escapeHtml(part)}</p>`)
      .join('')
    return paragraphs || DEFAULT_WORKSPACE_HTML
  }

  if (extension === 'docx') {
    const docxHtml = await extractDocxHtml(file)
    if (docxHtml.trim()) {
      return docxHtml
    }
  }

  const rawText = await extractBestEffortText(file)
  if (rawText.trim()) {
    const paragraphs = rawText
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 12)
      .map((part) => `<p>${escapeHtml(part)}</p>`)
      .join('')

    return `
      <h1>${escapeHtml(file.name.replace(/\.[^.]+$/, ''))}</h1>
      ${paragraphs}
    `
  }

  const title = extension === 'doc'
    ? 'Word Document'
    : file.name.replace(/\.[^.]+$/, '') || 'Document Workspace'
  return `
    <h1>${escapeHtml(title)}</h1>
    <p>This uploaded source document has been prepared for template authoring. You can now refine the extracted wording, format the layout, and insert dynamic merge fields from Quote, Business Rule, and Product records.</p>
    <p>Use chips like <span data-merge-chip="true" contenteditable="false" class="merge-chip">{{Quote.aur_name}}</span>, <span data-merge-chip="true" contenteditable="false" class="merge-chip">{{BusinessRule.aur_name}}</span>, and <span data-merge-chip="true" contenteditable="false" class="merge-chip">{{Product.aur_name}}</span> to convert this source into a reusable insurance template.</p>
    <h2>Document Summary</h2>
    <p>Automatic text recovery for this binary office format is limited in the current browser-side flow, so the workspace has been initialized and is ready for premium editing and merge mapping.</p>
  `
}

async function extractDocxHtml(file: File) {
  try {
    const mammothModule = await import('mammoth')
    const mammoth = (mammothModule.default ?? mammothModule) as {
      convertToHtml: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>
      extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>
    }

    const arrayBuffer = await file.arrayBuffer()
    const htmlResult = await mammoth.convertToHtml({ arrayBuffer })
    const html = normalizeExtractedHtml(htmlResult.value)
    if (html) return html

    const textResult = await mammoth.extractRawText({ arrayBuffer })
    const paragraphs = textResult.value
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => `<p>${escapeHtml(part)}</p>`)
      .join('')

    return paragraphs
  } catch {
    return ''
  }
}

function normalizeExtractedHtml(value: string) {
  const html = value
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<p>\s*<\/p>/g, '')
    .trim()

  if (!html) return ''

  const textOnly = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!isHighQualityExtractedText(textOnly)) return ''
  return html
}

async function extractBestEffortText(file: File) {
  try {
    const buffer = await file.arrayBuffer()
    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
    const cleaned = decoded
      .replace(/<[^>]+>/g, ' ')
      .replace(/[^\x20-\x7E\r\n]/g, ' ')
      .replace(/\b(?:PK|word\/document\.xml|_rels|Content_Types)\b/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()

    if (!cleaned) return ''

    const segments = cleaned
      .split(/(?<=[.!?])\s+|\n+/)
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 35 && /[A-Za-z]{3,}/.test(segment))
      .slice(0, 10)

    const joined = segments.join('\n\n')
    return isHighQualityExtractedText(joined) ? joined : ''
  } catch {
    return ''
  }
}

function isHighQualityExtractedText(value: string) {
  const text = value.trim()
  if (!text) return false

  const words = text.split(/\s+/).filter(Boolean)
  if (words.length < 35) return false

  const alphaWords = words.filter((word) => /[A-Za-z]{3,}/.test(word))
  const vowelWords = alphaWords.filter((word) => /[aeiou]/i.test(word))
  const symbolHeavyWords = words.filter((word) => /[^A-Za-z0-9,.'()-]/.test(word))

  const alphaRatio = alphaWords.length / words.length
  const vowelRatio = alphaWords.length === 0 ? 0 : vowelWords.length / alphaWords.length
  const symbolRatio = symbolHeavyWords.length / words.length

  return alphaRatio > 0.7 && vowelRatio > 0.55 && symbolRatio < 0.18
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function ToolbarButton({ onClick, icon }: { onClick: () => void; icon: ReactNode }) {
  return (
    <Button type="button" variant="ghost" size="sm" className="rounded-xl" onClick={onClick}>
      {icon}
    </Button>
  )
}

function FieldBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[22px] border border-border-soft bg-surface px-4 py-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-4xl font-semibold">{value}</p>
    </div>
  )
}
