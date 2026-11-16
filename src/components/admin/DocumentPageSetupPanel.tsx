import * as Dialog from '@radix-ui/react-dialog'
import { AlignCenter, AlignLeft, AlignRight, Bold, ImagePlus, Italic, List, ListOrdered, LoaderCircle, Maximize2, Underline, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { cn } from '../../lib/cn'
import { PAGE_POSITIONS, PAGE_WIDTH, PAGE_HEIGHT, writeDocumentPageSetup, type DocumentPageSetup, type PageBackground } from '../../lib/documentPageSetup'
import { readDocumentLogoFile } from '../../lib/documentTemplateLogo'
import { quotationDocumentHtml, sanitizeQuotationHtml } from '../../lib/quotationTemplate'
import { createTemplateFieldBadge, decorateTemplateFields, insertTemplateFieldBadgeAtRange, serializeTemplateEditorBody } from '../../lib/templateFieldBadges'
import type { TemplateField } from '../../lib/emailTemplateFields'

interface Props {
  setup: DocumentPageSetup
  body: string
  disabled: boolean
  saved: boolean
  fieldLabels: ReadonlyMap<string, string>
  fields: TemplateField[]
  onChange: (setup: DocumentPageSetup) => void
  onBusyChange: (busy: boolean) => void
}

export function DocumentPageSetupPanel({ setup, body, disabled, saved, fieldLabels, fields, onChange, onBusyChange }: Props) {
  const [uploadBusy, setUploadBusy] = useState(false)
  const [error, setError] = useState('')
  const [zoom, setZoom] = useState<'fit' | number>('fit')
  const [fitScale, setFitScale] = useState(0.6)
  const [layoutWarning, setLayoutWarning] = useState('')
  const viewport = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const upload = useRef(0)
  useEffect(() => () => { upload.current += 1 }, [])
  useEffect(() => {
    const element = viewport.current
    if (!element) return
    const observer = new ResizeObserver(() => setFitScale(Math.max(0.15, Math.min(1, (element.clientWidth - 32) / PAGE_WIDTH))))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const html = useMemo(() => quotationDocumentHtml(writeDocumentPageSetup(body || '<p style="color:#94a3b8">Your document content will appear here.</p>', setup), fieldLabels), [body, setup, fieldLabels])
  const scale = zoom === 'fit' ? fitScale : zoom
  const background = setup.background
  function updateBackground(patch: Partial<PageBackground>) { if (background) onChange({ ...setup, background: { ...background, ...patch } }) }
  async function pickBackground(file?: File) {
    if (!file || disabled || uploadBusy) return
    const request = ++upload.current
    setUploadBusy(true); onBusyChange(true); setError('')
    try {
      const src = await readDocumentLogoFile(file)
      if (request === upload.current) onChange({ ...setup, background: background ? { ...background, src, name: file.name } : { src, name: file.name, opacity: 0.15, size: 30, fit: 'fit', position: 'center', bleed: false } })
    } catch (cause) { if (request === upload.current) setError(cause instanceof Error ? cause.message : 'Unable to read the background image.') }
    finally { if (request === upload.current) { setUploadBusy(false); onBusyChange(false) } }
  }
  return <div className="grid min-w-0 gap-6 xl:grid-cols-[1.15fr_0.9fr]">
    <section className="min-w-0 overflow-hidden rounded-2xl border border-border-soft bg-surface">
      <div className="flex items-center justify-between gap-4 border-b border-border-soft px-6 py-5">
        <div><p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Page</p><h2 className="mt-1 text-xl font-semibold">Page setup</h2></div>
        <span className="text-xs text-muted-foreground">{saved ? 'Saved' : 'Save template to apply changes'}</span>
      </div>
      <div className="space-y-6 p-6">
        <div className="grid min-w-0 gap-5 md:grid-cols-2">
          <PagePartEditor label="Header (letterhead)" section="Header" placeholder="Org name, address..." value={setup.headerHtml} disabled={disabled || uploadBusy} fieldLabels={fieldLabels} fields={fields} onChange={(headerHtml) => onChange({ ...setup, headerHtml })} onBusyChange={onBusyChange} />
          <PagePartEditor label="Footer" section="Footer" placeholder="Contact line, disclaimer..." value={setup.footerHtml} disabled={disabled || uploadBusy} fieldLabels={fieldLabels} fields={fields} onChange={(footerHtml) => onChange({ ...setup, footerHtml })} onBusyChange={onBusyChange} />
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Background image</h3>
          <input ref={fileInput} type="file" className="hidden" aria-label="Upload page background" accept=".png,.jpg,.jpeg,image/png,image/jpeg" disabled={disabled || uploadBusy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; void pickBackground(file) }} />
          {background ? <div className="flex min-w-0 flex-wrap items-center gap-3">
            <img src={background.src} alt="Page background thumbnail" className="h-14 w-14 shrink-0 rounded-lg border border-border-soft bg-white object-contain" />
            <div className="min-w-0 flex-1"><p className="break-all text-sm font-semibold">{background.name}</p><p className="mt-1 text-xs text-muted-foreground">Image background</p></div>
            <Button variant="outline" size="sm" disabled={disabled || uploadBusy} onClick={() => fileInput.current?.click()}>{uploadBusy ? 'Reading...' : 'Replace'}</Button>
            <Button variant="ghost" size="sm" className="text-danger" disabled={disabled || uploadBusy} onClick={() => { onChange({ ...setup, background: null }); setError('') }}>Remove</Button>
          </div> : <Button variant="outline" disabled={disabled || uploadBusy} onClick={() => fileInput.current?.click()}>{uploadBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}{uploadBusy ? 'Reading image...' : 'Upload background image'}</Button>}
          <p className="text-xs text-muted-foreground">PNG or JPEG, up to 2 MB. Use a transparent PNG for a watermark.</p>
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        </div>
        {background ? <fieldset disabled={disabled || uploadBusy} className="grid gap-6 sm:grid-cols-2 disabled:opacity-60">
          <Slider label="Opacity" value={Math.round(background.opacity * 100)} min={0} max={100} onChange={(value) => updateBackground({ opacity: value / 100 })} />
          <Slider label="Size" value={background.size} min={10} max={100} onChange={(size) => updateBackground({ size })} />
          <div className="space-y-3"><p className="text-sm font-semibold">Fit</p><div className="flex flex-wrap gap-1">{(['fit', 'fill', 'tile'] as const).map((fit) => <Button key={fit} type="button" size="sm" variant={background.fit === fit ? 'primary' : 'outline'} aria-pressed={background.fit === fit} aria-label={`Background ${fit}`} onClick={() => updateBackground({ fit })}>{fit[0].toUpperCase() + fit.slice(1)}</Button>)}</div><p className="text-xs leading-5 text-muted-foreground">{background.fit === 'fill' ? 'Fill crops the image to its box.' : background.fit === 'tile' ? 'Repeat the image across the page.' : 'Fit keeps the whole image visible.'}</p></div>
          <div className="space-y-3"><p className="text-sm font-semibold">Position</p><div role="group" aria-label="Background position" className="grid w-fit grid-cols-3 gap-1">{PAGE_POSITIONS.map((position) => <button key={position} type="button" aria-label={`Position ${position.replaceAll('-', ' ')}`} aria-pressed={background.position === position} title={position.replaceAll('-', ' ')} className={cn('h-8 w-8 rounded-md border transition focus-visible:outline-primary', background.position === position ? 'border-primary bg-primary' : 'border-border-soft bg-surface hover:bg-surface-muted')} onClick={() => updateBackground({ position })} />)}</div></div>
          <label className="flex items-center gap-3 text-sm text-muted-foreground sm:col-span-2"><input type="checkbox" className="h-4 w-4 accent-primary" checked={background.bleed} onChange={(event) => updateBackground({ bleed: event.target.checked })} />Bleed to page edge</label>
        </fieldset> : null}
        <p className="text-xs leading-5 text-muted-foreground">Header, footer, and background repeat on every PDF page. Keep header and footer content short to leave room for the document.</p>
      </div>
    </section>
    <section className="min-w-0 overflow-hidden rounded-2xl border border-border-soft bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-soft px-4 py-4">
        <div className="flex items-baseline gap-2"><h3 className="font-semibold">Preview</h3><span className="text-xs text-muted-foreground">A4 · template fields</span></div>
        <div className="flex flex-wrap gap-1">{(['fit', 0.75, 1] as const).map((value) => <Button key={value} variant={zoom === value ? 'secondary' : 'outline'} size="sm" className="h-7 rounded-md px-2" aria-label={`Preview ${value === 'fit' ? 'fit' : `${value * 100}%`}`} aria-pressed={zoom === value} onClick={() => setZoom(value)}>{value === 'fit' ? 'Fit' : `${value * 100}%`}</Button>)}
          <Dialog.Root><Dialog.Trigger asChild><Button variant="outline" size="sm" className="h-7 rounded-md px-2"><Maximize2 className="h-3 w-3" />Full size</Button></Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/50" /><Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex h-[94vh] w-[min(900px,96vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl bg-surface p-4 shadow-xl"><div className="mb-3 flex items-center justify-between"><Dialog.Title className="font-semibold">A4 page preview</Dialog.Title><Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Close full size preview"><X className="h-4 w-4" /></Button></Dialog.Close></div><Dialog.Description className="mb-3 text-xs text-muted-foreground">Fields show their names. Generate a quotation to preview actual record values and PDF pagination.</Dialog.Description><div className="min-h-0 flex-1 overflow-auto bg-surface-muted p-4"><iframe title="Full size page setup preview" sandbox="" srcDoc={html} className="mx-auto border-0 bg-white" style={{ width: PAGE_WIDTH, height: PAGE_HEIGHT }} /></div></Dialog.Content></Dialog.Portal></Dialog.Root>
        </div>
      </div>
      {layoutWarning ? <p role="alert" className="border-b border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">{layoutWarning}</p> : null}
      <div ref={viewport} className="h-[660px] overflow-auto bg-surface-muted/60 p-4">
        <div className="mx-auto bg-white shadow-sm" style={{ width: PAGE_WIDTH * scale, height: PAGE_HEIGHT * scale }}><iframe title="Page setup preview" sandbox="allow-same-origin" srcDoc={html} onLoad={(event) => {
          const doc = event.currentTarget.contentDocument
          const oversized = ['header', 'footer'].filter((part) => (doc?.querySelector(`.page-setup-${part}`)?.getBoundingClientRect().height ?? 0) + 12 > 160)
          setLayoutWarning(oversized.length ? `Reduce the ${oversized.join(' and ')} content or font size before generating a PDF; it is too tall to repeat on every page.` : '')
        }} className="origin-top-left border-0 bg-white" style={{ width: PAGE_WIDTH, height: PAGE_HEIGHT, transform: `scale(${scale})` }} /></div>
      </div>
    </section>
  </div>
}

function Slider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <label className="block space-y-3"><span className="flex items-center justify-between text-sm"><span className="font-semibold">{label}</span><span className="text-muted-foreground">{value}%</span></span><input type="range" aria-label={`Background ${label.toLowerCase()}`} min={min} max={max} step="1" value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-primary" /></label>
}

function PagePartEditor({ label, section, placeholder, value, disabled, fieldLabels, fields, onChange, onBusyChange }: { label: string; section: string; placeholder: string; value: string; disabled: boolean; fieldLabels: ReadonlyMap<string, string>; fields: TemplateField[]; onChange: (value: string) => void; onBusyChange: (busy: boolean) => void }) {
  const editor = useRef<HTMLDivElement>(null)
  const selection = useRef<Range | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const generation = useRef(0)
  useEffect(() => () => { generation.current++ }, [])
  useEffect(() => {
    if (!editor.current) return
    const html = sanitizeQuotationHtml(value)
    if (serializeTemplateEditorBody(editor.current) !== html) { editor.current.innerHTML = html; selection.current = null }
    decorateTemplateFields(editor.current, fieldLabels)
  }, [value, fieldLabels])
  function remember() { const current = window.getSelection(); if (current?.rangeCount && editor.current?.contains(current.getRangeAt(0).commonAncestorContainer)) selection.current = current.getRangeAt(0).cloneRange() }
  function restore() {
    if (!editor.current) return null
    editor.current.focus()
    const range = selection.current && editor.current.contains(selection.current.commonAncestorContainer) ? selection.current.cloneRange() : document.createRange()
    if (!selection.current || !editor.current.contains(range.commonAncestorContainer)) { range.selectNodeContents(editor.current); range.collapse(false) }
    const current = window.getSelection(); current?.removeAllRanges(); current?.addRange(range)
    return range
  }
  function changed() { if (editor.current) { remember(); onChange(serializeTemplateEditorBody(editor.current)) } }
  function command(name: string, argument?: string) { if (disabled || busy) return; restore(); document.execCommand('styleWithCSS', false, 'true'); document.execCommand(name, false, argument); changed() }
  function insertField(token: string) {
    const field = fields.find((item) => item.token === token); const range = restore(); const current = window.getSelection()
    if (!field || !range || !current) return
    selection.current = insertTemplateFieldBadgeAtRange(createTemplateFieldBadge(field.token, field.label, document), range, current)
    changed()
  }
  async function insertLogo(file?: File) {
    if (!file || disabled || busy) return
    const request = ++generation.current
    remember(); setBusy(true); onBusyChange(true); setError('')
    try {
      const src = await readDocumentLogoFile(file)
      if (request !== generation.current) return
      const range = restore()
      if (!range) return
      const image = document.createElement('img'); image.src = src; image.alt = `${section} logo`; image.style.cssText = 'width:160px;max-height:64px;object-fit:contain'
      range.deleteContents(); range.insertNode(image); range.setStartAfter(image); range.collapse(true); selection.current = range
      changed()
    } catch (cause) { if (request === generation.current) setError(cause instanceof Error ? cause.message : 'Unable to read the logo.') }
    finally { if (request === generation.current) { setBusy(false); onBusyChange(false) } }
  }
  const action = (name: string, icon: ReactNode, run: () => void) => <button type="button" title={`${section} ${name}`} aria-label={`${section} ${name}`} disabled={disabled || busy} className="flex h-7 w-7 items-center justify-center rounded hover:bg-surface-muted disabled:opacity-40" onMouseDown={(event) => event.preventDefault()} onClick={run}>{icon}</button>
  return <div className="min-w-0 space-y-2">
    <h3 className="text-sm font-semibold">{label}</h3>
    <div role="toolbar" aria-label={`${section} formatting`} className="flex flex-wrap items-center gap-0.5 rounded-lg border border-border-soft bg-surface-soft p-1">
      {action('bold', <Bold className="h-4 w-4" />, () => command('bold'))}{action('italic', <Italic className="h-4 w-4" />, () => command('italic'))}{action('underline', <Underline className="h-4 w-4" />, () => command('underline'))}
      <select aria-label={`${section} font size`} defaultValue="3" disabled={disabled || busy} className="h-7 w-14 rounded border-0 bg-transparent text-xs" onMouseDown={remember} onChange={(event) => command('fontSize', event.target.value)}><option value="2">12 px</option><option value="3">14 px</option><option value="4">18 px</option><option value="5">24 px</option></select>
      {action('align left', <AlignLeft className="h-4 w-4" />, () => command('justifyLeft'))}{action('align center', <AlignCenter className="h-4 w-4" />, () => command('justifyCenter'))}{action('align right', <AlignRight className="h-4 w-4" />, () => command('justifyRight'))}{action('bullet list', <List className="h-4 w-4" />, () => command('insertUnorderedList'))}{action('numbered list', <ListOrdered className="h-4 w-4" />, () => command('insertOrderedList'))}
      {action('insert logo', busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />, () => { remember(); input.current?.click() })}
    </div>
    <input ref={input} type="file" accept=".png,.jpg,.jpeg" className="hidden" aria-label={`${section} logo file`} disabled={disabled || busy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; void insertLogo(file) }} />
    <div ref={editor} contentEditable={!disabled && !busy} role="textbox" aria-label={`${section} content`} aria-multiline="true" data-placeholder={placeholder} suppressContentEditableWarning onInput={changed} onMouseUp={remember} onKeyUp={remember} onBlur={remember} onPaste={(event) => { event.preventDefault(); restore(); document.execCommand('insertHTML', false, sanitizeQuotationHtml(event.clipboardData.getData('text/html') || event.clipboardData.getData('text/plain').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('\n', '<br>'))); changed() }} className="page-part-editor min-h-24 max-h-48 overflow-y-auto rounded-lg border border-border-soft px-3 py-2 text-sm leading-6 outline-none focus:border-primary [&_img]:max-w-full [&_p]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5" />
    <Select aria-label={`${section} insert field`} value="" placeholder="Insert field" disabled={disabled || busy || !fields.length} options={fields.map((field) => ({ value: field.token, label: field.label }))} onValueChange={insertField} className="h-8 text-xs" />
    {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
  </div>
}
