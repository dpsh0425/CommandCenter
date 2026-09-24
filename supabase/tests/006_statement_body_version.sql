select 'statement_body_version_column' as name,
       exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'statements' and column_name = 'body_version') as ok;
