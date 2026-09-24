select 'statement_char_limit_column' as name,
       exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'statements' and column_name = 'char_limit') as ok;
