import os
import logging
from typing import Optional

import httpx
from bs4 import BeautifulSoup

from .template_catalog import get_template_catalog
from app.services.llm_errors import friendly_llm_error, CREDITS_MESSAGE
from app.models.source import from_rag_results, from_web_search

logger = logging.getLogger(__name__)

MODEL = "openrouter/qwen/qwen3-14b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}

TOOL_REGISTRY = {
    "briefs": {
        "name": "Case Briefs",
        "description": "Generate a structured case brief with facts, holding, reasoning, and analysis",
        "keywords": ["case brief", "summarize a case", "case summary", "facts of the case", "holding", "opinion"],
        "suggested_query": None,
    },
    "summaries": {
        "name": "Legal Summaries",
        "description": "Summarize cases, statutes, and legal doctrines with key findings and principles",
        "keywords": ["summarize", "overview of", "explain"],
        "suggested_query": None,
    },
    "arguments": {
        "name": "Argument Extraction",
        "description": "Extract and analyze legal arguments made by each party in a case",
        "keywords": ["arguments", "who argued", "petitioner argued", "respondent argued"],
        "suggested_query": None,
    },
    "citations": {
        "name": "Citation Maps",
        "description": "Map cited authorities, statutes, and constitutional provisions in a case",
        "keywords": ["citations", "cited", "authorities", "precedent", "statutes cited"],
        "suggested_query": None,
    },
    "memoranda": {
        "name": "Legal Memoranda",
        "description": "Draft a structured IRAC legal memorandum on any legal question",
        "keywords": ["memorandum", "memo", "legal analysis", "analyze", "irac", "legal question", "research"],
        "suggested_query": None,
    },
    "debate": {
        "name": "Debate Analysis",
        "description": "Generate structured pro/con arguments and counter-rebuttals for any legal position",
        "keywords": ["debate", "pro and con", "counterargument", "opposing", "both sides", "position on"],
        "suggested_query": None,
    },
    "tutor": {
        "name": "AI Tutor",
        "description": "Learn legal concepts through interactive Socratic dialogue with adaptive questioning",
        "keywords": ["learn", "study", "practice", "teach me", "tutor", "explain", "explain like i'm", "concept"],
        "suggested_query": None,
    },
    "generator": {
        "name": "Document Generator",
        "description": "Generate legal documents from templates with AI-assisted field filling",
        "keywords": ["create a", "draft a", "generate a", "write a", "template", "agreement", "contract", "nda"],
        "suggested_query": None,
    },
    "glossary": {
        "name": "Legal Glossary",
        "description": "Look up legal terms with definitions, etymology, usage examples, and practice tips",
        "keywords": ["define", "definition", "what does", "what is", "meaning of", "meaning", "legal term", "glossary"],
        "suggested_query": None,
    },
}


