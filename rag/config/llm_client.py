"""
config/llm_client.py

Provider-agnostic LLM client used by the agentic nodes.

Supported providers:
    - openai
    - anthropic
    - gemini
    - ollama (local, no API key required)

Public API:
    - structured_call()
    - plain_call()

The calling nodes do not need to know which provider is being used.
The provider is selected through config.settings.settings.llm_provider.
"""

from __future__ import annotations

import json
from typing import Type, TypeVar

from pydantic import BaseModel

from config.settings import settings


T = TypeVar("T", bound=BaseModel)


class LLMClientError(RuntimeError):
    """Raised when the configured LLM provider call fails or is misconfigured."""


# ---------------------------------------------------------------------------
# Structured call
# ---------------------------------------------------------------------------

def structured_call(
    system_prompt: str,
    user_message: str,
    response_model: Type[T],
    model: str | None = None,
) -> T:
    """
    Call the configured LLM provider and return a validated Pydantic model.

    Parameters
    ----------
    system_prompt:
        System-level instructions.

    user_message:
        User/query content.

    response_model:
        Pydantic model describing the expected structured response.

    model:
        Optional model override. If omitted, settings.llm_model is used.

    Returns
    -------
    T
        Validated instance of response_model.

    Raises
    ------
    LLMClientError
        If the API key is missing, provider is unsupported,
        provider call fails, or the response cannot be validated.
    """

    provider = settings.llm_provider.strip().lower()
    model_name = model or settings.llm_model

    if not settings.llm_api_key and provider != "ollama":
        raise LLMClientError(
            "LLM_API_KEY is not set. Configure it in .env before "
            "calling structured_call()."
        )

    if provider == "openai":
        return _call_openai(
            system_prompt=system_prompt,
            user_message=user_message,
            response_model=response_model,
            model_name=model_name,
        )

    if provider == "anthropic":
        return _call_anthropic(
            system_prompt=system_prompt,
            user_message=user_message,
            response_model=response_model,
            model_name=model_name,
        )

    if provider == "gemini":
        return _call_gemini(
            system_prompt=system_prompt,
            user_message=user_message,
            response_model=response_model,
            model_name=model_name,
        )

    if provider == "ollama":
        return _call_ollama(
            system_prompt=system_prompt,
            user_message=user_message,
            response_model=response_model,
            model_name=model_name,
        )

    raise LLMClientError(
        f"Unknown LLM_PROVIDER: {settings.llm_provider!r}. "
        "Supported providers: openai, anthropic, gemini, ollama."
    )


# ---------------------------------------------------------------------------
# OpenAI
# ---------------------------------------------------------------------------

def _call_openai(
    system_prompt: str,
    user_message: str,
    response_model: Type[T],
    model_name: str,
) -> T:
    """Call OpenAI with JSON-schema structured output."""

    try:
        from openai import OpenAI
    except ImportError as exc:
        raise LLMClientError(
            "openai package is not installed. "
            "Run: pip install openai"
        ) from exc

    try:
        client = OpenAI(api_key=settings.llm_api_key)

        schema = response_model.model_json_schema()

        completion = client.chat.completions.create(
            model=model_name,
            messages=[
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": user_message,
                },
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": response_model.__name__,
                    "schema": schema,
                    "strict": False,
                },
            },
        )

        raw = completion.choices[0].message.content

        if not raw:
            raise LLMClientError(
                "OpenAI returned an empty structured response."
            )

        return response_model.model_validate(json.loads(raw))

    except LLMClientError:
        raise

    except Exception as exc:
        raise LLMClientError(
            f"OpenAI structured call failed: {exc}"
        ) from exc


# ---------------------------------------------------------------------------
# Anthropic
# ---------------------------------------------------------------------------

