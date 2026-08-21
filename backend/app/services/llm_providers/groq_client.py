"""
Groq LLM Client
"""

from __future__ import annotations

import json
import os
import re
import time

import httpx

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

# Change model here if needed
GROQ_MODEL = os.getenv("GROQ_MODEL", "groq/compound-mini")

class GroqClassificationError(Exception):
    """Raised when a Groq API call fails."""


def _seconds_from_hint(value: str | None) -> float | None:
    """Parse Groq's numeric retry hints, including values such as ``10.2s``."""
    if not value:
        return None
    match = re.search(r"(\d+(?:\.\d+)?)\s*s?", value, flags=re.IGNORECASE)
    return float(match.group(1)) if match else None


def _rate_limit_error(response: httpx.Response) -> tuple[GroqClassificationError, float | None]:
    """Keep Groq's reset details so the UI can tell users when to retry."""
    try:
        payload = response.json()
        provider_message = str(payload.get("error", {}).get("message") or "Rate limit exceeded.")
    except (ValueError, AttributeError):
        provider_message = "Rate limit exceeded."

    retry_after_value = response.headers.get("retry-after")

    reset_tokens = response.headers.get("x-ratelimit-reset-tokens")
    reset_requests = response.headers.get("x-ratelimit-reset-requests")
    message_waits = [
        float(value)
        for value in re.findall(r"try again in\s*(\d+(?:\.\d+)?)\s*(?:s|seconds?)", provider_message, re.IGNORECASE)
    ]
    wait_hints = [
        _seconds_from_hint(retry_after_value),
        _seconds_from_hint(reset_tokens),
        _seconds_from_hint(reset_requests),
        *message_waits,
    ]
    retry_after = max((value for value in wait_hints if value is not None), default=None)
    reset_hint = retry_after_value or reset_tokens or reset_requests
    retry_hint = f" Try again after {reset_hint}." if reset_hint else " Check your Groq Console Limits page for the reset time."
    error = GroqClassificationError(
        f"Groq rate limit reached for model '{GROQ_MODEL}'. {provider_message}{retry_hint}"
    )
    return error, retry_after


def _call_groq(
    messages: list,
    *,
    temperature: float = 0.2,
    json_mode: bool = False,
    timeout: float = 60,
    max_completion_tokens: int = 2048,
):

    if not GROQ_API_KEY:
        raise GroqClassificationError("GROQ_API_KEY is not configured.")

    payload = {
        "model": GROQ_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_completion_tokens": max_completion_tokens,
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

    for attempt in range(2):

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
            last_error, retry_after = _rate_limit_error(response)
            # Honor Groq's retry instruction for short limits. A longer reset is
            # reported to the user instead of keeping a background worker stuck.
            if attempt == 0 and retry_after is not None and 0 < retry_after <= 30:
                # Add a small margin so the second request is not sent before
                # Groq has actually restored the token budget.
                time.sleep(retry_after + 0.5)
                continue
            break

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
        f"Groq request could not be completed.\n{last_error}"
    )


def generate(
    prompt: str,
    *,
    system_instruction: str | None = None,
    json_mode: bool = False,
    temperature: float = 0.2,
    timeout: float = 60,
    max_completion_tokens: int = 2048,
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
        max_completion_tokens=max_completion_tokens,
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
    max_completion_tokens: int = 2048,
):
    """
    Generate JSON.
    """

    raw = generate(
        prompt,
        system_instruction=system_instruction,
        json_mode=True,
        temperature=temperature,
        max_completion_tokens=max_completion_tokens,
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
