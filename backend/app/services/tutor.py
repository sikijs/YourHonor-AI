from __future__ import annotations
import os
import logging
import random
import re
from typing import Optional

from litellm import completion
from app.models.tutor import (
    TutorQuestion, TutorStartResponse, TutorAnswerResponse,
    GeneratedEvaluation, GeneratedQuestion,
    MCQuestion, MCStartResponse, MCAnswerResponse,
)
from app.models.legal_glossary import CurriculumCard
from app.services.retrieval import (
    parse_llm_json,
    retrieve_curriculum,
    curriculum_card_from_payload,
)
from app.services.llm_errors import friendly_llm_error
from app.services import mc_bank
from app.services.spaced_repetition import MAX_BOX, schedule_mark
from app.services.tutor_data import TOPICS
from app import db

logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL = "openrouter/qwen/qwen3-14b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}

# Max wrong/partial attempts per question before the correct answer is revealed
# and the session moves on. A fully correct answer always advances immediately.
MAX_ATTEMPTS_PER_QUESTION = 3

# Questions served per Quiz/Review session. Each topic's curated bank holds
# 20 cards; every session draws a fresh random 10 so students never settle
# into a fixed routine and the whole bank still gets coverage over time.
QUESTIONS_PER_SESSION = 10


class TutorSession:
    def __init__(self, topic_id: str):
        self.topic_id = topic_id
        self.topic_data = TOPICS.get(topic_id)
        bank = self.topic_data["questions"]
        self.questions = random.sample(bank, min(QUESTIONS_PER_SESSION, len(bank)))
        self.current_index = 0
        self.correct_count = 0
        self.wrong_count = 0
        self.attempts_on_question = 0
        self.current_question_text = ""  # text of the question currently being answered (original or follow-up)
        self.history: list[dict] = []
        self.covered_concepts: set[str] = set()
        self.dynamic_used = False


