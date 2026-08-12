"""
The one place the application talks to a language model.

Two providers, chosen by configuration rather than by code:

  bedrock    AWS Bedrock via the Mantle client. No API key — the App Runner
             instance role carries bedrock:InvokeModel, so there is no
             long-lived secret to leak or rotate. Requires model access to
             have been granted in the Bedrock console first.
  anthropic  The Anthropic API directly, with ANTHROPIC_API_KEY.

Absent or misconfigured is a supported state, not an error: complete()
returns None and every caller shows its documented fallback message. The
handoff's rule stands — an AI failure never blocks a clinical workflow.
"""

from __future__ import annotations

import logging

from .config import get_settings

log = logging.getLogger(__name__)

Turn = dict[str, str]

_client = None
_model: str | None = None
_configured = False


def _configure() -> None:
    """Build the client once, on first use. Never raises."""
    global _client, _model, _configured
    if _configured:
        return
    _configured = True

    settings = get_settings()
    provider = settings.ai_provider.lower()

    try:
        if provider == "bedrock":
            from anthropic import AnthropicBedrockMantle

            _client = AnthropicBedrockMantle(aws_region=settings.aws_region)
            # Bedrock model ids carry an "anthropic." prefix.
            _model = settings.bedrock_model_id
        elif provider == "anthropic" and settings.anthropic_api_key:
            from anthropic import Anthropic

            _client = Anthropic(api_key=settings.anthropic_api_key)
            _model = settings.anthropic_model
        else:
            log.info("No AI provider configured; AI features will use fallbacks.")
    except Exception:
        log.exception("Could not build the AI client; falling back.")
        _client = None


async def complete(system: str, prompt: str | list[Turn], max_tokens: int = 700) -> str | None:
    """
    One completion, or None.

    None covers every failure — no provider, no model access, a network
    problem, a refusal. The caller does not need to distinguish them; it
    shows its fallback message and the manual path continues.
    """
    _configure()
    if _client is None or _model is None:
        return None

    messages = (
        [{"role": "user", "content": prompt}]
        if isinstance(prompt, str)
        else [{"role": t["role"], "content": t["content"]} for t in prompt]
    )

    try:
        response = _client.messages.create(
            model=_model, max_tokens=max_tokens, system=system, messages=messages
        )
        return next((b.text for b in response.content if b.type == "text"), None)
    except Exception as exc:
        # Logged, never raised. A clinician waiting on a lab result should
        # not see a stack trace because Bedrock was throttled.
        log.warning("AI completion failed (%s): %s", type(exc).__name__, exc)
        return None


def provider_status() -> dict[str, object]:
    """For /health — lets an examiner see which provider is live."""
    _configure()
    return {
        "provider": get_settings().ai_provider if _client else "none",
        "model": _model,
        "available": _client is not None,
    }
