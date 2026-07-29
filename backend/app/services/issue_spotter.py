import os
import logging
from typing import Optional

from litellm import completion
from app.models.issue_spotter import GeneratedIssueSpotter, IssueSpotterResponse
from app.models.source import SourceDocument, from_rag_results, from_user_upload
from app.services.retrieval import get_retrieval_service, deduplicate_rag_results, parse_llm_json
from app.services.llm_errors import friendly_llm_error
from app.services.document import load_user_document_content
from app.services.document_saver import save_document

logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL = "openrouter/qwen/qwen3-14b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}

SYSTEM_PROMPT = """You are a law professor teaching issue-spotting to first-year law students. Given a fact pattern and relevant legal context, identify ALL legal issues present in the facts.

For each issue you identify, provide:

1. ISSUE: State the precise legal question raised by the facts (e.g., "Did the officer have reasonable suspicion to conduct a Terry stop?")
2. RULE: State the governing legal rule, doctrine, or test that applies. Be specific about elements and standards.
3. APPLICATION: Apply the rule to the specific facts. Explain which facts trigger which element of the rule.
4. CONCLUSION: Reach a preliminary conclusion on how a court would likely resolve this issue.
5. MISSING INFORMATION: Note what additional facts would be needed for a definitive answer.
6. RELEVANT AUTHORITIES: List specific cases, statutes, or constitutional provisions that govern this issue.

Then group the issues by legal area (e.g., "Fourth Amendment", "Contracts - Formation", "Torts - Duty of Care") in issues_by_area.

Include an overview summarizing the fact pattern's key legal domains and overall complexity.

Provide practice tips relevant to writing an exam answer about this fact pattern.

Be THOROUGH. In law school exams, missing an issue is far more costly than over-identifying potential issues. If you're unsure whether a fact raises an issue, include it and note the uncertainty."""


def _build_user_prompt(query: str, context_text: str) -> str:
    if context_text:
        return f"""Analyze the following fact pattern and identify all legal issues present.

Fact Pattern:
{query}

Relevant Legal Context (precedents, statutes, doctrines):
{context_text}

Identify every legal issue embedded in these facts, following the format specified. Be thorough — include marginal issues with appropriate caveats."""
    return f"""Analyze the following fact pattern and identify all legal issues present.

Fact Pattern:
{query}

No additional legal context was retrieved. Base your analysis on well-established legal principles from your training. If you need specific authority, note that the user should verify with primary sources."""


class IssueSpotterService:
    def __init__(self):
        self.retrieval_service = get_retrieval_service()

    def _retrieve_relevant_rules(self, query: str) -> tuple[str, list[SourceDocument]]:
        results = self.retrieval_service.retrieve(
            query=query, top_k=10, min_score=0.5
        )
        results = deduplicate_rag_results(results, min_content_length=100)
        if not results:
            return "", []

        chunks = []
        for r in results:
            content = r.get("content", "")
            title = r.get("title", "Unknown")
            citation = r.get("citation") or ""
            source_tag = f"[{title}]" + (f" ({citation})" if citation else "")
            chunks.append(f"{source_tag}\n{content}")

        combined = "\n\n---\n\n".join(chunks)
        sources = from_rag_results(results)
        return combined, sources

    @staticmethod
    def _to_markdown(result: GeneratedIssueSpotter) -> str:
        parts = [
            "# Issue Spotter Analysis",
            "",
            "## Overview",
            "",
            result.overview,
            "",
            "## Legal Areas",
            "",
        ]
        for area, issue_texts in result.issues_by_area.items():
            parts.append(f"- **{area}**: {len(issue_texts)} issue(s)")
        parts.append("")
        for i, issue in enumerate(result.issues, 1):
            parts.extend([
                f"## Issue {i}: {issue.issue}",
                "",
                f"**Rule:** {issue.rule}",
                "",
                f"**Application:** {issue.application}",
                "",
                f"**Conclusion:** {issue.conclusion}",
                "",
            ])
            if issue.missing_information:
                parts.append(f"**Needs More Info:** {issue.missing_information}")
                parts.append("")
            if issue.relevant_authorities:
                parts.append("**Authorities:**")
                for a in issue.relevant_authorities:
                    parts.append(f"- {a}")
                parts.append("")
        if result.practice_tips:
            parts.extend([
                "## Practice Tips",
                "",
                result.practice_tips,
                "",
            ])
        if result.sources_consulted:
            parts.extend([
                "## Sources Consulted",
                "",
            ] + [f"- {s}" for s in result.sources_consulted])
        return "\n".join(parts)

    def generate(self, query: str, document_id: Optional[int] = None, user_id: Optional[int] = None) -> IssueSpotterResponse:
        context_text = ""
        sources: list[SourceDocument] = []

        if document_id and user_id:
            user_doc = load_user_document_content(document_id, user_id)
            if user_doc and user_doc["content"]:
                combined = query + "\n\n" + user_doc["content"]
                sources = from_user_upload(user_doc["title"])

        rag_context, rag_sources = self._retrieve_relevant_rules(query)
        if rag_context:
            context_text = rag_context
            sources = rag_sources

        user_prompt = _build_user_prompt(query, context_text)

        try:
            response = completion(
                model=MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                response_format=GeneratedIssueSpotter,
                max_tokens=4000,
                temperature=0.3,
                reasoning_effort="low",
                drop_params=True,
            )

            raw = response.choices[0].message.content
            if raw is None:
                raw = getattr(response.choices[0].message, "reasoning_content", None) or ""
            parsed = parse_llm_json(raw)
            result = GeneratedIssueSpotter(**parsed)

            try:
                if user_id:
                    md = self._to_markdown(result)
                    save_document(user_id, "Issue Spotter Analysis", md, "issue_spotter")
            except Exception as e:
                logger.warning(f"Failed to save issue spotter document: {e}")

            return IssueSpotterResponse(
                overview=result.overview,
                issues=result.issues,
                issues_by_area=result.issues_by_area,
                practice_tips=result.practice_tips,
                sources=sources,
                sources_consulted=result.sources_consulted,
            )

        except Exception as e:
            logger.error(f"Issue spotter generation failed: {e}")
            raise ValueError(f"Failed to spot issues: {friendly_llm_error(e)}")


issue_spotter_service = IssueSpotterService()


def get_issue_spotter_service() -> IssueSpotterService:
    return issue_spotter_service
