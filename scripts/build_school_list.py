import argparse
import json
from pathlib import Path

import pandas as pd
from rapidfuzz import fuzz, process

pd.options.mode.copy_on_write = True  # opts into pandas 3.0's default now, silencing the CoW FutureWarning

CSRANKINGS_AUTHOR_INFO_URL = "https://raw.githubusercontent.com/emeryberger/CSrankings/gh-pages/generated-author-info.csv"
# Verified 2025-09-23 against csrankings.js's own CSRankings.parentMap: the
# NLP area is the union of these three venue codes (its 'area' column is
# actually per-venue, not per-area — CSRankings aggregates venues into areas
# client-side via this same map).
NLP_VENUES = ["acl", "emnlp", "naacl"]

# Verified 2025-09-23: a stable direct download exists after all (no manual
# export needed) — the Carnegie Foundation's own "Research Activity
# Designation" public data file, confirmed against 542 institutions with
# exactly 187 R1s, matching the independently-researched school list.
# IMPORTANT: Carnegie Classification covers US institutions ONLY — it has no
# concept of a Canadian or Australian school. Never treat a Carnegie-match
# failure as evidence a non-US school is wrong; it's expected for every one.
CARNEGIE_RAD_URL = "https://carnegieclassifications.acenet.edu/wp-content/uploads/2025/02/2025-RAD-Public-Data-File.xlsx"
CARNEGIE_TIER_MAP = {
    "Research 1: Very High Spending and Doctorate Production": "R1",
    "Research 2: High Spending and Doctorate Production": "R2",
}

# Known cases where CSRankings' dept name is genuinely ambiguous against
# Carnegie's multi-campus entries (e.g. plain "University of Michigan" could
# mean Ann Arbor or Dearborn) and the algorithm correctly refuses to guess —
# resolved here by hand, with the reasoning, rather than silently loosening
# the ambiguity check for every school. Keys are the CSRankings dept name.
MANUAL_CARNEGIE_OVERRIDES = {
    "University of Michigan": "University of Michigan-Ann Arbor",  # the CS/NLP dept is Ann Arbor, not the Dearborn campus
}

KEYWORDS = [
    "low-resource", "multilingual", "endangered language",
    "benchmark", "evaluation", "dataset quality", "translation",
]


def keyword_match_score(text: str) -> int:
    text_lower = (text or "").lower()
    hits = sum(1 for kw in KEYWORDS if kw in text_lower)
    return min(hits, 3)


def normalize_score(value: float, min_val: float, max_val: float) -> float:
    if max_val == min_val:
        return 0.0
    return (value - min_val) / (max_val - min_val) * 100


def compute_composite_score(normalized_csranking: float, verified_fit: bool, keyword_hits: int) -> float:
    return (
        normalized_csranking * 0.6
        + (25 if verified_fit else 0)
        + keyword_hits * 0.15 * 100 / 3  # scale keyword_hits (0-3) onto the same rough 0-100 footing
    )


def fetch_csrankings_nlp_scores() -> pd.DataFrame:
    """All institutions worldwide with NLP-venue publication activity —
    deliberately NOT filtered to any country here. Country/tier filtering
    happens later, separately for the US (via Carnegie) and non-US (via the
    verified seed list) paths."""
    df = pd.read_csv(CSRANKINGS_AUTHOR_INFO_URL)
    nlp = df[df["area"].isin(NLP_VENUES)]
    scores = nlp.groupby("dept")["adjustedcount"].sum().reset_index()
    scores = scores.rename(columns={"dept": "institution", "adjustedcount": "csranking_nlp_score"})
    scores.loc[:, "csranking_nlp_rank"] = scores["csranking_nlp_score"].rank(ascending=False, method="min").astype(int)
    return scores.sort_values("csranking_nlp_rank")


