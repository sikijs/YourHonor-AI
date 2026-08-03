import os
import logging
from typing import Optional

from litellm import completion
from app.models.case_brief import GeneratedBrief, CaseBriefResponse
from app.models.source import SourceDocument, from_rag_results, from_courtlistener_case, from_user_upload
from app.services.retrieval import get_retrieval_service, deduplicate_rag_results, parse_llm_json
from app.services.llm_errors import friendly_llm_error
from app.services.document import load_user_document_content
from app.services.document_saver import save_document
from connectors.courtlistener import _has_auth

logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL = "openrouter/qwen/qwen3-14b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}

SYSTEM_PROMPT = """You are a legal education assistant generating case briefs for law students.
Given the full text of a court opinion, produce a structured case brief.

Extract and organize the following sections from the opinion:

1. FACTS: The key factual background of the case. Be specific about parties, events, and context.
2. PROCEDURAL HISTORY: How the case moved through the courts before reaching this opinion.
3. ISSUES: The precise legal questions the court had to decide (list each issue separately).
4. HOLDING: The court's answer to each issue.
5. REASONING: The court's logical analysis and legal reasoning step by step.
6. RULE OF LAW: The specific legal rule or test established or applied in this case.
7. CONCURRENCE (if present): Key points from any concurring opinion.
8. DISSENT (if present): Key points from any dissenting opinion.
9. SIGNIFICANCE: Why this case matters — its impact on legal doctrine, society, or future cases.
10. SOURCES CONSULTED: List the specific source titles or references used to generate this brief.

Guidelines:
- Use ONLY information from the provided opinion text
- Do not fabricate details or citations not in the text
- If the text doesn't contain enough information for a section, summarize what is available
- Write in clear, professional language appropriate for law students
- Be precise about legal concepts and terminology"""


def _build_user_prompt(case_name: str, opinion_text: str) -> str:
    return f"""Generate a structured case brief for the following case.

Case: {case_name}

Opinion Text:
{opinion_text}

Produce the case brief following the standard legal brief format."""


