import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Eye,
  FileStack,
  Heading1,
  Heading2,
  Italic,
  List,
  ListOrdered,
  RefreshCw,
  Redo2,
  Save,
  Trash2,
  Type,
  Underline,
  Undo2,
  X,
} from 'lucide-react'
import {
  type DragEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Skeleton } from '../../components/ui/Skeleton'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useRole } from '../../hooks/useRole'
import { cn } from '../../lib/cn'
import { formatDate } from '../../lib/formatters'
import { Aur_custom_document_templatesesService } from '../../generated/services/Aur_custom_document_templatesesService'
import { sanitizeQuotationHtml } from '../../lib/quotationTemplate'
import { getEmailTemplateFieldTables } from '../../services/emailTemplateFieldsService'
import type { TemplateField } from '../../lib/emailTemplateFields'
import { DocumentTemplateFieldsPanel } from '../../components/admin/DocumentTemplateFieldsPanel'
import { DocumentPageSetupPanel } from '../../components/admin/DocumentPageSetupPanel'
import { emptyPageSetup, readDocumentPageSetup, writeDocumentPageSetup, type DocumentPageSetup } from '../../lib/documentPageSetup'
import { parseTemplateFieldPath, templateFieldFromPath } from '../../lib/templateFieldPaths'
import { createTemplateFieldBadge, insertTemplateFieldBadgeAtRange, decorateTemplateFields, refreshTemplateFieldLabels, serializeTemplateEditorBody, templateFieldLabelMap } from '../../lib/templateFieldBadges'
import { readDocumentTemplate, writeDocumentTemplate, documentTemplateFieldEntities } from '../../lib/documentTemplate'

interface SavedTemplateRecord {
  id: string
  name: string
  content: string
  statusCode: number
  status: string
  updatedOn?: string
  createdBy?: string
}

const DEFAULT_WORKSPACE_HTML = '<p><br></p>'

