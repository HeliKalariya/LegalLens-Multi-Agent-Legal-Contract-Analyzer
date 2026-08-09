# app/workflows/report_workflow.py
"""Builds the AI Analysis Report in a target language, from pre-extracted clause risk data."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from app.schemas.report import AnalysisReport, ClauseNarrative, ClauseRisk, NegotiationTerm, ReportSummary, TopRisk
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
    """Apply the shared score bands used across documents and reports."""
    if score >= 75:
        return "HIGH RISK"
    if score >= 45:
        return "MODERATE RISK"
    return "SAFE"


def _contract_summary_lines(filename: str, total_pages: int, clauses: list[ClauseRisk], overall_score: int) -> list[str]:
    """Create a readable seven-line overview without discarding the clause findings."""
    high_count = sum(clause.risk_level == "high" for clause in clauses)
    medium_count = sum(clause.risk_level == "medium" for clause in clauses)
    safe_count = sum(clause.risk_level == "safe" for clause in clauses)
    main_topics = [clause.title.strip() for clause in sorted(clauses, key=lambda item: item.risk_score, reverse=True) if clause.title.strip()][:3]
    topics_text = ", ".join(main_topics) if main_topics else "the parties' rights, duties, and remedies"
    return [
        f"This report reviews {filename}, a document containing {total_pages} page(s) and {len(clauses)} extracted clause(s).",
        f"Its overall risk score is {overall_score}/100, based on the balance of obligations, costs, remedies, and exit rights in the agreement.",
        f"The review found {high_count} high-risk clause(s), {medium_count} moderate clause(s), and {safe_count} clause(s) that appear comparatively balanced.",
        f"The main areas requiring attention are {topics_text}.",
        "Read the payment, liability, termination, renewal, confidentiality, and dispute provisions together because they can affect each other in practice.",
        "Before signing, confirm that deadlines, notice requirements, fees, and responsibilities reflect what both parties actually agreed to deliver.",
        "Use the negotiation terms below as focused discussion points, and obtain professional legal advice where the commercial impact is significant.",
    ]


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

    ranked_clauses = sorted(clauses, key=lambda c: c.risk_score, reverse=True)
    ranked = ranked_clauses[:_TOP_RISK_COUNT]
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

    negotiation_terms = [
        NegotiationTerm(
            title=clause.title.strip() or f"Clause on page {clause.page}",
            page=clause.page,
            suggestion=clause.negotiation_suggestion.strip() or f"Ask for clearer, balanced limits for this {clause.title.strip() or 'clause'}.",
        )
        for clause in ranked_clauses
        if clause.negotiable
    ]
    report = AnalysisReport(
        summary=summary,
        top_risks=top_risks,
        negotiation_terms=negotiation_terms,
        contract_summary=_contract_summary_lines(filename, total_pages, clauses, overall_score),
    )
    return report.model_dump()