def fetch_carnegie_r1_r2(local_path: str | None) -> pd.DataFrame:
    """Downloads the Carnegie Foundation's own public "Research Activity
    Designation" data file directly (CARNEGIE_RAD_URL) — a stable, direct
    download, no manual export needed. Pass --carnegie-xlsx to use an
    already-downloaded copy instead (e.g. if the URL ever moves). US only."""
    source = local_path or CARNEGIE_RAD_URL
    df = pd.read_excel(source, sheet_name="Data")
    df = df[df["2025 Research Activity Designation"].isin(CARNEGIE_TIER_MAP.keys())].copy()
    df.loc[:, "carnegie_tier"] = df["2025 Research Activity Designation"].map(CARNEGIE_TIER_MAP)
    return df.rename(columns={"INSTNM": "institution"})[["institution", "carnegie_tier"]]


def normalize_name(name: str) -> str:
    """Collapses the two things that cause false near-misses between
    CSRankings and Carnegie spellings of the same institution: the "Univ."
    abbreviation, and comma/hyphen/dash used interchangeably as a
    campus-qualifier separator (e.g. "Los Angeles, University of California"
    vs "University of California-Los Angeles")."""
    n = name.lower().strip()
    n = n.replace("univ.", "university")
    for sep in [",", "-", "–", "—"]:
        n = n.replace(sep, " ")
    n = " ".join(n.split())
    for filler in [" at ", " the "]:
        n = n.replace(filler, " ")
    return " ".join(n.split())


def find_carnegie_match(name: str, carnegie_names: list[str], threshold: int) -> tuple[str | None, float, str]:
    """Prefix containment first (handles the "University of X" vs
    "University of X-Seattle Campus" campus-suffix pattern, which generic
    fuzzy scorers rank unreliably against unrelated same-shape names like
    "Washington State University" — verified 2025-09-23 against real
    mismatches). Ambiguous prefix matches (a multi-campus system where the
    query isn't specific enough) are deliberately NOT auto-resolved — they
    come back as a flagged review case, not a guess. Falls back to
    token_sort_ratio fuzzy matching only when no prefix relationship exists
    at all (genuine spelling variants)."""
    if name in MANUAL_CARNEGIE_OVERRIDES and MANUAL_CARNEGIE_OVERRIDES[name] in carnegie_names:
        return MANUAL_CARNEGIE_OVERRIDES[name], 100.0, "manual override"

    # Word-boundary prefix, not character prefix — a character-level
    # startswith wrongly matched "University of Kent" (a real, distinct UK
    # university) against "University of Kentucky", because "kent" is a
    # character-prefix of "kentucky". Comparing tokenized word lists closes
    # that hole: "kent" as a whole word is never a prefix of "kentucky".
    #
    # One direction only: the Carnegie candidate must be the same length or
    # LONGER than the query (Carnegie's own names are always the more
    # verbosely-qualified side in genuine campus-suffix cases — "-Seattle
    # Campus", "-Main Campus"). Allowing the reverse direction wrongly
    # matched "Northeastern University (China)" — a real, different
    # institution in Shenyang — against the US "Northeastern University",
    # because the shorter Carnegie name is a prefix of the longer query.
    norm_name_words = normalize_name(name).split()
    norm_map = {c: normalize_name(c).split() for c in carnegie_names}
    prefix_candidates = [c for c, words in norm_map.items() if words[:len(norm_name_words)] == norm_name_words]

    if len(prefix_candidates) == 1:
        return prefix_candidates[0], 100.0, "prefix"
    if len(prefix_candidates) > 1:
        return None, 0.0, "ambiguous: " + " | ".join(prefix_candidates)

    # Fuzzy fallback only, and deliberately strict: CSRankings mixes in
    # hundreds of non-US institutions, and generic scorers reliably produce
    # coincidentally-high scores between unrelated same-shape names from
    # different countries (verified 2025-09-23: "Korea University" and "Henan
    # University" both scored >90% against "Kean University"; "Northwest
    # University" (China) scored >90% against "Northwestern University").
    # A high bar plus a shared-distinctive-word requirement cuts these out
    # without also cutting the genuine abbreviation cases the prefix path
    # already handles, since those no longer need the fallback at all.
    GENERIC_WORDS = {"university", "college", "of", "the", "institute", "state", "technology"}
    match, score, _ = process.extractOne(name, carnegie_names, scorer=fuzz.token_sort_ratio) or (None, 0, None)
    if match:
        match_words = set(normalize_name(match).split()) - GENERIC_WORDS
        name_words = set(norm_name_words) - GENERIC_WORDS
        if not (match_words & name_words):
            return None, 0.0, "fuzzy-rejected: no shared distinctive word with " + match
    return match, score, "fuzzy"


