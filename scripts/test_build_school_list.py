from build_school_list import compute_composite_score, keyword_match_score, normalize_score

def test_keyword_match_score_counts_hits_capped_at_three():
    text = "low-resource multilingual endangered language benchmark evaluation translation"
    assert keyword_match_score(text) == 3

def test_keyword_match_score_zero_for_unrelated_text():
    assert keyword_match_score("systems programming and compilers") == 0

def test_normalize_score_scales_zero_to_hundred():
    assert normalize_score(50, min_val=0, max_val=100) == 50.0
    assert normalize_score(0, min_val=0, max_val=100) == 0.0
    assert normalize_score(100, min_val=0, max_val=100) == 100.0

def test_normalize_score_handles_equal_min_max():
    assert normalize_score(10, min_val=10, max_val=10) == 0.0

def test_composite_score_gives_verified_fit_a_flat_bonus():
    base = compute_composite_score(normalized_csranking=50, verified_fit=False, keyword_hits=0)
    with_fit = compute_composite_score(normalized_csranking=50, verified_fit=True, keyword_hits=0)
    assert with_fit - base == 25

def test_composite_score_weights_csranking_at_point_six():
    score = compute_composite_score(normalized_csranking=100, verified_fit=False, keyword_hits=0)
    assert score == 60.0
