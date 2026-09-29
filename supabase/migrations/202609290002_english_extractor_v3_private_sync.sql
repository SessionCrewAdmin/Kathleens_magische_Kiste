-- Private, explicit, user-owned sync for English Extractor V3.
-- Original PDFs, complete documents and folders are deliberately excluded.
begin;

create table if not exists public.english_kb_sync_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null check (length(item_id) between 3 and 240),
  item_kind text not null check (item_kind in ('document','recognition_rule')),
  payload jsonb not null check (jsonb_typeof(payload)='object' and octet_length(payload::text)<=500000),
  source_sha256 text check (source_sha256 is null or source_sha256 ~ '^[a-f0-9]{64}$'),
  version integer not null default 1 check (version between 1 and 2147483647),
  device_id text not null check (length(device_id) between 3 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id,item_id)
);

create index if not exists english_kb_sync_items_updated_idx on public.english_kb_sync_items(user_id,updated_at desc);
alter table public.english_kb_sync_items enable row level security;
revoke all on public.english_kb_sync_items from public,anon;
grant select,insert,update,delete on public.english_kb_sync_items to authenticated;

drop policy if exists "english kb owners select" on public.english_kb_sync_items;
create policy "english kb owners select" on public.english_kb_sync_items for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists "english kb owners insert" on public.english_kb_sync_items;
create policy "english kb owners insert" on public.english_kb_sync_items for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists "english kb owners update" on public.english_kb_sync_items;
create policy "english kb owners update" on public.english_kb_sync_items for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists "english kb owners delete" on public.english_kb_sync_items;
create policy "english kb owners delete" on public.english_kb_sync_items for delete to authenticated using ((select auth.uid())=user_id);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('english-kb-previews','english-kb-previews',false,2097152,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "english kb preview owners select" on storage.objects;
create policy "english kb preview owners select" on storage.objects for select to authenticated using (bucket_id='english-kb-previews' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "english kb preview owners insert" on storage.objects;
create policy "english kb preview owners insert" on storage.objects for insert to authenticated with check (bucket_id='english-kb-previews' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "english kb preview owners update" on storage.objects;
create policy "english kb preview owners update" on storage.objects for update to authenticated using (bucket_id='english-kb-previews' and (storage.foldername(name))[1]=(select auth.uid())::text) with check (bucket_id='english-kb-previews' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "english kb preview owners delete" on storage.objects;
create policy "english kb preview owners delete" on storage.objects for delete to authenticated using (bucket_id='english-kb-previews' and (storage.foldername(name))[1]=(select auth.uid())::text);

create or replace function public.english_kb_sync_write(p_item jsonb,p_expected_version integer default null)
returns public.english_kb_sync_items
language plpgsql
security invoker
set search_path=public,pg_catalog
as $$
declare v_user uuid:=(select auth.uid());v_row public.english_kb_sync_items;
begin
  if v_user is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if jsonb_typeof(p_item)<>'object' or octet_length(p_item::text)>510000 then raise exception 'Invalid sync item' using errcode='22023'; end if;
  if p_expected_version is null then
    insert into public.english_kb_sync_items(user_id,item_id,item_kind,payload,source_sha256,device_id)
    values(v_user,p_item->>'item_id',p_item->>'item_kind',p_item->'payload',nullif(p_item->>'source_sha256',''),p_item->>'device_id')
    on conflict(user_id,item_id) do nothing returning * into v_row;
  else
    update public.english_kb_sync_items set payload=p_item->'payload',source_sha256=nullif(p_item->>'source_sha256',''),device_id=p_item->>'device_id',version=version+1,updated_at=now(),deleted_at=null
    where user_id=v_user and item_id=p_item->>'item_id' and version=p_expected_version returning * into v_row;
  end if;
  if v_row.item_id is null then raise exception 'Sync conflict' using errcode='40001'; end if;
  return v_row;
end $$;

revoke all on function public.english_kb_sync_write(jsonb,integer) from public,anon;
grant execute on function public.english_kb_sync_write(jsonb,integer) to authenticated;

commit;
notify pgrst,'reload schema';
