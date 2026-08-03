import os
import logging
from datetime import date
from typing import Optional

from litellm import completion
from app.models.memorandum import GeneratedMemorandum, MemorandumResponse
from app.models.source import SourceDocument, from_rag_results, from_courtlistener_case, from_user_upload
from app.services.retrieval import get_retrieval_service, deduplicate_rag_results, parse_llm_json
from app.services.llm_errors import friendly_llm_error
from app.services.document import load_user_document_content
from app.services.document_saver import save_document
from connectors.courtlistener import search_opinions, case_brief_from_query

logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL = "openrouter/qwen/qwen3-14b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}

SYSTEM_PROMPT = """You are a law clerk drafting a legal memorandum for a supervising attorney. Given the user's legal question and the provided reference materials, produce a structured legal memorandum.

Use the IRAC (Issue, Rule, Application, Conclusion) framework for each legal issue you identify.

Structure the memorandum as follows:

1. TO: The recipient (default: "Recipient").
2. AUTHOR: The drafter (default: "YourHonor AI").
3. DATE: Today's date.
4. RE: The subject line summarizing the legal question.
5. QUESTION PRESENTED: A precise statement of the legal question(s) to be answered.
6. BRIEF ANSWER: A concise yes/no answer followed by a short explanation.
7. FACTS: The relevant factual background, drawn from the user's query and any reference materials.
8. ISSUES: For each legal issue, use the IRAC format:
   - Issue: The specific legal question for this issue.
   - Rule: The relevant legal rule, statute, or precedent.
   - Application: Apply the rule to the facts.
   - Conclusion: The conclusion for this issue.
9. OVERALL CONCLUSION: A brief summary of the overall outcome.
10. SOURCES CONSULTED: List the specific source titles or references used to draft this memorandum.

Guidelines:
- Base your analysis on the provided reference materials when available
- Cite sources where relevant
- If the reference materials lack sufficient information, note this and analyze based on general legal principles
- Write in clear, professional language appropriate for legal writing
- Distinguish between established law and your analysis
- Do not fabricate citations or case names not present in the reference materials
- This is an educational tool — acknowledge uncertainty where appropriate
- Respond with ONLY a valid JSON object. No markdown, no code fences, no explanation. The JSON must have these fields: to (string), author (string), date (string), re (string), question_presented (string), brief_answer (string), facts (string), issues (array of objects each with issue, rule, application, conclusion), overall_conclusion (string)."""


def _build_user_prompt(query: str, context: str) -> str:
    return f"""Legal Question: {query}

Reference Materials:
{context}

Draft a legal memorandum analyzing the above question. Use the reference materials as your primary sources and organize each legal issue using the IRAC framework."""


