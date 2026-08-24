"""Deterministic multiple-choice questions built from the curated tutor bank.

The free tier of the MC Quiz: every question is assembled locally from the
260 vetted TutorQuestion cards — no LLM call, no cost, no hallucination risk.

Design:
- The stem is a curated card's question (never repeated within one session).
- The correct option is the opening sentence of that card's vetted answer.
- Distractors are opening sentences of OTHER cards' answers from the same
  topic (same/adjacent difficulty preferred), so wrong choices are real,
  well-written legal statements about adjacent concepts — exactly the
  "they all sound right" discrimination that multiple choice should test.
- After answering, each option is explained by pointing back at the concept
  it actually belongs to.
"""

import random

from app.models.tutor import MCQuestion
from app.services.tutor_data import TOPICS

# The free run is longer than the AI quiz (5) because it costs nothing.
OFFLINE_MC_QUESTIONS = 10

# Cap on an option's length so no answer choice towers over the others.
_MAX_OPTION_LEN = 240


# Tokens whose trailing period does not end a sentence.
_ABBREVIATIONS = {"e.g", "i.e", "etc", "vs", "v", "cf", "no", "art", "sec"}


def _token_before(text: str, end: int) -> str:
    """Word (or initialism, dots included) ending just before index `end`."""
    j = end - 1
    while j >= 0 and (text[j].isalnum() or text[j] == "."):
        j -= 1
    return text[j + 1:end]


def _first_sentence(text: str) -> str:
    """Opening sentence of a curated answer, capped at a readable length."""
    clean = (text or "").strip()
    if not clean:
        return ""
    # A real sentence boundary is ".!?" + whitespace + a capital, EXCEPT when
    # the preceding token looks like an abbreviation: "U.S.", "e.g.", a
    # person's initial, etc. Getting this wrong just makes the option a bit
    # long (then length-capped), never factually wrong.
    for i in range(1, len(clean) - 1):
        if clean[i] not in ".!?":
            continue
        if not clean[i + 1].isspace():
            continue
        if i + 2 < len(clean) and not clean[i + 2].isupper():
            continue
        token = _token_before(clean, i)
        if token and (token[-1].isupper() or token.casefold() in _ABBREVIATIONS):
            continue
        sentence = clean[:i + 1].strip()
        break
    else:
        sentence = clean
    if len(sentence) > _MAX_OPTION_LEN:
        trimmed = sentence[:_MAX_OPTION_LEN].rsplit(" ", 1)[0]
        sentence = trimmed + "…"
    return sentence


def _distractor_pool(topic_id: str, source_card, exclude_sentences: set[str]) -> list[tuple[str, str]]:
    """(sentence, source_question) candidates from the same topic.

    Cards within ±1 difficulty of the source come first so distractors feel
    level-appropriate; anything else in the topic follows as fallback.
    """
    pool = [
        q for q in TOPICS[topic_id]["questions"]
        if q.question != source_card.question
    ]
    near = [q for q in pool if abs((q.difficulty or 0) - (source_card.difficulty or 0)) <= 1]
    far = [q for q in pool if q not in near]
    ordered = near + far

    results: list[tuple[str, str]] = []
    seen = set(exclude_sentences)
    for candidate in ordered:
        sentence = _first_sentence(candidate.answer)
        key = sentence.casefold().strip()
        if not sentence or key in seen:
            continue
        seen.add(key)
        results.append((sentence, candidate.question))
    return results


def build_question(topic_id: str, used_stems: set[str]) -> tuple[MCQuestion, str]:
    """Assemble one offline MC question.

    Returns ``(question, stem)`` — the caller records ``stem`` so a single
    session never serves the same card twice. Raises ValueError only if the
    whole unused bank is exhausted (impossible at 10-of-20 per session).
    """
    if topic_id not in TOPICS:
        raise ValueError(f"Unknown topic: {topic_id}")

    bank = TOPICS[topic_id]["questions"]
    available = [q for q in bank if q.question not in used_stems]
    if not available:
        raise ValueError(f"No unused questions left in topic: {topic_id}")
    card = random.choice(available)

    correct = _first_sentence(card.answer)
    pool = _distractor_pool(topic_id, card, exclude_sentences={correct.casefold()})
    if len(pool) < 3:
        # Every curated topic holds 20 cards so this never fires today;
        # kept as a safety net if banks shrink.
        raise ValueError(f"Not enough distinct cards to build distractors in topic: {topic_id}")
    # Sample from the difficulty-nearest eight so wrong choices stay
    # level-appropriate while the pick varies between sessions.
    distractors = random.sample(pool[:8], k=3)

    entries = [(correct, None)] + distractors
    random.shuffle(entries)

    options: list[str] = []
    explanations: list[str] = []
    correct_index = 0
    concepts_note = ""
    if card.expected_concepts:
        concepts_note = " Key concepts: " + ", ".join(card.expected_concepts) + "."
    for i, (sentence, source_question) in enumerate(entries):
        options.append(sentence)
        if source_question is None:
            correct_index = i
            explanations.append(f"Correct.{concepts_note}")
        else:
            explanations.append(
                f"Incorrect — this statement belongs to a different concept: \"{source_question}\""
            )

    question = MCQuestion(
        question=card.question,
        options=options,
        correct_index=correct_index,
        explanation=(card.answer or "").strip(),
        option_explanations=explanations,
        difficulty=card.difficulty or 1,
    )
    return question, card.question