class TutorService:
    def __init__(self):
        self._sessions: dict[int, TutorSession] = {}
        self._mc_sessions: dict[int, MCQuizSession] = {}

    def _persist_session(
        self, user_id: int, topic_id: str, mode: str,
        correct_count: int, wrong_count: int, total_questions: int,
    ) -> None:
        """Persist a completed tutor session for the study dashboard.

        Live-session counters live in memory; this row is the durable
        record written once when the session finishes. Failures are logged
        and swallowed so a DB hiccup never breaks the tutor flow.
        """
        try:
            conn = db.get_db()
            try:
                conn.execute(
                    """
                    INSERT INTO tutor_sessions
                        (user_id, topic_id, mode, correct_count, wrong_count, total_questions)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (user_id, topic_id, mode, correct_count, wrong_count, total_questions),
                )
                conn.commit()
            finally:
                conn.close()
        except Exception as e:
            logger.error(f"Failed to persist tutor session for user {user_id}: {e}")

    def get_topics(self) -> list[dict]:
        return [
            {"id": tid, "name": t["name"], "description": t["description"], "question_count": len(t["questions"])}
            for tid, t in TOPICS.items()
        ]

    def start_session(self, topic_id: str, user_id: int) -> TutorStartResponse:
        if topic_id not in TOPICS:
            raise ValueError(f"Unknown topic: {topic_id}")
        session = TutorSession(topic_id)
        self._sessions[user_id] = session
        q = session.questions[0]
        session.current_question_text = q.question
        return TutorStartResponse(
            topic_id=topic_id,
            topic_name=session.topic_data["name"],
            topic_description=session.topic_data["description"],
            total_questions=len(session.questions),
            current_question=q,
            current_index=0,
            questions=session.questions,
        )

    def start_dynamic_session(self, topic_id: str, user_id: int) -> TutorStartResponse:
        if topic_id not in TOPICS:
            raise ValueError(f"Unknown topic: {topic_id}")
        session = TutorSession(topic_id)
        session.questions = []
        new_q = self._generate_dynamic_question(session)
        session.questions.append(new_q)
        session.current_question_text = new_q.question
        self._sessions[user_id] = session
        session.dynamic_used = True
        return TutorStartResponse(
            topic_id=topic_id,
            topic_name=session.topic_data["name"],
            topic_description=session.topic_data["description"],
            total_questions=len(session.questions),
            current_question=new_q,
            current_index=0,
            questions=session.questions,
        )

    def submit_answer(self, answer: str, user_id: int) -> TutorAnswerResponse:
        session = self._sessions.get(user_id)
        if not session:
            raise ValueError("No active tutoring session. Start one first.")

        q = session.questions[session.current_index]
        session.attempts_on_question += 1

        attempts_exceeded = False
        correct_answer_revealed = None
        eval_result = None

        system_prompt = """You are a law school tutor using the Socratic method. Evaluate the student's answer and provide constructive feedback.

For each answer:
1. EVALUATION: Classify as "correct", "partially_correct", or "incorrect"
2. EXPLANATION: Explain what the student got right and what they missed. Reference the expected concepts.
3. FOLLOW-UP: If the student needs more help, generate a simpler follow-up question on the same concept. If they answered well, generate a more advanced follow-up on the same concept.
4. COMPLETE: Set to true only when the student has demonstrated sufficient understanding of the current concept.
5. MISSED_CONCEPTS: List exactly which expected concepts the answer failed to demonstrate or misstated. Empty list only if every expected concept was demonstrated.

What counts as a correct answer:
- "correct" requires the student to EXPLAIN each expected concept in their own words — define it, and apply it where the question asks for application. Merely naming a concept does not demonstrate it.
- If the answer is only a bare list of keywords or concept names with no explanation, classify as "partially_correct" at best, never "correct".
- Structure expectation: at difficulty 1-2, clear complete sentences that name and explain each concept are enough. At difficulty 3+, the answer should also briefly apply the concepts (state the rule, then apply it), e.g. a mini IRAC-style structure.
- The grading rubric is: coverage of expected concepts, accuracy of legal rules, and quality of explanation/application.

Follow-up hint requirements:
- FOLLOW_UP_HINT must be an ELABORATE hint: 2-4 sentences of step-by-step guidance that steers the student's thinking (what to consider first, which distinction to draw, how to structure the answer).
- It must NEVER name any expected concept verbatim or list the expected concepts. Guide toward the reasoning, not the answer.
- If the student needs no hint, you may still provide a brief encouraging nudge.

Follow-up answer requirement:
- FOLLOW_UP_ANSWER must be a 2-4 sentence educative answer to the follow-up question: answer it directly, define the expected concepts in plain language, and include one concrete example. This is shown to the student on a flashcard, so it must stand alone without the original question's context. Always provide it when you generate a FOLLOW_UP_QUESTION.

Guidelines:
- Be encouraging but academically rigorous
- Use the Socratic method — ask probing questions rather than just lecturing
- If the answer is wrong, generate a SIMPLER VERSION of the SAME question — break it down into smaller parts. Do NOT switch to a different concept.
- If the answer is correct, build on it with a deeper question on the same concept
- Never fabricate legal rules or citations
- If the student admits they don't know or says "no idea", always classify as "incorrect" — do not treat it as correct"""

        user_prompt = f"""Topic: {session.topic_data['name']}
Question: {q.question}
Question difficulty: {q.difficulty}/5
Expected concepts: {', '.join(q.expected_concepts)}
Student's answer: {answer}

Evaluate this answer and provide a follow-up or determine if the student has mastered this concept."""

        reference_block = self._reference_block(session, q)
        if reference_block:
            user_prompt += reference_block

        if eval_result is None:
            try:
                response = completion(
                    model=MODEL,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    response_format=GeneratedEvaluation,
                    max_tokens=2000,
                    temperature=0.3,
                    reasoning_effort="low",
                    drop_params=True,
                    timeout=180,
                )

                raw = response.choices[0].message.content
                if raw is None:
                    raw = getattr(response.choices[0].message, "reasoning_content", None) or ""
                parsed = parse_llm_json(raw)
                eval_result = GeneratedEvaluation(**parsed)

            except Exception as e:
                msg = friendly_llm_error(e)
                logger.error(f"Tutor LLM call failed: {msg}")
                eval_result = GeneratedEvaluation(
                    evaluation="incorrect",
                    explanation="I couldn't evaluate your answer. Let's try a different approach.",
                    follow_up_question=None,
                    follow_up_hint=None,
                    is_complete=False,
                    missed_concepts=list(q.expected_concepts),
                )

        if session.attempts_on_question >= MAX_ATTEMPTS_PER_QUESTION and eval_result.evaluation != "correct":
            attempts_exceeded = True
            eval_result.is_complete = True
            eval_result.follow_up_question = None

            # Reveal the answer for the question the student was actually answering
            # (which may be a follow-up, not the original bank question).
            answered_question = session.current_question_text or q.question
            try:
                answer_response = completion(
                    model=MODEL,
                    messages=[
                        {"role": "system", "content": "You are a law professor. Give a concise, specific answer to the student's question."},
                        {"role": "user", "content": f"Question: {answered_question}\nExpected concepts: {', '.join(q.expected_concepts)}\n\nProvide the correct answer in 2-3 sentences explaining how these concepts apply to the question. Be specific and educational."},
                    ],
                    max_tokens=300,
                    temperature=0.3,
                    reasoning_effort="low",
                    drop_params=True,
                    timeout=180,
                )
                raw = answer_response.choices[0].message.content
                if raw is None:
                    raw = getattr(answer_response.choices[0].message, "reasoning_content", None) or ""
                if raw.strip():
                    concepts_str = "; ".join(q.expected_concepts) if q.expected_concepts else ""
                    concepts_line = f"\n\nKey concepts: {concepts_str}" if concepts_str else ""
                    correct_answer_revealed = raw.strip() + concepts_line
            except Exception as e:
                msg = friendly_llm_error(e)
                logger.error(f"Correct answer generation failed: {msg}")

            if not correct_answer_revealed:
                concepts = q.expected_concepts
                if len(concepts) == 0:
                    correct_answer_revealed = "Review the question and hint above, then try again with a new topic."
                elif len(concepts) == 1:
                    correct_answer_revealed = f"The expected concept was: {concepts[0]}."
                else:
                    formatted_lst = "; ".join(f"{i+1}. {c}" for i, c in enumerate(concepts))
                    correct_answer_revealed = f"The expected concepts were: {formatted_lst}."

            eval_result.explanation += (
                "  You've used all " + str(MAX_ATTEMPTS_PER_QUESTION) +
                " attempts for this question. The correct answer has been shown above. Let's move to the next question."
            )

        if eval_result.evaluation == "correct":
            session.correct_count += 1
        else:
            session.wrong_count += 1

        session.history.append({
            "question": session.current_question_text or q.question,
            "answer": answer,
            "evaluation": eval_result.evaluation,
            "explanation": eval_result.explanation,
        })

        # Advance to the next question ONLY when the student answered correctly
        # or has exhausted all attempts. Wrong/partial answers (even if the LLM
        # marks is_complete) keep the student on the same concept so the
        # attempt counter can actually reach the limit.
        next_question = None
        if attempts_exceeded or eval_result.evaluation == "correct":
            session.covered_concepts.update(q.expected_concepts)
            session.current_index += 1
            session.attempts_on_question = 0
            if session.current_index < len(session.questions):
                nq = session.questions[session.current_index]
                next_question = TutorQuestion(
                    question=nq.question,
                    hint=nq.hint,
                    deep_hint=nq.deep_hint,
                    expected_concepts=nq.expected_concepts,
                    difficulty=nq.difficulty,
                    answer=nq.answer,
                )
                session.current_question_text = next_question.question
        elif eval_result.follow_up_question:
            follow_up_difficulty = (
                q.difficulty + 1 if eval_result.evaluation == "correct"
                else max(1, q.difficulty - 1)
            )
            next_question = TutorQuestion(
                question=eval_result.follow_up_question,
                hint=eval_result.follow_up_hint or q.hint,
                deep_hint=eval_result.follow_up_hint or q.deep_hint,
                expected_concepts=q.expected_concepts,
                difficulty=follow_up_difficulty,
                answer=eval_result.follow_up_answer,
            )
            session.current_question_text = next_question.question
        else:
            # Fallback: LLM gave neither a follow-up nor completion. Keep the
            # student on the SAME question (no advance, no attempt reset) so
            # the attempt limit still triggers.
            next_question = TutorQuestion(
                question=session.current_question_text or q.question,
                hint=q.hint,
                deep_hint=q.deep_hint,
                expected_concepts=q.expected_concepts,
                difficulty=q.difficulty,
                answer=q.answer,
            )

        is_session_complete = session.current_index >= len(session.questions)

        if is_session_complete:
            total = len(session.questions)
            logger.info(f"User {user_id} completed topic '{session.topic_data['name']}' "
                        f"({session.correct_count}/{total} correct)")
            mode = "dynamic" if session.dynamic_used else "curriculum"
            self._persist_session(
                user_id, session.topic_id, mode,
                session.correct_count, session.wrong_count, total,
            )

        return TutorAnswerResponse(
            evaluation=eval_result.evaluation,
            explanation=eval_result.explanation,
            follow_up_question=next_question,
            current_index=session.current_index,
            total_questions=len(session.questions),
            is_complete=is_session_complete,
            correct_count=session.correct_count,
            wrong_count=session.wrong_count,
            attempts_exceeded=attempts_exceeded,
            correct_answer_revealed=correct_answer_revealed,
            attempts_used=session.attempts_on_question,
            max_attempts=MAX_ATTEMPTS_PER_QUESTION,
            missed_concepts=eval_result.missed_concepts,
        )

    def get_session_state(self, user_id: int) -> Optional[dict]:
        session = self._sessions.get(user_id)
        if not session:
            return None
        return {
            "topic_id": session.topic_id,
            "topic_name": session.topic_data["name"],
            "current_index": session.current_index,
            "total_questions": len(session.questions),
            "correct_count": session.correct_count,
            "wrong_count": session.wrong_count,
        }

    # ------------------------------------------------- cross-topic discovery

    def _card_from_payload(self, payload: Optional[dict]) -> Optional[CurriculumCard]:
        card = curriculum_card_from_payload(payload)
        if card is None:
            return None
        return CurriculumCard(**card)

    # ---------------------------------------------------- grounded evaluation

    def _reference_card(self, session: "TutorSession", q: TutorQuestion) -> Optional[CurriculumCard]:
        """Resolve the curated card that grounds evaluation of the current answer.

        Bank questions: the curated card is already in the session (question
        + expected concepts + vetted answer) — no Qdrant read needed.

        Follow-up and dynamically generated questions: retrieve the parent
        card semantically so the grader can anchor to the vetted answer
        instead of inventing one. Returns None when nothing is found (e.g.
        Qdrant down or empty), which leaves the prompt exactly as before.
        """
        if session.current_question_text == q.question:
            return CurriculumCard(
                question=q.question,
                answer=q.answer or "",
                topic_id=session.topic_id,
                topic_name=session.topic_data["name"],
                difficulty=q.difficulty,
                expected_concepts=q.expected_concepts,
            )
        try:
            results = retrieve_curriculum(
                query=session.current_question_text or q.question,
                top_k=3,
                min_score=0.0,
            )
            for r in results:
                card = self._card_from_payload(r.get("payload"))
                if card is not None:
                    return card
        except Exception as e:
            logger.warning(f"Reference card retrieval failed: {e}")
        return None

    def _reference_block(self, session: "TutorSession", q: TutorQuestion) -> str:
        """Reference material appended to the evaluation prompt (never shown).

        Anchors grading to the curated card's expected concepts and vetted
        answer so the LLM judges against the standard answer. The block is
        only ever part of the hidden evaluation prompt — it must not leak
        into any client-visible response field.
        """
        ref = self._reference_card(session, q)
        if ref is None:
            return ""
        concepts = ", ".join(ref.expected_concepts) if ref.expected_concepts else "(none listed)"
        return (
            "\n\nReference material (curated tutor card — hidden from the student; "
            "anchor your evaluation against it):\n"
            f"Question: {ref.question}\n"
            f"Expected concepts: {concepts}\n"
            f"Expected answer: {ref.answer}"
        )

    def get_related_concepts(
        self,
        question: str,
        exclude_topic: Optional[str] = None,
        top_k: int = 4,
    ) -> list[CurriculumCard]:
        """Find related curriculum cards from OTHER topics.

        Cross-topic links (e.g. a Contracts card surfacing Evidence cards)
        reward interdisciplinary study. Only other-topic cards are returned:
        the student is already looking at the current topic's cards, so
        same-topic results would just repeat what is on screen.
        """
        cards: list[CurriculumCard] = []
        seen: set[str] = set()
        try:
            # Fetch a wider pool than the final count: for a topic-specific
            # question the top matches are almost all same-topic cards, so
            # a small pool gets filtered empty by the exclude rule below.
            pool_size = max(top_k * 4, 16)
            results = retrieve_curriculum(query=question, top_k=pool_size, min_score=0.0)
            for r in results:
                card = self._card_from_payload(r.get("payload"))
                if card is None or card.question in seen:
                    continue
                if exclude_topic and card.topic_id == exclude_topic:
                    continue
                seen.add(card.question)
                cards.append(card)
                if len(cards) >= top_k:
                    break
        except Exception as e:
            logger.warning(f"Related concept retrieval failed: {e}")
        return cards

    # -------------------------------------------------- spaced repetition queue

    def _curriculum_card_for(self, topic_id: str, question: str) -> Optional[CurriculumCard]:
        """Resolve a stored (topic, question) pair back to its full card."""
        topic = TOPICS.get(topic_id)
        if not topic:
            return None
        for q in topic["questions"]:
            if q.question == question:
                return CurriculumCard(
                    question=q.question,
                    answer=q.answer or "",
                    topic_id=topic_id,
                    topic_name=topic["name"],
                    difficulty=q.difficulty,
                    expected_concepts=q.expected_concepts,
                )
        return None

    def mark_review(self, user_id: int, question: str, topic_id: str, got_it: bool) -> dict:
        """Record the student's self-assessment of one card.

        Stored in SQLite (review_progress) so marks survive page refreshes
        within the container's lifetime; upsert keeps one row per card.
        Scheduling is Leitner-based (see services/spaced_repetition.py):
        "Got it" promotes the card's box and pushes its due date out,
        "Need to Study" resets it to box 1 due tomorrow.
        """
        from app import db
        conn = db.get_db()
        try:
            row = conn.execute(
                "SELECT box_level FROM review_progress WHERE user_id = ? AND topic_id = ? AND question = ?",
                (user_id, topic_id, question),
            ).fetchone()
            new_got_it, new_box, next_due = schedule_mark(got_it, row["box_level"] if row else 1)
            conn.execute(
                """
                INSERT INTO review_progress (user_id, topic_id, question, got_it, box_level, next_due, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id, topic_id, question)
                DO UPDATE SET got_it = excluded.got_it, box_level = excluded.box_level,
                              next_due = excluded.next_due, updated_at = CURRENT_TIMESTAMP
                """,
                (user_id, topic_id, question, new_got_it, new_box, next_due),
            )
            conn.commit()
        finally:
            conn.close()
        return {
            "status": "ok",
            "question": question,
            "got_it": bool(new_got_it),
            "box_level": new_box,
            "graduated": new_got_it == 1,
            "max_box": MAX_BOX,
        }

    def get_review_queue(self, user_id: int, limit: int = 10, difficulty: Optional[int] = None) -> list[CurriculumCard]:
        """Cards in the spaced-repetition rotation, due ones first.

        Every card the student has not yet graduated (got_it = 0) is
        returned — nothing they flagged is dropped — but ordered so cards
        whose Leitner due date has passed come first (most overdue first),
        followed by scheduled cards by soonest due date. The `limit` only
        bounds the enrichment padding: when the student has fewer than
        `limit` rotation cards, the queue is extended with semantically
        similar cards retrieved over the weak cards' expected concepts so
        re-study covers related material. Deduplicated by question text.

        An optional `difficulty` (1-4) narrows both the weak cards and the
        enrichment to that exact curriculum level (None = everything).
        """
        from app import db
        conn = db.get_db()
        try:
            rows = conn.execute(
                """
                SELECT topic_id, question FROM review_progress
                WHERE user_id = ? AND got_it = 0
                ORDER BY (next_due <= CURRENT_TIMESTAMP) DESC, next_due ASC, updated_at DESC
                """,
                (user_id,),
            ).fetchall()
            mastered_rows = conn.execute(
                """
                SELECT question FROM review_progress
                WHERE user_id = ? AND got_it = 1
                """,
                (user_id,),
            ).fetchall()
        finally:
            conn.close()

        mastered: set[str] = {r["question"] for r in mastered_rows}
        seen: set[str] = set()
        cards: list[CurriculumCard] = []
        weak_concepts: list[str] = []
        for row in rows:
            question = row["question"]
            if not question or question in seen:
                continue
            seen.add(question)
            card = self._curriculum_card_for(row["topic_id"], question)
            if card is None:
                continue
            if difficulty is not None and card.difficulty != difficulty:
                continue
            cards.append(card)
            weak_concepts.extend(card.expected_concepts)

        if weak_concepts and len(cards) < limit:
            try:
                results = retrieve_curriculum(
                    query=" ".join(weak_concepts), top_k=limit, min_score=0.0
                )
                for r in results:
                    card = self._card_from_payload(r.get("payload"))
                    if card is None or card.question in seen:
                        continue
                    if card.question in mastered:
                        continue
                    if difficulty is not None and card.difficulty != difficulty:
                        continue
                    seen.add(card.question)
                    cards.append(card)
                    if len(cards) >= limit:
                        break
            except Exception as e:
                logger.warning(f"Review queue enrichment failed: {e}")

        return cards

    def get_due_count(self, user_id: int) -> int:
        """How many rotation cards have a Leitner due date in the past."""
        conn = db.get_db()
        try:
            row = conn.execute(
                """
                SELECT COUNT(*) AS count FROM review_progress
                WHERE user_id = ? AND got_it = 0
                  AND next_due IS NOT NULL AND next_due <= CURRENT_TIMESTAMP
                """,
                (user_id,),
            ).fetchone()
        finally:
            conn.close()
        return row["count"]

    def _next_difficulty(self, session: TutorSession) -> int:
        if len(session.questions) == 0:
            return 2
        avg = (session.correct_count + 1) / max(len(session.questions), 1)
        if avg > 0.8:
            return 4
        elif avg > 0.6:
            return 4
        elif avg > 0.4:
            return 3
        else:
            return 2

    def _curriculum_exemplars(self, topic_id: str, limit: int = 3) -> list[dict]:
        """Retrieve curated curriculum cards to ground dynamic generation.

        Prefers same-topic cards so generated questions stay stylistically
        consistent with the vetted material; falls back to cross-topic cards.
        Returns [] when Qdrant is unavailable or empty, so generation
        proceeds exactly as before (graceful degradation).
        """
        try:
            topic_name = TOPICS.get(topic_id, {}).get("name", "")
            results = retrieve_curriculum(
                query=topic_name, top_k=limit, min_score=0.0, topic=topic_id
            )
            if not results:
                results = retrieve_curriculum(query=topic_name, top_k=limit, min_score=0.0)
            return results
        except Exception as e:
            logger.warning(f"Curriculum exemplar retrieval failed: {e}")
            return []

    def _exemplar_block(self, topic_id: str, topic_name: str) -> str:
        """Format retrieved curriculum cards as prompt context for generation."""
        exemplars = self._curriculum_exemplars(topic_id)
        if not exemplars:
            return ""
        cards_text = [
            f"Example card {i} ({c.get('topic_name', topic_name)}):\n{c['content']}"
            for i, c in enumerate(exemplars, 1)
        ]
        return (
            "\n\nExisting curated study cards (use as a style/difficulty reference only — "
            "generate a NEW question that does not duplicate them):\n"
            + "\n\n".join(cards_text)
        )

    def _generate_dynamic_question(self, session: TutorSession) -> TutorQuestion:
        topic_name = session.topic_data["name"]
        difficulty = self._next_difficulty(session)
        covered = ', '.join(sorted(session.covered_concepts)) if session.covered_concepts else 'none yet'

        exemplar_block = self._exemplar_block(session.topic_id, topic_name)

        prompt = f"""You are a law professor teaching {topic_name}. A student has completed {len(session.questions)} questions with {session.correct_count} correct.

Generate a NEW question on {topic_name} at difficulty {difficulty}. Do NOT repeat any of these already-covered concepts: {covered}.
{exemplar_block}
Return valid JSON with these exact keys:
- "question": the question text
- "hint": a SHORT one-sentence nudge for a student's first attempt
- "deep_hint": an ELABORATE hint for a student retrying after a wrong answer: 2-4 sentences of step-by-step guidance (what to consider first, which distinction to draw, how to structure the answer). It must NEVER name any expected concept verbatim or list the expected concepts — guide toward the reasoning, not the answer.
- "answer": a 2-4 sentence educative answer to the question: answer it directly, define the expected concepts in plain language, and include one concrete example. This is shown on a flashcard, so it must stand alone.
- "expected_concepts": a list of 3-5 key concepts the answer should include
- "difficulty": {difficulty}"""

        try:
            response = completion(
                model=MODEL,
                messages=[
                    {"role": "system", "content": "You generate legal tutoring questions in JSON format."},
                    {"role": "user", "content": prompt},
                ],
                response_format=GeneratedQuestion,
                max_tokens=1000,
                temperature=0.7,
                reasoning_effort="low",
                drop_params=True,
            )
            raw = response.choices[0].message.content
            if raw is None:
                raw = getattr(response.choices[0].message, "reasoning_content", None) or ""
            parsed = GeneratedQuestion.model_validate(parse_llm_json(raw))
            return TutorQuestion(
                question=parsed.question,
                hint=parsed.hint,
                deep_hint=parsed.deep_hint,
                expected_concepts=parsed.expected_concepts,
                difficulty=parsed.difficulty,
                answer=parsed.answer,
            )
        except Exception as e:
            logger.error(f"Dynamic question generation failed: {e}")
            raise ValueError(friendly_llm_error(e))

    def continue_learning(self, user_id: int) -> TutorQuestion:
        session = self._sessions.get(user_id)
        if not session:
            raise ValueError("No active tutoring session. Start one first.")
        new_q = self._generate_dynamic_question(session)
        session.questions.append(new_q)
        session.current_question_text = new_q.question
        session.dynamic_used = True
        return new_q

    def generate_hypothetical(self, topic_id: str, difficulty: int) -> dict:
        if topic_id not in TOPICS:
            raise ValueError(f"Unknown topic: {topic_id}")
        topic_data = TOPICS[topic_id]
        prompt = f"""You are a law professor creating hypothetical fact patterns for law students studying {topic_data['name']}.

Generate a realistic hypothetical fact pattern at difficulty {difficulty}/5 that requires the student to:
1. Spot the legal issues embedded in the facts
2. State the relevant rules of law
3. Apply the law to the facts
4. Reach a reasoned conclusion

The fact pattern should be 2-4 paragraphs and must include both clear issues and nuanced facts for higher difficulty levels.

Return valid JSON with these exact keys:
- "fact_pattern": the hypothetical scenario (2-4 paragraphs)
- "issues": a list of the legal issues embedded in the facts
- "model_answer": a complete IRAC-style model answer showing proper analysis
- "key_concepts": a list of the legal concepts being tested"""

        try:
            response = completion(
                model=MODEL,
                messages=[
                    {"role": "system", "content": "You generate law school hypothetical fact patterns in JSON format."},
                    {"role": "user", "content": prompt},
                ],
                response_format={
                    "type": "json_object",
                    "schema": {
                        "type": "object",
                        "properties": {
                            "fact_pattern": {"type": "string"},
                            "issues": {"type": "array", "items": {"type": "string"}},
                            "model_answer": {"type": "string"},
                            "key_concepts": {"type": "array", "items": {"type": "string"}},
                        },
                        "required": ["fact_pattern", "issues", "model_answer", "key_concepts"],
                    },
                },
                max_tokens=2000,
                temperature=0.7,
                reasoning_effort="low",
                drop_params=True,
                timeout=180,
            )
            raw = response.choices[0].message.content
            if raw is None:
                raw = getattr(response.choices[0].message, "reasoning_content", None) or ""
            parsed = parse_llm_json(raw)
            parsed.setdefault("issues", [])
            parsed.setdefault("key_concepts", [])
            return parsed
        except Exception as e:
            logger.error(f"Hypothetical generation failed: {e}")
            raise ValueError(friendly_llm_error(e))

    def evaluate_hypothetical(self, topic_id: str, difficulty: int, fact_pattern: str, student_answer: str) -> dict:
        topic_data = TOPICS.get(topic_id, {"name": topic_id})
        prompt = f"""You are a law professor evaluating a student's analysis of a hypothetical fact pattern in {topic_data['name']} (difficulty {difficulty}/5).

The student was explicitly told to structure their analysis using IRAC (Issue, Rule, Application, Conclusion) — this rubric was shown to them before they wrote. Grade accordingly: an answer that states rules but never applies them to the facts, or reaches a conclusion without supporting reasoning, must not receive strong marks in that dimension.

Fact pattern:
{fact_pattern}

Student's analysis:
{student_answer}

Evaluate the student's analysis for:
1. Issue spotting — did they identify the correct legal issues?
2. Rule statement — did they state the correct legal rules and standards?
3. Application — did they properly apply the law to the specific facts?
4. Conclusion — did they reach a logically supported conclusion?

Be rigorous but constructive. Note what they did well and what they missed.

Return valid JSON with these exact keys:
- "issues_identified": list of issues the student correctly identified
- "issues_missed": list of issues the student missed or misidentified
- "rule_accuracy": "correct" | "partially_correct" | "incorrect"
- "application_quality": "strong" | "adequate" | "weak"
- "overall_score": a number from 1-10
- "feedback": detailed paragraph-by-paragraph feedback on each area
- "model_answer": a complete model IRAC answer for comparison"""

        try:
            response = completion(
                model=MODEL,
                messages=[
                    {"role": "system", "content": "You are a law professor evaluating student hypothetical answers in JSON format."},
                    {"role": "user", "content": prompt},
                ],
                response_format={
                    "type": "json_object",
                    "schema": {
                        "type": "object",
                        "properties": {
                            "issues_identified": {"type": "array", "items": {"type": "string"}},
                            "issues_missed": {"type": "array", "items": {"type": "string"}},
                            "rule_accuracy": {"type": "string"},
                            "application_quality": {"type": "string"},
                            "overall_score": {"type": "integer"},
                            "feedback": {"type": "string"},
                            "model_answer": {"type": "string"},
                        },
                        "required": ["issues_identified", "issues_missed", "rule_accuracy", "application_quality", "overall_score", "feedback", "model_answer"],
                    },
                },
                max_tokens=2000,
                temperature=0.3,
                reasoning_effort="low",
                drop_params=True,
                timeout=180,
            )
            raw = response.choices[0].message.content
            if raw is None:
                raw = getattr(response.choices[0].message, "reasoning_content", None) or ""
            parsed = parse_llm_json(raw)
            return parsed
        except Exception as e:
            logger.error(f"Hypothetical evaluation failed: {e}")
            raise ValueError(friendly_llm_error(e))


    def start_mc_quiz(self, topic_id: str, difficulty: int, user_id: int) -> MCStartResponse:
        if topic_id not in TOPICS:
            raise ValueError(f"Unknown topic: {topic_id}")
        session = MCQuizSession(topic_id, difficulty)
        self._mc_sessions[user_id] = session

        q = self._generate_mc_question(session)
        session.questions.append(q)
        session.current_question = q

        return MCStartResponse(
            topic_id=topic_id,
            topic_name=session.topic_data["name"],
            difficulty=difficulty,
            total_questions=session.total_questions,
            question=q,
        )

    def start_offline_mc_quiz(self, topic_id: str, user_id: int) -> MCStartResponse:
        """Free tier: questions assembled locally from the curated bank.

        Same session shape and submit endpoint as the AI quiz — the only
        differences are the question source (mc_bank, zero LLM calls), the
        longer run (10 questions), and the persisted mode ("mc_offline").
        """
        if topic_id not in TOPICS:
            raise ValueError(f"Unknown topic: {topic_id}")
        session = MCQuizSession(topic_id, difficulty=0, offline=True)
        self._mc_sessions[user_id] = session

        q, stem = mc_bank.build_question(topic_id, session.used_stems)
        session.used_stems.add(stem)
        session.questions.append(q)
        session.current_question = q

        return MCStartResponse(
            topic_id=topic_id,
            topic_name=session.topic_data["name"],
            difficulty=0,
            total_questions=session.total_questions,
            question=q,
        )

    def _next_mc_question(self, session: MCQuizSession) -> MCQuestion:
        """Dispatch to the right generator for the session's source."""
        if session.offline:
            q, stem = mc_bank.build_question(session.topic_id, session.used_stems)
            session.used_stems.add(stem)
            return q
        return self._generate_mc_question(session)

    def submit_mc_answer(self, selected_index: int, user_id: int) -> MCAnswerResponse:
        session = self._mc_sessions.get(user_id)
        if not session or not session.current_question:
            raise ValueError("No active MC quiz session. Start one first.")

        q = session.current_question
        correct = selected_index == q.correct_index
        if correct:
            session.correct_count += 1
        session.answered += 1
        session.covered_concepts.add(f"mc_{session.answered}")

        next_question = None
        is_complete = session.answered >= session.total_questions

        if is_complete:
            mode = "mc_offline" if session.offline else "mc"
            self._persist_session(
                user_id, session.topic_id, mode,
                session.correct_count,
                session.answered - session.correct_count,
                session.answered,
            )
        else:
            next_q = self._next_mc_question(session)
            session.questions.append(next_q)
            session.current_question = next_q
            next_question = next_q

        return MCAnswerResponse(
            correct=correct,
            correct_index=q.correct_index,
            explanation=q.explanation,
            option_explanations=q.option_explanations,
            next_question=next_question,
            score=session.correct_count,
            total=session.answered,
            is_complete=is_complete,
        )

    def _generate_mc_question(self, session: MCQuizSession) -> MCQuestion:
        topic_name = session.topic_data["name"]
        difficulty = session.difficulty
        used_count = len(session.questions)

        exemplar_block = self._exemplar_block(session.topic_id, topic_name)

        prompt = f"""You are a law professor creating a multiple-choice quiz question for law students studying {topic_name}.

Generate a single multiple-choice question at difficulty {difficulty}/5 that tests a key legal concept in {topic_name}.
This will be question #{used_count + 1} of {session.total_questions} in a quiz.
{exemplar_block}
The question should:
- Present a realistic legal scenario or fact pattern (1-3 sentences)
- Have exactly 4 answer choices
- Have ONE clearly correct answer
- Have three plausible distractors (wrong answers that sound reasonable)
- Be appropriate for the selected difficulty level

Return valid JSON with these exact keys:
- "question": the question/scenario text
- "options": a list of exactly 4 strings, each being an answer choice
- "correct_index": the index (0-3) of the correct option
- "explanation": a detailed explanation of why the correct answer is right and key concepts to understand
- "option_explanations": a list of exactly 4 strings, each explaining why that specific option is right or wrong
- "difficulty": {difficulty}"""

        try:
            response = completion(
                model=MODEL,
                messages=[
                    {"role": "system", "content": "You generate law school multiple-choice quiz questions in JSON format."},
                    {"role": "user", "content": prompt},
                ],
                response_format={
                    "type": "json_object",
                    "schema": {
                        "type": "object",
                        "properties": {
                            "question": {"type": "string"},
                            "options": {"type": "array", "items": {"type": "string"}, "minItems": 4, "maxItems": 4},
                            "correct_index": {"type": "integer"},
                            "explanation": {"type": "string"},
                            "option_explanations": {"type": "array", "items": {"type": "string"}, "minItems": 4, "maxItems": 4},
                            "difficulty": {"type": "integer"},
                        },
                        "required": ["question", "options", "correct_index", "explanation", "option_explanations", "difficulty"],
                    },
                },
                max_tokens=1500,
                temperature=0.7,
                reasoning_effort="low",
                drop_params=True,
                timeout=180,
            )
            raw = response.choices[0].message.content
            if raw is None:
                raw = getattr(response.choices[0].message, "reasoning_content", None) or ""
            parsed = parse_llm_json(raw)
            return MCQuestion(
                question=parsed["question"],
                options=parsed["options"],
                correct_index=parsed["correct_index"],
                explanation=parsed["explanation"],
                option_explanations=parsed["option_explanations"],
                difficulty=parsed.get("difficulty", difficulty),
            )
        except Exception as e:
            logger.error(f"MC question generation failed: {e}")
            raise ValueError(friendly_llm_error(e))


class MCQuizSession:
    def __init__(self, topic_id: str, difficulty: int, offline: bool = False):
        self.topic_id = topic_id
        self.topic_data = TOPICS.get(topic_id)
        self.difficulty = difficulty
        # Free offline runs draw from the curated bank (no LLM) and run
        # longer than the paid AI quiz.
        self.offline = offline
        self.total_questions = mc_bank.OFFLINE_MC_QUESTIONS if offline else 5
        self.used_stems: set[str] = set()
        self.questions: list[MCQuestion] = []
        self.current_question: Optional[MCQuestion] = None
        self.answered = 0
        self.correct_count = 0
        self.covered_concepts: set[str] = set()


tutor_service = TutorService()


def get_tutor_service() -> TutorService:
    return tutor_service
