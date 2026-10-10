from app.services.normalize import (
    CanonicalIndex,
    brand_candidates,
    detect_brand,
    detect_brands,
    extract_size,
    normalize_products,
    normalize_title,
    offer_key,
    source_key,
    standardize_units,
)


def test_unit_standardization_and_title_normalization():
    assert standardize_units("Bottle 30 ml") == "Bottle 30ml"
    assert standardize_units("1.7 fl. oz") == "1.7floz"
    assert standardize_units("500 Grams pack") == "500g pack"
    assert standardize_units("10 %") == "10pct"
    assert normalize_title("The NEW Trail Shoe, 2 Pack - 30 ML!") == "trail shoe 2 pack 30ml"
    assert normalize_title("Widget & Gadget for Kids") == "widget gadget kids"


def test_extract_size():
    assert extract_size("Hydration Pack 1.5 L Blue") == "1.5l"
    assert extract_size("Protein Powder 2 lbs") == "2lb"
    assert extract_size("Running shoe") is None


def test_source_key_strips_domains_and_sub_shops():
    assert source_key("Amazon.com") == "amazon"
    assert source_key("amazon.in") == "amazon"
    assert source_key("Purplle.com - Purplle Shop") == "purplle"
    assert source_key("Dick's Sporting Goods") == "dickssportinggoods"
    assert source_key(None) == ""


def test_known_brand_wins_and_matches_multiword_names():
    match = detect_brand("Dot & Key Strawberry Dew Gel 50ml", ["Dot & Key", "Key"])
    assert match.name == "Dot & Key" and match.method == "known" and not match.inferred
    # earliest occurrence wins when several known brands appear
    assert detect_brand("Hoka vs Nike comparison", ["Nike", "Hoka"]).name == "Hoka"


def test_pattern_and_first_token_detection():
    assert detect_brand("Daily Fluid Gel | All Types | Tested By WishCare").name == "WishCare"
    assert detect_brand("Daily Fluid Gel | All Types | Tested By WishCare").method == "pattern"
    # "by X" in the middle of a title is marketing copy, not a brand
    assert detect_brand("Acme Serum, Powered by Deep Penetration Formula | 20 ml").name == "Acme"
    assert detect_brand("Trailblazer | Waterproof Hiking Boot").name == "Trailblazer"
    guess = detect_brand("Brooks Ghost 16 Running Shoes")
    assert guess.name == "Brooks" and guess.inferred
    assert detect_brand("The Derma Co 1% Gel").name == "The Derma Co"
    assert detect_brand("Dot & Key Strawberry").name == "Dot & Key"
    assert detect_brand("10% Off Running Shoes") is None
    assert detect_brand("New Lightweight Sneakers") is None
    assert detect_brand("") is None


def test_multi_brand_retailer_is_not_a_brand_but_brand_store_is():
    products = [
        {"title": "Amazon Basics Yoga Mat", "source": "Amazon.com"},
        {"title": "Gaiam Yoga Mat 6mm", "source": "Amazon.com"},
        {"title": "Manduka PRO Yoga Mat", "source": "Manduka"},
        {"title": "Manduka eKO Lite Mat", "source": "REI"},
    ]
    matches = detect_brands(products)
    assert matches[0] is None  # "Amazon" is the retailer selling several brands
    assert matches[1].name == "Gaiam"
    assert matches[2].name == "Manduka"  # single-brand store keeps its brand


def test_brand_candidates_counts_and_inferred_flags():
    products = [
        {"title": "Brooks Ghost 16", "source": "REI"},
        {"title": "Brooks Glycerin 21", "source": "Zappos"},
        {"title": "Zorbo Trail Runner", "source": "Walmart"},
        {"title": "Hoka Clifton 9", "source": "REI"},
    ]
    candidates = brand_candidates(products, known_brands=["Hoka"])
    by_name = {c["name"]: c for c in candidates}
    assert by_name["Brooks"] == {"name": "Brooks", "count": 2, "inferred": False}  # seen at 2 retailers
    assert by_name["Zorbo"]["inferred"] is True  # single sighting, first-token guess
    assert by_name["Hoka"]["inferred"] is False  # user-confirmed
    assert candidates[-1]["name"] == "Zorbo"  # guesses rank after confirmed brands


def test_canonical_index_matching_order():
    index = CanonicalIndex()
    first = index.assign("111", "Brooks Ghost 16 Running Shoe 10.5", "Brooks")
    assert first == "pid:111"
    # 1. same product_id
    assert index.assign("111", "Completely different title", "Brooks") == first
    # 2. exact normalized title (punctuation/case/filler differences only)
    assert index.assign("222", "BROOKS Ghost 16 - Running Shoe, 10.5", "Brooks") == first
    # 3. brand + size + core words, different word order
    sig = index.assign("333", "Hydro Flask Bottle Wide Mouth 32 oz", "Hydro Flask")
    assert index.assign("444", "Hydro Flask Wide Mouth Bottle 32 oz Black Edition", "Hydro Flask") == sig
    # 4. fuzzy fallback within the same brand
    fuzzy = index.assign("555", "Garmin Forerunner 265 GPS Running Smartwatch Black", "Garmin")
    assert index.assign("556", "Garmin Forerunner 265 GPS Running Smart watch Black", "Garmin") == fuzzy
    # different numbers are different products even when titles are close
    assert index.assign("666", "Garmin Forerunner 965 GPS Running Smartwatch Black", "Garmin") != fuzzy
    # no product id: stable hash key
    assert index.assign(None, "Generic Water Bottle", None).startswith("t:")


def test_normalize_products_keeps_keys_stable_across_scans():
    scan1 = normalize_products(
        [{"title": "Hoka Clifton 9 Running Shoe", "source": "REI", "product_id": "9"}], ["Hoka"]
    )
    scan2 = normalize_products(
        [{"title": "HOKA Clifton 9 running shoe", "source": "Zappos", "product_id": "10"}], ["Hoka"], history=scan1
    )
    assert scan1[0]["brand"] == "Hoka" and scan1[0]["brand_inferred"] is False
    assert scan2[0]["canonical_key"] == scan1[0]["canonical_key"]


def test_offer_key_requires_same_retailer():
    a = {"product_id": "1", "source": "REI"}
    b = {"product_id": "1", "source": "Zappos"}
    assert offer_key(a) != offer_key(b)
    assert offer_key(a) == offer_key({"product_id": "1", "source": "rei"})
