# app/workflows/report_workflow.py
"""Builds the AI Analysis Report in a target language, from pre-extracted clause risk data."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from app.schemas.report import AnalysisReport, ClauseNarrative, ClauseRisk, ReportSummary, TopRisk
from app.services.llm_providers.groq_client import generate_json

logger = logging.getLogger(__name__)

_TOP_RISK_COUNT = 5

# Supported languages for the multi-language report generator.
# Extend this as more languages are validated.
SUPPORTED_LANGUAGES: dict[str, str] = {
    "en": "English",
    "hi": "Hindi",
    "gu": "Gujarati",
    "es": "Spanish",
    "fr": "French",
}

_NARRATIVE_PROMPT = """You are a legal-simplification assistant. You will be given a list of contract clauses \
with their risk level and a source excerpt. For EACH clause, write in {language_name}:

1. A short, natural clause title (2-5 words) a layperson would recognize.
2. A 2-3 sentence plain-language explanation covering: what the clause means, why it matters/is risky \
   (or why it's safe, for low-risk clauses), and — if the clause is marked negotiable — one concrete \
   negotiation suggestion.

Write for someone with no legal background. Avoid legal jargon; if a legal term is unavoidable, \
briefly explain it in plain words.

Respond with ONLY valid JSON in this exact shape, one entry per input clause, same order:
{{
  "clauses": [
    {{"clause_id": "clause_001", "title": "...", "explanation": "..."}}
  ]
}}

Clauses:
{clauses_json}
"""


def _risk_label(score: int) -> str:
    if score >= 60:
        return "HIGH RISK"
    if score >= 30:
        return "MODERATE RISK"
    return "LOW RISK"


def generate_narratives(clauses: list[ClauseRisk], language: str) -> list[ClauseNarrative]:
    language_name = SUPPORTED_LANGUAGES.get(language, language)
    clauses_payload = [
        {"clause_id": c.clause_id, "risk_level": c.risk_level, "source_excerpt": c.source_excerpt}
        for c in clauses
    ]

    try:
        import json as _json

        result = generate_json(
            _NARRATIVE_PROMPT.format(language_name=language_name, clauses_json=_json.dumps(clauses_payload)),
            temperature=0.3,
        )
    except GroqClassificationError as error:
        logger.error("Narrative generation failed (language=%s): %s", language, error)
        raise

    narratives = []
    for raw in result.get("clauses", []):
        narratives.append(
            ClauseNarrative(
                clause_id=str(raw.get("clause_id", "")),
                title=str(raw.get("title", "Untitled Clause")),
                explanation=str(raw.get("explanation", "")),
            )
        )
    return narratives


def build_report(
    filename: str,
    total_pages: int,
    clauses: list[ClauseRisk],
    language: str = "en",
) -> dict:
    narratives_by_id = {n.clause_id: n for n in generate_narratives(clauses, language)}

    total = len(clauses) or 1
    overall_score = round(sum(c.risk_score for c in clauses) / total)

    summary = ReportSummary(
        filename=filename,
        total_pages=total_pages,
        total_clauses=len(clauses),
        overall_risk_score=overall_score,
        overall_risk_label=_risk_label(overall_score),
        high_risk_count=sum(1 for c in clauses if c.risk_level == "high"),
        medium_risk_count=sum(1 for c in clauses if c.risk_level == "medium"),
        safe_count=sum(1 for c in clauses if c.risk_level == "safe"),
        negotiable_count=sum(1 for c in clauses if c.negotiable),
        analyzed_at=datetime.now(timezone.utc).isoformat(),
        language=language,
    )

    ranked = sorted(clauses, key=lambda c: c.risk_score, reverse=True)[:_TOP_RISK_COUNT]
    top_risks = []
    for rank, clause in enumerate(ranked, start=1):
        narrative = narratives_by_id.get(clause.clause_id)
        top_risks.append(
            TopRisk(
                rank=rank,
                title=narrative.title if narrative else "Untitled Clause",
                risk_level=clause.risk_level,
                page=clause.page,
                explanation=narrative.explanation if narrative else "",
            )
        )

    report = AnalysisReport(summary=summary, top_risks=top_risks)
    return report.model_dump()