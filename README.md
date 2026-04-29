# MedRAG — Evidence-Based Medical Intelligence

---

## Your Machine Requirements

| Component | Minimum | Notes |
|-----------|---------|-------|
| RAM | 4 GB | Embeddings + BM25 + FAISS run locally |
| VRAM | 0 | OpenBioLLM-70B runs on HF/Groq servers |
| Disk | 2 GB | Model cache for embeddings (~500 MB) |
| Internet | Broadband | API calls to HF / Groq |

---

## Architecture

```
Doctor's Query
      │
      ▼
┌───────────────────────────────────────────────────┐
│         FastAPI Backend  (your  machine)       │
│                                                   │
│  PubMed Ingester ──► BM25 + FAISS (CPU-only)     │
│                           │                       │
│                    CrossEncoder Reranker (CPU)    │
│                           │                       │
│                    ┌──────▼──────────────────┐   │
│                    │  HTTP API call (remote)  │   │
│                    └──────┬──────────────────-┘   │
└───────────────────────────┼───────────────────────┘
                            │
                            |
                            │
    ┌         ┌─────────────▼──────────┐
              │       Groq API          │
              │  llama-3.3-70b        │
              │  (free, fast fallback)  │
              └────────────────────────-┘
```

---

## Free API Keys — Get Them First



### 1. Groq API Key (Fallback — ultra-fast)

```
1. Sign up: https://console.groq.com
2. Keys → Create API key → Copy it
3. Paste into backend/.env as GROQ_API_KEY=gsk_xxx...
```

Free tier limits: 500 requests/day · 6000 tokens/min · ~1-2 sec response

**Recommendation:** Set `LLM_BACKEND=groq` in .env — Groq responds in ~1s vs HF's ~10-30s.

---

## Quick Start

### 1. Clone

```bash
git clone https://github.com/yourorg/medrag
cd medrag
```

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt   # Lightweight — no torch/transformers

cp .env.example .env
# Edit .env:
#   
#   GROQ_API_KEY=gsk_your_key_here
#   ENTREZ_EMAIL=your@email.com
#   LLM_BACKEND=groq              ← fastest option
```

### 3. Seed PubMed index (one-time, ~10 min)

```bash
cd ..  # project root
python scripts/seed_index.py
# Downloads ~420 MB embedding model, fetches PubMed articles
```

### 4. Start backend

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
python -m uvicorn main:app --reload
```

### 5. Start frontend

```bash
cd frontend
npm install
npm run dev
```

Open: **http://localhost:3000**

---

## Configuration Reference

| Variable | Default | Description |
|----------|---------|-------------|

| `GROQ_API_KEY` | _(recommended)_ | Groq API key |
| `GROQ_MODEL` | `llama-3.3-70b ` | Groq model name |
| `GROQ_TIMEOUT` | `60` | Seconds before Groq timeout |
| `LLM_BACKEND` |  Primary:  `groq` |
| `LLM_MAX_RETRIES` | `3` | Retries per API call |
| `ENTREZ_EMAIL` | _(required)_ | Email for PubMed API |
| `EMBED_MODEL` | `pritamdeka/S-PubMedBert-MS-MARCO` | Local embedding model |
| `RERANK_MODEL` | `cross-encoder/ms-marco-MiniLM-L-6-v2` | Local reranker |
| `DATA_DIR` | `./data` | FAISS index + docs |

---

## API Comparison

| | HuggingFace Inference API | Groq API |
|-|--------------------------|----------|
| Model  | Llama-3-70B (general) |
| Speed | 10–60s | 1–3s |
| Free tier | 1000 req/day | 500 req/day |
| Latency | High (cold start) | Very low |
| Best for | Highest biomedical accuracy | Speed + fallback |

**Tip:** Run with `LLM_BACKEND=groq` for day-to-day use. HF auto-activates as fallback.

---

## Project Structure

```
medrag/
├── backend/
│   ├── main.py                    # FastAPI app
│   ├── requirements.txt           # Lightweight — no GPU deps
│   ├── .env.example               # HF_TOKEN, GROQ_API_KEY, etc.
│   ├── core/
│   │   ├── pipeline.py            # RAG orchestrator
│   │   └── cache.py               # LRU cache (TTL)
│   ├── ingestion/
│   │   └── pubmed.py              # BioPython → PubMed
│   ├── retrieval/
│   │   ├── hybrid.py              # BM25 + FAISS + RRF (CPU)
│   │   └── reranker.py            # CrossEncoder (CPU)
│   ├── generation/
│   │   ├── llm.py                 # HF Inference API + Groq API
│   │   └── verifier.py            # Citation + grounding check
│   └── utils/logger.py
├── frontend/src/                  # React UI
├── scripts/seed_index.py          # Seed PubMed articles
└── docker/docker-compose.yml
```

---

## Docker

```bash
cp backend/.env.example .env   # fill in tokens
cd docker
docker compose up -d
docker exec -it medrag-backend-1 python /scripts/seed_index.py
```

---

## "No Answer Found" Guarantee

Returns `"No answer found"` when:
1. FAISS + BM25 find no relevant documents
2. Docs score below `min_score` threshold
3. LLM itself outputs `"No answer found"`
4. Verifier detects missing citations or < 40% context overlap

---




