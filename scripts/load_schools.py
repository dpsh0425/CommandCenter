import argparse
import os

import pandas as pd
from supabase import create_client


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", default="scripts/schools_import.csv")
    parser.add_argument("--owner-id", required=True, help="Your Supabase auth user id (Authentication > Users)")
    args = parser.parse_args()

    url = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
    service_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    supabase = create_client(url, service_key)

    df = pd.read_csv(args.csv)
    df = df.where(pd.notnull(df), None)
    rows = []
    for _, r in df.iterrows():
        rows.append({
            "owner_id": args.owner_id,
            "name": r["name"],
            "country": r["country"],
            "carnegie_tier": r.get("carnegie_tier"),
            "csranking_nlp_rank": int(r["csranking_nlp_rank"]) if pd.notna(r.get("csranking_nlp_rank")) else None,
            "csranking_nlp_score": float(r["csranking_nlp_score"]) if pd.notna(r.get("csranking_nlp_score")) else None,
            "verified_fit": bool(r.get("verified_fit", False)),
            "faculty": r.get("faculty"),
            "fit_note": r.get("fit_note"),
            "composite_score": float(r["composite_score"]) if pd.notna(r.get("composite_score")) else None,
        })

    result = supabase.table("schools").upsert(rows, on_conflict="owner_id,name").execute()
    print(f"Upserted {len(result.data)} schools.")


if __name__ == "__main__":
    main()
