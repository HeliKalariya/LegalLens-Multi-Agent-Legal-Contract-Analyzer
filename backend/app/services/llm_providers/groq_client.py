"""
Groq LLM Client
"""

from __future__ import annotations

import json
import os
import time

import httpx

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

# Change model here if needed
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")


class GroqClassificationError(Exception):
    """Raised when a Groq API call fails."""


def _call_groq(
    messages: list,
    *,
    temperature: float = 0.2,
    json_mode: bool = False,
    timeout: float = 60,
):

    if not GROQ_API_KEY:
        raise GroqClassificationError("GROQ_API_KEY is not configured.")

    payload = {
        "model": GROQ_MODEL,
        "messages": messages,
        "temperature": temperature,
    }

    if json_mode:
        payload["response_format"] = {
            "type": "json_object"
        }

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    last_error = None

    for _ in range(2):

        try:

            response = httpx.post(
                GROQ_API_URL,
                headers=headers,
                json=payload,
                timeout=timeout,
            )

        except httpx.TimeoutException as e:
            last_error = e
            continue

        except httpx.RequestError as e:
            raise GroqClassificationError(
                f"Unable to connect to Groq.\n{e}"
            ) from e

        if response.status_code == 429:
            last_error = GroqClassificationError("Rate limit exceeded.")
            time.sleep(2)
            continue

        if response.status_code >= 400:
            raise GroqClassificationError(
                f"Groq returned {response.status_code}\n\n{response.text}"
            )

        try:
            return response.json()

        except Exception as e:
            raise GroqClassificationError(
                "Invalid response received from Groq."
            ) from e

    raise GroqClassificationError(
        f"Groq request failed after retry.\n{last_error}"
    )


def generate(
    prompt: str,
    *,
    system_instruction: str | None = None,
    json_mode: bool = False,
    temperature: float = 0.2,
    timeout: float = 60,
) -> str:
    """
    Generate plain text.
    """

    messages = []

    if system_instruction:
        messages.append(
            {
                "role": "system",
                "content": system_instruction,
            }
        )

    messages.append(
        {
            "role": "user",
            "content": prompt,
        }
    )

    response = _call_groq(
        messages,
        temperature=temperature,
        json_mode=json_mode,
        timeout=timeout,
    )

    try:
        return response["choices"][0]["message"]["content"]

    except Exception as e:
        raise GroqClassificationError(
            "Could not parse Groq response."
        ) from e


def generate_json(
    prompt: str,
    *,
    system_instruction: str | None = None,
    temperature: float = 0.2,
):
    """
    Generate JSON.
    """

    raw = generate(
        prompt,
        system_instruction=system_instruction,
        json_mode=True,
        temperature=temperature,
    )

    try:
        return json.loads(raw)

    except json.JSONDecodeError as e:
        raise GroqClassificationError(
            "Groq returned invalid JSON.\n\n"
            + raw
        ) from e


_CLASSIFICATION_PROMPT = """
You are a legal document classifier.

Determine whether the following document is a legal document.

Possible types:

- Contract
- Employment Agreement
- Service Agreement
- NDA
- Lease Agreement
- Privacy Policy
- Terms of Service
- Purchase Agreement
- Legal Notice
- Court Filing
- Memorandum of Understanding

Return ONLY JSON.

{{
    "is_legal_document": true,
    "document_type": "Employment Agreement",
    "confidence": 0.98
}}

Document:

{text}
"""


def classify_document(
    text: str,
    *,
    max_chars: int = 4000,
):
    """
    Determine whether uploaded document is legal.
    """

    result = generate_json(
        _CLASSIFICATION_PROMPT.format(
            text=text[:max_chars]
        ),
        temperature=0,
    )

    return {
        "is_legal_document": bool(
            result.get("is_legal_document", False)
        ),
        "document_type": str(
            result.get("document_type", "Unknown")
        ),
        "confidence": float(
            result.get("confidence", 0)
        ),
    }