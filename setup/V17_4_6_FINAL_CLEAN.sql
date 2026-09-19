-- ============================================================
-- Kathleens Classroom Board · V21 FINAL CLEAN
-- Canonical Classroom backend for the current frontend.
--
-- Run ONCE in Supabase SQL Editor.
--
-- WARNING:
-- This intentionally deletes ONLY Classroom runtime data:
--   classroom_sessions
--   classroom_participants
--   classroom_roster
--   classroom_messages
--   classroom_student_events
--   classroom_admin
--
-- It does NOT touch:
--   class_list_vaults / encrypted class lists
--   homework_vouchers
--   live_poll_*
--   toolbox_* functions/tables
--   browser IndexedDB boards
-- ============================================================

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ============================================================
-- 1) REMOVE ALL LEGACY CLASSROOM RPC OVERLOADS
-- ============================================================
-- This is deliberately dynamic. It removes V17/V22 leftovers such as:
-- classroom_student_state(text) AND classroom_student_state(uuid)
-- which otherwise cause PostgREST HTTP 300 "Multiple Choices".

do $cleanup$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure::text as signature
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and (
         p.proname like 'classroom\_%' escape '\'
         or p.proname in ('classroom_code')
       )
  loop
    execute 'drop function if exists ' || r.signature || ' cascade';
  end loop;
end
$cleanup$;

-- ============================================================
-- 2) RESET ONLY CLASSROOM RUNTIME TABLES
-- ============================================================

drop table if exists public.classroom_student_events cascade;
drop table if exists public.classroom_messages cascade;
drop table if exists public.classroom_roster cascade;
drop table if exists public.classroom_participants cascade;
drop table if exists public.classroom_sessions cascade;
drop table if exists public.classroom_admin cascade;

-- ============================================================
-- 3) CLASSROOM ADMIN FALLBACK
-- ============================================================
-- Preferred: existing public.toolbox_verify_admin(text)
-- Fallback: first Classroom password >= 8 chars becomes local
-- Classroom password if no working Toolbox verifier exists.

create table public.classroom_admin (
  singleton boolean primary key default true check (singleton),
  pass_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.classroom_admin enable row level security;
revoke all on table public.classroom_admin from anon, authenticated;

create or replace function public.classroom_authenticate(
  p_passphrase text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  v_ok boolean;
  v_hash text;
begin
  if p_passphrase is null or length(p_passphrase) < 8 then
    return false;
  end if;

  if to_regprocedure('public.toolbox_verify_admin(text)') is not null then
    begin
      execute 'select public.toolbox_verify_admin($1)'
        into v_ok
        using p_passphrase;

      if v_ok is not null then
        return v_ok;
      end if;
    exception when others then
      null;
    end;
  end if;

  select pass_hash
    into v_hash
    from public.classroom_admin
   where singleton = true;

  if v_hash is null then
    insert into public.classroom_admin(singleton, pass_hash)
    values (
      true,
      extensions.crypt(
        p_passphrase,
        extensions.gen_salt('bf', 10)
      )
    )
    on conflict (singleton) do nothing;

    select pass_hash
      into v_hash
      from public.classroom_admin
     where singleton = true;
  end if;

  return extensions.crypt(p_passphrase, v_hash) = v_hash;
end
$$;

-- ============================================================
-- 4) CORE TABLES
-- ============================================================

create table public.classroom_sessions (
  id uuid primary key default extensions.gen_random_uuid(),

  room_code text not null unique
    check (room_code ~ '^[A-HJ-NP-Z2-9]{6}$'),

  teacher_token uuid not null unique
    default extensions.gen_random_uuid(),

  title text not null default 'Unterricht',
  class_name text,

  status text not null default 'open'
    check (status in ('open','closed')),

  phase text not null default 'free'
    check (phase in ('free','explain','solo','group','class','break')),

  traffic text not null default 'green'
    check (traffic in ('green','yellow','red')),

  frozen boolean not null default false,

  class_can_write boolean not null default false,
  class_locked boolean not null default false,
  class_follow_teacher boolean not null default true,

  board_state jsonb not null default '{}'::jsonb,

  viewport jsonb not null default
    '{"scale":0.65,"tx":-500,"ty":-350}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create table public.classroom_participants (
  id uuid primary key default extensions.gen_random_uuid(),

  session_id uuid not null
    references public.classroom_sessions(id)
    on delete cascade,

  student_token uuid not null unique
    default extensions.gen_random_uuid(),

  device_token text not null,
  display_name text not null,

  state text not null default 'working'
    check (state in ('working','done','help','unsure')),

  can_write boolean not null default false,
  locked boolean not null default false,
  follow_teacher boolean not null default true,
  workspace_revision bigint not null default 0,

  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.classroom_roster (
  id bigint generated by default as identity primary key,

  session_id uuid not null
    references public.classroom_sessions(id)
    on delete cascade,

  display_name text not null,
  normalized_name text not null,

  created_at timestamptz not null default now(),

  unique(session_id, normalized_name)
);

create table public.classroom_messages (
  id bigint generated by default as identity primary key,

  session_id uuid not null
    references public.classroom_sessions(id)
    on delete cascade,

  participant_id uuid
    references public.classroom_participants(id)
    on delete cascade,

  body text not null
    check (char_length(body) between 1 and 1000),

  created_at timestamptz not null default now()
);

create table public.classroom_student_events (
  id bigint generated by default as identity primary key,

  session_id uuid not null
    references public.classroom_sessions(id)
    on delete cascade,

  participant_id uuid not null
    references public.classroom_participants(id)
    on delete cascade,

  payload jsonb not null,

  created_at timestamptz not null default now()
);

-- ============================================================
-- 5) INDEXES
-- ============================================================

create index classroom_sessions_status_idx
  on public.classroom_sessions(status, created_at desc);

create index classroom_roster_session_idx
  on public.classroom_roster(session_id);

create index classroom_participants_session_idx
  on public.classroom_participants(session_id);

create index classroom_participants_last_seen_idx
  on public.classroom_participants(last_seen);

create index classroom_messages_session_idx
  on public.classroom_messages(session_id, id);

create index classroom_student_events_session_idx
  on public.classroom_student_events(session_id, id);

-- ============================================================
-- 6) RLS / DIRECT TABLE ACCESS CLOSED
-- ============================================================

