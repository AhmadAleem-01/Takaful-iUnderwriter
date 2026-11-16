export type EvidenceDocumentFormat = 'pdf' | 'docx' | 'doc' | 'excel' | 'image' | 'pptx' | 'ppt' | 'unsupported'

export function evidenceImageMimeType(bytes: Uint8Array): string | undefined {
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value)
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end))
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png'
  if (starts(0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp'
  if (starts(0x42, 0x4d)) return 'image/bmp'
  if (['GIF87a', 'GIF89a'].includes(ascii(0, 6))) return 'image/gif'
  return undefined
}

export function evidenceDocumentFormat(bytes: Uint8Array, filename: string, mimeType = '', documentPath = ''): EvidenceDocumentFormat {
  const mime = mimeType.split(';')[0].trim().toLowerCase()
  const names = [filename, documentPath].map((value) => value.trim().toLowerCase())
  const header = new TextDecoder().decode(bytes.subarray(0, 1024))
  if (evidenceImageMimeType(bytes)) return 'image'
  if (header.includes('%PDF-') && (!mime || mime === 'application/pdf' || mime === 'application/octet-stream')) return 'pdf'
  const powerpoint = mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || names.some((name) => name.endsWith('.pptx'))
  if (powerpoint) {
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) throw new Error('The returned PowerPoint file is not a valid PPTX presentation.')
    return 'pptx'
  }
  if (mime === 'application/vnd.ms-powerpoint' || names.some((name) => name.endsWith('.ppt'))) return 'ppt'
  const word = mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || names.some((name) => name.endsWith('.docx'))
  if (word) {
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) throw new Error('The returned Word file is not a valid DOCX document.')
    return 'docx'
  }
  const excel = names.some((name) => /\.(xlsx|xlsm|xlsb|xls)$/.test(name)) || ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel.sheet.macroenabled.12', 'application/vnd.ms-excel.sheet.binary.macroenabled.12'].includes(mime)
  if (excel) {
    const zip = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04
    const ole = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((value, index) => bytes[index] === value)
    const biff = bytes[0] === 0x09 && [0x00, 0x02, 0x04, 0x08].includes(bytes[1])
    if (!zip && !ole && !biff) throw new Error('The returned file is not a valid Excel workbook.')
    return 'excel'
  }
  if (mime === 'application/msword' || names.some((name) => name.endsWith('.doc'))) return 'doc'
  return 'unsupported'
}
