import os
import logging
from typing import Optional
import json
from pathlib import Path
from litellm import completion
from app.models.legal_glossary import GeneratedGlossaryEntry, GlossaryResponse
from app.models.source import SourceDocument, from_rag_results, from_user_upload
from app.services.retrieval import get_retrieval_service, deduplicate_rag_results, parse_llm_json
from app.services.llm_errors import friendly_llm_error
from app.services.document import load_user_document_content

logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL = "openrouter/qwen/qwen3-14b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}

SYSTEM_PROMPT = """You are a legal glossary assistant specializing in defining legal terms and providing educational explanations for law students.

Given a legal term and relevant source material, generate a structured glossary entry:

1. TERM: The legal term being defined.
2. DEFINITION: A clear, accurate, and concise definition suitable for law students.
3. ETYMOLOGY: The origin and linguistic history of the term (optional but preferred).
4. JURISDICTION: Where this term applies (e.g., US federal, common law, UK).
5. USAGE EXAMPLE: A concrete example showing how the term is used in legal writing or practice.
6. RELATED TERMS: List of related or similar legal terms.
7. ALSO KNOWN AS: Alternative names or spellings (if any).
8. PRACTICE TIPS: Practical advice for law students on how to understand or use this term.
9. CITATIONS: Sources used to generate the definition, citing specific legal sources, treatises, or case law.

Guidelines:
- Base definitions on established legal principles and the provided source material
- Do not fabricate citations — use only what is provided or well-established legal authorities
- Write in clear, professional language appropriate for law students
- Definitions should be accurate and reflect consensus legal understanding
- Do not include AI disclaimers or self-referential statements"""


def _build_user_prompt(query: str, context_text: str) -> str:
    return f"""Look up the following legal term and generate a structured glossary entry.

Legal Term: {query}

Source Material:
{context_text}

Generate a comprehensive glossary entry for this legal term."""


_SEED_DATA: list[dict] | None = None


def _load_seed_data() -> list[dict]:
    global _SEED_DATA
    if _SEED_DATA is not None:
        return _SEED_DATA
    seed_path = Path(__file__).parent.parent / "data" / "glossary_seed.json"
    if seed_path.exists():
        try:
            with open(seed_path) as f:
                _SEED_DATA = json.load(f)
            logger.info(f"Loaded {len(_SEED_DATA)} seed glossary entries")
        except Exception as e:
            logger.warning(f"Failed to load seed glossary: {e}")
            _SEED_DATA = []
    else:
        logger.warning(f"Seed glossary not found at {seed_path}")
        _SEED_DATA = []
    return _SEED_DATA


class GlossaryService:
    def __init__(self):
        self.retrieval_service = get_retrieval_service()
        self._seed = _load_seed_data()
        self._seed_index: dict[str, dict] | None = None

    def _build_index(self):
        if self._seed_index is not None:
            return
        self._seed_index = {}
        for entry in self._seed:
            term = entry.get("term", "").strip().lower()
            if term:
                self._seed_index[term] = entry
        logger.info(f"Indexed {len(self._seed_index)} seed glossary terms")

    def _lookup_seed(self, query: str) -> Optional[dict]:
        if self._seed_index is None:
            self._build_index()
        key = query.strip().lower()
        if key in self._seed_index:
            return self._seed_index[key]
        for term, entry in self._seed_index.items():
            if key in term or term in key:
                return entry
        return None

    def _retrieve_from_rag(self, query: str) -> tuple[Optional[dict], list[SourceDocument]]:
        results = self.retrieval_service.retrieve(
            query=query, top_k=10, min_score=0.5
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

    def lookup(self, query: str, document_id: Optional[int] = None, user_id: Optional[int] = None) -> GlossaryResponse:
        seed_entry = self._lookup_seed(query)
        if seed_entry:
            seed_sources = [SourceDocument(
                title=seed_entry.get("term", query),
                source_type="seed",
            )]
            return GlossaryResponse(
                term=seed_entry.get("term", query),
                definition=seed_entry.get("definition", ""),
                etymology=seed_entry.get("etymology"),
                jurisdiction=seed_entry.get("jurisdiction"),
                usage_example=seed_entry.get("usage_example", ""),
                related_terms=seed_entry.get("related_terms", []),
                also_known_as=seed_entry.get("also_known_as"),
                practice_tips=seed_entry.get("practice_tips"),
                citations=seed_entry.get("citations", []),
                from_seed=True,
                sources=seed_sources,
            )

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

        context_text = "\n\n---\n\n".join(context_parts) if context_parts else "No specific source material available. Base the definition on established legal principles."

        user_prompt = _build_user_prompt(query, context_text)

        try:
            response = completion(
                model=MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                response_format=GeneratedGlossaryEntry,
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
            entry = GeneratedGlossaryEntry(**parsed)

            return GlossaryResponse(
                term=entry.term,
                definition=entry.definition,
                etymology=entry.etymology,
                jurisdiction=entry.jurisdiction,
                usage_example=entry.usage_example,
                related_terms=entry.related_terms,
                also_known_as=entry.also_known_as,
                practice_tips=entry.practice_tips,
                citations=entry.citations,
                from_seed=False,
                sources=doc_sources,
            )

        except Exception as e:
            logger.error(f"Glossary lookup failed: {e}")
            raise ValueError(f"Failed to look up term: {friendly_llm_error(e)}")


glossary_service = GlossaryService()


def get_glossary_service() -> GlossaryService:
    return glossary_service
