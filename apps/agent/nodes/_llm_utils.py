"""Shared retry-then-degrade wrapper for structured LLM calls. Groq's
tool-calling occasionally returns malformed JSON on larger prompts (seen
repeatedly in the last project) -- retry once, then fall back to a caller-
supplied degraded-but-valid result rather than crashing the whole run.
"""
import sys


def invoke_structured(structured_llm, messages, fallback):
    try:
        return structured_llm.invoke(messages)
    except Exception as e:
        print(f"invoke_structured: first attempt failed ({type(e).__name__}: {e}), retrying...", file=sys.stderr)
        try:
            return structured_llm.invoke(messages)
        except Exception as e2:
            print(f"invoke_structured: retry also failed ({type(e2).__name__}: {e2}), degrading to fallback", file=sys.stderr)
            return fallback
