/**
 * Shared types for the document parsing pipeline.
 * Every parser module must return a ParsedDocument.
 */

export interface Heading {
  level: number  // 1–6
  text: string
  pageNumber?: number
}

export interface Page {
  pageNumber: number
  content: string  // Plain text or Markdown for the page
}

export interface TableRow {
  [header: string]: string
}

export interface DocumentTable {
  headers: string[]
  rows: TableRow[]
  markdown: string  // Pre-rendered Markdown table for direct embedding
  pageNumber?: number
  tableIndex: number
}

export interface DocumentImage {
  imageIndex: number
  caption?: string
  ocrText?: string        // Text extracted via OCR or Vision API
  description?: string    // AI-generated description
  pageNumber?: number
}

export interface CitationRef {
  page?: number
  heading?: string
  section?: string
}

export interface ParsedDocument {
  /** Full document content as Markdown — primary field sent to generate-embeddings */
  markdown: string
  headings: Heading[]
  pages: Page[]
  tables: DocumentTable[]
  images: DocumentImage[]
  metadata: Record<string, unknown>
  mimeType: string
  parseVersion: string
  /** Per-chunk citation map — index corresponds to chunk position in flattened text */
  citations?: CitationRef[]
}

export const PARSE_VERSION = 'v1'

export type SupportedMimeType =
  | 'application/pdf'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'  // DOCX
  | 'application/vnd.openxmlformats-officedocument.presentationml.presentation' // PPTX
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'  // XLSX
  | 'application/vnd.ms-excel'
  | 'text/csv'
  | 'text/html'
  | 'text/markdown'
  | 'text/plain'
  | 'image/png'
  | 'image/jpeg'
  | 'image/jpg'
  | 'image/webp'
  | 'image/svg+xml'
  | 'audio/mpeg'
  | 'audio/wav'
  | 'audio/m4a'
  | 'audio/mp4'
  | 'audio/aac'
  | 'audio/ogg'
  | 'message/rfc822'  // EML

export type UnsupportedMimeType = 'unsupported'
export type DetectedMimeType = SupportedMimeType | UnsupportedMimeType

/** Parser categories for routing */
export type ParserCategory =
  | 'pdf'
  | 'office'
  | 'spreadsheet'
  | 'html'
  | 'text'
  | 'image'
  | 'audio'
  | 'email'
  | 'unsupported'
