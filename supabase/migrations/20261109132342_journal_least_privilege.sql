-- Supabase default privileges can grant ALL to authenticated on new tables.
-- RLS is not a substitute for revoking TRUNCATE and other unused privileges.
revoke all privileges on table public.journal_states from public, anon, authenticated;
grant select, insert, update on table public.journal_states to authenticated;
