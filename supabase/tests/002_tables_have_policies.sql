-- A table with row-level security on and no policy is unreachable, which is almost always a mistake.
select 'has_policy_' || t.tablename as name,
       exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.tablename) as ok
from pg_tables t
where t.schemaname = 'public' and t.tablename <> '_applied_migrations'
order by t.tablename;
