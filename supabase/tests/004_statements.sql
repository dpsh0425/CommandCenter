select 'statements_owner_policy' as name,
       exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'statements' and policyname = 'owner full access') as ok
union all
select 'snapshots_owner_policy',
       exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'statement_snapshots' and policyname = 'owner full access')
union all
select 'one_statement_per_school_and_kind',
       exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'statements_school_kind_idx');
