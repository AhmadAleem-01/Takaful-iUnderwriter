import type { TemplateFieldTable } from './emailTemplateFields'
import { parseTemplateFieldPath, TEMPLATE_FIELD_TOKEN_SOURCE } from './templateFieldPaths'

type FieldLabels = ReadonlyMap<string, string>
const TOKEN_PATTERN = new RegExp(`${TEMPLATE_FIELD_TOKEN_SOURCE}|\\{\\{[a-z0-9_]+(?:\\.[a-z0-9_]+)?\\}\\}`, 'gi')
const TOKEN_ATTRIBUTE = 'data-template-token'

export function templateFieldLabelMap(tables: TemplateFieldTable[]): Map<string, string> {
  return new Map(tables.flatMap((table) => table.fields.map((field) => [`${table.name}:${field.name}`.toLowerCase(), field.label] as const)))
}

export function templateFieldLabel(token: string, labels: FieldLabels): string {
  const path = parseTemplateFieldPath(token)
  if (path?.lookups.length) {
    let table = path.entity
    const parts = path.lookups.map((step) => {
      const label = labels.get(`${table}:${step.field}`) ?? humanizeField(step.field)
      table = step.table
      return label
    })
    return [...parts, labels.get(`${table}:${path.field}`) ?? humanizeField(path.field)].join(' › ')
  }
  const legacy = /^\{\{(\w+)\.(\w+)\}\}$/.exec(token)
  const legacyTables: Record<string, string> = { Quote: 'aur_quote', Inquiry: 'aur_inquiry', Product: 'aur_products', Plan: 'aur_plan', BusinessRule: 'aur_business_rules' }
  const key = path ? `${path.entity}:${path.field}` : /^\{!([^;]+?)(?:\/@(?:name|date|time))?;\}$/i.exec(token)?.[1]
    ?? (legacy ? `${legacyTables[legacy[1]] ?? legacy[1]}:${legacy[2]}` : undefined)
  const known = key ? labels.get(key.toLowerCase()) : undefined
  if (known) return known
  const field = key?.split(':')[1]?.replace(/^(?:aur|msdyn|new)_/, '') ?? token.replace(/[{}]/g, '')
  return humanizeField(field)
}

function humanizeField(field: string) {
  return field.replace(/^(?:aur|msdyn|new)_/, '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function createTemplateFieldBadge(token: string, label: string, doc: Document): HTMLSpanElement {
  const badge = doc.createElement('span')
  badge.setAttribute(TOKEN_ATTRIBUTE, token)
  badge.setAttribute('contenteditable', 'false')
  badge.setAttribute('class', 'template-field-badge')
  badge.setAttribute('title', `Dynamic field: ${label}`)
  badge.setAttribute('aria-label', `Dynamic field: ${label}`)
  badge.textContent = label
  return badge
}

export function insertTemplateFieldBadgeAtRange(badge: HTMLSpanElement, savedRange: Range, selection: Selection): Range {
  const range = savedRange.cloneRange()
  range.deleteContents()
  // Insert the inline node directly. HTML editing commands may split the current
  // paragraph when inserting a non-editable element at the end of a text run.
  range.insertNode(badge)
  // An explicit text position outside the badge keeps subsequent typing inline
  // and prevents the browser from placing the caret in a new paragraph.
  const caretAnchor = badge.ownerDocument.createTextNode('')
  badge.parentNode!.insertBefore(caretAnchor, badge.nextSibling)
  range.setStart(caretAnchor, 0)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
  return range
}

function visitElements(root: Element, visit: (element: Element) => boolean | void) {
  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType !== 1) continue
    const element = child as Element
    if (visit(element) !== false) visitElements(element, visit)
  }
}

export function refreshTemplateFieldLabels(root: Element, labels: FieldLabels) {
  visitElements(root, (element) => {
    const token = element.getAttribute(TOKEN_ATTRIBUTE)
    if (!token) return
    const label = templateFieldLabel(token, labels)
    if (element.textContent !== label) element.textContent = label
    element.setAttribute('title', `Dynamic field: ${label}`)
    element.setAttribute('aria-label', `Dynamic field: ${label}`)
    return false
  })
}

export function decorateTemplateFields(root: Element, labels: FieldLabels) {
  const doc = root.ownerDocument
  function visit(node: Node) {
    if (node.nodeType === 1) {
      const element = node as Element
      if (element.hasAttribute(TOKEN_ATTRIBUTE) || ['script', 'style', 'textarea'].includes(element.tagName.toLowerCase())) return
    }
    if (node.nodeType === 3) {
      const text = node.nodeValue ?? ''
      const matches = Array.from(text.matchAll(TOKEN_PATTERN))
      if (!matches.length) return
      const fragment = doc.createDocumentFragment()
      let offset = 0
      for (const match of matches) {
        const index = match.index ?? 0
        fragment.appendChild(doc.createTextNode(text.slice(offset, index)))
        fragment.appendChild(createTemplateFieldBadge(match[0], templateFieldLabel(match[0], labels), doc))
        offset = index + match[0].length
      }
      fragment.appendChild(doc.createTextNode(text.slice(offset)))
      node.parentNode?.replaceChild(fragment, node)
      return
    }
    for (const child of Array.from(node.childNodes)) visit(child)
  }
  visit(root)
  refreshTemplateFieldLabels(root, labels)
}

export function serializeTemplateEditorBody(editor: HTMLElement): string {
  const clone = editor.cloneNode(true) as HTMLElement
  visitElements(clone, (element) => {
    const token = element.getAttribute(TOKEN_ATTRIBUTE)
    if (!token) return
    element.parentNode?.replaceChild(clone.ownerDocument.createTextNode(token), element)
    return false
  })
  return clone.innerHTML
}
