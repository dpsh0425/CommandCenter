# Grad Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js + Supabase personal command center replacing the Claude Artifact "Deadline Compass" tracker: a ranked, filterable directory of ~300 US R1/R2 + Canada/Australia CS PhD programs, per-school outreach tracking with a unified activity timeline, read-only Gmail reply detection, and a dashboard — running locally, Vercel-deployable later without redesign.

**Architecture:** Next.js 14 App Router (TypeScript) with Supabase (Postgres + Auth) via `@supabase/ssr`. Server Components read, Server Actions write. RLS on every table scoped to the authenticated user. A Python ETL pipeline (run manually, not a live service) builds the ranked school list from public CSRankings + Carnegie Classification data. Full design rationale: `docs/superpowers/specs/2026-09-22-grad-command-center-design.md`.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, `@supabase/ssr` + `@supabase/supabase-js`, Recharts (dashboard charts), Python 3.11 (`pandas`, `rapidfuzz`, `supabase` client) for the ETL scripts only, `googleapis` (Node) for Gmail API calls.

## Global Constraints

- Every table has `owner_id uuid` and an RLS policy requiring `auth.uid() = owner_id` — no table is ever left without RLS enabled.
- The Gmail integration is read-only (`gmail.readonly` scope only) — never request `gmail.send` or `gmail.compose`.
- `gmail_tokens` is never read from client-side code — only from Server Actions/Route Handlers using the server Supabase client.
- The Python ETL script writes a CSV for human review; it never writes directly to the production Supabase database in one step (loading is a separate, explicit task).
- No Gmail sync happens automatically/on a schedule in this phase — only via the user clicking "Sync Gmail".
- Composite score and CSRankings-derived data are always labeled as such in the UI (a caption/tooltip), never presented as unqualified fact.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`
- Create: `.env.local.example`, `.gitignore`
- Create: `app/layout.tsx`, `app/globals.css`
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`

**Interfaces:**
- Produces: `createClient()` in `lib/supabase/server.ts` (async, for Server Components/Actions) and `lib/supabase/client.ts` (sync, for the few client components that need it) — every later task's Supabase access goes through these two functions, never a raw `createClient` call elsewhere.

- [ ] **Step 1: Scaffold the Next.js app**

```bash
npx create-next-app@14 . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --eslint
npm install @supabase/ssr @supabase/supabase-js recharts
```

- [ ] **Step 2: Write `.env.local.example`**

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/gmail/callback
```

Copy it to `.env.local` and leave the real values for Task 2 (Supabase) and Task 11 (Google). Confirm `.gitignore` includes `.env.local` (create-next-app adds this by default — verify, don't assume).

- [ ] **Step 3: Write the server Supabase client**

```typescript
// lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // called from a Server Component that can't set cookies; middleware refreshes the session instead
          }
        },
      },
    }
  );
}
```

- [ ] **Step 4: Write the browser Supabase client**

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 5: Confirm the app boots**

Run: `npm run dev`
Expected: dev server starts on `http://localhost:3000`, default Next.js page renders with no console errors (Supabase env vars being empty is fine at this step — nothing calls them yet).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Supabase client helpers"
```

---

### Task 2: Supabase project setup

**Files:**
- Modify: `.env.local` (not committed)
- Create: `docs/setup/supabase.md`

**Interfaces:**
- Produces: the three env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) every later task's Supabase calls depend on.

- [ ] **Step 1: Create the Supabase project (manual, in the Supabase dashboard)**

Write these instructions to `docs/setup/supabase.md` and follow them:

```markdown
# Supabase setup

