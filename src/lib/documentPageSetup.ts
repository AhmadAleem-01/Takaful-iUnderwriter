import { readDocumentTemplateLogo } from './documentTemplateLogo'

export const PAGE_WIDTH = 794
export const PAGE_HEIGHT = 1123
export const PAGE_MARGIN = 45
export const PAGE_SETUP_ATTRIBUTES = ['data-document-page-setup', 'data-page-header', 'data-page-footer', 'data-page-background', 'data-image-name', 'data-image-opacity', 'data-image-size', 'data-image-fit', 'data-image-position', 'data-image-bleed']
export const PAGE_POSITIONS = ['top-left', 'top-center', 'top-right', 'center-left', 'center', 'center-right', 'bottom-left', 'bottom-center', 'bottom-right'] as const
export interface PageBackground {
  src: string
  name: string
  opacity: number
  size: number
  fit: 'fit' | 'fill' | 'tile'
  position: typeof PAGE_POSITIONS[number]
  bleed: boolean
}
export interface DocumentPageSetup { headerHtml: string; footerHtml: string; background: PageBackground | null }
export const emptyPageSetup = (): DocumentPageSetup => ({ headerHtml: '', footerHtml: '', background: null })
const clamp = (n: number, min: number, max: number, fallback: number) => Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback

export function normalizePageBackground(value: PageBackground): PageBackground | null {
  if (!/^data:image\/(png|jpeg);base64,[a-z0-9+/]+={0,2}$/i.test(value.src) || value.src.length > 700000) return null
  return {
    src: value.src, name: (value.name || 'Background image').replace(/[{}]/g, '').slice(0, 160),
    opacity: clamp(value.opacity, 0, 1, 0.15), size: clamp(value.size, 10, 100, 30),
    fit: ['fit', 'fill', 'tile'].includes(value.fit) ? value.fit : 'fit',
    position: PAGE_POSITIONS.includes(value.position) ? value.position : 'center', bleed: value.bleed === true,
  }
}

/** Reads the page layout independently from editable body HTML, including earlier saved logos. */
export function readDocumentPageSetup(content: string) {
  const root = document.createElement('div')
  root.innerHTML = content
  const markers = [...root.querySelectorAll('[data-document-page-setup]')]
  const marker = markers.find((item) => item.getAttribute('data-document-page-setup') === 'v1')
  const setup = emptyPageSetup()
  if (marker) {
    setup.headerHtml = marker.querySelector('[data-page-header]')?.innerHTML ?? ''
    setup.footerHtml = marker.querySelector('[data-page-footer]')?.innerHTML ?? ''
    const background = marker.querySelector('[data-page-background]')
    if (background) setup.background = normalizePageBackground({
      src: background.querySelector('img')?.getAttribute('src') ?? '', name: background.getAttribute('data-image-name') ?? '',
      opacity: Number(background.getAttribute('data-image-opacity') ?? 0.15), size: Number(background.getAttribute('data-image-size') ?? 30),
      fit: background.getAttribute('data-image-fit') as PageBackground['fit'], position: background.getAttribute('data-image-position') as PageBackground['position'],
      bleed: background.getAttribute('data-image-bleed') === 'true',
    })
  }
  markers.forEach((item) => item.remove())
  const legacy = readDocumentTemplateLogo(root.innerHTML)
  if (!marker && legacy.logo) {
    const logo = legacy.logo
    if (logo.placement === 'watermark') setup.background = { src: logo.src, name: 'Template logo', opacity: logo.opacity, size: clamp(logo.width / (PAGE_WIDTH - 2 * PAGE_MARGIN) * 100, 10, 100, 30), fit: 'fit', position: 'center', bleed: false }
    else {
      const part = document.createElement('p')
      part.style.textAlign = logo.align
      const image = document.createElement('img')
      image.src = logo.src; image.alt = 'Template logo'
      image.style.cssText = `width:${logo.width}px;max-height:64px;object-fit:contain;object-position:${logo.align}`
      part.append(image)
      setup[logo.placement === 'header' ? 'headerHtml' : 'footerHtml'] = part.outerHTML
    }
  }
  return { body: legacy.body, setup, configured: Boolean(marker || legacy.logo) }
}

