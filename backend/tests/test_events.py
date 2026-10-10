from app.intelligence.events import (
    detect_events,
    discount_events,
    new_competitor_events,
    new_product_events,
    price_events,
    rank_events,
)
from tests.factories import obs


def types(events):
    return sorted(event["type"] for event in events)


def test_no_history_means_no_events():
    assert detect_events([obs("A")], []) == []


def test_price_change_threshold_and_same_offer_only():
    before = [obs("A", price=100.0, source="Shop 1"), obs("B", price=100.0), obs("C", price=100.0, source="Shop 1")]
    after = [
        obs("A", price=95.0, source="Shop 1"),    # exactly 5% -> event
        obs("B", price=95.1),                     # 4.9% -> no event
        obs("C", price=50.0, source="Shop 2"),    # same product, different retailer -> not comparable
    ]
    events = price_events(after, before)
    assert types(events) == ["PRICE_DECREASE"]
    event = events[0]
    assert event["previous_value"] == 100.0 and event["current_value"] == 95.0
    assert event["metadata"]["change_pct"] == -5.0
    assert event["confidence"] == "high" and event["severity"] == "low"
    assert event["metadata"]["caveat"]


def test_price_increase_severity():
    events = price_events([obs("A", price=130.0)], [obs("A", price=100.0)])
    assert events[0]["type"] == "PRICE_INCREASE" and events[0]["severity"] == "high"


def test_discount_started_only_when_new_and_real():
    before = [obs("A", price=100.0), obs("B", price=80.0, old_price=100.0), obs("C", price=100.0)]
    after = [
        obs("A", price=80.0, old_price=100.0),   # discount started
        obs("B", price=80.0, old_price=100.0),   # already discounted
        obs("C", price=100.0, old_price=90.0),   # "old price" below price: not a discount
    ]
    events = discount_events(after, before)
    assert [e["product"] for e in events] == ["A"]
    assert events[0]["metadata"]["discount_pct"] == 20.0


def test_rank_change_threshold():
    before = [obs("A", position=10), obs("B", position=5), obs("C", position=30)]
    after = [obs("A", position=7), obs("B", position=7), obs("C", position=25)]
    events = rank_events(after, before)
    assert types(events) == ["RANK_GAIN"]  # A moved 3; B moved 2; C is too deep on the shelf
    assert events[0]["metadata"]["positions_moved"] == 3
    loss = rank_events([obs("A", position=15)], [obs("A", position=4)])
    assert loss[0]["type"] == "RANK_LOSS" and loss[0]["severity"] == "high"


def test_rank_is_compared_per_probe_keyword():
    before = [obs("A", keyword="k1", position=1), obs("A", keyword="k2", position=10)]
    after = [obs("A", keyword="k1", position=1), obs("A", keyword="k2", position=10)]
    assert rank_events(after, before) == []


def test_new_product_needs_two_scans_of_history():
    history = [[obs("A")], [obs("A")]]
    current = [obs("A"), obs("NEW", position=2, brand="Gamma")]
    assert new_product_events(current, history[:1]) == []
    events = new_product_events(current, history)
    assert len(events) == 1 and events[0]["product"] == "NEW"
    assert events[0]["severity"] == "high" and events[0]["confidence"] == "medium"
    # seen in any earlier scan of the window -> not new (shelf volatility)
    assert new_product_events(current, [[obs("NEW")], [obs("A")]]) == []


def test_new_competitor_excludes_own_brand_and_flags_inferred():
    history = [[obs("A", brand="Alpha")], [obs("A", brand="Alpha")]]
    current = [
        obs("A", brand="Alpha"),
        obs("G", brand="Gamma", position=3, brand_inferred=True),
        obs("M", brand="Mine", position=1),
    ]
    events = new_competitor_events(current, history, own_brand="mine")
    assert [e["brand"] for e in events] == ["Gamma"]
    assert events[0]["confidence"] == "low"  # single listing, brand only guessed
    assert new_competitor_events(current, history[:1]) == []


def test_detect_events_orders_and_marks_own_brand():
    history = [[obs("A", price=100.0, brand="Mine")], [obs("A", price=100.0, brand="Mine")]]
    current = [obs("A", price=70.0, brand="Mine"), obs("B", position=40, brand="Other")]
    events = detect_events(current, history, own_brand="Mine")
    assert events[0]["type"] == "PRICE_DECREASE" and events[0]["metadata"]["is_mine"] is True
    assert {"NEW_PRODUCT", "NEW_COMPETITOR"} <= set(types(events))
    low = [e for e in events if e["type"] == "NEW_PRODUCT"][0]
    assert low["confidence"] == "low"  # deep in the shelf
