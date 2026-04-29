#!/usr/bin/env python3
"""
Seed the MedRAG index with PubMed articles for common medical topics.
Run once before starting the server.

Usage:
    python scripts/seed_index.py
    python scripts/seed_index.py --queries "hypertension treatment" "diabetes mellitus type 2"
    python scripts/seed_index.py --max 100
    python scripts/seed_index.py --preset journals --max 40
    python scripts/seed_index.py --preset all --max 25
"""

import sys
import os
import argparse
import logging
from typing import Optional

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../backend"))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "../backend/.env"))

from ingestion.pubmed import PubMedIngester
from retrieval.hybrid import HybridRetriever
from utils.logger import setup_logger

logger = setup_logger("seed")

TOPIC_QUERIES = [
    "hypertension treatment guidelines",
    "type 2 diabetes mellitus management",
    "antibiotic resistance clinical treatment",
    "COVID-19 pharmacological treatment",
    "heart failure drug therapy",
    "cancer immunotherapy clinical trials",
    "sepsis management antibiotics",
    "stroke thrombolysis treatment",
    "asthma inhaler therapy",
    "atrial fibrillation anticoagulation",
    "chronic kidney disease management",
    "rheumatoid arthritis biologics",
    "depression antidepressants efficacy",
    "COPD bronchodilator therapy",
    "osteoporosis bisphosphonate treatment",
    "HIV antiretroviral therapy",
    "epilepsy antiepileptic drugs",
    "Alzheimer disease pharmacotherapy",
    "opioid analgesics pain management",
    "warfarin dose adjustment",
]


# Source-/journal-targeted queries to diversify the seed corpus.
# Notes:
# - "PMC" here means PubMed records with free full text in PubMed Central (`pmc[filter]`).
# - UpToDate is not indexed as a PubMed journal; Medscape's historical "Medscape J Med" is.
JOURNAL_QUERIES = [
    # NEJM
    '"N Engl J Med"[TA] AND (clinical trial[pt] OR randomized controlled trial[pt] OR review[pt])',
    # BMC journals (examples; PubMed uses abbreviated titles in [TA])
    '"BMC Med"[TA] AND (review[pt] OR clinical trial[pt] OR meta-analysis[pt])',
    '"BMC Infect Dis"[TA] AND (systematic review[pt] OR clinical trial[pt] OR review[pt])',
    '"BMC Cancer"[TA] AND (clinical trial[pt] OR randomized controlled trial[pt] OR review[pt])',
    # Cochrane Library (Cochrane reviews are indexed in PubMed)
    '"Cochrane Database Syst Rev"[TA]',
    # Medscape (historical PubMed-indexed journal)
    '"Medscape J Med"[TA]',
    # PMC / Free full text
    'pmc[filter] AND (guideline[pt] OR systematic review[pt] OR review[pt])',
    'free full text[filter] AND (practice guideline[pt] OR review[pt])',
]


def _build_queries(preset: str, custom_queries: Optional[list[str]]) -> list[str]:
    if custom_queries:
        return custom_queries

    preset = (preset or "topics").lower()
    if preset == "topics":
        return list(TOPIC_QUERIES)
    if preset == "journals":
        return list(JOURNAL_QUERIES)
    if preset == "all":
        # Keep order stable for reproducibility.
        return list(TOPIC_QUERIES) + list(JOURNAL_QUERIES)

    raise ValueError(f"Unknown preset: {preset}")


def main():
    parser = argparse.ArgumentParser(description="Seed MedRAG PubMed index")
    parser.add_argument(
        "--queries", nargs="+", default=None,
        help="Custom search queries (default: medical topic list)"
    )
    parser.add_argument(
        "--preset",
        choices=["topics", "journals", "all"],
        default="all",
        help="Query preset to use when --queries is not provided (default: all)",
    )
    parser.add_argument(
        "--max", type=int, default=50,
        help="Max articles per query (default: 50)"
    )
    args = parser.parse_args()

    queries = _build_queries(args.preset, args.queries)
    max_per_query = args.max

    logger.info(f"Seeding index with {len(queries)} queries, max {max_per_query} per query")

    ingester = PubMedIngester()
    retriever = HybridRetriever()

    logger.info("Loading embedding model...")
    retriever.load()

    total = 0
    for i, query in enumerate(queries, 1):
        logger.info(f"[{i}/{len(queries)}] Fetching: {query}")
        docs = ingester.fetch(query, max_results=max_per_query)
        if docs:
            retriever.add_documents(docs)
            total += len(docs)
            logger.info(f"  → Added {len(docs)} docs. Index size: {retriever.index_size()}")
        else:
            logger.warning(f"  → No docs found for: {query}")

    logger.info(f"\n✓ Seeding complete. Total indexed: {total} documents")
    logger.info(f"  Index size: {retriever.index_size()}")


if __name__ == "__main__":
    main()
