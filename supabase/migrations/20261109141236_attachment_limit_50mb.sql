-- Raise the existing private bucket limit; preserve MIME and ownership policies.
update storage.buckets set file_size_limit = 52428800 where id = 'journal-files';
