export type DocumentLogoPlacement = 'header' | 'footer' | 'watermark'
export interface DocumentTemplateLogo {
  src: string
  placement: DocumentLogoPlacement
  align: 'left' | 'center' | 'right'
  width: number
  opacity: number
}

export const DOCUMENT_LOGO_ATTRIBUTES = ['data-document-logo', 'data-logo-placement', 'data-logo-align', 'data-logo-width', 'data-logo-opacity']
const embeddedLogo = /^data:image\/(png|jpeg);base64,[a-z0-9+/]+={0,2}$/i
const clamp = (value: number, minimum: number, maximum: number, fallback: number) => Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : fallback

export function normalizeDocumentLogo(logo: DocumentTemplateLogo): DocumentTemplateLogo | null {
  if (!embeddedLogo.test(logo.src) || logo.src.length > 700000) return null
  return {
    src: logo.src,
    placement: ['header', 'footer', 'watermark'].includes(logo.placement) ? logo.placement : 'header',
    align: ['left', 'center', 'right'].includes(logo.align) ? logo.align : 'left',
    width: clamp(logo.width, 80, 480, 180),
    opacity: clamp(logo.opacity, 0.05, 0.3, 0.12),
  }
}

/** A small, versioned HTML marker keeps the image and settings in the existing content column. */
export function readDocumentTemplateLogo(html: string) {
  const root = document.createElement('div')
  root.innerHTML = html
  let logo: DocumentTemplateLogo | null = null
  for (const marker of root.querySelectorAll('[data-document-logo]')) {
    if (!logo && marker.getAttribute('data-document-logo') === 'v1') {
      logo = normalizeDocumentLogo({
        src: marker.querySelector('img')?.getAttribute('src') ?? '',
        placement: marker.getAttribute('data-logo-placement') as DocumentLogoPlacement,
        align: marker.getAttribute('data-logo-align') as DocumentTemplateLogo['align'],
        width: Number(marker.getAttribute('data-logo-width') ?? 180),
        opacity: Number(marker.getAttribute('data-logo-opacity') ?? 0.12),
      })
    }
    marker.remove()
  }
  return { body: root.innerHTML, logo }
}

export function writeDocumentTemplateLogo(body: string, value: DocumentTemplateLogo | null) {
  const content = readDocumentTemplateLogo(body).body
  if (!value) return content
  const logo = normalizeDocumentLogo(value)
  if (!logo) throw new Error('Choose a valid embedded PNG or JPEG logo.')
  const marker = document.createElement('div')
  marker.setAttribute('data-document-logo', 'v1')
  marker.setAttribute('data-logo-placement', logo.placement)
  marker.setAttribute('data-logo-align', logo.align)
  marker.setAttribute('data-logo-width', String(logo.width))
  marker.setAttribute('data-logo-opacity', String(logo.opacity))
  const image = document.createElement('img')
  image.src = logo.src
  image.alt = 'Template logo'
  marker.append(image)
  return marker.outerHTML + content
}

export function documentLogoSize(logo: DocumentTemplateLogo, imageWidth: number, imageHeight: number) {
  const maximumHeight = logo.placement === 'watermark' ? 480 : 64
  const scale = Math.min(logo.width / imageWidth, maximumHeight / imageHeight)
  return { width: imageWidth * scale, height: imageHeight * scale }
}

/** Decode and resize locally; the saved template never depends on an external image URL. */
export async function readDocumentLogoFile(file: File): Promise<string> {
  if (!/\.(png|jpe?g)$/i.test(file.name)) throw new Error('Choose a PNG or JPEG logo. Export SVG logos as PNG first.')
  if (!file.size || file.size > 2 * 1024 * 1024) throw new Error('Choose a logo up to 2 MB.')
  // The Power Apps host permits data: images; some environments do not permit blob: images.
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Unable to read the image file.'))
    reader.onerror = () => reject(new Error('Unable to read the image file. Please retry.'))
    reader.onabort = () => reject(new Error('Image upload was cancelled.'))
    reader.readAsDataURL(file)
  })
  const image = new Image()
  image.src = source
  try { await image.decode() } catch { throw new Error('This image could not be read. Try another PNG or JPEG file.') }
  if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 25000000) throw new Error('This image is too large. Resize the logo before uploading.')
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, 1000 / Math.max(image.naturalWidth, image.naturalHeight))
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Unable to prepare the logo image.')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const src = canvas.toDataURL(/\.png$/i.test(file.name) ? 'image/png' : 'image/jpeg', 0.9)
  if (!embeddedLogo.test(src) || src.length > 700000) throw new Error('The logo is too detailed to embed. Use a smaller image.')
  return src
}
