-- Keep copyrighted extracted material private until a dedicated authorization
-- model is introduced, and index the batch foreign key used by rollbacks.
begin;

revoke all on function public.english_kb_import_confirm(text,jsonb) from public, anon, authenticated;
revoke all on function public.english_kb_query(smallint,text,text,text,integer) from public, anon, authenticated;
revoke all on function public.english_kb_stats() from public, anon, authenticated;
revoke all on function public.english_kb_import_rollback(text,text) from public, anon, authenticated;

create index if not exists english_kb_entries_import_batch_idx
  on public.english_kb_entries (import_batch_id);

commit;
notify pgrst, 'reload schema';
