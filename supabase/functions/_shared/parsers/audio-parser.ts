/**
 * Audio parser — transcribes audio files using OpenAI Whisper API.
 * Generates timestamped transcript with speaker-like segments.
 * Supports MP3, WAV, M4A, AAC, OGG.
 */

import type { ParsedDocument, Page, CitationRef } from './types.ts'
import { PARSE_VERSION } from './types.ts'

interface AudioParseOptions {
  openAiApiKey?: string
  mimeType: string
}

interface WhisperSegment {
  id: number
  start: number
  end: number
  text: string
}

interface WhisperVerboseResponse {
  text: string
  segments?: WhisperSegment[]
  language?: string
  duration?: number
}

function secondsToTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function mimeToExtension(mime: string, fileName: string): string {
  const extFromName = fileName.split('.').pop()?.toLowerCase()
  if (extFromName) return extFromName
  const map: Record<string, string> = {
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/m4a': 'm4a',
    'audio/mp4': 'm4a',
    'audio/aac': 'aac',
    'audio/ogg': 'ogg',
  }
  return map[mime] ?? 'mp3'
}

async function transcribeWithWhisper(
  audioBlob: Blob,
  fileName: string,
  mimeType: string,
  apiKey: string
): Promise<WhisperVerboseResponse> {
  const ext = mimeToExtension(mimeType, fileName)
  const formData = new FormData()
  formData.append('file', new File([audioBlob], `audio.${ext}`, { type: mimeType }))
  formData.append('model', 'whisper-1')
  formData.append('response_format', 'verbose_json')
  formData.append('timestamp_granularities[]', 'segment')

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: formData,
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Whisper API error ${response.status}: ${err}`)
  }

  return await response.json() as WhisperVerboseResponse
}

export async function parseAudio(
  fileBlob: Blob,
  fileName: string,
  options: AudioParseOptions
): Promise<ParsedDocument> {
  const pages: Page[] = []
  const citations: CitationRef[] = []
  const markdownLines: string[] = [`# Transcript: ${fileName}`]

  if (options.openAiApiKey) {
    const result = await transcribeWithWhisper(fileBlob, fileName, options.mimeType, options.openAiApiKey)

    if (result.segments && result.segments.length > 0) {
      // Group segments into logical pages (~60 seconds each)
      const pageSeconds = 60
      let currentPage: string[] = []
      let currentPageStart = 0
      let pageNum = 1

      for (const seg of result.segments) {
        const ts = secondsToTimestamp(seg.start)
        const segText = `[${ts}] ${seg.text.trim()}`
        markdownLines.push(segText)
        currentPage.push(segText)
        citations.push({ page: pageNum, section: `${secondsToTimestamp(seg.start)} - ${secondsToTimestamp(seg.end)}` })

        if (seg.end - currentPageStart >= pageSeconds) {
          pages.push({ pageNumber: pageNum++, content: currentPage.join('\n') })
          currentPage = []
          currentPageStart = seg.end
        }
      }

      if (currentPage.length > 0) {
        pages.push({ pageNumber: pageNum, content: currentPage.join('\n') })
      }
    } else {
      // No segments — use full transcript as single page
      markdownLines.push(result.text)
      pages.push({ pageNumber: 1, content: result.text })
    }

    return {
      markdown: markdownLines.join('\n\n'),
      headings: [{ level: 1, text: `Transcript: ${fileName}` }],
      pages,
      tables: [],
      images: [],
      citations,
      metadata: {
        source_file: fileName,
        parser: 'audio-parser',
        duration_seconds: result.duration,
        language: result.language,
        segment_count: result.segments?.length ?? 0,
        used_whisper: true,
      },
      mimeType: options.mimeType,
      parseVersion: PARSE_VERSION,
    }
  }

  // No API key — return placeholder
  const placeholder = `Audio file "${fileName}" — transcription requires OPENAI_API_KEY.`
  return {
    markdown: `# ${fileName}\n\n${placeholder}`,
    headings: [{ level: 1, text: fileName }],
    pages: [{ pageNumber: 1, content: placeholder }],
    tables: [],
    images: [],
    metadata: {
      source_file: fileName,
      parser: 'audio-parser',
      transcription_skipped: true,
    },
    mimeType: options.mimeType,
    parseVersion: PARSE_VERSION,
  }
}
