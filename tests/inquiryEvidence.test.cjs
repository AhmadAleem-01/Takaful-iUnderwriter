const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
function compile(file, resolve = () => ({})) {
  const context = { exports: {}, require: (name) => name.endsWith('/evidenceSessionCache') ? sessionCache : resolve(name), Uint8Array, TextDecoder, atob, URL }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, context)
  return context.exports
}
const sessionCache = compile('lib/evidenceSessionCache.ts')
const evidence = compile('lib/inquiryEvidence.ts')
const ref = { sourceType: 'Document', documentName: '02_Driving_Licence_Evidence', exactText: 'Document checks\nFront/back supplied' }
const response = { businessRuleId: '{ABC}', businessRuleName: 'Driving licence verification', name: 'Extracted rule' }
const site = 'https://adotdynamicscomau.sharepoint.com/sites/TakafuliUnderwriterDEV'
const cleanPath = '/aur_inquiry/Inquiry for anees.rehman@datanox.io - INQ-1010/10432A26 - HL Quote Slip.pdf'
const duplicatedUrl = `${site}${cleanPath.split('/').map(encodeURIComponent).join('/')}${cleanPath}`

test('shows evidence only for complete Document references and removes duplicates', () => {
  const references = [ref, { ...ref }, { ...ref, sourceType: null }, { ...ref, sourceType: 'Email' }, { ...ref, documentName: ' ' }, { ...ref, exactText: null }]
  assert.equal(evidence.documentEvidence({ evidenceReferences: references }).length, 1)
})

const customerBody = 'Dear All,\r\n\r\nHighlights and Renewal:\r\n* 13 Aircrafts: 5 ACMI\r\nYour offer is -10% differential to Lead – Please note Lead premium panel in\r\nthe WS slip.\r\nKind Regards,\r\nRupert Wilks\r\n'
const customerInformation = `CUSTOMER EMAIL SUBJECT\r\n========================================\r\nAir Senegal 2026 HSL Policy\r\n\r\nCUSTOMER EMAIL SENDER\r\n========================================\r\nbroker@example.com\r\n\r\nCUSTOMER EMAIL RECEIVED (UTC)\r\n========================================\r\n2026-11-04T05:20:56+00:00\r\n\r\nCUSTOMER EMAIL BODY\r\n========================================\r\n${customerBody}\r\n========================================\r\nUPLOADED DOCUMENTS / EXTRACTED CONTENT\r\n\r\n========================================\r\nDOCUMENT NAME: Fleet.xlsx\r\n========================================\r\nEXTRACTED DOCUMENT TEXT:\r\nAttachment-only evidence\r\nEND OF DOCUMENT`

test('reads the customer subject and verbatim body without appended documents', () => {
  const email = evidence.customerEmail(customerInformation)
  assert.equal(email.subject, 'Air Senegal 2026 HSL Policy')
  assert.equal(email.receivedAt, '2026-11-04T05:20:56+00:00')
  assert.equal(email.sentAt, undefined)
  const sentEmail = evidence.customerEmail(customerInformation.replace('CUSTOMER EMAIL RECEIVED (UTC)', 'CUSTOMER EMAIL SENT (UTC)'))
  assert.equal(sentEmail.sentAt, '2026-11-04T05:20:56+00:00')
  assert.equal(sentEmail.body, customerBody)
  assert.equal(email.body, customerBody)
  assert.equal(evidence.customerEmail(customerInformation.replace(/\r\n/g, '\n')).body, customerBody.replace(/\r\n/g, '\n'))
  assert.equal(evidence.customerEmail(undefined).body, undefined)
  assert.equal(evidence.customerEmail('Unstructured document text').body, undefined)
  const standalone = 'CUSTOMER EMAIL BODY\n===\n  Original body\n\n'
  assert.equal(evidence.customerEmail(standalone).body, '  Original body\n\n')
})

test('accepts email citations without a document name and preserves rule isolation', () => {
  const email = { sourceType: 'Email', exactText: '13 Aircrafts: 5 ACMI' }
  const references = evidence.inquiryEvidence({ evidenceReferences: [ref, email, email, { ...email, exactText: ' ' }, { ...email, sourceType: 'Other' }] })
  assert.equal(references.length, 2)
  assert.equal(references[1].sourceType, 'Email')
  const json = JSON.stringify({ businessRuleEvaluation: [{ businessRuleId: 'abc', evidenceReferences: [email] }, { businessRuleId: 'other', evidenceReferences: [ref] }] })
  assert.equal(evidence.evidenceForResponse(json, response).length, 1)
  assert.equal(evidence.evidenceForResponse(json, response)[0].sourceType, 'Email')
})

