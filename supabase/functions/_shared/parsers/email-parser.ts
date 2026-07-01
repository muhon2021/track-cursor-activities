/**
 * Email parser — extracts headers and body from EML/MSG files.
 * Preserves sender, recipients, subject, date, and thread context.
 * Plain-text and simple HTML body extraction.
 */

import type { ParsedDocument } from './types.ts'
import { PARSE_VERSION } from './types.ts'

interface EmailHeaders {
  subject?: string
  from?: string
  to?: string
  cc?: string
  date?: string
  messageId?: string
  inReplyTo?: string
  references?: string
}

function parseHeaders(rawHeaders: string): EmailHeaders {
  const headers: EmailHeaders = {}
  const lines = rawHeaders.split('\n')

  let currentKey = ''
  let currentValue = ''

  for (const line of lines) {
    // Folded header (continuation line starts with whitespace)
    if (line.match(/^[ \t]/) && currentKey) {
      currentValue += ' ' + line.trim()
      continue
    }

    // Save previous header
    if (currentKey) {
      const key = currentKey.toLowerCase()
      if (key === 'subject') headers.subject = decodeEmailWord(currentValue.trim())
      else if (key === 'from') headers.from = currentValue.trim()
      else if (key === 'to') headers.to = currentValue.trim()
      else if (key === 'cc') headers.cc = currentValue.trim()
      else if (key === 'date') headers.date = currentValue.trim()
      else if (key === 'message-id') headers.messageId = currentValue.trim()
      else if (key === 'in-reply-to') headers.inReplyTo = currentValue.trim()
      else if (key === 'references') headers.references = currentValue.trim()
    }

    // Parse new header
    const colonIdx = line.indexOf(':')
    if (colonIdx > 0) {
      currentKey = line.slice(0, colonIdx).trim()
      currentValue = line.slice(colonIdx + 1).trim()
    } else if (line.trim() === '') {
      break // End of headers
    }
  }

  return headers
}

function decodeEmailWord(encoded: string): string {
  // Handle RFC 2047 encoded words: =?charset?encoding?text?=
  return encoded.replace(/=\?([^?]+)\?([bBqQ])\?([^?]+)\?=/g, (_, charset, encoding, text) => {
    try {
      if (encoding.toUpperCase() === 'B') {
        return atob(text)
      } else {
        return decodeURIComponent(text.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, '%$1'))
      }
    } catch {
      return text
    }
  })
}

function extractBody(raw: string): string {
  // Find the blank line separating headers from body
  const headerBodySplit = raw.indexOf('\n\n')
  if (headerBodySplit === -1) return raw

  let body = raw.slice(headerBodySplit + 2)

  // Handle multipart — find first text/plain or text/html part
  const boundaryMatch = raw.match(/boundary="?([^"\r\n]+)"?/i)
  if (boundaryMatch) {
    const boundary = '--' + boundaryMatch[1]
    const parts = body.split(new RegExp(boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))

    for (const part of parts) {
      if (part.toLowerCase().includes('content-type: text/plain')) {
        const partBody = part.slice(part.indexOf('\n\n') + 2)
        body = partBody.trim()
        break
      }
    }

    // Fall back to html part
    if (!body || body.startsWith('--')) {
      for (const part of parts) {
        if (part.toLowerCase().includes('content-type: text/html')) {
          const partBody = part.slice(part.indexOf('\n\n') + 2)
          body = partBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
          break
        }
      }
    }
  }

  // Strip remaining HTML tags if any slipped through
  body = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

  // Decode quoted-printable
  body = body.replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
  body = body.replace(/=\r?\n/g, '')

  return body
}

export async function parseEmail(fileBlob: Blob, fileName: string): Promise<ParsedDocument> {
  const raw = await fileBlob.text()

  const headerBodySplit = raw.indexOf('\n\n')
  const rawHeaders = headerBodySplit > -1 ? raw.slice(0, headerBodySplit) : raw
  const headers = parseHeaders(rawHeaders)
  const body = extractBody(raw)

  const subject = headers.subject || fileName
  const from = headers.from || 'Unknown'
  const to = headers.to || ''
  const date = headers.date || ''

  const markdownLines = [
    `# ${subject}`,
    '',
    `**From:** ${from}`,
    to ? `**To:** ${to}` : '',
    headers.cc ? `**CC:** ${headers.cc}` : '',
    date ? `**Date:** ${date}` : '',
    headers.inReplyTo ? `**In Reply To:** ${headers.inReplyTo}` : '',
    '',
    '---',
    '',
    body,
  ].filter((l) => l !== undefined)

  const markdown = markdownLines.join('\n')

  return {
    markdown,
    headings: [{ level: 1, text: subject }],
    pages: [{ pageNumber: 1, content: markdown }],
    tables: [],
    images: [],
    metadata: {
      source_file: fileName,
      parser: 'email-parser',
      subject: headers.subject,
      from: headers.from,
      to: headers.to,
      cc: headers.cc,
      date: headers.date,
      message_id: headers.messageId,
      in_reply_to: headers.inReplyTo,
      has_thread: Boolean(headers.inReplyTo || headers.references),
    },
    mimeType: 'message/rfc822',
    parseVersion: PARSE_VERSION,
  }
}
