import { TEMPLATE_FIELD_TOKEN_SOURCE, parseTemplateFieldPath } from './templateFieldPaths'

const ENTITY_ATTRIBUTE = 'data-document-template-entity'
const LEGACY_ENTITIES: Record<string, string> = { Quote: 'aur_quote', Inquiry: 'aur_inquiry', Product: 'aur_products', Plan: 'aur_plan', BusinessRule: 'aur_business_rules' }

export function documentTemplateFieldEntities(content: string): string[] {
  const entities = new Set<string>()
  for (const match of content.matchAll(new RegExp(TEMPLATE_FIELD_TOKEN_SOURCE, 'gi'))) {
    const path = parseTemplateFieldPath(match[0])
    if (path) entities.add(path.entity)
  }
  for (const match of content.matchAll(/\{\{(\w+)\.\w+\}\}/g)) {
    if (LEGACY_ENTITIES[match[1]]) entities.add(LEGACY_ENTITIES[match[1]])
  }
  return [...entities]
}

export function readDocumentTemplate(content: string) {
  const root = new DOMParser().parseFromString(content, 'text/html').body
  const wrapper = root.firstElementChild
  const explicitEntity = wrapper?.getAttribute(ENTITY_ATTRIBUTE)
  if (wrapper && explicitEntity && /^[a-z][a-z0-9_]*$/i.test(explicitEntity)) {
    return { entity: explicitEntity, body: wrapper.innerHTML }
  }
  const entities = documentTemplateFieldEntities(content)
  // Existing mixed quote templates remain usable before being assigned an entity.
  return { entity: entities.includes('aur_quote') ? 'aur_quote' : entities.length === 1 ? entities[0] : '', body: content }
}

export function writeDocumentTemplate(entity: string, body: string) {
  if (!/^[a-z][a-z0-9_]*$/i.test(entity)) throw new Error('Select an entity for this document template.')
  return `<div ${ENTITY_ATTRIBUTE}="${entity}">${body}</div>`
}

export function isQuotationDocumentTemplate(content: string) {
  const { entity } = readDocumentTemplate(content)
  return !entity || entity === 'aur_quote'
}