alter table public.classroom_sessions enable row level security;
alter table public.classroom_participants enable row level security;
alter table public.classroom_roster enable row level security;
alter table public.classroom_messages enable row level security;
alter table public.classroom_student_events enable row level security;

revoke all on table public.classroom_sessions from anon, authenticated;
revoke all on table public.classroom_participants from anon, authenticated;
revoke all on table public.classroom_roster from anon, authenticated;
revoke all on table public.classroom_messages from anon, authenticated;
revoke all on table public.classroom_student_events from anon, authenticated;

-- ============================================================
-- 7) ROOM CODE
-- ============================================================

create or replace function public.classroom_random_code()
returns text
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  v_chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_code text;
  i integer;
begin
  loop
    v_bytes := extensions.gen_random_bytes(6);
    v_code := '';

    for i in 0..5 loop
      v_code := v_code ||
        substr(
          v_chars,
          (get_byte(v_bytes, i) % length(v_chars)) + 1,
          1
        );
    end loop;

    exit when not exists (
      select 1
        from public.classroom_sessions
       where room_code = v_code
         and status = 'open'
    );
  end loop;

  return v_code;
end
$$;

-- ============================================================
-- 8) CREATE CLASSROOM
-- ============================================================

create or replace function public.classroom_create(
  p_passphrase text,
  p_title text default 'Unterricht',
  p_class_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  v_session public.classroom_sessions;
begin
  if not public.classroom_authenticate(p_passphrase) then
    raise exception using
      message = 'Admin-Passwort falsch',
      errcode = '28000';
  end if;

  insert into public.classroom_sessions(
    room_code,
    title,
    class_name
  )
  values (
    public.classroom_random_code(),
    coalesce(nullif(trim(p_title), ''), 'Unterricht'),
    nullif(trim(p_class_name), '')
  )
  returning * into v_session;

  return jsonb_build_object(
    'session_id', v_session.id,
    'teacher_token', v_session.teacher_token,
    'room_code', v_session.room_code
  );
end
$$;

-- ============================================================
-- 9) TEACHER BOARD SYNC
-- ============================================================

