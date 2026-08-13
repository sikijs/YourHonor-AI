import os
import re
import logging
from difflib import SequenceMatcher
from typing import Optional
import json
from pathlib import Path
from litellm import completion
from app.models.legal_glossary import GeneratedGlossaryEntry, GlossaryResponse, CurriculumCard
from app.models.source import SourceDocument, from_rag_results, from_user_upload
from app.services.retrieval import (
    get_retrieval_service,
    deduplicate_rag_results,
    parse_llm_json,
    retrieve_curriculum,
    curriculum_card_from_payload,
    retrieve_glossary_seed,
    glossary_seed_from_payload,
)
from app.services.llm_errors import friendly_llm_error
from app.services.document import load_user_document_content

logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL = "openrouter/qwen/qwen3-14b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}

# Semantic seed-lookup thresholds. all-MiniLM cosine scores for the
# glossary_seed collection sit in a flat band (~0.3-0.55), so selection
# uses two tiers: a confident top-of-band serve, or a lower score that
# still clears a clear margin over the runner-up. See _retrieve_seed_entry.
SEED_SEMANTIC_MIN = 0.35
SEED_CONFIDENT_SCORE = 0.55
SEED_MARGIN = 0.10

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
- Do not include AI disclaimers or self-referential statements
- Respond with ONLY a valid JSON object matching the schema. No markdown, no code fences, no preamble."""


def _build_user_prompt(query: str, context_text: str) -> str:
    return f"""Look up the following legal term and generate a structured glossary entry.

Legal Term: {query}

Source Material:
{context_text}

Generate a comprehensive glossary entry for this legal term.

