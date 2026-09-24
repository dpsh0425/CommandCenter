select 'letter_tracking_columns' as name,
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'letter_requests'
           and column_name in ('asked_on', 'last_reminded_on', 'reminder_count', 'received_on')) = 4 as ok;
