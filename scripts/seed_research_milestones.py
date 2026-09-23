import argparse
import os
from supabase import create_client

MILESTONES = [
    {"title": "Verification gate", "description": "Confirm Global-MMLU's Nepali split construction route before anything else starts.", "target_date": "2026-09-23"},
    {"title": "Repository scaffold", "description": "Directory structure, licences, README per section 8.1 of the Master Plan.", "target_date": "2026-09-23"},
    {"title": "Pre-registration", "description": "Hypotheses, sampling procedure and seed, committed before any model runs.", "target_date": "2026-09-25"},
    {"title": "Sampling script and sample", "description": "Stratified random sample, seed 20260922, n=450, committed.", "target_date": "2026-09-27"},
    {"title": "Annotation sheet and pilot", "description": "30-item pilot, independently annotated by both annotators, kappa computed.", "target_date": "2026-09-30"},
]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--owner-id", required=True)
    args = parser.parse_args()
    supabase = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    rows = [{**m, "owner_id": args.owner_id} for m in MILESTONES]
    result = supabase.table("research_milestones").insert(rows).execute()
    print(f"Inserted {len(result.data)} milestones.")

if __name__ == "__main__":
    main()