Respond with ONLY a valid JSON object. No markdown, no code fences, no explanation."""


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
        return self._fuzzy_lookup_seed(key)

    def _fuzzy_lookup_seed(self, key: str, cutoff: float = 0.82) -> Optional[dict]:
        """Best-effort typo tolerance for curated glossary terms.

        A one- or two-character typo (e.g. "habeus corpus") would otherwise
        bypass the curated seed and fall into the slow LLM path. Sequence
        matching is stdlib-only and the curated index is small, so this stays
        cheap. Short queries are skipped to avoid spurious matches.
        """
        if len(key) < 4:
            return None
        best_term = None
        best_ratio = 0.0
        for term in self._seed_index:
            ratio = SequenceMatcher(None, key, term).ratio()
            if ratio > best_ratio:
                best_ratio = ratio
                best_term = term
        if best_term and best_ratio >= cutoff:
            logger.info(f"Fuzzy glossary match: '{key}' -> '{best_term}' (ratio {best_ratio:.2f})")
            return self._seed_index[best_term]
        return None

    _keyword_stopwords = {
        "what", "is", "the", "and", "an", "a", "of", "for", "to", "in",
        "that", "which", "when", "how", "does", "do", "are", "as", "it",
        "on", "with", "under", "legal", "law", "this",
    }

    def _find_curriculum_card(self, query: str, entry: Optional[dict] = None) -> Optional[CurriculumCard]:
        """Return the single best matching AI Tutor curriculum card, or None.

        Deterministic in-memory keyword scan over TOPICS — no LLM call, no
        Qdrant read. Scoring favors the user's own query term first (question
        and expected-concept hits outrank answer-only mentions); related-term
        and definition keywords are used only as a fallback so verbose seed
        text cannot drown out an exact question match.
        """
        from app.services.tutor_data import TOPICS

        def _words(text: str) -> set:
            return set(re.findall(r"[a-z][a-z\-]{2,}", text.lower()))

        query_keywords = _words(query) - self._keyword_stopwords
        if not query_keywords:
            return None

        def _score(card, keywords) -> int:
            question = card.question.lower()
            concepts = " ".join(card.expected_concepts).lower()
            answer = (card.answer or "").lower()
            q_hits = sum(1 for kw in keywords if kw in question)
            c_hits = sum(1 for kw in keywords if kw in concepts)
            a_hits = sum(1 for kw in keywords if kw in answer)
            return q_hits * 3 + c_hits * 3 + a_hits

        def _best_match(keywords):
            best = None
            best_score = 0
            for topic_id, topic in TOPICS.items():
                for card in topic["questions"]:
                    current = _score(card, keywords)
                    if current > best_score:
                        best_score = current
                        best = (topic_id, topic["name"], card)
            return best, best_score

        best, best_score = _best_match(query_keywords)
        if not (best and best_score >= 3):
            fallback_keywords = set(query_keywords)
            if entry:
                if entry.get("term"):
                    fallback_keywords |= _words(str(entry["term"]))
                fallback_keywords |= _words(" ".join(str(t) for t in entry.get("related_terms", [])[:4]))
                definition = entry.get("definition")
                if definition:
                    fallback_keywords |= _words(str(definition)[:400])
            fallback_keywords -= self._keyword_stopwords
            best, best_score = _best_match(fallback_keywords)

        if best and best_score >= 3:
            topic_id, topic_name, card = best
            return CurriculumCard(
                question=card.question,
                answer=card.answer,
                topic_id=topic_id,
                topic_name=topic_name,
                difficulty=card.difficulty,
            )
        return None

    def _retrieve_curriculum_cards(
        self,
        query: str,
        top_k: int = 3,
        min_score: float = 0.25,
        entry: Optional[dict] = None,
    ) -> list[CurriculumCard]:
        """Semantic search for related AI Tutor cards via Qdrant.

        Returns up to ``top_k`` cards. The threshold is intentionally low
        (0.25): curriculum-card scores cluster in the 0.3-0.6 range, and a
        stricter cutoff leaves a single card (or none, forcing the
        single-card keyword fallback). When Qdrant is empty or unavailable,
        falls back to the deterministic in-memory keyword scan (single best
        card), so the related-flashcard badge never blocks a glossary lookup.
        """
        cards: list[CurriculumCard] = []
        try:
            results = retrieve_curriculum(query=query, top_k=top_k, min_score=min_score)
            seen = set()
            for r in results:
                card = curriculum_card_from_payload(r.get("payload"))
                if card is None or card["question"] in seen:
                    continue
                seen.add(card["question"])
                cards.append(CurriculumCard(**card))
                if len(cards) >= top_k:
                    break
        except Exception as e:
            logger.warning(f"Curriculum card retrieval failed: {e}")

        if cards:
            return cards

        fallback = self._find_curriculum_card(query, entry)
        if fallback:
            return [fallback]
        return []

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

    def _retrieve_seed_entry(self, query: str) -> Optional[dict]:
        """Semantic lookup over the curated glossary seed collection.

        Catches close paraphrases ("who inherits when you die without a
        will") that miss every keyword path. all-MiniLM cosine scores for
        this collection cluster in a flat band (roughly 0.3-0.55), so a
        single absolute cutoff is a blunt instrument: 0.55 rejects honest
        paraphrases (paying an LLM call) while a lower cutoff would serve
        near-miss wrong terms (e.g. "trade secret" for "lawyer's duty to
        keep secrets" at 0.54). Selection therefore uses two tiers:

          - best score >= 0.55: serve (unambiguous top-of-band match)
          - best score >= 0.35 with a clear margin over the runner-up:
            serve (genuine matches sit well above their nearest
            competitor, while near-misses cluster together)
          - otherwise None -> the caller falls back to the LLM

        A missing/absent score (mocks, malformed results) is treated as
        zero, i.e. conservative fall-through.
        """
        try:
            results = retrieve_glossary_seed(query=query, top_k=5, min_score=SEED_SEMANTIC_MIN)
            scored = [
                (float(r.get("score") or 0.0), glossary_seed_from_payload(r.get("payload")))
                for r in results
            ]
            scored = [(s, e) for s, e in scored if e is not None]
            if not scored:
                return None
            scored.sort(key=lambda pair: pair[0], reverse=True)
            best_score, best_entry = scored[0]
            if best_score >= SEED_CONFIDENT_SCORE:
                return best_entry
            if (
                best_score >= SEED_SEMANTIC_MIN
                and len(scored) >= 2
                and (best_score - scored[1][0]) >= SEED_MARGIN
            ):
                return best_entry
        except Exception as e:
            logger.warning(f"Glossary seed retrieval failed: {e}")
        return None

    def _seed_response(self, entry: dict, query: str) -> GlossaryResponse:
        """Build the curated GlossaryResponse used by both lookup paths."""
        seed_sources = [SourceDocument(
            title=entry.get("term", query),
            source_type="seed",
        )]
        return GlossaryResponse(
            term=entry.get("term", query),
            definition=entry.get("definition", ""),
            etymology=entry.get("etymology"),
            jurisdiction=entry.get("jurisdiction"),
            usage_example=entry.get("usage_example", ""),
            related_terms=entry.get("related_terms", []),
            also_known_as=entry.get("also_known_as"),
            practice_tips=entry.get("practice_tips"),
            citations=entry.get("citations", []),
            from_seed=True,
            sources=seed_sources,
            related_curriculum=self._retrieve_curriculum_cards(query, entry=entry),
        )

    def lookup(self, query: str, document_id: Optional[int] = None, user_id: Optional[int] = None) -> GlossaryResponse:
        seed_entry = self._lookup_seed(query)
        if seed_entry:
            logger.info(f"Glossary hit via keyword match: '{query}'")
            return self._seed_response(seed_entry, query)

        semantic_entry = self._retrieve_seed_entry(query)
        if semantic_entry:
            logger.info(f"Glossary hit via semantic seed match: '{query}' -> '{semantic_entry['term']}'")
            return self._seed_response(semantic_entry, query)

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

        entry = None
        last_error: Optional[Exception] = None
        for attempt in range(2):
            try:
                response = completion(
                    model=MODEL,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    response_format=GeneratedGlossaryEntry,
                    max_tokens=3000,
                    temperature=0.3,
                    reasoning_effort="low",
                    drop_params=True,
                    timeout=90,
                )

                raw = response.choices[0].message.content
                if raw is None:
                    raw = getattr(response.choices[0].message, "reasoning_content", None) or ""
                parsed = parse_llm_json(raw)
                entry = GeneratedGlossaryEntry(**parsed)
                break
            except Exception as e:
                last_error = e
                logger.warning(f"Glossary lookup attempt {attempt + 1} failed: {e}")

        if entry is None:
            raise ValueError(f"Failed to look up term: {friendly_llm_error(last_error)}")

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
            related_curriculum=self._retrieve_curriculum_cards(query, entry={
                "term": entry.term,
                "definition": entry.definition,
                "related_terms": entry.related_terms,
            }),
        )


glossary_service = GlossaryService()


def get_glossary_service() -> GlossaryService:
    return glossary_service
