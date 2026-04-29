# MedRAG — Evidence-Based Medical Query Answering System

MedRAG is a full-stack Retrieval-Augmented Generation (RAG) application designed to answer clinical medical questions using real PubMed research articles as its knowledge base. It combines local CPU-based retrieval (BM25 + FAISS) with a remote LLM (Groq's Llama 3 70B) to produce evidence-grounded, citation-backed answers — and refuses to answer when the evidence is insufficient.

---

## Table of Contents

- [System Architecture](#system-architecture)
- [Design & Approach](#design--approach)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup & Installation](#setup--installation)
- [Configuration Reference](#configuration-reference)
- [API Reference](#api-reference)
- [Docker Deployment](#docker-deployment)
- [How It Works — RAG Pipeline Deep Dive](#how-it-works--rag-pipeline-deep-dive)
- [Hallucination Prevention](#hallucination-prevention)
- [Troubleshooting](#troubleshooting)

---

## System Architecture

```
User Query (via React UI)
        │
        ▼
┌──────────────────────────────────────────────────────────────┐
│                   FastAPI Backend  (local machine)            │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                  MedRAGPipeline                         │  │
│  │                                                         │  │
│  │  1. HybridRetriever                                     │  │
│  │     ├── FAISS (dense vector search, S-PubMedBert)       │  │
│  │     ├── BM25Okapi (sparse keyword search)               │  │
│  │     └── Reciprocal Rank Fusion (RRF) merge              │  │
│  │                  │                                      │  │
│  │  2. CrossEncoderReranker                                 │  │
│  │     └── ms-marco-MiniLM-L-6-v2 (CPU)                    │  │
│  │                  │                                      │  │
│  │  3. LocalLLM (remote API call)                           │  │
│  │     └── Groq API → llama-3.3-70b-versatile              │  │
│  │                  │                                      │  │
│  │  4. AnswerVerifier                                       │  │
│  │     └── Second LLM pass — citation + grounding check    │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  QueryCache (LRU, 500 entries, 1hr TTL)                       │
│  PubMedIngester (BioPython Entrez)                            │
└──────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────┐
│       Groq Cloud      │
│  llama-3.3-70b        │
│  (free tier: 500/day) │
└──────────────────────┘
        │
        ▼
React Frontend (Vite + CSS Modules)
```

---

## Design & Approach

### Core Philosophy: Grounded Answers Only

MedRAG is built around a single principle: **never hallucinate**. Every claim in the output must be traceable to a retrieved PubMed document. If the retrieved documents don't support a clear answer, the system explicitly returns `"No answer found"` rather than guessing.

### Why Hybrid Retrieval?

Neither pure keyword search nor pure semantic search is sufficient for medical queries:

- **BM25 (sparse)** excels at exact medical terminology (drug names, gene symbols, ICD codes) but misses semantically similar concepts.
- **FAISS (dense)** captures semantic meaning ("heart attack" ↔ "myocardial infarction") but can miss rare exact matches.
- **Reciprocal Rank Fusion** combines both result lists without needing score normalization, giving each document credit from both retrieval paths.

### Two-Pass LLM Architecture

The system uses Groq's API twice per query:

1. **Generation pass** — Produces a cited answer grounded in the context documents.
2. **Verification pass** — A second LLM call acts as a fact-checker, confirming that every claim is supported by the retrieved context and that inline citations (`[1]`, `[2]`, etc.) are present.

This self-verification layer is what makes MedRAG suitable for clinical decision support — it catches hallucinations that a single-pass system would miss.

### No Local GPU Required

All computationally heavy work (LLM inference) runs remotely on Groq's infrastructure. Your machine only runs:
- The embedding model (`S-PubMedBert-MS-MARCO`, ~420 MB) for query encoding
- The cross-encoder reranker (`ms-marco-MiniLM-L-6-v2`, ~90 MB) for relevance scoring
- FAISS CPU index and BM25 in-memory

---

## Tech Stack

### Backend

| Component | Technology | Purpose |
|-----------|------------|---------|
| Web framework | FastAPI 0.115 + Uvicorn | Async REST API |
| Embedding model | `pritamdeka/S-PubMedBert-MS-MARCO` | Biomedical dense retrieval |
| Vector index | FAISS (CPU, IndexFlatIP) | Approximate nearest neighbour search |
| Sparse retrieval | BM25Okapi (rank-bm25) | Keyword search |
| Reranker | `cross-encoder/ms-marco-MiniLM-L-6-v2` | Relevance re-scoring |
| LLM | Groq API → `llama-3.3-70b-versatile` | Answer generation & verification |
| PubMed ingestion | BioPython Entrez | Fetch real research abstracts |
| Data storage | JSONL (documents) + pickle (BM25) + `.index` (FAISS) | Persisted on disk |
| Cache | In-memory LRU (TTL=3600s, size=500) | Response deduplication |
| Python version | 3.11 | Required |

### Frontend

| Component | Technology |
|-----------|------------|
| Framework | React 18 + Vite |
| Styling | CSS Modules + global CSS |
| HTTP client | Native fetch |
| Build tool | Vite + @vitejs/plugin-react |
| Containerisation | Nginx (production Docker) |

There are two frontend implementations in the repo:
- `frontend/` — Original component-based UI (QueryInput, AnswerPanel, SourceList, StatusBar, IngestPanel)
- `medrag-frontend/` — Newer chat-style UI (Sidebar, Message, Citations, ChatInput, Welcome)

---

## Project Structure

```
medrag/
├── backend/
│   ├── main.py                    # FastAPI app entry point, routes, schemas
│   ├── requirements.txt           # Python dependencies (no GPU/torch required)
│   ├── Dockerfile                 # Python 3.11-slim image
│   ├── .env.example               # All configuration variables with docs
│   ├── .env                       # Your local secrets (gitignored)
│   │
│   ├── core/
│   │   ├── pipeline.py            # MedRAGPipeline — orchestrates all 4 stages
│   │   └── cache.py               # LRU cache with TTL
│   │
│   ├── ingestion/
│   │   └── pubmed.py              # PubMedIngester — BioPython Entrez wrapper
│   │
│   ├── retrieval/
│   │   ├── hybrid.py              # HybridRetriever — FAISS + BM25 + RRF
│   │   └── reranker.py            # CrossEncoderReranker
│   │
│   ├── generation/
│   │   ├── llm.py                 # LocalLLM — Groq API client (Groq-only mode)
│   │   └── verifier.py            # AnswerVerifier — citation + grounding check
│   │
│   ├── utils/
│   │   └── logger.py              # Structured logging setup
│   │
│   └── data/                      # Persisted index (auto-created)
│       ├── faiss.index            # FAISS vector index
│       ├── documents.jsonl        # Document store (one JSON per line)
│       └── bm25.pkl               # Serialized BM25 index
│
├── frontend/                      # Original React UI (component-based)
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── QueryInput.jsx     # Medical query input
│   │   │   ├── AnswerPanel.jsx    # Displays LLM answer
│   │   │   ├── SourceList.jsx     # PubMed source citations
│   │   │   ├── StatusBar.jsx      # System status (index size, model loaded)
│   │   │   └── IngestPanel.jsx    # Trigger PubMed ingestion
│   │   ├── hooks/
│   │   │   └── useSystemStatus.js
│   │   └── styles/global.css
│   ├── Dockerfile
│   └── nginx.conf
│
├── medrag-frontend/               # Newer chat-style React UI
│   └── src/
│       ├── App.jsx
│       ├── components/
│       │   ├── ChatInput.jsx
│       │   ├── Message.jsx
│       │   ├── Citations.jsx
│       │   ├── Sidebar.jsx
│       │   └── Welcome.jsx
│       ├── hooks/useChat.js
│       └── utils/api.js
│
├── scripts/
│   └── seed_index.py              # One-time PubMed seeding script
│
└── docker/
    └── docker-compose.yml         # Full-stack Docker Compose setup
```

---

## Prerequisites

### Required

- **Python 3.11** — earlier versions are not supported
- **Node.js 18+** — for the frontend
- **Groq API key** (free) — https://console.groq.com/keys
- **NCBI Entrez email** — any valid email; required by PubMed's API policy

### System Resources

| Component | Minimum |
|-----------|---------|
| RAM | 4 GB (embeddings + FAISS + BM25 run locally) |
| VRAM | 0 — LLM runs remotely on Groq |
| Disk | ~2 GB (embedding model cache ~420 MB + document index) |
| Internet | Required (Groq API calls + PubMed ingestion) |

---

## Setup & Installation

### Step 1 — Clone the repository

```bash
git clone https://github.com/yourorg/medrag
cd medrag
```

### Step 2 — Backend setup

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# Install dependencies (~200 MB, no torch/GPU required)
pip install -r requirements.txt
```

### Step 3 — Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in at minimum:

```env
GROQ_API_KEY=gsk_your_key_here        # Required — get from console.groq.com
ENTREZ_EMAIL=your@email.com           # Required — for PubMed API
```

All other values have sensible defaults (see [Configuration Reference](#configuration-reference)).

### Step 4 — Seed the PubMed index (one-time, ~10 minutes)

This step downloads the embedding model and fetches an initial set of PubMed abstracts covering common medical topics:

```bash
cd ..   # project root
python scripts/seed_index.py
```

The script fetches articles on topics like diabetes, hypertension, cancer, antibiotics, COVID-19, and more. When complete, `backend/data/` will contain the FAISS index, BM25 pickle, and JSONL document store.

You can also seed additional topics later via the `/ingest` API endpoint.

### Step 5 — Start the backend

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

On first startup, the embedding model (~420 MB) and cross-encoder (~90 MB) will be downloaded from HuggingFace. Subsequent starts are fast.

Verify it's running:

```bash
curl http://localhost:8000/health
# → {"status": "ok", "service": "MedRAG API"}

curl http://localhost:8000/status
# → {"status": "ready", "index_size": 420, "model_loaded": true, "version": "1.0.0"}
```

### Step 6 — Start the frontend

```bash
# Original component UI:
cd frontend
npm install
npm run dev
# → http://localhost:5173

# OR the newer chat-style UI:
cd medrag-frontend
npm install
npm run dev
# → http://localhost:5173
```

---

## Configuration Reference

All variables live in `backend/.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `GROQ_API_KEY` | _(required)_ | API key from console.groq.com |
| `GROQ_MODEL` | `llama3-70b-8192` | Groq model identifier |
| `GROQ_TIMEOUT` | `60` | Seconds before request timeout |
| `LLM_BACKEND` | `groq` | Must be `groq` (HF disabled in code) |
| `LLM_MAX_RETRIES` | `3` | Retry attempts per API call |
| `ENTREZ_EMAIL` | _(required)_ | Email for NCBI Entrez API |
| `EMBED_MODEL` | `pritamdeka/S-PubMedBert-MS-MARCO` | HuggingFace embedding model |
| `RERANK_MODEL` | `cross-encoder/ms-marco-MiniLM-L-6-v2` | HuggingFace cross-encoder |
| `DATA_DIR` | `./data` | Directory for FAISS index + documents |
| `HOST` | `0.0.0.0` | Uvicorn bind host |
| `PORT` | `8000` | Uvicorn port |

> **Groq free tier limits:** 500 requests/day · 6,000 tokens/minute · ~1–2s response time

---

## API Reference

### `GET /health`

Health check endpoint. Returns `200 OK` when the service is running.

```json
{"status": "ok", "service": "MedRAG API"}
```

### `GET /status`

Returns the current state of the pipeline.

```json
{
  "status": "ready",
  "index_size": 420,
  "model_loaded": true,
  "version": "1.0.0"
}
```

### `POST /query`

Submit a medical question and receive a cited answer.

**Request body:**

```json
{
  "query": "What are the first-line treatments for type 2 diabetes?",
  "max_results": 5,
  "min_score": 0.0
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `query` | string | required | Medical question (5–1000 chars) |
| `max_results` | integer | 5 | Number of sources to retrieve (1–20) |
| `min_score` | float | 0.0 | Minimum reranker score threshold (0.0–1.0) |

**Response:**

```json
{
  "answer": "Metformin is the recommended first-line pharmacotherapy for type 2 diabetes [1][2]...",
  "sources": [
    {
      "title": "Metformin in type 2 diabetes: a systematic review",
      "abstract": "Background: Metformin reduces...",
      "url": "https://pubmed.ncbi.nlm.nih.gov/12345678/",
      "pmid": "12345678",
      "score": 0.8712,
      "rank": 1
    }
  ],
  "confidence": 0.785,
  "query_time_ms": 1423.5,
  "cached": false,
  "verified": true
}
```

If the system cannot ground an answer: `"answer": "No answer found"`, `"verified": false`, `"confidence": 0.0`.

### `POST /ingest`

Trigger background PubMed ingestion for new search queries.

**Request body:**

```json
{
  "queries": ["rheumatoid arthritis treatment", "CRISPR gene editing"],
  "max_per_query": 50
}
```

Returns immediately; ingestion runs as a background task.

```json
{"status": "ingestion_started", "queries": 2}
```

### `DELETE /cache`

Clear the query response cache.

```json
{"status": "cache_cleared"}
```

---

## Docker Deployment

A `docker-compose.yml` is provided in the `docker/` directory. Note: the compose file references an Ollama service (local LLM), but the current codebase uses Groq-only mode — update the environment variables accordingly.

### Steps

```bash
# 1. Copy and fill in your credentials
cp backend/.env.example .env

# 2. Build and start all services
cd docker
docker compose up -d

# 3. Seed the index (first time only)
docker exec -it medrag-backend-1 python /app/../scripts/seed_index.py

# 4. Access the app
#    Frontend: http://localhost:3000
#    Backend API: http://localhost:8000
#    API docs: http://localhost:8000/docs
```

### Service ports

| Service | Port | Description |
|---------|------|-------------|
| Frontend (Nginx) | 3000 | React UI |
| Backend (Uvicorn) | 8000 | FastAPI REST API |

---

## How It Works — RAG Pipeline Deep Dive

When a query arrives at `POST /query`, the `MedRAGPipeline` executes four sequential stages:

### Stage 1 — Hybrid Retrieval (`HybridRetriever`)

The query is searched against the document store using two independent retrieval methods run in parallel:

**Dense retrieval (FAISS):** The query is encoded using `S-PubMedBert-MS-MARCO`, a biomedical sentence transformer fine-tuned for PubMed relevance ranking. The resulting 768-dimensional embedding is searched against the FAISS `IndexFlatIP` (inner product / cosine similarity) to return the top-K most semantically similar documents.

**Sparse retrieval (BM25):** The query is tokenised and scored against the BM25Okapi index, which measures keyword term frequency weighted by inverse document frequency across the corpus.

Both result lists are merged using **Reciprocal Rank Fusion**:

```
RRF_score(doc) = Σ 1 / (k + rank_in_list)
```

where `k = 60` (standard RRF constant). This produces a single ranked list without requiring score normalisation between the two retrieval systems.

### Stage 2 — Cross-Encoder Reranking (`CrossEncoderReranker`)

The top `max_results × 3` candidates from Stage 1 are re-scored by a cross-encoder model (`ms-marco-MiniLM-L-6-v2`). Unlike bi-encoders (which encode query and document separately), the cross-encoder sees the full query–document pair together, allowing it to model fine-grained relevance interactions. The top `max_results` documents by reranker score are kept.

### Stage 3 — Answer Generation (`LocalLLM`)

The top-ranked documents are formatted into a numbered context block:

```
[1] Title: ...
    Abstract: ...
    PMID: ...

[2] Title: ...
...
```

This context plus the original query is sent to the Groq API with a strict system prompt that instructs the model to:
- Answer only from the provided context
- Cite every claim inline as `[1]`, `[2]`, etc.
- Return exactly `"No answer found"` if context is insufficient
- Never speculate beyond the documents

Confidence is estimated heuristically based on citation density, answer length, and absence of uncertainty markers.

### Stage 4 — Answer Verification (`AnswerVerifier`)

A second Groq API call reviews the generated answer against the context and returns structured JSON:

```json
{
  "valid": true,
  "reason": "All claims supported by context with proper citations",
  "unsupported_claims": []
}
```

If `valid` is `false` or the LLM verification call fails, a heuristic fallback checks: (a) citations are present, and (b) at least 40% of meaningful answer words appear in the context. Answers failing verification are replaced with `"No answer found"`.

---

## Hallucination Prevention

MedRAG employs five layers of hallucination prevention:

1. **Context-only prompting** — The system prompt explicitly forbids the model from using prior knowledge.
2. **Mandatory inline citations** — Answers without `[1]`, `[2]` markers are rejected at the pre-check stage.
3. **LLM-as-verifier** — A dedicated second LLM pass cross-checks every claim against the source documents.
4. **Lexical overlap check** — Fallback heuristic ensures the answer vocabulary overlaps ≥40% with the context.
5. **Minimum score threshold** — Documents below `min_score` are excluded before generation.

When any of these checks fail, the system returns `"No answer found"` with `"verified": false`.

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `"No answer found"` on every query | Index is empty | Run `seed_index.py` first; check `/status` for `index_size > 0` |
| `RuntimeError: No API keys configured` | Missing `GROQ_API_KEY` in `.env` | Add `GROQ_API_KEY=gsk_...` to `backend/.env` |
| `HTTP 429` from Groq | Rate limit hit (500 req/day free tier) | Wait or upgrade Groq plan |
| Slow first startup (2–5 min) | Downloading embedding models from HuggingFace | Normal; subsequent starts are fast |
| FAISS index not loading | Corrupted or missing `data/faiss.index` | Delete `backend/data/` and re-run `seed_index.py` |
| Frontend can't reach backend | CORS or wrong API URL | Ensure backend is on `http://localhost:8000`; check `frontend/.env` for `VITE_API_URL` |
| `"verified": false` on valid answers | Context overlap < 40% | Use a more specific query, or lower `min_score` |

### Checking index size

```bash
curl http://localhost:8000/status | python -m json.tool
```

### Re-seeding for a specific topic

```bash
curl -X POST http://localhost:8000/ingest \
  -H "Content-Type: application/json" \
  -d '{"queries": ["BRCA1 breast cancer treatment"], "max_per_query": 100}'
```

---

## License

This project is open source. See the repository root for license details.