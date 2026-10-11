import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatAmount } from './formatters'
import type { QuoteDetail } from '../domain/app'
import type { QuotePlanLinkedSection } from '../services/quotesService'

interface QuotePdfFormValues {
  name: string
  totalPremium: string
  grossPremium: string
  vat: string
  loadingPremium: string
  reason: string
  aiSummary: string
  quoteStatus: 'QuoteWon' | 'QuoteLost' | ''
}

interface GenerateQuotePdfInput {
  detail: QuoteDetail
  form: QuotePdfFormValues
  planSections: QuotePlanLinkedSection[]
  headerImageSrc: string
}

export async function generateQuotePdf({
  detail,
  form,
  planSections,
  headerImageSrc,
}: GenerateQuotePdfInput) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const margins = {
    left: 12,
    right: 12,
    top: 58,
    bottom: 14,
  }

  const headerImage = await loadImageData(headerImageSrc)
  const availableHeaderWidth = pageWidth - margins.left - margins.right
  const headerHeight = Math.min(40, (availableHeaderWidth * headerImage.height) / headerImage.width)
  const headerWidth = headerHeight * headerImage.width / headerImage.height

  const drawHeader = () => {
    doc.addImage(
      headerImage.dataUrl,
      'PNG',
      (pageWidth - headerWidth) / 2,
      8,
      headerWidth,
      headerHeight,
      undefined,
      'FAST',
    )
    doc.setDrawColor(222, 232, 240)
    doc.line(margins.left, 8 + headerHeight + 2, pageWidth - margins.right, 8 + headerHeight + 2)
  }

  const baseTableOptions = {
    margin: margins,
    didDrawPage: drawHeader,
    theme: 'grid' as const,
    styles: {
      font: 'helvetica',
      fontSize: 9,
      textColor: [31, 41, 55] as [number, number, number],
      cellPadding: 2.8,
      lineColor: [223, 229, 237] as [number, number, number],
      lineWidth: 0.2,
      overflow: 'linebreak' as const,
      valign: 'middle' as const,
    },
    headStyles: {
      fillColor: [15, 76, 129] as [number, number, number],
      textColor: [255, 255, 255] as [number, number, number],
      fontStyle: 'bold' as const,
      fontSize: 9,
    },
  }

  const statusLabel =
    form.quoteStatus === 'QuoteWon'
      ? 'Quote Won'
      : form.quoteStatus === 'QuoteLost'
        ? 'Quote Lost'
        : detail.status || 'Open'

  drawHeader()

  let currentY = margins.top
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(15, 23, 42)
  doc.text('Quotation', margins.left, currentY)
  currentY += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  doc.setTextColor(71, 85, 105)
  doc.text(safeText(form.name || detail.name || 'Insurance Quote'), margins.left, currentY)
  currentY += 4

  autoTable(doc, {
    ...baseTableOptions,
    startY: currentY + 3,
    columnStyles: {
      0: { cellWidth: 30, fontStyle: 'bold', textColor: [71, 85, 105] },
      1: { cellWidth: 60 },
      2: { cellWidth: 28, fontStyle: 'bold', textColor: [71, 85, 105] },
      3: { cellWidth: 'auto' },
    },
    body: [
      ['Quote Name', safeText(form.name || detail.name), 'Status', statusLabel],
      ['Inquiry', safeText(detail.inquiry?.name || 'No linked inquiry'), 'Inquiry No.', safeText(detail.inquiry?.inquiryNumber || 'N/A')],
      ['Client', safeText(detail.inquiry?.accountName || 'Valued Client'), 'Product', safeText(detail.productName || 'N/A')],
      ['Plan', safeText(detail.planName || 'N/A'), 'Created On', formatDateForPdf(detail.createdOn)],
    ],
  })
  currentY = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? currentY) + 4

  autoTable(doc, {
    ...baseTableOptions,
    startY: currentY,
    head: [['Gross Premium', 'Loading Premium', 'VAT', 'Total Premium']],
    body: [[
      formatCurrencyForPdf(form.grossPremium),
      formatCurrencyForPdf(form.loadingPremium),
      `${formatAmount(form.vat)}%`,
      formatCurrencyForPdf(form.totalPremium),
    ]],
    styles: {
      ...baseTableOptions.styles,
      halign: 'center' as const,
      fontSize: 10,
    },
    bodyStyles: {
      fillColor: [247, 250, 252] as [number, number, number],
      textColor: [15, 23, 42] as [number, number, number],
      fontStyle: 'bold' as const,
    },
  })
  currentY = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? currentY) + 5

  autoTable(doc, {
    ...baseTableOptions,
    startY: currentY,
    head: [['Quotation Summary']],
    body: [[safeText(form.aiSummary || detail.aiSummary || 'No AI summary available for this quotation.')]],
    styles: {
      ...baseTableOptions.styles,
      minCellHeight: 18,
    },
    bodyStyles: {
      fillColor: [255, 255, 255] as [number, number, number],
      textColor: [51, 65, 85] as [number, number, number],
    },
  })
  currentY = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? currentY) + 5

  if (form.reason?.trim()) {
    autoTable(doc, {
      ...baseTableOptions,
      startY: currentY,
      head: [['Underwriting Notes']],
      body: [[safeText(form.reason)]],
      styles: {
        ...baseTableOptions.styles,
        minCellHeight: 16,
      },
      bodyStyles: {
        fillColor: [255, 255, 255] as [number, number, number],
      },
    })
    currentY = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? currentY) + 5
  }

  if (detail.responses.length > 0) {
    autoTable(doc, {
      ...baseTableOptions,
      startY: currentY,
      head: [['Captured Field', 'Response']],
      body: detail.responses.map((response) => [
        safeText(response.name || response.businessRuleName || 'Field'),
        safeText(response.response || 'No response captured.'),
      ]),
      columnStyles: {
        0: { cellWidth: 62, fontStyle: 'bold' },
        1: { cellWidth: 'auto' },
      },
    })
    currentY = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? currentY) + 5
  }

  planSections.forEach((section) => {
    autoTable(doc, {
      ...baseTableOptions,
      startY: currentY,
      head: [[section.title, `${section.records.length} item${section.records.length === 1 ? '' : 's'}`]],
      body:
        section.records.length > 0
          ? section.records.map((record, index) => [`${index + 1}`, safeText(record.name)])
          : [['-', `No ${section.title.toLowerCase()} records linked to this plan.`]],
      columnStyles: {
        0: { cellWidth: 22, halign: 'center' },
        1: { cellWidth: 'auto' },
      },
    })
    currentY = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? currentY) + 4
  })

  doc.save(`${buildPdfFileName(form.name || detail.name)}.pdf`)
}

