import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { PAGE_HEIGHT, PAGE_MARGIN, PAGE_WIDTH, pageBackgroundGeometry, readDocumentPageSetup, type PageBackground } from './documentPageSetup'
import { quotationDocumentHtml, sanitizeQuotationHtml } from './quotationTemplate'

const pxToMm = 210 / PAGE_WIDTH

export async function renderPageBackground(background: PageBackground) {
  const image = new Image(); image.src = background.src
  try { await image.decode() } catch { throw new Error('The page background could not be loaded. Replace it before downloading.') }
  const canvas = document.createElement('canvas'); canvas.width = PAGE_WIDTH * 2; canvas.height = PAGE_HEIGHT * 2
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Unable to prepare the page background.')
  ctx.scale(2, 2); ctx.globalAlpha = background.opacity
  const geometry = pageBackgroundGeometry(background, image.naturalWidth, image.naturalHeight)
  const { area, box, width, height, x, y, boxX, boxY } = geometry
  ctx.beginPath(); ctx.rect(area.x, area.y, area.width, area.height); ctx.clip()
  if (background.fit === 'fill') { ctx.beginPath(); ctx.rect(boxX, boxY, box.width, box.height); ctx.clip() }
  if (background.fit === 'tile') {
    const columns = Math.ceil(area.width / width) + 1, rows = Math.ceil(area.height / height) + 1
    if (columns * rows > 20000) throw new Error('This image is too thin to tile. Increase the background size or choose Fit.')
    const startX = x - Math.ceil((x - area.x) / width) * width
    const startY = y - Math.ceil((y - area.y) / height) * height
    for (let row = startY; row < area.y + area.height; row += height) for (let column = startX; column < area.x + area.width; column += width) ctx.drawImage(image, column, row, width, height)
  } else ctx.drawImage(image, x, y, width, height)
  return canvas.toDataURL('image/png')
}

export async function createDocumentPageSetupPdf(html: string) {
  const clean = sanitizeQuotationHtml(html)
  const { setup } = readDocumentPageSetup(clean)
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true'); frame.setAttribute('sandbox', 'allow-same-origin')
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAGE_WIDTH}px;height:${PAGE_HEIGHT}px;border:0;`
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('The document preview took too long to load. Please retry.')), 15000)
      frame.onload = () => { window.clearTimeout(timeout); resolve() }
      frame.srcdoc = quotationDocumentHtml(clean); document.body.appendChild(frame)
    })
    const doc = frame.contentDocument, frameWindow = frame.contentWindow
    const content = doc?.querySelector<HTMLElement>('.page-setup-body')
    if (!doc || !frameWindow || !content) throw new Error('Unable to prepare the page layout.')
    await Promise.all(Array.from(doc.querySelectorAll('img'), async (image) => { try { await image.decode() } catch { throw new Error('An image in the template could not be loaded. Replace it before downloading.') } }))
    const parts: Array<{ src: string; height: number; placement: 'header' | 'footer' }> = []
    for (const placement of ['header', 'footer'] as const) {
      const part = doc.querySelector<HTMLElement>(`.page-setup-${placement}`)
      if (!part || (!part.textContent?.trim() && !part.querySelector('img'))) continue
      // Canvas text baselines may extend below the final line box in Chromium.
      // Include a small transparent buffer so descenders and the last line stay intact.
      part.style.paddingBottom = '12px'
      const height = Math.ceil(part.getBoundingClientRect().height)
      if (height > 160) throw new Error(`The ${placement} is too tall for repeated page content. Reduce its text, image size, or font size.`)
      const canvas = await html2canvas(part, { backgroundColor: null, scale: 2, logging: false })
      parts.push({ src: canvas.toDataURL('image/png'), height: height * pxToMm, placement })
    }
    const background = setup.background && setup.background.opacity > 0 ? await renderPageBackground(setup.background) : null
    // Render only the document body through auto-paging; repeating parts are stamped independently.
    content.style.cssText = `width:${PAGE_WIDTH - PAGE_MARGIN * 2}px;min-height:0;flex:none;position:static;`
    const sheet = content.parentElement!
    for (const child of Array.from(sheet.children)) if (child !== content) child.remove()
    sheet.style.cssText = `width:${PAGE_WIDTH - PAGE_MARGIN * 2}px;min-height:0;padding:0;display:block;`
    const properties = ['box-sizing', 'display', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'color', 'background-color', 'text-align', 'text-decoration', 'white-space', 'overflow-wrap', 'vertical-align', 'border-collapse', 'list-style-type', ...['top', 'right', 'bottom', 'left'].flatMap((side) => [`margin-${side}`, `padding-${side}`, `border-${side}-width`, `border-${side}-style`, `border-${side}-color`])]
    for (const element of [content, ...content.querySelectorAll<HTMLElement>('*')]) {
      const computed = frameWindow.getComputedStyle(element)
      for (const property of properties) element.style.setProperty(property, computed.getPropertyValue(property))
      if (['TABLE', 'TH', 'TD', 'IMG'].includes(element.tagName)) { element.style.width = computed.width; element.style.height = computed.height }
    }
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
    const margin = PAGE_MARGIN * pxToMm
    const stamp = () => {
      pdf.saveGraphicsState()
      if (background) pdf.addImage(background, 'PNG', 0, 0, 210, 297, 'page-background', 'FAST')
      for (const part of parts) pdf.addImage(part.src, 'PNG', margin, part.placement === 'header' ? margin : 297 - margin - part.height, 210 - margin * 2, part.height, `page-${part.placement}`, 'FAST')
      pdf.restoreGraphicsState()
    }
    stamp()
    const subscription = pdf.internal.events.subscribe('addPage', stamp)
    try {
      await pdf.html(content, {
        margin: [margin + (parts.find((part) => part.placement === 'header')?.height ?? 0) + (setup.headerHtml ? 20 * pxToMm : 0), margin, margin + (parts.find((part) => part.placement === 'footer')?.height ?? 0) + (setup.footerHtml ? 20 * pxToMm : 0), margin],
        x: 0, y: 0, width: 210 - margin * 2, windowWidth: PAGE_WIDTH - PAGE_MARGIN * 2, autoPaging: 'text',
        html2canvas: { backgroundColor: null, logging: false, ignoreElements: (element) => element.tagName === 'IFRAME' },
      })
    } finally { pdf.internal.events.unsubscribe(subscription) }
    return pdf
  } finally { frame.remove() }
}
