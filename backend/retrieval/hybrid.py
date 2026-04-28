"""
Hybrid Retriever: BM25 keyword search + FAISS dense vector search.
Results are merged with reciprocal rank fusion.
"""

import os
import json
import pickle
import logging
import numpy as np
from pathlib import Path
from typing import Optional

import faiss
from rank_bm25 import BM25Okapi
from sentence_transformers import SentenceTransformer

from utils.logger import setup_logger

logger = setup_logger(__name__)

DATA_DIR = Path(os.getenv("DATA_DIR", "./data"))
FAISS_INDEX_PATH = DATA_DIR / "faiss.index"
DOCS_PATH = DATA_DIR / "documents.jsonl"
BM25_PATH = DATA_DIR / "bm25.pkl"

EMBED_MODEL = os.getenv("EMBED_MODEL", "pritamdeka/S-PubMedBert-MS-MARCO")
EMBED_DIM = 768


class HybridRetriever:
    """
    Hybrid BM25 + FAISS retriever with Reciprocal Rank Fusion (RRF).
    """

    def __init__(self):
        self.embed_model: Optional[SentenceTransformer] = None
        self.faiss_index: Optional[faiss.Index] = None
        self.bm25: Optional[BM25Okapi] = None
        self.documents: list[dict] = []
        self._doc_hashes: set[str] = set()

        DATA_DIR.mkdir(parents=True, exist_ok=True)

    def load(self):
        """Load embedding model, FAISS index, BM25, and documents."""
        logger.info(f"Loading embedding model: {EMBED_MODEL}")
        self.embed_model = SentenceTransformer(EMBED_MODEL)

        self._load_documents()
        self._load_faiss()
        self._load_bm25()

    def _load_documents(self):
        if DOCS_PATH.exists():
            self.documents = []
            self._doc_hashes = set()
            with open(DOCS_PATH, "r") as f:
                for line in f:
                    doc = json.loads(line)
                    self.documents.append(doc)
                    self._doc_hashes.add(doc.get("hash", ""))
            logger.info(f"Loaded {len(self.documents)} documents")
        else:
            logger.info("No existing document store found")

    def _load_faiss(self):
        if FAISS_INDEX_PATH.exists() and self.documents:
            self.faiss_index = faiss.read_index(str(FAISS_INDEX_PATH))
            logger.info(f"Loaded FAISS index: {self.faiss_index.ntotal} vectors")
        else:
            # Initialize empty index
            self.faiss_index = faiss.IndexFlatIP(EMBED_DIM)
            logger.info("Initialized new FAISS index")

    def _load_bm25(self):
        if BM25_PATH.exists() and self.documents:
            with open(BM25_PATH, "rb") as f:
                self.bm25 = pickle.load(f)
            logger.info("Loaded BM25 index")
        elif self.documents:
            self._rebuild_bm25()

    def _rebuild_bm25(self):
        tokenized = [doc["text"].lower().split() for doc in self.documents]
        self.bm25 = BM25Okapi(tokenized)
        with open(BM25_PATH, "wb") as f:
            pickle.dump(self.bm25, f)
        logger.info("Rebuilt BM25 index")

    def add_documents(self, new_docs: list[dict]):
        """Add new documents; skip duplicates."""
        unique = [d for d in new_docs if d.get("hash", "") not in self._doc_hashes]
        if not unique:
            logger.info("No new unique documents to add")
            return

        logger.info(f"Adding {len(unique)} new documents...")

        # Embed
        texts = [d["text"] for d in unique]
        embeddings = self.embed_model.encode(
            texts,
            batch_size=32,
            normalize_embeddings=True,
            show_progress_bar=True,
        ).astype(np.float32)

        # FAISS
        self.faiss_index.add(embeddings)

        # Documents store
        with open(DOCS_PATH, "a") as f:
            for doc in unique:
                f.write(json.dumps(doc) + "\n")

        for doc in unique:
            self.documents.append(doc)
            self._doc_hashes.add(doc.get("hash", ""))

        # Persist FAISS
        faiss.write_index(self.faiss_index, str(FAISS_INDEX_PATH))

        # Rebuild BM25 (must include all docs)
        self._rebuild_bm25()

        logger.info(f"Index now has {len(self.documents)} documents")

    def retrieve(self, query: str, top_k: int = 20) -> list[dict]:
        """Hybrid retrieval via RRF fusion of BM25 and FAISS results."""
        if not self.documents:
            return []

        k = min(top_k, len(self.documents))
        faiss_results = self._faiss_search(query, k)
        bm25_results = self._bm25_search(query, k)
        merged = self._rrf_merge(faiss_results, bm25_results, k)
        return merged

    def _faiss_search(self, query: str, k: int) -> list[tuple[int, float]]:
        """Dense vector search."""
        if self.faiss_index.ntotal == 0:
            return []
        q_emb = self.embed_model.encode(
            [query], normalize_embeddings=True
        ).astype(np.float32)
        scores, indices = self.faiss_index.search(q_emb, k)
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx >= 0 and idx < len(self.documents):
                results.append((int(idx), float(score)))
        return results

    def _bm25_search(self, query: str, k: int) -> list[tuple[int, float]]:
        """Sparse BM25 keyword search."""
        if not self.bm25:
            return []
        tokens = query.lower().split()
        scores = self.bm25.get_scores(tokens)
        top_indices = np.argsort(scores)[::-1][:k]
        return [(int(i), float(scores[i])) for i in top_indices if scores[i] > 0]

    def _rrf_merge(
        self,
        faiss_results: list[tuple[int, float]],
        bm25_results: list[tuple[int, float]],
        k: int,
        rrf_k: int = 60,
    ) -> list[dict]:
        """Reciprocal Rank Fusion."""
        rrf_scores: dict[int, float] = {}

        for rank, (idx, _) in enumerate(faiss_results):
            rrf_scores[idx] = rrf_scores.get(idx, 0) + 1.0 / (rrf_k + rank + 1)

        for rank, (idx, _) in enumerate(bm25_results):
            rrf_scores[idx] = rrf_scores.get(idx, 0) + 1.0 / (rrf_k + rank + 1)

        sorted_ids = sorted(rrf_scores, key=rrf_scores.__getitem__, reverse=True)[:k]

        results = []
        for idx in sorted_ids:
            doc = dict(self.documents[idx])
            doc["retrieval_score"] = rrf_scores[idx]
            results.append(doc)

        return results

    def index_size(self) -> int:
        return len(self.documents)
