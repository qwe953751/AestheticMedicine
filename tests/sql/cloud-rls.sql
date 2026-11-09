begin;
insert into auth.users (id,aud,role,email) values
('11111111-1111-4111-8111-111111111111','authenticated','authenticated','journal-fixture-a@example.invalid'),
('22222222-2222-4222-8222-222222222222','authenticated','authenticated','journal-fixture-b@example.invalid');
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select public.save_journal(0,'[]'::jsonb);
do $$ begin
  if (select count(*) from public.journal_states) <> 1 then raise exception 'owner read failed'; end if;
  begin perform public.save_journal(0,'[]'::jsonb); raise exception 'stale write not rejected'; exception when sqlstate 'PT409' then null; end;
  begin update public.journal_states set user_id='22222222-2222-4222-8222-222222222222'; raise exception 'ownership change not rejected'; exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
do $$ begin if (select count(*) from public.journal_states) <> 0 then raise exception 'cross-user data exposed'; end if; end $$;
reset role;
do $$ begin
  if has_table_privilege('anon','public.journal_states','select') then raise exception 'anonymous access exposed'; end if;
  if has_function_privilege('anon','public.save_journal(bigint,jsonb)','execute') then raise exception 'anonymous save exposed'; end if;
  if (select public from storage.buckets where id='journal-files') then raise exception 'files publicly exposed'; end if;
end $$;
rollback;
select 'owner read, cross-user isolation, revision conflict, ownership reassignment, anonymous denial, private bucket: passed; fixtures rolled back' as verification;