create or replace function public.classroom_teacher_sync(
  p_session uuid,
  p_teacher_token uuid,
  p_board_state jsonb,
  p_viewport jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  update public.classroom_sessions
     set board_state = coalesce(p_board_state, board_state),
         viewport = coalesce(p_viewport, viewport),
         updated_at = now()
   where id = p_session
     and teacher_token = p_teacher_token
     and status = 'open';

  return found;
end
$$;

-- ============================================================
-- 10) ATTACH CLASS ROSTER
-- ============================================================

create or replace function public.classroom_set_roster(
  p_session uuid,
  p_teacher_token uuid,
  p_class_name text,
  p_names jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_name text;
begin
  if not exists (
    select 1
      from public.classroom_sessions
     where id = p_session
       and teacher_token = p_teacher_token
       and status = 'open'
  ) then
    return false;
  end if;

  update public.classroom_sessions
     set class_name = nullif(trim(p_class_name), ''),
         updated_at = now()
   where id = p_session;

  delete from public.classroom_roster
   where session_id = p_session;

  if p_names is null or jsonb_typeof(p_names) <> 'array' then
    return true;
  end if;

  for v_name in
    select trim(value)
      from jsonb_array_elements_text(p_names)
  loop
    if length(v_name) between 1 and 80 then
      insert into public.classroom_roster(
        session_id,
        display_name,
        normalized_name
      )
      values (
        p_session,
        v_name,
        lower(v_name)
      )
      on conflict (session_id, normalized_name) do nothing;
    end if;
  end loop;

  return true;
end
$$;

-- ============================================================
-- 11) PUBLIC ROSTER FOR A VALID ROOM CODE
-- ============================================================

create or replace function public.classroom_roster(
  p_room_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_session public.classroom_sessions;
  v_students jsonb;
begin
  select *
    into v_session
    from public.classroom_sessions
   where room_code = upper(trim(coalesce(p_room_code,'')))
     and status = 'open'
   order by created_at desc
   limit 1;

  if v_session.id is null then
    return jsonb_build_object('ok', false);
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', r.display_name,
        'available',
          not exists (
            select 1
              from public.classroom_participants p
             where p.session_id = v_session.id
               and lower(p.display_name) = r.normalized_name
               and p.last_seen > now() - interval '2 minutes'
          )
      )
      order by r.display_name
    ),
    '[]'::jsonb
  )
  into v_students
  from public.classroom_roster r
  where r.session_id = v_session.id;

  return jsonb_build_object(
    'ok', true,
    'class_name', v_session.class_name,
    'students', v_students
  );
end
$$;

-- ============================================================
-- 12) STUDENT JOIN
-- ============================================================

create or replace function public.classroom_join(p_room_code text,p_display_name text,p_device_token text)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_catalog as $$
declare
  v_session public.classroom_sessions;
  v_participant public.classroom_participants;
  v_name text:=trim(coalesce(p_display_name,''));
  v_device text:=trim(coalesce(p_device_token,''));
begin
  if length(v_name)<1 or length(v_name)>80 or length(v_device)<8 or length(v_device)>200 then return jsonb_build_object('ok',false,'error','invalid_input'); end if;
  select * into v_session from public.classroom_sessions where room_code=upper(trim(coalesce(p_room_code,''))) and status='open' order by created_at desc limit 1;
  if v_session.id is null then return jsonb_build_object('ok',false,'error','room_not_found'); end if;
  if exists(select 1 from public.classroom_roster where session_id=v_session.id)
     and not exists(select 1 from public.classroom_roster where session_id=v_session.id and normalized_name=lower(v_name))
  then return jsonb_build_object('ok',false,'error','name_not_in_roster'); end if;
  select * into v_participant from public.classroom_participants where session_id=v_session.id and lower(display_name)=lower(v_name) order by created_at desc limit 1;
  if v_participant.id is null then
    insert into public.classroom_participants(session_id,device_token,display_name,can_write,locked,follow_teacher)
    values(v_session.id,v_device,v_name,v_session.class_can_write,v_session.class_locked,v_session.class_follow_teacher)
    returning * into v_participant;
  elsif v_participant.device_token=v_device then
    update public.classroom_participants set last_seen=now() where id=v_participant.id returning * into v_participant;
  elsif v_participant.last_seen>now()-interval '2 minutes' then
    return jsonb_build_object('ok',false,'error','name_in_use');
  else
    update public.classroom_participants set device_token=v_device,student_token=extensions.gen_random_uuid(),last_seen=now()
    where id=v_participant.id returning * into v_participant;
  end if;
  return jsonb_build_object('ok',true,'participant_id',v_participant.id,'student_token',v_participant.student_token,'room_code',v_session.room_code);