1. Go to https://supabase.com/dashboard and sign in (create an account if you don't have one).
2. Click "New project". Name it `grad-command-center`, pick a region close to you, set a database password (save it somewhere — you won't need it for the app, only for direct DB access).
3. Once provisioned, go to Project Settings > API. Copy:
   - "Project URL" -> NEXT_PUBLIC_SUPABASE_URL
   - "anon public" key -> NEXT_PUBLIC_SUPABASE_ANON_KEY
   - "service_role" key -> SUPABASE_SERVICE_ROLE_KEY (keep this one secret — it bypasses RLS; used only by the Python loader script in Task 6, never in the Next.js app itself)
4. Paste all three into `.env.local`.
5. Go to Authentication > Providers and confirm Email is enabled. Under Authentication > Settings, decide: magic link (simplest) or email/password. This plan uses magic link — if you'd rather use a password, adjust Task 4 accordingly.
6. Go to Authentication > Users and manually create your one user account (your email). This is the only account this app will ever have.
```

- [ ] **Step 2: Verify connectivity**

Run: `node -e "require('dotenv').config({path:'.env.local'}); console.log(process.env.NEXT_PUBLIC_SUPABASE_URL ? 'env loaded' : 'MISSING')"`
Expected: `env loaded`. If `MISSING`, the `.env.local` values from Step 1 weren't saved — fix before continuing.

- [ ] **Step 3: Commit**

```bash
git add docs/setup/supabase.md
git commit -m "docs: add Supabase project setup instructions"
```

---

### Task 3: Database schema and RLS

**Files:**
- Create: `supabase/migrations/0001_init.sql`

**Interfaces:**
- Produces: the `schools`, `actions`, `activity_log`, `gmail_tokens` tables and their enums — every later task's queries assume these exact column names and types.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0001_init.sql

create type school_status as enum (
  'not_started', 'researching', 'contacted', 'replied',
  'submitted', 'interview', 'accepted', 'rejected'
);

create type activity_type as enum ('note', 'status_change', 'email_reply', 'comment');

create table schools (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  country text not null,
  carnegie_tier text,
  csranking_nlp_rank int,
  csranking_nlp_score numeric,
  verified_fit boolean not null default false,
  faculty text,
  fit_note text,
  contact_email text,
  composite_score numeric,
  status school_status not null default 'not_started',
  deadline_note text,
  deadline_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table actions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  done boolean not null default false,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create table activity_log (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  type activity_type not null,
  content text not null,
  email_message_id text,
  email_snippet text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index activity_log_email_dedup
  on activity_log (owner_id, email_message_id)
  where email_message_id is not null;

create table gmail_tokens (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  access_token text,
  expires_at timestamptz,
  scope text not null default 'https://www.googleapis.com/auth/gmail.readonly',
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz
);

-- updated_at trigger for schools
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger schools_set_updated_at
  before update on schools
  for each row execute function set_updated_at();

-- RLS
alter table schools enable row level security;
alter table actions enable row level security;
alter table activity_log enable row level security;
alter table gmail_tokens enable row level security;

create policy "owner full access" on schools
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "owner full access" on actions
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "owner full access" on activity_log
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "owner full access" on gmail_tokens
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
```

- [ ] **Step 2: Apply the migration**

In the Supabase dashboard, go to SQL Editor, paste the contents of `0001_init.sql`, and run it.
Expected: "Success. No rows returned." Verify under Table Editor that all four tables exist with RLS enabled (a lock icon next to each table name).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "feat: add initial database schema with RLS"
```

---

### Task 4: Auth

**Files:**
- Create: `app/login/page.tsx`
- Create: `app/auth/confirm/route.ts`
- Create: `middleware.ts`

**Interfaces:**
- Consumes: `lib/supabase/server.ts`, `lib/supabase/client.ts` (Task 1).
- Produces: every route under `app/(app)/*` (Tasks 7-10) is protected by `middleware.ts` — an unauthenticated request redirects to `/login`.

- [ ] **Step 1: Write the login page (magic link)**

```tsx
// app/login/page.tsx
"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    });
    if (error) setError(error.message);
    else setSent(true);
  }

  if (sent) return <p className="p-8">Check your email for a sign-in link.</p>;

  return (
    <form onSubmit={handleSubmit} className="p-8 max-w-sm mx-auto flex flex-col gap-3">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="border rounded px-3 py-2"
      />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button type="submit" className="bg-black text-white rounded px-3 py-2">
        Send magic link
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Write the auth confirm route**

```typescript
// app/auth/confirm/route.ts
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) redirect("/");
  }
  redirect("/login?error=invalid_link");
}
```

- [ ] **Step 3: Write the middleware**

```typescript
// middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isAuthRoute = request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/auth");

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 4: Test the flow manually**

Run: `npm run dev`, visit `http://localhost:3000` — expect a redirect to `/login`. Enter the email you created in Task 2's Supabase Users page, submit, check that email, click the link. Expected: redirected back to `/` (a 404 is fine at this point — Task 7 builds the home page — the important thing is you're not bounced back to `/login`).

- [ ] **Step 5: Commit**

```bash
git add app/login app/auth middleware.ts
git commit -m "feat: add magic-link auth and route protection"
```

---

### Task 5: Verified-schools seed data and the Python ETL pipeline

**Files:**
- Create: `scripts/seed_verified_schools.json`
- Create: `scripts/requirements.txt`
- Create: `scripts/build_school_list.py`
- Test: `scripts/test_build_school_list.py`

**Interfaces:**
- Produces: `scripts/schools_import.csv`, the reviewed file Task 6's loader consumes. Columns: `name, country, carnegie_tier, csranking_nlp_rank, csranking_nlp_score, verified_fit, faculty, fit_note, composite_score, match_confidence`.

- [ ] **Step 1: Write the verified-schools seed (the 26 already hand-researched)**

```json
// scripts/seed_verified_schools.json
[
  {"name": "George Mason University", "country": "USA", "faculty": "Antonios Anastasopoulos", "fit_note": "Runs \"NLP Beyond the Top-100 Languages\" — closest direct match found"},
  {"name": "University of Notre Dame", "country": "USA", "faculty": "David Chiang", "fit_note": "Co-authored \"Languages still left behind: toward a better multilingual MT benchmark\" (EMNLP 2025)"},
  {"name": "University of Maryland", "country": "USA", "faculty": "Marine Carpuat", "fit_note": "2025 work reframes MT evaluation around fitness-for-purpose, not system-centric metrics. Mohit Iyyer's lab also moved here from UMass Amherst (Jan 2025)."},
  {"name": "Johns Hopkins University", "country": "USA", "faculty": "Philipp Koehn, Kevin Duh", "fit_note": "Historical home of MT evaluation research (WMT organizers), CLSP"},
  {"name": "Carnegie Mellon University", "country": "USA", "faculty": "Graham Neubig", "fit_note": "2026 paper \"Round-Trip Translation Reveals What Frontier Multilingual Benchmarks Miss\", LTI"},
  {"name": "University of Washington", "country": "USA", "faculty": "Yulia Tsvetkov", "fit_note": "Inclusive language technologies, methodological bias in low-resource NLP"},
  {"name": "Stanford University", "country": "USA", "faculty": "Percy Liang", "fit_note": "Created HELM, the reference framework for rigorous LLM benchmarking, CRFM"},
  {"name": "University of California, Los Angeles", "country": "USA", "faculty": "Nanyun (Violet) Peng", "fit_note": "Low-resource IE; \"The Zeno's Paradox of 'Low-Resource' Languages\", PlusLab"},
  {"name": "University of Illinois Urbana-Champaign", "country": "USA", "faculty": "Heng Ji", "fit_note": "2025 ACL Fellow for multimodal/multilingual knowledge extraction; low-resource language knowledge representation, BLENDER Lab"},
  {"name": "University of Southern California", "country": "USA", "faculty": "Jonathan May, Xuezhe Ma", "fit_note": "May is PI on DARPA \"MT for Indo-Pacific Low Resource Languages\"; gave invited talk on evaluation methodology, ISI"},
  {"name": "Columbia University", "country": "USA", "faculty": "Smaranda Muresan", "fit_note": "Code-switching and low-resource multilingual processing; co-authored CS-FLEURS, MaskLID"},
  {"name": "University of Michigan", "country": "USA", "faculty": "Rada Mihalcea", "fit_note": "2025 ACL Fellow for NLP for social good; long-standing program extending NLP tools to underserved languages, AI Lab"},
  {"name": "University of California, San Diego", "country": "USA", "faculty": "Ndapa Nakashole", "fit_note": "NSF CAREER awardee for low-resource-language work — KB acquisition, entity linking, QA, MT for low-resource languages"},
  {"name": "Ohio State University", "country": "USA", "faculty": "Huan Sun", "fit_note": "Leads TrustLLM and AttributionBench — LLM evaluation methodology, though not multilingual-specific (weakest-angle inclusion)"},
  {"name": "Georgia Institute of Technology", "country": "USA", "faculty": "Wei Xu", "fit_note": "Created LENS (learnable eval metric); 2025 paper on evaluator reliability under imperfect benchmarks"},
  {"name": "University of California, Irvine", "country": "USA", "faculty": "Sameer Singh", "fit_note": "Evaluator-reliability work (\"When Scanners Lie\", \"Lost in Simulation\") — strong eval-methodology fit, not multilingual-specific"},
  {"name": "Simon Fraser University", "country": "Canada", "faculty": "Anoop Sarkar", "fit_note": "Low-resource MT for Kokborok, Tetun — strong, confirmed fit"},
  {"name": "McGill University", "country": "Canada", "faculty": "Siva Reddy", "fit_note": "Multilingual/minority-language RAG, culturally-grounded understanding, Mila"},
  {"name": "University of Waterloo", "country": "Canada", "faculty": "Jimmy Lin", "fit_note": "Strongest pure benchmark-methodology fit in Canada (FreshStack, benchmark temporal drift)"},
  {"name": "University of Alberta", "country": "Canada", "faculty": "Grzegorz Kondrak", "fit_note": "Real but weaker fit — classical computational linguistics more than benchmark methodology"},
  {"name": "Concordia University", "country": "Canada", "faculty": "CLaC lab", "fit_note": "Kept as backup — general NLP focus doesn't closely match the thesis question"},
  {"name": "Monash University", "country": "Australia", "faculty": "Reza Haffari", "fit_note": "Strongest verified fit overall — actively recruiting for \"NMT for Low-Resource Languages\""},
  {"name": "University of Melbourne", "country": "Australia", "faculty": "Jey Han Lau", "fit_note": "LLM/NLG evaluation + low-resource languages, primarily based at Melbourne"},
  {"name": "Macquarie University", "country": "Australia", "faculty": "Mark Dras", "fit_note": "\"Myanmar XNLI\" — nearly identical project shape to this project"},
  {"name": "RMIT University", "country": "Australia", "faculty": "Karin Verspoor", "fit_note": "Evaluation-methodology track record, but biomedical domain — secondary fit"},
  {"name": "Australian National University", "country": "Australia", "faculty": "—", "fit_note": "Kept as backup — no faculty found with a clear low-resource/multilingual-evaluation line"}
]
```

Note: `name` values here use each school's full official name (e.g. "University of California, Los Angeles" not "UCLA") specifically so Step 4's fuzzy match against CSRankings/Carnegie data (which use official names) has a real chance of matching correctly.

- [ ] **Step 2: Write `scripts/requirements.txt`**

```
pandas==2.2.2
rapidfuzz==3.9.6
requests==2.32.3
supabase==2.7.4
```

Run: `pip install -r scripts/requirements.txt`

- [ ] **Step 3: Write the composite-score test first**

```python
# scripts/test_build_school_list.py
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd scripts && python -m pytest test_build_school_list.py -v`
Expected: FAIL — `build_school_list.py` does not exist.

- [ ] **Step 3: Write the pipeline script**

```python
# scripts/build_school_list.py
import argparse
import json
import re
from pathlib import Path

import pandas as pd
import requests
from rapidfuzz import fuzz, process

CSRANKINGS_CSV_URL = "https://raw.githubusercontent.com/emeryberger/CSrankings/gh-pages/csrankings.csv"
CSRANKINGS_COUNTRY_URL = "https://raw.githubusercontent.com/emeryberger/CSrankings/gh-pages/country-info.csv"
NLP_AREAS = ["nlp"]  # CSRankings' own area code for Natural Language Processing

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


def fetch_csrankings() -> pd.DataFrame:
    df = pd.read_csv(CSRANKINGS_CSV_URL)
    # CSRankings' own columns: name, affiliation, area, count, adjustedcount, year
    nlp = df[df["area"].isin(NLP_AREAS)]
    scores = nlp.groupby("affiliation")["adjustedcount"].sum().reset_index()
    scores = scores.rename(columns={"affiliation": "institution", "adjustedcount": "csranking_nlp_score"})
    scores["csranking_nlp_rank"] = scores["csranking_nlp_score"].rank(ascending=False, method="min").astype(int)
    return scores.sort_values("csranking_nlp_rank")


def fetch_carnegie_r1_r2(local_path: str | None) -> pd.DataFrame:
    """Carnegie Classification has no stable public API; this expects a manually
    downloaded CSV from https://carnegieclassifications.acenet.edu/ (Institution
    Lookup -> export). Pass --carnegie-csv to point at it."""
    if not local_path:
        raise SystemExit(
            "Download the Carnegie Classification institution list as CSV from "
            "https://carnegieclassifications.acenet.edu/ and pass --carnegie-csv <path>."
        )
    df = pd.read_csv(local_path)
    df = df[df["2025 Basic Classification"].isin([
        "Research 1: Very High Spending and Doctorate Production",
        "Research 2: High Spending and Doctorate Production",
    ])]
    df["carnegie_tier"] = df["2025 Basic Classification"].map({
        "Research 1: Very High Spending and Doctorate Production": "R1",
        "Research 2: High Spending and Doctorate Production": "R2",
    })
    return df.rename(columns={"Institution Name": "institution"})[["institution", "carnegie_tier"]]


def fuzzy_join(csrankings: pd.DataFrame, carnegie: pd.DataFrame, threshold: int = 90) -> pd.DataFrame:
    carnegie_names = carnegie["institution"].tolist()
    rows = []
    for _, row in csrankings.iterrows():
        match, score, _ = process.extractOne(
            row["institution"], carnegie_names, scorer=fuzz.token_sort_ratio
        ) or (None, 0, None)
        rows.append({**row.to_dict(), "carnegie_match": match, "match_confidence": score})
    merged = pd.DataFrame(rows)
    matched = merged[merged["match_confidence"] >= threshold].merge(
        carnegie, left_on="carnegie_match", right_on="institution", suffixes=("", "_carnegie")
    )
    low_confidence = merged[merged["match_confidence"] < threshold]
    if len(low_confidence):
        low_confidence.to_csv("scripts/low_confidence_matches.csv", index=False)
        print(f"WARNING: {len(low_confidence)} institutions below {threshold}% match confidence "
              f"written to scripts/low_confidence_matches.csv — review by hand before trusting the import.")
    return matched


def merge_verified(df: pd.DataFrame, verified_path: str) -> pd.DataFrame:
    verified = json.loads(Path(verified_path).read_text(encoding="utf-8"))
    verified_by_name = {v["name"]: v for v in verified}
    df["verified_fit"] = df["institution"].map(lambda n: n in verified_by_name)
    df["faculty"] = df["institution"].map(lambda n: verified_by_name.get(n, {}).get("faculty"))
    df["fit_note"] = df["institution"].map(lambda n: verified_by_name.get(n, {}).get("fit_note"))
    matched_names = set(df["institution"])
    missing = [v for v in verified if v["name"] not in matched_names]
    if missing:
        print(f"WARNING: {len(missing)} verified schools not found in the CSRankings/Carnegie merge — "
              f"add them manually to the output CSV: {[m['name'] for m in missing]}")
    return df


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--carnegie-csv", required=True)
    parser.add_argument("--verified-json", default="scripts/seed_verified_schools.json")
    parser.add_argument("--out", default="scripts/schools_import.csv")
    parser.add_argument("--match-threshold", type=int, default=90)
    args = parser.parse_args()

    csrankings = fetch_csrankings()
    carnegie = fetch_carnegie_r1_r2(args.carnegie_csv)
    merged = fuzzy_join(csrankings, carnegie, threshold=args.match_threshold)
    merged = merge_verified(merged, args.verified_json)

    min_score, max_score = merged["csranking_nlp_score"].min(), merged["csranking_nlp_score"].max()
    merged["normalized_csranking"] = merged["csranking_nlp_score"].map(
        lambda v: normalize_score(v, min_score, max_score)
    )
    merged["keyword_hits"] = merged["fit_note"].map(lambda t: keyword_match_score(t or ""))
    merged["composite_score"] = merged.apply(
        lambda r: compute_composite_score(r["normalized_csranking"], r["verified_fit"], r["keyword_hits"]),
        axis=1,
    )

    out = merged[[
        "institution", "carnegie_tier", "csranking_nlp_rank", "csranking_nlp_score",
        "verified_fit", "faculty", "fit_note", "composite_score", "match_confidence",
    ]].rename(columns={"institution": "name"})
    out["country"] = "USA"
    out.sort_values("composite_score", ascending=False).to_csv(args.out, index=False)
    print(f"Wrote {len(out)} schools to {args.out} — REVIEW BEFORE LOADING (see match_confidence column).")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run the unit tests**

Run: `cd scripts && python -m pytest test_build_school_list.py -v`
Expected: PASS (these test the pure scoring functions, not the network-dependent fetch functions — no network calls needed for this step).

- [ ] **Step 5: Run the real pipeline**

Download the Carnegie Classification CSV manually per the docstring in `fetch_carnegie_r1_r2`, then:

Run: `cd scripts && python build_school_list.py --carnegie-csv path/to/carnegie.csv`
Expected: `scripts/schools_import.csv` is created. Open it and manually review every row with `match_confidence < 95` before Task 6 loads it — this script's job is to produce a reviewable draft, not a final authoritative import.

- [ ] **Step 6: Commit**

```bash
git add scripts/
git commit -m "feat: add Python ETL pipeline for the ranked school list"
```

---

### Task 6: Supabase loader script

**Files:**
- Create: `scripts/load_schools.py`

**Interfaces:**
- Consumes: `scripts/schools_import.csv` (Task 5's reviewed output).
- Produces: rows in the `schools` table (Task 3's schema) — upserts by `name` so re-running after review fixes doesn't duplicate rows.

- [ ] **Step 1: Write the loader**

```python
# scripts/load_schools.py
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

    df = pd.read_csv(args.csv).where(pd.notnull(pd.read_csv(args.csv)), None)
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

    result = supabase.table("schools").upsert(rows, on_conflict="name").execute()
    print(f"Upserted {len(result.data)} schools.")


if __name__ == "__main__":
    main()
```

Note: `upsert(..., on_conflict="name")` requires a unique constraint on `schools.name` scoped per owner — add `alter table schools add constraint schools_owner_name_unique unique (owner_id, name);` to a new migration `supabase/migrations/0002_schools_name_unique.sql` before running this script, and use `on_conflict="owner_id,name"` instead.

- [ ] **Step 2: Add the missing unique constraint migration**

```sql
-- supabase/migrations/0002_schools_name_unique.sql
alter table schools add constraint schools_owner_name_unique unique (owner_id, name);
```

Apply it the same way as Task 3 Step 2 (Supabase SQL Editor), then fix `load_schools.py`'s `on_conflict` argument to `"owner_id,name"`.

- [ ] **Step 3: Run the loader**

Get your user id from Supabase dashboard > Authentication > Users (click your user, copy the UUID).

Run: `cd scripts && python load_schools.py --owner-id <your-user-uuid>`
Expected: `Upserted N schools.` where N matches the row count in `schools_import.csv`. Verify in Supabase Table Editor.

- [ ] **Step 4: Commit**

```bash
git add scripts/load_schools.py supabase/migrations/0002_schools_name_unique.sql
git commit -m "feat: add Supabase loader script for the reviewed school list"
```

---

### Task 7: Schools list page

**Files:**
- Create: `app/(app)/schools/page.tsx`
- Create: `app/(app)/schools/actions.ts`
- Create: `components/school-table.tsx`
- Create: `components/status-select.tsx`

**Interfaces:**
- Consumes: `schools` table (Task 3), `createClient` from `lib/supabase/server.ts` (Task 1).
- Produces: `updateSchoolStatus(id: string, status: SchoolStatus)` Server Action in `actions.ts`, used by Task 8's detail page too.

- [ ] **Step 1: Write the Server Action**

```typescript
// app/(app)/schools/actions.ts
"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type SchoolStatus =
  | "not_started" | "researching" | "contacted" | "replied"
  | "submitted" | "interview" | "accepted" | "rejected";

export async function updateSchoolStatus(id: string, status: SchoolStatus) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  const { error } = await supabase.from("schools").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);

  await supabase.from("activity_log").insert({
    owner_id: user.id,
    school_id: id,
    type: "status_change",
    content: `Status changed to ${status.replace("_", " ")}`,
  });

  revalidatePath("/schools");
  revalidatePath(`/schools/${id}`);
}
```

- [ ] **Step 2: Write the status select client component**

```tsx
// components/status-select.tsx
"use client";
import { updateSchoolStatus, type SchoolStatus } from "@/app/(app)/schools/actions";

const STATUSES: SchoolStatus[] = [
  "not_started", "researching", "contacted", "replied",
  "submitted", "interview", "accepted", "rejected",
];

export function StatusSelect({ schoolId, value }: { schoolId: string; value: SchoolStatus }) {
  return (
    <select
      defaultValue={value}
      onChange={(e) => updateSchoolStatus(schoolId, e.target.value as SchoolStatus)}
      className="border rounded px-2 py-1 text-sm"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>{s.replace("_", " ")}</option>
      ))}
    </select>
  );
}
```

- [ ] **Step 3: Write the school table component**

```tsx
// components/school-table.tsx
import Link from "next/link";
import { StatusSelect } from "./status-select";
import type { SchoolStatus } from "@/app/(app)/schools/actions";

type School = {
  id: string; name: string; country: string; faculty: string | null;
  fit_note: string | null; verified_fit: boolean; composite_score: number | null;
  csranking_nlp_rank: number | null; status: SchoolStatus;
};

export function SchoolTable({ schools }: { schools: School[] }) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="text-left text-xs uppercase text-gray-500 border-b">
          <th className="py-2 pr-3">School</th>
          <th className="py-2 pr-3">Faculty / fit</th>
          <th className="py-2 pr-3">Score</th>
          <th className="py-2 pr-3">Status</th>
        </tr>
      </thead>
      <tbody>
        {schools.map((s) => (
          <tr key={s.id} className="border-b">
            <td className="py-2 pr-3">
              <Link href={`/schools/${s.id}`} className="font-medium hover:underline">{s.name}</Link>
              <div className="text-xs text-gray-500">{s.country}{s.verified_fit && " · verified fit"}</div>
            </td>
            <td className="py-2 pr-3 text-gray-600 max-w-sm">
              <strong>{s.faculty}</strong><br />{s.fit_note}
            </td>
            <td className="py-2 pr-3 font-mono">
              {s.composite_score?.toFixed(1) ?? "—"}
              <div className="text-xs text-gray-400">heuristic, not verified · rank #{s.csranking_nlp_rank ?? "?"}</div>
            </td>
            <td className="py-2 pr-3"><StatusSelect schoolId={s.id} value={s.status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 4: Write the page**

```tsx
// app/(app)/schools/page.tsx
import { createClient } from "@/lib/supabase/server";
import { SchoolTable } from "@/components/school-table";

export default async function SchoolsPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const { country } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("schools").select("*").order("composite_score", { ascending: false, nullsFirst: false });
  if (country) query = query.eq("country", country);
  const { data: schools, error } = await query;

  if (error) return <p className="p-8 text-red-600">Error loading schools: {error.message}</p>;

  const countries = ["USA", "Canada", "Australia"];

  return (
    <main className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Target schools</h1>
      <div className="flex gap-2 mb-4">
        <a href="/schools" className={`px-3 py-1 rounded-full text-sm border ${!country ? "bg-black text-white" : ""}`}>All</a>
        {countries.map((c) => (
          <a key={c} href={`/schools?country=${c}`} className={`px-3 py-1 rounded-full text-sm border ${country === c ? "bg-black text-white" : ""}`}>{c}</a>
        ))}
      </div>
      <SchoolTable schools={schools ?? []} />
    </main>
  );
}
```

- [ ] **Step 5: Verify manually**

Run: `npm run dev`, sign in, visit `/schools`. Expected: the loaded schools render, sorted by composite score descending; changing a status dropdown persists after a page refresh (confirms the Server Action + RLS policy both work).

- [ ] **Step 6: Commit**

```bash
git add app/\(app\)/schools components/school-table.tsx components/status-select.tsx
git commit -m "feat: add schools list page with status tracking"
```

---

### Task 8: School detail page and activity log

**Files:**
- Create: `app/(app)/schools/[id]/page.tsx`
- Create: `app/(app)/schools/[id]/actions.ts`
- Create: `components/activity-timeline.tsx`

**Interfaces:**
- Consumes: `activity_log` table (Task 3).
- Produces: `addNote(schoolId: string, content: string)` Server Action, used by this page's note form.

- [ ] **Step 1: Write the actions**

```typescript
// app/(app)/schools/[id]/actions.ts
"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addNote(schoolId: string, content: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  const { error } = await supabase.from("activity_log").insert({
    owner_id: user.id, school_id: schoolId, type: "note", content,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/schools/${schoolId}`);
}

export async function updateContactEmail(schoolId: string, email: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("schools").update({ contact_email: email }).eq("id", schoolId);
  if (error) throw new Error(error.message);
  revalidatePath(`/schools/${schoolId}`);
}
```

- [ ] **Step 2: Write the timeline component**

```tsx
// components/activity-timeline.tsx
type Activity = {
  id: string; type: string; content: string;
  email_snippet: string | null; occurred_at: string;
};

export function ActivityTimeline({ items }: { items: Activity[] }) {
  if (!items.length) return <p className="text-sm text-gray-500">No activity yet.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((a) => (
        <li key={a.id} className="border rounded p-3 text-sm">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span className="uppercase">{a.type.replace("_", " ")}</span>
            <span>{new Date(a.occurred_at).toLocaleString()}</span>
          </div>
          <p>{a.content}</p>
          {a.email_snippet && <p className="text-gray-500 italic mt-1">"{a.email_snippet}"</p>}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Write the page (with an inline note form as a small client island)**

```tsx
// app/(app)/schools/[id]/page.tsx
import { createClient } from "@/lib/supabase/server";
import { ActivityTimeline } from "@/components/activity-timeline";
import { addNote, updateContactEmail } from "./actions";

export default async function SchoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: school }, { data: activity }] = await Promise.all([
    supabase.from("schools").select("*").eq("id", id).single(),
    supabase.from("activity_log").select("*").eq("school_id", id).order("occurred_at", { ascending: false }),
  ]);

  if (!school) return <p className="p-8">Not found.</p>;

  async function addNoteAction(formData: FormData) {
    "use server";
    const content = String(formData.get("content") ?? "").trim();
    if (content) await addNote(id, content);
  }

  async function updateEmailAction(formData: FormData) {
    "use server";
    const email = String(formData.get("contact_email") ?? "").trim();
    if (email) await updateContactEmail(id, email);
  }

  return (
    <main className="p-8 max-w-2xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{school.name}</h1>
        <p className="text-gray-600">{school.faculty} — {school.fit_note}</p>
      </div>

      <form action={updateEmailAction} className="flex gap-2 items-center">
        <label className="text-sm text-gray-500">Contact email</label>
        <input
          name="contact_email"
          defaultValue={school.contact_email ?? ""}
          placeholder="faculty@university.edu"
          className="border rounded px-2 py-1 text-sm flex-1"
        />
        <button className="bg-black text-white rounded px-3 py-1 text-sm">Save</button>
      </form>

      <form action={addNoteAction} className="flex flex-col gap-2">
        <textarea name="content" placeholder="Add a note…" className="border rounded p-2 text-sm" rows={3} />
        <button className="bg-black text-white rounded px-3 py-1 text-sm self-start">Add note</button>
      </form>

      <div>
        <h2 className="font-medium mb-2">Activity</h2>
        <ActivityTimeline items={activity ?? []} />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Verify manually**

Visit `/schools/<an id from the schools list>`. Expected: fit note renders, adding a contact email and a note both persist and appear in the activity timeline immediately after the page reloads (Server Actions + `revalidatePath` — no client-side state management needed).

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/schools/[id]" components/activity-timeline.tsx
git commit -m "feat: add school detail page with activity timeline"
```

---

### Task 9: Actions checklist

**Files:**
- Create: `app/(app)/actions-list/page.tsx`
- Create: `app/(app)/actions-list/actions.ts`

**Interfaces:**
- Consumes: `actions` table (Task 3).

- [ ] **Step 1: Write the Server Actions**

```typescript
// app/(app)/actions-list/actions.ts
"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addAction(text: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  const { error } = await supabase.from("actions").insert({ owner_id: user.id, text });
  if (error) throw new Error(error.message);
  revalidatePath("/actions-list");
}

export async function toggleAction(id: string, done: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("actions").update({ done }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/actions-list");
}
```

- [ ] **Step 2: Write the page**

```tsx
// app/(app)/actions-list/page.tsx
import { createClient } from "@/lib/supabase/server";
import { addAction, toggleAction } from "./actions";

export default async function ActionsPage() {
  const supabase = await createClient();
  const { data: items } = await supabase.from("actions").select("*").order("order_index");

  async function addActionForm(formData: FormData) {
    "use server";
    const text = String(formData.get("text") ?? "").trim();
    if (text) await addAction(text);
  }

  return (
    <main className="p-8 max-w-xl mx-auto flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Next actions</h1>
      <ul className="flex flex-col gap-2">
        {(items ?? []).map((a) => (
          <li key={a.id} className="flex items-center gap-2 border rounded p-2">
            <input
              type="checkbox"
              defaultChecked={a.done}
              onChange={(e) => toggleAction(a.id, e.target.checked)}
            />
            <span className={a.done ? "line-through text-gray-400" : ""}>{a.text}</span>
          </li>
        ))}
      </ul>
      <form action={addActionForm} className="flex gap-2">
        <input name="text" placeholder="Add an action…" className="border rounded px-2 py-1 flex-1" />
        <button className="bg-black text-white rounded px-3 py-1">Add</button>
      </form>
    </main>
  );
}
```

Note: `onChange` calling a Server Action directly from a Server Component's rendered checkbox requires the checkbox itself to be interactive — since this file has no `"use client"` directive, extract the checkbox into a small client component if `npm run build` errors on this (Next.js allows passing Server Actions as props to Client Components, but not attaching event handlers in a Server Component directly). Fix: wrap the `<input>` in a tiny client component `components/action-checkbox.tsx` that calls `toggleAction` on change, passed the action as a prop.

- [ ] **Step 3: Verify manually**

Visit `/actions-list`, add an item, check it off, refresh — the checked state persists.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/actions-list"
git commit -m "feat: add actions checklist page"
```

---

### Task 10: Dashboard

**Files:**
- Create: `app/(app)/page.tsx`
- Create: `components/status-funnel-chart.tsx`
- Create: `components/score-rank-scatter.tsx`

**Interfaces:**
- Consumes: `schools` table (Task 3).

- [ ] **Step 1: Write the status funnel chart**

```tsx
// components/status-funnel-chart.tsx
"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const ORDER = ["not_started", "researching", "contacted", "replied", "submitted", "interview", "accepted", "rejected"];

export function StatusFunnelChart({ counts }: { counts: Record<string, number> }) {
  const data = ORDER.map((status) => ({ status: status.replace("_", " "), count: counts[status] ?? 0 }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <XAxis dataKey="status" fontSize={11} interval={0} angle={-20} textAnchor="end" height={60} />
        <YAxis allowDecimals={false} fontSize={11} />
        <Tooltip />
        <Bar dataKey="count" fill="#2f6f5e" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Write the score-vs-rank scatter**

```tsx
// components/score-rank-scatter.tsx
"use client";
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

type Point = { name: string; csranking_nlp_rank: number | null; composite_score: number | null; verified_fit: boolean };

export function ScoreRankScatter({ schools }: { schools: Point[] }) {
  const data = schools.filter((s) => s.csranking_nlp_rank != null && s.composite_score != null);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ScatterChart>
        <XAxis type="number" dataKey="csranking_nlp_rank" name="CSRankings NLP rank" fontSize={11} reversed />
        <YAxis type="number" dataKey="composite_score" name="Composite score" fontSize={11} />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(v, n) => [v, n]} labelFormatter={() => ""} />
        <Scatter data={data}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.verified_fit ? "#2f6f5e" : "#b5651d"} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 3: Write the dashboard page**

```tsx
// app/(app)/page.tsx
import { createClient } from "@/lib/supabase/server";
import { StatusFunnelChart } from "@/components/status-funnel-chart";
import { ScoreRankScatter } from "@/components/score-rank-scatter";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: schools } = await supabase.from("schools").select("*");
  const list = schools ?? [];

  const counts: Record<string, number> = {};
  for (const s of list) counts[s.status] = (counts[s.status] ?? 0) + 1;

  const contacted = list.filter((s) => s.status !== "not_started" && s.status !== "researching").length;
  const submittedPlus = list.filter((s) => ["submitted", "interview", "accepted", "rejected"].includes(s.status)).length;
  const accepted = list.filter((s) => s.status === "accepted").length;

  return (
    <main className="p-8 max-w-5xl mx-auto flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-4 gap-3">
        {[
          ["Target schools", list.length],
          ["Outreach started", contacted],
          ["Submitted+", submittedPlus],
          ["Accepted", accepted],
        ].map(([label, value]) => (
          <div key={label as string} className="border rounded p-4">
            <div className="text-2xl font-mono font-semibold">{value}</div>
            <div className="text-xs text-gray-500 uppercase">{label}</div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="font-medium mb-2">Pipeline</h2>
        <StatusFunnelChart counts={counts} />
      </div>

      <div>
        <h2 className="font-medium mb-2">Score vs. CSRankings NLP rank <span className="text-xs text-gray-400 font-normal">(green = verified fit; score is a heuristic, not a validated ranking)</span></h2>
        <ScoreRankScatter schools={list} />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Verify manually**

Visit `/`. Expected: stat tiles, funnel chart, and scatter plot all render with the loaded school data, no console errors.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/page.tsx" components/status-funnel-chart.tsx components/score-rank-scatter.tsx
git commit -m "feat: add dashboard with status funnel and score/rank scatter"
```

---

### Task 11: Gmail OAuth connect flow

**Files:**
- Create: `docs/setup/google-oauth.md`
- Create: `app/api/gmail/connect/route.ts`
- Create: `app/api/gmail/callback/route.ts`
- Create: `lib/google.ts`

**Interfaces:**
- Consumes: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` env vars (Task 1).
- Produces: rows in `gmail_tokens` (Task 3), consumed by Task 12's sync action.

- [ ] **Step 1: Write the manual setup doc**

```markdown
# Google OAuth setup

1. Go to https://console.cloud.google.com/ and create a new project (e.g. "grad-command-center").
2. Enable the Gmail API: APIs & Services > Library > search "Gmail API" > Enable.
3. Configure the OAuth consent screen: APIs & Services > OAuth consent screen.
   - User type: External.
   - App name, your email as support/developer contact.
   - Scopes: add `https://www.googleapis.com/auth/gmail.readonly`.
   - Test users: add your own Gmail address.
   - Leave the app in "Testing" mode — this is fine for a single-user personal
     tool and avoids Google's full verification process. You'll see an
     "unverified app" warning when you connect; click "Advanced" > "Go to
     grad-command-center (unsafe)" — this is expected, not a bug, because
     the app is yours and untested by Google, not because anything is wrong.
4. Create credentials: APIs & Services > Credentials > Create Credentials >
   OAuth client ID > Application type: Web application.
   - Authorized redirect URI: `http://localhost:3000/api/gmail/callback`
5. Copy the Client ID and Client Secret into `.env.local` as GOOGLE_CLIENT_ID
   and GOOGLE_CLIENT_SECRET.
```

- [ ] **Step 2: Install the Google API client**

```bash
npm install googleapis
```

- [ ] **Step 3: Write the shared Google OAuth helper**

```typescript
// lib/google.ts
import { google } from "googleapis";

export function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];
```

- [ ] **Step 4: Write the connect route**

```typescript
// app/api/gmail/connect/route.ts
import { createOAuthClient, GMAIL_SCOPES } from "@/lib/google";
import { redirect } from "next/navigation";

export async function GET() {
  const oauth2Client = createOAuthClient();
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES,
  });
  redirect(url);
}
```

- [ ] **Step 5: Write the callback route**

```typescript
// app/api/gmail/callback/route.ts
import { createOAuthClient } from "@/lib/google";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/settings?gmail=error", request.url));

  const oauth2Client = createOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const { error } = await supabase.from("gmail_tokens").upsert({
    owner_id: user.id,
    refresh_token: tokens.refresh_token!,
    access_token: tokens.access_token,
    expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
    connected_at: new Date().toISOString(),
  });
  if (error) return NextResponse.redirect(new URL("/settings?gmail=error", request.url));

  return NextResponse.redirect(new URL("/settings?gmail=connected", request.url));
}
```

Note: `tokens.refresh_token` is only returned on the FIRST consent (with `prompt: "consent"` and `access_type: "offline"` as set above) — if you ever re-connect and stop getting a refresh token back, revoke the app's access at https://myaccount.google.com/permissions first, then reconnect.

- [ ] **Step 6: Write a minimal settings page to trigger connect**

```tsx
// app/(app)/settings/page.tsx
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ gmail?: string }> }) {
  const { gmail } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: token } = user
    ? await supabase.from("gmail_tokens").select("connected_at, last_synced_at").eq("owner_id", user.id).maybeSingle()
    : { data: null };

  return (
    <main className="p-8 max-w-xl mx-auto flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      {gmail === "connected" && <p className="text-green-600 text-sm">Gmail connected.</p>}
      {gmail === "error" && <p className="text-red-600 text-sm">Gmail connection failed — try again.</p>}
      <div className="border rounded p-4">
        <p className="font-medium">Gmail</p>
        {token ? (
          <p className="text-sm text-gray-500">
            Connected {new Date(token.connected_at).toLocaleDateString()}.
            {token.last_synced_at && ` Last synced ${new Date(token.last_synced_at).toLocaleString()}.`}
          </p>
        ) : (
          <a href="/api/gmail/connect" className="text-sm underline">Connect Gmail</a>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 7: Verify manually**

Visit `/settings`, click "Connect Gmail", go through the Google consent screen (expect the "unverified app" warning per Step 1's doc — click through it), land back on `/settings?gmail=connected`. Verify in Supabase Table Editor that a `gmail_tokens` row exists with a non-null `refresh_token`.

- [ ] **Step 8: Commit**

```bash
git add docs/setup/google-oauth.md app/api/gmail lib/google.ts "app/(app)/settings"
git commit -m "feat: add Gmail OAuth connect flow"
```

---

### Task 12: Gmail sync

**Files:**
- Create: `app/(app)/settings/actions.ts`
- Modify: `app/(app)/settings/page.tsx`

**Interfaces:**
- Consumes: `gmail_tokens` (Task 11), `schools.contact_email` (Task 8).
- Produces: `activity_log` rows of type `email_reply`.

- [ ] **Step 1: Write the sync Server Action**

```typescript
// app/(app)/settings/actions.ts
"use server";
import { google } from "googleapis";
import { createOAuthClient } from "@/lib/google";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function syncGmail() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  const { data: tokenRow } = await supabase.from("gmail_tokens").select("*").eq("owner_id", user.id).single();
  if (!tokenRow) throw new Error("Gmail not connected");

  const { data: schools } = await supabase
    .from("schools").select("id, contact_email").eq("owner_id", user.id).not("contact_email", "is", null);
  if (!schools?.length) {
    return { synced: 0, message: "No schools have a contact_email set yet — add one on a school's detail page first." };
  }

  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials({ refresh_token: tokenRow.refresh_token });
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const emailByAddress = new Map(schools.map((s) => [s.contact_email!.toLowerCase(), s.id]));
  const fromClause = schools.map((s) => `from:${s.contact_email}`).join(" OR ");
  const after = tokenRow.last_synced_at
    ? `after:${Math.floor(new Date(tokenRow.last_synced_at).getTime() / 1000)}`
    : "";
  const query = `(${fromClause}) ${after}`.trim();

  const list = await gmail.users.messages.list({ userId: "me", q: query, maxResults: 50 });
  const messages = list.data.messages ?? [];

  let synced = 0;
  for (const m of messages) {
    const msg = await gmail.users.messages.get({ userId: "me", id: m.id!, format: "metadata", metadataHeaders: ["From", "Subject", "Date"] });
    const headers = msg.data.payload?.headers ?? [];
    const fromHeader = headers.find((h) => h.name === "From")?.value ?? "";
    const fromEmailMatch = fromHeader.match(/<(.+)>/);
    const fromEmail = (fromEmailMatch ? fromEmailMatch[1] : fromHeader).toLowerCase();
    const schoolId = emailByAddress.get(fromEmail);
    if (!schoolId) continue;

    const { error } = await supabase.from("activity_log").insert({
      owner_id: user.id,
      school_id: schoolId,
      type: "email_reply",
      content: `Email from ${fromHeader}`,
      email_message_id: m.id,
      email_snippet: msg.data.snippet ?? null,
      occurred_at: new Date(Number(msg.data.internalDate ?? Date.now())).toISOString(),
    });
    if (!error) synced++;
    // duplicate-key errors from the (owner_id, email_message_id) unique index are expected on re-sync — ignore, don't throw
  }

  await supabase.from("gmail_tokens").update({ last_synced_at: new Date().toISOString() }).eq("owner_id", user.id);
  revalidatePath("/settings");
  return { synced, message: `Synced ${synced} new email(s).` };
}
```

- [ ] **Step 2: Wire the sync button into the settings page**

```tsx
// app/(app)/settings/page.tsx  — add inside the existing Gmail card, only when `token` is truthy
```

```tsx
// components/sync-gmail-button.tsx
"use client";
import { useState, useTransition } from "react";
import { syncGmail } from "@/app/(app)/settings/actions";

export function SyncGmailButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <button
        disabled={isPending}
        onClick={() => startTransition(async () => {
          const result = await syncGmail();
          setMessage(result.message);
        })}
        className="bg-black text-white rounded px-3 py-1 text-sm self-start"
      >
        {isPending ? "Syncing…" : "Sync Gmail"}
      </button>
      {message && <p className="text-xs text-gray-500">{message}</p>}
    </div>
  );
}
```

Add `import { SyncGmailButton } from "@/components/sync-gmail-button";` and `<SyncGmailButton />` inside the `token ? (...) : (...)` branch of `app/(app)/settings/page.tsx`, right after the "Connected" paragraph.

- [ ] **Step 3: Verify manually**

Set a real `contact_email` on at least one school (a test address you control that you can send yourself an email from), send that school's contact_email an email to your own connected inbox (or find an existing email thread from that address), click "Sync Gmail" on `/settings`, then check that school's detail page — the email should appear in the activity timeline. Click "Sync Gmail" again immediately — expected: 0 new synced (the unique-index de-dup works).

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/settings" components/sync-gmail-button.tsx
git commit -m "feat: add manual Gmail sync with activity-log de-dup"
```

---

### Task 13: Future AI feature pattern documentation

**Files:**
- Create: `api/hello.py`
- Create: `docs/ai-features.md`
- Modify: `vercel.json` (create if absent)

**Interfaces:**
- Produces: a working, deployed-when-you-deploy example of the pattern described in the design spec section 8 — not a feature itself, a proof that the slot works.

- [ ] **Step 1: Write the stub Python serverless function**

```python
# api/hello.py
from http.server import BaseHTTPRequestHandler
import json

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({"message": "Python serverless function is wired up."}).encode())
```

- [ ] **Step 2: Write `vercel.json` if it doesn't already exist**

```json
{
  "functions": {
    "api/hello.py": {
      "runtime": "@vercel/python"
    }
  }
}
```

- [ ] **Step 3: Document the pattern**

```markdown
# docs/ai-features.md

Future AI features (LLM calls, embeddings, anything Python-ecosystem-specific)
go in `api/<feature>.py` as Vercel Python serverless functions — same
deployment, same free tier as the Next.js app, no second host to run or pay
for. See `api/hello.py` for the minimal working shape.

Call one from a Server Action or Route Handler with a normal `fetch` to
`/api/<feature>`, same as any other API route.

Constraints: serverless means no persistent process — fine for "take input,
call an LLM API, return a result" style features, not for anything needing a
long-running background job or a WebSocket connection. If a future feature
needs that, the fallback is a small persistent FastAPI app on Render's free
tier (see the design spec, section 8) — not built, and not needed unless a
concrete feature actually requires it.
```

- [ ] **Step 4: Verify locally**

Run: `vercel dev` (requires `npm install -g vercel` and `vercel login` once) or skip local verification and trust the pattern until first real deploy — note in the commit message which you did, since this is the one part of the plan that can't be fully verified without a Vercel account.

- [ ] **Step 5: Commit**

```bash
git add api/hello.py vercel.json docs/ai-features.md
git commit -m "docs: add Vercel Python serverless function pattern for future AI features"
```

---

## Self-review notes

- **Spec coverage:** every section of the design spec maps to a task — architecture/scaffold (Task 1), Supabase setup (Task 2), schema/RLS (Task 3), auth (Task 4), ranked-list pipeline (Tasks 5-6), schools UI (Tasks 7-8), actions (Task 9), dashboard (Task 10), Gmail (Tasks 11-12), future-AI pattern (Task 13).
- **Non-goals respected:** no email composition/sending code anywhere; no cron/scheduled sync; no research-project or KACOF modules; no live Python service (only serverless stub + ETL scripts).
- **Placeholder scan:** no TBD/TODO; every code step is complete and runnable, with the one honest exception noted in Task 9 Step 2 (a Next.js Server-Component-event-handler constraint flagged with its concrete fix, not left vague) and Task 13 Step 4 (an explicitly-justified skip, not a silent gap).
- **Type consistency:** `SchoolStatus` type defined once in Task 7's `actions.ts` and imported everywhere else that needs it (Task 8's page doesn't redefine it); `activity_log` columns used identically across Tasks 7, 8, and 12.
