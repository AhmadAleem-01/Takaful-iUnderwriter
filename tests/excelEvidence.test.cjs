const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const XLSX = require('xlsx')
const JSZip = require('jszip')
const { JSDOM } = require('jsdom')

function compile(file, dependencies = {}) {
  const context = { exports: {}, TextDecoder, Uint8Array, URL, atob, document: globalThis.document, require: (name) => {
    if (name.endsWith('/evidenceSessionCache')) return sessionCache;
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`)
    return dependencies[name]
  } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, context)
  return context.exports
}
const sessionCache = compile('lib/evidenceSessionCache.ts')
const evidence = compile('lib/inquiryEvidence.ts')
const format = compile('lib/evidenceDocumentFormat.ts')
const excel = compile('lib/excelEvidence.ts', { xlsx: XLSX, './inquiryEvidence': evidence })
const ref = (exactText, fields = {}) => ({ sourceType: 'Document', documentName: 'Evidence.xlsx', exactText, ...fields })

function fixture(bookType = 'xlsx') {
  const book = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Insured', 'ABFA Investments'], ['Premium', 1500], ['Tax', .05], ['Status', 'No claims'],
    ['Invoice date', 45292], ['Total', 1575], [], ['Merged policy terms'], [], ['Note', '<img src=x onerror=alert(1)>'],
  ])
  sheet.B2.z = '"$"#,##0.00'; sheet.B3.z = '0%'; sheet.B5.z = 'yyyy-mm-dd'
  sheet.B6.z = '"$"#,##0.00'; sheet.B6.f = 'B2*(1+B3)'
  sheet['!merges'] = [XLSX.utils.decode_range('A8:C8')]
  sheet['!cols'] = [{ wch: 22 }, { wch: 28 }]
  XLSX.utils.book_append_sheet(book, sheet, 'Claims')
  const other = XLSX.utils.aoa_to_sheet([['Available capacity', 1500], ['No claims'], ['Different amount', 11500]])
  other.B1.z = '"$"#,##0.00'; other.B3.z = '0'
  XLSX.utils.book_append_sheet(book, other, 'Capacity')
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([]), 'Empty')
  const schedule = XLSX.utils.aoa_to_sheet([['Schedule']])
  schedule.AD501 = { t: 's', v: 'High risk reference' }; schedule['!ref'] = 'A1:AD501'
  XLSX.utils.book_append_sheet(book, schedule, 'Schedule')
  book.Workbook = { Sheets: book.SheetNames.map((name) => ({ name, Hidden: name === 'Capacity' ? 1 : 0 })) }
  return new Uint8Array(XLSX.write(book, { type: 'array', bookType, cellStyles: true }))
}

function dateFixture({ date1904 = false, year = 2026, format = 'm/d/yy', bookType = 'xlsx', extended = false } = {}) {
  const serial = (value) => (Date.UTC(value, 1, 1) - Date.UTC(1899, 11, 30)) / 86400000 - (date1904 ? 1462 : 0)
  const book = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet([])
  Object.assign(sheet, {
    F2: { t: 's', v: 'Air Senegal' }, H2: { t: 's', v: 'Inception' }, I2: { t: 'n', v: serial(year), z: format },
    K2: { t: 's', v: 'Currency' }, L2: { t: 's', v: 'USD and EUR' }, M2: { t: 's', v: 'Type' }, N2: { t: 's', v: 'Regional/Charter' },
    H3: { t: 's', v: 'Expiry' }, I3: { t: 'n', v: serial(year + 1), z: format }, J3: { t: 's', v: 'Direct or R/I?' },
    K3: { t: 's', v: 'Reinsurance' }, '!ref': 'F2:N3',
  })
  if (extended) Object.assign(sheet, {
    E3: { t: 's', v: 'Domicile' }, F3: { t: 's', v: 'Senegal' },
    P2: { t: 's', v: 'Average value (USD)' }, R2: { t: 'n', v: 33855342, z: '"$"#,##0' },
    S2: { t: 's', v: 'Average aircraft units' }, U2: { t: 'n', v: 15.47 }, '!ref': 'E2:U3',
  })
  XLSX.utils.book_append_sheet(book, sheet, 'Fleet')
  book.Workbook = { WBProps: { date1904 } }
  return new Uint8Array(XLSX.write(book, { type: 'array', bookType }))
}

const datePassages = ['Inception\n02/01/2026\nCurrency\nUSD and EUR', 'Expiry\n02/01/2027']
const metadataPassage = 'Inception\n02/01/2026\nCurrency\nUSD and EUR\nType\nRegional/Charter\nAverage value (USD)\nDomicile\nSenegal\nExpiry\n02/01/2027'

function passengersFixture({ asText = false } = {}) {
  const book = XLSX.utils.book_new(), sheet = XLSX.utils.aoa_to_sheet([])
  Object.assign(sheet, {
    A14: { t: 's', v: 'Passengers' }, B14: asText ? { t: 's', v: '2,476,502' } : { t: 'n', v: 2476502, z: '#,##0' },
    C14: asText ? { t: 's', v: '2,353,049' } : { t: 'n', v: 2353049, z: '#,##0' },
    D14: { t: 'n', v: -.0498, z: '0.00%' }, A15: { t: 's', v: 'Departures exc B787' },
    B15: { t: 'n', v: 12390, z: '#,##0' }, C15: { t: 'n', v: 10771, z: '#,##0' }, '!ref': 'A14:D15',
  })
  XLSX.utils.book_append_sheet(book, sheet, 'As If - Annual')
  return new Uint8Array(XLSX.write(book, { type: 'array', bookType: 'xlsx' }))
}

test('ignores valid thousands commas in short and inline excerpts while preserving original highlight offsets', () => {
  for (const asText of [false, true]) {
    const sheets = excel.readExcelEvidence(passengersFixture({ asText }))
    for (const passage of ['Passengers\n2476502\n2353049', 'Passengers 2476502 2353049', 'Passengers\n2,476,502\n2353049']) {
      const { matches, notes } = excel.findExcelEvidenceMatches(sheets, [ref(passage)])
      assert.equal(matches.length, 1, passage)
      assert.equal(matches[0].locationLabel, 'As If - Annual · A14:C14')
      assert.match(notes[0], /commas/)
      assert.deepEqual(Array.from(matches[0].cells, (cell) => cell.address), ['A14', 'B14', 'C14'])
      assert.equal(matches[0].cells[1].start, 0)
      assert.equal(matches[0].cells[1].end, '2,476,502'.length)
      assert.equal(matches[0].cells[2].end, '2,353,049'.length)
    }
    assert.equal(excel.findExcelEvidenceMatches(sheets, [ref('Passengers\n2476502')]).matches.length, 1)
    assert.equal(excel.findExcelEvidenceMatches(sheets, [ref('2476502', { cellRange: 'B14' })]).matches.length, 1)
    assert.equal(excel.findExcelEvidenceMatches(sheets, [ref('Passengers\n2476502\n2353049', { cellRange: 'A14:B14' })]).matches.length, 0)
    for (const passage of ['Passengers\n476502\n2353049', 'Passengers\n2476502\n235304', 'Passengers\n-2476502\n2353049',
      'Passengers\n2476502.5\n2353049', 'Passengers\n2,47,6502\n2353049', 'Passengers\n2,476,5020\n2353049',
      'Passengers\n2476502\n2353049\n-4.98']) {
      assert.equal(excel.findExcelEvidenceMatches(sheets, [ref(passage)]).matches.length, 0, passage)
    }
    assert.equal(excel.findExcelEvidenceMatches(sheets, [ref('Passengers\n2476502\n2353049\n-4.98%')]).matches.length, 1)
  }
})

test('comma normalization preserves decimals, currency, percentages, signs and identifiers', () => {
  const book = XLSX.utils.book_new(), sheet = XLSX.utils.aoa_to_sheet([
    ['Amount', 2476502.5], ['Negative', -2476502], ['Premium', 2476502],
    ['Tax', .125], ['Code', 'AB2,476,502'], ['Decimal comma', '2,47'],
  ])
  sheet.B1.z = '#,##0.00'; sheet.B2.z = '#,##0'; sheet.B3.z = '"$"#,##0'; sheet.B4.z = '0.0%'
  XLSX.utils.book_append_sheet(book, sheet, 'Numbers')
  const sheets = excel.readExcelEvidence(new Uint8Array(XLSX.write(book, { type: 'array', bookType: 'xlsx' })))
  for (const passage of ['Amount 2476502', 'Amount 2476502.05', 'Negative 2476502', 'Premium €2476502',
    'Tax 125', 'Tax .125', 'Code AB2476502', 'Decimal comma 247']) {
    assert.equal(excel.findExcelEvidenceMatches(sheets, [ref(passage)]).matches.length, 0, passage)
  }
  for (const passage of ['Amount 2476502.50', 'Negative -2476502', 'Premium $2476502']) {
    assert.equal(excel.findExcelEvidenceMatches(sheets, [ref(passage)]).matches.length, 1, passage)
  }
  for (const passage of ['476502', '2476502', '2476502.5']) {
    assert.equal(excel.findExcelEvidenceMatches(sheets, [ref(passage, { cellRange: 'B1' })]).matches.length, 0, passage)
  }
  const plainBook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(plainBook, XLSX.utils.aoa_to_sheet([['Passengers', 2476502, 2353049]]), 'Plain')
  const plain = excel.readExcelEvidence(new Uint8Array(XLSX.write(plainBook, { type: 'array', bookType: 'xlsx' })))
  assert.equal(excel.findExcelEvidenceMatches(plain, [ref('Passengers\n2,476,502\n2,353,049')]).matches.length, 1)
})

const lossRunPassage = 'NEOS SPA\nPolicy Year\nOpen Claims\nClosed Claims'
function lossRunFixture({ duplicate = false, distant = false } = {}) {
  const book = XLSX.utils.book_new(), sheet = XLSX.utils.aoa_to_sheet([])
  Object.assign(sheet, {
    A5: { t: 's', v: 'NEOS SPA' }, A8: { t: 's', v: 'Policy\nYear' },
    B8: { t: 's', v: 'Open Claims' }, C8: { t: 's', v: 'Closed Claims' },
    D8: { t: 's', v: 'Paid' }, D9: { t: 's', v: 'USD' }, E9: { t: 's', v: 'EUR' },
    A10: { t: 'n', v: 2017 }, B10: { t: 'n', v: 0 }, C10: { t: 'n', v: 7 },
    '!ref': 'A5:F10', '!merges': [XLSX.utils.decode_range('A5:F5'), XLSX.utils.decode_range('D8:F8')],
  })
  if (duplicate) sheet.B7 = { t: 's', v: 'Open Claims' }
  if (distant) { sheet.A25 = sheet.A5; delete sheet.A5; sheet['!merges'] = []; sheet['!ref'] = 'A8:F25' }
  XLSX.utils.book_append_sheet(book, sheet, 'Summary')
  return new Uint8Array(XLSX.write(book, { type: 'array', bookType: 'xlsx' }))
}

test('matches the loss-run title and headers across blank layout rows', () => {
  const sheets = excel.readExcelEvidence(lossRunFixture())
  const { matches, notes } = excel.findExcelEvidenceMatches(sheets, [ref(lossRunPassage)])
  assert.equal(matches.length, 1)
  assert.equal(matches[0].locationLabel, 'Summary · A5:C8')
  assert.deepEqual(Array.from(matches[0].cells, (cell) => cell.address), ['A5', 'A8', 'B8', 'C8'])
  assert.match(notes[0], /blank.*rows/)
})

test('matches reordered whole fields, colon punctuation and wrapped lines in a compact source area', () => {
  const sheets = excel.readExcelEvidence(lossRunFixture())
  for (const passage of ['Closed Claims\nNEOS SPA\nOpen Claims\nPolicy Year',
    'Closed Claims:\nNEOS\nSPA\nOpen Claims\nPolicy\nYear']) {
    const { matches, notes } = excel.findExcelEvidenceMatches(sheets, [ref(passage)])
    assert.equal(matches.length, 1, passage)
    assert.deepEqual(Array.from(matches[0].cells, (cell) => cell.address), ['A5', 'A8', 'B8', 'C8'])
    assert.match(notes[0], /field.*order/i)
    assert.equal(matches[0].cells.find((cell) => cell.address === 'A8').end, 'Policy\nYear'.length)
  }
  assert.equal(excel.findExcelEvidenceMatches(sheets, [ref('Closed Claims\nNEOS SPA\nOpen Claims\nPolicy Year', { cellRange: 'A8:C8' })]).matches.length, 0)
})

test('forgiving matching requires all complete fields and rejects ambiguous or distant occurrences', () => {
  const sheets = excel.readExcelEvidence(lossRunFixture())
  for (const passage of ['Closed Claims\nNEOS SPA\nOpen Claims\nYear', 'Closed Claims\nNEOS SPA\nNo Open Claims\nPolicy Year',
    'Closed Claims\nNEOS SPA\nOpen Claims\nPolicy Year\nMissing field',
    'Closed Claims\nNEOS SPA\nOpen Claims\nOpen Claims\nPolicy Year']) {
    assert.equal(excel.findExcelEvidenceMatches(sheets, [ref(passage)]).matches.length, 0, passage)
  }
  const shuffled = 'Closed Claims\nNEOS SPA\nOpen Claims\nPolicy Year'
  assert.equal(excel.findExcelEvidenceMatches(excel.readExcelEvidence(lossRunFixture({ distant: true })), [ref(shuffled)]).matches.length, 0)
  assert.equal(excel.findExcelEvidenceMatches(excel.readExcelEvidence(lossRunFixture({ duplicate: true })), [ref(shuffled)]).matches.length, 0)
})

test('an invalid distant literal occurrence does not suppress a valid local field match', () => {
  const book = XLSX.utils.book_new(), sheet = XLSX.utils.aoa_to_sheet([])
  Object.assign(sheet, {
    A1: { t: 's', v: 'NEOS SPA' }, A20: { t: 's', v: 'Policy Year' }, B20: { t: 's', v: 'Open Claims' }, C20: { t: 's', v: 'Closed Claims' },
    A100: { t: 's', v: 'NEOS SPA' }, A103: { t: 's', v: 'Policy Year' }, B103: { t: 's', v: 'Closed Claims' }, C103: { t: 's', v: 'Open Claims' },
    '!ref': 'A1:C103',
  })
  XLSX.utils.book_append_sheet(book, sheet, 'Summary')
  const sheets = excel.readExcelEvidence(new Uint8Array(XLSX.write(book, { type: 'array', bookType: 'xlsx' })))
  const { matches } = excel.findExcelEvidenceMatches(sheets, [ref(lossRunPassage)])
  assert.deepEqual(Array.from(matches, (match) => match.locationLabel), ['Summary · A100:C103'])
})

test('reorders complete field/value pairs without changing their amounts, currencies or dates', () => {
  const book = XLSX.utils.book_new(), sheet = XLSX.utils.aoa_to_sheet([
    ['Insured', 'NEOS SPA'], ['Premium', 1500], ['Tax', 99], ['Inception', 46054],
  ])
  sheet.B2.z = '"$"#,##0.00'; sheet.B3.z = '"€"#,##0'; sheet.B4.z = 'm/d/yy'
  XLSX.utils.book_append_sheet(book, sheet, 'Terms')
  const sheets = excel.readExcelEvidence(new Uint8Array(XLSX.write(book, { type: 'array', bookType: 'xlsx' })))
  const passage = 'Tax\n99\nInsured\nNEOS SPA\nInception\n02/01/2026\nPremium\n1500'
  const { matches, notes } = excel.findExcelEvidenceMatches(sheets, [ref(passage)])
  assert.equal(matches.length, 1)
  assert.match(notes[0], /field.*order/i)
  assert.deepEqual(Array.from(matches[0].cells, (cell) => cell.address), ['A1', 'B1', 'A2', 'B2', 'A3', 'B3', 'A4', 'B4'])
  for (const wrong of [passage.replace('02/01/2026', '02/01/1926'), passage.replace('Tax\n99', 'Tax\n$99'),
    passage.replace('Tax\n99', 'Tax\n1500').replace('Premium\n1500', 'Premium\n99')]) {
    assert.equal(excel.findExcelEvidenceMatches(sheets, [ref(wrong)]).matches.length, 0, wrong)
  }
})

test('reordered aircraft evidence keeps repeated records separate and highlights the original currencies', () => {
  const sheets = excel.readExcelEvidence(aircraftFixture())
  const passage = '1000000000\n290\n9H SZN\n1910\nA330-941 NEO\n48495925'
  const { matches, notes } = excel.findExcelEvidenceMatches(sheets, [ref(passage)])
  assert.deepEqual(Array.from(matches, (match) => match.locationLabel), ['Fleet · B6:J6', 'Fleet · B7:J7'])
  assert.match(notes[0], /field.*order/i)
  assert.equal(matches[0].cells.find((cell) => cell.address === 'G6').end, '€48,495,925'.length)
  assert.equal(matches[0].cells.find((cell) => cell.address === 'I6').end, '$1,000,000,000'.length)
})

test('field/value association works with column headers and rejects swaps within the same row', () => {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ['Insured', 'NEOS SPA', 'Premium', 1500, 'Tax', 99],
  ]), 'Row')
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ['Premium', 'Tax', 'Insured'], [1500, 99, 'NEOS SPA'],
  ]), 'Columns')
  const sheets = excel.readExcelEvidence(new Uint8Array(XLSX.write(book, { type: 'array', bookType: 'xlsx' })))
  const passage = 'Tax\n99\nPremium\n1500\nInsured\nNEOS SPA'
  assert.equal(excel.findExcelEvidenceMatches(sheets, [ref(passage)]).matches.length, 2)
  const swapped = 'Tax\n1500\nPremium\n99\nInsured\nNEOS SPA'
  assert.equal(excel.findExcelEvidenceMatches(sheets, [ref(swapped)]).matches.length, 0)
})

const aircraftPassage = '9H SZN\n1910\nA330-941 NEO\n48495925\n1000000000\n290'
function aircraftFixture({ amount = 48495925, liability = 1000000000, extra = undefined, bookType = 'xlsx' } = {}) {
  const book = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet([])
  for (const row of [6, 7]) Object.assign(sheet, {
    [`A${row}`]: { t: 'n', v: 1 }, [`B${row}`]: { t: 's', v: '9H SZN' }, [`D${row}`]: { t: 'n', v: 1910 },
    [`E${row}`]: { t: 's', v: 'A330-941 NEO' }, [`F${row}`]: { t: 's', v: 'A330-941 NEO' },
    [`G${row}`]: { t: 'n', v: amount, z: '"€"#,##0' }, [`I${row}`]: { t: 'n', v: liability, z: '"$"#,##0' },
    [`J${row}`]: { t: 'n', v: 290 }, [`K${row}`]: { t: 's', v: 'Unrelated trailing field' },
  })
  if (extra) sheet.H6 = { t: 's', v: extra }
  sheet['!ref'] = 'A6:K7'
  XLSX.utils.book_append_sheet(book, sheet, 'Fleet')
  return new Uint8Array(XLSX.write(book, { type: 'array', bookType }))
}

test('matches raw amounts to formatted currencies and repeated model cells within the complete aircraft row', () => {
  for (const bookType of ['xlsx', 'xls', 'xlsb']) {
    const bytes = aircraftFixture({ bookType }), before = Buffer.from(bytes)
    const sheets = excel.readExcelEvidence(bytes)
    const { matches, notes } = excel.findExcelEvidenceMatches(sheets, [ref(aircraftPassage)])
    assert.deepEqual(Array.from(matches, (match) => match.locationLabel), ['Fleet · B6:J6', 'Fleet · B7:J7'])
    assert.match(notes[0], /row/)
    assert.deepEqual(Array.from(matches[0].cells, (cell) => cell.address), ['B6', 'D6', 'E6', 'F6', 'G6', 'I6', 'J6'])
    for (const range of matches[0].cells) {
      assert.equal(range.start, 0)
      assert.equal(range.end, sheets[0].byAddress.get(range.address).text.length)
    }
    assert.equal(sheets[0].byAddress.get('G6').text, '€48,495,925')
    assert.equal(sheets[0].byAddress.get('I6').text, '$1,000,000,000')
    assert.equal(excel.findExcelEvidenceMatches(sheets, [ref(aircraftPassage, { sheetName: 'Fleet', cellRange: 'B6:J6' })]).matches.length, 1)
    assert.equal(excel.findExcelEvidenceMatches(sheets, [ref(aircraftPassage, { cellRange: 'B6:I6' })]).matches.length, 0)
    assert.deepEqual(Buffer.from(bytes), before)
  }
})

test('row value matching rejects changed amounts, currencies, signs, partial fields and interior contradictions', () => {
  const sheets = excel.readExcelEvidence(aircraftFixture())
  for (const passage of [aircraftPassage.replace('48495925', '8495925'), aircraftPassage.replace('1000000000', '100000000'),
    aircraftPassage.replace('48495925', '$48,495,925'), aircraftPassage.replace('48495925', '-48495925'),
    aircraftPassage.replace('48495925', '48,495,92,5'), aircraftPassage.replace('A330-941 NEO', '941 NEO'),
    aircraftPassage.replace('290', '29'), aircraftPassage.replace('48495925', '48495925%')]) {
    assert.equal(excel.findExcelEvidenceMatches(sheets, [ref(passage)]).matches.length, 0, passage)
  }
  const conflict = excel.readExcelEvidence(aircraftFixture({ extra: 'No cover' }))
  assert.equal(excel.findExcelEvidenceMatches(conflict, [ref(aircraftPassage, { cellRange: 'B6:J6' })]).matches.length, 0)
  assert.equal(excel.findExcelEvidenceMatches(sheets, [ref(aircraftPassage.replace('48495925', '€48,495,925.00'))]).matches.length, 2)
  const negative = excel.readExcelEvidence(aircraftFixture({ amount: -48495925 }))
  assert.equal(excel.findExcelEvidenceMatches(negative, [ref(aircraftPassage)]).matches.length, 0)
  assert.equal(excel.findExcelEvidenceMatches(negative, [ref(aircraftPassage.replace('48495925', '-48495925'))]).matches.length, 2)
})

test('row aliases do not turn percentages, scaled formats, rounded values or numeric duplicates into raw amounts', () => {
  const book = XLSX.utils.book_new(), sheet = XLSX.utils.aoa_to_sheet([
    ['Aircraft', 'Value', .05, 'End'], ['Aircraft', 'Value', 1500, 'End'],
    ['Aircraft', 'Value', 1500.49, 'End'], ['Aircraft', 'Value', 1500, 1500, 'End'],
  ])
  sheet.C1.z = '0%'; sheet.C2.z = '0,"k"'; sheet.C3.z = '"$"#,##0'; sheet.C4.z = '"$"#,##0'; sheet.D4.z = '"$"#,##0'
  XLSX.utils.book_append_sheet(book, sheet, 'Values')
  const sheets = excel.readExcelEvidence(new Uint8Array(XLSX.write(book, { type: 'array', bookType: 'xlsx' })))
  for (const [row, amount] of [[1, '.05'], [1, '5'], [2, '1500'], [3, '1500'], [3, '1500.49'], [4, '1500']]) {
    assert.equal(excel.findExcelEvidenceMatches(sheets, [ref(`Aircraft\nValue\n${amount}\nEnd`, { cellRange: `A${row}:F${row}` })]).matches.length, 0)
  }
})

test('matches the expanded screenshot passage across adjacent metadata rows, retaining date offsets and skipped cells', () => {
  const bytes = dateFixture({ extended: true }), sheets = excel.readExcelEvidence(bytes)
  assert.equal(excel.findExcelEvidenceMatches(sheets, [ref(datePassages[0])]).matches.length, 1)
  const { matches, notes } = excel.findExcelEvidenceMatches(sheets, [ref(metadataPassage)])
  assert.equal(matches.length, 1)
  assert.deepEqual(Array.from(matches[0].cells, (cell) => cell.address), ['H2', 'I2', 'K2', 'L2', 'M2', 'N2', 'P2', 'E3', 'F3', 'H3', 'I3'])
  assert.equal(matches[0].locationLabel, 'Fleet · E2:P3')
  assert.match(notes[0], /adjacent rows/)
  assert.equal(matches[0].cells.find((cell) => cell.address === 'I2').end, '2/1/26'.length)
  assert.equal(matches[0].cells.find((cell) => cell.address === 'I3').end, '2/1/27'.length)
  // Reusing the parsed workbook must not cache a response's matching result.
  assert.equal(excel.readExcelEvidence(bytes), sheets)
  assert.equal(excel.findExcelEvidenceMatches(sheets, [ref(metadataPassage.replace('02/01/2027', '02/01/2028'))]).matches.length, 0)
})

test('multi-row field matching requires every complete field, correct dates and the original scope', () => {
  const sheets = excel.readExcelEvidence(dateFixture({ extended: true }))
  for (const passage of [metadataPassage.replace('02/01/2026', '02/01/1926'), metadataPassage.replace('02/01/2026', '01/02/2026'), metadataPassage.replace('Senegal', 'Mali'), metadataPassage.replace('Regional/Charter', 'Charter')]) {
    assert.equal(excel.findExcelEvidenceMatches(sheets, [ref(passage)]).matches.length, 0, passage)
  }
  assert.equal(excel.findExcelEvidenceMatches(sheets, [ref(metadataPassage, { cellRange: 'H2:P3' })]).matches.length, 0)
  assert.equal(excel.findExcelEvidenceMatches(sheets, [ref(metadataPassage, { sheetName: 'Fleet', cellRange: 'E2:P3' })]).matches.length, 1)
})

test('field fallback does not skip a contradictory value within a row or jump to distant rows', () => {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ['Premium', '$99.00', 'Tax', '$1,500.00'], ['Status', 'No claims'],
    [], [], [], ['Domicile', 'Senegal'],
  ]), 'Fields')
  const sheets = excel.readExcelEvidence(new Uint8Array(XLSX.write(book, { type: 'array', bookType: 'xlsx' })))
  for (const passage of ['Premium\n$1,500.00\nStatus\nNo claims', 'Premium\n$99.00\nDomicile\nSenegal', 'Premium\n$99.00\nStatus\nclaims']) {
    assert.equal(excel.findExcelEvidenceMatches(sheets, [ref(passage)]).matches.length, 0, passage)
  }
})

test('ambiguous repeated fields require a source range instead of choosing one arbitrarily', () => {
  const book = XLSX.read(dateFixture({ extended: true }), { type: 'array', cellNF: true })
  // This other Senegal lies outside the intended form rectangle, but is close
  // enough that an unscoped search cannot prove which occurrence the AI meant.
  book.Sheets.Fleet.C3 = { t: 's', v: 'Senegal' }; book.Sheets.Fleet['!ref'] = 'C2:U3'
  const sheets = excel.readExcelEvidence(new Uint8Array(XLSX.write(book, { type: 'array', bookType: 'xlsx' })))
  assert.equal(excel.findExcelEvidenceMatches(sheets, [ref(metadataPassage)]).matches.length, 0)
  assert.equal(excel.findExcelEvidenceMatches(sheets, [ref(metadataPassage, { cellRange: 'E2:P3' })]).matches.length, 1)
})

test('matches the screenshot dates across H2, I2, K2 and L2 without altering displayed text or offsets', () => {
  for (const bookType of ['xlsx', 'xls', 'xlsb']) {
    const sheets = excel.readExcelEvidence(dateFixture({ bookType }))
    assert.equal(sheets[0].byAddress.get('I2').text, '2/1/26')
    const { matches } = excel.findExcelEvidenceMatches(sheets, datePassages.map((text) => ref(text)))
    assert.equal(matches.length, 2, bookType)
    assert.deepEqual(Array.from(matches[0].cells, (cell) => cell.address), ['H2', 'I2', 'K2', 'L2'])
    assert.deepEqual(Array.from(matches[1].cells, (cell) => cell.address), ['H3', 'I3'])
    const date = matches[0].cells.find((cell) => cell.address === 'I2')
    assert.equal(date.start, 0); assert.equal(date.end, '2/1/26'.length)
    assert.equal(sheets[0].byAddress.get('I2').text, '2/1/26')
  }
})

test('date formatting tolerance keeps the stored century, component order and cell scope', () => {
  for (const date1904 of [false, true]) {
    const sheets = excel.readExcelEvidence(dateFixture({ date1904 }))
    for (const date of ['02/01/2026', '2-1-2026', '02.01.26', '2/1/26']) {
      assert.equal(excel.findExcelEvidenceMatches(sheets, [ref(`Inception ${date}`)]).matches.length, 1, date)
      assert.equal(excel.findExcelEvidenceMatches(sheets, [ref(date, { cellRange: 'I2' })]).matches.length, 1, `Date-only ${date}`)
    }
    for (const date of ['01/02/2026', '02/01/1926', '02/01/2027', '31/02/2026', '1/26', '26']) {
      assert.equal(excel.findExcelEvidenceMatches(sheets, [ref(`Inception ${date}`)]).matches.length, 0, date)
      assert.equal(excel.findExcelEvidenceMatches(sheets, [ref(date, { cellRange: 'I2' })]).matches.length, 0, `Date-only ${date}`)
    }
    assert.equal(excel.findExcelEvidenceMatches(sheets, [ref(datePassages[0], { cellRange: 'H2:I2' })]).matches.length, 0)
    assert.equal(excel.findExcelEvidenceMatches(sheets, [ref(datePassages[0], { sheetName: 'Fleet', cellRange: 'H2:L2' })]).matches.length, 1)
  }
  const historical = excel.readExcelEvidence(dateFixture({ year: 1926 }))
  assert.equal(excel.findExcelEvidenceMatches(historical, [ref('Inception 02/01/2026')]).matches.length, 0)
  assert.equal(excel.findExcelEvidenceMatches(historical, [ref('Inception 02/01/1926')]).matches.length, 1)
})

test('date aliases retain all occurrences and do not infer centuries for text-only short years', () => {
  const book = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Inception', '02/01/2026'], ['Inception', '2/1/2026'], ['Inception', '2/1/26'],
  ])
  XLSX.utils.book_append_sheet(book, sheet, 'Text dates')
  const sheets = excel.readExcelEvidence(new Uint8Array(XLSX.write(book, { type: 'array', bookType: 'xlsx' })))
  const { matches } = excel.findExcelEvidenceMatches(sheets, [ref('Inception 02/01/2026')])
  assert.deepEqual(Array.from(matches, (match) => match.cells.at(-1).address), ['B1', 'B2'])
  assert.equal(excel.findExcelEvidenceMatches(sheets, [ref('Inception 02/01/26')]).matches.length, 3)
  assert.equal(excel.findExcelEvidenceMatches(sheets, [ref('Inception 02/01/1926')]).matches.length, 0)
  assert.equal(excel.findExcelEvidenceMatches(sheets, [ref('Inception 1/2026')]).matches.length, 0)
})

test('opens XLSX, XLS and XLSB workbooks and preserves formatted values, merges and saved formulas', () => {
  for (const type of ['xlsx', 'xls', 'xlsb']) {
    const bytes = fixture(type)
    assert.equal(format.evidenceDocumentFormat(bytes, `Evidence.${type}`), 'excel')
    const sheets = excel.readExcelEvidence(bytes)
    assert.deepEqual(Array.from(sheets, (sheet) => sheet.name), ['Claims', 'Capacity', 'Empty', 'Schedule'])
    assert.equal(sheets[0].byAddress.get('B2').text, '$1,500.00')
    assert.equal(sheets[0].byAddress.get('B3').text, '5%')
    assert.equal(sheets[0].byAddress.get('B5').text, '2024-01-01')
    assert.equal(sheets[0].byAddress.get('B6').text, '$1,575.00')
    // The test writer preserves formula strings in XLSX; binary fixture exports
    // preserve the cached result but may omit the formula record.
    if (type === 'xlsx') assert.equal(sheets[0].byAddress.get('B6').formula, 'B2*(1+B3)')
    assert.equal(sheets[0].merges.length, 1)
    assert.equal(sheets[1].hidden, true)
    assert.equal(sheets[2].cells.length, 0)
  }
  assert.equal(format.evidenceDocumentFormat(fixture(), 'Evidence', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), 'excel')
  assert.throws(() => format.evidenceDocumentFormat(new TextEncoder().encode('<html>not excel</html>'), 'Evidence.xlsx'), /not a valid Excel/)
})

test('matches complete labels and values across cells, retaining exact cell ranges', () => {
  const sheets = excel.readExcelEvidence(fixture())
  const result = excel.findExcelEvidenceMatches(sheets, [ref('Premium $1,500.00'), ref('Tax: 5%'), ref('Invoice date 2024-01-01')])
  assert.equal(result.matches.length, 3)
  assert.deepEqual(Array.from(result.matches[0].cells, (cell) => cell.address), ['A2', 'B2'])
  assert.equal(result.matches[0].locationLabel, 'Claims · A2:B2')
  assert.equal(result.matches[0].cells[1].start, 0)
  assert.equal(result.matches[0].cells[1].end, '$1,500.00'.length)
})

test('finds repeated values across sheets and respects optional sheet and cell constraints', () => {
  const sheets = excel.readExcelEvidence(fixture())
  const unscoped = excel.findExcelEvidenceMatches(sheets, [ref('No claims')])
  assert.deepEqual(Array.from(unscoped.matches, (match) => match.sheetIndex), [0, 1])
  const scoped = excel.findExcelEvidenceMatches(sheets, [ref('No claims', { sheetName: 'capacity', cellRange: '$A$2' })])
  assert.equal(scoped.matches.length, 1)
  assert.equal(scoped.matches[0].locationLabel, 'Capacity · A2')
  assert.equal(excel.findExcelEvidenceMatches(sheets, [ref('No claims', { cellRange: "'Claims'!B4:B4" })]).matches.length, 1)
  assert.equal(excel.findExcelEvidenceMatches(sheets, [ref('No claims', { cellRange: 'A1:A1' })]).matches.length, 0)
})

test('does not silently widen invalid or conflicting sheet/cell references', () => {
  const sheets = excel.readExcelEvidence(fixture())
  for (const fields of [{ sheetName: 'Missing' }, { cellRange: 'bad' }, { cellRange: 'XFE1' }, { cellRange: 'B9:A1' }, { sheetName: 'Claims', cellRange: 'Capacity!A2' }]) {
    const result = excel.findExcelEvidenceMatches(sheets, [ref('No claims', fields)])
    assert.equal(result.matches.length, 0)
    assert.ok(result.notes[0])
  }
  const references = evidence.documentEvidence({ evidenceReferences: [ref('No claims', { sheetName: 'Claims', cellRange: 'B4' }), ref('No claims', { sheetName: 'Capacity', cellRange: 'A2' })] })
  assert.equal(references.length, 2)
  assert.equal(references[1].sheetName, 'Capacity')
  assert.equal(references[1].cellRange, 'A2')
})

test('does not accept partial amounts, changed percentages, negations or distant unrelated cells', () => {
  const sheets = excel.readExcelEvidence(fixture())
  for (const query of ['1500', '500', '5', 'Tax 50%', 'Status claims', 'Reference $1,500.00']) {
    assert.equal(excel.findExcelEvidenceMatches(sheets, [ref(query)]).matches.length, 0, query)
  }
  const book = XLSX.utils.book_new(), source = { A1: { t: 's', v: 'Premium' }, B500: { t: 's', v: '$1,500.00' }, '!ref': 'A1:B500' }
  XLSX.utils.book_append_sheet(book, source, 'Distant')
  const distant = excel.readExcelEvidence(new Uint8Array(XLSX.write(book, { type: 'array', bookType: 'xlsx' })))
  assert.equal(excel.findExcelEvidenceMatches(distant, [ref('Premium $1,500.00')]).matches.length, 0)
})

test('renders merged cells once, clips merges safely and reads empty sheets', () => {
  const sheets = excel.readExcelEvidence(fixture())
  const view = excel.excelEvidenceWindow(sheets[0], 0, 0)
  const merged = view.rows.find((row) => row.row === 7).cells
  assert.equal(merged[0].text, 'Merged policy terms')
  assert.equal(merged[0].colSpan, 3)
  assert.equal(merged.length, 1)
  const clipped = excel.excelEvidenceWindow(sheets[0], 7, 1)
  assert.equal(clipped.rows[0].cells[0].address, 'A8')
  assert.equal(clipped.rows[0].cells[0].text, 'Merged policy terms')
  assert.equal(clipped.rows[0].cells[0].colSpan, 2)
  assert.equal(excel.excelEvidenceWindow(sheets[2], 0, 0).rows.length, 1)
})

async function sparseFixture() {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>')
  zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
  zip.file('xl/workbook.xml', '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sparse" sheetId="1" r:id="rId1"/></sheets></workbook>')
  zip.file('xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>')
  zip.file('xl/worksheets/sheet1.xml', '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:XFD1048576"/><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>First cell</t></is></c></row><row r="1048576"><c r="XFD1048576" t="inlineStr"><is><t>Last evidence cell</t></is></c></row></sheetData></worksheet>')
  return zip.generateAsync({ type: 'uint8array' })
}

test('indexes a genuinely sparse full-size XLSX without expanding the entire grid', async () => {
  const sheets = excel.readExcelEvidence(await sparseFixture())
  assert.equal(sheets[0].cells.length, 2)
  const first = excel.excelEvidenceWindow(sheets[0], 0, 0)
  assert.equal(first.rows.length, excel.EXCEL_PREVIEW_ROWS)
  assert.equal(first.columns.length, excel.EXCEL_PREVIEW_COLUMNS)
  const match = excel.findExcelEvidenceMatches(sheets, [ref('Last evidence cell')]).matches[0]
  assert.equal(match.cells[0].address, 'XFD1048576')
  const last = excel.excelEvidenceWindow(sheets[0], 1048570, 16380)
  assert.ok(last.rows.length <= excel.EXCEL_PREVIEW_ROWS)
  assert.ok(last.columns.length <= excel.EXCEL_PREVIEW_COLUMNS)
  assert.equal(last.rows.at(-1).cells.at(-1).text, 'Last evidence cell')
})

test('retrieves an Excel workbook through the existing evidence flow without changing its bytes', async () => {
  const bytes = fixture()
  let input
  const api = compile('services/inquiryEvidenceService.ts', { '../lib/inquiryEvidence': evidence, '../lib/evidenceDocumentFormat': format, './sharePointSiteService': {},
    '../generated/services/GetInquiryEvidenceDocumentService': { GetInquiryEvidenceDocumentService: { Run: async (value) => {
      input = value
      return { success: true, data: { success: 'true', filename: 'Evidence.xlsx', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', contentbase64: Buffer.from(bytes).toString('base64') } }
    } } },
  })
  const result = await api.getInquiryEvidenceDocument('{inquiry}', '/aur_inquiry/Example/Evidence.xlsx', 'Evidence')
  assert.equal(result.format, 'excel')
  assert.equal(input.text_1, '/aur_inquiry/Example/Evidence.xlsx')
  assert.deepEqual(Buffer.from(result.bytes), Buffer.from(bytes))
})

test('Excel workspace navigates sheets and distant matches, highlights text, escapes cell HTML and zooms', async () => {
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true })
  const saved = new Map()
  for (const name of ['window', 'document', 'Node', 'Element', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT']) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, { value: name === 'IS_REACT_ACT_ENVIRONMENT' ? true : name === 'window' ? dom.window : dom.window[name], writable: true, configurable: true })
  }
  dom.window.HTMLElement.prototype.scrollTo = function ({ top, left }) { this.scrollTop = top; this.scrollLeft = left }
  const React = require('react'), { act } = React
  const rootElement = dom.window.document.getElementById('root')
  const root = require('react-dom/client').createRoot(rootElement)
  try {
    const dependencies = { react: React, 'react/jsx-runtime': require('react/jsx-runtime'), 'lucide-react': require('lucide-react'),
      '../ui/Button': { Button: ({ children, variant, size, ...props }) => React.createElement('button', props, children) } }
    const layout = compile('components/inquiries/EvidenceViewerLayout.tsx', dependencies)
    const { default: Viewer } = compile('components/inquiries/ExcelEvidenceViewer.tsx', { ...dependencies, '../../lib/excelEvidence': excel, './EvidenceViewerLayout': layout })
    const bytes = fixture(), before = Buffer.from(bytes)
    await act(async () => { root.render(React.createElement(Viewer, { bytes, passages: ['Premium $1,500.00', 'High risk reference'] })) })
    for (let attempt = 0; attempt < 20 && rootElement.querySelector('[aria-busy="true"]'); attempt++) await act(async () => { await new Promise(setImmediate) })
    assert.equal(rootElement.querySelector('[aria-busy="true"]'), null)
    assert.equal(rootElement.querySelector('[role="tab"][aria-selected="true"]').textContent, 'Claims')
    assert.equal(rootElement.querySelector('[data-cell-address="B2"] mark').textContent, '$1,500.00')
    assert.equal(rootElement.querySelector('[data-cell-address="B10"]').textContent, '<img src=x onerror=alert(1)>')
    assert.equal(rootElement.querySelectorAll('img').length, 0)
    assert.equal(rootElement.querySelector('[data-cell-address="A8"]').colSpan, 3)
    const click = async (label) => {
      const button = rootElement.querySelector(`button[aria-label="${label}"]`)
      assert.ok(button, label); assert.equal(button.disabled, false, label)
      await act(async () => { button.click() })
    }
    await click('Next evidence match')
    assert.equal(rootElement.querySelector('[role="tab"][aria-selected="true"]').textContent, 'Schedule')
    assert.equal(rootElement.querySelector('[data-cell-address="AD501"] mark').textContent, 'High risk reference')
    assert.ok(rootElement.textContent.includes('2 of 2'))
    await click('Zoom in'); assert.ok(rootElement.textContent.includes('125%'))
    await click('Previous worksheet rows'); assert.equal(rootElement.querySelector('[data-cell-address="AD501"]'), null)
    await click('Previous evidence match'); assert.equal(rootElement.querySelector('[role="tab"][aria-selected="true"]').textContent, 'Claims')
    await click('Next worksheet'); assert.ok(rootElement.querySelector('[role="tab"][aria-selected="true"]').textContent.includes('Capacity'))
    await click('Hide evidence sidebar'); assert.equal(rootElement.querySelector('aside'), null)
    assert.deepEqual(Buffer.from(bytes), before)

    // The screenshot case must also highlight the short displayed date in the
    // actual viewer, including all four nonempty cells across blank J2.
    const dateBytes = dateFixture(), dateBefore = Buffer.from(dateBytes)
    await act(async () => { root.render(React.createElement(Viewer, { bytes: dateBytes, passages: datePassages })) })
    for (let attempt = 0; attempt < 20 && rootElement.querySelector('[aria-busy="true"]'); attempt++) await act(async () => { await new Promise(setImmediate) })
    assert.ok(rootElement.textContent.includes('2 text matches found'))
    for (const [address, text] of [['H2', 'Inception'], ['I2', '2/1/26'], ['K2', 'Currency'], ['L2', 'USD and EUR']]) {
      assert.equal(rootElement.querySelector(`[data-cell-address="${address}"] mark`).textContent, text)
    }
    assert.equal(rootElement.querySelector('[data-cell-address="J2"] mark'), null)
    assert.equal(rootElement.querySelector('[data-cell-address="M2"] mark'), null)
    await click('Next evidence match')
    assert.ok(rootElement.textContent.includes('2 of 2'))
    assert.equal(rootElement.querySelector('[data-cell-address="I3"] mark').textContent, '2/1/27')
    assert.deepEqual(Buffer.from(dateBytes), dateBefore)

    await click('Show evidence sidebar')
    const extended = dateFixture({ extended: true })
    await act(async () => { root.render(React.createElement(Viewer, { bytes: extended, passages: [metadataPassage] })) })
    for (let attempt = 0; attempt < 20 && rootElement.querySelector('[aria-busy="true"]'); attempt++) await act(async () => { await new Promise(setImmediate) })
    assert.ok(rootElement.textContent.includes('1 text match found'))
    assert.ok(rootElement.textContent.includes('area spanning adjacent rows'))
    for (const [address, text] of [['H2', 'Inception'], ['I2', '2/1/26'], ['K2', 'Currency'], ['L2', 'USD and EUR'], ['M2', 'Type'], ['N2', 'Regional/Charter'], ['P2', 'Average value (USD)'], ['E3', 'Domicile'], ['F3', 'Senegal'], ['H3', 'Expiry'], ['I3', '2/1/27']]) {
      assert.equal(rootElement.querySelector(`[data-cell-address="${address}"] mark`)?.textContent, text, address)
    }
    for (const address of ['R2', 'S2', 'U2']) assert.equal(rootElement.querySelector(`[data-cell-address="${address}"] mark`), null)

    const aircraft = aircraftFixture(), aircraftBefore = Buffer.from(aircraft)
    await act(async () => { root.render(React.createElement(Viewer, { bytes: aircraft, passages: [aircraftPassage], references: [ref(aircraftPassage, { cellRange: 'B6:J6' })] })) })
    for (let attempt = 0; attempt < 20 && rootElement.querySelector('[aria-busy="true"]'); attempt++) await act(async () => { await new Promise(setImmediate) })
    assert.ok(rootElement.textContent.includes('1 text match found'))
    assert.ok(rootElement.textContent.includes('Fleet · B6:J6'))
    for (const [address, text] of [['B6', '9H SZN'], ['D6', '1910'], ['E6', 'A330-941 NEO'], ['F6', 'A330-941 NEO'], ['G6', '€48,495,925'], ['I6', '$1,000,000,000'], ['J6', '290']]) {
      assert.equal(rootElement.querySelector(`[data-cell-address="${address}"] mark`)?.textContent, text, address)
    }
    for (const address of ['A6', 'C6', 'H6', 'K6', 'B7', 'G7', 'I7']) assert.equal(rootElement.querySelector(`[data-cell-address="${address}"] mark`), null, address)
    assert.deepEqual(Buffer.from(aircraft), aircraftBefore)

    const lossRun = lossRunFixture(), lossRunBefore = Buffer.from(lossRun)
    const reordered = 'Closed Claims:\nNEOS\nSPA\nOpen Claims\nPolicy\nYear'
    await act(async () => { root.render(React.createElement(Viewer, { bytes: lossRun, passages: [reordered] })) })
    for (let attempt = 0; attempt < 20 && rootElement.querySelector('[aria-busy="true"]'); attempt++) await act(async () => { await new Promise(setImmediate) })
    assert.ok(rootElement.textContent.includes('1 text match found'))
    assert.ok(rootElement.textContent.includes('Field-based match:'))
    assert.ok(rootElement.textContent.includes('Summary · A5:C8'))
    for (const [address, text] of [['A5', 'NEOS SPA'], ['A8', 'Policy\nYear'], ['B8', 'Open Claims'], ['C8', 'Closed Claims']]) {
      assert.equal(rootElement.querySelector(`[data-cell-address="${address}"] mark`)?.textContent, text, address)
    }
    for (const address of ['D8', 'D9', 'A10', 'B10', 'C10']) assert.equal(rootElement.querySelector(`[data-cell-address="${address}"] mark`), null, address)
    assert.deepEqual(Buffer.from(lossRun), lossRunBefore)

    const passengers = passengersFixture(), passengersBefore = Buffer.from(passengers)
    await act(async () => { root.render(React.createElement(Viewer, { bytes: passengers, passages: ['Passengers\n2476502\n2353049'] })) })
    for (let attempt = 0; attempt < 20 && rootElement.querySelector('[aria-busy="true"]'); attempt++) await act(async () => { await new Promise(setImmediate) })
    assert.ok(rootElement.textContent.includes('1 text match found'))
    assert.ok(rootElement.textContent.includes('As If - Annual · A14:C14'))
    for (const [address, text] of [['A14', 'Passengers'], ['B14', '2,476,502'], ['C14', '2,353,049']]) {
      assert.equal(rootElement.querySelector(`[data-cell-address="${address}"] mark`)?.textContent, text, address)
    }
    for (const address of ['D14', 'A15', 'B15', 'C15']) assert.equal(rootElement.querySelector(`[data-cell-address="${address}"] mark`), null, address)
    assert.deepEqual(Buffer.from(passengers), passengersBefore)
  } finally {
    await act(async () => { root.unmount() })
    for (const [name, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name] }
    dom.window.close()
  }
})
