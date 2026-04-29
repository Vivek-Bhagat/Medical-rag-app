"""
PubMed ingestion using BioPython Entrez API.
Fetches real research papers: title + abstract + PMID.
"""

import os
import time
import logging
import hashlib
from typing import Optional

from Bio import Entrez, Medline
from utils.logger import setup_logger

logger = setup_logger(__name__)

Entrez.email = os.getenv("ENTREZ_EMAIL", "vivekkachhap1890@gmail.com")
Entrez.tool = "MedRAG"


class PubMedIngester:
    """Fetches and parses PubMed abstracts."""

    def fetch(
        self,
        query: str,
        max_results: int = 50,
        sort: str = "relevance",
    ) -> list[dict]:
        """
        Fetch PubMed articles for a search query.

        Returns list of dicts with: pmid, title, abstract, mesh_terms.
        """
        logger.info(f"PubMed search: '{query}' (max={max_results})")

        try:
            pmids = self._search(query, max_results, sort)
        except Exception as e:
            logger.error(f"PubMed search failed: {e}")
            return []

        if not pmids:
            logger.warning(f"No results for query: {query}")
            return []

        logger.info(f"Found {len(pmids)} PMIDs, fetching details...")
        docs = self._fetch_details(pmids)
        logger.info(f"Parsed {len(docs)} valid documents")
        return docs

    def _search(self, query: str, max_results: int, sort: str) -> list[str]:
        handle = Entrez.esearch(
            db="pubmed",
            term=query,
            retmax=max_results,
            sort=sort,
            usehistory="y",
        )
        record = Entrez.read(handle)
        handle.close()
        return record.get("IdList", [])

    def _fetch_details(self, pmids: list[str]) -> list[dict]:
        """Fetch full records for given PMIDs in batches."""
        docs = []
        batch_size = 100

        for i in range(0, len(pmids), batch_size):
            batch = pmids[i : i + batch_size]
            try:
                handle = Entrez.efetch(
                    db="pubmed",
                    id=",".join(batch),
                    rettype="medline",
                    retmode="text",
                )
                records = list(Medline.parse(handle))
                handle.close()

                for rec in records:
                    doc = self._parse_record(rec)
                    if doc:
                        docs.append(doc)

                # Respect NCBI rate limit (3 req/sec without API key)
                time.sleep(0.34)

            except Exception as e:
                logger.error(f"Batch fetch error: {e}")
                continue

        return docs

    def _parse_record(self, rec: dict) -> Optional[dict]:
        """Parse a Medline record into our schema."""
        pmid = rec.get("PMID", "").strip()
        title = rec.get("TI", "").strip()
        abstract = rec.get("AB", "").strip()

        if not pmid or not title or not abstract:
            return None

        # Deduplicate via content hash
        content_hash = hashlib.md5(f"{pmid}{title}".encode()).hexdigest()

        return {
            "pmid": pmid,
            "title": title,
            "abstract": abstract,
            "authors": rec.get("AU", []),
            "journal": rec.get("TA", ""),
            "pub_date": rec.get("DP", ""),
            "mesh_terms": rec.get("MH", []),
            "hash": content_hash,
            "text": f"{title}. {abstract}",  # Combined for embedding
        }

    def fetch_by_pmids(self, pmids: list[str]) -> list[dict]:
        """Fetch specific PMIDs directly."""
        return self._fetch_details(pmids)
