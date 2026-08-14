"""Shared retry-then-degrade wrapper for structured LLM calls. Groq's
tool-calling occasionally returns malformed JSON on larger prompts (seen
repeatedly in the last project) -- retry once, then fall back to a caller-
supplied degraded-but-valid result rather than crashing the whole run.
"""


def invoke_structured(structured_llm, messages, fallback):
    try:
        return structured_llm.invoke(messages)
    except Exception:
        try:
            return structured_llm.invoke(messages)
        except Exception:
            return fallback
