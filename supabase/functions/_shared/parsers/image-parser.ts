/**
 * Image parser — extracts text (OCR) and generates a description using OpenAI Vision API.
 * Supports PNG, JPG, JPEG, WebP.
 * Returns OCR text + AI description as a ParsedDocument.
 */

import type { ParsedDocument, DocumentImage } from './types.ts'
import { PARSE_VERSION } from './types.ts'

interface ImageParseOptions {
  openAiApiKey?: string
  skipAnalysis?: boolean
  mimeType: string
}

function mimeToBase64Header(mimeType: string): string {
  const safe = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType
  return `data:${safe};base64,`
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

async function analyzeWithOpenAiVision(
  imageBlob: Blob,
  mimeType: string,
  apiKey: string
): Promise<{ ocrText: string; description: string }> {
  const base64 = await blobToBase64(imageBlob)
  const dataUrl = mimeToBase64Header(mimeType) + base64

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Please do two things:\n1. Extract ALL text visible in this image (OCR). Output it as "TEXT: <extracted text>"\n2. Provide a brief description of what the image shows. Output it as "DESCRIPTION: <description>"\n\nIf there is no visible text, write "TEXT: [no text found]".',
            },
            {
              type: 'image_url',
              image_url: { url: dataUrl, detail: 'high' },
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI Vision API error ${response.status}: ${err}`)
  }

  const data = await response.json()
  const content: string = data.choices?.[0]?.message?.content ?? ''

  const textMatch = content.match(/TEXT:\s*([\s\S]*?)(?=DESCRIPTION:|$)/i)
  const descMatch = content.match(/DESCRIPTION:\s*([\s\S]*?)$/i)

  const ocrText = textMatch?.[1]?.replace('[no text found]', '').trim() ?? ''
  const description = descMatch?.[1]?.trim() ?? content

  return { ocrText, description }
}

export async function parseImage(
  fileBlob: Blob,
  fileName: string,
  options: ImageParseOptions
): Promise<ParsedDocument> {
  const images: DocumentImage[] = []
  let ocrText = ''
  let description = ''

  if (options.openAiApiKey && !options.skipAnalysis) {
    try {
      const result = await analyzeWithOpenAiVision(fileBlob, options.mimeType, options.openAiApiKey)
      ocrText = result.ocrText
      description = result.description
    } catch (err) {
      console.error('Vision API analysis failed:', err)
      description = `Image file: ${fileName}`
    }
  } else {
    description = `Image file: ${fileName}`
  }

  images.push({
    imageIndex: 0,
    caption: fileName,
    ocrText: ocrText || undefined,
    description: description || undefined,
    pageNumber: 1,
  })

  const markdownParts = [`# ${fileName}`]
  if (description) markdownParts.push(`**Description:** ${description}`)
  if (ocrText) markdownParts.push(`**Extracted Text:**\n\n${ocrText}`)
  const markdown = markdownParts.join('\n\n')

  return {
    markdown,
    headings: [{ level: 1, text: fileName }],
    pages: [{ pageNumber: 1, content: markdown }],
    tables: [],
    images,
    metadata: {
      source_file: fileName,
      parser: 'image-parser',
      has_ocr_text: Boolean(ocrText),
      used_vision_api: Boolean(options.openAiApiKey && !options.skipAnalysis),
    },
    mimeType: options.mimeType,
    parseVersion: PARSE_VERSION,
  }
}
