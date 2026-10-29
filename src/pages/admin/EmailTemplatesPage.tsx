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
import { cn } from '../../lib/cn'
import { formatDate } from '../../lib/formatters'
import { TemplatesService } from '../../generated/services/TemplatesService'
import {
  Templatestemplatetypecode,
  type Templates,
} from '../../generated/models/TemplatesModel'

type TemplateCategory = (typeof Templatestemplatetypecode)[keyof typeof Templatestemplatetypecode]
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

const CATEGORY_OPTIONS = Object.entries(Templatestemplatetypecode).map(([value, label]) => ({
  value,
  label,
}))

const PLACEHOLDERS = [
  { label: 'Customer Name', token: '{{customer_name}}' },
  { label: 'Policy Number', token: '{{policy_number}}' },
  { label: 'Insurance Type', token: '{{insurance_type}}' },
  { label: 'Premium Amount', token: '{{premium_amount}}' },
  { label: 'Due Date', token: '{{due_date}}' },
  { label: 'Agent Name', token: '{{agent_name}}' },
  { label: 'Company Name', token: '{{company_name}}' },
  { label: 'Quote Amount', token: '{{quote_amount}}' },
]

const EMPTY_DRAFT: TemplateDraft = {
  templateName: '',
  subject: '',
  description: '',
  body: '<p>Write your email content here. Use the toolbar above for formatting and insert placeholders for dynamic content.</p>',
  categoryKey: 'Quote',
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

  const { data, loading, error } = useAsyncData(async () => {
    const result = await TemplatesService.getAll({
      orderBy: ['modifiedon desc', 'createdon desc'],
    })
    return (result.data ?? []).map(mapTemplateRecord)
  }, [refreshKey])

  useEffect(() => {
    if (editorMode !== 'visual' || !editorOpen || !editorRef.current) return
    editorRef.current.innerHTML = draft.body
  }, [editorMode, editorOpen, editorSyncKey])

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

  function openCreate() {
    setDraft(EMPTY_DRAFT)
    setEditorMode('visual')
    setSubmitError(null)
    setEditorSyncKey((value) => value + 1)
    setEditorOpen(true)
  }

  function openEdit(template: TemplateRecord) {
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
      ? editorRef.current?.innerHTML?.trim() || draft.body.trim()
      : draft.body.trim()

    if (!draft.templateName.trim() || !draft.subject.trim() || !visualBody || !draft.categoryKey) {
      setSubmitError('Template name, subject, category, and email body are required.')
      return
    }

    setSubmitBusy(true)
    setSubmitError(null)

    const categoryValue = CATEGORY_OPTIONS.find((option) => option.label === draft.categoryKey)?.value

    try {
      const payload = {
        title: draft.templateName.trim(),
        subject: draft.subject.trim(),
        description: draft.description.trim() || undefined,
        body: visualBody,
        languagecode: 1033,
        templatetypecode: Number(categoryValue) as keyof typeof Templatestemplatetypecode,
        ispersonal: false,
      }

      if (draft.id) {
        await TemplatesService.update(draft.id, payload)
      } else {
        await TemplatesService.create(payload as never)
      }

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

  function applyEditorCommand(command: string, value?: string) {
    if (!editorRef.current) return
    editorRef.current.focus()
    document.execCommand(command, false, value)
    setDraft((current) => ({
      ...current,
      body: editorRef.current?.innerHTML ?? current.body,
    }))
  }

  function insertPlaceholder(token: string) {
    if (editorMode === 'html') {
      setDraft((current) => ({
        ...current,
        body: `${current.body}${current.body.endsWith(' ') ? '' : ' '}${token}`,
      }))
      return
    }
    applyEditorCommand('insertText', token)
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
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
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

      <ModalShell open={editorOpen} onClose={() => setEditorOpen(false)} widthClassName="max-w-[780px]">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[28px] font-semibold tracking-[-0.02em]">
                {draft.id ? 'Edit Email Template' : 'Create Email Template'}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {draft.id
                  ? 'Modify the email template details below.'
                  : 'Create a reusable email template for customer communications.'}
              </p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => setEditorOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
            <Field label="Template Name *">
              <Input
                value={draft.templateName}
                onChange={(event) => setDraft((current) => ({ ...current, templateName: event.target.value }))}
                placeholder="e.g., Welcome Email"
              />
            </Field>
            <Field label="Category">
              <Select
                value={draft.categoryKey}
                onValueChange={(value) => setDraft((current) => ({ ...current, categoryKey: value as TemplateCategory | '' }))}
                options={[
                  { value: '', label: 'No Category' },
                  ...CATEGORY_OPTIONS.map((option) => ({ value: option.label, label: option.label })),
                ]}
              />
            </Field>
          </div>

          <Field label="Subject Line *">
            <Input
              value={draft.subject}
              onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))}
              placeholder="e.g., Your insurance quote is ready!"
            />
          </Field>

          <Field label="Description">
            <Input
              value={draft.description}
              onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
              placeholder="Brief description of when to use this template"
            />
          </Field>

          <Field label="Email Body *">
            <div className="space-y-3 rounded-[24px] border border-border-soft bg-surface-soft/65 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <ToolbarButton onClick={() => applyEditorCommand('bold')} icon={<Bold className="h-4 w-4" />} />
                  <ToolbarButton onClick={() => applyEditorCommand('italic')} icon={<Italic className="h-4 w-4" />} />
                  <ToolbarButton onClick={() => applyEditorCommand('underline')} icon={<Underline className="h-4 w-4" />} />
                  <ToolbarButton onClick={() => applyEditorCommand('formatBlock', '<h1>')} icon={<Heading1 className="h-4 w-4" />} />
                  <ToolbarButton onClick={() => applyEditorCommand('formatBlock', '<h2>')} icon={<Heading2 className="h-4 w-4" />} />
                  <ToolbarButton onClick={() => applyEditorCommand('insertUnorderedList')} icon={<List className="h-4 w-4" />} />
                  <ToolbarButton onClick={() => applyEditorCommand('insertOrderedList')} icon={<ListOrdered className="h-4 w-4" />} />
                  <ToolbarButton onClick={() => applyEditorCommand('justifyLeft')} icon={<AlignLeft className="h-4 w-4" />} />
                  <ToolbarButton onClick={() => applyEditorCommand('justifyCenter')} icon={<AlignCenter className="h-4 w-4" />} />
                  <ToolbarButton
                    onClick={() => {
                      const url = window.prompt('Enter URL')
                      if (!url) return
                      applyEditorCommand('createLink', url)
                    }}
                    icon={<Link2 className="h-4 w-4" />}
                  />
                  <ToolbarButton onClick={() => applyEditorCommand('formatBlock', '<blockquote>')} icon={<Quote className="h-4 w-4" />} />
                  <ToolbarButton onClick={() => applyEditorCommand('formatBlock', '<pre>')} icon={<Code2 className="h-4 w-4" />} />
                </div>

                <div className="inline-flex rounded-full border border-border-soft bg-white p-1 dark:bg-white/[0.04]">
                  <Button
                    type="button"
                    variant={editorMode === 'visual' ? 'primary' : 'ghost'}
                    size="sm"
                    className="rounded-full"
                    onClick={() => {
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
                    onClick={() => setEditorMode('html')}
                  >
                    HTML
                  </Button>
                </div>
              </div>

              <div className="rounded-[22px] border border-border-soft bg-white p-4 dark:bg-slate-950/60">
                {editorMode === 'visual' ? (
                  <div
                    ref={editorRef}
                    contentEditable
                    dir="ltr"
                    suppressContentEditableWarning
                    className="min-h-[210px] prose prose-sm max-w-none text-left text-sm outline-none [direction:ltr] [unicode-bidi:plaintext] dark:prose-invert"
                    onInput={(event) =>
                      setDraft((current) => ({
                        ...current,
                        body: event.currentTarget.innerHTML,
                      }))
                    }
                  />
                ) : (
                  <textarea
                    dir="ltr"
                    value={draft.body}
                    onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
                    className="min-h-[210px] w-full resize-y rounded-2xl border border-border-soft bg-transparent px-3 py-3 text-left text-sm outline-none [direction:ltr] [unicode-bidi:plaintext]"
                  />
                )}
              </div>

              <div className="rounded-[22px] border border-border-soft bg-white p-4 dark:bg-slate-950/40">
                <p className="text-sm font-semibold">Insert Placeholder:</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {PLACEHOLDERS.map((placeholder) => (
                    <button
                      key={placeholder.token}
                      type="button"
                      className="rounded-full border border-border-soft bg-surface px-3 py-2 text-sm font-medium transition hover:border-primary/30 hover:text-primary"
                      onClick={() => insertPlaceholder(placeholder.token)}
                    >
                      {placeholder.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Field>

          {submitError ? <p className="text-sm text-danger">{submitError}</p> : null}

          <div className="flex flex-wrap justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitBusy}>
              {submitBusy ? 'Saving...' : draft.id ? 'Save Template' : 'Create Template'}
            </Button>
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
    subject: record.subject ?? '',
    description: record.description ?? '',
    body: record.body ?? '<p>No content captured.</p>',
    categoryKey:
      (record.templatetypecodename as TemplateCategory | undefined) ??
      Templatestemplatetypecode[record.templatetypecode],
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

function ToolbarButton({ onClick, icon }: { onClick: () => void; icon: ReactNode }) {
  return (
    <Button type="button" variant="ghost" size="sm" className="rounded-xl" onClick={onClick}>
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
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</span>
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
