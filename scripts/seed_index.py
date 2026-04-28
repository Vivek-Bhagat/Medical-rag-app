#!/usr/bin/env python3
"""
Seed the MedRAG index with PubMed articles for common medical topics.
Run once before starting the server.

Usage:
    python scripts/seed_index.py
    python scripts/seed_index.py --queries "hypertension treatment" "diabetes mellitus type 2"
    python scripts/seed_index.py --max 100
"""

import sys
import os
import argparse
import logging

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../backend"))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "../backend/.env"))

from ingestion.pubmed import PubMedIngester
from retrieval.hybrid import HybridRetriever
from utils.logger import setup_logger

logger = setup_logger("seed")

DEFAULT_QUERIES = [
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


def main():
    parser = argparse.ArgumentParser(description="Seed MedRAG PubMed index")
    parser.add_argument(
        "--queries", nargs="+", default=None,
        help="Custom search queries (default: medical topic list)"
    )
    parser.add_argument(
        "--max", type=int, default=50,
        help="Max articles per query (default: 50)"
    )
    args = parser.parse_args()

    queries = args.queries or DEFAULT_QUERIES
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
