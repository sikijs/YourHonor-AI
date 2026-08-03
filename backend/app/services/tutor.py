from __future__ import annotations
import os
import logging
import re
from typing import Optional

from litellm import completion
from app.models.tutor import (
    TutorQuestion, TutorStartResponse, TutorAnswerResponse,
    GeneratedEvaluation, GeneratedQuestion,
    MCQuestion, MCStartResponse, MCAnswerResponse,
)
from app.services.retrieval import parse_llm_json
from app.services.llm_errors import friendly_llm_error
from app.services.tutor_data import TOPICS

logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL = "openrouter/qwen/qwen3-14b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}

# Max wrong/partial attempts per question before the correct answer is revealed
# and the session moves on. A fully correct answer always advances immediately.
MAX_ATTEMPTS_PER_QUESTION = 3


class TutorSession:
    def __init__(self, topic_id: str):
        self.topic_id = topic_id
        self.topic_data = TOPICS.get(topic_id)
        self.questions = list(self.topic_data["questions"])
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

        if not is_complete:
            next_q = self._generate_mc_question(session)
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

        prompt = f"""You are a law professor creating a multiple-choice quiz question for law students studying {topic_name}.

Generate a single multiple-choice question at difficulty {difficulty}/5 that tests a key legal concept in {topic_name}.
This will be question #{used_count + 1} of {session.total_questions} in a quiz.

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
    def __init__(self, topic_id: str, difficulty: int):
        self.topic_id = topic_id
        self.topic_data = TOPICS.get(topic_id)
        self.difficulty = difficulty
        self.total_questions = 5
        self.questions: list[MCQuestion] = []
        self.current_question: Optional[MCQuestion] = None
        self.answered = 0
        self.correct_count = 0
        self.covered_concepts: set[str] = set()


tutor_service = TutorService()


def get_tutor_service() -> TutorService:
    return tutor_service
