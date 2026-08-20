import json
import logging
import os
from pathlib import Path
from typing import Optional

from litellm import completion

from app.models.bluebook import (
    BluebookEntry,
    BluebookFormatResponse,
    GeneratedBluebookResult,
)
from app.models.source import SourceDocument
from app.services.llm_errors import friendly_llm_error
from app.services.document_saver import save_document
from app.services.retrieval import parse_llm_json

logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL = "openrouter/qwen/qwen3-14b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}

SEED_PATH = Path(__file__).resolve().parent.parent / "data" / "landmark_seed.json"

SYSTEM_PROMPT = """You are a legal citation expert teaching law students the Bluebook citation system (The Bluebook: A Uniform System of Citation).

Given a list of raw, unformatted, or poorly formatted legal citations, reformat EACH one into a proper Bluebook citation. Follow the Bluebook rules precisely:

- Rule 10 (Cases): full case name in ordinary text, party names as styled by the court, "v." for versus; reporter volume + reporter abbreviation + first page; pinpoint cites use "at"; year in parentheses. Example: Miranda v. Arizona, 384 U.S. 436 (1966). Case names must NOT be italicized in your JSON output.
- Rule 12 (Statutes): official code title and section, e.g. 42 U.S.C. § 1983.
- Rule 8 (Constitutions): e.g. U.S. Const. amend. XIV, § 1.
- Rule 14 (Rules of evidence and procedure): e.g. Fed. R. Civ. P. 12(b)(6).
- Rule 18 (Internet/electronic sources) and Rule 19 (unpublished works) as applicable.

For each entry:
1. FORMULATED: The complete Bluebook-formatted citation.
2. CASE_NAME: If it is a case, the styled case name; otherwise null.
3. AUTHORITY_TYPE: one of "case", "statute", "constitution", "regulation", "rule", "treatise", "article", "internet", or "other".
4. RULES_APPLIED: The Bluebook rule numbers you applied, e.g. ["Rule 10.2.1(a)", "Rule 10.2.1(b)", "Rule 10.6"].
5. NOTES: A one-to-two sentence educational note explaining the formatting changes you made.
6. CONFIDENCE: "high", "medium", or "low" depending on how confidently you can reconstruct a correct citation from the input.

If an input is too vague or garbled to reconstruct confidently, still attempt your best citation and set confidence to "low" with an explanatory note.

Be precise about reporter abbreviations (U.S., S. Ct., F.3d, etc.) and never invent a citation that is not recoverable from the input — if the reporter or page is missing, say so in the notes rather than guessing."""


def _build_user_prompt(raw_citations: list[str]) -> str:
    numbered = "\n".join(f"{i + 1}. {c}" for i, c in enumerate(raw_citations))
    return f"""Reformat the following legal citations according to the Bluebook:

{numbered}

Return one entry per input citation, in the same order, matching the required JSON format."""


def _normalize(text: str) -> str:
    """Normalize a citation for fuzzy matching against the local landmark list."""
    t = text.lower()
    for token in [" v. ", " vs. ", " versus "]:
        t = t.replace(token, " v ")
    t = t.replace(" vs ", " v ")
    t = t.replace(",", " ").replace(".", " ").replace(";", " ")
    return " ".join(t.split())


def _load_local_cases() -> dict[str, dict]:
    """Load the 85 landmark cases: normalized name -> {name, citation, year}."""
    if not SEED_PATH.exists():
        return {}
    with open(SEED_PATH, encoding="utf-8") as f:
        seed = json.load(f)
    lookup: dict[str, dict] = {}
    for case in seed:
        name = case.get("name", "")
        if not name:
            continue
        lookup[_normalize(name)] = {
            "name": name,
            "citation": case.get("citation", ""),
            "year": case.get("year"),
        }
    return lookup


LOCAL_CASES: dict[str, dict] = _load_local_cases()


def _local_entry(raw: str, case: dict) -> BluebookEntry:
    citation = case["citation"].strip()
    year = case["year"]
    formatted = f"{case['name']}, {citation} ({year})"
    return BluebookEntry(
        raw_input=raw.strip(),
        formatted=formatted,
        case_name=case["name"],
        authority_type="case",
        rules_applied=["Rule 10 (case citation)", "Rule 10.2.1 (case names)"],
        notes=(
            "Matched to a curated landmark-case library with its official reporter "
            "citation and decision year."
        ),
        confidence="high",
        from_local=True,
    )