class ChatService:
    def __init__(self):
        from .retrieval import get_retrieval_service
        self.retrieval_service = get_retrieval_service()

    def _suggest_tool(self, query: str) -> Optional[dict]:
        query_lower = query.lower()
        best_match = None
        best_score = 0
        for tool_id, info in TOOL_REGISTRY.items():
            score = 0
            for kw in info["keywords"]:
                if kw in query_lower:
                    score += 1
            if score > best_score:
                best_score = score
                best_match = tool_id
        if best_match and best_score >= 1:
            info = TOOL_REGISTRY[best_match]
            return {
                "tool": best_match,
                "name": info["name"],
                "description": info["description"],
                "suggested_query": query if not info["suggested_query"] else info["suggested_query"],
            }
        return {
            "tool": "memoranda",
            "name": "Legal Memoranda",
            "description": "Draft a structured IRAC legal memorandum on any legal question",
            "suggested_query": query,
        }

    def _web_search(self, query: str, max_results: int = 5) -> list[dict]:
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            }
            with httpx.Client(timeout=15.0, follow_redirects=True) as client:
                resp = client.post(
                    "https://lite.duckduckgo.com/lite/",
                    data={"q": query},
                    headers=headers,
                )
                resp.raise_for_status()

            soup = BeautifulSoup(resp.text, "html.parser")
            results = []

            result_rows = soup.select("table tr")
            i = 0
            while i < len(result_rows) and len(results) < max_results:
                tds = result_rows[i].find_all("td")
                if len(tds) >= 2:
                    first_text = tds[0].get_text(strip=True)
                    if first_text.rstrip('.').strip().isdigit():
                        title = tds[1].get_text(strip=True)
                        href = ""
                        snippet = ""
                        if i + 1 < len(result_rows):
                            desc_tds = result_rows[i + 1].find_all("td")
                            if len(desc_tds) >= 2:
                                snippet = desc_tds[1].get_text(separator=" ", strip=True)
                        if i + 2 < len(result_rows):
                            url_tds = result_rows[i + 2].find_all("td")
                            if len(url_tds) >= 2:
                                href = url_tds[1].get_text(separator=" ", strip=True)
                        if title:
                            results.append({
                                "title": title,
                                "href": href,
                                "body": snippet,
                            })
                i += 1

            if not results:
                logger.warning(f"DuckDuckGo returned no parseable results for: {query}")
            return results
        except Exception as e:
            logger.warning(f"DuckDuckGo search failed: {e}")
            return []

    def _build_system_prompt(self, context: list[dict] | None = None) -> str:
        catalog = get_template_catalog()
        templates = catalog.get_catalog()
        template_lines = []
        if templates:
            for t in templates:
                fields_str = ", ".join(f.name for f in t.fields) if t.fields else "no fields"
                template_lines.append(f"- {t.name}: {t.description} (fields: {fields_str})")

        context_block = ""
        if context:
            has_web = any(d.get("source") == "web" for d in context)
            parts = []
            for idx, doc in enumerate(context, 1):
                parts.append(f"[Document {idx}]: {doc['title']}\n{doc['content']}")
            context_block = "\n\n### Retrieved Context\n" + "\n\n".join(parts)
            if has_web:
                context_block += "\n\n(Some of the above sources are from web search. Use them conversationally.)"
            else:
                context_block += "\n\n(The above sources are from legal documents. Cite them with [Document #] and include an educational disclaimer.)"

        return f"""You are YourHonor AI, an AI assistant with legal expertise for educational purposes. You help users with both legal and general questions.

## How to Answer
- When context documents are provided below, use them to answer the user's question.
- If no context is provided, answer from your own knowledge. Never fabricate citations.
- For general questions, answer conversationally.
- For legal questions, recommend verifying against primary sources and include an educational disclaimer.
- If the user asks about creating a legal document, identify the best template and list its fields.
- Be concise and direct.
{context_block}
## Available Legal Tools
- Case Briefs: Generate structured case briefs with facts, holding, reasoning.
- Legal Summaries: Summarize cases, statutes, and legal doctrines.
- Argument Extraction: Extract arguments made by each party in a case.
- Citation Maps: Map cited authorities, statutes, and constitutional provisions.
- Legal Memoranda: Draft IRAC legal memoranda on any legal question.
- Debate Analysis: Generate pro/con arguments with counter-rebuttals.
- AI Tutor: Interactive Socratic tutoring on legal concepts.
- Document Generator: Generate legal documents from templates.

## Available Legal Templates
{chr(10).join(template_lines) if template_lines else "No templates loaded."}"""

    def generate_response_stream(self, user_message: str, user_id: Optional[int] = None, top_k: int = 8, history: Optional[list[dict]] = None):
        import json

        retrieved_docs = self.retrieval_service.retrieve(query=user_message, top_k=top_k, min_score=0.35)
        from .retrieval import deduplicate_rag_results
        retrieved_docs = deduplicate_rag_results(retrieved_docs, min_content_length=200)

        sources = from_rag_results(retrieved_docs)
        sources_flat = [
            {"title": s.title, "source": s.source_type, "relevance_score": s.relevance_score or 0.0, "url": s.url}
            for s in sources
        ]

        if len(retrieved_docs) < 3:
            web_results = self._web_search(user_message)
            for r in web_results:
                retrieved_docs.append({"title": r["title"], "content": f"{r['body']}\n\n(source: web — {r['href']})", "source": "web", "score": 0.0})
            web_sources = from_web_search(web_results)
            for ws in web_sources:
                sources.append(ws)
                sources_flat.append({"title": ws.title, "source": ws.source_type, "relevance_score": ws.relevance_score or 0.0, "url": ws.url})

        suggestion = self._suggest_tool(user_message)

        yield f"data: {json.dumps({'type': 'meta', 'sources': sources_flat, 'source_docs': [s.model_dump() for s in sources], 'retrieval_count': len(retrieved_docs), 'suggested_tool': suggestion['tool'], 'suggested_name': suggestion['name'], 'suggested_description': suggestion['description'], 'suggested_query': suggestion['suggested_query']})}\n\n"

        try:
            from litellm import completion
            history_messages = (history or [])[-10:]
            messages = [{"role": "system", "content": self._build_system_prompt(retrieved_docs)}]
            for h in history_messages:
                messages.append({"role": h["role"], "content": h["content"]})
            messages.append({"role": "user", "content": user_message})

            response = completion(model=MODEL, messages=messages, max_tokens=1500, temperature=0.3, extra_body=EXTRA_BODY, stream=True)

            for chunk in response:
                delta = chunk.choices[0].delta
                text = getattr(delta, "content", None) or getattr(delta, "reasoning_content", None) or ""
                if text:
                    yield f"data: {json.dumps({'type': 'chunk', 'text': text})}\n\n"

            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as e:
            logger.error(f"Chat stream LLM call failed: {e}")
            error_msg = friendly_llm_error(e)
            chat_response = CREDITS_MESSAGE if error_msg != str(e) else f"I encountered an error generating a response. Try using the **{suggestion['name']}** tool instead.\n\n**{suggestion['name']}**: {suggestion['description']}"
            yield f"data: {json.dumps({'type': 'error', 'text': chat_response})}\n\n"

    def generate_response(self, user_message: str, user_id: Optional[int] = None, top_k: int = 8, history: Optional[list[dict]] = None) -> dict:
        retrieved_docs = self.retrieval_service.retrieve(
            query=user_message,
            top_k=top_k,
            min_score=0.35,
        )

        from .retrieval import deduplicate_rag_results
        retrieved_docs = deduplicate_rag_results(retrieved_docs, min_content_length=200)

        source_docs = from_rag_results(retrieved_docs)
        sources = [
            {
                "title": s.title,
                "source": s.source_type,
                "relevance_score": s.relevance_score or 0.0,
                "url": s.url,
            }
            for s in source_docs
        ]

        web_results = []
        if len(retrieved_docs) < 3:
            web_results = self._web_search(user_message)
            if web_results:
                for r in web_results:
                    retrieved_docs.append({
                        "title": r["title"],
                        "content": f"{r['body']}\n\n(source: web — {r['href']})",
                        "source": "web",
                        "score": 0.0,
                    })
                web_sources = from_web_search(web_results)
                for ws in web_sources:
                    source_docs.append(ws)
                    sources.append({
                        "title": ws.title,
                        "source": ws.source_type,
                        "relevance_score": ws.relevance_score or 0.0,
                        "url": ws.url,
                    })

        suggestion = self._suggest_tool(user_message)

        try:
            from litellm import completion
            history_messages = (history or [])[-10:]
            messages = [
                {"role": "system", "content": self._build_system_prompt(retrieved_docs)},
            ]
            for h in history_messages:
                messages.append({"role": h["role"], "content": h["content"]})
            messages.append({"role": "user", "content": user_message})

            response = completion(
                model=MODEL,
                messages=messages,
                max_tokens=1500,
                temperature=0.3,
                extra_body=EXTRA_BODY,
            )

            raw = response.choices[0].message.content
            if raw is None:
                raw = getattr(response.choices[0].message, "reasoning_content", None) or ""

            return {
                "response": raw,
                "sources": sources,
                "source_docs": [s.model_dump() for s in source_docs],
                "retrieval_count": len(retrieved_docs),
                "suggested_tool": suggestion["tool"],
                "suggested_name": suggestion["name"],
                "suggested_description": suggestion["description"],
                "suggested_query": suggestion["suggested_query"],
            }

        except Exception as e:
            logger.error(f"Chat LLM call failed: {e}")
            error_msg = friendly_llm_error(e)
            chat_response = CREDITS_MESSAGE if error_msg != str(e) else f"I encountered an error generating a response. Try using the **{suggestion['name']}** tool instead.\n\n**{suggestion['name']}**: {suggestion['description']}"
            return {
                "response": chat_response,
                "sources": sources,
                "source_docs": [s.model_dump() for s in source_docs],
                "retrieval_count": len(retrieved_docs),
                "suggested_tool": suggestion["tool"],
                "suggested_name": suggestion["name"],
                "suggested_description": suggestion["description"],
                "suggested_query": suggestion["suggested_query"],
            }


chat_service = ChatService()


def get_chat_service() -> ChatService:
    return chat_service
