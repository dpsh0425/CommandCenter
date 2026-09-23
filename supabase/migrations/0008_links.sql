-- Saved links (GitHub repos, papers, datasets, docs). Attach to a school, a research milestone,
-- or leave all three null for a project-level link.
create table links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  title text not null,
  kind text not null default 'website' check (kind in ('github', 'paper', 'dataset', 'doc', 'website', 'video', 'other')),
  notes text,
  meta jsonb not null default '{}'::jsonb,
  pinned boolean not null default false,
  school_id uuid references schools(id) on delete cascade,
  milestone_id uuid references research_milestones(id) on delete cascade,
  professor_id uuid references professors(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index links_school_idx on links(school_id);
create index links_milestone_idx on links(milestone_id);
create index links_professor_idx on links(professor_id);

alter table links enable row level security;
create policy "owner full access" on links for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
