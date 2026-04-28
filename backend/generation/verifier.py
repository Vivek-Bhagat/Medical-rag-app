"""
Answer Verifier — Second LLM pass to validate:
  1. All claims are grounded in the provided context
  2. Citations [1], [2] are present and valid
  3. No hallucination or unsupported claims

Rejects answer and returns "No answer found" if verification fails.
"""

import re
import logging
from typing import Tuple

from utils.logger import setup_logger

logger = setup_logger(__name__)

VERIFY_PROMPT_TEMPLATE = """You are a strict medical fact-checker.

CONTEXT DOCUMENTS:
{context}

---

GENERATED ANSWER TO VERIFY:
{answer}

---

VERIFICATION TASK:
Check the generated answer against the context documents.

Answer ONLY with valid JSON in this exact format:
{{
  "valid": true or false,
  "reason": "brief explanation",
  "unsupported_claims": ["list any claims not in context, or empty list"]
}}

Rules:
- valid=true ONLY if ALL claims are directly supported by context documents
- valid=true ONLY if citations [1],[2] etc. are present
- valid=false if ANY claim cannot be verified in context
- valid=false if answer contains knowledge not in context

JSON RESPONSE:"""


class AnswerVerifier:
    """Uses a second LLM call to verify answer grounding and citations."""

    def __init__(self, llm):
        self.llm = llm

    def verify(self, query: str, answer: str, context: str) -> Tuple[bool, str]:
        """
        Verify the answer against context.
        Returns (is_valid, reason).
        """
        if not answer or answer.strip() == "No answer found":
            return False, "Empty or no-answer response"

        # Quick pre-checks
        citations = re.findall(r"\[\d+\]", answer)
        if not citations:
            logger.warning("Verification failed: no citations in answer")
            return False, "No citations found in answer"

        # LLM verification pass
        verify_prompt = VERIFY_PROMPT_TEMPLATE.format(
            context=context,
            answer=answer,
        )

        try:
            raw_response, _ = self.llm.generate(
                query="Verify this answer",
                context=verify_prompt,
            )
            result = self._parse_verification(raw_response)
            if result:
                valid = result.get("valid", False)
                reason = result.get("reason", "Unknown")
                unsupported = result.get("unsupported_claims", [])
                if unsupported:
                    logger.warning(f"Unsupported claims: {unsupported}")
                return bool(valid), str(reason)
        except Exception as e:
            logger.error(f"Verification error: {e}")
            # On verification failure, apply conservative heuristics
            return self._heuristic_verify(answer, context)

        return self._heuristic_verify(answer, context)

    def _parse_verification(self, text: str) -> dict | None:
        """Extract JSON from LLM response."""
        import json

        # Try to find JSON block
        match = re.search(r"\{.*?\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass

        # Try entire text
        try:
            return json.loads(text.strip())
        except Exception:
            return None

    def _heuristic_verify(self, answer: str, context: str) -> Tuple[bool, str]:
        """
        Conservative heuristic verification when LLM verification fails.
        Checks:
          - Citations present
          - Answer words appear in context
          - No obvious hallucination markers
        """
        # Must have citations
        if not re.findall(r"\[\d+\]", answer):
            return False, "No citations"

        # Check that key answer terms appear in context
        answer_words = set(answer.lower().split())
        context_words = set(context.lower().split())

        # Remove common stopwords
        stopwords = {
            "the", "a", "an", "is", "are", "was", "were", "be", "been",
            "being", "have", "has", "had", "do", "does", "did", "will",
            "would", "could", "should", "may", "might", "can", "this",
            "that", "these", "those", "and", "or", "but", "in", "on",
            "at", "to", "for", "of", "with", "by", "from", "as", "it",
            "its", "not", "no", "nor", "so", "yet", "both", "either",
        }

        meaningful_words = answer_words - stopwords
        if not meaningful_words:
            return False, "Answer too short"

        # At least 40% of meaningful answer words should appear in context
        overlap = meaningful_words & context_words
        overlap_ratio = len(overlap) / len(meaningful_words)

        if overlap_ratio < 0.40:
            logger.warning(
                f"Low context overlap: {overlap_ratio:.2%} — possible hallucination"
            )
            return False, f"Low context overlap ({overlap_ratio:.0%})"

        return True, "Heuristic verification passed"
