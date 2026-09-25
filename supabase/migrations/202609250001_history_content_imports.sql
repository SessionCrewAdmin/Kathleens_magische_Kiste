-- V2 Content Extractor: additive, reviewed extensions to the canonical
-- History Knowledge Base. Original source files and page text are never stored.
begin;

create table if not exists public.history_content_imports (
  import_id text primary key,
  chapter_id text not null,
  grade smallint not null check (grade in (7, 9, 10, 12)),
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  extractor_version text not null default '2.0.0',
  source_metadata jsonb not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (chapter_id, source_sha256),
  check (octet_length(source_metadata::text) <= 12000),
  check (octet_length(payload::text) <= 180000)
);

alter table public.history_content_imports enable row level security;
revoke all on public.history_content_imports from public, anon, authenticated;

create or replace function public.history_import_confirm(
  p_passphrase text,
  p_import jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_import_id text;
  v_chapter_id text;
  v_grade smallint;
  v_sha text;
  v_inserted integer;
  v_existing text;
  v_topics jsonb;
  v_sources jsonb;
begin
  if p_passphrase is null or not coalesce(public.toolbox_verify_admin(p_passphrase), false) then
    raise exception 'Admin-Passwort ist ungültig.' using errcode = '28000';
  end if;
  if p_import is null or jsonb_typeof(p_import) <> 'object'
     or octet_length(p_import::text) > 200000 then
    raise exception 'Importdaten fehlen oder sind zu groß.' using errcode = '22023';
  end if;

  v_import_id := p_import->>'import_id';
  v_chapter_id := p_import->>'chapter_id';
  v_grade := (p_import->>'grade')::smallint;
  v_sha := p_import->>'source_sha256';
  v_topics := p_import->'payload'->'topics';
  v_sources := p_import->'payload'->'source_inventory';

  if coalesce(p_import->>'extractor_version','') <> '2.0.0'
     or coalesce(v_import_id,'') !~ '^IMP-[A-Z0-9-]{10,48}$'
     or coalesce(v_chapter_id,'') !~ '^g(7|9|10|12)-k[1-9]$'
     or coalesce(v_chapter_id,'') not in ('g7-k1','g7-k2','g7-k3','g7-k4','g7-k5','g7-k6','g7-k7','g9-k1','g9-k2','g9-k3','g9-k4','g9-k5','g10-k1','g10-k2','g12-k1','g12-k2','g12-k3','g12-k4','g12-k5','g12-k6','g12-k7')
     or coalesce(v_grade,0) not in (7,9,10,12)
     or split_part(v_chapter_id,'-',1) <> ('g'||v_grade::text)
     or coalesce(v_sha,'') !~ '^[a-f0-9]{64}$'
     or jsonb_typeof(p_import->'source_metadata') <> 'object'
     or length(btrim(coalesce(p_import->'source_metadata'->>'file',''))) not between 1 and 240
     or coalesce(p_import->'source_metadata'->>'type','') <> 'application/pdf'
     or coalesce((p_import->'source_metadata'->>'size_bytes')::integer,0) not between 1 and 20971520
     or coalesce((p_import->'source_metadata'->>'pages')::integer,0) not between 1 and 100
     or jsonb_typeof(v_topics) <> 'array' or jsonb_array_length(v_topics) < 1
     or jsonb_array_length(v_topics) > 80
     or jsonb_typeof(v_sources) <> 'array' or jsonb_array_length(v_sources) <> 1
     or coalesce(v_sources->0->>'id','') = ''
     or coalesce(v_sources->0->>'binary_in_repo','true') <> 'false' then
    raise exception 'Importdaten entsprechen nicht dem History-Schema.' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(v_topics) as item(value)
     where jsonb_typeof(item.value) <> 'object'
        or length(coalesce(item.value->>'id','')) not between 4 and 100
        or length(btrim(coalesce(item.value->>'title',''))) not between 2 and 180
        or length(btrim(coalesce(item.value->>'summary',''))) not between 10 and 800
        or jsonb_typeof(item.value->'source_refs') <> 'array'
        or not coalesce(item.value->'source_refs' @> jsonb_build_array(jsonb_build_object('source_id',v_sources->0->>'id')),false)
        or coalesce(item.value->'extraction_provenance'->>'kind','') <> 'uploaded_material'
        or coalesce(item.value->'extraction_provenance'->>'extractor_version','') <> '2.0.0'
        or coalesce(item.value->'extraction_provenance'->>'reviewed','false') <> 'true'
        or coalesce((item.value->'extraction_provenance'->>'confidence')::numeric,-1) not between 0 and 1
  ) then
    raise exception 'Ein Thema ist unvollständig oder ohne Herkunftsangabe.' using errcode = '22023';
  end if;
  if (select count(*) from jsonb_array_elements(v_topics)) <>
     (select count(distinct value->>'id') from jsonb_array_elements(v_topics)) then
    raise exception 'Themen-IDs sind innerhalb des Imports nicht eindeutig.' using errcode = '22023';
  end if;

  insert into public.history_content_imports
    (import_id,chapter_id,grade,source_sha256,extractor_version,source_metadata,payload)
  values
    (v_import_id,v_chapter_id,v_grade,v_sha,'2.0.0',p_import->'source_metadata',p_import->'payload')
  on conflict (chapter_id,source_sha256) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    select import_id into v_existing from public.history_content_imports
     where chapter_id=v_chapter_id and source_sha256=v_sha;
    return jsonb_build_object('status','duplicate','import_id',v_existing,'chapter_id',v_chapter_id);
  end if;

  return jsonb_build_object(
    'status','imported','import_id',v_import_id,'chapter_id',v_chapter_id,
    'topics',jsonb_array_length(v_topics),'sources',jsonb_array_length(v_sources),
    'created_at',now()
  );
end
$$;

create or replace function public.history_import_rollback(
  p_passphrase text,
  p_import_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_deleted integer;
begin
  if p_passphrase is null or not coalesce(public.toolbox_verify_admin(p_passphrase), false) then
    raise exception 'Admin-Passwort ist ungültig.' using errcode = '28000';
  end if;
  delete from public.history_content_imports where import_id=p_import_id;
  get diagnostics v_deleted = row_count;
  return jsonb_build_object('status',case when v_deleted=1 then 'rolled_back' else 'not_found' end,'import_id',p_import_id);
end
$$;

create or replace function public.history_import_list(p_chapter_id text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(jsonb_agg(
    payload || jsonb_build_object(
      'import_id',import_id,'chapter_id',chapter_id,'grade',grade,
      'extractor_version',extractor_version,'created_at',created_at,
      'source_sha256',source_sha256,'source_metadata',source_metadata
    ) order by created_at
  ),'[]'::jsonb)
  from public.history_content_imports
  where chapter_id=p_chapter_id;
$$;

revoke all on function public.history_import_confirm(text,jsonb) from public;
revoke all on function public.history_import_list(text) from public;
revoke all on function public.history_import_rollback(text,text) from public;
grant execute on function public.history_import_confirm(text,jsonb) to anon, authenticated;
grant execute on function public.history_import_list(text) to anon, authenticated;
grant execute on function public.history_import_rollback(text,text) to anon, authenticated;

commit;
notify pgrst, 'reload schema';