end $$;

-- ============================================================
-- 13) STUDENT STATE
-- ============================================================

create or replace function public.classroom_student_state(p_student_token uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_catalog as $$
declare
  v_participant public.classroom_participants;
  v_session public.classroom_sessions;
  v_messages jsonb;
begin
  select * into v_participant from public.classroom_participants where student_token=p_student_token limit 1;
  if v_participant.id is null then return jsonb_build_object('ok',false); end if;
  update public.classroom_participants set last_seen=now() where id=v_participant.id;
  select * into v_session from public.classroom_sessions where id=v_participant.session_id;
  if v_session.id is null then return jsonb_build_object('ok',false); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'body',m.body,'created_at',m.created_at) order by m.id),'[]'::jsonb)
    into v_messages from public.classroom_messages m
   where m.session_id=v_session.id and (m.participant_id is null or m.participant_id=v_participant.id)
     and m.created_at>now()-interval '30 minutes';
  return jsonb_build_object('ok',true,'session_state',v_session.status,'phase',v_session.phase,'traffic',v_session.traffic,
    'locked',v_participant.locked,'can_write',v_participant.can_write,'follow_teacher',v_participant.follow_teacher,
    'workspace_revision',v_participant.workspace_revision,'board_state',v_session.board_state,'viewport',v_session.viewport,'messages',v_messages);
end $$;

-- ============================================================
-- 14) STUDENT STATUS
-- ============================================================

create or replace function public.classroom_student_update(
  p_student_token uuid,
  p_state text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if p_state not in ('working','done','help','unsure') then
    return false;
  end if;

  update public.classroom_participants
     set state = p_state,
         last_seen = now()
   where student_token = p_student_token;

  return found;
end
$$;

-- ============================================================
-- 15) STUDENT BOARD EVENTS
-- ============================================================

create or replace function public.classroom_student_board_event(p_student_token uuid,p_payload jsonb)
returns boolean language plpgsql security definer set search_path=public,pg_catalog as $$
declare v_participant public.classroom_participants;
begin
  select * into v_participant from public.classroom_participants where student_token=p_student_token limit 1;
  if v_participant.id is null or not v_participant.can_write or v_participant.locked then return false; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object'
     or coalesce(p_payload->>'type','') not in ('stroke','text','undo','clear','snapshot')
     or octet_length(p_payload::text)>5000000 then return false; end if;
  if p_payload->>'type'='snapshot' then
    if coalesce((p_payload->>'workspace_revision')::bigint,-1) <> v_participant.workspace_revision then return false; end if;
    if jsonb_typeof(p_payload->'workspace')<>'object'
       or jsonb_typeof(coalesce(p_payload->'workspace'->'strokes','[]'::jsonb))<>'array'
       or jsonb_typeof(coalesce(p_payload->'workspace'->'items','[]'::jsonb))<>'array' then return false; end if;
    delete from public.classroom_student_events where participant_id=v_participant.id and payload->>'type'='snapshot';
  end if;
  insert into public.classroom_student_events(session_id,participant_id,payload) values(v_participant.session_id,v_participant.id,p_payload);
  update public.classroom_participants set last_seen=now() where id=v_participant.id;
  return true;
end $$;

-- ============================================================
-- 16) STUDENT WORKSPACE SNAPSHOT
-- ============================================================

create or replace function public.classroom_student_workspace(p_student_token uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_catalog as $$
declare v_participant public.classroom_participants; v_events jsonb;
begin
  select * into v_participant from public.classroom_participants where student_token=p_student_token limit 1;
  if v_participant.id is null then return jsonb_build_object('ok',false); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'payload',e.payload,'created_at',e.created_at) order by e.id),'[]'::jsonb)
    into v_events from (select id,payload,created_at from public.classroom_student_events where participant_id=v_participant.id order by id desc limit 1000)e;
  update public.classroom_participants set last_seen=now() where id=v_participant.id;
  return jsonb_build_object('ok',true,'workspace_revision',v_participant.workspace_revision,'events',v_events);
