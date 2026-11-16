create policy collab_files_deny_direct_read on storage.objects as restrictive for select to anon,authenticated using (bucket_id <> 'collab-private-files');
