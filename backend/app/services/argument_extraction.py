import os
import logging
from typing import Optional

from litellm import completion
from app.models.argument_extraction import GeneratedArguments, ArgumentExtractionResponse
from app.services.retrieval import get_retrieval_service, deduplicate_rag_results, parse_llm_json
from app.services.document import load_user_document_content
from app.services.document_saver import save_document

logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL = "openrouter/qwen/qwen3-14b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}

SYSTEM_PROMPT = """You are a legal education assistant specialized in analyzing legal arguments.
Given the text of a court opinion, extract and organize the arguments made by each party.

Extract and organize the following:

1. CASE NAME: The full name of the case.
2. PETITIONER: The party bringing the appeal or bringing the case.
3. RESPONDENT: The party defending against the appeal or the case.
4. PETITIONER'S ARGUMENTS: For each argument made by the petitioner, provide:
   - The specific argument
   - The reasoning supporting it
   - Legal authorities cited (cases, statutes, constitutional provisions)
   - How the court resolved this argument
5. RESPONDENT'S ARGUMENTS: For each argument made by the respondent, provide:
   - The specific argument
   - The reasoning supporting it
   - Legal authorities cited
   - How the court resolved this argument
6. COUNTERARGUMENTS CONSIDERED: Arguments the court itself raised and addressed.
7. KEY DOCTRINES/STATUTES: The most important legal rules invoked in the arguments.
8. WINNING PARTY: Which party prevailed.
9. RATIONALE: The court's overall rationale for its decision.

Guidelines:
- Use ONLY information from the provided opinion text
- Do not fabricate details, arguments, or citations not in the text
- If the text doesn't contain enough information for a section, note what is available
- Write in clear, professional language appropriate for law students
- Be precise about which party made which argument"""


def _build_user_prompt(query: str, context_text: str) -> str:
    return f"""Analyze the legal arguments in the following case.

Query: {query}

Source Text:
{context_text}

Extract and organize all legal arguments made by each party."""


class ArgumentExtractionService:
    def __init__(self):
        self.retrieval_service = get_retrieval_service()

    def _retrieve_from_rag(self, query: str) -> Optional[dict]:
        results = self.retrieval_service.retrieve(
            query=query, top_k=10, min_score=0.3
        )
        results = deduplicate_rag_results(results, min_content_length=200)
        if not results:
            return None
        combined_parts = []
        titles = set()
        sources = set()
        for r in results:
            content = r.get("content", "")
            combined_parts.append(content)
            title = r.get("title", "")
            if title:
                titles.add(title)
            source = r.get("source", "")
            if source:
                sources.add(source)
        if not combined_parts:
            return None
        return {
            "context_text": "\n\n---\n\n".join(combined_parts),
            "titles": list(titles),
            "sources": list(sources),
        }

    @staticmethod
    def _args_to_markdown(args: GeneratedArguments) -> str:
        parts = [f"# Argument Analysis: {args.case_name}"]
        parts.extend([
            f"**Petitioner:** {args.petitioner}",
            f"**Respondent:** {args.respondent}",
        ])
        if args.petitioner_arguments:
            parts.append("## Petitioner's Arguments\n")
            for a in args.petitioner_arguments:
                parts.append(f"**Argument:** {a.argument}")
                parts.append(f"**Reasoning:** {a.reasoning}")
                if a.authorities:
                    parts.append("**Authorities:** " + ", ".join(a.authorities))
                parts.append(f"**Court Resolution:** {a.court_resolution}")
        if args.respondent_arguments:
            parts.append("## Respondent's Arguments\n")
            for a in args.respondent_arguments:
                parts.append(f"**Argument:** {a.argument}")
                parts.append(f"**Reasoning:** {a.reasoning}")
                if a.authorities:
                    parts.append("**Authorities:** " + ", ".join(a.authorities))
                parts.append(f"**Court Resolution:** {a.court_resolution}")
        if args.counterarguments_considered:
            parts.append("## Counterarguments Considered\n\n" + "\n".join(f"- {c}" for c in args.counterarguments_considered))
        if args.key_doctrines_statutes:
            parts.append("## Key Doctrines & Statutes\n\n" + "\n".join(f"- {d}" for d in args.key_doctrines_statutes))
        parts.extend([
            f"**Winning Party:** {args.winning_party}",
            f"## Rationale\n\n{args.rationale}",
        ])
        return "\n\n".join(parts)

    def extract(self, query: str, document_id: Optional[int] = None, user_id: Optional[int] = None) -> ArgumentExtractionResponse:
        user_content = None
        if document_id and user_id:
            user_doc = load_user_document_content(document_id, user_id)
            if user_doc and user_doc["content"]:
                user_content = user_doc

        rag_data = self._retrieve_from_rag(query)

        context_parts = []
        sources = set()
        source_label = "rag"
        if user_content:
            context_parts.append(
                f"## USER UPLOADED DOCUMENT\nTitle: {user_content['title']}\n\n{user_content['content']}"
            )
            sources.add(user_content["title"])
            source_label = "user_upload"
        if rag_data:
            context_parts.append(rag_data["context_text"])
            for s in rag_data.get("sources", []):
                sources.add(s)
            source_label = "rag"

        if not context_parts:
            context_parts.append(
                "No reference materials were found for this query. "
                "Provide a general educational overview based on established legal principles, "
                "noting that authoritative sources may be needed for a complete analysis."
            )
            source_label = "none"

        context_text = "\n\n---\n\n".join(context_parts)
        user_prompt = _build_user_prompt(query, context_text)

        try:
            response = completion(
                model=MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                response_format=GeneratedArguments,
                max_tokens=4000,
                temperature=0.3,
            )

            raw = response.choices[0].message.content
            if raw is None:
                raw = getattr(response.choices[0].message, "reasoning_content", None) or ""
            parsed = parse_llm_json(raw)
            args = GeneratedArguments(**parsed)

            try:
                if user_id:
                    md = self._args_to_markdown(args)
                    save_document(user_id, f"Argument Analysis: {args.case_name}", md, "argument_analysis")
            except Exception as e:
                logger.warning(f"Failed to save argument analysis document: {e}")

            return ArgumentExtractionResponse(
                case_name=args.case_name,
                petitioner=args.petitioner,
                respondent=args.respondent,
                petitioner_arguments=args.petitioner_arguments,
                respondent_arguments=args.respondent_arguments,
                counterarguments_considered=args.counterarguments_considered,
                key_doctrines_statutes=args.key_doctrines_statutes,
                winning_party=args.winning_party,
                rationale=args.rationale,
                source=source_label,
            )

        except Exception as e:
            logger.error(f"Argument extraction failed: {e}")
            raise ValueError(f"Failed to extract arguments: {str(e)}")


argument_extraction_service = ArgumentExtractionService()


def get_argument_extraction_service() -> ArgumentExtractionService:
    return argument_extraction_service
