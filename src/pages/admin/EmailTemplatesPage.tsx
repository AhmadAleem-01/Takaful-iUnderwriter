import {
  AlignCenter,
  AlignLeft,
  Bold,
  CheckCircle2,
  Code2,
  Copy,
  Database,
  Eye,
  Heading1,
  Heading2,
  Italic,
  LibraryBig,
  Link2,
  List,
  ListOrdered,
  Mail,
  MoreVertical,
  PencilLine,
  Plus,
  Quote,
  Search,
  Trash2,
  Underline,
  X,
} from 'lucide-react'
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { TemplateDynamicFieldsPanel, type TemplateInsertionTarget } from '../../components/admin/TemplateDynamicFieldsPanel'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Skeleton } from '../../components/ui/Skeleton'
import { useAsyncData } from '../../hooks/useAsyncData'
import { cn } from '../../lib/cn'
import { formatDate } from '../../lib/formatters'
import { insertTemplateToken, type TemplateFieldTable } from '../../lib/emailTemplateFields'
import {
  createTemplateFieldBadge,
  insertTemplateFieldBadgeAtRange,
  decorateTemplateFields,
  refreshTemplateFieldLabels,
  serializeTemplateEditorBody,
  templateFieldLabel,
  templateFieldLabelMap,
} from '../../lib/templateFieldBadges'
import { TemplatesService } from '../../generated/services/TemplatesService'
import {
  EMAIL_TEMPLATE_CATEGORY_OPTIONS as CATEGORY_OPTIONS,
  emailTemplateCategory,
  emailTemplateDescription,
  saveEmailTemplate,
  type TemplateCategory,
} from '../../services/emailTemplatesService'
import type { Templates } from '../../generated/models/TemplatesModel'
type StatusFilter = 'all' | 'active' | 'inactive'
type EditorMode = 'visual' | 'html'

interface TemplateRecord {
  id: string
  templateName: string
  subject: string
  description: string
  body: string
  categoryKey: TemplateCategory
  isActive: boolean
  createdOn?: string
  updatedOn?: string
}

interface TemplateDraft {
  id?: string
  templateName: string
  subject: string
  description: string
  body: string
  categoryKey: TemplateCategory | ''
}

const EMPTY_DRAFT: TemplateDraft = {
  templateName: '',
  subject: '',
  description: '',
  body: '',
  categoryKey: 'Global',
}