test('detects email headings without requiring decorative separators', () => {
  const body = 'Neos S.p.A. is an Italian based carrier\n\nscheduled destinations from Europe all the way to Cuba.\n'
  for (const divider of ['', '---\n', '========================================\n']) {
    const information = `\ufeffcustomer\u00a0email subject:\n${divider}Neos renewal\nCUSTOMER EMAIL RECEIVED (UTC):\n${divider}2026-11-04T05:20:56+00:00\nCustomer Email Body:\n${divider}${body}UPLOADED DOCUMENTS / EXTRACTED CONTENT\n${divider}DOCUMENT NAME: Fleet.xlsx\n${divider}Document-only claim`
    const email = evidence.customerEmail(information)
    assert.equal(email.subject, 'Neos renewal')
    assert.equal(email.body, body)
    assert.equal(email.receivedAt, '2026-11-04T05:20:56+00:00')
    assert.equal(evidence.emailEvidenceMatches(email.body, ['scheduled destinations from Europe all the way to Cuba.']).length, 1)
    assert.equal(evidence.emailEvidenceMatches(email.body, ['Document-only claim']).length, 0)
  }
})

test('accepts inline email sections and stops at document headings without separators', () => {
  const email = evidence.customerEmail('CUSTOMER EMAIL SUBJECT: Neos renewal\nCUSTOMER EMAIL BODY: Dear All,\nOriginal email text.\nDOCUMENT NAME: Attachment.pdf\nDocument-only claim')
  assert.equal(email.subject.trim(), 'Neos renewal')
  assert.equal(email.body, 'Dear All,\nOriginal email text.\n')
  assert.equal(evidence.customerEmail('CUSTOMER EMAIL BODY:\nOriginal email text.').body, 'Original email text.')
})

test('reads the reported NEOS format and matches both usage citations across email line wraps', () => {
  const information = `CUSTOMER EMAIL SUBJECT

NEOS - 1st November 2026 to 1st November 2027 - HSL - GE2602732

CUSTOMER EMAIL SENDER

anees.rehman@datanox.io

CUSTOMER EMAIL RECEIVED (UTC)

2026-11-11T05:45:00+00:00

CUSTOMER EMAIL BODY

Dear all,

As you know, Neos S.p.A. is an Italian based carrier headquartered in Somma
Lombardo, just outside of Milan. Founded in 2001, the Airline has continued to
grow over the past couple of decades and they now a well-recognised
international carrier with scheduled destinations from Europe all the way to
Cuba. Neos is proud of its IOSA accreditation and has also been awarded a
category 1 rating by EASA which is the highest category possible.

\u00a0

Thank you and best regards,

Isabella


UPLOADED DOCUMENTS / EXTRACTED CONTENT


DOCUMENT NAME: image.png

EXTRACTED DOCUMENT TEXT:
Gallagher SPECIALTY
END OF DOCUMENT`
  const email = evidence.customerEmail(information)
  assert.equal(email.subject, 'NEOS - 1st November 2026 to 1st November 2027 - HSL - GE2602732')
  assert.equal(email.receivedAt, '2026-11-11T05:45:00+00:00')
  assert.equal(email.body.includes('EXTRACTED DOCUMENT TEXT'), false)
  const matches = evidence.emailEvidenceMatches(email.body, [
    'Neos S.p.A. is an Italian based carrier headquartered in Somma Lombardo, just outside of Milan.',
    'scheduled destinations from Europe all the way to Cuba.',
  ])
  assert.equal(matches.length, 2)
  assert.equal(matches[0].exactText.includes('Somma\nLombardo'), true)
  assert.equal(matches[1].exactText, 'scheduled destinations from Europe all the way to\nCuba.')
})