export function DocumentTemplatesPage() {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const savedRangeRef = useRef<Range | null>(null)
  const { user } = useRole()

  const [refreshKey, setRefreshKey] = useState(0)
  const [workspaceName, setWorkspaceName] = useState('')
  const [workspaceContent, setWorkspaceContent] = useState(DEFAULT_WORKSPACE_HTML)
  const [pageSetup, setPageSetup] = useState<DocumentPageSetup>(emptyPageSetup)
  const [workspaceView, setWorkspaceView] = useState<'body' | 'page'>('body')
  const [logoBusy, setLogoBusy] = useState(false)
  const [workspaceStatus, setWorkspaceStatus] = useState<1 | 2>(1)
  const [selectedEntity, setSelectedEntity] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleteTemplate, setDeleteTemplate] = useState<SavedTemplateRecord | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const { data, loading, error } = useAsyncData(async () => {
    const [templatesResult, fieldTables] = await Promise.all([
      Aur_custom_document_templatesesService.getAll({ orderBy: ['modifiedon desc', 'createdon desc'] }),
      getEmailTemplateFieldTables(),
    ])
    if (!templatesResult.success) throw templatesResult.error ?? new Error('Unable to load document templates.')
    return {
      fieldTables,
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

  const fieldTables = useMemo(() => data?.fieldTables ?? [], [data?.fieldTables])
  const fieldLabels = useMemo(() => templateFieldLabelMap(fieldTables), [fieldTables])
  const selectedTable = fieldTables.find((table) => table.name === selectedEntity)

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const content = sanitizeQuotationHtml(workspaceContent)
    if (serializeTemplateEditorBody(editor) !== content) {
      editor.innerHTML = content
      decorateTemplateFields(editor, fieldLabels)
      savedRangeRef.current = null
    } else {
      decorateTemplateFields(editor, fieldLabels)
      refreshTemplateFieldLabels(editor, fieldLabels)
    }
  }, [workspaceContent, fieldLabels, selectedEntity])

  const templates = data?.templates ?? []
  const activeTemplateCount = templates.filter((template) => template.statusCode === 1).length
  const contentTemplateCount = templates.filter((template) => template.content.trim().length > 0).length

  const rememberSelection = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0)
    if (!editorRef.current?.contains(range.commonAncestorContainer)) return
    savedRangeRef.current = range.cloneRange()
  }, [])

  useEffect(() => {
    document.addEventListener('selectionchange', rememberSelection)
    return () => document.removeEventListener('selectionchange', rememberSelection)
  }, [rememberSelection])

  function restoreSelection() {
    const selection = window.getSelection()
    if (!selection || !savedRangeRef.current || !editorRef.current?.contains(savedRangeRef.current.commonAncestorContainer)) return
    selection.removeAllRanges()
    selection.addRange(savedRangeRef.current)
  }

  function updateWorkspaceContentFromEditor() {
    if (!editorRef.current) return
    setWorkspaceContent(serializeTemplateEditorBody(editorRef.current))
    setSaveMessage(null)
  }

  function insertMergeChip(field: TemplateField) {
    const editor = editorRef.current
    const validField = templateFieldFromPath(field.token, fieldTables)
    if (!editor || !validField || parseTemplateFieldPath(field.token)?.entity !== selectedEntity) return
    editor.focus()
    restoreSelection()
    const selection = window.getSelection()
    if (!selection) return
    const range = savedRangeRef.current && editor.contains(savedRangeRef.current.commonAncestorContainer)
      ? savedRangeRef.current.cloneRange() : document.createRange()
    if (!savedRangeRef.current || !editor.contains(range.commonAncestorContainer)) {
      const target = editor.lastElementChild ?? editor
      if (target.tagName === 'P' && target.innerHTML === '<br>') target.replaceChildren()
      range.selectNodeContents(target)
      range.collapse(false)
    }
    const badge = createTemplateFieldBadge(validField.token, validField.label, document)
    savedRangeRef.current = insertTemplateFieldBadgeAtRange(badge, range, selection)
    updateWorkspaceContentFromEditor()
  }

  function applyEditorCommand(command: string, value?: string) {
    if (!editorRef.current || !selectedEntity) return
    editorRef.current.focus()
    restoreSelection()
    document.execCommand(command, false, value)
    rememberSelection()
    updateWorkspaceContentFromEditor()
  }

  async function handleSaveTemplate() {
    if (logoBusy) return
    const content = sanitizeQuotationHtml(editorRef.current ? serializeTemplateEditorBody(editorRef.current).trim() : workspaceContent.trim())
    const layoutContent = writeDocumentPageSetup(content, { ...pageSetup, headerHtml: sanitizeQuotationHtml(pageSetup.headerHtml), footerHtml: sanitizeQuotationHtml(pageSetup.footerHtml) })
    if (!selectedTable) {
      setSaveError('Select an entity before saving this template.')
      return
    }
    if (documentTemplateFieldEntities(layoutContent).some((entity) => entity !== selectedEntity)) {
      setSaveError('Some fields belong to another entity. Remove them before saving this template.')
      return
    }
    if (!workspaceName.trim()) {
      setSaveError('Template name is required before saving.')
      return
    }
    const text = new DOMParser().parseFromString(layoutContent, 'text/html').body
    if (!text.textContent?.trim() && !text.querySelector('img')) {
      setSaveError('Document workspace content is empty.')
      return
    }

    const storedContent = writeDocumentTemplate(selectedEntity, layoutContent)
    if (storedContent.length > 1048576) {
      setSaveError('This template is too large to save. Use a smaller logo or reduce the document content.')
      return
    }

    setSaveBusy(true)
    setSaveError(null)
    setSaveMessage(null)

    const payload = {
      aur_name: workspaceName.trim(),
      aur_template_content: storedContent,
      statuscode: workspaceStatus,
      statecode: workspaceStatus === 2 ? 1 as const : 0 as const,
    }

    try {
      const result = selectedTemplateId
        ? await Aur_custom_document_templatesesService.update(selectedTemplateId, payload)
        : await Aur_custom_document_templatesesService.create(payload as never)
      if (!result.success) throw result.error ?? new Error('Unable to save the document template.')
      if (!selectedTemplateId) {
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
    if (logoBusy) return
    savedRangeRef.current = null
    const saved = readDocumentTemplate(template.content)
    const branded = readDocumentPageSetup(saved.body)
    setSelectedEntity(saved.entity)
    setSelectedTemplateId(template.id)
    setWorkspaceName(template.name)
    setWorkspaceStatus(template.statusCode === 2 ? 2 : 1)
    setWorkspaceContent(branded.body || DEFAULT_WORKSPACE_HTML)
    setPageSetup(branded.setup)
    setSaveMessage(`${template.name} loaded into the workspace.`)
    setSaveError(null)
  }

  function resetWorkspace() {
    if (logoBusy) return
    savedRangeRef.current = null
    setSelectedTemplateId(null)
    setWorkspaceName('')
    setSelectedEntity('')
    setWorkspaceStatus(1)
    setWorkspaceContent(DEFAULT_WORKSPACE_HTML)
    setPageSetup(emptyPageSetup())
    setSaveMessage(null)
    setSaveError(null)
  }

  async function handleDeleteTemplateConfirmed() {
    if (!deleteTemplate || logoBusy) return

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
    let token: unknown
    try { token = JSON.parse(raw).token } catch { return }
    const field = typeof token === 'string' ? templateFieldFromPath(token, fieldTables) : null
    if (!field) return
    placeSelectionFromPoint(event.clientX, event.clientY, editorRef.current)
    rememberSelection()
    insertMergeChip(field)
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
                Select an entity, write your document, and add fields from that record or its related lookup records.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="review">{templates.length} synced templates</Badge>
            <Button type="button" size="lg" disabled={saveBusy || logoBusy || !selectedTable} onClick={() => void handleSaveTemplate()}>
              <Save className="h-4 w-4" />
              {saveBusy ? 'Saving...' : 'Save Template'}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.8fr_1fr_0.5fr_0.38fr]">
          <FieldBlock label="Entity">
            <Select aria-label="Template entity" value={selectedEntity} disabled={loading || saveBusy || logoBusy} placeholder="Select an entity first"
              onValueChange={(value) => { setSelectedEntity(value); setSaveMessage(null); setSaveError(null) }}
              options={fieldTables.map((table) => ({ value: table.name, label: table.label }))} />
          </FieldBlock>
          <FieldBlock label="Template Name">
            <Input
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              placeholder="Enter a template name"
              disabled={!selectedTable}
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
              <Button type="button" variant="secondary" className="w-full" disabled={logoBusy} onClick={resetWorkspace}>
                <RefreshCw className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </FieldBlock>
        </div>
      </section>

      {saveMessage ? <div role="status" className="rounded-xl border border-success/20 bg-success/5 px-4 py-3 text-sm text-success">{saveMessage}</div> : null}
      {saveError ? <div role="alert" className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{saveError}</div> : null}
      <div role="tablist" aria-label="Template workspace" className="flex w-fit gap-1 rounded-xl border border-border-soft bg-surface p-1">
        <Button role="tab" aria-selected={workspaceView === 'body'} aria-controls="document-body-panel" id="document-body-tab" variant={workspaceView === 'body' ? 'primary' : 'ghost'} disabled={logoBusy} onClick={() => setWorkspaceView('body')}>Document body</Button>
        <Button role="tab" aria-selected={workspaceView === 'page'} aria-controls="document-page-panel" id="document-page-tab" variant={workspaceView === 'page' ? 'primary' : 'ghost'} disabled={logoBusy} onClick={() => setWorkspaceView('page')}>Page setup</Button>
      </div>
      {workspaceView === 'page' ? <div role="tabpanel" id="document-page-panel" aria-labelledby="document-page-tab"><DocumentPageSetupPanel setup={pageSetup} body={workspaceContent} disabled={!selectedTable || saveBusy || logoBusy} saved={saveMessage === 'Document template saved successfully.'} fieldLabels={fieldLabels} fields={selectedTable?.fields ?? []} onChange={(setup) => { setPageSetup(setup); setSaveMessage(null); setSaveError(null) }} onBusyChange={setLogoBusy} /></div> : null}
      <div role="tabpanel" id="document-body-panel" aria-labelledby="document-body-tab" className={cn('grid min-w-0 gap-6 lg:grid-cols-[minmax(280px,0.32fr)_minmax(0,1fr)]', workspaceView !== 'body' && 'hidden')}>
        <DocumentTemplateFieldsPanel key={selectedEntity} tables={fieldTables} entity={selectedEntity} loading={loading} onInsert={insertMergeChip} />

        <Card variant="premium" className="min-w-0 overflow-hidden rounded-[28px] p-0">
          <div className="flex items-start justify-between gap-4 border-b border-border-soft px-6 py-5">
            <div>
              <h2 className="text-xl font-semibold">Document Workspace</h2>
              <p className="mt-1 text-sm leading-7 text-muted-foreground">
                Write your document and add fields as named badges, just like email templates.
              </p>
            </div>
            <Badge variant="neutral">Rich text editor</Badge>
          </div>

          {!selectedTable ? <p className="border-b border-border-soft px-6 py-4 text-sm text-muted-foreground">Select an entity above to start creating your template.</p> : null}
          <div className="flex flex-wrap items-center gap-2 border-b border-border-soft px-4 py-3">
            <ToolbarButton label="Undo" showLabel onClick={() => applyEditorCommand('undo')} icon={<Undo2 className="h-4 w-4" />} />
            <ToolbarButton label="Redo" showLabel onClick={() => applyEditorCommand('redo')} icon={<Redo2 className="h-4 w-4" />} />
            <span aria-hidden="true" className="mx-1 h-5 w-px bg-border-soft" />
            <ToolbarButton label="Bold" onClick={() => applyEditorCommand('bold')} icon={<Bold className="h-4 w-4" />} />
            <ToolbarButton label="Italic" onClick={() => applyEditorCommand('italic')} icon={<Italic className="h-4 w-4" />} />
            <ToolbarButton label="Underline" onClick={() => applyEditorCommand('underline')} icon={<Underline className="h-4 w-4" />} />
            <ToolbarButton label="Heading 1" onClick={() => applyEditorCommand('formatBlock', '<h1>')} icon={<Heading1 className="h-4 w-4" />} />
            <ToolbarButton label="Heading 2" onClick={() => applyEditorCommand('formatBlock', '<h2>')} icon={<Heading2 className="h-4 w-4" />} />
            <ToolbarButton label="Paragraph" onClick={() => applyEditorCommand('formatBlock', '<p>')} icon={<Type className="h-4 w-4" />} />
            <ToolbarButton label="Bullet list" onClick={() => applyEditorCommand('insertUnorderedList')} icon={<List className="h-4 w-4" />} />
            <ToolbarButton label="Numbered list" onClick={() => applyEditorCommand('insertOrderedList')} icon={<ListOrdered className="h-4 w-4" />} />
            <ToolbarButton label="Align left" onClick={() => applyEditorCommand('justifyLeft')} icon={<AlignLeft className="h-4 w-4" />} />
            <ToolbarButton label="Align center" onClick={() => applyEditorCommand('justifyCenter')} icon={<AlignCenter className="h-4 w-4" />} />
            <ToolbarButton label="Align right" onClick={() => applyEditorCommand('justifyRight')} icon={<AlignRight className="h-4 w-4" />} />
          </div>

          <div className="bg-[linear-gradient(180deg,rgba(248,250,252,0.8)_0%,rgba(255,255,255,0.92)_100%)] p-6 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.45)_0%,rgba(15,23,42,0.2)_100%)]">
            <div className="relative overflow-hidden rounded-[28px] border border-primary/20 bg-white shadow-[0_22px_70px_rgba(15,23,42,0.08)] dark:bg-slate-950/70">
              <div
                ref={editorRef}
                contentEditable={Boolean(selectedTable)}
                role="textbox"
                aria-label="Document template body"
                aria-multiline="true"
                suppressContentEditableWarning
                dir="ltr"
                className="document-workspace prose prose-slate relative z-[1] max-w-none min-h-[560px] rounded-[28px] px-10 py-10 text-[15px] leading-7 outline-none [direction:ltr] [unicode-bidi:plaintext] prose-headings:tracking-[-0.02em] prose-h1:text-[2rem] prose-h1:font-semibold prose-h2:text-[1.45rem] prose-h2:font-semibold prose-p:my-3 prose-p:text-[15px] prose-p:leading-7 dark:prose-invert"
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
            </div>
          </div>
        </Card>

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
              <StatCard label="With content" value={contentTemplateCount} />
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
                  <th className="px-6 py-4 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Entity</th>
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
                    <td className="px-6 py-4 align-middle text-sm">{fieldTables.find((table) => table.name === readDocumentTemplate(template.content).entity)?.label || 'Not assigned'}</td>
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
                        <Button type="button" variant="ghost" size="sm" disabled={logoBusy} className="bg-white dark:bg-[#1E293B]" onClick={() => loadTemplateIntoWorkspace(template)}>
                          <Eye className="h-4 w-4" />
                          Load in workspace
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="bg-white text-danger hover:bg-danger/10 hover:text-danger dark:bg-[#1E293B]"
                          disabled={logoBusy}
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

function ToolbarButton({ onClick, icon, label, showLabel = false }: { onClick: () => void; icon: ReactNode; label: string; showLabel?: boolean }) {
  return (
    <Button type="button" variant="ghost" size="sm" className="rounded-xl" aria-label={label} title={label} onMouseDown={(event) => event.preventDefault()} onClick={onClick}>
      {icon}
      {showLabel ? <span>{label}</span> : null}
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