def _call_anthropic(
    system_prompt: str,
    user_message: str,
    response_model: Type[T],
    model_name: str,
) -> T:
    """Call Anthropic using tool-based structured output."""

    try:
        import anthropic
    except ImportError as exc:
        raise LLMClientError(
            "anthropic package is not installed. "
            "Run: pip install anthropic"
        ) from exc

    try:
        client = anthropic.Anthropic(
            api_key=settings.llm_api_key
        )

        schema = response_model.model_json_schema()

        tool = {
            "name": "emit_structured_output",
            "description": (
                f"Emit the result as {response_model.__name__}."
            ),
            "input_schema": schema,
        }

        message = client.messages.create(
            model=model_name,
            max_tokens=1024,
            system=system_prompt,
            messages=[
                {
                    "role": "user",
                    "content": user_message,
                }
            ],
            tools=[tool],
            tool_choice={
                "type": "tool",
                "name": "emit_structured_output",
            },
        )

        for block in message.content:
            if block.type == "tool_use":
                return response_model.model_validate(
                    block.input
                )

        raise LLMClientError(
            "No tool_use block returned by Anthropic response."
        )

    except LLMClientError:
        raise

    except Exception as exc:
        raise LLMClientError(
            f"Anthropic structured call failed: {exc}"
        ) from exc


# ---------------------------------------------------------------------------
# Gemini
# ---------------------------------------------------------------------------

def _call_gemini(
    system_prompt: str,
    user_message: str,
    response_model: Type[T],
    model_name: str,
) -> T:
    """
    Call Gemini using the official google-genai SDK.

    Gemini structured output is configured with:
        response_mime_type = application/json
        response_schema    = Pydantic model

    The returned response is then validated again through Pydantic.
    """

    try:
        from google import genai
        from google.genai import types
    except ImportError as exc:
        raise LLMClientError(
            "google-genai package is not installed. "
            "Run: pip install google-genai"
        ) from exc

    try:
        client = genai.Client(
            api_key=settings.llm_api_key
        )

        # Combine system instructions and user message.
        prompt = (
            f"{system_prompt}\n\n"
            "USER REQUEST:\n"
            f"{user_message}"
        )

        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=response_model,
            ),
        )

        # The current Google GenAI SDK can expose parsed structured output.
        parsed = getattr(response, "parsed", None)

        if parsed is not None:
            if isinstance(parsed, response_model):
                return parsed

            return response_model.model_validate(parsed)

        # Fallback: validate the raw JSON response.
        raw = getattr(response, "text", None)

        if not raw:
            raise LLMClientError(
                "Gemini returned an empty structured response."
            )

        return response_model.model_validate_json(raw)

    except LLMClientError:
        raise

    except Exception as exc:
        raise LLMClientError(
            f"Gemini structured call failed: {exc}"
        ) from exc


# ---------------------------------------------------------------------------
# Ollama (local)
# ---------------------------------------------------------------------------

def _call_ollama(
    system_prompt: str,
    user_message: str,
    response_model: Type[T],
    model_name: str,
) -> T:
    """
    Call a local Ollama server using its native structured-outputs
    support: POST /api/chat with `format` set to the target JSON
    schema (https://ollama.com/blog/structured-outputs). This talks
    to Ollama's own API directly rather than through its OpenAI-
    compatibility shim -- more reliable schema adherence for small
    local models like Qwen2.5-3B-Instruct, and one less layer to
    debug when something goes wrong.
    """

    try:
        import httpx
    except ImportError as exc:
        raise LLMClientError(
            "httpx package is not installed. Run: pip install httpx"
        ) from exc

    schema = response_model.model_json_schema()
    url = f"{settings.ollama_base_url.rstrip('/')}/api/chat"

    try:
        response = httpx.post(
            url,
            json={
                "model": model_name,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                "format": schema,
                "stream": False,
                "options": {"temperature": 0},
            },
            timeout=120,
        )
        response.raise_for_status()
        content = response.json().get("message", {}).get("content", "")

        if not content:
            raise LLMClientError("Ollama returned an empty structured response.")

        return response_model.model_validate_json(content)

    except LLMClientError:
        raise

    except httpx.ConnectError as exc:
        raise LLMClientError(
            f"Could not reach Ollama at {settings.ollama_base_url}. "
            f"Is `ollama serve` running, and has `ollama pull {model_name}` "
            "been run?"
        ) from exc

    except Exception as exc:
        raise LLMClientError(
            f"Ollama structured call failed: {exc}"
        ) from exc


# ---------------------------------------------------------------------------
# Plain text call
# ---------------------------------------------------------------------------

