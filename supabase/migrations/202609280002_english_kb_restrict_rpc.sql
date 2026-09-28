-- Supabase grants new public functions to API roles by default. Remove the
-- anonymous grant explicitly so extracted teaching content requires a session.
begin;

revoke all on function public.english_kb_import_confirm(text,jsonb) from public, anon, authenticated;
revoke all on function public.english_kb_query(smallint,text,text,text,integer) from public, anon, authenticated;
revoke all on function public.english_kb_stats() from public, anon, authenticated;
revoke all on function public.english_kb_import_rollback(text,text) from public, anon, authenticated;

commit;
notify pgrst, 'reload schema';