end $$;

-- ============================================================
-- 17) TEACHER LIVE CONTRIBUTIONS
-- ============================================================

create or replace function public.classroom_teacher_contributions(
  p_session uuid,
  p_teacher_token uuid,
  p_after_id bigint default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_events jsonb;
  v_last_id bigint;
begin
  if not exists (
    select 1
      from public.classroom_sessions
     where id = p_session
       and teacher_token = p_teacher_token
  ) then
    return jsonb_build_object('ok', false);
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'participant_id', e.participant_id,
        'name', p.display_name,
        'payload', e.payload,
        'created_at', e.created_at
      )
      order by e.id
    ),
    '[]'::jsonb
  ),
  coalesce(max(e.id), p_after_id)
  into v_events, v_last_id
  from public.classroom_student_events e
  join public.classroom_participants p
    on p.id = e.participant_id
  where e.session_id = p_session
    and e.id > greatest(0, coalesce(p_after_id,0));

  return jsonb_build_object(
    'ok', true,
    'events', v_events,
    'last_id', v_last_id
  );
end
$$;

-- ============================================================
-- 18) TEACHER STATE
-- ============================================================

create or replace function public.classroom_teacher_state(p_session uuid,p_teacher_token uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_catalog as $$
declare v_session public.classroom_sessions; v_participants jsonb;
begin
  select * into v_session from public.classroom_sessions where id=p_session and teacher_token=p_teacher_token;
  if v_session.id is null then return jsonb_build_object('ok',false); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'state',p.state,'can_write',p.can_write,
    'locked',p.locked,'follow_teacher',p.follow_teacher,'online',p.last_seen>now()-interval '15 seconds','last_seen',p.last_seen)
    order by p.display_name),'[]'::jsonb) into v_participants from public.classroom_participants p where p.session_id=v_session.id;
  return jsonb_build_object('ok',true,'room_code',v_session.room_code,'title',v_session.title,'class_name',v_session.class_name,
    'roster_count',(select count(*)::integer from public.classroom_roster r where r.session_id=v_session.id),
    'session_state',v_session.status,'phase',v_session.phase,'traffic',v_session.traffic,'frozen',v_session.frozen,
    'class_can_write',v_session.class_can_write,'class_locked',v_session.class_locked,'class_follow_teacher',v_session.class_follow_teacher,
    'participants',v_participants);
end $$;

-- ============================================================
-- 17) TEACHER COMMANDS
-- ============================================================

