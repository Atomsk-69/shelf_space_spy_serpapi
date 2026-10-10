"""Guard: no category-specific logic in the application code.

The demo market's category, keywords and competitors live only in configuration
(backend/.env, .env.example). None of those words may appear in app/ source code.
"""

import re
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
GENERIC_WORDS = {"and", "co", "the", "of", "for", "c", "key", "dot"}


def demo_terms() -> set[str]:
    terms: set[str] = set()
    for line in (BACKEND / ".env.example").read_text(encoding="utf-8").splitlines():
        if not line.startswith(("DEMO_MARKET_", "DEMO_BRAND_NAME", "DEMO_COMPETITORS")):
            continue
        value = line.split("=", 1)[1]
        for word in re.split(r"[^A-Za-z]+", value):
            if len(word) > 3 and word.lower() not in GENERIC_WORDS:
                terms.add(word.lower())
    return terms


def test_demo_category_terms_do_not_appear_in_app_code():
    terms = demo_terms()
    assert "skincare" in terms  # sanity: the example config is what we think it is
    offenders = []
    for path in (BACKEND / "app").rglob("*.py"):
        text = path.read_text(encoding="utf-8").lower()
        for term in terms:
            if re.search(rf"\b{re.escape(term)}\b", text):
                offenders.append(f"{path.relative_to(BACKEND)}: {term}")
    assert offenders == []
