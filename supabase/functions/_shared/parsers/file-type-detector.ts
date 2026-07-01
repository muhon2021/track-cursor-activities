/**
 * File type detection via magic bytes, MIME type, and file extension.
 * Used by the parser router before dispatching to format-specific parsers.
 */

import type { DetectedMimeType, ParserCategory, SupportedMimeType } from './types.ts'

// Magic byte signatures: [ byteOffset, expectedHex, mimeType ]
type MagicEntry = { offset: number; hex: string; mime: SupportedMimeType }

const MAGIC_SIGNATURES: MagicEntry[] = [
  // PDF: %PDF
  { offset: 0, hex: '25504446', mime: 'application/pdf' },
  // ZIP-based (DOCX/XLSX/PPTX): PK\x03\x04
  { offset: 0, hex: '504b0304', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  // PNG: \x89PNG
  { offset: 0, hex: '89504e47', mime: 'image/png' },
  // JPEG: \xFF\xD8\xFF
  { offset: 0, hex: 'ffd8ff', mime: 'image/jpeg' },
  // WebP: RIFF....WEBP — checked via extension
  // MP3: ID3 or \xFF\xFB
  { offset: 0, hex: '494433', mime: 'audio/mpeg' },
  { offset: 0, hex: 'fffb', mime: 'audio/mpeg' },
  // WAV: RIFF....WAVE
  { offset: 0, hex: '52494646', mime: 'audio/wav' },
  // M4A/MP4: ftyp
  { offset: 4, hex: '66747970', mime: 'audio/m4a' },
]

const EXTENSION_MAP: Record<string, SupportedMimeType> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv',
  html: 'text/html',
  htm: 'text/html',
  md: 'text/markdown',
  markdown: 'text/markdown',
  txt: 'text/plain',
  text: 'text/plain',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/m4a',
  mp4: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  eml: 'message/rfc822',
  msg: 'message/rfc822',
}

// ZIP-based Office formats can only be differentiated by extension
const ZIP_EXTENSION_OVERRIDES: Record<string, SupportedMimeType> = {
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

function bufToHex(buf: Uint8Array, len: number): string {
  return Array.from(buf.slice(0, len))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function detectMimeType(
  blob: Blob,
  fileName: string,
  hintMime?: string
): Promise<DetectedMimeType> {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''

  // For ZIP-based Office files, extension is the only reliable differentiator
  if (ext in ZIP_EXTENSION_OVERRIDES) {
    return ZIP_EXTENSION_OVERRIDES[ext]!
  }

  // Check magic bytes first (most reliable)
  const headerBytes = new Uint8Array(await blob.slice(0, 16).arrayBuffer())
  const header8Hex = bufToHex(headerBytes, 8)

  for (const sig of MAGIC_SIGNATURES) {
    const window = header8Hex.slice(sig.offset * 2)
    if (window.startsWith(sig.hex.toLowerCase())) {
      return sig.mime
    }
  }

  // Fall back to extension
  if (ext in EXTENSION_MAP) {
    return EXTENSION_MAP[ext]!
  }

  // Fall back to hinted MIME from upload metadata
  if (hintMime) {
    const normalized = hintMime.toLowerCase().split(';')[0].trim()
    if (Object.values(EXTENSION_MAP).includes(normalized as SupportedMimeType)) {
      return normalized as SupportedMimeType
    }
  }

  return 'unsupported'
}

export function mimeToCategory(mime: DetectedMimeType): import('./types.ts').ParserCategory {
  if (mime === 'unsupported') return 'unsupported'

  const m = mime as string
  if (m === 'application/pdf') return 'pdf'
  if (
    m.includes('wordprocessingml') ||
    m.includes('presentationml')
  ) return 'office'
  if (m.includes('spreadsheetml') || m === 'application/vnd.ms-excel' || m === 'text/csv') return 'spreadsheet'
  if (m === 'text/html') return 'html'
  if (m === 'text/markdown' || m === 'text/plain') return 'text'
  if (m.startsWith('image/')) return 'image'
  if (m.startsWith('audio/')) return 'audio'
  if (m === 'message/rfc822') return 'email'

  return 'unsupported'
}
