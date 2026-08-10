"""Complexity level guides shared by LLM service prompts.

Three levels control the depth and tone of generated legal outputs:
- intro: plain language, defined terms, black-letter rules only
- standard: current balanced behavior (the default)
- advanced: policy debate, nuance, dissent/concurrence analysis

Levels are normalized so unknown or missing values fall back to "standard",
keeping the API backward compatible.
"""

VALID_LEVELS = ("intro", "standard", "advanced")

COMPLEXITY_LABELS = {
    "intro": "Introductory",
    "standard": "Standard",
    "advanced": "Advanced",
}

COMPLEXITY_GUIDES = {
    "intro": (
        "\n\nComplexity Level: INTRODUCTORY\n"
        "- Use plain, approachable language appropriate for a first-year law student\n"
        "- Define any legal terms or doctrines the first time they appear\n"
        "- Focus on the black-letter rule and the essential takeaways\n"
        "- Keep paragraphs short and examples concrete\n"
        "- Avoid nuance that would confuse a reader meeting the topic for the first time"
    ),
    "standard": (
        "\n\nComplexity Level: STANDARD\n"
        "- Use clear professional language appropriate for law students\n"
        "- Explain the rule, its application, and key exceptions\n"
        "- Balance completeness with readability\n"
        "- Use standard legal terminology without over-simplifying"
    ),
    "advanced": (
        "\n\nComplexity Level: ADVANCED\n"
        "- Assume a reader with strong legal background; use precise doctrinal terminology\n"
        "- Analyze nuance: competing interpretations, policy considerations, and counterarguments\n"
        "- Examine concurring and dissenting views in depth, not just in passing\n"
        "- Connect the doctrine to related areas of law and its development over time\n"
        "- Identify weaknesses, open questions, and how courts might apply the rule in novel facts\n"
        "- Aim for exam-style depth suitable for advanced students or practitioners-in-training"
    ),
}


def normalize_complexity(complexity: str | None) -> str:
    """Return a valid level, falling back to 'standard' for missing/unknown values."""
    if complexity in VALID_LEVELS:
        return complexity
    return "standard"


def complexity_guide(complexity: str | None) -> str:
    """Return the prompt guide text for a level, 'standard' when unknown."""
    return COMPLEXITY_GUIDES[normalize_complexity(complexity)]
