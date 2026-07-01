/**
 * Office document parser (DOCX, PPTX) — uses Unstructured.io API.
 * Extracts headings, paragraphs, tables, slide titles, and speaker notes.
 */

import type { ParsedDocument, Heading, Page, DocumentTable, DocumentImage, CitationRef } from './types.ts'
import { PARSE_VERSION } from './types.ts'

interface UnstructuredElement {
  type: string
  text: string
  metadata?: {
    page_number?: number
    slide_number?: number
    text_as_html?: string
    is_continuation?: boolean
  }
}

interface OfficeParseOptions {
  unstructuredApiKey?: string
  mimeType: string
}

function mimeToStrategy(mime: string): 'fast' | 'hi_res' {
  if (mime.includes('presentationml')) return 'fast'
  return 'hi_res'
}

function htmlTableToMarkdown(html: string): { headers: string[]; rows: Record<string, string>[]; markdown: string } {
  const rows: string[][] = []
  for (const rowMatch of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells: string[] = []
    for (const cell of rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)) {
      cells.push(cell[1].replace(/<[^>]+>/g, '').trim())
    }
    if (cells.length > 0) rows.push(cells)
  }
  if (rows.length === 0) return { headers: [], rows: [], markdown: '' }
  const headers = rows[0]
  const dataRows = rows.slice(1)
  const recordRows = dataRows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])))
  const sep = headers.map(() => '---').join(' | ')
  const md = [
    `| ${headers.join(' | ')} |`,
    `| ${sep} |`,
    ...dataRows.map((r) => `| ${r.join(' | ')} |`),
  ].join('\n')
  return { headers, rows: recordRows, markdown: md }
}

async function parseWithUnstructured(
  fileBlob: Blob,
  fileName: string,
  apiKey: string,
  mimeType: string
): Promise<UnstructuredElement[]> {
  const formData = new FormData()
  formData.append('files', new File([fileBlob], fileName, { type: mimeType }))
  formData.append('strategy', mimeToStrategy(mimeType))
  formData.append('include_page_breaks', 'true')

  const response = await fetch('https://api.unstructured.io/general/v0/general', {
    method: 'POST',
    headers: { 'unstructured-api-key': apiKey },
    body: formData,
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Unstructured.io API error ${response.status}: ${err}`)
  }

  return await response.json() as UnstructuredElement[]
}

export async function parseOffice(
  fileBlob: Blob,
  fileName: string,
  options: OfficeParseOptions
): Promise<ParsedDocument> {
  const headings: Heading[] = []
  const pages: Page[] = []
  const tables: DocumentTable[] = []
  const images: DocumentImage[] = []
  const citations: CitationRef[] = []
  const markdownLines: string[] = []
  const isPptx = options.mimeType.includes('presentationml')

  if (options.unstructuredApiKey) {
    const elements = await parseWithUnstructured(fileBlob, fileName, options.unstructuredApiKey, options.mimeType)

    const pageContents: Record<number, string[]> = {}
    let tableIndex = 0
    let lastHeading = ''

    for (const el of elements) {
      const pageNum = el.metadata?.slide_number ?? el.metadata?.page_number ?? 1
      if (!pageContents[pageNum]) pageContents[pageNum] = []

      if (el.type === 'Title' || el.type === 'Header') {
        const level = el.type === 'Title' ? 1 : 2
        headings.push({ level, text: el.text, pageNumber: pageNum })
        markdownLines.push(`${'#'.repeat(level)} ${el.text}`)
        pageContents[pageNum].push(`${'#'.repeat(level)} ${el.text}`)
        lastHeading = el.text
      } else if (el.type === 'Table' && el.metadata?.text_as_html) {
        const { headers, rows, markdown } = htmlTableToMarkdown(el.metadata.text_as_html)
        tables.push({ headers, rows, markdown, pageNumber: pageNum, tableIndex: tableIndex++ })
        markdownLines.push(markdown)
        pageContents[pageNum].push(markdown)
      } else if (el.type === 'Image') {
        images.push({ imageIndex: images.length, caption: el.text || undefined, pageNumber: pageNum })
      } else if (el.type === 'NarrativeText' || el.type === 'ListItem' || el.type === 'BulletedText') {
        const prefix = el.type === 'ListItem' || el.type === 'BulletedText' ? '- ' : ''
        markdownLines.push(`${prefix}${el.text}`)
        pageContents[pageNum].push(`${prefix}${el.text}`)
        citations.push({ page: pageNum, heading: lastHeading || undefined })
      } else if (el.type === 'FigureCaption') {
        markdownLines.push(`*${el.text}*`)
        pageContents[pageNum].push(`*${el.text}*`)
      } else if (el.text) {
        markdownLines.push(el.text)
        pageContents[pageNum].push(el.text)
        citations.push({ page: pageNum, heading: lastHeading || undefined })
      }
    }

    for (const [pageNum, lines] of Object.entries(pageContents)) {
      pages.push({
        pageNumber: Number(pageNum),
        content: lines.join('\n\n'),
      })
    }
  } else {
    // Fallback: raw text (only works for DOCX with embedded text)
    const text = await fileBlob.text().catch(() => '')
    if (text) {
      markdownLines.push(text)
      pages.push({ pageNumber: 1, content: text })
    }
  }

  pages.sort((a, b) => a.pageNumber - b.pageNumber)

  return {
    markdown: markdownLines.join('\n\n'),
    headings,
    pages,
    tables,
    images,
    citations,
    metadata: {
      source_file: fileName,
      parser: isPptx ? 'pptx-parser' : 'docx-parser',
      slide_count: isPptx ? pages.length : undefined,
      used_unstructured: Boolean(options.unstructuredApiKey),
    },
    mimeType: options.mimeType,
    parseVersion: PARSE_VERSION,
  }
}
