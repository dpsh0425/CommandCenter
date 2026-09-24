-- Counts saves of a section's text, so two tabs or two people cannot silently overwrite each other.
alter table research_sections add column body_version integer not null default 0 check (body_version >= 0);
