-- Experiments (what was tried, with what, and what came out) and paper sections (the writing).
create table research_experiments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references research_projects(id) on delete cascade,
  name text not null,
  hypothesis text,
  status text not null default 'planned' check (status in ('planned', 'running', 'done', 'failed', 'abandoned')),
  outcome text check (outcome in ('supported', 'refuted', 'inconclusive')),
  setup text,
  code_ref text,
  data_ref text,
  metrics jsonb not null default '[]'::jsonb,
  result text,
  run_on date,
  person_id uuid references people(id) on delete set null,
  milestone_id uuid references research_milestones(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index research_experiments_project_idx on research_experiments(project_id);
create trigger research_experiments_set_updated_at before update on research_experiments for each row execute function set_updated_at();

create table research_sections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references research_projects(id) on delete cascade,
  name text not null,
  status text not null default 'not_started' check (status in ('not_started', 'outlining', 'drafting', 'revising', 'done')),
  position integer not null default 0,
  target_words integer check (target_words is null or target_words >= 0),
  words integer not null default 0,
  body text not null default '',
  notes text,
  due_date date,
  person_id uuid references people(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index research_sections_project_idx on research_sections(project_id, position);
create trigger research_sections_set_updated_at before update on research_sections for each row execute function set_updated_at();

alter table research_experiments enable row level security;
alter table research_sections enable row level security;
create policy "owner full access" on research_experiments for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "owner full access" on research_sections for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