test('extracts complete citations from original email text with line wraps preserved', () => {
  const body = evidence.customerEmail(customerInformation).body
  const passage = 'Your offer is -10% differential to Lead – Please note Lead premium panel in the WS slip.'
  const matches = evidence.emailEvidenceMatches(body, [passage, 'Attachment-only evidence', 'Your offer is 10% differential to Lead', 'Air Senegal 2026 HSL Policy'])
  assert.equal(matches.length, 1)
  assert.equal(matches[0].exactText, passage.replace('in the', 'in\r\nthe'))
  assert.equal(body.slice(matches[0].start, matches[0].end), matches[0].exactText)
})
test('matches a displayed Dataverse rule to JSON by ID, falling back to its name', () => {
  const json = JSON.stringify({ businessRuleEvaluation: [{ ruleName: response.businessRuleName, evidenceReferences: [ref] }] })
  assert.equal(evidence.evidenceForResponse(json, response)[0].documentName, ref.documentName)
  const byId = JSON.stringify({ businessRuleEvaluation: [{ businessRuleId: 'abc', ruleName: 'Renamed rule', evidenceReferences: [ref] }] })
  assert.equal(evidence.evidenceForResponse(byId, response).length, 1)
  const wrongId = JSON.stringify({ businessRuleEvaluation: [{ businessRuleId: 'other', ruleName: response.businessRuleName, evidenceReferences: [ref] }] })
  assert.equal(evidence.evidenceForResponse(wrongId, response).length, 0)
  assert.equal(evidence.evidenceForResponse('{bad JSON', response).length, 0)
  assert.equal(evidence.evidenceForResponse(json, { businessRuleName: 'Other rule' }).length, 0)
})
test('supports member evaluations without collecting unrelated JSON evidence', () => {
  const json = JSON.stringify({ irrelevant: { ruleName: response.businessRuleName, evidenceReferences: [{ ...ref, documentName: 'Wrong' }] }, memberBusinessRuleEvaluations: [{ memberId: 'member', businessRuleEvaluation: [{ ruleName: response.businessRuleName, evidenceReferences: [ref] }] }] })
  assert.equal(evidence.evidenceForResponse(json, response).length, 1)
  assert.equal(evidence.evidenceForResponse(json, response)[0].documentName, ref.documentName)
})
test('resolves only a unique linked filename, preserving spaces versus underscores', () => {
  const file = '/aur_quotes/Example Inquiry/02_Driving_Licence_Evidence.PDF'
  assert.equal(evidence.resolveEvidencePath(`/other/unrelated.pdf,${file}`, ref.documentName.toUpperCase()), file)
  assert.equal(evidence.resolveEvidencePath('/folder/Claims%20Declaration.pdf', 'Claims Declaration'), '/folder/Claims%20Declaration.pdf')
  assert.throws(() => evidence.resolveEvidencePath(file, '02 Driving Licence Evidence'), /not linked/)
  assert.throws(() => evidence.resolveEvidencePath(`${file},/other/02_Driving_Licence_Evidence.pdf`, ref.documentName), /More than one/)
  assert.throws(() => evidence.resolveEvidencePath('', ref.documentName), /not linked/)
})
test('normalizes PDF whitespace while preserving positions for precise highlight ranges', () => {
  const indexed = evidence.indexEvidenceText(['Document\tchecks', 'Front/back  supplied', 'Document checks'])
  const matches = evidence.findEvidenceMatches(indexed.text, [ref.exactText, 'Document checks'])
  assert.equal(matches.length, 3)
  const full = matches.find((match) => match.evidenceIndex === 0)
  assert.equal(indexed.positions[full.start].item, 0)
  assert.equal(indexed.positions[full.end - 1].item, 1)
  assert.equal(indexed.positions[full.end - 1].offset, 19)
  assert.equal(evidence.findEvidenceMatches(indexed.text, ['Not found']).length, 0)
})

const taxesPassage = 'TAXES PAYABLE BY INSURED AND ADMINISTERED BY INSURERS:\nNone.\nTAXES PAYABLE BY INSURERS AND ADMINISTERED BY INSURED OR THEIR AGENT: None'
function textItem(str, x, y, width = str.length * 5) { return { str, transform: [10, 0, 0, 10, x, y], width, height: 10, dir: 'ltr' } }

