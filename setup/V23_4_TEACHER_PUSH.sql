-- ============================================================
-- Kathleens Kiste · V23.4 TEACHER PUSH CENTER
-- Teacher-only Web Push subscriptions + scheduled reminders.
--
-- Prerequisites:
--   1) Deploy supabase/functions/teacher-push with --no-verify-jwt
--   2) Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
--
-- This patch is NON-DESTRUCTIVE.
-- ============================================================

begin;

create extension if not exists pgcrypto;

create table if not exists public.teacher_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device_label text not null default 'Kathleens Gerät',
  user_agent text,
  active boolean not null default true,
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.teacher_push_admin_tokens (
  token_hash text primary key,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.teacher_push_reminders (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 500),
  target_url text not null default './',
  scheduled_for timestamptz not null,
  recurrence text not null default 'none'
    check (recurrence in ('none','daily','weekdays')),
  timezone_name text not null default 'Europe/Berlin',
  active boolean not null default true,
  processing_at timestamptz,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists teacher_push_reminders_due_idx
  on public.teacher_push_reminders(active, scheduled_for)
  where active=true;

alter table public.teacher_push_subscriptions enable row level security;
alter table public.teacher_push_reminders enable row level security;
alter table public.teacher_push_admin_tokens enable row level security;

revoke all on public.teacher_push_subscriptions from anon, authenticated;
revoke all on public.teacher_push_reminders from anon, authenticated;
revoke all on public.teacher_push_admin_tokens from anon, authenticated;

create or replace function public.teacher_push_issue_token(p_passphrase text)
returns text
language plpgsql
security definer
set search_path=public,pg_catalog
as $push$
declare
  ok boolean := false;
  raw_token text;
begin
  select public.toolbox_verify_admin(p_passphrase) into ok;
  if not coalesce(ok,false) then return null; end if;

  delete from public.teacher_push_admin_tokens where expires_at < now();
  raw_token := translate(encode(gen_random_bytes(32),'base64'), E'+/=\n\r', '-_');
  insert into public.teacher_push_admin_tokens(token_hash,expires_at)
  values(encode(digest(raw_token,'sha256'),'hex'), now()+interval '30 minutes')
  on conflict(token_hash) do update set expires_at=excluded.expires_at;
  return raw_token;
end;
$push$;

create or replace function public.teacher_push_check_token(p_token text)
returns boolean
language plpgsql
security definer
set search_path=public,pg_catalog
as $push$
declare
  h text;
  ok boolean;
begin
  if length(coalesce(p_token,'')) < 20 then return false; end if;
  h := encode(digest(p_token,'sha256'),'hex');
  select exists(
    select 1 from public.teacher_push_admin_tokens
    where token_hash=h and expires_at > now()
  ) into ok;
  return coalesce(ok,false);
end;
$push$;

create or replace function public.teacher_push_claim_due(p_limit integer default 20)
returns setof public.teacher_push_reminders
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
begin
  return query
  with due as (
    select id
    from public.teacher_push_reminders
    where active=true
      and scheduled_for <= now()
      and (processing_at is null or processing_at < now() - interval '10 minutes')
    order by scheduled_for
    limit greatest(1,least(coalesce(p_limit,20),50))
    for update skip locked
  )
  update public.teacher_push_reminders r
     set processing_at=now(), updated_at=now()
    from due
   where r.id=due.id
  returning r.*;
end;
$$;

create or replace function public.teacher_push_finish_reminder(
  p_id uuid,
  p_delivered boolean
)
returns boolean
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  r public.teacher_push_reminders%rowtype;
  local_next timestamp;
begin
  select * into r
  from public.teacher_push_reminders
  where id=p_id
  for update;

  if r.id is null then return false; end if;

  if not coalesce(p_delivered,false) then
    update public.teacher_push_reminders
       set processing_at=null, updated_at=now()
     where id=p_id;
    return true;
  end if;

  if r.recurrence='none' then
    update public.teacher_push_reminders
       set active=false,
           processing_at=null,
           last_sent_at=now(),
           updated_at=now()
     where id=p_id;
    return true;
  end if;

  local_next := (r.scheduled_for at time zone r.timezone_name) + interval '1 day';

  if r.recurrence='weekdays' then
    while extract(isodow from local_next) in (6,7) loop
      local_next := local_next + interval '1 day';
    end loop;
  end if;

  update public.teacher_push_reminders
     set scheduled_for=(local_next at time zone r.timezone_name),
         processing_at=null,
         last_sent_at=now(),
         updated_at=now()
   where id=p_id;

  return true;
end;
$$;

revoke all on function public.teacher_push_issue_token(text) from public;
revoke all on function public.teacher_push_check_token(text) from public;
revoke all on function public.teacher_push_claim_due(integer) from public;
revoke all on function public.teacher_push_finish_reminder(uuid,boolean) from public;
grant execute on function public.teacher_push_issue_token(text) to anon, authenticated;
grant execute on function public.teacher_push_check_token(text) to service_role;
grant execute on function public.teacher_push_claim_due(integer) to service_role;
grant execute on function public.teacher_push_finish_reminder(uuid,boolean) to service_role;

commit;

-- Optional automatic scheduler. Supabase projects normally provide pg_cron + pg_net.
-- It calls the Edge Function once per minute. The Edge Function action is idempotent:
-- due reminders are atomically claimed before sending.
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  old_job bigint;
begin
  select jobid into old_job from cron.job where jobname='kathleen-teacher-push-due' limit 1;
  if old_job is not null then perform cron.unschedule(old_job); end if;
end $$;

select cron.schedule(
  'kathleen-teacher-push-due',
  '* * * * *',
  $cron$
  select net.http_post(
    url := 'https://fzqxnjhuvgpgovcovosl.supabase.co/functions/v1/teacher-push',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{"action":"run_due"}'::jsonb
  );
  $cron$
);

select
  to_regclass('public.teacher_push_subscriptions') is not null as subscriptions_ok,
  to_regclass('public.teacher_push_reminders') is not null as reminders_ok,
  to_regprocedure('public.teacher_push_claim_due(integer)') is not null as claim_rpc_ok;
