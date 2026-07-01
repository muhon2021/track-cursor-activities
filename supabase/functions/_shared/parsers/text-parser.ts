/**
 * Plain text and Markdown parser.
 * Normalizes encoding and line endings; extracts heading structure from Markdown.
 */

import type { ParsedDocument, Heading, Page } from './types.ts'
import { PARSE_VERSION } from './types.ts'

interface TextParseOptions {
  mimeType: string
}

function extractMarkdownHeadings(text: string): Heading[] {
  const headings: Heading[] = []
  for (const line of text.split('\n')) {
    const match = line.match(/^(#{1,6})\s+(.+)/)
    if (match) {
      headings.push({ level: match[1].length, text: match[2].trim() })
    }
  }
  return headings
}

function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')  // Windows line endings
    .replace(/\r/g, '\n')    // Old Mac line endings
    .replace(/\x00/g, '')    // Null bytes
    .replace(/\uFEFF/g, '')  // BOM
    .trim()
}

function splitIntoLogicalPages(text: string, linesPerPage = 100): Page[] {
  const lines = text.split('\n')
  const pages: Page[] = []
  let pageNum = 1
  for (let i = 0; i < lines.length; i += linesPerPage) {
    const chunk = lines.slice(i, i + linesPerPage).join('\n').trim()
    if (chunk) {
      pages.push({ pageNumber: pageNum++, content: chunk })
    }
  }
  return pages.length > 0 ? pages : [{ pageNumber: 1, content: text }]
}

export async function parseText(
  fileBlob: Blob,
  fileName: string,
  options: TextParseOptions
): Promise<ParsedDocument> {
  const rawText = await fileBlob.text()
  const normalized = normalizeText(rawText)
  const isMarkdown = options.mimeType === 'text/markdown' || fileName.toLowerCase().match(/\.(md|markdown)$/)

  const headings = isMarkdown ? extractMarkdownHeadings(normalized) : []
  const pages = splitIntoLogicalPages(normalized)

  return {
    markdown: normalized,
    headings,
    pages,
    tables: [],
    images: [],
    metadata: {
      source_file: fileName,
      parser: isMarkdown ? 'markdown-parser' : 'text-parser',
      char_count: normalized.length,
      line_count: normalized.split('\n').length,
    },
    mimeType: options.mimeType,
    parseVersion: PARSE_VERSION,
  }
}