test('matches the screenshot passage when PDF extraction lists column headings before answers', () => {
  const items = [
    textItem('TAXES PAYABLE BY', 40, 700), textItem('INSURED AND', 40, 688), textItem('ADMINISTERED BY', 40, 676), textItem('INSURERS:', 40, 664),
    textItem('TAXES PAYABLE BY', 40, 630), textItem('INSURERS AND', 40, 618), textItem('ADMINISTERED BY', 40, 606), textItem('INSURED OR THEIR', 40, 594), textItem('AGENT:', 40, 582),
    textItem('RECORDING, TRANSMITTING AND STORING INFORMATION:', 40, 540),
    textItem('None.', 250, 664), textItem('None', 250, 582), textItem('Unrelated value', 250, 540),
  ]
  const raw = evidence.indexEvidenceText(items.map((item) => item.str))
  assert.equal(evidence.findEvidenceMatches(raw.text, [taxesPassage]).length, 0)
  const matches = evidence.findPdfEvidenceMatches(items, [taxesPassage])
  assert.equal(matches.length, 1)
  const ranges = matches[0].ranges
  assert.deepEqual(Array.from(ranges, (range) => range.item), [0, 1, 2, 3, 10, 4, 5, 6, 7, 8, 11])
  for (const range of ranges) assert.ok(range.start >= 0 && range.end <= items[range.item].str.length)
  assert.equal(ranges.some((range) => [9, 12].includes(range.item)), false)
})

test('matches ligatures, typography, case and split font runs with original character offsets', () => {
  const items = [textItem('Oﬃce', 0, 100, 25), textItem('policy’s', 40, 100, 40), textItem('INSUR', 100, 100, 25), textItem('ERS', 125, 100, 15)]
  const matches = evidence.findPdfEvidenceMatches(items, ["office POLICY'S insurers"])
  assert.equal(matches.length, 1)
  assert.deepEqual(Array.from(matches[0].ranges, (range) => [range.item, range.start, range.end]), [[0, 0, 4], [1, 0, 8], [2, 0, 5], [3, 0, 3]])
})

test('allows sentence punctuation differences while preserving amounts, signs and negations', () => {
  const items = [textItem('TAXES PAYABLE BY INSURERS: None.', 0, 100)]
  assert.equal(evidence.findPdfEvidenceMatches(items, ['Taxes payable by insurers None']).length, 1)
  const values = [textItem('Premium: $1,500.50 -10% cover not included', 0, 100)]
  for (const changed of ['Premium: $1,500.50 10% cover not included', 'Premium: £1,500.50 -10% cover not included', 'Premium: $150050 -10% cover not included', 'Premium: $1,500.50 -10% cover included']) {
    assert.equal(evidence.findPdfEvidenceMatches(values, [changed]).length, 0, changed)
  }
})

test('does not highlight unrelated short answers or incomplete passages and deduplicates reading orders', () => {
  const items = [textItem('TAXES PAYABLE BY INSURERS:', 0, 100), textItem('Applicable', 250, 100), textItem('Unrelated field:', 0, 60), textItem('None', 250, 60)]
  assert.equal(evidence.findPdfEvidenceMatches(items, ['TAXES PAYABLE BY INSURERS: None']).length, 0)
  assert.equal(evidence.findPdfEvidenceMatches([textItem('A complete evidence passage', 0, 100)], ['A complete evidence passage']).length, 1)
})
test('original links use the configured site and reject other origins and unsafe schemes', () => {
  const site = 'https://tenant.sharepoint.com/sites/Insurance'
  assert.equal(evidence.evidenceOriginalUrl(site, '/aur_inquiry/Example/file.pdf'), `${site}/aur_inquiry/Example/file.pdf`)
  assert.equal(evidence.evidenceOriginalUrl(site, '/sites/Insurance/Docs/file.pdf'), 'https://tenant.sharepoint.com/sites/Insurance/Docs/file.pdf')
  assert.equal(evidence.evidenceOriginalUrl(site, 'https://other.example/file.pdf'), undefined)
  assert.equal(evidence.evidenceOriginalUrl(site, 'javascript:alert(1)'), undefined)
})

function service(run) {
  return compile('services/inquiryEvidenceService.ts', (name) => {
    if (name.endsWith('/inquiryEvidence')) return evidence
    if (name.endsWith('/evidenceDocumentFormat')) return compile('lib/evidenceDocumentFormat.ts')
    if (name === './sharePointSiteService') return { getSharePointSiteUrl: async () => site }
    return { GetInquiryEvidenceDocumentService: { Run: run } }
  })
}

