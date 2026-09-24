select 'rls_enabled_on_' || tablename as name, rowsecurity as ok
from pg_tables
where schemaname = 'public'
order by tablename;
