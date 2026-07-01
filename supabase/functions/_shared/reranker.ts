export interface RerankDocument {
  id: string
  content: string
  similarity?: number
  metadata?: Record<string, unknown>
}

export interface RerankResult {
  id: string
  content: string
  similarity: number
  rerank_score: number
  metadata?: Record<string, unknown>
}

export interface RerankerOptions {
  provider: string
  threshold: number
  maxResults: number
  query: string
}

export interface RerankerResponse {
  results: RerankResult[]
  latency_ms: number
  cost: number
}

async function rerankCohere(
  query: string,
  documents: RerankDocument[],
  maxResults: number
): Promise<{ index: number; relevance_score: number }[]> {
  const apiKey = Deno.env.get('COHERE_API_KEY')
  if (!apiKey) throw new Error('COHERE_API_KEY not configured')

  const res = await fetch('https://api.cohere.com/v1/rerank', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'rerank-english-v3.0',
      query,
      documents: documents.map((d) => d.content),
      top_n: maxResults,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Cohere rerank failed: ${err}`)
  }

  const data = await res.json()
  return (data.results ?? []).map((r: { index: number; relevance_score: number }) => ({
    index: r.index,
    relevance_score: r.relevance_score,
  }))
}

async function rerankVoyage(
  query: string,
  documents: RerankDocument[],
  maxResults: number
): Promise<{ index: number; relevance_score: number }[]> {
  const apiKey = Deno.env.get('VOYAGE_API_KEY')
  if (!apiKey) throw new Error('VOYAGE_API_KEY not configured')

  const res = await fetch('https://api.voyageai.com/v1/rerank', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'rerank-2',
      query,
      documents: documents.map((d) => d.content),
      top_k: maxResults,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Voyage rerank failed: ${err}`)
  }

  const data = await res.json()
  return (data.data ?? []).map((r: { index: number; relevance_score: number }) => ({
    index: r.index,
    relevance_score: r.relevance_score,
  }))
}

async function rerankBge(
  query: string,
  documents: RerankDocument[],
  maxResults: number
): Promise<{ index: number; relevance_score: number }[]> {
  const apiKey = Deno.env.get('HUGGINGFACE_API_KEY') ?? Deno.env.get('HF_API_KEY')
  const model = 'BAAI/bge-reranker-base'
  const url = apiKey
    ? `https://api-inference.huggingface.co/models/${model}`
    : `https://api-inference.huggingface.co/models/${model}`

  const scores: { index: number; relevance_score: number }[] = []
  for (let i = 0; i < documents.length; i++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: { source_sentence: query, sentences: [documents[i].content] } }),
    })
    if (res.ok) {
      const data = await res.json()
      const score = Array.isArray(data) ? data[0] : (typeof data === 'number' ? data : 0.5)
      scores.push({ index: i, relevance_score: Number(score) })
    }
  }

  return scores
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, maxResults)
}

async function rerankCustom(
  query: string,
  documents: RerankDocument[],
  maxResults: number
): Promise<{ index: number; relevance_score: number }[]> {
  const url = Deno.env.get('RERANKER_CUSTOM_URL')
  if (!url) throw new Error('RERANKER_CUSTOM_URL not configured')

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, documents: documents.map((d) => d.content), top_n: maxResults }),
  })

  if (!res.ok) throw new Error(`Custom reranker failed: ${await res.text()}`)

  const data = await res.json()
  return (data.results ?? data).map((r: { index: number; score?: number; relevance_score?: number }) => ({
    index: r.index,
    relevance_score: r.relevance_score ?? r.score ?? 0,
  }))
}

export async function rerankDocuments(
  documents: RerankDocument[],
  options: RerankerOptions
): Promise<RerankerResponse> {
  const start = Date.now()

  if (documents.length === 0) {
    return { results: [], latency_ms: 0, cost: 0 }
  }

  let ranked: { index: number; relevance_score: number }[]

  switch (options.provider) {
    case 'voyage':
      ranked = await rerankVoyage(options.query, documents, options.maxResults)
      break
    case 'bge':
      ranked = await rerankBge(options.query, documents, options.maxResults)
      break
    case 'custom':
      ranked = await rerankCustom(options.query, documents, options.maxResults)
      break
    case 'cohere':
    default:
      ranked = await rerankCohere(options.query, documents, options.maxResults)
  }

  const results: RerankResult[] = ranked
    .filter((r) => r.relevance_score >= options.threshold)
    .slice(0, options.maxResults)
    .map((r) => {
      const doc = documents[r.index]
      return {
        id: doc.id,
        content: doc.content,
        similarity: doc.similarity ?? 0,
        rerank_score: r.relevance_score,
        metadata: doc.metadata,
      }
    })

  const latency_ms = Date.now() - start
  const cost = options.provider === 'cohere' ? documents.length * 0.000002 : 0

  return { results, latency_ms, cost }
}
