select 'materials_bucket_exists_and_is_private' as name,
       exists (select 1 from storage.buckets where id = 'materials' and public = false) as ok;
