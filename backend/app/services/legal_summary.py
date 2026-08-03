import os
import logging
from typing import Optional

from litellm import completion
from app.models.legal_summary import GeneratedSummary, LegalSummaryResponse
from app.models.source import SourceDocument, from_rag_results, from_user_upload
from app.services.retrieval import get_retrieval_service, deduplicate_rag_results, parse_llm_json
from app.services.llm_errors import friendly_llm_error
from app.services.document import load_user_document_content
from app.services.document_saver import save_document

logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL = "openrouter/qwen/qwen3-14b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}

SYSTEM_PROMPT = """You are a legal education assistant generating structured legal summaries for law students.
Given the text of a legal document, case, or statute, produce a structured summary.

Extract and organize the following sections:

1. TITLE: The name of the case, statute, or document being summarized.
2. OVERVIEW: A concise background explaining what this document/case is about.
3. KEY FINDINGS: The most important holdings, holdings, or determinations (list each separately).
4. LEGAL PRINCIPLES: The specific legal rules, tests, or doctrines established or applied (list each separately).
5. IMPACT: The significance and effect of this case/statute on legal doctrine or society.
6. KEY POINTS: Bullet-point summary of the most important takeaways for a law student.
7. SOURCES CONSULTED: List the specific sources used to generate this summary.

Guidelines:
- Use ONLY information from the provided text
- Do not fabricate details or citations not in the text
- If the text doesn't contain enough information for a section, summarize what is available
- Write in clear, professional language appropriate for law students
- Be precise about legal concepts and terminology"""


def _build_user_prompt(query: str, summary_type: str, context_text: str) -> str:
    return f"""Generate a structured legal summary for the following topic.

Query: {query}
Summary Type: {summary_type}

Source Text:
{context_text}

Produce the legal summary following the structured format."""


class LegalSummaryService:
    def __init__(self):
        self.retrieval_service = get_retrieval_service()

    def _retrieve_from_rag(self, query: str) -> Optional[tuple[dict, list[SourceDocument]]]:
        results = self.retrieval_service.retrieve(
            query=query, top_k=10, min_score=0.5
        )
        results = deduplicate_rag_results(results, min_content_length=200)
        if not results:
            return None, []
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
    def _summary_to_markdown(summary: GeneratedSummary, sources: Optional[list[SourceDocument]] = None) -> str:
        parts = [f"## Overview\n\n{summary.overview}"]
        if summary.key_findings:
            parts.append("## Key Findings\n\n" + "\n".join(f"- {f}" for f in summary.key_findings))
        if summary.legal_principles:
            parts.append("## Legal Principles\n\n" + "\n".join(f"- {p}" for p in summary.legal_principles))
        parts.append(f"## Impact\n\n{summary.impact}")
        if summary.key_points:
            parts.append("## Key Points\n\n" + "\n".join(f"- {p}" for p in summary.key_points))
        if summary.sources_consulted:
            parts.append("## Sources Consulted\n\n" + "\n".join(f"- {s}" for s in summary.sources_consulted))
        if sources:
            lines = []
            for s in sources:
                line = f"- **{s.title}** ({s.source_type})"
                extras = [x for x in [s.citation, s.court, s.date_filed] if x]
                if extras:
                    line += " — " + " | ".join(extras)
                if s.url:
                    line += f" | {s.url}"
                lines.append(line)
            parts.append("## Retrieved Sources\n\n" + "\n".join(lines))
        return "\n\n".join(parts)

    def generate(self, query: str, summary_type: str = "general", document_id: Optional[int] = None, user_id: Optional[int] = None) -> LegalSummaryResponse:
        user_content = None
        if document_id and user_id:
            user_doc = load_user_document_content(document_id, user_id)
            if user_doc and user_doc["content"]:
                user_content = user_doc

        rag_data, rag_sources = self._retrieve_from_rag(query)

        context_parts = []
        doc_sources: list[SourceDocument] = []
        if user_content:
            context_parts.append(
                f"## USER UPLOADED DOCUMENT\nTitle: {user_content['title']}\n\n{user_content['content']}"
            )
            doc_sources = from_user_upload(user_content["title"])
        if rag_data:
            context_parts.append(rag_data["context_text"])
            doc_sources = rag_sources

        if not context_parts:
            context_parts.append(
                "No reference materials were found for this query. "
                "Provide a general educational overview based on established legal principles, "
                "noting that authoritative sources may be needed for a complete analysis."
            )

        context_text = "\n\n---\n\n".join(context_parts)
        user_prompt = _build_user_prompt(query, summary_type, context_text)

        try:
            response = completion(
                model=MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                response_format=GeneratedSummary,
                max_tokens=8000,
                temperature=0.3,
                reasoning_effort="low",
                drop_params=True,
                timeout=180,
            )

            raw = response.choices[0].message.content
            if raw is None:
                raw = getattr(response.choices[0].message, "reasoning_content", None) or ""
            parsed = parse_llm_json(raw)
            summary = GeneratedSummary(**parsed)

            try:
                if user_id:
                    md = self._summary_to_markdown(summary, doc_sources)
                    save_document(user_id, f"Legal Summary: {summary.title}", md, "legal_summary")
            except Exception as e:
                logger.warning(f"Failed to save summary document: {e}")

            return LegalSummaryResponse(
                title=summary.title,
                summary_type=summary_type,
                overview=summary.overview,
                key_findings=summary.key_findings,
                legal_principles=summary.legal_principles,
                impact=summary.impact,
                key_points=summary.key_points,
                sources_consulted=summary.sources_consulted,
                sources=doc_sources,
            )

        except Exception as e:
            logger.error(f"Legal summary generation failed: {e}")
            raise ValueError(f"Failed to generate legal summary: {friendly_llm_error(e)}")


legal_summary_service = LegalSummaryService()


def get_legal_summary_service() -> LegalSummaryService:
    return legal_summary_service