create or replace function public.classroom_teacher_command(p_session uuid,p_teacher_token uuid,p_command text,p_participant uuid default null,p_value jsonb default '{}'::jsonb)
returns boolean language plpgsql security definer set search_path=public,pg_catalog as $$
declare v_enabled boolean;
begin
  if not exists(select 1 from public.classroom_sessions where id=p_session and teacher_token=p_teacher_token and status='open') then return false; end if;
  v_enabled:=case when lower(coalesce(p_value->>'enabled','')) in ('true','1','yes','on') then true when lower(coalesce(p_value->>'enabled','')) in ('false','0','no','off') then false else null end;
  case p_command
    when 'lock_all' then update public.classroom_sessions set class_locked=true,updated_at=now() where id=p_session; update public.classroom_participants set locked=true where session_id=p_session;
    when 'unlock_all' then update public.classroom_sessions set class_locked=false,updated_at=now() where id=p_session; update public.classroom_participants set locked=false where session_id=p_session;
    when 'follow_all' then update public.classroom_sessions set class_follow_teacher=coalesce(v_enabled,true),updated_at=now() where id=p_session; update public.classroom_participants set follow_teacher=coalesce(v_enabled,true) where session_id=p_session;
    when 'class_write' then update public.classroom_sessions set class_can_write=coalesce(v_enabled,false),updated_at=now() where id=p_session; update public.classroom_participants set can_write=coalesce(v_enabled,false) where session_id=p_session;
    when 'lock_one' then update public.classroom_participants set locked=true where id=p_participant and session_id=p_session;
    when 'unlock_one' then update public.classroom_participants set locked=false where id=p_participant and session_id=p_session;
    when 'follow_one' then update public.classroom_participants set follow_teacher=coalesce(v_enabled,true) where id=p_participant and session_id=p_session;
    when 'write_one' then update public.classroom_participants set can_write=coalesce(v_enabled,false) where id=p_participant and session_id=p_session;
    when 'message' then if nullif(trim(coalesce(p_value->>'body','')),'') is not null then insert into public.classroom_messages(session_id,participant_id,body) values(p_session,p_participant,left(trim(p_value->>'body'),1000)); end if;
    when 'phase' then update public.classroom_sessions set phase=case when coalesce(p_value->>'phase','') in ('free','explain','solo','group','class','break') then p_value->>'phase' else phase end,updated_at=now() where id=p_session;
    when 'traffic' then update public.classroom_sessions set traffic=case when coalesce(p_value->>'traffic','') in ('green','yellow','red') then p_value->>'traffic' else traffic end,updated_at=now() where id=p_session;
    when 'freeze' then update public.classroom_sessions set frozen=coalesce(v_enabled,false),updated_at=now() where id=p_session;
    when 'clear_contributions' then
      if p_participant is null then
        delete from public.classroom_student_events where session_id=p_session;
        update public.classroom_participants set workspace_revision=workspace_revision+1 where session_id=p_session;
      else
        delete from public.classroom_student_events where session_id=p_session and participant_id=p_participant;
        update public.classroom_participants set workspace_revision=workspace_revision+1 where session_id=p_session and id=p_participant;
      end if;
    when 'close' then update public.classroom_sessions set status='closed',closed_at=coalesce(closed_at,now()),updated_at=now() where id=p_session;
    else return false;
  end case;
  return true;
end $$;

-- ============================================================
-- 18) PRESENTATION / BEAMER STATE
-- ============================================================

create or replace function public.classroom_presentation_state(
  p_room_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_session public.classroom_sessions;
begin
  select *
    into v_session
    from public.classroom_sessions
   where room_code = upper(trim(coalesce(p_room_code,'')))
   order by created_at desc
   limit 1;

  if v_session.id is null then
    return jsonb_build_object('ok', false);
  end if;

  return jsonb_build_object(
    'ok', true,
    'session_state', v_session.status,
    'phase', v_session.phase,
    'traffic', v_session.traffic,
    'frozen', v_session.frozen,
    'board_state', v_session.board_state,
    'viewport', v_session.viewport
  );
end
$$;

-- ============================================================
-- 19) CLEANUP
-- ============================================================

create or replace function public.classroom_cleanup_old_sessions(
  p_days integer default 30
)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_count integer;
begin
  with deleted as (
    delete
      from public.classroom_sessions
     where created_at <
       now() - make_interval(days => greatest(1, p_days))
     returning 1
  )
  select count(*)
    into v_count
    from deleted;

  return v_count;
end
$$;

-- ============================================================
-- 20) RPC PERMISSIONS
-- ============================================================

-- Remove default PUBLIC execute rights first.

revoke execute on function public.classroom_authenticate(text) from public;
revoke execute on function public.classroom_random_code() from public;
revoke execute on function public.classroom_create(text,text,text) from public;
revoke execute on function public.classroom_teacher_sync(uuid,uuid,jsonb,jsonb) from public;
revoke execute on function public.classroom_set_roster(uuid,uuid,text,jsonb) from public;
revoke execute on function public.classroom_roster(text) from public;
revoke execute on function public.classroom_join(text,text,text) from public;
revoke execute on function public.classroom_student_state(uuid) from public;
revoke execute on function public.classroom_student_update(uuid,text) from public;
revoke execute on function public.classroom_student_board_event(uuid,jsonb) from public;
revoke execute on function public.classroom_student_workspace(uuid) from public;
revoke execute on function public.classroom_teacher_contributions(uuid,uuid,bigint) from public;
revoke execute on function public.classroom_teacher_state(uuid,uuid) from public;
revoke execute on function public.classroom_teacher_command(uuid,uuid,text,uuid,jsonb) from public;
revoke execute on function public.classroom_presentation_state(text) from public;
revoke execute on function public.classroom_cleanup_old_sessions(integer) from public;

-- Browser-facing RPCs used by the current frontend.

grant execute on function public.classroom_authenticate(text)
  to anon, authenticated;

