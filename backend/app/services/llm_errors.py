CREDITS_MESSAGE = (
    "Your OpenRouter credits are exhausted. "
    "Add funds at openrouter.ai/settings/credits to continue."
)

_PAYMENT_KEYWORDS = (
    "402", "payment required", "insufficient credits",
    "insufficient_credits", "not enough credits",
    "payment_required", "insufficient balance",
    "negative balance", "credit limit",
)


def friendly_llm_error(e: Exception) -> str:
    msg = str(e).lower()
    for kw in _PAYMENT_KEYWORDS:
        if kw in msg:
            return CREDITS_MESSAGE
    return str(e)
