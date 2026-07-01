/**
 * Spreadsheet parser — handles XLSX and CSV files.
 * Uses SheetJS (xlsx.mjs) for XLSX; plain text parsing for CSV.
 * Converts each sheet/file to Markdown tables for embedding.
 */

import type { ParsedDocument, Heading, Page, DocumentTable } from './types.ts'
import { PARSE_VERSION } from './types.ts'

interface SpreadsheetParseOptions {
  mimeType: string
}

function rowsToMarkdown(headers: string[], rows: string[][]): string {
  if (headers.length === 0) return ''
  const sep = headers.map(() => '---').join(' | ')
  const lines = [
    `| ${headers.join(' | ')} |`,
    `| ${sep} |`,
    ...rows.map((r) => `| ${r.map((c) => String(c).replace(/\|/g, '\\|')).join(' | ')} |`),
  ]
  return lines.join('\n')
}

function parseCSVText(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  if (lines.length === 0) return { headers: [], rows: [] }

  const parse = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current)
        current = ''
      } else {
        current += ch
      }
    }
    result.push(current)
    return result.map((c) => c.trim())
  }

  const headers = parse(lines[0])
  const rows = lines.slice(1).map(parse)
  return { headers, rows }
}

export async function parseSpreadsheet(
  fileBlob: Blob,
  fileName: string,
  options: SpreadsheetParseOptions
): Promise<ParsedDocument> {
  const isCSV = options.mimeType === 'text/csv' || fileName.toLowerCase().endsWith('.csv')

  const tables: DocumentTable[] = []
  const pages: Page[] = []
  const headings: Heading[] = []
  const markdownLines: string[] = []

  if (isCSV) {
    const text = await fileBlob.text()
    const { headers, rows } = parseCSVText(text)
    if (headers.length > 0) {
      const markdown = rowsToMarkdown(headers, rows)
      const recordRows = rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])))
      tables.push({ headers, rows: recordRows, markdown, tableIndex: 0 })
      markdownLines.push(`# ${fileName}\n\n${markdown}`)
      pages.push({ pageNumber: 1, content: markdown })
      headings.push({ level: 1, text: fileName })
    }
  } else {
    // XLSX — use SheetJS
    try {
      const { read, utils } = await import('https://cdn.sheetjs.com/xlsx-latest/package/xlsx.mjs')
      const arrayBuffer = await fileBlob.arrayBuffer()
      const workbook = read(new Uint8Array(arrayBuffer), { type: 'array' })

      let tableIndex = 0
      let pageNum = 1

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName]
        const jsonRows = utils.sheet_to_json(sheet, { header: 1, defval: '' }) as string[][]

        if (jsonRows.length === 0) continue

        const headers = jsonRows[0].map((h) => String(h ?? ''))
        const dataRows = jsonRows.slice(1).filter((r) => r.some((c) => String(c ?? '').trim() !== ''))
        const stringDataRows = dataRows.map((r) => r.map((c) => String(c ?? '')))

        const markdown = rowsToMarkdown(headers, stringDataRows)
        const recordRows = stringDataRows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])))

        tables.push({ headers, rows: recordRows, markdown, tableIndex: tableIndex++ })

        const heading = `Sheet: ${sheetName}`
        headings.push({ level: 2, text: heading })
        markdownLines.push(`## ${heading}\n\n${markdown}`)
        pages.push({ pageNumber: pageNum++, content: `## ${heading}\n\n${markdown}` })
      }

      if (headings.length > 0) {
        headings.unshift({ level: 1, text: fileName })
        markdownLines.unshift(`# ${fileName}`)
      }
    } catch (err) {
      // SheetJS not available — fall back to raw text
      console.error('SheetJS import failed, falling back to text:', err)
      const text = await fileBlob.text().catch(() => '')
      markdownLines.push(text)
      pages.push({ pageNumber: 1, content: text })
    }
  }

  return {
    markdown: markdownLines.join('\n\n'),
    headings,
    pages,
    tables,
    images: [],
    metadata: {
      source_file: fileName,
      parser: 'spreadsheet-parser',
      is_csv: isCSV,
      sheet_count: pages.length,
    },
    mimeType: options.mimeType,
    parseVersion: PARSE_VERSION,
  }
}
