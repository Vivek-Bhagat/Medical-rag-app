# MedRAG — Evidence-Based Medical Intelligence

Production-ready RAG system for doctors.  
**LLM: [aaditya/Llama3-OpenBioLLM-70B](https://huggingface.co/aaditya/Llama3-OpenBioLLM-70B)** via HuggingFace Inference API.  
The 70B model runs **entirely on remote servers** — your machine needs only 16 GB RAM and no GPU.

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
│         FastAPI Backend  (your 16GB machine)       │
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
           ┌────────────────┴────────────────┐
           │                                 │
    ┌──────▼──────────────┐    ┌─────────────▼──────────┐
    │  HuggingFace API    │    │       Groq API          │
    │  OpenBioLLM-70B     │    │  llama3-70b-8192        │
    │  (free tier)        │    │  (free, fast fallback)  │
    └─────────────────────┘    └────────────────────────-┘
```

---

## Free API Keys — Get Them First

### 1. HuggingFace Token (Primary — OpenBioLLM-70B)

```
1. Sign up: https://huggingface.co/join
2. Accept model licence: https://huggingface.co/aaditya/Llama3-OpenBioLLM-70B
   (click "Agree and access repository")
3. Create token: https://huggingface.co/settings/tokens
   → New token → Role: Read → Copy it
4. Paste into backend/.env as HF_TOKEN=hf_xxx...
```

Free tier limits: 1000 requests/day · unlimited on Serverless Inference

### 2. Groq API Key (Fallback — ultra-fast)

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
#   HF_TOKEN=hf_your_token_here
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
| `HF_TOKEN` | _(required)_ | HuggingFace access token |
| `HF_MODEL` | `aaditya/Llama3-OpenBioLLM-70B` | HF model ID |
| `HF_TIMEOUT` | `120` | Seconds before HF request timeout |
| `GROQ_API_KEY` | _(recommended)_ | Groq API key |
| `GROQ_MODEL` | `llama3-70b-8192` | Groq model name |
| `GROQ_TIMEOUT` | `60` | Seconds before Groq timeout |
| `LLM_BACKEND` | `huggingface` | Primary: `huggingface` or `groq` |
| `LLM_MAX_RETRIES` | `3` | Retries per API call |
| `ENTREZ_EMAIL` | _(required)_ | Email for PubMed API |
| `EMBED_MODEL` | `pritamdeka/S-PubMedBert-MS-MARCO` | Local embedding model |
| `RERANK_MODEL` | `cross-encoder/ms-marco-MiniLM-L-6-v2` | Local reranker |
| `DATA_DIR` | `./data` | FAISS index + docs |

---

## API Comparison

| | HuggingFace Inference API | Groq API |
|-|--------------------------|----------|
| Model | OpenBioLLM-70B (biomedical fine-tune) | Llama-3-70B (general) |
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

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `HF 503` on startup | Model is loading on HF servers — wait ~30s and retry |
| `HF 429` | Rate limit hit — system auto-waits and retries |
| `Groq 429` | Rate limit — set `LLM_BACKEND=huggingface` temporarily |
| Slow responses | Switch `LLM_BACKEND=groq` (1-3s vs 10-60s) |
| `No answer found` always | Run `seed_index.py` first; check index size at `/status` |
| HF model gated | Accept licence at huggingface.co/aaditya/Llama3-OpenBioLLM-70B |
