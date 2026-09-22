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

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger schools_set_updated_at
  before update on schools
  for each row execute function set_updated_at();

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
