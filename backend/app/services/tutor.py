import os
import logging
import re
from typing import Optional

from litellm import completion
from app.models.tutor import (
    TutorQuestion, TutorStartResponse, TutorAnswerResponse,
    GeneratedEvaluation, GeneratedQuestion,
)
from app.services.retrieval import parse_llm_json
from app.services.llm_errors import friendly_llm_error
from app.services.tutor_data import TOPICS

logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL = "openrouter/qwen/qwen3-14b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}


class TutorSession:
    def __init__(self, topic_id: str):
        self.topic_id = topic_id
        self.topic_data = TOPICS.get(topic_id)
        self.questions = list(self.topic_data["questions"])
        self.current_index = 0
        self.correct_count = 0
        self.wrong_count = 0
        self.attempts_on_question = 0
        self.history: list[dict] = []
        self.covered_concepts: set[str] = set()
        self.dynamic_used = False


class TutorService:
    def __init__(self):
        self._sessions: dict[int, TutorSession] = {}

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

Guidelines:
- Be encouraging but academically rigorous
- Use the Socratic method — ask probing questions rather than just lecturing
- If the answer is wrong, generate a SIMPLER VERSION of the SAME question — break it down into smaller parts. Do NOT switch to a different concept.
- If the answer is correct, build on it with a deeper question on the same concept
- Never fabricate legal rules or citations
- If the student admits they don't know or says "no idea", always classify as "incorrect" — do not treat it as correct"""

        user_prompt = f"""Topic: {session.topic_data['name']}
Question: {q.question}
Expected concepts: {', '.join(q.expected_concepts)}
Student's answer: {answer}

Evaluate this answer and provide a follow-up or determine if the student has mastered this concept."""

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
                )

                raw = response.choices[0].message.content
                if raw is None:
                    raw = getattr(response.choices[0].message, "reasoning_content", None) or ""
                parsed = parse_llm_json(raw)
                eval_result = GeneratedEvaluation(**parsed)

            except Exception as e:
                logger.error(f"Tutor LLM call failed: {e}")
                eval_result = GeneratedEvaluation(
                    evaluation="incorrect",
                    explanation="I couldn't evaluate your answer. Let's try a different approach.",
                    follow_up_question=None,
                    follow_up_hint=None,
                    is_complete=False,
                )

        if session.attempts_on_question >= 5 and eval_result.evaluation != "correct":
            attempts_exceeded = True
            eval_result.is_complete = True
            eval_result.follow_up_question = None

            try:
                answer_response = completion(
                    model=MODEL,
                    messages=[
                        {"role": "system", "content": "You are a law professor. Give a concise, specific answer to the student's question."},
                        {"role": "user", "content": f"Question: {q.question}\nExpected concepts: {', '.join(q.expected_concepts)}\n\nProvide the correct answer in 2-3 sentences explaining how these concepts apply to the question. Be specific and educational."},
                    ],
                    max_tokens=300,
                    temperature=0.3,
                )
                raw = answer_response.choices[0].message.content
                if raw is None:
                    raw = getattr(answer_response.choices[0].message, "reasoning_content", None) or ""
                if raw.strip():
                    concepts_str = "; ".join(q.expected_concepts) if q.expected_concepts else ""
                    concepts_line = f"\n\nKey concepts: {concepts_str}" if concepts_str else ""
                    correct_answer_revealed = raw.strip() + concepts_line
            except Exception as e:
                logger.error(f"Correct answer generation failed: {e}")

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
                "  You've used all " + str(session.attempts_on_question) +
                " attempts for this question. The correct answer has been shown above. Let's move to the next question."
            )

        if eval_result.evaluation == "correct":
            session.correct_count += 1
        else:
            session.wrong_count += 1

        session.history.append({
            "question": q.question,
            "answer": answer,
            "evaluation": eval_result.evaluation,
            "explanation": eval_result.explanation,
        })

        next_question = None
        if eval_result.is_complete:
            session.covered_concepts.update(q.expected_concepts)
            session.current_index += 1
            session.attempts_on_question = 0
            if session.current_index < len(session.questions):
                nq = session.questions[session.current_index]
                next_question = TutorQuestion(
                    question=nq.question,
                    hint=nq.hint,
                    expected_concepts=nq.expected_concepts,
                    difficulty=nq.difficulty,
                )
        elif eval_result.follow_up_question:
            follow_up_difficulty = (
                q.difficulty + 1 if eval_result.evaluation == "correct"
                else max(1, q.difficulty - 1)
            )
            next_question = TutorQuestion(
                question=eval_result.follow_up_question,
                hint=eval_result.follow_up_hint or q.hint,
                expected_concepts=q.expected_concepts,
                difficulty=follow_up_difficulty,
            )
        else:
            session.covered_concepts.update(q.expected_concepts)
            session.current_index += 1
            session.attempts_on_question = 0
            if session.current_index < len(session.questions):
                nq = session.questions[session.current_index]
                next_question = TutorQuestion(
                    question=nq.question,
                    hint=nq.hint,
                    expected_concepts=nq.expected_concepts,
                    difficulty=nq.difficulty,
                )

        is_session_complete = session.current_index >= len(session.questions)

        if is_session_complete:
            total = len(session.questions)
            logger.info(f"User {user_id} completed topic '{session.topic_data['name']}' "
                        f"({session.correct_count}/{total} correct)")

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

    def _generate_dynamic_question(self, session: TutorSession) -> TutorQuestion:
        topic_name = session.topic_data["name"]
        difficulty = self._next_difficulty(session)
        covered = ', '.join(sorted(session.covered_concepts)) if session.covered_concepts else 'none yet'

        prompt = f"""You are a law professor teaching {topic_name}. A student has completed {len(session.questions)} questions with {session.correct_count} correct.

Generate a NEW question on {topic_name} at difficulty {difficulty}. Do NOT repeat any of these already-covered concepts: {covered}.

Return valid JSON with these exact keys:
- "question": the question text
- "hint": a helpful hint for the student
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
            )
            raw = response.choices[0].message.content
            if raw is None:
                raw = getattr(response.choices[0].message, "reasoning_content", None) or ""
            parsed = GeneratedQuestion.model_validate(parse_llm_json(raw))
            return TutorQuestion(
                question=parsed.question,
                hint=parsed.hint,
                expected_concepts=parsed.expected_concepts,
                difficulty=parsed.difficulty,
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
        session.dynamic_used = True
        return new_q


tutor_service = TutorService()


def get_tutor_service() -> TutorService:
    return tutor_service