test('normalizes the reported URL plus duplicate path to one decoded site-relative path', () => {
  assert.equal(evidence.normalizeEvidenceDocumentPath(duplicatedUrl, site), cleanPath)
  assert.equal(evidence.normalizeEvidenceDocumentPath(`${site}${cleanPath.split('/').map(encodeURIComponent).join('/')}`, site), cleanPath)
  assert.equal(evidence.normalizeEvidenceDocumentPath(`/sites/TakafuliUnderwriterDEV${cleanPath}`, site), cleanPath)
  assert.equal(evidence.normalizeEvidenceDocumentPath('/folder/Claims%20%26%20Coverage%40file.pdf'), '/folder/Claims & Coverage@file.pdf')
  assert.equal(evidence.normalizeEvidenceDocumentPath('/folder/100% + coverage.pdf'), '/folder/100% + coverage.pdf')
  assert.equal(evidence.evidenceOriginalUrl(site, duplicatedUrl), `${site}${cleanPath.split('/').map(encodeURIComponent).join('/').replace(/%40/g, '@')}`)
})

test('rejects raw, encoded, and double-encoded hidden characters and other sites', () => {
  for (const value of ['/folder/file%02.pdf', '/folder/file%2502.pdf', '/folder/file\u0002.pdf', '/folder/file%0A.pdf', '/folder/file%E2%80%8B.pdf', '/folder/file\u200B.pdf']) {
    assert.throws(() => evidence.normalizeEvidenceDocumentPath(value), /hidden character|control character/)
  }
  assert.throws(() => evidence.normalizeEvidenceDocumentPath(`${site}/file\n.pdf`, site), /hidden character/)
  assert.throws(() => evidence.normalizeEvidenceDocumentPath('https://other.sharepoint.com/sites/TakafuliUnderwriterDEV/file.pdf', site), /different SharePoint site/)
  assert.throws(() => evidence.normalizeEvidenceDocumentPath('https://adotdynamicscomau.sharepoint.com/sites/AnotherSite/file.pdf', site), /different SharePoint site/)
  assert.throws(() => evidence.normalizeEvidenceDocumentPath('/folder/%2E%2E/file.pdf'), /site-relative/)
})

test('sends only the repaired decoded path to the flow and blocks control characters before calling it', async () => {
  let input
  let calls = 0
  const api = service(async (value) => {
    calls++; input = value
    return { success: true, data: { success: 'true', contentbase64: Buffer.from('%PDF-1.7\nexample').toString('base64') } }
  })
  await api.getInquiryEvidenceDocument('abc', duplicatedUrl, '10432A26 - HL Quote Slip.pdf')
  assert.equal(input.text_1, cleanPath)
  assert.equal(input.text_1.includes('%'), false)
  await assert.rejects(api.getInquiryEvidenceDocument('abc', '/folder/fi%02le.pdf', 'fi%02le.pdf'), /hidden character|control character/)
  assert.equal(calls, 1)
})
test('never invokes the flow for missing or ambiguous linked documents', async () => {
  let calls = 0
  const api = service(async () => { calls++; throw Error('Must not call') })
  await assert.rejects(api.getInquiryEvidenceDocument('abc', '', 'Missing'), /not linked/)
  await assert.rejects(api.getInquiryEvidenceDocument('abc', '/a/file.pdf,/b/file.pdf', 'file'), /More than one/)
  assert.equal(calls, 0)
})
test('sends the generated wire keys and decodes a genuine PDF response', async () => {
  let input
  const api = service(async (value) => { input = value; return { success: true, data: { success: 'true', filename: 'file.pdf', mimetype: 'application/pdf', contentbase64: Buffer.from('%PDF-1.7\nexample').toString('base64') } } })
  const result = await api.getInquiryEvidenceDocument('{abc}', '/folder/file.pdf', 'file')
  assert.equal(input.text, 'abc')
  assert.equal(input.text_1, '/folder/file.pdf')
  assert.equal(result.isPdf, true)
  assert.equal(new TextDecoder().decode(result.bytes), '%PDF-1.7\nexample')
})
test('surfaces transport, flow, and malformed content errors without opening fake documents', async () => {
  for (const [data, message] of [
    [{ success: false, error: { message: 'Access denied' } }, /Access denied/],
    [{ success: true, data: { success: 'false', errormessage: 'File missing' } }, /File missing/],
    [{ success: true, data: { success: 'true', contentbase64: '%%%' } }, /invalid file/],
    [{ success: true, data: { success: 'true' } }, /empty file/],
  ]) await assert.rejects(service(async () => data).getInquiryEvidenceDocument('abc', '/file.pdf', 'file'), message)
  const result = await service(async () => ({ success: true, data: { success: 'true', contentbase64: Buffer.from('A Word file').toString('base64'), mimetype: 'application/pdf' } })).getInquiryEvidenceDocument('abc', '/file.pdf', 'file')
  assert.equal(result.isPdf, false)
})