def _match_local(raw: str) -> Optional[dict]:
    """Return the longest landmark case whose normalized name appears in the input.

    Users typically paste the citation too ("miranda v arizona 384 us 436"), so
    the match is a substring containment check rather than full equality. The
    longest match wins to avoid short names matching unrelated input.
    """
    normalized = _normalize(raw)
    best: Optional[tuple[int, dict]] = None
    for name_key, case in LOCAL_CASES.items():
        if name_key and name_key in normalized:
            if best is None or len(name_key) > best[0]:
                best = (len(name_key), case)
    return best[1] if best else None


def format_landmark_case(case_name: str) -> Optional[BluebookEntry]:
    """Public wrapper around the local deterministic Bluebook pass.

    Returns the correctly formatted Bluebook citation for one of the 85
    landmark cases (zero LLM) — used by the dashboard's Citation Drill of the
    Day — or None if the case is not in the local library.
    """
    for case in LOCAL_CASES.values():
        if case["name"] == case_name:
            return _local_entry(case["name"], case)
    return None


def _to_markdown(entries: list[BluebookEntry], general_notes: str) -> str:
    parts = ["# Bluebook Citations", ""]
    for i, entry in enumerate(entries, 1):
        parts.extend(
            [
                f"## {i}. {entry.raw_input}",
                "",
                f"**Formatted:** {entry.formatted}",
                "",
                f"**Type:** {entry.authority_type}",
                "",
            ]
        )
        if entry.rules_applied:
            parts.append("**Rules applied:** " + ", ".join(entry.rules_applied))
            parts.append("")
        if entry.notes:
            parts.append(entry.notes)
            parts.append("")
    if general_notes:
        parts.extend(["## Notes", "", general_notes, ""])
    return "\n".join(parts)


class BluebookService:
    def format_citations(self, text: str, user_id: Optional[int] = None) -> BluebookFormatResponse:
        text = (text or "").strip()
        if not text:
            raise ValueError("Please enter at least one citation to format.")

        raw_list = [line.strip() for line in text.splitlines() if line.strip()]
        if len(raw_list) == 1 and "; " in raw_list[0]:
            raw_list = [p.strip() for p in raw_list[0].split(";") if p.strip()]

        local_by_index: dict[int, BluebookEntry] = {}
        llm_indexes: list[int] = []
        for idx, raw in enumerate(raw_list):
            case = _match_local(raw)
            if case and case["citation"]:
                local_by_index[idx] = _local_entry(raw, case)
            else:
                llm_indexes.append(idx)

        sources_consulted: list[str] = []
        general_notes = ""
        llm_entries: dict[str, BluebookEntry] = {}

        if llm_indexes:
            sources_consulted.append("The Bluebook: A Uniform System of Citation")
            llm_raw = [raw_list[i] for i in llm_indexes]
            try:
                response = completion(
                    model=MODEL,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": _build_user_prompt(llm_raw)},
                    ],
                    response_format=GeneratedBluebookResult,
                    max_tokens=8000,
                    temperature=0.2,
                    reasoning_effort="low",
                    drop_params=True,
                    timeout=180,
                )
                raw = response.choices[0].message.content
                if raw is None:
                    raw = getattr(response.choices[0].message, "reasoning_content", None) or ""
                parsed = parse_llm_json(raw)
                result = GeneratedBluebookResult(**parsed)
                llm_entries = {e.raw_input: e for e in result.entries}
                general_notes = result.general_notes
                sources_consulted.extend(result.sources_consulted or [])
            except Exception as e:
                logger.error(f"Bluebook formatting failed: {e}")
                raise ValueError(f"Failed to format citations: {friendly_llm_error(e)}")

        merged: list[BluebookEntry] = []
        for idx, raw in enumerate(raw_list):
            if idx in local_by_index:
                merged.append(local_by_index[idx])
                continue
            llm_entry = llm_entries.get(raw)
            if llm_entry is None:
                merged.append(
                    BluebookEntry(
                        raw_input=raw,
                        formatted=raw,
                        authority_type="other",
                        notes="The AI response did not include an entry for this citation; it is returned unchanged.",
                        confidence="low",
                    )
                )
            else:
                merged.append(llm_entry)

        try:
            if user_id:
                md = _to_markdown(merged, general_notes)
                save_document(user_id, "Bluebook Citations", md, "bluebook_citations")
        except Exception as e:
            logger.warning(f"Failed to save bluebook document: {e}")

        return BluebookFormatResponse(
            entries=merged,
            general_notes=general_notes,
            sources=[],
            sources_consulted=list(dict.fromkeys(sources_consulted)),
        )


bluebook_service = BluebookService()


def get_bluebook_service() -> BluebookService:
    return bluebook_service