async function loadImageData(src: string) {
  const dataUrl = src.startsWith('data:')
    ? src
    : await fetch(src)
        .then((response) => {
          if (!response.ok) {
            throw new Error('Unable to load the quotation header image.')
          }
          return response.blob()
        })
        .then(blobToDataUrl)

  return cropLogoWhitespace(dataUrl)
}

// The supplied logo includes large blank margins; crop those before sizing the PDF header.
async function cropLogoWhitespace(dataUrl: string) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image()
    element.onload = () => resolve(element)
    element.onerror = () => reject(new Error('Unable to load the quotation logo.'))
    element.src = dataUrl
  })
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d')
  if (!context) return { dataUrl, width: image.width, height: image.height }
  context.drawImage(image, 0, 0)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
  let left = image.width, top = image.height, right = -1, bottom = -1
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const offset = (y * image.width + x) * 4
      if (pixels[offset + 3] > 20 && Math.min(pixels[offset], pixels[offset + 1], pixels[offset + 2]) < 240) {
        left = Math.min(left, x)
        right = Math.max(right, x)
        top = Math.min(top, y)
        bottom = Math.max(bottom, y)
      }
    }
  }
  if (right < left) return { dataUrl, width: image.width, height: image.height }
  const cropped = document.createElement('canvas')
  cropped.width = right - left + 1
  cropped.height = bottom - top + 1
  cropped.getContext('2d')!.drawImage(image, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height)
  return { dataUrl: cropped.toDataURL('image/png'), width: cropped.width, height: cropped.height }
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Unable to read the quotation header image.'))
    reader.readAsDataURL(blob)
  })
}


function safeText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function formatCurrencyForPdf(value: string) {
  const amount = Number(value) || 0
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDateForPdf(value?: string) {
  if (!value) return 'N/A'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'N/A'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function buildPdfFileName(value: string) {
  return safeText(value || 'quotation')
    .replace(/[<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}
