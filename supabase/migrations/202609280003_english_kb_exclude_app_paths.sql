-- Keep DUA/Unterrichtsassistent app trees out of the reviewed document KB.
begin;

alter table public.english_kb_entries
  add constraint english_kb_entries_no_app_paths check (
    lower(replace(coalesce(source_metadata->>'relative_path',''),'\','/')) !~ '(^|/)unterrichtsassistent(/|$)|(^|/)dua(/|$)'
  );

create or replace function public.english_kb_import_confirm(
  p_passphrase text,
  p_batch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_batch_id text := p_batch->>'batch_id';
  v_source_file text := p_batch->>'source_file';
  v_entries jsonb := p_batch->'entries';
  v_requested integer;
  v_inserted integer := 0;
begin
  if p_passphrase is null or not coalesce(public.toolbox_verify_admin(p_passphrase), false) then
    raise exception 'Admin-Passwort ist ungültig.' using errcode = '28000';
  end if;
  if p_batch is null or jsonb_typeof(p_batch) <> 'object' or octet_length(p_batch::text) > 2600000
     or coalesce(v_batch_id,'') !~ '^EKB-[A-Z0-9-]{10,64}$'
     or length(coalesce(v_source_file,'')) not between 1 and 240
     or jsonb_typeof(v_entries) <> 'array' then
    raise exception 'English-KB-Importdaten fehlen oder sind ungültig.' using errcode = '22023';
  end if;
  v_requested := jsonb_array_length(v_entries);
  if v_requested not between 1 and 500 then
    raise exception 'Ein Importbatch muss 1 bis 500 Einträge enthalten.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_entries) item(value)
    where jsonb_typeof(item.value) <> 'object'
       or coalesce(item.value->>'id','') !~ '^eng-[a-f0-9]{16}$'
       or coalesce(item.value->>'schema_version','') <> 'english-kb-candidate/v1'
       or coalesce(item.value->>'subject','') <> 'english'
       or coalesce((item.value->>'grade')::integer,0) not between 5 and 13
       or coalesce(item.value->>'section','') not in ('vocabulary','grammar','reading','writing','mediation','listening','speaking','worksheet','assessment','answer_key','teacher_material','textbook_material','exercise','other')
       or length(btrim(coalesce(item.value->>'topic',''))) not between 1 and 180
       or jsonb_typeof(item.value->'content') <> 'object'
       or jsonb_typeof(item.value->'quality') <> 'object'
       or jsonb_typeof(item.value->'source') <> 'object'
       or coalesce(item.value->'source'->>'sha256','') !~ '^[a-f0-9]{64}$'
       or length(coalesce(item.value->'source'->>'file_name','')) not between 1 and 240
       or length(coalesce(item.value->'source'->>'relative_path','')) not between 1 and 1000
       or lower(replace(coalesce(item.value->'source'->>'relative_path',''),'\','/')) ~ '(^|/)unterrichtsassistent(/|$)|(^|/)dua(/|$)'
       or jsonb_typeof(item.value->'provenance') <> 'object'
       or coalesce(item.value->'provenance'->>'reviewed','false') <> 'true'
       or coalesce(item.value->'provenance'->>'reviewedAt','') = ''
       or octet_length((item.value->'content')::text) > 120000
  ) then
    raise exception 'Mindestens ein English-KB-Eintrag ist unvollständig, ungeprüft oder stammt aus einem App-Pfad.' using errcode = '22023';
  end if;
  if v_requested <> (select count(distinct value->>'id') from jsonb_array_elements(v_entries))
     or v_requested <> (select count(distinct value->'source'->>'sha256') from jsonb_array_elements(v_entries)) then
    raise exception 'IDs und Quellenhashes müssen innerhalb des Imports eindeutig sein.' using errcode = '22023';
  end if;

  insert into public.english_kb_import_batches(batch_id,source_file,requested_count)
  values(v_batch_id,v_source_file,v_requested);

  insert into public.english_kb_entries(
    id,import_batch_id,schema_version,subject,grade,unit,category,section,topic,
    document_type,difficulty,content,quality,source_metadata,provenance,source_sha256
  )
  select
    value->>'id',v_batch_id,value->>'schema_version','english',(value->>'grade')::smallint,
    nullif(value->>'unit',''),value->>'category',value->>'section',value->>'topic',
    value->>'document_type',nullif(value->>'difficulty',''),value->'content',value->'quality',
    value->'source',value->'provenance',value->'source'->>'sha256'
  from jsonb_array_elements(v_entries)
  on conflict (source_sha256) do nothing;
  get diagnostics v_inserted = row_count;

  update public.english_kb_import_batches
  set inserted_count=v_inserted,duplicate_count=v_requested-v_inserted
  where batch_id=v_batch_id;

  return jsonb_build_object('status','imported','batch_id',v_batch_id,'requested',v_requested,'inserted',v_inserted,'duplicates',v_requested-v_inserted);
end
$$;

revoke all on function public.english_kb_import_confirm(text,jsonb) from public, anon, authenticated;

commit;
notify pgrst, 'reload schema';
