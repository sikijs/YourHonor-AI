import os
import logging
from typing import Optional

from litellm import completion
from app.models.citation_map import GeneratedCitationMap, CitationMapResponse
from app.models.source import SourceDocument, from_rag_results, from_user_upload
from app.services.retrieval import get_retrieval_service, deduplicate_rag_results, parse_llm_json
from app.services.llm_errors import friendly_llm_error
from app.services.document import load_user_document_content
from app.services.document_saver import save_document

logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL = "openrouter/qwen/qwen3-14b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}

SYSTEM_PROMPT = """You are a legal education assistant specialized in citation analysis.
Given the text of a court opinion, extract and organize all legal authorities cited.

Extract and organize the following:

1. CASE NAME: The full name of the case being analyzed.
2. CASES CITED: For each case cited in the opinion, provide:
   - The full case name
   - The case citation (volume, reporter, page, year)
   - The type (always "case")
   - The context: why the case was cited (what legal point it supports)
   - The treatment: whether it was followed, distinguished, overruled, abrogated, cited with approval, cited with criticism, or merely discussed
3. STATUTES CITED: For each statute cited, provide:
   - The statute name or citation
   - The type (always "statute")
   - The context: what legal point it supports
   - The treatment: how the court treated it (applied, interpreted, struck down, discussed)
4. CONSTITUTIONAL PROVISIONS: For each constitutional provision cited, provide:
   - The provision (e.g., "Fourteenth Amendment Due Process Clause")
   - The type (always "constitutional")
   - The context: what legal point it supports
   - The treatment: how the court treated it (applied, interpreted, discussed)
5. TOTAL CITATIONS: The total number of distinct authorities cited.
6. KEY PRECEDENT: Which single authority was most central to the court's reasoning and why.

Guidelines:
- Use ONLY information from the provided opinion text
- Do not fabricate citations not present in the text
- Be precise about case names and citations
- If a full citation is not available, provide what is known"""


def _build_user_prompt(query: str, context_text: str) -> str:
    return f"""Extract and map all legal citations from the following case.

Query: {query}

Case Text:
{context_text}

Identify all cases, statutes, and constitutional provisions cited."""


class CitationMapService:
    def __init__(self):
        self.retrieval_service = get_retrieval_service()

    def _retrieve_from_rag(self, query: str) -> Optional[tuple[dict, list[SourceDocument]]]:
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
    def _citation_to_markdown(cit: GeneratedCitationMap) -> str:
        parts = [f"# Citation Map: {cit.case_name}"]
        parts.append(f"**Total Authorities Cited:** {cit.total_citations}")
        if cit.cases_cited:
            parts.append("## Cases Cited\n")
            for c in cit.cases_cited:
                line = f"- **{c.name}**"
                if c.citation:
                    line += f", {c.citation}"
                line += f" — {c.context} ({c.treatment})"
                parts.append(line)
        if cit.statutes_cited:
            parts.append("## Statutes Cited\n")
            for s in cit.statutes_cited:
                line = f"- **{s.name}**"
                if s.citation:
                    line += f", {s.citation}"
                line += f" — {s.context} ({s.treatment})"
                parts.append(line)
        if cit.constitutional_provisions:
            parts.append("## Constitutional Provisions\n")
            for p in cit.constitutional_provisions:
                line = f"- **{p.name}**"
                if p.citation:
                    line += f", {p.citation}"
                line += f" — {p.context} ({p.treatment})"
                parts.append(line)
        parts.append(f"## Key Precedent\n\n{cit.key_precedent}")
        return "\n\n".join(parts)

    def generate(self, query: str, document_id: Optional[int] = None, user_id: Optional[int] = None) -> CitationMapResponse:
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
        user_prompt = _build_user_prompt(query, context_text)

        try:
            response = completion(
                model=MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                response_format=GeneratedCitationMap,
                max_tokens=4000,
                temperature=0.3,
            )

            raw = response.choices[0].message.content
            if raw is None:
                raw = getattr(response.choices[0].message, "reasoning_content", None) or ""
            parsed = parse_llm_json(raw)
            cit = GeneratedCitationMap(**parsed)

            try:
                if user_id:
                    md = self._citation_to_markdown(cit)
                    save_document(user_id, f"Citation Map: {cit.case_name}", md, "citation_map")
            except Exception as e:
                logger.warning(f"Failed to save citation map document: {e}")

            return CitationMapResponse(
                case_name=cit.case_name,
                cases_cited=cit.cases_cited,
                statutes_cited=cit.statutes_cited,
                constitutional_provisions=cit.constitutional_provisions,
                total_citations=cit.total_citations,
                key_precedent=cit.key_precedent,
                sources=doc_sources,
            )

        except Exception as e:
            logger.error(f"Citation map generation failed: {e}")
            raise ValueError(f"Failed to generate citation map: {friendly_llm_error(e)}")


citation_map_service = CitationMapService()


def get_citation_map_service() -> CitationMapService:
    return citation_map_service
