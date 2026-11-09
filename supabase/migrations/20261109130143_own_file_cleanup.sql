-- Allow an authenticated owner to remove their private objects. No cross-user deletion.
create policy own_journal_files_delete on storage.objects for delete to authenticated
using (bucket_id = 'journal-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
