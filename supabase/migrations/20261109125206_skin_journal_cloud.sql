create table public.journal_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  entries jsonb not null default '[]'::jsonb check (jsonb_typeof(entries) = 'array' and jsonb_array_length(entries) <= 5000 and octet_length(entries::text) <= 2097152),
  updated_at timestamptz not null default now()
);
alter table public.journal_states enable row level security;
revoke all on public.journal_states from anon;
grant select, insert, update on public.journal_states to authenticated;
create policy own_journal_select on public.journal_states for select to authenticated using ((select auth.uid()) = user_id);
create policy own_journal_insert on public.journal_states for insert to authenticated with check ((select auth.uid()) = user_id);
create policy own_journal_update on public.journal_states for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create function public.save_journal(expected_revision bigint, new_entries jsonb)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare next_revision bigint;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if expected_revision = 0 then
    insert into public.journal_states (user_id, revision, entries) values (auth.uid(), 1, new_entries)
    on conflict (user_id) do nothing returning revision into next_revision;
  else
    update public.journal_states set revision = revision + 1, entries = new_entries, updated_at = now()
    where user_id = auth.uid() and revision = expected_revision returning revision into next_revision;
  end if;
  if next_revision is null then raise exception 'journal revision conflict' using errcode = '40001'; end if;
  return next_revision;
end;
$$;
revoke execute on function public.save_journal(bigint, jsonb) from public, anon;
grant execute on function public.save_journal(bigint, jsonb) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('journal-files', 'journal-files', false, 8388608, array['image/jpeg','image/png','image/webp','application/pdf']);
create policy own_journal_files_select on storage.objects for select to authenticated using (bucket_id = 'journal-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy own_journal_files_insert on storage.objects for insert to authenticated with check (bucket_id = 'journal-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- Files are immutable. Replacements receive a new content hash; no public URLs.