test('evidence button renders only for the selected rule with valid document references', () => {
  const React = require('react')
  const { renderToStaticMarkup } = require('react-dom/server')
  const { InquiryEvidenceButton, EmailEvidenceDocument } = compile('components/inquiries/InquiryEvidence.tsx', (name) => {
    const dependencies = {
      react: React, 'react/jsx-runtime': require('react/jsx-runtime'),
      '@radix-ui/react-dialog': require('@radix-ui/react-dialog'), 'lucide-react': require('lucide-react'),
      '../../lib/inquiryEvidence': evidence, '../../services/inquiryEvidenceService': {}, '../../services/sharePointSiteService': {},
      '../ui/Button': { Button: ({ children, variant, size, ...props }) => React.createElement('button', props, children) }, '../ui/Select': {},
    }
    if (!(name in dependencies)) throw new Error(`Unexpected dependency ${name}`)
    return dependencies[name]
  })
  const render = (references) => renderToStaticMarkup(React.createElement(InquiryEvidenceButton, {
    inquiry: { id: 'abc', aiEvaluationJsonResponse: JSON.stringify({ businessRuleEvaluation: [{ ruleName: response.businessRuleName, evidenceReferences: references }] }) }, response,
  }))
  assert.match(render([ref]), /View document evidence for Driving licence verification/)
  assert.equal(render([{ ...ref, sourceType: null }]), '')
  assert.equal(render([{ ...ref, exactText: '' }]), '')
  assert.equal(render([]), '')
  assert.match(render([{ sourceType: 'Email', exactText: '13 Aircrafts: 5 ACMI' }]), /View email evidence/)
  assert.match(render([ref, { sourceType: 'Email', exactText: '13 Aircrafts: 5 ACMI' }]), /View source evidence/)
  const emailMarkup = renderToStaticMarkup(React.createElement(require('@radix-ui/react-dialog').Root, {},
    React.createElement(EmailEvidenceDocument, { customerData: customerInformation, passages: ['13 Aircrafts: 5 ACMI', 'Attachment-only evidence'] })))
  assert.match(emailMarkup, /Air Senegal 2026 HSL Policy/)
  assert.match(emailMarkup, /Received <time dateTime="2026-11-04T05:20:56.000Z">4 Nov 2026, 05:20 UTC<\/time>/)
  assert.match(emailMarkup, /<mark[^>]*>13 Aircrafts: 5 ACMI<\/mark>/)
  assert.match(emailMarkup, /Not matched in email body/)
  const bodyMarkup = emailMarkup.split('aria-label="Customer email body"')[1]
  assert.equal(bodyMarkup.includes('Attachment-only evidence'), false)
  assert.equal(bodyMarkup.includes('broker@example.com'), false)
  const escaped = renderToStaticMarkup(React.createElement(require('@radix-ui/react-dialog').Root, {},
    React.createElement(EmailEvidenceDocument, { customerData: 'CUSTOMER EMAIL BODY\n===\n<script>alert(1)</script>', passages: [] })))
  assert.equal(escaped.includes('<script>'), false)
  assert.match(escaped, /&lt;script&gt;/)
})

test('finds repeated, multiline evidence across pages extracted by the actual PDF.js library', async () => {
  const { jsPDF } = require('jspdf')
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const pdf = new jsPDF()
  pdf.text(['Document checks', 'Front/back supplied'], 20, 30)
  pdf.addPage()
  pdf.text('Document checks Front/back supplied', 20, 30)
  const task = getDocument({ data: new Uint8Array(pdf.output('arraybuffer')), standardFontDataUrl: path.join(__dirname, '../node_modules/pdfjs-dist/standard_fonts').replace(/\\/g, '/') + '/' })
  try {
    const document = await task.promise
    assert.equal(document.numPages, 2)
    for (let page = 1; page <= 2; page++) {
      const content = await (await document.getPage(page)).getTextContent()
      const index = evidence.indexEvidenceText(content.items.filter((item) => 'str' in item).map((item) => item.str))
      assert.equal(evidence.findEvidenceMatches(index.text, [ref.exactText]).length, 1)
    }
  } finally { await task.destroy() }
})

