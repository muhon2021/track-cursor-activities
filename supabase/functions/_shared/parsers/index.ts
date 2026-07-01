/**
 * Parser router — entry point for the document parsing pipeline.
 * Detects file type then dispatches to the appropriate format-specific parser.
 */

import type { ParsedDocument, DetectedMimeType } from './types.ts'
import { detectMimeType, mimeToCategory } from './file-type-detector.ts'
import { parsePdf } from './pdf-parser.ts'
import { parseOffice } from './office-parser.ts'
import { parseSpreadsheet } from './spreadsheet-parser.ts'
import { parseHtml } from './html-parser.ts'
import { parseText } from './text-parser.ts'
import { parseImage } from './image-parser.ts'
import { parseAudio } from './audio-parser.ts'
import { parseEmail } from './email-parser.ts'
import { PARSE_VERSION } from './types.ts'

export interface ParseOptions {
  /** Override detected MIME type */
  mimeOverride?: string
  /** Skip image OCR / vision analysis (faster, no API cost) */
  skipImageAnalysis?: boolean
  /** OpenAI API key for image/audio parsers */
  openAiApiKey?: string
  /** Unstructured.io API key for PDF/Office parsers */
  unstructuredApiKey?: string
}

/**
 * Parse a document blob into a normalized ParsedDocument.
 * Throws on unsupported formats or unrecoverable parse errors.
 */
export async function parseDocument(
  fileBlob: Blob,
  fileName: string,
  options: ParseOptions = {}
): Promise<ParsedDocument> {
  const detectedMime = await detectMimeType(fileBlob, fileName, options.mimeOverride)
  const category = mimeToCategory(detectedMime)

  if (category === 'unsupported') {
    throw new Error(`Unsupported file type for "${fileName}" (detected: ${detectedMime})`)
  }

  switch (category) {
    case 'pdf':
      return await parsePdf(fileBlob, fileName, {
        unstructuredApiKey: options.unstructuredApiKey,
        mimeType: detectedMime as string,
      })

    case 'office':
      return await parseOffice(fileBlob, fileName, {
        unstructuredApiKey: options.unstructuredApiKey,
        mimeType: detectedMime as string,
      })

    case 'spreadsheet':
      return await parseSpreadsheet(fileBlob, fileName, {
        mimeType: detectedMime as string,
      })

    case 'html':
      return await parseHtml(fileBlob, fileName)

    case 'text':
      return await parseText(fileBlob, fileName, {
        mimeType: detectedMime as string,
      })

    case 'image':
      return await parseImage(fileBlob, fileName, {
        openAiApiKey: options.openAiApiKey,
        skipAnalysis: options.skipImageAnalysis,
        mimeType: detectedMime as string,
      })

    case 'audio':
      return await parseAudio(fileBlob, fileName, {
        openAiApiKey: options.openAiApiKey,
        mimeType: detectedMime as string,
      })

    case 'email':
      return await parseEmail(fileBlob, fileName)

    default:
      throw new Error(`No parser available for category "${category}"`)
  }
}

export type { ParsedDocument, DetectedMimeType }
export { PARSE_VERSION }
