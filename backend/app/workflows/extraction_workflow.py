# app/workflows/extraction_workflow.py
"""Structural clause/risk extraction. Language-agnostic — run once per document, cached forever."""

from __future__ import annotations

import hashlib
import logging

from app.schemas.report import ClauseRisk
from app.config import settings
from app.services.llm_providers.groq_client import GroqClassificationError, generate_json
from app.prompts.clause_prompt import CLAUSE_EXTRACTION_PROMPT
from app.prompts.parent_analysis_prompt import PARENT_ANALYSIS_PROMPT

logger = logging.getLogger(__name__)

# Keep the first pass within the free tier's TPM headroom. Specialist agents
# later enrich the selected clauses, so they do not need the whole document.
_MAX_CHARS = 6000

_LANGUAGE_NAMES = {
    "en": "English", "hi": "Hindi", "gu": "Gujarati", "es": "Spanish", "fr": "French",
}

_EXTRACTION_PROMPT = """You are a legal document risk-extraction engine. Read the contract text below and \
identify every distinct clause a non-drafting party (tenant, employee, vendor, etc.) should care about \
(e.g. Termination, Liability, Rent Escalation, Security Deposit, Confidentiality, Indemnification, \
Governing Law, Arbitration, Auto-Renewal, Penalties, Non-Compete).

For each clause, assess risk to the non-drafting party and determine if it is realistically negotiable \
(i.e. a reasonable counter-proposal exists, vs. standard boilerplate that is rarely changed).

Respond with ONLY valid JSON in this exact shape — no titles or explanations, structure only:
{{
  "clauses": [
    {{
      "risk_level": "high" | "medium" | "safe",
      "risk_score": 0-100,
      "page": <int, best estimate>,
      "negotiable": true | false,
      "source_excerpt": "verbatim excerpt from the text, max 2 sentences"
    }}
  ]
}}

Contract text:
\"\"\"{text}\"\"\"
"""


def extract_clause_risks(text: str, language: str = "en") -> list[ClauseRisk]:
    """Extract clause data using the configured single- or multi-agent mode."""
    try:
        prompt = CLAUSE_EXTRACTION_PROMPT
        if settings.ANALYSIS_MODE == "single":
            language_name = _LANGUAGE_NAMES.get(language, "English")
            prompt = PARENT_ANALYSIS_PROMPT.format(language_name=language_name, text=text[:_MAX_CHARS])
        else:
            prompt = CLAUSE_EXTRACTION_PROMPT.format(text=text[:_MAX_CHARS])
        result = generate_json(
            prompt,
            # Same document text and language always receive the same sampling
            # seed. Combined with zero temperature this prevents normal LLM
            # variation from changing a score on another computer.
            temperature=0,
            seed=int(hashlib.sha256(f"{language}:{text[:_MAX_CHARS]}".encode("utf-8")).hexdigest()[:8], 16),
            # Keep the compact structural response comfortably below the provider's
            # JSON-output limit; later specialist agents enrich these clauses.
            max_completion_tokens=1800,
        )
    except GroqClassificationError as error:
        logger.error("Clause risk extraction failed: %s", error)
        raise

    clauses = []
    for index, raw in enumerate(result.get("clauses", []), start=1):
        # Some providers return the common synonym "low" despite the JSON contract.
        # Store one consistent value throughout the database and frontend.
        risk_level = str(raw.get("risk_level", "safe")).lower()
        if risk_level == "low":
            risk_level = "safe"
        if risk_level not in {"high", "medium", "safe"}:
            risk_level = "safe"
        clauses.append(
            ClauseRisk(
                clause_id=f"clause_{index:03d}",
                risk_level=risk_level,
                risk_score=int(raw.get("risk_score", 0)),
                page=int(raw.get("page", 1)),
                negotiable=bool(raw.get("negotiable", False)),
                source_excerpt=str(raw.get("source_excerpt", "")),
                title=str(raw.get("title", "")),
                plain_english=str(raw.get("plain_english", "")),
                risk_reason=str(raw.get("risk_reason", "")),
                negotiation_suggestion=str(raw.get("negotiation_suggestion", "")),
            )
        )
    return clauses
