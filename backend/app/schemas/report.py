# app/schemas/report.py
"""Data shapes for the ClauseWise AI Analysis Report."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

RiskLevel = Literal["high", "medium", "safe"]


class ClauseRisk(BaseModel):
    """Language-agnostic structural facts about one clause. Extracted once, reused for every language."""

    clause_id: str
    risk_level: RiskLevel
    risk_score: int          # 0-100
    page: int
    negotiable: bool
    source_excerpt: str      # verbatim snippet from the original document (not translated)
    title: str = ""
    plain_english: str = ""
    risk_reason: str = ""
    negotiation_suggestion: str = ""


class ClauseNarrative(BaseModel):
    """Language-specific text for one clause. Regenerated per requested language."""

    clause_id: str
    title: str
    explanation: str         # plain-english (or target-language) risk + negotiation explanation, 2-3 sentences


class ReportSummary(BaseModel):
    filename: str
    total_pages: int
    total_clauses: int
    overall_risk_score: int          # 0-100
    overall_risk_label: str          # e.g. "HIGH RISK", "MODERATE RISK", "LOW RISK"
    high_risk_count: int
    medium_risk_count: int
    safe_count: int
    negotiable_count: int
    analyzed_at: str                 # ISO timestamp
    language: str                    # e.g. "en", "hi", "gu"


class TopRisk(BaseModel):
    rank: int
    title: str
    risk_level: RiskLevel
    page: int
    explanation: str


class NegotiationTerm(BaseModel):
    """A practical counter-proposal tied to a specific extracted clause."""

    title: str
    page: int
    suggestion: str


class AnalysisReport(BaseModel):
    summary: ReportSummary
    top_risks: list[TopRisk]
    negotiation_terms: list[NegotiationTerm] = []
    contract_summary: list[str] = []
