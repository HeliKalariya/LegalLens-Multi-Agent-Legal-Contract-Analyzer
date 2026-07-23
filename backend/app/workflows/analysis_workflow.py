"""A deterministic multi-agent-style contract analysis workflow."""

from __future__ import annotations

import re


RISK_RULES = {
    "Limitation of liability": ("liability", "High"),
    "Indemnification": ("indemn", "High"),
    "Termination": ("termination", "Medium"),
    "Confidentiality": ("confidential", "Medium"),
    "Dispute resolution": ("arbitration", "Medium"),
    "Payment obligations": ("payment", "Low"),
}


def _sentence_for(keyword: str, text: str) -> str:
    match = re.search(rf"[^.!?]*{re.escape(keyword)}[^.!?]*[.!?]", text, flags=re.IGNORECASE)
    return " ".join(match.group(0).split()) if match else f"The document includes provisions concerning {keyword}."


def build_contract_report(filename: str, text: str, page_count: int) -> dict:
    """Run clause, risk, negotiation, and synthesis stages over extracted PDF text."""
    normalized = " ".join(text.split())
    clauses = []
    risks = []
    suggestions = []

    for title, (keyword, severity) in RISK_RULES.items():
        if keyword.lower() not in normalized.lower():
            continue
        excerpt = _sentence_for(keyword, normalized)
        clauses.append({"title": title, "excerpt": excerpt})
        risks.append({"title": title, "severity": severity, "detail": excerpt})
        if severity == "High":
            suggestions.append(f"Review and narrow the {title.lower()} language before signing.")
        elif severity == "Medium":
            suggestions.append(f"Confirm that the {title.lower()} terms match your operational requirements.")

    overall_risk = "High" if any(item["severity"] == "High" for item in risks) else "Medium" if risks else "Low"
    agents = [
        {"name": "Clause extraction agent", "status": "complete", "detail": f"Identified {len(clauses)} relevant contract clauses."},
        {"name": "Risk assessment agent", "status": "complete", "detail": f"Flagged {len(risks)} provisions for review."},
        {"name": "Negotiation agent", "status": "complete", "detail": f"Prepared {len(suggestions)} negotiation recommendations."},
        {"name": "Report synthesis agent", "status": "complete", "detail": "Combined the specialist findings into this report."},
    ]
    return {
        "filename": filename,
        "page_count": page_count,
        "overall_risk": overall_risk,
        "summary": f"The report reviewed {page_count} page(s) and found {len(risks)} provision(s) that may need attention.",
        "clauses": clauses,
        "risks": risks,
        "negotiation_suggestions": suggestions,
        "agent_results": agents,
    }
