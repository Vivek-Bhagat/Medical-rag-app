const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

/**
 * Normalize whatever the backend returns into a consistent shape:
 * {
 *   answer: string,
 *   sources: Array<{
 *     id:       number,
 *     title:    string,
 *     url:      string|null,
 *     score:    number|null,   // 0–1 relevance/accuracy score
 *     authors:  string|null,
 *     journal:  string|null,
 *     year:     string|null,
 *     pmid:     string|null,
 *     abstract: string|null,
 *   }>
 * }
 *
 * The backend may return any of:
 *  - { answer, sources: [{title, url, score, ...}] }          ← primary shape
 *  - { answer, citations: [{title, url, relevance_score, ...}] }
 *  - { response, references: [{...}] }
 *  - { answer, context: [{...}] }
 */
export async function queryMedRAG(query, signal) {
  const res = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal,
  })

  if (!res.ok) {
    const err = await res.text().catch(() => 'Unknown error')
    throw new Error(`Server error ${res.status}: ${err}`)
  }

  const raw = await res.json()
  return normalizeResponse(raw)
}

function normalizeResponse(raw) {
  const answer =
    raw.answer    ??
    raw.response  ??
    raw.result    ??
    raw.text      ??
    ''

  // Find the sources array — try every common key
  const rawSources =
    raw.sources    ??
    raw.citations  ??
    raw.references ??
    raw.context    ??
    raw.results    ??
    []

  const sources = rawSources.map((s, i) => ({
    id:       i + 1,
    title:    s.title     ?? s.name      ?? s.heading  ?? `Source ${i + 1}`,
    url:      s.url       ?? s.link      ?? s.href     ?? buildPubmedUrl(s),
    // score: backend may call it score, relevance_score, similarity, confidence, rank_score
    score:    parseScore(
                s.score           ??
                s.relevance_score ??
                s.similarity      ??
                s.confidence      ??
                s.rank_score      ??
                s.relevance       ??
                null
              ),
    authors:  s.authors   ?? s.author    ?? null,
    journal:  s.journal   ?? s.source    ?? s.venue    ?? null,
    year:     s.year      ?? s.date      ?? s.published ?? null,
    pmid:     s.pmid      ?? s.pubmed_id ?? null,
    abstract: s.abstract  ?? s.snippet   ?? s.text     ?? null,
  }))

  return { answer, sources }
}

function buildPubmedUrl(s) {
  if (s.pmid || s.pubmed_id) {
    return `https://pubmed.ncbi.nlm.nih.gov/${s.pmid ?? s.pubmed_id}/`
  }
  return null
}

function parseScore(val) {
  if (val === null || val === undefined) return null
  const n = parseFloat(val)
  if (isNaN(n)) return null
  // If score is 0–100, normalise to 0–1
  return n > 1 ? n / 100 : n
}

export async function healthCheck() {
  try {
    const res = await fetch(`${API_BASE}/health`)
    return res.ok
  } catch {
    return false
  }
}
