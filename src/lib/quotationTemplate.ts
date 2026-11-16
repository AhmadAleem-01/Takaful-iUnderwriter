import DOMPurify from 'dompurify'
import { decorateTemplateFields } from './templateFieldBadges'
import { parseTemplateFieldPath, templateLookupContextKey, TEMPLATE_FIELD_TOKEN_SOURCE } from './templateFieldPaths'
import { DOCUMENT_LOGO_ATTRIBUTES, readDocumentTemplateLogo } from './documentTemplateLogo'
import { PAGE_SETUP_ATTRIBUTES, PAGE_SETUP_PREVIEW_STYLES, pageSetupPreviewMarkup, readDocumentPageSetup } from './documentPageSetup'

export type QuotationTemplateContext = Record<string, Record<string, unknown>>

const tokenPattern = new RegExp(`${TEMPLATE_FIELD_TOKEN_SOURCE}|\\{\\{\\s*\\w+\\.\\w+\\s*\\}\\}`, 'gi')
const entityGroups: Record<string, string> = { aur_quote: 'Quote', aur_inquiry: 'Inquiry', aur_products: 'Product', aur_plan: 'Plan' }
const safeStyles = new Set(['text-align', 'font-weight', 'font-style', 'text-decoration', 'color', 'background-color', 'font-size', 'line-height', 'width', 'height', 'max-width', 'max-height', 'object-fit', 'object-position', 'padding', 'margin', 'border', 'border-collapse', 'vertical-align'])

