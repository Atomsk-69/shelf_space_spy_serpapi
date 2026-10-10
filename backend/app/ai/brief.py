"""Weekly market brief.

Input is the computed dashboard JSON only. With ``ANTHROPIC_API_KEY`` set, Claude narrates
it; the prompt forbids new numbers and a post-check verifies that every number in the
text appears in the input. A failed check regenerates once, then falls back to the
deterministic template. Without a key (or on any API error) the template is used.
"""

from __future__ import annotations

import json
import logging
import re
from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Any

from app import repo
from app.core.config import get_settings
from app.intelligence.common import fmt_number

logger = logging.getLogger(__name__)

MAX_EVENTS = 8
MAX_BRANDS = 6
FALLBACK_BETA = "server-side-fallback-2026-07-01"

SYSTEM_PROMPT = """You write a short weekly market brief for a small consumer brand.

You receive one JSON object computed by a deterministic analytics pipeline from a sampled
Google Shopping shelf and Google Trends. Rules:
- Use only facts and numbers that appear in the JSON. Never calculate, estimate, round
  differently or invent any number, date, rank or percentage. If a number is not in the
  JSON, describe the point without a number.
- Keep every caveat that matters: sampled shelf visibility is not market share, and if
  "has_demo_history" is true say clearly that part of the history is demo data.
- Structure: a one-line headline, then sections "What changed", "Shelf", "Opportunities"
  and "Watch-outs". Use "-" bullets, never numbered lists. At most 250 words.
- Plain, direct language for a busy founder. No hype."""

Narrator = Callable[[str, str], str]


# --------------------------------------------------------------------------- inputs


def build_inputs(market: dict[str, Any], dashboard: dict[str, Any]) -> dict[str, Any]:
    """The only data the narrator sees."""
    latest = dashboard.get("latest_scan_at")
    period_end = latest[:10] if latest else None
    period_start = (
        (datetime.fromisoformat(latest) - timedelta(days=7)).date().isoformat() if latest else None
    )
    return {
        "market": {
            "name": market["name"],
            "category": market["category"],
            "country": market["country"],
            "my_brand": market.get("brand_name"),
            "probe_keywords": market.get("keywords", []),
        },
        "period": {"start": period_start, "end": period_end, "days": 7},
        "method": {"recent_weeks": 4, "prior_weeks": 8, "score_max": 100},
        "kpis": dashboard.get("kpis", {}),
        "events": [
            {key: event.get(key) for key in ("type", "severity", "confidence", "brand", "summary", "is_demo")}
            for event in dashboard.get("events", [])[:MAX_EVENTS]
        ],
        "shelf_share": dashboard.get("shelf_share", [])[:MAX_BRANDS],
        "opportunities": [
            {key: opp.get(key) for key in ("keyword", "score", "label", "demand_growth", "supply_growth", "reasons", "caveats")}
            for opp in dashboard.get("opportunities", [])
        ],
        "has_demo_history": bool(dashboard.get("has_demo_history")),
        "scan_count": dashboard.get("scan_count", 0),
    }


# --------------------------------------------------------------------------- number guard

_NUMBER = re.compile(r"\d+(?:,\d{3})*(?:\.\d+)?")
_LIST_MARKER = re.compile(r"^\s*\d+[.)]\s+", re.MULTILINE)


def _canonical(number: str) -> str:
    value = float(number.replace(",", ""))
    return f"{value:.2f}".rstrip("0").rstrip(".")


def numbers_in(value: Any) -> set[str]:
    """Every number found in a JSON-like value, in canonical form (no sign, no separators)."""
    found: set[str] = set()
    if isinstance(value, bool) or value is None:
        return found
    if isinstance(value, (int, float)):
        found.add(_canonical(f"{abs(value):.4f}"))
        found.add(_canonical(f"{abs(value):.1f}"))  # the UI shows one decimal: 12.34 -> 12.3
        return found
    if isinstance(value, str):
        return {_canonical(match) for match in _NUMBER.findall(value)}
    if isinstance(value, dict):
        for item in value.values():
            found |= numbers_in(item)
        return found
    if isinstance(value, (list, tuple)):
        for item in value:
            found |= numbers_in(item)
    return found


def unsupported_numbers(text: str, inputs: dict[str, Any]) -> list[str]:
    allowed = numbers_in(inputs)
    cleaned = _LIST_MARKER.sub("", text)
    return sorted({_canonical(n) for n in _NUMBER.findall(cleaned)} - allowed)


# --------------------------------------------------------------------------- template


