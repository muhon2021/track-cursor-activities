/**
 * HTML parser — extracts meaningful content from HTML pages.
 * Strips navigation, scripts, ads, and layout boilerplate.
 * Preserves headings, paragraphs, lists, and tables as Markdown.
 */

import type { ParsedDocument, Heading, Page, DocumentTable } from './types.ts'
import { PARSE_VERSION } from './types.ts'

/** Remove a full HTML tag and its content */
function stripTag(html: string, tag: string): string {
  return html.replace(new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi'), '')
}

/** Remove tags but keep their inner text */
function unwrapTag(html: string, tag: string): string {
  return html.replace(new RegExp(`<\\/?${tag}[^>]*>`, 'gi'), '')
}

/** Convert inline markup to Markdown equivalents */
function inlineMarkdown(html: string): string {
  return html
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '_$1_')
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '_$1_')
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
}

function parseHeadingsAndContent(html: string): { markdown: string; headings: Heading[] } {
  const headings: Heading[] = []
  const lines: string[] = []

  // Process headings
  const withHeadings = html.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_, level, content) => {
    const text = inlineMarkdown(content)
    if (text) {
      headings.push({ level: Number(level), text })
      lines.push(`${'#'.repeat(Number(level))} ${text}`)
    }
    return ''
  })

  // Process lists
  const withLists = withHeadings.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, content) => {
    const text = inlineMarkdown(content)
    if (text) lines.push(`- ${text}`)
    return ''
  })

  // Process paragraphs
  const withParas = withLists.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, content) => {
    const text = inlineMarkdown(content)
    if (text) lines.push(text)
    return ''
  })

  // Process blockquotes
  withParas.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, content) => {
    const text = inlineMarkdown(content)
    if (text) lines.push(`> ${text}`)
    return ''
  })

  return { markdown: lines.join('\n\n'), headings }
}

function parseTables(html: string): { tables: DocumentTable[]; htmlWithoutTables: string } {
  const tables: DocumentTable[] = []
  let tableIndex = 0

  const cleaned = html.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, body) => {
    const rows: string[][] = []
    for (const rowMatch of body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells: string[] = []
      for (const cell of rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)) {
        cells.push(inlineMarkdown(cell[1]))
      }
      if (cells.length > 0) rows.push(cells)
    }
    if (rows.length < 2) return ''
    const headers = rows[0]
    const dataRows = rows.slice(1)
    const sep = headers.map(() => '---').join(' | ')
    const markdown = [
      `| ${headers.join(' | ')} |`,
      `| ${sep} |`,
      ...dataRows.map((r) => `| ${r.join(' | ')} |`),
    ].join('\n')
    const recordRows = dataRows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])))
    tables.push({ headers, rows: recordRows, markdown, tableIndex: tableIndex++ })
    return `\n${markdown}\n`
  })

  return { tables, htmlWithoutTables: cleaned }
}

export async function parseHtml(fileBlob: Blob, fileName: string): Promise<ParsedDocument> {
  let html = await fileBlob.text()

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch ? inlineMarkdown(titleMatch[1]) : fileName

  // Strip noise elements
  const noiseTags = ['script', 'style', 'nav', 'header', 'footer', 'aside', 'noscript', 'iframe', 'form', 'button']
  for (const tag of noiseTags) {
    html = stripTag(html, tag)
  }

  // Try to isolate main content
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
                    html.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                    html.match(/<div[^>]*id="content"[^>]*>([\s\S]*?)<\/div>/i)
  if (mainMatch) {
    html = mainMatch[1]
  } else {
    // Remove body wrapper and use its content
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    if (bodyMatch) html = bodyMatch[1]
  }

  const { tables, htmlWithoutTables } = parseTables(html)
  const { markdown, headings } = parseHeadingsAndContent(htmlWithoutTables)

  const fullMarkdown = title ? `# ${title}\n\n${markdown}` : markdown

  headings.unshift({ level: 1, text: title })

  return {
    markdown: fullMarkdown,
    headings,
    pages: [{ pageNumber: 1, content: fullMarkdown }],
    tables,
    images: [],
    metadata: {
      source_file: fileName,
      parser: 'html-parser',
      title,
    },
    mimeType: 'text/html',
    parseVersion: PARSE_VERSION,
  }
}
