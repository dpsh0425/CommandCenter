-- School -> Department (optional) -> Professor, with funding attachable at any level.

create type outreach_status as enum ('not_contacted', 'contacted', 'replied', 'meeting', 'no_response', 'declined');
create type accepting_status as enum ('unknown', 'yes', 'no');
create type funding_type as enum ('assistantship', 'fellowship', 'scholarship', 'tuition_waiver', 'stipend', 'other');
create type funding_status as enum ('to_research', 'eligible', 'applied', 'awarded', 'not_eligible');

create table departments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  name text not null,
  program text,
  url text,
  admissions_url text,
  deadline_date date,
  requirements text,
  notes text,
  created_at timestamptz not null default now()
);

create table professors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  department_id uuid references departments(id) on delete set null,
  name text not null,
  title text,
  lab_name text,
  research_areas text[] not null default '{}',
  research_summary text,
  homepage_url text,
  scholar_url text,
  email text,
  accepting accepting_status not null default 'unknown',
  fit_score smallint check (fit_score between 1 and 5),
  outreach outreach_status not null default 'not_contacted',
  last_contacted_on date,
  notes text,
  created_at timestamptz not null default now()
);

create table fundings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  department_id uuid references departments(id) on delete set null,
  professor_id uuid references professors(id) on delete set null,
  name text not null,
  type funding_type not null default 'assistantship',
  amount numeric,
  currency text not null default 'USD',
  period text,
  covers text,
  deadline_date date,
  url text,
  status funding_status not null default 'to_research',
  notes text,
  created_at timestamptz not null default now()
);

create index departments_school_idx on departments(school_id);
create index professors_school_idx on professors(school_id);
create index professors_department_idx on professors(department_id);
create index fundings_school_idx on fundings(school_id);

alter table departments enable row level security;
alter table professors enable row level security;
alter table fundings enable row level security;

create policy "owner full access" on departments for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "owner full access" on professors for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "owner full access" on fundings for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Carry over the single "faculty" text each school already has (split on commas)
-- so no existing target is lost. The old columns stay for the schools list.
insert into professors (owner_id, school_id, name, research_summary)
select s.owner_id, s.id, trim(n), s.fit_note
from schools s, unnest(string_to_array(s.faculty, ',')) as n
where s.faculty is not null and trim(n) <> '';