export function EmailTemplatesPage() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'all' | TemplateCategory>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [editorOpen, setEditorOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<EditorMode>('visual')
  const [draft, setDraft] = useState<TemplateDraft>(EMPTY_DRAFT)
  const [previewTemplate, setPreviewTemplate] = useState<TemplateRecord | null>(null)
  const [deleteTemplate, setDeleteTemplate] = useState<TemplateRecord | null>(null)
  const [openActionId, setOpenActionId] = useState<string | null>(null)
  const [submitBusy, setSubmitBusy] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [editorSyncKey, setEditorSyncKey] = useState(0)
  const editorRef = useRef<HTMLDivElement | null>(null)
  const decoratedEditorRef = useRef<HTMLDivElement | null>(null)
  const subjectRef = useRef<HTMLInputElement | null>(null)
  const htmlRef = useRef<HTMLTextAreaElement | null>(null)
  const visualSelectionRef = useRef<Range | null>(null)
  const subjectSelectionRef = useRef<{ start: number; end: number } | null>(null)
  const htmlSelectionRef = useRef<{ start: number; end: number } | null>(null)
  const [insertionTarget, setInsertionTarget] = useState<TemplateInsertionTarget>('body')
  const [fieldTables, setFieldTables] = useState<TemplateFieldTable[]>([])
  const fieldLabels = useMemo(() => templateFieldLabelMap(fieldTables), [fieldTables])

  const rememberVisualSelection = useCallback(() => {
    const selection = window.getSelection()
    if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)
      && editorRef.current.contains(selection.focusNode)) {
      visualSelectionRef.current = selection.getRangeAt(0).cloneRange()
    }
  }, [])

  useEffect(() => {
    if (!editorOpen || editorMode !== 'visual') return
    document.addEventListener('selectionchange', rememberVisualSelection)
    return () => document.removeEventListener('selectionchange', rememberVisualSelection)
  }, [editorOpen, editorMode, rememberVisualSelection])

  const { data, loading, error } = useAsyncData(async () => {
    const result = await TemplatesService.getAll({
      orderBy: ['modifiedon desc', 'createdon desc'],
    })
    if (!result.success || result.error) {
      throw new Error(result.error?.message || 'Unable to load email templates.')
    }
    return (result.data ?? []).map(mapTemplateRecord)
  }, [refreshKey])

  useEffect(() => {
    if (editorMode !== 'visual' || !editorOpen || !editorRef.current) return
    const editor = editorRef.current
    // Drafts keep the actual tokens; badges exist only in the visual editor.
    // Compare canonical HTML so typing never rebuilds the DOM or resets the caret.
    if (decoratedEditorRef.current !== editor || serializeTemplateEditorBody(editor) !== draft.body) {
      editor.innerHTML = draft.body
      decorateTemplateFields(editor, fieldLabels)
      decoratedEditorRef.current = editor
    } else {
      refreshTemplateFieldLabels(editor, fieldLabels)
    }
  }, [draft.body, editorMode, editorOpen, editorSyncKey, fieldLabels])

  useEffect(() => {
    if (!openActionId) return
    const onClick = () => setOpenActionId(null)
    window.addEventListener('click', onClick)
    return () => window.removeEventListener('click', onClick)
  }, [openActionId])

  const templates = useMemo(() => data ?? [], [data])

  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      const matchesSearch = !search.trim() || [template.templateName, template.subject, template.description]
        .join(' ')
        .toLowerCase()
        .includes(search.trim().toLowerCase())

      const matchesCategory = categoryFilter === 'all' || template.categoryKey === categoryFilter
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' ? template.isActive : !template.isActive)

      return matchesSearch && matchesCategory && matchesStatus
    })
  }, [categoryFilter, search, statusFilter, templates])

  const editableTemplateCount = templates.length
  const generatedTemplateCount = 0
  const activeTemplateCount = templates.filter((template) => template.isActive).length

  function resetEditorSelection() {
    visualSelectionRef.current = null
    subjectSelectionRef.current = null
    htmlSelectionRef.current = null
    setInsertionTarget('body')
  }

  function openCreate() {
    resetEditorSelection()
    setDraft(EMPTY_DRAFT)
    setEditorMode('visual')
    setSubmitError(null)
    setEditorSyncKey((value) => value + 1)
    setEditorOpen(true)
  }

  function openEdit(template: TemplateRecord) {
    resetEditorSelection()
    setDraft({
      id: template.id,
      templateName: template.templateName,
      subject: template.subject,
      description: template.description,
      body: template.body,
      categoryKey: template.categoryKey,
    })
    setEditorMode('visual')
    setSubmitError(null)
    setEditorSyncKey((value) => value + 1)
    setEditorOpen(true)
  }

  function openDuplicate(template: TemplateRecord) {
    resetEditorSelection()
    setDraft({
      id: undefined,
      templateName: `${template.templateName} (Copy)`,
      subject: template.subject,
      description: template.description,
      body: template.body,
      categoryKey: template.categoryKey,
    })
    setEditorMode('visual')
    setSubmitError(null)
    setEditorSyncKey((value) => value + 1)
    setEditorOpen(true)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const visualBody = editorMode === 'visual'
      ? (editorRef.current ? serializeTemplateEditorBody(editorRef.current) : draft.body).trim()
      : draft.body.trim()

    if (!draft.templateName.trim() || !draft.subject.trim() || !visualBody || !draft.categoryKey) {
      setSubmitError('Template name, subject, category, and email body are required.')
      return
    }

    setSubmitBusy(true)
    setSubmitError(null)

    try {
      await saveEmailTemplate({ ...draft, body: visualBody })

      setEditorOpen(false)
      setDraft(EMPTY_DRAFT)
      setRefreshKey((value) => value + 1)
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : 'Unable to save the email template.')
    } finally {
      setSubmitBusy(false)
    }
  }

  async function handleDeleteConfirmed() {
    if (!deleteTemplate) return
    try {
      setDeleteBusy(true)
      setDeleteError(null)
      await TemplatesService.delete(deleteTemplate.id)
      setDeleteOpen(false)
      setDeleteTemplate(null)
      setRefreshKey((value) => value + 1)
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : 'Unable to delete the email template.')
    } finally {
      setDeleteBusy(false)
    }
  }

  function restoreVisualSelection() {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    const selection = window.getSelection()
    if (!selection) return
    const saved = visualSelectionRef.current
    const range = saved && editor.contains(saved.commonAncestorContainer) ? saved.cloneRange() : document.createRange()
    if (!saved || !editor.contains(saved.commonAncestorContainer)) {
      range.selectNodeContents(editor)
      range.collapse(false)
    }
    selection.removeAllRanges()
    selection.addRange(range)
  }

  function applyEditorCommand(command: string, value?: string) {
    if (editorMode !== 'visual' || !editorRef.current) return
    restoreVisualSelection()
    document.execCommand(command, false, value)
    const body = serializeTemplateEditorBody(editorRef.current)
    setDraft((current) => ({ ...current, body }))
    rememberVisualSelection()
  }

  function insertPlaceholder(token: string, label?: string) {
    if (insertionTarget === 'subject') {
      const saved = subjectSelectionRef.current
      const next = insertTemplateToken(draft.subject, token, saved?.start, saved?.end)
      setDraft((current) => ({ ...current, subject: next.value }))
      subjectSelectionRef.current = { start: next.caret, end: next.caret }
      requestAnimationFrame(() => {
        subjectRef.current?.focus()
        subjectRef.current?.setSelectionRange(next.caret, next.caret)
      })
      return
    }
    if (editorMode === 'html') {
      const saved = htmlSelectionRef.current
      const next = insertTemplateToken(draft.body, token, saved?.start, saved?.end)
      setDraft((current) => ({ ...current, body: next.value }))
      htmlSelectionRef.current = { start: next.caret, end: next.caret }
      requestAnimationFrame(() => {
        htmlRef.current?.focus()
        htmlRef.current?.setSelectionRange(next.caret, next.caret)
      })
      return
    }
    const badge = createTemplateFieldBadge(token, label ?? templateFieldLabel(token, fieldLabels), document)
    restoreVisualSelection()
    const selection = window.getSelection()
    if (!selection?.rangeCount || !editorRef.current) return
    const range = insertTemplateFieldBadgeAtRange(badge, selection.getRangeAt(0), selection)
    visualSelectionRef.current = range.cloneRange()
    const body = serializeTemplateEditorBody(editorRef.current)
    setDraft((current) => ({ ...current, body }))
  }

  function openPreview(template: TemplateRecord) {
    setPreviewTemplate(template)
    setPreviewOpen(true)
  }

  function statusValueLabel(template: TemplateRecord) {
    return template.isActive ? 'Published' : 'Unpublished'
  }

  return (
    <div className="space-y-6">
      <section className="space-y-5 rounded-[30px] border border-border-soft bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(245,248,252,0.92)_100%)] px-6 py-6 shadow-soft dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.94)_0%,rgba(15,23,42,0.82)_100%)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Insurance platform</p>
            <div className="space-y-2">
              <h1 className="text-[34px] font-bold tracking-[-0.03em]">Email Templates</h1>
              <p className="max-w-3xl text-base leading-8 text-muted-foreground">
                Manage reusable Dataverse email templates for customer communications, with editing and previewing in one workspace.
              </p>
            </div>
          </div>
          <Button type="button" size="lg" className="self-start" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Create Template
          </Button>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.35fr]">
        <Card variant="premium" className="space-y-6 rounded-[28px]">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_160px_160px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search templates..."
                className="pl-11"
              />
            </div>
            <Select
              value={categoryFilter}
              onValueChange={(value) => setCategoryFilter(value as 'all' | TemplateCategory)}
              options={[
                { value: 'all', label: 'All Categories' },
                ...CATEGORY_OPTIONS.map((option) => ({ value: option.label, label: option.label })),
              ]}
            />
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'active', label: 'Published' },
                { value: 'inactive', label: 'Unpublished' },
              ]}
            />
          </div>

          <Card padding="none" className="overflow-hidden rounded-[26px] border border-border-soft">
            <div className="border-b border-border-soft px-5 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Templates</h2>
                  <p className="text-sm text-muted-foreground">
                    {loading ? 'Loading templates...' : `${filteredTemplates.length} templates found`}
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b border-border-soft text-sm text-muted-foreground">
                    <th className="px-5 py-4 font-semibold">Template Name</th>
                    <th className="px-5 py-4 font-semibold">Subject</th>
                    <th className="px-5 py-4 font-semibold">Category</th>
                    <th className="px-5 py-4 font-semibold">Status</th>
                    <th className="px-5 py-4 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, index) => (
                      <tr key={index} className="border-b border-border-soft last:border-b-0">
                        <td className="px-5 py-4"><Skeleton className="h-12 rounded-2xl" /></td>
                        <td className="px-5 py-4"><Skeleton className="h-10 rounded-2xl" /></td>
                        <td className="px-5 py-4"><Skeleton className="h-8 w-24 rounded-full" /></td>
                        <td className="px-5 py-4"><Skeleton className="h-8 w-20 rounded-full" /></td>
                        <td className="px-5 py-4"><Skeleton className="ml-auto h-10 w-10 rounded-full" /></td>
                      </tr>
                    ))
                  ) : filteredTemplates.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12">
                        <div className="rounded-[24px] border border-dashed border-border-soft bg-surface-soft/70 px-6 py-10 text-center">
                          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <Mail className="h-6 w-6" />
                          </div>
                          <h3 className="mt-4 text-lg font-semibold">
                            {templates.length === 0 ? 'No email templates yet' : 'No templates found'}
                          </h3>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {templates.length === 0
                              ? 'Create the first reusable email template for inquiries, quotes, and policy communication.'
                              : 'Adjust search or filter criteria to view a different set of templates.'}
                          </p>
                          {templates.length === 0 ? (
                            <Button type="button" className="mt-5" onClick={openCreate}>
                              <Plus className="h-4 w-4" />
                              Create Template
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredTemplates.map((template) => (
                      <tr key={template.id} className="border-b border-border-soft align-top last:border-b-0">
                        <td className="px-5 py-4">
                          <div className="flex items-start gap-3">
                            <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/8 text-primary">
                              <Mail className="h-4.5 w-4.5" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold">{template.templateName}</p>
                              <p className="mt-1 text-sm text-muted-foreground">{template.description || 'No description captured yet.'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <p className="max-w-[360px] truncate text-sm text-foreground/90">{template.subject}</p>
                        </td>
                        <td className="px-5 py-4">
                          <Badge className={categoryBadgeClass(template.categoryKey)}>{template.categoryKey}</Badge>
                        </td>
                        <td className="px-5 py-4">
                          <div className="inline-flex items-center gap-2 text-sm">
                            <CheckCircle2 className={cn('h-4 w-4', template.isActive ? 'text-primary' : 'text-muted-foreground')} />
                            <span>{statusValueLabel(template)}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="relative flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={(event) => {
                                event.stopPropagation()
                                setOpenActionId((current) => current === template.id ? null : template.id)
                              }}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                            {openActionId === template.id ? (
                              <div
                                className="absolute right-0 top-11 z-20 w-48 rounded-[22px] border border-border-soft bg-surface p-2 shadow-[0_18px_50px_rgba(15,23,42,0.18)]"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <ActionButton onClick={() => { openPreview(template); setOpenActionId(null) }} icon={<Eye className="h-4 w-4" />}>
                                  Preview
                                </ActionButton>
                                <ActionButton onClick={() => { openEdit(template); setOpenActionId(null) }} icon={<PencilLine className="h-4 w-4" />}>
                                  Edit
                                </ActionButton>
                                <ActionButton onClick={() => { openDuplicate(template); setOpenActionId(null) }} icon={<Copy className="h-4 w-4" />}>
                                  Duplicate
                                </ActionButton>
                                <ActionButton
                                  destructive
                                  onClick={() => {
                                    setDeleteTemplate(template)
                                    setDeleteError(null)
                                    setDeleteOpen(true)
                                    setOpenActionId(null)
                                  }}
                                  icon={<Trash2 className="h-4 w-4" />}
                                >
                                  Delete
                                </ActionButton>
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </Card>

        <Card variant="premium" className="space-y-5 rounded-[28px]">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Template sources</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  The current code app is connected to the out-of-the-box Dataverse Template table.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <SourceCard
              title="Editable templates"
              description="Primary templates managed on this page."
              count={editableTemplateCount}
              icon={<Mail className="h-4 w-4" />}
            />
            <SourceCard
              title="Generated library templates"
              description="Secondary source is not connected in the current code app schema yet."
              count={generatedTemplateCount}
              icon={<LibraryBig className="h-4 w-4" />}
              muted
            />
            <SourceCard
              title="Published templates"
              description="Templates currently published in Dataverse."
              count={activeTemplateCount}
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
          </div>
        </Card>
      </div>

      <ModalShell open={editorOpen} onClose={() => { if (!submitBusy) setEditorOpen(false) }} widthClassName="max-w-[1600px]" bodyClassName="overflow-hidden p-0" title={draft.id ? 'Edit Email Template' : 'Create Email Template'}>
        <form onSubmit={handleSubmit} className="flex max-h-[92vh] flex-col">
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border-soft bg-surface px-5 py-5 sm:px-7">
            <div className="flex items-start gap-3">
              <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:flex"><Mail className="h-5 w-5" /></span>
              <div>
              <h2 className="text-2xl font-semibold tracking-[-0.02em]">
                {draft.id ? 'Edit Email Template' : 'Create Email Template'}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Compose your message, then personalize it with dynamic fields.
              </p>
              </div>
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label="Close template editor" disabled={submitBusy} onClick={() => setEditorOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain bg-surface-soft/40 px-5 py-6 sm:px-7">
          <section aria-label="Template details" className="space-y-4 rounded-[24px] border border-border-soft bg-surface p-5">
          <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">Template details</h3><span className="text-xs text-muted-foreground">* Required</span></div>
          <div className="space-y-4">
            <Field label="Template Name *">
              <Input
                aria-label="Template name"
                autoFocus
                value={draft.templateName}
                onChange={(event) => setDraft((current) => ({ ...current, templateName: event.target.value }))}
                placeholder="e.g., Welcome Email"
              />
            </Field>
            <Field label="Category *">
              <Select
                aria-label="Template category"
                value={draft.categoryKey}
                onValueChange={(value) => setDraft((current) => ({ ...current, categoryKey: value as TemplateCategory | '' }))}
                options={[
                  ...CATEGORY_OPTIONS.map((option) => ({ value: option.label, label: option.label })),
                ]}
              />
            </Field>
          </div>

          <Field label="Subject Line *">
            <Input
              aria-label="Email subject"
              ref={subjectRef}
              value={draft.subject}
              onFocus={() => setInsertionTarget('subject')}
              onSelect={(event) => { subjectSelectionRef.current = { start: event.currentTarget.selectionStart ?? draft.subject.length, end: event.currentTarget.selectionEnd ?? draft.subject.length } }}
              onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))}
              placeholder="e.g., Your insurance quote is ready!"
            />
          </Field>

          <Field label="Description">
            <Input
              aria-label="Template description"
              maxLength={2000}
              value={draft.description}
              onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
              placeholder="Brief description of when to use this template"
            />
          </Field>
          </section>

          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_250px] xl:grid-cols-[minmax(0,4fr)_minmax(0,1fr)]">
          <div className="min-w-0">
          <Field label="Email Body *">
            <div className="overflow-hidden rounded-[24px] border border-border-soft bg-surface">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-soft bg-surface-soft/65 p-3">
                <fieldset disabled={editorMode === 'html'} aria-label="Email formatting" className="flex min-w-0 flex-wrap gap-1 disabled:opacity-40">
                  <ToolbarButton label="Bold" onClick={() => applyEditorCommand('bold')} icon={<Bold className="h-4 w-4" />} />
                  <ToolbarButton label="Italic" onClick={() => applyEditorCommand('italic')} icon={<Italic className="h-4 w-4" />} />
                  <ToolbarButton label="Underline" onClick={() => applyEditorCommand('underline')} icon={<Underline className="h-4 w-4" />} />
                  <ToolbarButton label="Heading 1" onClick={() => applyEditorCommand('formatBlock', '<h1>')} icon={<Heading1 className="h-4 w-4" />} />
                  <ToolbarButton label="Heading 2" onClick={() => applyEditorCommand('formatBlock', '<h2>')} icon={<Heading2 className="h-4 w-4" />} />
                  <ToolbarButton label="Bullet list" onClick={() => applyEditorCommand('insertUnorderedList')} icon={<List className="h-4 w-4" />} />
                  <ToolbarButton label="Numbered list" onClick={() => applyEditorCommand('insertOrderedList')} icon={<ListOrdered className="h-4 w-4" />} />
                  <ToolbarButton label="Align left" onClick={() => applyEditorCommand('justifyLeft')} icon={<AlignLeft className="h-4 w-4" />} />
                  <ToolbarButton label="Align center" onClick={() => applyEditorCommand('justifyCenter')} icon={<AlignCenter className="h-4 w-4" />} />
                  <ToolbarButton
                    label="Insert link"
                    onClick={() => {
                      const url = window.prompt('Enter URL')
                      if (!url) return
                      applyEditorCommand('createLink', url)
                    }}
                    icon={<Link2 className="h-4 w-4" />}
                  />
                  <ToolbarButton label="Quote" onClick={() => applyEditorCommand('formatBlock', '<blockquote>')} icon={<Quote className="h-4 w-4" />} />
                  <ToolbarButton label="Code block" onClick={() => applyEditorCommand('formatBlock', '<pre>')} icon={<Code2 className="h-4 w-4" />} />
                </fieldset>

                <div className="inline-flex rounded-full border border-border-soft bg-white p-1 dark:bg-white/[0.04]">
                  <Button
                    type="button"
                    variant={editorMode === 'visual' ? 'primary' : 'ghost'}
                    size="sm"
                    className="rounded-full"
                    onClick={() => {
                      visualSelectionRef.current = null
                      setEditorMode('visual')
                      setEditorSyncKey((value) => value + 1)
                    }}
                  >
                    Visual
                  </Button>
                  <Button
                    type="button"
                    variant={editorMode === 'html' ? 'primary' : 'ghost'}
                    size="sm"
                    className="rounded-full"
                    onClick={() => { htmlSelectionRef.current = null; setEditorMode('html') }}
                  >
                    HTML
                  </Button>
                </div>
              </div>

              <div className="bg-surface px-5 py-6 sm:px-7">
                {editorMode === 'visual' ? (
                  <div
                    ref={editorRef}
                    contentEditable
                    role="textbox"
                    aria-label="Email body"
                    aria-multiline="true"
                    data-placeholder="Write your email here. Add dynamic fields from the sidebar to personalize your message."
                    dir="ltr"
                    suppressContentEditableWarning
                    className="prose prose-sm min-h-[340px] max-w-none break-words rounded-2xl border border-border-soft px-4 py-3 text-left text-sm leading-7 outline-none empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/20 sm:p-5 [direction:ltr] [unicode-bidi:plaintext] dark:prose-invert"
                    onFocus={() => setInsertionTarget('body')}
                    onMouseUp={rememberVisualSelection}
                    onKeyUp={rememberVisualSelection}
                    onBlur={rememberVisualSelection}
                    onInput={(event) => {
                      const body = serializeTemplateEditorBody(event.currentTarget)
                      setDraft((current) => ({
                        ...current,
                        body,
                      }))
                    }}
                  />
                ) : (
                  <textarea
                    ref={htmlRef}
                    aria-label="Email body HTML"
                    placeholder="<p>Write your email here...</p>"
                    dir="ltr"
                    value={draft.body}
                    onFocus={() => setInsertionTarget('body')}
                    onSelect={(event) => { htmlSelectionRef.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd } }}
                    onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
                    className="min-h-[340px] w-full resize-y rounded-2xl border border-border-soft bg-transparent px-4 py-3 text-left font-mono text-sm leading-7 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 [direction:ltr] [unicode-bidi:plaintext]"
                  />
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-soft bg-surface-soft/50 px-5 py-3 text-xs text-muted-foreground"><span>{editorMode === 'visual' ? 'Rich text editor' : 'HTML source'}</span><span>Personalize with fields from the sidebar</span></div>
            </div>
          </Field>
          </div>
          <TemplateDynamicFieldsPanel target={insertionTarget} onTargetChange={setInsertionTarget} onInsert={insertPlaceholder} onTablesLoaded={setFieldTables} />
          </div>
          </div>

          <div className="shrink-0 space-y-3 border-t border-border-soft bg-surface px-5 py-4 sm:px-7">
          {submitError ? <p role="alert" className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{submitError}</p> : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">{submitBusy ? 'Saving your template…' : 'Your template is saved when you select Save template.'}</p>
            <div className="flex gap-3">
            <Button type="button" variant="secondary" disabled={submitBusy} onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitBusy}>
              {submitBusy ? 'Saving...' : 'Save template'}
            </Button>
            </div>
          </div>
          </div>
        </form>
      </ModalShell>

      <ModalShell open={previewOpen && Boolean(previewTemplate)} onClose={() => setPreviewOpen(false)} widthClassName="max-w-[720px]">
        {previewTemplate ? (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[28px] font-semibold tracking-[-0.02em]">Preview: {previewTemplate.templateName}</h2>
                <p className="mt-2 text-sm text-muted-foreground">Review the email template before editing or using it in operational workflows.</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setPreviewOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge className={categoryBadgeClass(previewTemplate.categoryKey)}>{previewTemplate.categoryKey}</Badge>
              <Badge variant={previewTemplate.isActive ? 'approved' : 'neutral'}>{statusValueLabel(previewTemplate)}</Badge>
              <Badge variant="info">Updated {formatDate(previewTemplate.updatedOn || previewTemplate.createdOn)}</Badge>
            </div>

            <Card className="space-y-2 rounded-[24px] bg-surface-soft/65">
              <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Subject</p>
              <p className="text-base font-semibold">{previewTemplate.subject}</p>
            </Card>

            <Card className="rounded-[24px] bg-surface-soft/65">
              <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Body</p>
              <div
                className="prose prose-sm mt-4 max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: previewTemplate.body }}
              />
            </Card>

            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setPreviewOpen(false)}>
                Close
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setPreviewOpen(false)
                  openEdit(previewTemplate)
                }}
              >
                Edit Template
              </Button>
            </div>
          </div>
        ) : null}
      </ModalShell>

      <ModalShell open={deleteOpen && Boolean(deleteTemplate)} onClose={() => setDeleteOpen(false)} widthClassName="max-w-[520px]">
        {deleteTemplate ? (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[28px] font-semibold tracking-[-0.02em]">Delete Email Template</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Are you sure you want to delete <span className="font-semibold text-foreground">{deleteTemplate.templateName}</span>? This action cannot be undone.
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setDeleteOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {deleteError ? <p className="text-sm text-danger">{deleteError}</p> : null}

            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" disabled={deleteBusy} onClick={() => void handleDeleteConfirmed()}>
                {deleteBusy ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        ) : null}
      </ModalShell>

      {error ? (
        <Card className="rounded-[24px] border border-danger/20 bg-danger/5">
          <p className="font-semibold text-danger">Unable to load email templates</p>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </Card>
      ) : null}
    </div>
  )
}