class MemorandumService:
    def __init__(self):
        self.retrieval_service = get_retrieval_service()

    def _retrieve_from_rag(self, query: str) -> tuple[Optional[dict], list[SourceDocument]]:
        results = self.retrieval_service.retrieve(
            query=query, top_k=10, min_score=0.5
        )
        if not results:
            return None, []
        results = deduplicate_rag_results(results, min_content_length=200)
        context_parts = []
        source_labels = []
        for r in results:
            content = r.get("content", "")
            title = r.get("title", "")
            source = r.get("source", "")
            if content:
                context_parts.append(content)
                source_labels.append(title or source)
        if not context_parts:
            return None, []
        return {
            "context_text": "\n\n---\n\n".join(context_parts),
            "sources": source_labels,
        }, from_rag_results(results)

    def _search_courtlistener(self, query: str) -> tuple[Optional[str], list[SourceDocument]]:
        case = case_brief_from_query(query)
        if case and case.get("opinion_text") and len(case["opinion_text"]) >= 200:
            text = f"Case: {case.get('case_name', query)}\nCitation: {', '.join(case.get('citation', []))}\nCourt: {case.get('court', '')}\nDate: {case.get('date_filed', '')}\n\nFull Opinion:\n{case['opinion_text']}"
            return text, from_courtlistener_case(case)

        results = search_opinions(query, page_size=3)
        if not results:
            return None, []
        context_parts = []
        cl_sources: list[SourceDocument] = []
        seen: set[str] = set()
        for r in results:
            name = r.get("case_name", "")
            citation = r.get("citation", [])
            snippet = r.get("snippet", "")
            court = r.get("court", "")
            date = r.get("date_filed", "")
            if name and name not in seen:
                seen.add(name)
                parts = [f"Case: {name}"]
                if citation:
                    parts.append(f"Citation: {', '.join(citation)}")
                if court:
                    parts.append(f"Court: {court}")
                if date:
                    parts.append(f"Date: {date}")
                if snippet:
                    parts.append(f"Syllabus: {snippet[:2000]}")
                context_parts.append("\n".join(parts))
                from connectors.courtlistener import cluster_url
                cl_sources.append(SourceDocument(
                    title=name,
                    source_type="courtlistener",
                    url=cluster_url(r.get("cluster_id")),
                    citation=", ".join(citation) if citation else None,
                    court=court,
                    date_filed=date,
                ))
        if not context_parts:
            return None, []
        return "\n\n---\n\n".join(context_parts), cl_sources

    @staticmethod
    def _memo_to_markdown(memo: GeneratedMemorandum) -> str:
        parts = [f"# Legal Memorandum: {memo.re}"]
        parts.extend([
            f"**TO:** {memo.to}",
            f"**FROM:** {memo.author}",
            f"**DATE:** {memo.date}",
            f"**RE:** {memo.re}",
            "",
            f"## Question Presented\n\n{memo.question_presented}",
            f"## Brief Answer\n\n{memo.brief_answer}",
            f"## Facts\n\n{memo.facts}",
            "## Discussion\n",
        ])
        for i, iss in enumerate(memo.issues, 1):
            parts.append(f"### Issue {i}: {iss.issue}")
            parts.append(f"**Rule:** {iss.rule}")
            parts.append(f"**Application:** {iss.application}")
            parts.append(f"**Conclusion:** {iss.conclusion}")
        parts.append(f"## Overall Conclusion\n\n{memo.overall_conclusion}")
        if memo.sources_consulted:
            parts.append("## Sources Consulted\n\n" + "\n".join(f"- {s}" for s in memo.sources_consulted))
        return "\n\n".join(parts)

    def generate(self, query: str, document_id: Optional[int] = None, user_id: Optional[int] = None) -> MemorandumResponse:
        context_text = ""
        doc_sources: list[SourceDocument] = []

        if document_id and user_id:
            user_doc = load_user_document_content(document_id, user_id)
            if user_doc and user_doc["content"]:
                context_text = user_doc["content"]
                doc_sources = from_user_upload(user_doc["title"])

        if not context_text:
            rag_data, rag_sources = self._retrieve_from_rag(query)
            if rag_data:
                context_text = rag_data["context_text"]
                doc_sources = rag_sources

        if not context_text:
            cl_text, cl_sources = self._search_courtlistener(query)
            if cl_text:
                context_text = cl_text
                doc_sources = cl_sources

        if not context_text:
            context_text = "No reference materials were found for this query. Analyze the question based on general legal principles, and note that a more specific citation lookup may be needed for authoritative sources."

        user_prompt = _build_user_prompt(query, context_text)

        try:
            response = completion(
                model=MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=8000,
                temperature=0.3,
                reasoning_effort="low",
                drop_params=True,
                timeout=180,
                extra_body=EXTRA_BODY,
            )

            raw = response.choices[0].message.content
            if raw is None:
                raw = getattr(response.choices[0].message, "reasoning_content", None) or ""
            parsed = parse_llm_json(raw)
            memo = GeneratedMemorandum(**parsed)
            memo.date = date.today().strftime("%B %d, %Y")

            try:
                if user_id:
                    md = self._memo_to_markdown(memo)
                    save_document(user_id, f"Legal Memorandum: {memo.re}", md, "memorandum")
            except Exception as e:
                logger.warning(f"Failed to save memorandum document: {e}")

            return MemorandumResponse(
                to=memo.to,
                author=memo.author,
                date=memo.date,
                re=memo.re,
                question_presented=memo.question_presented,
                brief_answer=memo.brief_answer,
                facts=memo.facts,
                issues=memo.issues,
                overall_conclusion=memo.overall_conclusion,
                sources=doc_sources,
                sources_consulted=memo.sources_consulted,
            )

        except Exception as e:
            logger.error(f"Memorandum generation failed: {e}")
            raise ValueError(f"Failed to generate memorandum: {friendly_llm_error(e)}")


memorandum_service = MemorandumService()


def get_memorandum_service() -> MemorandumService:
    return memorandum_service
