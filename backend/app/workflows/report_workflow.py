"""Coordinates focused LLM agents and builds a language-specific legal report."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from app.prompts.negotiation_prompt import NEGOTIATION_PROMPT
from app.prompts.risk_prompt import RISK_PROMPT
from app.prompts.simplify_prompt import PLAIN_LANGUAGE_PROMPT
from app.config import settings
from app.schemas.report import AnalysisReport, ClauseRisk, NegotiationTerm, ReportSummary, TopRisk
from app.services.llm_providers.groq_client import GroqClassificationError, generate_json

logger = logging.getLogger(__name__)
_TOP_RISK_COUNT = 5
# Ten clauses per specialist call keeps language output complete for normal
# documents while reducing request/token overhead versus smaller batches.
_AGENT_BATCH_SIZE = 10

SUPPORTED_LANGUAGES: dict[str, str] = {
    "en": "English", "hi": "Hindi", "gu": "Gujarati", "es": "Spanish", "fr": "French",
}


def _risk_label(score: int) -> str:
    if score >= 75:
        return "HIGH RISK"
    if score >= 45:
        return "MODERATE RISK"
    return "SAFE"


def _agent_payload(clauses: list[ClauseRisk]) -> list[dict]:
    """Pass only source facts to each specialist, keeping their role focused."""
    return [{
        "clause_id": clause.clause_id,
        "source_excerpt": clause.source_excerpt,
        "risk_level": clause.risk_level,
        "risk_score": clause.risk_score,
        "negotiable": clause.negotiable,
    } for clause in clauses]


def _run_agent(prompt: str, clauses: list[ClauseRisk], language: str) -> dict[str, dict]:
    language_name = SUPPORTED_LANGUAGES.get(language)
    if not language_name:
        raise ValueError(f"Language '{language}' is not supported.")
    results: dict[str, dict] = {}
    for start in range(0, len(clauses), _AGENT_BATCH_SIZE):
        batch = clauses[start:start + _AGENT_BATCH_SIZE]
        try:
            result = generate_json(
                prompt.format(language_name=language_name, clauses_json=json.dumps(_agent_payload(batch))),
                temperature=0.2,
            )
        except GroqClassificationError:
            logger.exception("Legal specialist agent failed (language=%s, batch=%s)", language, start // _AGENT_BATCH_SIZE + 1)
            raise
        results.update({
            str(item.get("clause_id")): item
            for item in result.get("clauses", [])
            if isinstance(item, dict) and item.get("clause_id")
        })
    return results


def enrich_clause_agents(clauses: list[ClauseRisk], language: str) -> list[ClauseRisk]:
    """Run independent Plain Language, Risk, and Negotiation specialists."""
    plain_results = _run_agent(PLAIN_LANGUAGE_PROMPT, clauses, language)
    risk_results = _run_agent(RISK_PROMPT, clauses, language)
    negotiation_results = _run_agent(NEGOTIATION_PROMPT, clauses, language)

    for clause in clauses:
        plain = plain_results.get(clause.clause_id, {})
        risk = risk_results.get(clause.clause_id, {})
        negotiation = negotiation_results.get(clause.clause_id, {})
        clause.title = str(plain.get("title") or clause.title or f"Clause {clause.clause_id}").strip()
        clause.plain_english = str(plain.get("plain_english") or clause.plain_english).strip()
        clause.risk_reason = str(risk.get("risk_reason") or clause.risk_reason).strip()
        clause.negotiation_suggestion = str(negotiation.get("negotiation_suggestion") or clause.negotiation_suggestion).strip()
    return clauses


def _contract_summary_lines(filename: str, total_pages: int, clauses: list[ClauseRisk], overall_score: int, language: str) -> list[str]:
    high_count = sum(clause.risk_level == "high" for clause in clauses)
    medium_count = sum(clause.risk_level == "medium" for clause in clauses)
    safe_count = sum(clause.risk_level == "safe" for clause in clauses)
    topics = [clause.title for clause in sorted(clauses, key=lambda item: item.risk_score, reverse=True) if clause.title][:3]
    main_topics = ", ".join(topics) or "the parties’ rights and responsibilities"
    templates = {
        "en": [
            f"This report reviews {filename}, a document containing {total_pages} page(s) and {len(clauses)} extracted clause(s).",
            f"Its overall risk score is {overall_score}/100, based on obligations, costs, remedies, and exit rights.",
            f"The review found {high_count} high-risk clause(s), {medium_count} moderate clause(s), and {safe_count} comparatively balanced clause(s).",
            f"The main areas requiring attention are {main_topics}.",
            "Before signing, confirm that deadlines, fees, notice requirements, and responsibilities match the agreement between the parties.",
        ],
        "gu": [
            f"આ રિપોર્ટ {filename} ની સમીક્ષા કરે છે, જેમાં {total_pages} પૃષ્ઠ અને {len(clauses)} મહત્વપૂર્ણ કલમો છે.",
            f"જવાબદારીઓ, ખર્ચ, ઉપાયો અને કરાર સમાપ્ત કરવાના અધિકારોને આધારે કુલ જોખમ સ્કોર {overall_score}/100 છે.",
            f"સમીક્ષામાં {high_count} ઉચ્ચ-જોખમ, {medium_count} મધ્યમ-જોખમ અને {safe_count} તુલનાત્મક રીતે સુરક્ષિત કલમો મળી છે.",
            f"મુખ્ય ધ્યાન આપવા જેવા મુદ્દા છે: {main_topics}.",
            "સહી કરતા પહેલાં સમયમર્યાદા, ફી, નોટિસ સમયગાળા અને જવાબદારીઓ બંને પક્ષોની સમજણ સાથે મેળ ખાતી હોવાની ખાતરી કરો.",
        ],
        "hi": [
            f"यह रिपोर्ट {filename} की समीक्षा करती है, जिसमें {total_pages} पृष्ठ और {len(clauses)} महत्वपूर्ण धाराएँ हैं।",
            f"दायित्वों, लागतों, उपायों और समाप्ति अधिकारों के आधार पर कुल जोखिम स्कोर {overall_score}/100 है।",
            f"समीक्षा में {high_count} उच्च-जोखिम, {medium_count} मध्यम-जोखिम और {safe_count} अपेक्षाकृत सुरक्षित धाराएँ मिलीं।",
            f"मुख्य ध्यान देने वाले विषय हैं: {main_topics}।",
            "हस्ताक्षर से पहले समय-सीमा, शुल्क, नोटिस अवधि और जिम्मेदारियों की पुष्टि करें।",
        ],
        "es": [
            f"Este informe revisa {filename}, un documento con {total_pages} página(s) y {len(clauses)} cláusula(s) extraída(s).",
            f"La puntuación de riesgo general es {overall_score}/100 según obligaciones, costes, recursos y derechos de salida.",
            f"La revisión encontró {high_count} cláusula(s) de alto riesgo, {medium_count} moderada(s) y {safe_count} relativamente equilibrada(s).",
            f"Las áreas principales que requieren atención son: {main_topics}.",
            "Antes de firmar, confirme plazos, honorarios, periodos de aviso y responsabilidades.",
        ],
        "fr": [
            f"Ce rapport examine {filename}, un document de {total_pages} page(s) contenant {len(clauses)} clause(s) extraite(s).",
            f"Le score de risque global est de {overall_score}/100, selon les obligations, coûts, recours et droits de sortie.",
            f"L’examen a relevé {high_count} clause(s) à risque élevé, {medium_count} modérée(s) et {safe_count} relativement équilibrée(s).",
            f"Les principaux points à examiner sont : {main_topics}.",
            "Avant de signer, vérifiez les délais, frais, préavis et responsabilités.",
        ],
    }
    return templates.get(language, templates["en"])


def build_report(filename: str, total_pages: int, clauses: list[ClauseRisk], language: str = "en") -> dict:
    """Merge specialist outputs into the report shape used by analysis and report pages."""
    # Single mode receives all fields from the parent coordinator in one request.
    # Multi-agent mode enriches the structural extraction with three specialist calls.
    if settings.ANALYSIS_MODE == "multi_agent":
        clauses = enrich_clause_agents(clauses, language)
    total = len(clauses) or 1
    overall_score = round(sum(clause.risk_score for clause in clauses) / total)
    summary = ReportSummary(
        filename=filename, total_pages=total_pages, total_clauses=len(clauses),
        overall_risk_score=overall_score, overall_risk_label=_risk_label(overall_score),
        high_risk_count=sum(clause.risk_level == "high" for clause in clauses),
        medium_risk_count=sum(clause.risk_level == "medium" for clause in clauses),
        safe_count=sum(clause.risk_level == "safe" for clause in clauses),
        negotiable_count=sum(clause.negotiable for clause in clauses),
        analyzed_at=datetime.now(timezone.utc).isoformat(), language=language,
    )
    ranked = sorted(clauses, key=lambda clause: clause.risk_score, reverse=True)
    report = AnalysisReport(
        summary=summary,
        top_risks=[TopRisk(rank=index, title=clause.title, risk_level=clause.risk_level, page=clause.page, explanation=clause.plain_english) for index, clause in enumerate(ranked[:_TOP_RISK_COUNT], start=1)],
        negotiation_terms=[NegotiationTerm(title=clause.title, page=clause.page, suggestion=clause.negotiation_suggestion) for clause in ranked if clause.negotiable],
        contract_summary=_contract_summary_lines(filename, total_pages, clauses, overall_score, language),
    )
    return report.model_dump()
