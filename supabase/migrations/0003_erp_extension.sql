create type task_status as enum ('todo', 'in_progress', 'blocked', 'done', 'cancelled');
create type task_priority as enum ('low', 'medium', 'high');
create type task_update_type as enum ('note', 'status_change', 'reassignment', 'result');
create type milestone_status as enum ('not_started', 'in_progress', 'done', 'blocked');
create type letter_status as enum ('not_asked', 'asked', 'confirmed', 'submitted');
create type interview_status as enum ('not_scheduled', 'scheduled', 'completed');
create type step_status as enum ('not_started', 'in_progress', 'done');

create table people (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  role text,
  area text,
  email text,
  color text not null default '#c98a3e',
  created_at timestamptz not null default now()
);

create table research_milestones (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  target_date date,
  status milestone_status not null default 'not_started',
  created_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  school_id uuid references schools(id) on delete cascade,
  research_milestone_id uuid references research_milestones(id) on delete cascade,
  assignee_id uuid references people(id) on delete set null,
  status task_status not null default 'todo',
  priority task_priority not null default 'medium',
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_single_link check (not (school_id is not null and research_milestone_id is not null))
);

create table task_updates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  type task_update_type not null,
  content text not null,
  is_win boolean not null default false,
  created_at timestamptz not null default now()
);

create table task_dependencies (
  task_id uuid not null references tasks(id) on delete cascade,
  depends_on_task_id uuid not null references tasks(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  primary key (task_id, depends_on_task_id),
  constraint no_self_dependency check (task_id <> depends_on_task_id)
);

create table letter_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  recommender_id uuid references people(id) on delete set null,
  status letter_status not null default 'not_asked',
  letter_deadline date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sop_versions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  description text,
  external_link text,
  created_at timestamptz not null default now()
);

alter table schools add column sop_version_id uuid references sop_versions(id) on delete set null;
alter table schools add column sop_sent_at date;

create table interviews (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  scheduled_at timestamptz,
  prep_notes text,
  questions_asked text,
  outcome_notes text,
  status interview_status not null default 'not_scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table visa_steps (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  step_name text not null,
  status step_status not null default 'not_started',
  due_date date,
  notes text,
  created_at timestamptz not null default now()
);

create table focus_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  started_at timestamptz not null default now(),
  duration_minutes int not null,
  ended_at timestamptz
);

create trigger tasks_set_updated_at before update on tasks for each row execute function set_updated_at();
create trigger letter_requests_set_updated_at before update on letter_requests for each row execute function set_updated_at();
create trigger interviews_set_updated_at before update on interviews for each row execute function set_updated_at();

alter table people enable row level security;
alter table research_milestones enable row level security;
alter table tasks enable row level security;
alter table task_updates enable row level security;
alter table task_dependencies enable row level security;
alter table letter_requests enable row level security;
alter table sop_versions enable row level security;
alter table interviews enable row level security;
alter table visa_steps enable row level security;
alter table focus_sessions enable row level security;

create policy "owner full access" on people for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "owner full access" on research_milestones for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "owner full access" on tasks for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "owner full access" on task_updates for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "owner full access" on task_dependencies for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "owner full access" on letter_requests for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "owner full access" on sop_versions for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "owner full access" on interviews for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "owner full access" on visa_steps for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "owner full access" on focus_sessions for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
