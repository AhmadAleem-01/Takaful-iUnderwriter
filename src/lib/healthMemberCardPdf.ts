import { jsPDF } from 'jspdf'
import autoTable, { type UserOptions } from 'jspdf-autotable'
import type { InquiryDetail, QuoteDetail } from '../domain/app'
import type { QuotePlanLinkedSection } from '../services/quotesService'
import { loadImageData, type QuotePdfFormValues } from './quotePdf'
import { healthQuoteData } from './healthQuoteData'
import { evaluationNumber, evaluationRows, evaluationText } from './healthAiEvaluation'

interface HealthQuotePdfInput {
  detail: QuoteDetail
  inquiry: InquiryDetail
  form: QuotePdfFormValues
  planName: string
  planSections: QuotePlanLinkedSection[]
  healthLogoSrc: string
  nextcareLogoSrc: string
}

const ink: [number, number, number] = [17, 66, 77]
const muted: [number, number, number] = [80, 98, 103]
function clean(value: unknown) {
  return evaluationText(value, 'Not available').replace(/[\u2010-\u2015]/g, '-').replace(/\s+/g, ' ').trim()
}
function amount(value: unknown) {
  const number = evaluationNumber(value)
  return number === null ? 'Not available' : `AED ${new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number)}`
}
function rate(value: unknown) {
  const number = evaluationNumber(value)
  return number === null ? 'Not available' : `${number}%`
}

