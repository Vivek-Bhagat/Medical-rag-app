"""
Cross-Encoder reranker for precise relevance scoring.
Uses a biomedical cross-encoder model.
"""

import os
import logging
from typing import Optional

from sentence_transformers import CrossEncoder
from utils.logger import setup_logger

logger = setup_logger(__name__)

RERANK_MODEL = os.getenv(
    "RERANK_MODEL",
    "cross-encoder/ms-marco-MiniLM-L-6-v2",
)


class CrossEncoderReranker:
    """Reranks retrieved documents using a cross-encoder model."""

    def __init__(self):
        self.model: Optional[CrossEncoder] = None

    def load(self):
        logger.info(f"Loading cross-encoder: {RERANK_MODEL}")
        self.model = CrossEncoder(RERANK_MODEL, max_length=512)
        logger.info("Cross-encoder loaded")

    def rerank(
        self,
        query: str,
        candidates: list[dict],
        top_k: int = 5,
    ) -> list[dict]:
        """Score query-document pairs and return top_k ranked docs."""
        if not self.model or not candidates:
            return candidates[:top_k]

        pairs = [(query, f"{d['title']} {d['abstract'][:500]}") for d in candidates]
        scores = self.model.predict(pairs, show_progress_bar=False)

        for doc, score in zip(candidates, scores):
            doc["rerank_score"] = float(score)

        ranked = sorted(candidates, key=lambda x: x["rerank_score"], reverse=True)
        return ranked[:top_k]