grant execute on function public.classroom_create(text,text,text)
  to anon, authenticated;

grant execute on function public.classroom_teacher_sync(uuid,uuid,jsonb,jsonb)
  to anon, authenticated;

grant execute on function public.classroom_set_roster(uuid,uuid,text,jsonb)
  to anon, authenticated;

grant execute on function public.classroom_roster(text)
  to anon, authenticated;

grant execute on function public.classroom_join(text,text,text)
  to anon, authenticated;

grant execute on function public.classroom_student_state(uuid)
  to anon, authenticated;

grant execute on function public.classroom_student_update(uuid,text)
  to anon, authenticated;

grant execute on function public.classroom_student_board_event(uuid,jsonb)
  to anon, authenticated;

grant execute on function public.classroom_student_workspace(uuid)
  to anon, authenticated;

grant execute on function public.classroom_teacher_contributions(uuid,uuid,bigint)
  to anon, authenticated;

grant execute on function public.classroom_teacher_state(uuid,uuid)
  to anon, authenticated;

grant execute on function public.classroom_teacher_command(uuid,uuid,text,uuid,jsonb)
  to anon, authenticated;

grant execute on function public.classroom_presentation_state(text)
  to anon, authenticated;

-- These remain server-side only:
-- classroom_random_code()
-- classroom_cleanup_old_sessions(integer)

commit;

-- ============================================================
-- 21) FORCE POSTGREST SCHEMA RELOAD
-- ============================================================

notify pgrst, 'reload schema';

-- ============================================================
-- 22) FINAL SELF-CHECK
-- ============================================================
-- A) required signatures: every "signature" must be non-NULL.
-- B) overload_count must be exactly 1 for each browser RPC.
-- C) legacy text student_state must be FALSE.

select *
from (
  values
    ('classroom_authenticate',
      to_regprocedure('public.classroom_authenticate(text)')::text),

    ('classroom_create',
      to_regprocedure('public.classroom_create(text,text,text)')::text),

    ('classroom_teacher_sync',
      to_regprocedure('public.classroom_teacher_sync(uuid,uuid,jsonb,jsonb)')::text),

    ('classroom_set_roster',
      to_regprocedure('public.classroom_set_roster(uuid,uuid,text,jsonb)')::text),

    ('classroom_roster',
      to_regprocedure('public.classroom_roster(text)')::text),

    ('classroom_join',
      to_regprocedure('public.classroom_join(text,text,text)')::text),

    ('classroom_student_state',
      to_regprocedure('public.classroom_student_state(uuid)')::text),

    ('classroom_student_update',
      to_regprocedure('public.classroom_student_update(uuid,text)')::text),

    ('classroom_student_board_event',
      to_regprocedure('public.classroom_student_board_event(uuid,jsonb)')::text),

    ('classroom_student_workspace',
      to_regprocedure('public.classroom_student_workspace(uuid)')::text),

    ('classroom_teacher_contributions',
      to_regprocedure('public.classroom_teacher_contributions(uuid,uuid,bigint)')::text),

    ('classroom_teacher_state',
      to_regprocedure('public.classroom_teacher_state(uuid,uuid)')::text),

    ('classroom_teacher_command',
      to_regprocedure('public.classroom_teacher_command(uuid,uuid,text,uuid,jsonb)')::text),

    ('classroom_presentation_state',
      to_regprocedure('public.classroom_presentation_state(text)')::text)
) as required_rpc(name, signature)
order by name;

select
  p.proname as rpc_name,
  count(*)::integer as overload_count,
  string_agg(p.oid::regprocedure::text, ' | ' order by p.oid::regprocedure::text) as signatures
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'classroom_authenticate',
    'classroom_create',
    'classroom_teacher_sync',
    'classroom_set_roster',
    'classroom_roster',
    'classroom_join',
    'classroom_student_state',
    'classroom_student_update',
    'classroom_student_board_event',
    'classroom_student_workspace',
    'classroom_teacher_contributions',
    'classroom_teacher_state',
    'classroom_teacher_command',
    'classroom_presentation_state'
  )
group by p.proname
order by p.proname;

select
  to_regprocedure('public.classroom_student_state(text)') is not null
    as legacy_text_student_state_still_exists;
