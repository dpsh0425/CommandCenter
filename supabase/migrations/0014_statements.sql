-- Statements written in the app: a general draft (no school) or a version tailored to one school.
create table statements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'statement_of_purpose'
    check (kind in ('statement_of_purpose', 'research_statement', 'personal_statement', 'diversity_statement', 'other')),
  title text not null,
  prompt text,
  word_limit integer check (word_limit is null or word_limit > 0),
  body text not null default '',
  words integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'final', 'sent')),
  sent_on date,
  school_id uuid references schools(id) on delete cascade,
  source_id uuid references statements(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A school has at most one statement of each kind.
create unique index statements_school_kind_idx on statements(school_id, kind) where school_id is not null;
create index statements_owner_idx on statements(owner_id, updated_at desc);
create trigger statements_set_updated_at before update on statements for each row execute function set_updated_at();

create table statement_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  statement_id uuid not null references statements(id) on delete cascade,
  body text not null,
  words integer not null default 0,
  note text,
  created_at timestamptz not null default now()
);
create index statement_snapshots_statement_idx on statement_snapshots(statement_id, created_at desc);

alter table statements enable row level security;
alter table statement_snapshots enable row level security;
create policy "owner full access" on statements for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "owner full access" on statement_snapshots for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
