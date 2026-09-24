-- Many portals limit characters rather than words, so a statement can carry either limit or both.
alter table statements add column char_limit integer check (char_limit is null or char_limit > 0);
