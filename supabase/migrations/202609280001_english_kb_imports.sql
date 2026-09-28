-- Reviewed English Bulk Extractor candidates. Original binaries are never stored.
begin;

create table if not exists public.english_kb_import_batches (
  batch_id text primary key check (batch_id ~ '^EKB-[A-Z0-9-]{10,64}$'),
  source_file text not null check (length(source_file) between 1 and 240),
  requested_count integer not null check (requested_count between 1 and 10000),
  inserted_count integer not null default 0 check (inserted_count between 0 and requested_count),
  duplicate_count integer not null default 0 check (duplicate_count between 0 and requested_count),
  created_at timestamptz not null default now()
);

create table if not exists public.english_kb_entries (
  id text primary key check (id ~ '^eng-[a-f0-9]{16}$'),
  import_batch_id text not null references public.english_kb_import_batches(batch_id) on delete cascade,
  schema_version text not null default 'english-kb-candidate/v1' check (schema_version = 'english-kb-candidate/v1'),
  subject text not null default 'english' check (subject = 'english'),
  grade smallint not null check (grade between 5 and 13),
  unit text,
  category text not null check (length(category) between 1 and 80),
  section text not null check (section in ('vocabulary','grammar','reading','writing','mediation','listening','speaking','worksheet','assessment','answer_key','teacher_material','textbook_material','exercise','other')),
  topic text not null check (length(topic) between 1 and 180),
  document_type text not null check (length(document_type) between 1 and 80),
  difficulty text,
  content jsonb not null check (jsonb_typeof(content) = 'object' and octet_length(content::text) <= 120000),
  quality jsonb not null check (jsonb_typeof(quality) = 'object' and octet_length(quality::text) <= 12000),
  source_metadata jsonb not null check (jsonb_typeof(source_metadata) = 'object' and octet_length(source_metadata::text) <= 12000),
  constraint english_kb_entries_no_app_paths check (
    lower(replace(coalesce(source_metadata->>'relative_path',''),'\','/')) !~ '(^|/)unterrichtsassistent(/|$)|(^|/)dua(/|$)'
  ),
  provenance jsonb not null check (jsonb_typeof(provenance) = 'object' and octet_length(provenance::text) <= 12000),
  source_sha256 text not null unique check (source_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists english_kb_entries_lookup_idx on public.english_kb_entries (grade, unit, section);
create index if not exists english_kb_entries_topic_idx on public.english_kb_entries using gin (to_tsvector('simple', topic));
create index if not exists english_kb_entries_import_batch_idx on public.english_kb_entries (import_batch_id);

alter table public.english_kb_import_batches enable row level security;
alter table public.english_kb_entries enable row level security;
revoke all on public.english_kb_import_batches from public, anon, authenticated;
revoke all on public.english_kb_entries from public, anon, authenticated;

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
    raise exception 'Mindestens ein English-KB-Eintrag ist unvollständig oder ungeprüft.' using errcode = '22023';
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

create or replace function public.english_kb_query(
  p_grade smallint default null,
  p_unit text default null,
  p_section text default null,
  p_topic text default null,
  p_limit integer default 100
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(jsonb_agg(row_data order by row_data->'classification'->>'topic'),'[]'::jsonb)
  from (
    select jsonb_build_object(
      'id',id,
      'classification',jsonb_build_object('subject',subject,'grade',grade,'unit',unit,'category',category,'section',section,'topic',topic,'documentType',document_type,'difficulty',difficulty,'confidence',quality->'score','needs_review',false),
      'content',content,
      'quality',quality,
      'source',source_metadata,
      'provenance',provenance || jsonb_build_object('cloudImportedAt',created_at,'importBatchId',import_batch_id)
    ) row_data
    from public.english_kb_entries
    where (p_grade is null or grade=p_grade)
      and (p_unit is null or unit=p_unit)
      and (p_section is null or section=p_section)
      and (p_topic is null or topic ilike '%'||p_topic||'%' or coalesce(content->>'title','') ilike '%'||p_topic||'%')
    order by topic
    limit least(greatest(coalesce(p_limit,100),1),500)
  ) rows;
$$;

create or replace function public.english_kb_stats()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select jsonb_build_object(
    'entries',(select count(*) from public.english_kb_entries),
    'batches',(select count(*) from public.english_kb_import_batches),
    'by_grade',(select coalesce(jsonb_object_agg(grade,c),'{}'::jsonb) from (select grade,count(*) c from public.english_kb_entries group by grade) x),
    'by_section',(select coalesce(jsonb_object_agg(section,c),'{}'::jsonb) from (select section,count(*) c from public.english_kb_entries group by section) x)
  );
$$;

create or replace function public.english_kb_import_rollback(p_passphrase text,p_batch_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare v_deleted integer;
begin
  if p_passphrase is null or not coalesce(public.toolbox_verify_admin(p_passphrase), false) then
    raise exception 'Admin-Passwort ist ungültig.' using errcode = '28000';
  end if;
  delete from public.english_kb_import_batches where batch_id=p_batch_id;
  get diagnostics v_deleted = row_count;
  return jsonb_build_object('status',case when v_deleted=1 then 'rolled_back' else 'not_found' end,'batch_id',p_batch_id);
end
$$;

revoke all on function public.english_kb_import_confirm(text,jsonb) from public, anon, authenticated;
revoke all on function public.english_kb_query(smallint,text,text,text,integer) from public, anon, authenticated;
revoke all on function public.english_kb_stats() from public, anon, authenticated;
revoke all on function public.english_kb_import_rollback(text,text) from public, anon, authenticated;
commit;
notify pgrst, 'reload schema';
