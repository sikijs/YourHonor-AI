"""Leitner-box spaced repetition for tutor review cards.

Each card sits in one of five boxes. A "Got it" mark promotes the card one
box and pushes its due date out by that box's interval; a "Need to Study"
mark drops it back to box 1, due tomorrow. Passing the review while in the
final box graduates the card entirely (got_it = 1): it leaves the rotation
and counts as mastered on the dashboard.

Pure date arithmetic — no LLM, no Qdrant — so scheduling is instant,
deterministic, and free.
"""

from datetime import datetime, timedelta, timezone

# Days until a card is due again, indexed by box (box 1 .. MAX_BOX).
LEITNER_INTERVALS_DAYS = [1, 3, 7, 14, 30]
MAX_BOX = len(LEITNER_INTERVALS_DAYS)

# SQLite CURRENT_TIMESTAMP format ("YYYY-MM-DD HH:MM:SS", UTC) so string
# comparisons in queries behave like real date comparisons.
_TS_FORMAT = "%Y-%m-%d %H:%M:%S"


def _due_timestamp(days_ahead: int) -> str:
    dt = datetime.now(timezone.utc) + timedelta(days=days_ahead)
    return dt.strftime(_TS_FORMAT)


def schedule_mark(got_it: bool, current_box: int) -> tuple[int, int, str | None]:
    """Apply one self-assessment to a card.

    Returns ``(new_got_it, new_box_level, next_due)`` where ``next_due`` is a
    UTC timestamp string or ``None`` once the card has graduated.

    - Fail: back to box 1, due tomorrow.
    - Pass below the top box: up one box, due after that box's interval.
    - Pass at the top box: graduate — mastered forever, never due again.
    """
    current_box = max(1, min(current_box or 1, MAX_BOX))
    if not got_it:
        return 0, 1, _due_timestamp(LEITNER_INTERVALS_DAYS[0])
    if current_box >= MAX_BOX:
        return 1, MAX_BOX, None
    new_box = current_box + 1
    return 0, new_box, _due_timestamp(LEITNER_INTERVALS_DAYS[new_box - 1])
