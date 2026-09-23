-- Which schools you are actually applying to, and the manual checklist items for each.
alter table schools add column applying boolean not null default false;

create table application_checks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  item text not null,
  done boolean not null default false,
  done_at timestamptz,
  unique (school_id, item)
);
create index application_checks_school_idx on application_checks(school_id);
alter table application_checks enable row level security;
create policy "owner full access" on application_checks for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
