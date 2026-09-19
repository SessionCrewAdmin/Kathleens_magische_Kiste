-- ============================================================
-- Kathleens Classroom Board · V19
-- STUDENT WORKSPACE + LIVE CONTRIBUTIONS
-- Run once AFTER V18.
-- Existing sessions, rosters and student events are preserved.
-- ============================================================

begin;

create or replace function public.classroom_student_workspace(
  p_student_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_participant public.classroom_participants;
  v_events jsonb;
begin
  select * into v_participant
  from public.classroom_participants
  where student_token = p_student_token
  limit 1;

  if v_participant.id is null then
    return jsonb_build_object('ok', false);
  end if;

  select coalesce(
    jsonb_agg(jsonb_build_object('id',e.id,'payload',e.payload,'created_at',e.created_at) order by e.id),
    '[]'::jsonb
  )
  into v_events
  from (
    select id,payload,created_at
    from public.classroom_student_events
    where participant_id = v_participant.id
    order by id desc
    limit 1000
  ) e;

  update public.classroom_participants
  set last_seen = now()
  where id = v_participant.id;

  return jsonb_build_object('ok',true,'events',v_events);
end
$$;

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
    select 1 from public.classroom_sessions
    where id=p_session and teacher_token=p_teacher_token
  ) then
    return jsonb_build_object('ok',false);
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',e.id,
        'participant_id',e.participant_id,
        'name',p.display_name,
        'payload',e.payload,
        'created_at',e.created_at
      ) order by e.id
    ),
    '[]'::jsonb
  ),
  coalesce(max(e.id),p_after_id)
  into v_events,v_last_id
  from public.classroom_student_events e
  join public.classroom_participants p on p.id=e.participant_id
  where e.session_id=p_session
    and e.id>greatest(0,coalesce(p_after_id,0));

  return jsonb_build_object('ok',true,'events',v_events,'last_id',v_last_id);
end
$$;

create or replace function public.classroom_student_board_event(
  p_student_token uuid,
  p_payload jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_participant public.classroom_participants;
begin
  select * into v_participant
  from public.classroom_participants
  where student_token=p_student_token
  limit 1;

  if v_participant.id is null
     or not v_participant.can_write
     or v_participant.locked then
    return false;
  end if;

  if p_payload is null
     or jsonb_typeof(p_payload)<>'object'
     or coalesce(p_payload->>'type','') not in ('stroke','text','undo','clear')
     or octet_length(p_payload::text)>200000 then
    return false;
  end if;

  insert into public.classroom_student_events(session_id,participant_id,payload)
  values(v_participant.session_id,v_participant.id,p_payload);

  update public.classroom_participants
  set last_seen=now()
  where id=v_participant.id;

  return true;
end
$$;

-- Rebuild command RPC with V19 clear_contributions action.
create or replace function public.classroom_teacher_command(
  p_session uuid,
  p_teacher_token uuid,
  p_command text,
  p_participant uuid default null,
  p_value jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare v_enabled boolean;
begin
  if not exists (
    select 1 from public.classroom_sessions
    where id=p_session and teacher_token=p_teacher_token and status='open'
  ) then return false; end if;

  v_enabled := case
    when lower(coalesce(p_value->>'enabled','')) in ('true','1','yes','on') then true
    when lower(coalesce(p_value->>'enabled','')) in ('false','0','no','off') then false
    else null end;

  case p_command
    when 'lock_all' then update public.classroom_participants set locked=true where session_id=p_session;
    when 'unlock_all' then update public.classroom_participants set locked=false where session_id=p_session;
    when 'follow_all' then update public.classroom_participants set follow_teacher=coalesce(v_enabled,true) where session_id=p_session;
    when 'class_write' then update public.classroom_participants set can_write=coalesce(v_enabled,false) where session_id=p_session;
    when 'lock_one' then update public.classroom_participants set locked=true where id=p_participant and session_id=p_session;
    when 'unlock_one' then update public.classroom_participants set locked=false where id=p_participant and session_id=p_session;
    when 'follow_one' then update public.classroom_participants set follow_teacher=coalesce(v_enabled,true) where id=p_participant and session_id=p_session;
    when 'write_one' then update public.classroom_participants set can_write=coalesce(v_enabled,false) where id=p_participant and session_id=p_session;
    when 'message' then
      if nullif(trim(coalesce(p_value->>'body','')),'') is not null then
        insert into public.classroom_messages(session_id,participant_id,body)
        values(p_session,p_participant,left(trim(p_value->>'body'),1000));
      end if;
    when 'phase' then
      update public.classroom_sessions set
        phase=case when coalesce(p_value->>'phase','') in ('free','explain','solo','group','class','break') then p_value->>'phase' else phase end,
        updated_at=now()
      where id=p_session;
    when 'traffic' then
      update public.classroom_sessions set
        traffic=case when coalesce(p_value->>'traffic','') in ('green','yellow','red') then p_value->>'traffic' else traffic end,
        updated_at=now()
      where id=p_session;
    when 'freeze' then update public.classroom_sessions set frozen=coalesce(v_enabled,false),updated_at=now() where id=p_session;
    when 'clear_contributions' then
      if p_participant is null then
        delete from public.classroom_student_events where session_id=p_session;
      else
        delete from public.classroom_student_events where session_id=p_session and participant_id=p_participant;
      end if;
    when 'close' then update public.classroom_sessions set status='closed',closed_at=coalesce(closed_at,now()),updated_at=now() where id=p_session;
    else return false;
  end case;
  return true;
end
$$;

revoke execute on function public.classroom_student_workspace(uuid) from public;
revoke execute on function public.classroom_teacher_contributions(uuid,uuid,bigint) from public;
revoke execute on function public.classroom_student_board_event(uuid,jsonb) from public;
revoke execute on function public.classroom_teacher_command(uuid,uuid,text,uuid,jsonb) from public;

grant execute on function public.classroom_student_workspace(uuid) to anon,authenticated;
grant execute on function public.classroom_teacher_contributions(uuid,uuid,bigint) to anon,authenticated;
grant execute on function public.classroom_student_board_event(uuid,jsonb) to anon,authenticated;
grant execute on function public.classroom_teacher_command(uuid,uuid,text,uuid,jsonb) to anon,authenticated;

commit;

notify pgrst, 'reload schema';

select
  to_regprocedure('public.classroom_student_workspace(uuid)') is not null as student_workspace_ok,
  to_regprocedure('public.classroom_teacher_contributions(uuid,uuid,bigint)') is not null as teacher_contributions_ok,
  to_regprocedure('public.classroom_student_board_event(uuid,jsonb)') is not null as student_event_ok;