function mapTemplateRecord(record: Templates): TemplateRecord {
  return {
    id: record.templateid,
    templateName: record.title,
    subject: record.subjectsafehtml ?? record.subject ?? '',
    description: emailTemplateDescription(record),
    body: record.safehtml ?? record.body ?? '<p>No content captured.</p>',
    categoryKey: emailTemplateCategory(record),
    isActive: record.componentstate === 0,
    createdOn: record.createdon,
    updatedOn: record.modifiedon,
  }
}

function categoryBadgeClass(category: TemplateCategory) {
  if (category === 'Quote') return 'bg-[#99D6D1] text-[#083344]'
  if (category === 'Account' || category === 'Contact') return 'bg-[#E4ECFF] text-[#1D4ED8]'
  if (category === 'Case' || category === 'ServiceActivity') return 'bg-[#FEE2E2] text-[#B91C1C]'
  return 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-white'
}

function ModalShell({
  open,
  onClose,
  widthClassName,
  bodyClassName,
  title = 'Email template',
  children,
}: {
  open: boolean
  onClose: () => void
  widthClassName: string
  bodyClassName?: string
  title?: string
  children: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose() }}>
      <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm" />
      <Dialog.Content aria-describedby={undefined}
        className={cn(
          'fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[30px] border border-border-soft bg-surface shadow-[0_40px_90px_rgba(15,23,42,0.28)] outline-none',
          widthClassName,
        )}
      >
        <Dialog.Title className="sr-only">{title}</Dialog.Title>
        <div className={cn('max-h-[92vh] overflow-y-auto p-6', bodyClassName)}>{children}</div>
      </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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

function ToolbarButton({ onClick, icon, label }: { onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg" aria-label={label} title={label} onMouseDown={(event) => event.preventDefault()} onClick={onClick}>
      {icon}
    </Button>
  )
}

function SourceCard({
  title,
  description,
  count,
  icon,
  muted = false,
}: {
  title: string
  description: string
  count: number
  icon: ReactNode
  muted?: boolean
}) {
  return (
    <Card className={cn('rounded-[24px] border border-border-soft bg-surface-soft/70', muted && 'opacity-85')}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</span>
            <p className="font-semibold">{title}</p>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-full border border-border-soft bg-white px-3 text-sm font-semibold dark:bg-slate-950/60">
          {count}
        </span>
      </div>
    </Card>
  )
}

function ActionButton({
  children,
  icon,
  destructive = false,
  onClick,
}: {
  children: ReactNode
  icon: ReactNode
  destructive?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition',
        destructive
          ? 'text-danger hover:bg-danger/8'
          : 'text-foreground hover:bg-surface-soft',
      )}
      onClick={onClick}
    >
      {icon}
      {children}
    </button>
  )
}
