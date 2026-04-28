"""
MedRAG - Medical Query Answering System
Production-ready FastAPI backend
"""

import os
import time
from contextlib import asynccontextmanager
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, Field
from pydantic.config import ConfigDict

 # Load environment variables from .env file as early as possible
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from core.pipeline import MedRAGPipeline
from core.cache import QueryCache
from utils.logger import setup_logger



logger = setup_logger(__name__)

# Global pipeline instance
pipeline: Optional[MedRAGPipeline] = None
cache: Optional[QueryCache] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize pipeline on startup."""
    global pipeline, cache
    logger.info("Initializing MedRAG pipeline...")
    try:
        pipeline = MedRAGPipeline()
        await pipeline.initialize()
        cache = QueryCache(maxsize=500, ttl=3600)
        logger.info("Pipeline initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize pipeline: {e}")
        raise
    yield
    logger.info("Shutting down MedRAG pipeline...")


app = FastAPI(
    title="MedRAG API",
    description="Evidence-based medical query answering with full citations",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)


# ─── Schemas ────────────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    query: str = Field(..., min_length=5, max_length=1000)
    max_results: int = Field(default=5, ge=1, le=20)
    min_score: float = Field(default=0.0, ge=0.0, le=1.0)


class Source(BaseModel):
    title: str
    abstract: str
    url: str
    pmid: str
    score: float
    rank: int


class QueryResponse(BaseModel):
    answer: str
    sources: list[Source]
    confidence: float
    query_time_ms: float
    cached: bool
    verified: bool


class IngestRequest(BaseModel):
    queries: list[str]
    max_per_query: int = Field(default=50, ge=10, le=200)


class StatusResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    status: str
    index_size: int
    model_loaded: bool
    version: str


# ─── Routes ─────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "MedRAG API"}


@app.get("/status", response_model=StatusResponse)
async def status():
    global pipeline
    if not pipeline:
        raise HTTPException(status_code=503, detail="Pipeline not initialized")
    return StatusResponse(
        status="ready",
        index_size=pipeline.get_index_size(),
        model_loaded=pipeline.is_ready(),
        version="1.0.0",
    )


@app.post("/query", response_model=QueryResponse)
async def query(request: QueryRequest):
    global pipeline, cache
    if not pipeline or not pipeline.is_ready():
        raise HTTPException(status_code=503, detail="Pipeline not ready")

    # Check cache
    cache_key = f"{request.query}:{request.max_results}"
    if cache:
        cached = cache.get(cache_key)
        if cached:
            cached["cached"] = True
            return QueryResponse(**cached)

    start = time.time()
    try:
        result = await pipeline.run(
            query=request.query,
            top_k=request.max_results,
            min_score=request.min_score,
        )
    except Exception as e:
        logger.error(f"Pipeline error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

    elapsed = (time.time() - start) * 1000
    response = QueryResponse(
        answer=result["answer"],
        sources=result["sources"],
        confidence=result["confidence"],
        query_time_ms=round(elapsed, 2),
        cached=False,
        verified=result["verified"],
    )

    if cache and result["answer"] != "No answer found":
        cache.set(cache_key, response.model_dump())

    return response


@app.post("/ingest")
async def ingest(request: IngestRequest, background_tasks: BackgroundTasks):
    global pipeline
    if not pipeline:
        raise HTTPException(status_code=503, detail="Pipeline not initialized")

    background_tasks.add_task(
        pipeline.ingest_pubmed,
        queries=request.queries,
        max_per_query=request.max_per_query,
    )
    return {"status": "ingestion_started", "queries": len(request.queries)}


@app.delete("/cache")
async def clear_cache():
    global cache
    if cache:
        cache.clear()
    return {"status": "cache_cleared"}