def template_brief(inputs: dict[str, Any]) -> str:
    market, kpis = inputs["market"], inputs["kpis"]
    lines = [f"Weekly brief: {market['name']} ({market['category']}, {market['country']})"]
    if inputs["period"]["start"]:
        lines.append(f"Period: {inputs['period']['start']} to {inputs['period']['end']}")
    if inputs["has_demo_history"]:
        lines.append("Note: part of the history in this brief is demo data, not real observations.")
    lines.append("")

    headline = f"{fmt_number(kpis.get('observed_skus'))} products observed on the sampled shelf"
    headline += f", {fmt_number(kpis.get('new_products'))} new this week"
    if kpis.get("demand_change_pct") is not None:
        headline += f"; average search interest change across probes {fmt_number(kpis['demand_change_pct'])}%"
    lines.append(headline + ".")
    top = kpis.get("top_opportunity")
    if top:
        lines.append(f"Top opportunity: \"{top['keyword']}\" ({top['label']}, {fmt_number(top['score'])}/100).")

    lines += ["", "What changed"]
    lines += [f"- {event['summary']}" for event in inputs["events"]] or ["- No significant changes detected."]

    lines += ["", "Shelf"]
    for row in inputs["shelf_share"]:
        mine = " (your brand)" if row.get("is_mine") else ""
        lines.append(f"- {row['brand']}{mine}: {fmt_number(row['share_pct'])}% of shelf visibility")
    if not inputs["shelf_share"]:
        lines.append("- No shelf data yet.")

    lines += ["", "Opportunities"]
    for opp in inputs["opportunities"]:
        reasons = " ".join(opp.get("reasons") or [])
        lines.append(f"- {opp['keyword']}: {opp['label']} ({fmt_number(opp['score'])}/100). {reasons}".rstrip())
    if not inputs["opportunities"]:
        lines.append("- Run a scan to score opportunities.")

    caveats = sorted({c for opp in inputs["opportunities"] for c in opp.get("caveats") or []})
    lines += ["", "Watch-outs"]
    lines += [f"- {caveat}" for caveat in caveats] or ["- Visibility on a sampled shelf is not market share."]
    return "\n".join(lines)


# --------------------------------------------------------------------------- LLM


def anthropic_narrator(api_key: str, model: str, http_client: Any = None) -> Narrator:
    """Claude narrator. ``http_client`` (an ``anthropic.DefaultHttpxClient``) is for tests."""
    import anthropic  # imported lazily so the template path never needs the SDK

    options: dict[str, Any] = {"api_key": api_key, "timeout": 60.0, "max_retries": 2}
    if http_client is not None:
        options["http_client"] = http_client
    client = anthropic.Anthropic(**options)

    def narrate(system: str, user: str) -> str:
        response = client.beta.messages.create(
            model=model,
            max_tokens=2000,
            betas=[FALLBACK_BETA],
            fallbacks="default",
            output_config={"effort": "low"},
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        if response.stop_reason == "refusal":
            raise RuntimeError("The model declined to write this brief.")
        text = "".join(block.text for block in response.content if block.type == "text").strip()
        if not text:
            raise RuntimeError("The model returned no text.")
        return text

    return narrate


def _user_prompt(inputs: dict[str, Any], rejected: list[str] | None = None) -> str:
    prompt = "Write this week's brief from this JSON:\n\n" + json.dumps(inputs, indent=2, ensure_ascii=False)
    if rejected:
        prompt += (
            "\n\nYour previous draft used numbers that are not in the JSON: "
            + ", ".join(rejected)
            + ". Rewrite it using only numbers that appear in the JSON."
        )
    return prompt


def generate_text(inputs: dict[str, Any], narrator: Narrator | None) -> tuple[str, str, dict[str, Any]]:
    """Return (content, source, diagnostics). Tries the LLM twice, then the template."""
    diagnostics: dict[str, Any] = {}
    if narrator is not None:
        rejected: list[str] | None = None
        for attempt in (1, 2):
            try:
                text = narrator(SYSTEM_PROMPT, _user_prompt(inputs, rejected))
            except Exception as error:  # any SDK/network failure falls back to the template
                logger.warning("LLM brief failed: %s", error)
                diagnostics["llm_error"] = str(error)
                break
            rejected = unsupported_numbers(text, inputs)
            if not rejected:
                diagnostics["llm_attempts"] = attempt
                return text, "llm", diagnostics
            diagnostics[f"attempt_{attempt}_unsupported_numbers"] = rejected
    return template_brief(inputs), "template", diagnostics


def generate_weekly_brief(market: dict[str, Any], dashboard: dict[str, Any], narrator: Narrator | None = None) -> dict[str, Any]:
    settings = get_settings()
    if narrator is None and settings.anthropic_api_key:
        try:
            narrator = anthropic_narrator(settings.anthropic_api_key, settings.anthropic_model)
        except ImportError:
            logger.warning("anthropic package not installed; using the template brief")
    inputs = build_inputs(market, dashboard)
    content, source, diagnostics = generate_text(inputs, narrator)
    report = repo.insert_report(market["id"], content, {"inputs": inputs, "diagnostics": diagnostics}, source)
    return report
