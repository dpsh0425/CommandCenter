-- Materials: uploaded files (resume, transcripts, writing samples...) and a structured resume builder.
insert into storage.buckets (id, name, public, file_size_limit)
values ('materials', 'materials', false, 15728640)
on conflict (id) do nothing;

-- Each user only touches files under their own folder: <auth.uid()>/...
create policy "materials read own" on storage.objects for select to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "materials upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "materials update own" on storage.objects for update to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "materials delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);

create table documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  kind text not null default 'other' check (kind in ('resume', 'cv', 'transcript', 'statement', 'writing_sample', 'scores', 'letter', 'other')),
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  version_note text,
  school_id uuid references schools(id) on delete set null,
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);
create index documents_kind_idx on documents(kind);
create index documents_school_idx on documents(school_id);
alter table documents enable row level security;
create policy "owner full access" on documents for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create table resumes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'My resume',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table resumes enable row level security;
create policy "owner full access" on resumes for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create trigger resumes_set_updated_at before update on resumes for each row execute function set_updated_at();
