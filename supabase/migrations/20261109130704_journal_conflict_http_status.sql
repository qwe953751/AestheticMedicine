-- Report a version conflict as HTTP 409, not a retryable server failure.
create or replace function public.save_journal(expected_revision bigint, new_entries jsonb)
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
  if next_revision is null then raise exception 'journal revision conflict' using errcode = 'PT409'; end if;
  return next_revision;
end;
$$;