export function sanitizeQuotationHtml(html: string) {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'blockquote', 'hr', 'img', 'a', 'sup', 'sub'],
    ALLOWED_ATTR: ['style', 'src', 'alt', 'href', 'colspan', 'rowspan', 'data-merge-chip', 'data-template-token', 'contenteditable', 'class', 'title', 'aria-label', ...DOCUMENT_LOGO_ATTRIBUTES, ...PAGE_SETUP_ATTRIBUTES],
    ALLOW_DATA_ATTR: false,
  })
  const root = document.createElement('div')
  root.innerHTML = clean
  for (const element of root.querySelectorAll<HTMLElement>('*')) {
    if (element.hasAttribute('data-merge-chip') || element.hasAttribute('data-template-token')) {
      element.className = element.hasAttribute('data-template-token') ? 'template-field-badge' : 'merge-chip'
      element.setAttribute('contenteditable', 'false')
    } else {
      element.removeAttribute('class')
      element.removeAttribute('contenteditable')
    }
    // Keep source formatting without CSS URLs, positioning, or application classes.
    for (const property of Array.from(element.style)) {
      if (!safeStyles.has(property) || /url\s*\(|expression\s*\(/i.test(element.style.getPropertyValue(property))) {
        element.style.removeProperty(property)
      }
    }
    if (element.tagName === 'IMG' && !/^data:image\/(png|jpeg|gif|webp);base64,/i.test(element.getAttribute('src') ?? '')) {
      element.replaceWith(document.createTextNode(element.getAttribute('alt') || '[Image omitted: embed the image in the template]'))
    }
  }
  return root.innerHTML
}

export function renderQuotationTemplate(html: string, context: QuotationTemplateContext) {
  const root = document.createElement('div')
  // Remove editor chip styling before sanitizing so tokens become ordinary document text.
  root.innerHTML = DOMPurify.sanitize(html)
  for (const badge of root.querySelectorAll('[data-template-token]')) badge.replaceWith(document.createTextNode(badge.getAttribute('data-template-token') ?? ''))
  for (const chip of root.querySelectorAll('[data-merge-chip]')) chip.replaceWith(document.createTextNode(chip.textContent ?? ''))
  root.innerHTML = sanitizeQuotationHtml(root.innerHTML)
  const missing = new Set<string>()
  const unsupported = new Set<string>()
  for (const element of root.querySelectorAll('*')) {
    for (const attribute of Array.from(element.attributes)) {
      for (const match of attribute.value.matchAll(tokenPattern)) unsupported.add(match[0])
    }
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)
  for (const match of (root.textContent ?? '').matchAll(/\{\{[^{}]*\}\}|\{![^{}]*\}/g)) {
    if ((!/^\{\{\s*\w+\.\w+\s*\}\}$/.test(match[0]) && !parseTemplateFieldPath(match[0])) || !nodes.some((node) => node.textContent?.includes(match[0]))) missing.add(match[0])
  }
  let resolvedCount = 0
  for (const node of nodes) {
    node.textContent = (node.textContent ?? '').replace(tokenPattern, (token) => {
      const canonical = parseTemplateFieldPath(token)
      const legacy = /^\{\{\s*(\w+)\.(\w+)\s*\}\}$/.exec(token)
      if (!canonical && !legacy) { missing.add(token); return token }
      const group = canonical?.lookups.length ? templateLookupContextKey(canonical.entity, canonical.lookups)
        : canonical ? entityGroups[canonical.entity] ?? canonical.entity : legacy![1]
      const field = canonical ? canonical.field : legacy![2]
      const format = canonical?.format
      const record = Object.hasOwn(context, group) ? context[group] : undefined
      let value = record && Object.hasOwn(record, field) ? record[field] : undefined
      if (record && format === 'name') {
        value = record[`${field}name`]
          ?? record[`${field}@OData.Community.Display.V1.FormattedValue`]
          ?? record[`_${field}_value@OData.Community.Display.V1.FormattedValue`]
          ?? (typeof value === 'boolean' ? value ? 'Yes' : 'No' : undefined)
      }
      if (format === 'date' || format === 'time') {
        const date = typeof value === 'string' ? new Date(value) : new Date(NaN)
        value = Number.isNaN(date.getTime()) ? undefined : format === 'date'
          ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
          : new Intl.DateTimeFormat('en-GB', { timeStyle: 'short', timeZone: 'UTC' }).format(date)
      }
      if (value == null || value === '' || (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean')) {
        missing.add(token)
        return token
      }
      if (typeof value === 'number' && !Number.isFinite(value)) {
        missing.add(token)
        return token
      }
      resolvedCount += 1
      return typeof value === 'number'
        ? new Intl.NumberFormat('en-AE', { maximumFractionDigits: 2 }).format(value)
        : String(value)
    })
  }
  return { html: root.innerHTML, missingFields: [...missing], unsupportedFields: [...unsupported], resolvedCount, hasContent: Boolean(root.textContent?.trim() || root.querySelector('img')) }
}

export function quotationDocumentHtml(content: string, fieldLabels?: ReadonlyMap<string, string>) {
  const page = readDocumentPageSetup(sanitizeQuotationHtml(content))
  // Older logo-only templates keep their existing presentation until saved in Page setup.
  const hasPageSetup = /data-document-page-setup/.test(content)
  const { body, logo } = readDocumentTemplateLogo(sanitizeQuotationHtml(content))
  const root = document.createElement('div')
  root.innerHTML = body
  if (fieldLabels) decorateTemplateFields(root, fieldLabels)
  let pageMarkup = ''
  if (hasPageSetup) {
    const sheet = document.createElement('div')
    sheet.innerHTML = pageSetupPreviewMarkup(page.body, page.setup)
    if (fieldLabels) decorateTemplateFields(sheet, fieldLabels)
    pageMarkup = sheet.innerHTML
  }
  let logoHtml = ''
  if (logo) {
    const image = document.createElement('img')
    image.src = logo.src
    image.alt = 'Template logo'
    image.style.cssText = `width:${logo.width}px;max-width:100%;max-height:${logo.placement === 'watermark' ? 480 : 64}px;object-fit:contain;object-position:${logo.placement === 'watermark' ? 'center' : logo.align}`
    const container = document.createElement('div')
    container.className = `document-logo document-logo-${logo.placement}`
    container.style.justifyContent = logo.placement === 'watermark' || logo.align === 'center' ? 'center' : logo.align === 'right' ? 'flex-end' : 'flex-start'
    if (logo.placement === 'watermark') container.style.opacity = String(logo.opacity)
    container.append(image)
    logoHtml = container.outerHTML
  }
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><style>
  *{box-sizing:border-box}body{margin:0;background:white;color:#172033;font:14px/1.6 Arial,Helvetica,sans-serif;overflow-wrap:anywhere}main{padding:32px}
  h1{font-size:28px;line-height:1.2;color:#154675;margin:0 0 24px}h2{font-size:18px;color:#154675;margin:24px 0 10px}h3,h4{margin:18px 0 8px}p{margin:0 0 14px;white-space:pre-wrap}
  table{border-collapse:collapse;width:100%;margin:16px 0}td,th{border:1px solid #d9e2ec;padding:10px;text-align:left;white-space:pre-wrap}th{background:#edf3f8}img{max-width:100%;height:auto}li{white-space:pre-wrap}blockquote{border-left:3px solid #d9e2ec;margin-left:0;padding-left:16px}
  .template-field-badge{display:inline-block;border:1px solid #b9d1ef;border-radius:999px;padding:1px 10px;background:#edf4ff;color:#154675;font-size:13px;font-weight:600}
  .document-page{position:relative;display:flex;flex-direction:column;min-height:1123px;isolation:isolate}.document-body{position:relative;z-index:1;flex:1}.document-logo{display:flex;position:relative;z-index:1;flex-shrink:0}.document-logo-header{margin-bottom:24px}.document-logo-footer{margin-top:24px}.document-logo-watermark{position:absolute;inset:32px;z-index:0;align-items:center;pointer-events:none}
  ${PAGE_SETUP_PREVIEW_STYLES}
  </style></head><body><main${hasPageSetup ? ' class="page-setup-main"' : logo ? ' class="document-page"' : ''}>${hasPageSetup ? pageMarkup : logo ? `${logo.placement !== 'footer' ? logoHtml : ''}<div class="document-body">${root.innerHTML}</div>${logo.placement === 'footer' ? logoHtml : ''}` : root.innerHTML}</main></body></html>`
}