test('matches two-column text from a real PDF and maps highlights away from unrelated fields', async () => {
  const { jsPDF } = require('jspdf')
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const pdf = new jsPDF()
  pdf.setFontSize(10)
  // Draw the entire label column first, as many PDFs store their content.
  pdf.text(['TAXES PAYABLE BY', 'INSURED AND', 'ADMINISTERED BY', 'INSURERS:'], 20, 30)
  pdf.text(['TAXES PAYABLE BY', 'INSURERS AND', 'ADMINISTERED BY', 'INSURED OR THEIR', 'AGENT:'], 20, 60)
  pdf.text('RECORDING, TRANSMITTING AND STORING INFORMATION:', 20, 90)
  const lineHeight = 10 * pdf.getLineHeightFactor() / pdf.internal.scaleFactor
  pdf.text('None.', 100, 30 + 3 * lineHeight)
  pdf.text('None', 100, 60 + 4 * lineHeight)
  pdf.text('Unrelated value', 100, 90)
  const task = getDocument({ data: new Uint8Array(pdf.output('arraybuffer')), standardFontDataUrl: path.join(__dirname, '../node_modules/pdfjs-dist/standard_fonts').replace(/\\/g, '/') + '/' })
  try {
    const document = await task.promise
    const content = await (await document.getPage(1)).getTextContent()
    const items = content.items.filter((item) => 'str' in item)
    assert.equal(evidence.findEvidenceMatches(evidence.indexEvidenceText(items.map((item) => item.str)).text, [taxesPassage]).length, 0)
    const matches = evidence.findPdfEvidenceMatches(items, [taxesPassage])
    assert.equal(matches.length, 1)
    const highlighted = Array.from(matches[0].ranges, (range) => items[range.item].str.slice(range.start, range.end)).join(' ')
    assert.match(highlighted, /INSURERS: None\./)
    assert.match(highlighted, /AGENT: None/)
    assert.equal(highlighted.includes('Unrelated'), false)
    for (const range of matches[0].ranges) assert.ok(range.start >= 0 && range.end <= items[range.item].str.length)
  } finally { await task.destroy() }
})

test('bundled PDF handler parses and renders without fetching an external worker asset', async () => {
  const { jsPDF } = require('jspdf')
  const { createCanvas } = require('@napi-rs/canvas')
  const { WorkerMessageHandler } = await import('pdfjs-dist/build/pdf.worker.mjs')
  // A fresh module avoids reusing the worker fallback cached by the preceding test.
  const { getDocument, GlobalWorkerOptions, PDFWorker } = await import('../node_modules/pdfjs-dist/legacy/build/pdf.mjs?bundled-worker-regression')
  const previousSource = GlobalWorkerOptions.workerSrc
  GlobalWorkerOptions.workerSrc = 'https://worker-must-not-be-fetched.invalid/pdf.worker.mjs'
  let task
  try {
    assert.equal(globalThis.pdfjsWorker.WorkerMessageHandler, WorkerMessageHandler)
    assert.equal(await PDFWorker._setupFakeWorkerGlobal, WorkerMessageHandler)
    const pdf = new jsPDF()
    pdf.text('Highlighted document evidence', 20, 30)
    task = getDocument({ data: new Uint8Array(pdf.output('arraybuffer')), standardFontDataUrl: path.join(__dirname, '../node_modules/pdfjs-dist/standard_fonts').replace(/\\/g, '/') + '/' })
    const document = await task.promise
    const page = await document.getPage(1)
    const viewport = page.getViewport({ scale: 1 })
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
    await page.render({ canvas, viewport }).promise
    const content = await page.getTextContent()
    assert.ok(content.items.some((item) => item.str === 'Highlighted document evidence'))
    assert.ok(canvas.toBuffer('image/png').length > 1000)
  } finally {
    if (task) await task.destroy()
    GlobalWorkerOptions.workerSrc = previousSource
  }
})