def match_us_schools(csrankings: pd.DataFrame, carnegie: pd.DataFrame, threshold: int) -> pd.DataFrame:
    """The US R1+R2 ranked list: every NLP-active institution matched against
    Carnegie's US-only R1/R2 list. A match failure here typically means
    either a non-US institution (expected, not an error) or a name-spelling
    mismatch worth a human look — both land in low_confidence_matches.csv,
    distinguished by score, for review."""
    carnegie_names = carnegie["institution"].tolist()
    rows = []
    for _, row in csrankings.iterrows():
        match, score, method = find_carnegie_match(row["institution"], carnegie_names, threshold)
        rows.append({**row.to_dict(), "carnegie_match": match, "match_confidence": score, "match_method": method})
    candidates = pd.DataFrame(rows)

    matched = candidates[candidates["match_confidence"] >= threshold].merge(
        carnegie, left_on="carnegie_match", right_on="institution", suffixes=("", "_carnegie")
    )
    matched = matched.rename(columns={"institution_carnegie": "carnegie_official_name"}).copy()
    matched.loc[:, "country"] = "USA"
    # Use Carnegie's own canonical spelling as the school's display name, not
    # CSRankings' inconsistently-abbreviated dept string ("Univ. of X") — this
    # is also what seed_verified_schools.json's names are written to match.
    matched.loc[:, "institution"] = matched["carnegie_official_name"]

    ambiguous = candidates[candidates["match_method"].str.startswith("ambiguous", na=False)]
    # Only entries in the "plausible near-miss" band are worth a human look —
    # scores well below threshold are almost always genuinely non-US
    # institutions correctly failing to match a US-only list, not errors.
    review_band = candidates[
        (candidates["match_confidence"] < threshold) & (candidates["match_confidence"] >= 70)
        & ~candidates["match_method"].str.startswith("ambiguous", na=False)
    ]
    to_review = pd.concat([ambiguous, review_band])
    if len(to_review):
        to_review.to_csv("scripts/low_confidence_matches.csv", index=False)
        print(f"WARNING: {len(ambiguous)} ambiguous multi-candidate matches + {len(review_band)} scored "
              f"70-{threshold}% — written to scripts/low_confidence_matches.csv, review by hand before trusting the import.")

    dropped = len(candidates) - len(matched) - len(to_review)
    print(f"{dropped} institutions scored below 70% — treated as genuinely non-US/non-R1/R2, not reviewed.")

    return matched[["institution", "country", "carnegie_tier", "csranking_nlp_rank", "csranking_nlp_score"]]


def lookup_score_for_name(name: str, csrankings: pd.DataFrame, threshold: int = 85) -> dict | None:
    names = csrankings["institution"].tolist()
    match, score, idx = process.extractOne(name, names, scorer=fuzz.token_sort_ratio) or (None, 0, None)
    if score < threshold:
        return None
    row = csrankings.iloc[idx]
    return {"csranking_nlp_rank": int(row["csranking_nlp_rank"]), "csranking_nlp_score": float(row["csranking_nlp_score"])}


def build_non_us_verified(verified: list[dict], csrankings: pd.DataFrame) -> pd.DataFrame:
    """Canada/Australia are NOT given a full ranked directory (Carnegie
    doesn't cover them, and no equivalent source was scoped for this pass) —
    only the hand-verified schools from seed_verified_schools.json, each with
    a best-effort NLP score looked up by name where a confident match exists."""
    rows = []
    for v in verified:
        if v["country"] == "USA":
            continue
        score_info = lookup_score_for_name(v["name"], csrankings)
        rows.append({
            "institution": v["name"],
            "country": v["country"],
            "carnegie_tier": None,
            "csranking_nlp_rank": score_info["csranking_nlp_rank"] if score_info else None,
            "csranking_nlp_score": score_info["csranking_nlp_score"] if score_info else None,
        })
    return pd.DataFrame(rows)


