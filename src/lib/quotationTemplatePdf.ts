import { jsPDF } from 'jspdf'
import { quotationDocumentHtml } from './quotationTemplate'
import { documentLogoSize, readDocumentTemplateLogo } from './documentTemplateLogo'

export async function createQuotationTemplatePdf(html: string) {
  if (/data-document-page-setup/.test(html)) {
    const { createDocumentPageSetupPdf } = await import('./documentPageSetupPdf')
    return createDocumentPageSetupPdf(html)
  }
  const { body, logo } = readDocumentTemplateLogo(html)
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.setAttribute('sandbox', 'allow-same-origin')
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;'
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('The quotation preview took too long to load. Please retry.')), 15000)
      frame.onload = () => { window.clearTimeout(timeout); resolve() }
      frame.srcdoc = quotationDocumentHtml(body)
      document.body.appendChild(frame)
    })
    const content = frame.contentDocument?.querySelector('main')
    const frameWindow = frame.contentWindow
    if (!content || !frameWindow) throw new Error('Unable to prepare the quotation PDF.')
    await Promise.all(Array.from(content.querySelectorAll('img'), async (image) => {
      try { await image.decode() } catch { throw new Error('An embedded document image could not be loaded. Replace it before downloading.') }
    }))
    // jsPDF clones the content into the app document. Inline computed styles so
    // the isolated preview's stylesheet and inherited fonts survive that clone.
    const properties = ['box-sizing', 'display', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'color', 'background-color', 'text-align', 'text-decoration', 'white-space', 'overflow-wrap', 'vertical-align', 'border-collapse', 'list-style-type', ...['top', 'right', 'bottom', 'left'].flatMap((side) => [`margin-${side}`, `padding-${side}`, `border-${side}-width`, `border-${side}-style`, `border-${side}-color`])]
    for (const element of [content, ...content.querySelectorAll<HTMLElement>('*')]) {
      const computed = frameWindow.getComputedStyle(element)
      for (const property of properties) element.style.setProperty(property, computed.getPropertyValue(property))
      if (['TABLE', 'TH', 'TD', 'IMG'].includes(element.tagName)) element.style.width = computed.width
    }
    content.style.width = '794px'
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
    let logoSubscription: string | undefined
    if (logo) {
      const image = new Image()
      image.src = logo.src
      try { await image.decode() } catch { throw new Error('The template logo could not be loaded. Replace it before downloading.') }
      const size = documentLogoSize(logo, image.naturalWidth, image.naturalHeight)
      const width = size.width * 186 / 794
      const height = size.height * 186 / 794
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const x = logo.placement === 'watermark' || logo.align === 'center' ? (pageWidth - width) / 2 : logo.align === 'right' ? pageWidth - 12 - width : 12
      const y = logo.placement === 'watermark' ? (pageHeight - height) / 2 : logo.placement === 'footer' ? pageHeight - 12 - height : 12
      const stampLogo = () => {
        pdf.saveGraphicsState()
        if (logo.placement === 'watermark') pdf.setGState(pdf.GState({ opacity: logo.opacity }))
        pdf.addImage(logo.src, logo.src.startsWith('data:image/png') ? 'PNG' : 'JPEG', x, y, width, height, 'template-logo', 'FAST')
        pdf.restoreGraphicsState()
      }
      // Paint before page text, including pages created by jsPDF auto-paging.
      stampLogo()
      logoSubscription = pdf.internal.events.subscribe('addPage', stampLogo)
    }
    try {
      await pdf.html(content, {
        margin: [logo?.placement === 'header' ? 35 : 12, 12, logo?.placement === 'footer' ? 35 : 12, 12],
        x: 0,
        y: 0,
        width: 186,
        windowWidth: 794,
        autoPaging: 'text',
        html2canvas: { backgroundColor: null, logging: false },
      })
    } finally {
      if (logoSubscription) pdf.internal.events.unsubscribe(logoSubscription)
    }
    return pdf
  } finally {
    frame.remove()
  }
}

export async function downloadQuotationTemplatePdf(html: string, quoteName: string) {
  const pdf = await createQuotationTemplatePdf(html)
  const fileName = `${quoteName.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '').slice(0, 100) || 'quotation'}.pdf`
  pdf.save(fileName)
}