def plain_call(
    system_prompt: str,
    user_message: str,
    model: str | None = None,
) -> str:
    """
    Free-text completion.

    Used by nodes such as generate_answer where the expected
    result is normal natural-language text rather than a Pydantic model.
    """

    provider = settings.llm_provider.strip().lower()
    model_name = model or settings.llm_model

    if not settings.llm_api_key and provider != "ollama":
        raise LLMClientError(
            "LLM_API_KEY is not set. Configure it in .env before "
            "calling plain_call()."
        )

    if provider == "openai":
        return _plain_openai(
            system_prompt,
            user_message,
            model_name,
        )

    if provider == "anthropic":
        return _plain_anthropic(
            system_prompt,
            user_message,
            model_name,
        )

    if provider == "gemini":
        return _plain_gemini(
            system_prompt,
            user_message,
            model_name,
        )

    if provider == "ollama":
        return _plain_ollama(
            system_prompt,
            user_message,
            model_name,
        )

    raise LLMClientError(
        f"Unknown LLM_PROVIDER: {settings.llm_provider!r}. "
        "Supported providers: openai, anthropic, gemini, ollama."
    )


# ---------------------------------------------------------------------------
# OpenAI plain text
# ---------------------------------------------------------------------------

def _plain_openai(
    system_prompt: str,
    user_message: str,
    model_name: str,
) -> str:
    """Free-text completion with OpenAI."""

    try:
        from openai import OpenAI
    except ImportError as exc:
        raise LLMClientError(
            "openai package is not installed. "
            "Run: pip install openai"
        ) from exc

    try:
        client = OpenAI(
            api_key=settings.llm_api_key
        )

        completion = client.chat.completions.create(
            model=model_name,
            messages=[
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": user_message,
                },
            ],
        )

        return completion.choices[0].message.content or ""

    except Exception as exc:
        raise LLMClientError(
            f"OpenAI plain call failed: {exc}"
        ) from exc


# ---------------------------------------------------------------------------
# Anthropic plain text
# ---------------------------------------------------------------------------

def _plain_anthropic(
    system_prompt: str,
    user_message: str,
    model_name: str,
) -> str:
    """Free-text completion with Anthropic."""

    try:
        import anthropic
    except ImportError as exc:
        raise LLMClientError(
            "anthropic package is not installed. "
            "Run: pip install anthropic"
        ) from exc

    try:
        client = anthropic.Anthropic(
            api_key=settings.llm_api_key
        )

        message = client.messages.create(
            model=model_name,
            max_tokens=1024,
            system=system_prompt,
            messages=[
                {
                    "role": "user",
                    "content": user_message,
                }
            ],
        )

        return "".join(
            block.text
            for block in message.content
            if block.type == "text"
        )

    except Exception as exc:
        raise LLMClientError(
            f"Anthropic plain call failed: {exc}"
        ) from exc


# ---------------------------------------------------------------------------
# Gemini plain text
# ---------------------------------------------------------------------------

def _plain_gemini(
    system_prompt: str,
    user_message: str,
    model_name: str,
) -> str:
    """Free-text completion with Gemini."""

    try:
        from google import genai
    except ImportError as exc:
        raise LLMClientError(
            "google-genai package is not installed. "
            "Run: pip install google-genai"
        ) from exc

    try:
        client = genai.Client(
            api_key=settings.llm_api_key
        )

        prompt = (
            f"{system_prompt}\n\n"
            "USER REQUEST:\n"
            f"{user_message}"
        )

        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
        )

        return getattr(response, "text", "") or ""

    except Exception as exc:
        raise LLMClientError(
            f"Gemini plain call failed: {exc}"
        ) from exc


# ---------------------------------------------------------------------------
# Ollama plain text
# ---------------------------------------------------------------------------

def _plain_ollama(
    system_prompt: str,
    user_message: str,
    model_name: str,
) -> str:
    """Free-text completion with a local Ollama server."""

    try:
        import httpx
    except ImportError as exc:
        raise LLMClientError(
            "httpx package is not installed. Run: pip install httpx"
        ) from exc

    url = f"{settings.ollama_base_url.rstrip('/')}/api/chat"

    try:
        response = httpx.post(
            url,
            json={
                "model": model_name,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                "stream": False,
            },
            timeout=120,
        )
        response.raise_for_status()
        return response.json().get("message", {}).get("content", "") or ""

    except httpx.ConnectError as exc:
        raise LLMClientError(
            f"Could not reach Ollama at {settings.ollama_base_url}. "
            f"Is `ollama serve` running, and has `ollama pull {model_name}` "
            "been run?"
        ) from exc

    except Exception as exc:
        raise LLMClientError(
            f"Ollama plain call failed: {exc}"
        ) from exc