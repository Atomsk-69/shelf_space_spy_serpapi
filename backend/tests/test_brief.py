from app import repo
from app.ai.brief import (
    build_inputs,
    generate_text,
    generate_weekly_brief,
    numbers_in,
    template_brief,
    unsupported_numbers,
)
from app.db import initialize_database

MARKET = {"id": 1, "name": "Tents", "category": "Camping tents", "country": "US", "brand_name": "Summit",
          "keywords": ["camping tent"], "competitors": []}

DASHBOARD = {
    "kpis": {"observed_skus": 37, "new_products": 2, "demand_change_pct": 12.5,
             "top_opportunity": {"keyword": "camping tent", "score": 71.3, "label": "Attractive"}},
    "events": [{"type": "PRICE_DECREASE", "severity": "medium", "confidence": "high", "brand": "Coleman",
                "summary": "Coleman Sundome at REI dropped 12.5% (1,200 to 1,050).", "is_demo": True}],
    "shelf_share": [{"brand": "Coleman", "share_pct": 22.4, "is_mine": False, "listings": 6}],
    "opportunities": [{"keyword": "camping tent", "score": 71.3, "label": "Attractive", "demand_growth": 18.0,
                       "supply_growth": -4.2, "reasons": ["Search interest up 18% (last 4 weeks vs prior 8)."],
                       "caveats": ["Includes demo historical data."]}],
    "has_demo_history": True,
    "latest_scan_at": "2026-10-14T12:00:00+00:00",
    "scan_count": 5,
}


def test_number_extraction_normalizes_format():
    assert numbers_in({"a": 1200.0, "b": [-4.2, "dropped 12.5% (1,200 to 1,050)"], "c": True}) >= {
        "1200", "4.2", "12.5", "1050"
    }
    inputs = build_inputs(MARKET, DASHBOARD)
    assert unsupported_numbers("Demand rose 18% and 37 SKUs were seen.", inputs) == []
    assert unsupported_numbers("Demand rose 19% across 1,200 listings.", inputs) == ["19"]
    assert unsupported_numbers("1. First point\n2. Second point", inputs) == []  # list markers are ignored


def test_template_is_deterministic_and_uses_only_input_numbers():
    inputs = build_inputs(MARKET, DASHBOARD)
    text = template_brief(inputs)
    assert text == template_brief(inputs)
    assert "demo data" in text and "Coleman" in text and "Attractive" in text
    assert unsupported_numbers(text, inputs) == []


def test_llm_output_accepted_when_numbers_check_out():
    inputs = build_inputs(MARKET, DASHBOARD)
    content, source, diagnostics = generate_text(inputs, lambda system, user: "Demand is up 18%. Demo data included.")
    assert source == "llm" and content.startswith("Demand") and diagnostics["llm_attempts"] == 1


def test_llm_invented_number_is_regenerated_once_then_template():
    inputs = build_inputs(MARKET, DASHBOARD)
    drafts = iter(["Demand is up 25%.", "Demand is up 18%."])
    prompts = []

    def narrator(system, user):
        prompts.append(user)
        return next(drafts)

    content, source, diagnostics = generate_text(inputs, narrator)
    assert source == "llm" and content == "Demand is up 18%."
    assert "25" in prompts[1] and diagnostics["attempt_1_unsupported_numbers"] == ["25"]

    content, source, _ = generate_text(inputs, lambda s, u: "Up 99% and 98%.")
    assert source == "template" and content == template_brief(inputs)


def test_llm_errors_fall_back_to_template():
    def failing(system, user):
        raise RuntimeError("overloaded")

    content, source, diagnostics = generate_text(build_inputs(MARKET, DASHBOARD), failing)
    assert source == "template" and diagnostics["llm_error"] == "overloaded"


def _mock_anthropic(handler):
    import httpx2
    from anthropic import DefaultHttpxClient

    return DefaultHttpxClient(transport=httpx2.MockTransport(handler))


def _message(text, stop_reason="end_turn"):
    return {
        "id": "msg_test", "type": "message", "role": "assistant", "model": "claude-sonnet-5-5",
        "content": [{"type": "text", "text": text}], "stop_reason": stop_reason, "stop_sequence": None,
        "usage": {"input_tokens": 10, "output_tokens": 5},
    }


def test_anthropic_narrator_request_shape_without_network():
    import json as _json

    import httpx2

    from app.ai.brief import SYSTEM_PROMPT, anthropic_narrator

    seen = {}

    def handler(request):
        seen["url"] = str(request.url)
        seen["beta"] = request.headers.get("anthropic-beta")
        seen["body"] = _json.loads(request.content)
        return httpx2.Response(200, json=_message("Demand is up 18%."))

    narrate = anthropic_narrator("test-key", "claude-sonnet-5-5", http_client=_mock_anthropic(handler))
    assert narrate(SYSTEM_PROMPT, "json here") == "Demand is up 18%."
    assert seen["url"].endswith("/v1/messages?beta=true") or seen["url"].endswith("/v1/messages")
    assert "server-side-fallback-2026-07-01" in seen["beta"]
    body = seen["body"]
    assert body["model"] == "claude-sonnet-5-5" and body["fallbacks"] == "default"
    assert body["system"] == SYSTEM_PROMPT and body["messages"][0]["role"] == "user"
    assert "thinking" not in body and "temperature" not in body


def test_anthropic_refusal_falls_back_to_template():
    import httpx2

    from app.ai.brief import anthropic_narrator

    narrate = anthropic_narrator(
        "test-key", "claude-sonnet-5-5",
        http_client=_mock_anthropic(lambda request: httpx2.Response(200, json=_message("", "refusal"))),
    )
    inputs = build_inputs(MARKET, DASHBOARD)
    content, source, diagnostics = generate_text(inputs, narrate)
    assert source == "template" and "declined" in diagnostics["llm_error"]


def test_no_api_key_persists_template_report():
    initialize_database()
    user_id = repo.create_user("o@example.com", "O", "x$y")
    market_id = repo.create_market(user_id, name="Tents", country="US", category="Camping tents",
                                   brand_name="Summit", keywords=["camping tent"], competitors=[])
    report = generate_weekly_brief({**MARKET, "id": market_id}, DASHBOARD)
    assert report["source"] == "template"
    assert repo.latest_report(market_id)["content"] == report["content"]
