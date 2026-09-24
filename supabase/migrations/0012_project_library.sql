-- Per-project library: files and links share folders, tags, notes and pinning.
alter table documents drop constraint documents_kind_check;
alter table documents add constraint documents_kind_check check (kind in (
  'resume', 'cv', 'transcript', 'statement', 'writing_sample', 'scores', 'letter', 'other',
  'paper', 'data', 'code', 'figure', 'slides', 'notes', 'proposal', 'ethics'
));
alter table documents
  add column project_id uuid references research_projects(id) on delete cascade,
  add column folder text,
  add column tags text[] not null default '{}',
  add column notes text,
  add column pinned boolean not null default false,
  add column replaces_id uuid references documents(id) on delete set null;
create index documents_project_idx on documents(project_id);

alter table links
  add column folder text,
  add column tags text[] not null default '{}';