export async function createHealthQuotePdf({ detail, inquiry, form, planName, planSections, healthLogoSrc, nextcareLogoSrc }: HealthQuotePdfInput) {
  const [healthLogo, nextcareLogo] = await Promise.all([loadImageData(healthLogoSrc), loadImageData(nextcareLogoSrc)])
  const data = healthQuoteData(inquiry)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [190, 125], compress: true })
  const width = doc.internal.pageSize.getWidth(), height = doc.internal.pageSize.getHeight()
  const margin = { left: 7, right: 7, top: 27, bottom: 10 }
  const pageMembers = new Map<number, string>()
  let y = margin.top
  const base: UserOptions = {
    margin, theme: 'plain', rowPageBreak: 'avoid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.3, textColor: ink, overflow: 'linebreak', valign: 'top' },
    headStyles: { fontStyle: 'bold', textColor: ink, fillColor: false, lineColor: [170, 190, 194], lineWidth: { bottom: 0.2 } },
  }
  function table(options: UserOptions, memberName: string) {
    autoTable(doc, { ...base, ...options, startY: y, didDrawPage: () => { pageMembers.set(doc.getCurrentPageInfo().pageNumber, memberName) } })
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 1.5
  }
  function divider() {
    doc.setDrawColor(110, 144, 151); doc.setLineWidth(0.25)
    doc.line(margin.left, y, width - margin.right, y); y += 1.5
  }
  const columns = { 0: { cellWidth: 32, fontStyle: 'bold' as const }, 1: { cellWidth: 61 }, 2: { cellWidth: 32, fontStyle: 'bold' as const } }
  pageMembers.set(1, 'Inquiry Overview')
  table({ body: [
    ['Quote', clean(form.name || detail.name)],
    ['Inquiry', clean(inquiry.inquiryNumber)],
    ['Plan', clean(planName || detail.planName)],
    ['Contact Email', clean(data.email)],
  ], columnStyles: { 0: { cellWidth: 27, fontStyle: 'bold' }, 1: { cellWidth: 'auto' } } }, 'Inquiry Overview')
  divider()
  table({ body: [
    ['Applicant', clean(data.applicantName), 'Age / Gender', `${data.applicantAge} / ${data.applicantGender}`],
    ['Email', clean(data.email), 'Mobile', clean(data.mobile)],
  ], columnStyles: columns }, 'Inquiry Overview')
  divider()
  table({ body: [
    ['TPA', clean(data.tpa), 'Network', clean(data.network)],
    ['Network Charge', data.networkAdjustment, 'VAT Rate', rate(form.vat)],
    ['Coverage Type', clean(data.coverage), 'Members', String(data.members.length)],
    ['Gross Premium', amount(inquiry.grossPremium), 'Premium to be Charged', amount(data.premiumToCharge)],
  ], columnStyles: columns }, 'Inquiry Overview')
  divider()
  const members = data.members.length ? data.members : [null]
  members.forEach((member) => {
    doc.addPage()
    y = margin.top
    const memberName = member?.name ?? 'Member details not available'
    pageMembers.set(doc.getCurrentPageInfo().pageNumber, memberName)
    const premium = member?.premium ?? {}
    const percentage = evaluationNumber(premium.totalAdditionalPercentage)
    table({ body: [
      ['Name', memberName, 'Age / Gender', member ? `${member.age} / ${member.gender}` : 'Not available'],
      ['Relationship', member?.relationship ?? 'Not available', 'Network', clean(data.network)],
      ['Conditions', member?.conditions.length ? member.conditions.join(', ') : 'No declared conditions supplied.', 'Adjustment', data.networkAdjustment],
      ['Base Premium', amount(premium.basePremium), 'Additional Charges', `${percentage === null ? '' : `${percentage}% - `}${amount(premium.totalAdditionalCharges)}`],
      ['Final Premium', amount(premium.finalPremium), '', ''],
    ], columnStyles: columns }, memberName)
    divider()
    const charges = evaluationRows(premium.additionalCharges)
    table({ head: [['Applicable Premium Loading', 'Rate', 'Amount']], body: charges.length
      ? charges.map((charge) => [clean(charge.ruleName), rate(charge.percentage), amount(charge.amount)])
      : [['No additional loading rules supplied.', '-', '-']],
    columnStyles: { 0: { cellWidth: 127 }, 1: { cellWidth: 15, halign: 'center' }, 2: { cellWidth: 34, halign: 'right' } },
    bodyStyles: { fontSize: 7.5 },
    }, memberName)
    const coverages = planSections.find((section) => section.key === 'coverages')?.records ?? []
    table({ head: [['Coverages']], body: coverages.length
      ? coverages.map((coverage) => [clean(coverage.name)])
      : [['No coverages linked to the selected plan.']],
    }, memberName)
  })
  function drawLogo(image: typeof healthLogo, x: number, boxWidth: number) {
    const scale = Math.min(boxWidth / image.width, 14 / image.height)
    const w = image.width * scale, h = image.height * scale
    doc.addImage(image.dataUrl, 'PNG', x, 5 + (14 - h) / 2, w, h, undefined, 'FAST')
  }
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page)
    drawLogo(healthLogo, margin.left, 62)
    const rightWidth = Math.min(48, 14 * nextcareLogo.width / nextcareLogo.height)
    drawLogo(nextcareLogo, width - margin.right - rightWidth, 48)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...muted)
    doc.text('HEALTH INSURANCE QUOTE', margin.left, 23)
    doc.text(clean(pageMembers.get(page) ?? '').slice(0, 65), width - margin.right, 23, { align: 'right' })
    doc.setDrawColor(170, 190, 194); doc.line(margin.left, height - 8, width - margin.right, height - 8)
    doc.setFontSize(6.5)
    doc.text('Quotation only. Subject to insurer terms and underwriting confirmation.', margin.left, height - 4)
    doc.text(`${page}/${doc.getNumberOfPages()}`, width - margin.right, height - 4, { align: 'right' })
  }
  return doc
}

export async function generateHealthQuotePdf(input: HealthQuotePdfInput) {
  const doc = await createHealthQuotePdf(input)
  const name = (input.form.name || input.detail.name || 'Health Insurance Quote').replace(/[<>:"/\\|?*]+/g, '-').replace(/\s+/g, ' ').trim()
  const fileName = `${name}.pdf`
  const uri = doc.output('datauristring')
  await doc.save(fileName, { returnPromise: true })
  return { fileName, contentBytes: uri.slice(uri.indexOf(',') + 1) }
}
