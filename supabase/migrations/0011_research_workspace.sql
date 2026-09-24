-- Research workspace: several projects (solo or team), each with a journal, reading list and meetings.
create table research_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  question text,
  description text,
  status text not null default 'active' check (status in ('idea', 'planning', 'active', 'writing', 'submitted', 'published', 'paused')),
  start_date date,
  target_date date,
  venue text,
  venue_deadline date,
  created_at timestamptz not null default now()
);

create table research_project_members (
  project_id uuid not null references research_projects(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  role text,
  primary key (project_id, person_id)
);

alter table research_milestones add column project_id uuid references research_projects(id) on delete cascade;
alter table links add column project_id uuid references research_projects(id) on delete cascade;
alter table tasks add column project_id uuid references research_projects(id) on delete cascade;
create index research_milestones_project_idx on research_milestones(project_id);
create index links_project_idx on links(project_id);
create index tasks_project_idx on tasks(project_id);

create table research_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references research_projects(id) on delete cascade,
  kind text not null default 'other' check (kind in ('experiment', 'reading', 'meeting', 'writing', 'analysis', 'data', 'coding', 'decision', 'idea', 'admin', 'other')),
  title text not null,
  body text,
  occurred_on date not null default current_date,
  minutes integer check (minutes is null or minutes >= 0),
  person_id uuid references people(id) on delete set null,
  milestone_id uuid references research_milestones(id) on delete set null,
  created_at timestamptz not null default now()
);
create index research_entries_project_idx on research_entries(project_id, occurred_on desc);

create table research_papers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references research_projects(id) on delete cascade,
  title text not null,
  authors text,
  year smallint,
  url text,
  status text not null default 'to_read' check (status in ('to_read', 'reading', 'read', 'cite')),
  takeaway text,
  notes text,
  created_at timestamptz not null default now()
);
create index research_papers_project_idx on research_papers(project_id);

create table research_meetings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references research_projects(id) on delete cascade,
  title text not null,
  held_on date not null default current_date,
  attendee_ids uuid[] not null default '{}',
  agenda text,
  notes text,
  decisions text,
  created_at timestamptz not null default now()
);
create index research_meetings_project_idx on research_meetings(project_id, held_on desc);

alter table research_projects enable row level security;
alter table research_project_members enable row level security;
alter table research_entries enable row level security;
alter table research_papers enable row level security;
alter table research_meetings enable row level security;
create policy "owner full access" on research_projects for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "owner full access" on research_project_members for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "owner full access" on research_entries for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "owner full access" on research_papers for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "owner full access" on research_meetings for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Move the existing single project into the new structure.
with p as (
  insert into research_projects (owner_id, title, description, status)
  select owner_id, 'The Broken Ruler', 'Nepali benchmark measurement-error study.', 'active'
  from research_milestones limit 1
  returning id, owner_id
)
update research_milestones m set project_id = p.id from p where m.owner_id = p.owner_id;

update links l set project_id = (select id from research_projects limit 1)
where l.school_id is null and l.milestone_id is null and l.professor_id is null and exists (select 1 from research_projects);
