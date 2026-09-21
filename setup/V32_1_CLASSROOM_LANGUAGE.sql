-- ============================================================
-- Kathleens Kiste · V32.1 · Classroom language sync
-- Teacher controls one UI language for student + presentation screens.
-- Run once after the current Classroom SQL setup.
-- ============================================================
begin;

alter table public.classroom_sessions
  add column if not exists ui_language text not null default 'de';

alter table public.classroom_sessions
  drop constraint if exists classroom_sessions_ui_language_check;

alter table public.classroom_sessions
  add constraint classroom_sessions_ui_language_check
  check (ui_language in ('de','en'));

create or replace function public.classroom_set_language(
  p_session uuid,
  p_teacher_token uuid,
  p_language text
)
returns boolean
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare v_language text;
begin
  v_language:=lower(coalesce(p_language,'de'));
  if v_language not in ('de','en') then return false; end if;
  update public.classroom_sessions
     set ui_language=v_language,updated_at=now()
   where id=p_session and teacher_token=p_teacher_token and status='open';
  return found;
end $$;

create or replace function public.classroom_language(
  p_room_code text
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare v_session public.classroom_sessions;
begin
  select * into v_session
    from public.classroom_sessions
   where upper(room_code)=upper(trim(coalesce(p_room_code,'')))
     and status='open'
   order by created_at desc limit 1;
  if v_session.id is null then return jsonb_build_object('ok',false); end if;
  return jsonb_build_object('ok',true,'language',coalesce(v_session.ui_language,'de'));
end $$;

create or replace function public.classroom_student_language(
  p_student_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare v_participant public.classroom_participants; v_session public.classroom_sessions;
begin
  select * into v_participant from public.classroom_participants where student_token=p_student_token limit 1;
  if v_participant.id is null then return jsonb_build_object('ok',false); end if;
  select * into v_session from public.classroom_sessions where id=v_participant.session_id;
  if v_session.id is null then return jsonb_build_object('ok',false); end if;
  return jsonb_build_object('ok',true,'language',coalesce(v_session.ui_language,'de'));
end $$;

revoke execute on function public.classroom_set_language(uuid,uuid,text) from public;
revoke execute on function public.classroom_language(text) from public;
revoke execute on function public.classroom_student_language(uuid) from public;
grant execute on function public.classroom_set_language(uuid,uuid,text) to anon,authenticated;
grant execute on function public.classroom_language(text) to anon,authenticated;
grant execute on function public.classroom_student_language(uuid) to anon,authenticated;

commit;
notify pgrst,'reload schema';

select
 to_regprocedure('public.classroom_set_language(uuid,uuid,text)') is not null as set_language_ok,
 to_regprocedure('public.classroom_language(text)') is not null as room_language_ok,
 to_regprocedure('public.classroom_student_language(uuid)') is not null as student_language_ok;
