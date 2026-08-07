# app/workflows/extraction_workflow.py
"""Structural clause/risk extraction. Language-agnostic — run once per document, cached forever."""

from __future__ import annotations

import logging

from app.schemas.report import ClauseRisk
from app.services.llm_providers.groq_client import GroqClassificationError, generate_json
from app.prompts.multi_agent_analysis_prompt import MULTI_AGENT_ANALYSIS_PROMPT

logger = logging.getLogger(__name__)

_MAX_CHARS = 15000

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


def extract_clause_risks(text: str) -> list[ClauseRisk]:
    try:
        result = generate_json(MULTI_AGENT_ANALYSIS_PROMPT.format(text=text[:_MAX_CHARS]), temperature=0.1)
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