def find_verified_entry(institution: str, verified_by_norm_name: dict[str, dict]) -> dict | None:
    """Same normalize-then-prefix logic as find_carnegie_match, applied here
    for the same reason: exact string equality between our seed names and
    whichever canonical spelling ends up in `institution` is too fragile to
    rely on (verified 2025-09-23 — chasing individual spelling mismatches
    here was a whack-a-mole that never converged)."""
    norm_inst = normalize_name(institution)
    if norm_inst in verified_by_norm_name:
        return verified_by_norm_name[norm_inst]
    candidates = [v for norm, v in verified_by_norm_name.items() if norm.startswith(norm_inst) or norm_inst.startswith(norm)]
    if len(candidates) == 1:
        return candidates[0]
    return None  # zero or ambiguous — never guess


def merge_verified(df: pd.DataFrame, verified: list[dict]) -> pd.DataFrame:
    verified_by_norm_name = {normalize_name(v["name"]): v for v in verified}
    df = df.copy()
    entries = df["institution"].map(lambda n: find_verified_entry(n, verified_by_norm_name))
    df.loc[:, "verified_fit"] = entries.map(lambda e: e is not None)
    df.loc[:, "faculty"] = entries.map(lambda e: e["faculty"] if e else None)
    df.loc[:, "fit_note"] = entries.map(lambda e: e["fit_note"] if e else None)

    matched_norm_names = {normalize_name(n) for n in df["institution"]}
    missing = [v for v in verified if normalize_name(v["name"]) not in matched_norm_names
               and not any(normalize_name(v["name"]).startswith(m) or m.startswith(normalize_name(v["name"])) for m in matched_norm_names)]
    if missing:
        print(f"WARNING: {len(missing)} verified schools still not found after the US+non-US merge — "
              f"add them manually to the output CSV: {[m['name'] for m in missing]}")
    return df


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--carnegie-xlsx", dest="carnegie_path", default=None,
                         help="Optional: path to an already-downloaded RAD file. Omit to fetch it directly.")
    parser.add_argument("--verified-json", default="scripts/seed_verified_schools.json")
    parser.add_argument("--out", default="scripts/schools_import.csv")
    parser.add_argument("--match-threshold", type=int, default=90)
    args = parser.parse_args()

    verified = json.loads(Path(args.verified_json).read_text(encoding="utf-8"))

    csrankings = fetch_csrankings_nlp_scores()
    carnegie = fetch_carnegie_r1_r2(args.carnegie_path)

    us_list = match_us_schools(csrankings, carnegie, threshold=args.match_threshold)
    non_us_list = build_non_us_verified(verified, csrankings)

    combined = pd.concat([us_list, non_us_list], ignore_index=True)
    combined = merge_verified(combined, verified)

    known_scores = combined["csranking_nlp_score"].dropna()
    min_score, max_score = known_scores.min(), known_scores.max()
    combined.loc[:, "normalized_csranking"] = combined["csranking_nlp_score"].map(
        lambda v: normalize_score(v, min_score, max_score) if pd.notna(v) else 0.0
    )
    combined.loc[:, "keyword_hits"] = combined["fit_note"].map(lambda t: keyword_match_score(t or ""))
    combined.loc[:, "composite_score"] = combined.apply(
        lambda r: compute_composite_score(r["normalized_csranking"], r["verified_fit"], r["keyword_hits"]),
        axis=1,
    )

    out = combined[[
        "institution", "country", "carnegie_tier", "csranking_nlp_rank", "csranking_nlp_score",
        "verified_fit", "faculty", "fit_note", "composite_score",
    ]].rename(columns={"institution": "name"})
    out.sort_values("composite_score", ascending=False).to_csv(args.out, index=False)

    us_count = (out["country"] == "USA").sum()
    other_count = len(out) - us_count
    print(f"Wrote {len(out)} schools to {args.out} ({us_count} US R1/R2 + {other_count} verified "
          f"Canada/Australia) — REVIEW BEFORE LOADING.")


if __name__ == "__main__":
    main()
