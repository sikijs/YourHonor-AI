from app.models.source import (
    SourceDocument,
    build_source_url,
    from_courtlistener_case,
    from_rag_result,
    from_web_search,
)
from app.services.chat import _normalize_web_url


def test_normalize_web_url_scheme_less():
    assert _normalize_web_url("en.wikipedia.org/wiki/Habeas_corpus") == "https://en.wikipedia.org/wiki/Habeas_corpus"


def test_normalize_web_url_scheme_relative():
    assert _normalize_web_url("//example.com/path") == "https://example.com/path"


def test_normalize_web_url_already_absolute():
    assert _normalize_web_url("https://example.com/x") == "https://example.com/x"
    assert _normalize_web_url("http://example.com/x") == "http://example.com/x"


def test_normalize_web_url_duckduckgo_redirect():
    import base64
    target = "https://en.wikipedia.org/wiki/Habeas_corpus"
    encoded = base64.urlsafe_b64encode(target.encode()).decode()
    href = f"//duckduckgo.com/l/?uddg={encoded}&rut=abc"
    assert _normalize_web_url(href) == target


def test_normalize_web_url_duckduckgo_redirect_fallback():
    href = "//duckduckgo.com/l/?uddg=not-base64&rut=abc"
    assert _normalize_web_url(href) == "https:" + href


def test_normalize_web_url_empty_and_garbage():
    assert _normalize_web_url("") == ""
    assert _normalize_web_url("   ") == ""
    assert _normalize_web_url("not a url") == "https://not"


def test_normalize_web_url_truncates_trailing_date():
    assert _normalize_web_url("https://www.brennancenter.org/our-work/x 2025-06-18T00:00:00.0000000") == "https://www.brennancenter.org/our-work/x"
    assert _normalize_web_url("www.example.com/path 2026-01-01T00:00:00.0000000") == "https://www.example.com/path"


def test_build_source_url_opinion():
    assert build_source_url(123, None) == "https://www.courtlistener.com/opinion/123/"


def test_build_source_url_cluster():
    assert build_source_url(None, 456) == "https://www.courtlistener.com/cluster/456/"


def test_build_source_url_title_fallback():
    url = build_source_url(None, None, "Roe v. Wade")
    assert url == "https://www.courtlistener.com/?q=Roe%20v.%20Wade"


def test_build_source_url_none():
    assert build_source_url(None, None) is None


def test_from_rag_result_title_fallback_url():
    s = from_rag_result({"title": "Gideon v. Wainwright", "source": "seed", "score": 0.509})
    assert s is not None
    assert s.url == "https://www.courtlistener.com/?q=Gideon%20v.%20Wainwright"
    assert s.relevance_score == 0.509


def test_from_rag_result_courtlistener_url():
    s = from_rag_result({
        "title": "Roe v. Wade",
        "opinion_id": 100,
        "cluster_id": 200,
        "score": 0.8,
    })
    assert s is not None
    assert s.url == "https://www.courtlistener.com/opinion/100/"


def test_from_web_search_null_score():
    sources = from_web_search([{"title": "Wikipedia", "href": "https://en.wikipedia.org/wiki/X"}])
    assert len(sources) == 1
    assert sources[0].relevance_score is None
    assert sources[0].url == "https://en.wikipedia.org/wiki/X"
    assert sources[0].source_type == "web"


def test_from_web_search_keeps_explicit_score():
    sources = from_web_search([{"title": "X", "href": "https://x.com", "relevance_score": 0.5}])
    assert sources[0].relevance_score == 0.5


def test_from_courtlistener_case_prefers_absolute_url():
    sources = from_courtlistener_case({
        "case_name": "Rasul v. Bush",
        "cluster_id": 12345,
        "citation": ["542 U.S. 466"],
        "url": "https://www.courtlistener.com/opinion/12345/rasul-v-bush/",
    })
    assert sources[0].url == "https://www.courtlistener.com/opinion/12345/rasul-v-bush/"


def test_from_courtlistener_case_falls_back_to_id_url():
    sources = from_courtlistener_case({
        "case_name": "Rasul v. Bush",
        "opinion_id": 999,
        "citation": ["542 U.S. 466"],
    })
    assert sources[0].url == "https://www.courtlistener.com/opinion/999/"