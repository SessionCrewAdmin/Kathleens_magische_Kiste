-- Generator-ready English Knowledge Base. Keeps source documents, reviewed
-- content units and reusable task blueprints in one private provenance chain.
begin;

alter table public.english_kb_entries
  add column if not exists review_status text not null default 'reviewed'
    check (review_status in ('automatic','needs_review','reviewed','approved','blocked','superseded')),
  add column if not exists approved_uses text[] not null default array['practice']::text[]
    check (approved_uses <@ array['practice','worksheet','assessment']::text[]),
  add column if not exists competency_refs jsonb not null default '[]'::jsonb
    check (jsonb_typeof(competency_refs)='array' and octet_length(competency_refs::text)<=24000),
  add column if not exists content_version integer not null default 1 check (content_version between 1 and 100000);

create table if not exists public.english_kb_content_units (
  id text primary key check (id ~ '^eng-[a-f0-9]{16}:u[1-9][0-9]{0,3}$'),
  entry_id text not null references public.english_kb_entries(id) on delete cascade,
  unit_index smallint not null check (unit_index between 1 and 1000),
  content_type text not null check (content_type in ('vocabulary','grammar','reading','writing','mediation','listening','culture','exercise','assessment_reference')),
  title text not null check (length(title) between 1 and 240),
  payload jsonb not null check (jsonb_typeof(payload)='object' and octet_length(payload::text)<=160000),
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  review_status text not null default 'reviewed' check (review_status in ('automatic','needs_review','reviewed','approved','blocked','superseded')),
  approved_uses text[] not null default array['practice']::text[] check (approved_uses <@ array['practice','worksheet','assessment']::text[]),
  source_pages integer[] not null default '{}',
  competency_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(competency_refs)='array'),
  version integer not null default 1 check (version between 1 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(entry_id,unit_index)
);

create table if not exists public.english_kb_task_blueprints (
  id uuid primary key default extensions.gen_random_uuid(),
  content_unit_id text not null references public.english_kb_content_units(id) on delete restrict,
  task_type text not null check (task_type in ('vocabulary','grammar','reading','writing','mediation','listening','culture','mixed')),
  prompt text not null check (length(prompt) between 1 and 12000),
  solution jsonb not null check (jsonb_typeof(solution) in ('object','array')),
  rubric jsonb not null default '[]'::jsonb check (jsonb_typeof(rubric)='array'),
  points smallint not null check (points between 1 and 100),
  difficulty text not null default 'standard' check (difficulty in ('easy','standard','challenge')),
  competency_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(competency_refs)='array'),
  review_status text not null default 'draft' check (review_status in ('draft','reviewed','approved','blocked','superseded')),
  approved_for_assessment boolean not null default false,
  generated boolean not null default false,
  provenance jsonb not null check (jsonb_typeof(provenance)='object'),
  version integer not null default 1 check (version between 1 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists english_kb_content_units_lookup_idx on public.english_kb_content_units(content_type,review_status);
create index if not exists english_kb_content_units_entry_idx on public.english_kb_content_units(entry_id);
create index if not exists english_kb_task_blueprints_lookup_idx on public.english_kb_task_blueprints(task_type,review_status,approved_for_assessment);

alter table public.english_kb_content_units enable row level security;
alter table public.english_kb_task_blueprints enable row level security;
revoke all on public.english_kb_content_units from public,anon,authenticated;
revoke all on public.english_kb_task_blueprints from public,anon,authenticated;

create or replace function public.english_kb_entry_review_fields()
returns trigger language plpgsql set search_path=public,pg_catalog as $$
begin
  new.review_status:=case when new.provenance->>'reviewStatus'='approved' then 'approved' else 'reviewed' end;
  if jsonb_typeof(new.provenance->'approvedUses')='array' then
    new.approved_uses:=array(select value from jsonb_array_elements_text(new.provenance->'approvedUses') value where value in ('practice','worksheet','assessment'));
  end if;
  if cardinality(new.approved_uses)=0 then new.approved_uses:=array['practice']::text[]; end if;
  new.competency_refs:=case when jsonb_typeof(new.provenance->'competencyRefs')='array' then new.provenance->'competencyRefs' else '[]'::jsonb end;
  return new;
end $$;

drop trigger if exists english_kb_entry_review_fields_trigger on public.english_kb_entries;
create trigger english_kb_entry_review_fields_trigger before insert or update of provenance on public.english_kb_entries for each row execute function public.english_kb_entry_review_fields();

create or replace function public.english_kb_entry_create_units()
returns trigger language plpgsql set search_path=public,pg_catalog as $$
begin
  insert into public.english_kb_content_units(id,entry_id,unit_index,content_type,title,payload,confidence,review_status,approved_uses,source_pages,competency_refs)
  select new.id||':u'||o.ordinality,new.id,o.ordinality,
    case when o.value->>'type' in ('vocabulary','grammar','reading','writing','mediation','listening','culture','exercise','assessment_reference') then o.value->>'type' when new.section in ('vocabulary','grammar','reading','writing','mediation','listening','exercise') then new.section else 'exercise' end,
    left(coalesce(nullif(o.value->>'title',''),new.topic),240),o.value,
    least(1,greatest(0,coalesce((o.value->>'confidence')::numeric,(new.quality->>'score')::numeric,0.5))),new.review_status,new.approved_uses,
    coalesce(array(select jsonb_array_elements_text(coalesce(o.value->'sourcePages','[]'::jsonb))::integer),'{}'::integer[]),new.competency_refs
  from jsonb_array_elements(case when jsonb_typeof(new.content->'objects')='array' and jsonb_array_length(new.content->'objects')>0 then new.content->'objects' else jsonb_build_array(coalesce(new.content->'semantic',new.content)) end) with ordinality o(value,ordinality)
  on conflict(id) do nothing;
  return new;
end $$;

drop trigger if exists english_kb_entry_create_units_trigger on public.english_kb_entries;
create trigger english_kb_entry_create_units_trigger after insert on public.english_kb_entries for each row execute function public.english_kb_entry_create_units();

revoke all on function public.english_kb_entry_review_fields() from public,anon,authenticated;
revoke all on function public.english_kb_entry_create_units() from public,anon,authenticated;

insert into public.english_kb_content_units(id,entry_id,unit_index,content_type,title,payload,confidence,review_status,approved_uses,source_pages,competency_refs)
select e.id||':u'||o.ordinality,e.id,o.ordinality,
       case when o.value->>'type' in ('vocabulary','grammar','reading','writing','mediation','listening','culture','exercise','assessment_reference') then o.value->>'type'
            when e.section in ('vocabulary','grammar','reading','writing','mediation','listening','exercise') then e.section else 'exercise' end,
       left(coalesce(nullif(o.value->>'title',''),e.topic),240),o.value,
       least(1,greatest(0,coalesce((o.value->>'confidence')::numeric,(e.quality->>'score')::numeric,0.5))),
       e.review_status,e.approved_uses,
       coalesce(array(select jsonb_array_elements_text(coalesce(o.value->'sourcePages','[]'::jsonb))::integer),'{}'::integer[]),e.competency_refs
from public.english_kb_entries e
cross join lateral jsonb_array_elements(case when jsonb_typeof(e.content->'objects')='array' and jsonb_array_length(e.content->'objects')>0 then e.content->'objects' else jsonb_build_array(e.content) end) with ordinality o(value,ordinality)
on conflict (id) do nothing;

commit;
notify pgrst,'reload schema';