export function writeDocumentPageSetup(body: string, setup: DocumentPageSetup) {
  const content = readDocumentPageSetup(body).body
  const marker = document.createElement('div')
  marker.setAttribute('data-document-page-setup', 'v1')
  for (const [attribute, html] of [['data-page-header', setup.headerHtml], ['data-page-footer', setup.footerHtml]]) {
    const part = document.createElement('div'); part.setAttribute(attribute, ''); part.innerHTML = html; marker.append(part)
  }
  if (setup.background) {
    const background = normalizePageBackground(setup.background)
    if (!background) throw new Error('Choose a valid embedded PNG or JPEG background image.')
    const part = document.createElement('div'); part.setAttribute('data-page-background', '')
    for (const [key, value] of Object.entries({ name: background.name, opacity: background.opacity, size: background.size, fit: background.fit, position: background.position, bleed: background.bleed })) part.setAttribute(`data-image-${key}`, String(value))
    const image = document.createElement('img'); image.src = background.src; image.alt = 'Page background'; part.append(image); marker.append(part)
  }
  return marker.outerHTML + content
}

export function pagePositionFractions(position: PageBackground['position']) {
  return { x: position.includes('left') ? 0 : position.includes('right') ? 1 : 0.5, y: position.startsWith('top') ? 0 : position.startsWith('bottom') ? 1 : 0.5 }
}

/** Shared geometry for the live preview and PDF background raster. */
export function pageBackgroundGeometry(background: PageBackground, imageWidth: number, imageHeight: number) {
  const inset = background.bleed ? 0 : PAGE_MARGIN
  const area = { x: inset, y: inset, width: PAGE_WIDTH - inset * 2, height: PAGE_HEIGHT - inset * 2 }
  const position = pagePositionFractions(background.position)
  const box = { width: area.width * background.size / 100, height: area.height * background.size / 100 }
  const scale = background.fit === 'fill' ? Math.max(box.width / imageWidth, box.height / imageHeight) : Math.min(box.width / imageWidth, box.height / imageHeight)
  const width = background.fit === 'tile' ? box.width : imageWidth * scale
  const height = background.fit === 'tile' ? width * imageHeight / imageWidth : imageHeight * scale
  return { area, box, width, height, x: area.x + (area.width - width) * position.x, y: area.y + (area.height - height) * position.y, boxX: area.x + (area.width - box.width) * position.x, boxY: area.y + (area.height - box.height) * position.y }
}

/** Call only with sanitized body/header/footer HTML. Style values come from normalized settings. */
export function pageSetupPreviewMarkup(body: string, setup: DocumentPageSetup) {
  const page = document.createElement('div'); page.className = 'page-setup-sheet'
  const bg = setup.background
  if (bg) {
    const position = pagePositionFractions(bg.position)
    const layer = document.createElement('div'); layer.className = 'page-setup-background'
    layer.style.cssText = `position:absolute;inset:${bg.bleed ? 0 : PAGE_MARGIN}px;overflow:hidden;opacity:${bg.opacity};pointer-events:none;z-index:0`
    if (bg.fit === 'tile') {
      layer.style.backgroundImage = `url("${bg.src}")`; layer.style.backgroundSize = `${bg.size}% auto`; layer.style.backgroundPosition = `${position.x * 100}% ${position.y * 100}%`
    } else {
      const image = document.createElement('img'); image.src = bg.src; image.alt = ''
      image.style.cssText = `position:absolute;width:${bg.size}%;height:${bg.size}%;max-width:none;max-height:none;object-fit:${bg.fit === 'fill' ? 'cover' : 'contain'};object-position:${position.x * 100}% ${position.y * 100}%;left:${(100 - bg.size) * position.x}%;top:${(100 - bg.size) * position.y}%`
      layer.append(image)
    }
    page.append(layer)
  }
  for (const [className, html] of [['page-setup-header', setup.headerHtml], ['page-setup-body', body], ['page-setup-footer', setup.footerHtml]]) {
    const part = document.createElement('div'); part.className = className; part.innerHTML = html; page.append(part)
  }
  return page.outerHTML
}

export const PAGE_SETUP_PREVIEW_STYLES = `main.page-setup-main{padding:0}.page-setup-sheet{position:relative;isolation:isolate;display:flex;flex-direction:column;width:${PAGE_WIDTH}px;min-height:${PAGE_HEIGHT}px;padding:${PAGE_MARGIN}px;background:transparent}.page-setup-header,.page-setup-footer,.page-setup-body{position:relative;z-index:1;min-width:0}.page-setup-body{flex:1}.page-setup-header,.page-setup-footer{font-size:12px;line-height:1.5;flex-shrink:0}.page-setup-header,.page-setup-footer,.page-setup-header :not(.template-field-badge),.page-setup-footer :not(.template-field-badge){color:#000!important}.page-setup-header:not(:empty){margin-bottom:20px}.page-setup-footer:not(:empty){margin-top:20px}.page-setup-header p,.page-setup-footer p{margin:0 0 6px}.page-setup-header img,.page-setup-footer img{vertical-align:middle;max-width:100%}`
