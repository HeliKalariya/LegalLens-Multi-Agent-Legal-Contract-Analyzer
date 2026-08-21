"""Single-call parent prompt used when conserving LLM quota during development."""

PARENT_ANALYSIS_PROMPT = """You are a senior legal-document analysis coordinator. Complete the work of four specialists in ONE response: clause extraction, plain-language explanation, risk explanation, and negotiation guidance.

Analyze the contract below. Return at most 7 distinct clauses that materially affect the non-drafting party. Ignore titles, parties, addresses, generic acknowledgements, and repeated boilerplate.

For every clause:
- keep source_excerpt verbatim from the contract, one sentence and at most 160 characters;
- set risk_level to high, medium, or safe, and risk_score from 0 to 100;
- produce title, plain_english, risk_reason, and negotiation_suggestion in {language_name};
- write useful but concise explanations; and state "No change recommended." when a safe clause is not negotiable.

Return ONLY valid JSON in exactly this shape:
{{
  "clauses": [
    {{
      "risk_level": "high" | "medium" | "safe",
      "risk_score": 0,
      "page": 1,
      "negotiable": true,
      "source_excerpt": "verbatim contract excerpt",
      "title": "short title in {language_name}",
      "plain_english": "plain explanation in {language_name}",
      "risk_reason": "risk explanation in {language_name}",
      "negotiation_suggestion": "negotiation guidance in {language_name}"
    }}
  ]
}}

Contract text:
\"\"\"{text}\"\"\"
"""
