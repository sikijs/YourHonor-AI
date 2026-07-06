import os
import logging
from typing import Optional

from litellm import completion
from app.models.debate import GeneratedDebate, DebateResponse
from app.models.source import SourceDocument, from_rag_results, from_user_upload
from app.services.retrieval import get_retrieval_service, deduplicate_rag_results, parse_llm_json
from app.services.llm_errors import friendly_llm_error
from app.services.document import load_user_document_content
from app.services.document_saver import save_document

logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL = "openrouter/qwen/qwen3-14b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}

SYSTEM_PROMPT = """You are a legal debate analyst specializing in identifying and evaluating legal arguments on both sides of a legal question.

Given a user's legal position and relevant source material, generate a structured debate analysis:

1. TOPIC: The legal issue being debated.
2. USER POSITION: Restate the user's position clearly.
3. SUPPORTING ARGUMENTS: Arguments that support the user's position. For each:
   - Title (short label)
   - The argument itself
   - Legal reasoning supporting it
   - Authorities cited (cases, statutes, constitutional provisions)
   - Strength rating: "strong", "moderate", or "weak"
   - Counter-rebuttal: how the opposing side might respond
4. OPPOSING ARGUMENTS: Arguments against the user's position. For each:
   - Same structure as supporting arguments
5. KEY DOCTRINES/STATUTES: Important legal rules and principles invoked.
6. PREDICTED WINNER: "supporting", "opposing", or "balanced".
7. RATIONALE: Which side has the stronger position and why.
8. PRACTICE TIPS: Strategic advice for arguing each side.

Guidelines:
- Base arguments on the provided source material where possible
- Do not fabricate legal authorities — use only what is provided or well-established legal principles
- Be balanced and intellectually honest — do not favor one side
- Write in clear, professional language appropriate for law students
- Each argument should be discrete and specific"""


def _build_user_prompt(query: str, context_text: str) -> str:
    return f"""Analyze the following legal position and generate structured pro/con arguments.

User's Legal Position: {query}

Source Material:
{context_text}

Generate a balanced debate analysis with supporting and opposing arguments."""


class DebateService:
    def __init__(self):
        self.retrieval_service = get_retrieval_service()

    def _retrieve_from_rag(self, query: str) -> tuple[Optional[dict], list[SourceDocument]]:
        results = self.retrieval_service.retrieve(
            query=query, top_k=10, min_score=0.3
        )
        if not results:
            return None, []
        results = deduplicate_rag_results(results, min_content_length=200)
        combined_parts = []
        titles = set()
        source_labels = set()
        for r in results:
            content = r.get("content", "")
            combined_parts.append(content)
            title = r.get("title", "")
            if title:
                titles.add(title)
            sl = r.get("source", "")
            if sl:
                source_labels.add(sl)
        if not combined_parts:
            return None, []
        return {
            "context_text": "\n\n---\n\n".join(combined_parts),
            "titles": list(titles),
            "sources": list(source_labels),
        }, from_rag_results(results)

    @staticmethod
    def _debate_to_markdown(debate: GeneratedDebate) -> str:
        parts = [f"# Debate Analysis: {debate.topic}"]
        parts.append(f"**Your Position:** {debate.user_position}")
        if debate.supporting_arguments:
            parts.append("## Supporting Arguments\n")
            for a in debate.supporting_arguments:
                parts.append(f"### {a.title}")
                parts.append(f"**Strength:** {a.strength}")
                parts.append(f"**Argument:** {a.argument}")
                parts.append(f"**Reasoning:** {a.reasoning}")
                if a.authorities:
                    parts.append("**Authorities:** " + ", ".join(a.authorities))
                if a.counter_rebuttal:
                    parts.append(f"**Counter-Rebuttal:** {a.counter_rebuttal}")
        if debate.opposing_arguments:
            parts.append("## Opposing Arguments\n")
            for a in debate.opposing_arguments:
                parts.append(f"### {a.title}")
                parts.append(f"**Strength:** {a.strength}")
                parts.append(f"**Argument:** {a.argument}")
                parts.append(f"**Reasoning:** {a.reasoning}")
                if a.authorities:
                    parts.append("**Authorities:** " + ", ".join(a.authorities))
                if a.counter_rebuttal:
                    parts.append(f"**Counter-Rebuttal:** {a.counter_rebuttal}")
        if debate.key_doctrines_statutes:
            parts.append("## Key Doctrines & Statutes\n\n" + "\n".join(f"- {d}" for d in debate.key_doctrines_statutes))
        parts.extend([
            f"**Predicted Winner:** {debate.predicted_winner}",
            f"## Rationale\n\n{debate.rationale}",
        ])
        if debate.practice_tips:
            parts.append("## Practice Tips\n\n" + "\n".join(f"- {t}" for t in debate.practice_tips))
        return "\n\n".join(parts)

    def analyze(self, query: str, document_id: Optional[int] = None, user_id: Optional[int] = None) -> DebateResponse:
        user_content = None
        if document_id and user_id:
            user_doc = load_user_document_content(document_id, user_id)
            if user_doc and user_doc["content"]:
                user_content = user_doc

        rag_data, rag_sources = self._retrieve_from_rag(query)

        context_parts = []
        source_labels = set()
        doc_sources: list[SourceDocument] = []
        if user_content:
            context_parts.append(
                f"## USER UPLOADED DOCUMENT\nTitle: {user_content['title']}\n\n{user_content['content']}"
            )
            source_labels.add(user_content["title"])
            doc_sources = from_user_upload(user_content["title"])
        if rag_data:
            context_parts.append(rag_data["context_text"])
            for s in rag_data.get("sources", []):
                source_labels.add(s)
            doc_sources = rag_sources

        context_text = "\n\n---\n\n".join(context_parts) if context_parts else "No specific source material available. Base your analysis on established legal principles."

        user_prompt = _build_user_prompt(query, context_text)

        try:
            response = completion(
                model=MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                response_format=GeneratedDebate,
                max_tokens=4000,
                temperature=0.3,
            )

            raw = response.choices[0].message.content
            if raw is None:
                raw = getattr(response.choices[0].message, "reasoning_content", None) or ""
            parsed = parse_llm_json(raw)
            debate = GeneratedDebate(**parsed)

            try:
                if user_id:
                    md = self._debate_to_markdown(debate)
                    save_document(user_id, f"Debate Analysis: {debate.topic}", md, "debate")
            except Exception as e:
                logger.warning(f"Failed to save debate document: {e}")

            return DebateResponse(
                topic=debate.topic,
                user_position=debate.user_position,
                supporting_arguments=debate.supporting_arguments,
                opposing_arguments=debate.opposing_arguments,
                key_doctrines_statutes=debate.key_doctrines_statutes,
                predicted_winner=debate.predicted_winner,
                rationale=debate.rationale,
                practice_tips=debate.practice_tips,
                source="user_upload" if user_content else "rag",
                sources=doc_sources,
            )

        except Exception as e:
            logger.error(f"Debate analysis failed: {e}")
            raise ValueError(f"Failed to analyze debate: {friendly_llm_error(e)}")


debate_service = DebateService()


def get_debate_service() -> DebateService:
    return debate_service
