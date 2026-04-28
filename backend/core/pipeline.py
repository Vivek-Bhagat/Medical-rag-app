"""
Core RAG Pipeline - Orchestrates all components.
"""

import asyncio
import logging
from typing import Any

from ingestion.pubmed import PubMedIngester
from retrieval.hybrid import HybridRetriever
from retrieval.reranker import CrossEncoderReranker
from generation.llm import LocalLLM
from generation.verifier import AnswerVerifier
from utils.logger import setup_logger

logger = setup_logger(__name__)


class MedRAGPipeline:
    """Full RAG pipeline for medical query answering."""

    def __init__(self):
        self.ingester = PubMedIngester()
        self.retriever = HybridRetriever()
        self.reranker = CrossEncoderReranker()
        self.llm = LocalLLM()
        self.verifier = AnswerVerifier(self.llm)
        self._ready = False

    async def initialize(self):
        """Load all models and indices."""
        logger.info("Loading retrieval models...")
        await asyncio.get_event_loop().run_in_executor(
            None, self.retriever.load
        )
        logger.info("Loading reranker...")
        await asyncio.get_event_loop().run_in_executor(
            None, self.reranker.load
        )
        logger.info("Loading LLM...")
        await asyncio.get_event_loop().run_in_executor(
            None, self.llm.load
        )
        self._ready = True
        logger.info("All components ready.")

    def is_ready(self) -> bool:
        return self._ready

    def get_index_size(self) -> int:
        return self.retriever.index_size()

    async def run(self, query: str, top_k: int = 5, min_score: float = 0.0) -> dict[str, Any]:
        """Execute full RAG pipeline."""
        loop = asyncio.get_event_loop()

        # 1. Hybrid retrieval
        logger.info(f"Retrieving documents for: {query[:80]}")
        candidates = await loop.run_in_executor(
            None, self.retriever.retrieve, query, top_k * 3
        )

        if not candidates:
            return self._no_answer([])

        # 2. Re-ranking
        logger.info(f"Re-ranking {len(candidates)} candidates...")
        ranked = await loop.run_in_executor(
            None, self.reranker.rerank, query, candidates, top_k
        )

        if not ranked:
            return self._no_answer([])

        # Filter by min_score
        ranked = [r for r in ranked if r["rerank_score"] >= min_score]
        if not ranked:
            return self._no_answer([])

        # 3. Generate answer
        logger.info("Generating answer...")
        context = self._build_context(ranked)
        answer, confidence = await loop.run_in_executor(
            None, self.llm.generate, query, context
        )

        if answer.strip() == "No answer found" or not answer.strip():
            return self._no_answer(ranked)

        # 4. Verify answer
        logger.info("Verifying answer...")
        verified, reason = await loop.run_in_executor(
            None, self.verifier.verify, query, answer, context
        )

        if not verified:
            logger.warning(f"Answer rejected by verifier: {reason}")
            return self._no_answer(ranked)

        sources = self._format_sources(ranked)
        return {
            "answer": answer,
            "sources": sources,
            "confidence": round(confidence, 3),
            "verified": True,
        }

    def _build_context(self, docs: list[dict]) -> str:
        parts = []
        for i, doc in enumerate(docs, 1):
            parts.append(
                f"[{i}] Title: {doc['title']}\n"
                f"Abstract: {doc['abstract']}\n"
                f"PMID: {doc['pmid']}"
            )
        return "\n\n---\n\n".join(parts)

    def _format_sources(self, docs: list[dict]) -> list[dict]:
        return [
            {
                "title": d["title"],
                "abstract": d["abstract"][:400] + "..." if len(d["abstract"]) > 400 else d["abstract"],
                "url": f"https://pubmed.ncbi.nlm.nih.gov/{d['pmid']}/",
                "pmid": d["pmid"],
                "score": round(d["rerank_score"], 4),
                "rank": i,
            }
            for i, d in enumerate(docs, 1)
        ]

    def _no_answer(self, docs: list[dict]) -> dict[str, Any]:
        return {
            "answer": "No answer found",
            "sources": self._format_sources(docs) if docs else [],
            "confidence": 0.0,
            "verified": False,
        }

    async def ingest_pubmed(self, queries: list[str], max_per_query: int = 50):
        """Background task to fetch and index PubMed articles."""
        logger.info(f"Starting PubMed ingestion for {len(queries)} queries...")
        loop = asyncio.get_event_loop()
        all_docs = []
        for q in queries:
            try:
                docs = await loop.run_in_executor(
                    None, self.ingester.fetch, q, max_per_query
                )
                all_docs.extend(docs)
                logger.info(f"Fetched {len(docs)} docs for query: {q}")
            except Exception as e:
                logger.error(f"Ingestion failed for query '{q}': {e}")

        if all_docs:
            await loop.run_in_executor(None, self.retriever.add_documents, all_docs)
            logger.info(f"Indexed {len(all_docs)} documents total.")
