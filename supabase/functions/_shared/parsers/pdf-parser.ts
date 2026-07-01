/**
 * PDF parser — uses Unstructured.io API to extract structured content.
 * Falls back to plain text extraction for simple/text-native PDFs when no API key is set.
 */

import type { ParsedDocument, Heading, Page, DocumentTable, DocumentImage, CitationRef } from './types.ts'
import { PARSE_VERSION } from './types.ts'

interface UnstructuredElement {
  type: string
  text: string
  metadata?: {
    page_number?: number
    filename?: string
    filetype?: string
    languages?: string[]
    emphasized_text_contents?: string[]
    text_as_html?: string
    table_html?: string
  }
}

interface PdfParseOptions {
  unstructuredApiKey?: string
  mimeType: string
}

function elementToHeadingLevel(type: string): number | null {
  const map: Record<string, number> = {
    Title: 1,
    Header: 1,
    'Header 1': 1,
    'Header 2': 2,
    'Header 3': 3,
    SectionHeader: 2,
  }
  return map[type] ?? null
}

function htmlTableToMarkdown(html: string): { headers: string[]; rows: Record<string,string>[]; markdown: string } {
  // Extract cells with simple regex (no DOM in Deno edge functions)
  const rows: string[][] = []
  const rowMatches = html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)
  for (const rowMatch of rowMatches) {
    const cells: string[] = []
    const cellMatches = rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)
    for (const cell of cellMatches) {
      cells.push(cell[1].replace(/<[^>]+>/g, '').trim())
    }
    if (cells.length > 0) rows.push(cells)
  }

  if (rows.length === 0) return { headers: [], rows: [], markdown: '' }

  const headers = rows[0]
  const dataRows = rows.slice(1)
  const recordRows = dataRows.map((r) =>
    Object.fromEntries(headers.map((h, i) => [h, r[i] ?? '']))
  )

  const separator = headers.map(() => '---').join(' | ')
  const markdownRows = dataRows.map((r) => r.join(' | '))
  const markdown = [
    `| ${headers.join(' | ')} |`,
    `| ${separator} |`,
    ...markdownRows.map((r) => `| ${r} |`),
  ].join('\n')

  return { headers, rows: recordRows, markdown }
}

async function parseWithUnstructured(
  fileBlob: Blob,
  fileName: string,
  apiKey: string
): Promise<UnstructuredElement[]> {
  const formData = new FormData()
  formData.append('files', new File([fileBlob], fileName, { type: 'application/pdf' }))
  formData.append('strategy', 'hi_res')
  formData.append('split_pdf_page', 'true')
  formData.append('coordinates', 'false')
  formData.append('include_page_breaks', 'true')

  const response = await fetch('https://api.unstructured.io/general/v0/general', {
    method: 'POST',
    headers: {
      'unstructured-api-key': apiKey,
    },
    body: formData,
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Unstructured.io API error ${response.status}: ${err}`)
  }

  return await response.json() as UnstructuredElement[]
}

export async function parsePdf(
  fileBlob: Blob,
  fileName: string,
  options: PdfParseOptions
): Promise<ParsedDocument> {
  const headings: Heading[] = []
  const pages: Page[] = []
  const tables: DocumentTable[] = []
  const images: DocumentImage[] = []
  const citations: CitationRef[] = []
  const markdownLines: string[] = []

  if (options.unstructuredApiKey) {
    const elements = await parseWithUnstructured(fileBlob, fileName, options.unstructuredApiKey)

    const pageContents: Record<number, string[]> = {}
    let tableIndex = 0
    let lastHeading = ''

    for (const el of elements) {
      const page = el.metadata?.page_number ?? 1
      if (!pageContents[page]) pageContents[page] = []

      const headingLevel = elementToHeadingLevel(el.type)

      if (headingLevel !== null) {
        const prefix = '#'.repeat(headingLevel)
        headings.push({ level: headingLevel, text: el.text, pageNumber: page })
        markdownLines.push(`${prefix} ${el.text}`)
        pageContents[page].push(`${prefix} ${el.text}`)
        lastHeading = el.text
      } else if (el.type === 'Table' && el.metadata?.text_as_html) {
        const { headers, rows, markdown } = htmlTableToMarkdown(el.metadata.text_as_html)
        tables.push({
          headers,
          rows,
          markdown,
          pageNumber: page,
          tableIndex: tableIndex++,
        })
        markdownLines.push(markdown)
        pageContents[page].push(markdown)
      } else if (el.type === 'Image') {
        images.push({
          imageIndex: images.length,
          caption: el.text || undefined,
          pageNumber: page,
        })
      } else if (el.type === 'PageBreak') {
        // marker only
      } else if (el.text) {
        markdownLines.push(el.text)
        pageContents[page].push(el.text)
        citations.push({ page, heading: lastHeading || undefined })
      }
    }

    // Build pages array from grouped content
    for (const [pageNum, lines] of Object.entries(pageContents)) {
      pages.push({
        pageNumber: Number(pageNum),
        content: lines.join('\n\n'),
      })
    }
  } else {
    // Fallback: plain text extraction (works for text-native PDFs)
    const text = await fileBlob.text()
    const cleanText = text.replace(/\0/g, ' ').trim()
    if (cleanText) {
      markdownLines.push(cleanText)
      pages.push({ pageNumber: 1, content: cleanText })
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
      parser: 'pdf-parser',
      used_unstructured: Boolean(options.unstructuredApiKey),
    },
    mimeType: options.mimeType,
    parseVersion: PARSE_VERSION,
  }
}