class CaseBriefService:
    def __init__(self):
        self.retrieval_service = get_retrieval_service()

    def _retrieve_from_rag(self, query: str) -> Optional[tuple[dict, list[SourceDocument]]]:
        results = self.retrieval_service.retrieve(
            query=query, top_k=10, min_score=0.5
        )
        results = deduplicate_rag_results(results, min_content_length=200)
        if not results:
            return None, None

        by_title: dict[str, list[dict]] = {}
        best_score_per_title: dict[str, float] = {}
        for r in results:
            title = r.get("title", "Unknown")
            if title not in by_title:
                by_title[title] = []
            by_title[title].append(r)
            score = r.get("score", 0)
            if title not in best_score_per_title or score > best_score_per_title[title]:
                best_score_per_title[title] = score

        best_title = max(best_score_per_title, key=best_score_per_title.get)
        selected = by_title[best_title]
        selected.sort(key=lambda r: r.get("index", 0))

        combined_text = "\n\n---\n\n".join(r["content"] for r in selected)
        if len(combined_text) < 200:
            return None, None

        case_data = {
            "case_name": best_title if best_title != "Unknown" else query,
            "citation": [],
            "court": "",
            "date_filed": "",
            "opinion_text": combined_text,
        }
        sources = from_rag_results(selected)
        return case_data, sources

    @staticmethod
    def _brief_to_markdown(
        brief: GeneratedBrief, case_name: str, citation: list,
        court: str, date_filed: str
    ) -> str:
        parts = []
        if citation:
            parts.append(f"**Citation:** {', '.join(citation)}")
        if court:
            parts.append(f"**Court:** {court}")
        if date_filed:
            parts.append(f"**Date Filed:** {date_filed}")
        parts.extend([
            "",
            f"## Facts\n\n{brief.facts}",
            f"## Procedural History\n\n{brief.procedural_history}",
            f"## Issues\n\n" + "\n".join(f"- {i}" for i in brief.issues) if brief.issues else "",
            f"## Holding\n\n{brief.holding}",
            f"## Reasoning\n\n{brief.reasoning}",
            f"## Rule of Law\n\n{brief.rule_of_law}",
        ])
        if brief.concurrence:
            parts.append(f"## Concurrence\n\n{brief.concurrence}")
        if brief.dissent:
            parts.append(f"## Dissent\n\n{brief.dissent}")
        parts.append(f"## Significance\n\n{brief.significance}")
        if brief.sources_consulted:
            parts.append("## Sources Consulted\n\n" + "\n".join(f"- {s}" for s in brief.sources_consulted))
        return "\n\n".join(parts)

    def generate(self, query: str, document_id: Optional[int] = None, user_id: Optional[int] = None) -> CaseBriefResponse:
        case_data = None
        sources: list[SourceDocument] = []

        if document_id and user_id:
            user_doc = load_user_document_content(document_id, user_id)
            if user_doc and user_doc["content"]:
                case_data = {
                    "case_name": user_doc["title"],
                    "citation": [],
                    "court": "",
                    "date_filed": "",
                    "opinion_text": user_doc["content"],
                }
                sources = from_user_upload(user_doc["title"])

        if not case_data:
            rag_result, rag_sources = self._retrieve_from_rag(query)
            if rag_result:
                case_data = rag_result
                sources = rag_sources

        if not case_data and _has_auth():
            cl_data = self.retrieval_service.retrieve_case(query)
            if cl_data:
                case_data = cl_data
                sources = from_courtlistener_case(cl_data)

        if not case_data:
            case_data = {
                "case_name": query,
                "citation": [],
                "court": "",
                "date_filed": "",
                "opinion_text": (
                    "No case information was found for this query. "
                    "Based on general legal principles, provide an educational overview related to the topic. "
                    "The case was not found in the local database or via CourtListener. "
                    "Try a more specific case name or citation."
                ),
            }

        case_name = case_data.get("case_name", query)
        citation = case_data.get("citation", [])
        court = case_data.get("court", "")
        date_filed = case_data.get("date_filed", "")
        opinion_text = case_data.get("opinion_text", "")
        if not opinion_text or len(opinion_text) < 200:
            case_data = {
                "case_name": case_name,
                "citation": [],
                "court": "",
                "date_filed": "",
                "opinion_text": (
                    "No opinion text is available for this case. "
                    "Based on general legal principles, provide an educational overview related to the query. "
                    "The case could not be found in our database or via CourtListener. "
                    "Try a more specific case name or citation."
                ),
            }
            case_name = case_data["case_name"]
            citation = case_data["citation"]
            court = case_data["court"]
            date_filed = case_data["date_filed"]
            opinion_text = case_data["opinion_text"]

        user_prompt = _build_user_prompt(case_name, opinion_text)

        try:
            response = completion(
                model=MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                response_format=GeneratedBrief,
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
            brief = GeneratedBrief(**parsed)

            try:
                if user_id:
                    md = self._brief_to_markdown(brief, case_name, citation, court, date_filed)
                    save_document(user_id, f"Case Brief: {case_name}", md, "case_brief")
            except Exception as e:
                logger.warning(f"Failed to save case brief document: {e}")

            return CaseBriefResponse(
                case_name=brief.case_name,
                citation=citation if citation else brief.citation,
                court=court or brief.court,
                date_filed=date_filed or brief.date_filed,
                facts=brief.facts,
                procedural_history=brief.procedural_history,
                issues=brief.issues,
                holding=brief.holding,
                reasoning=brief.reasoning,
                rule_of_law=brief.rule_of_law,
                concurrence=brief.concurrence,
                dissent=brief.dissent,
                significance=brief.significance,
                sources=sources,
                sources_consulted=brief.sources_consulted,
            )

        except Exception as e:
            logger.error(f"Case brief generation failed: {e}")
            raise ValueError(f"Failed to generate case brief: {friendly_llm_error(e)}")


case_brief_service = CaseBriefService()


def get_case_brief_service() -> CaseBriefService:
    return case_brief_service
