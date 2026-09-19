-- ============================================================
-- Kathleens Classroom Board · V21 CLASSROOM STABILITY
-- Run once AFTER V20.
-- Non-destructive: preserves active sessions and student work.
-- ============================================================

begin;

alter table public.classroom_sessions
  add column if not exists class_can_write boolean not null default false,
  add column if not exists class_locked boolean not null default false,
  add column if not exists class_follow_teacher boolean not null default true;

alter table public.classroom_participants
  add column if not exists workspace_revision bigint not null default 0;

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
    if jsonb_typeof(p_payload->'workspace')<>'object'
       or jsonb_typeof(coalesce(p_payload->'workspace'->'strokes','[]'::jsonb))<>'array'
       or jsonb_typeof(coalesce(p_payload->'workspace'->'items','[]'::jsonb))<>'array' then return false; end if;
    delete from public.classroom_student_events where participant_id=v_participant.id and payload->>'type'='snapshot';
  end if;
  insert into public.classroom_student_events(session_id,participant_id,payload) values(v_participant.session_id,v_participant.id,p_payload);
  update public.classroom_participants set last_seen=now() where id=v_participant.id;
  return true;
end $$;

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

revoke execute on function public.classroom_join(text,text,text) from public;
revoke execute on function public.classroom_student_state(uuid) from public;
revoke execute on function public.classroom_student_workspace(uuid) from public;
revoke execute on function public.classroom_student_board_event(uuid,jsonb) from public;
revoke execute on function public.classroom_teacher_state(uuid,uuid) from public;
revoke execute on function public.classroom_teacher_command(uuid,uuid,text,uuid,jsonb) from public;
grant execute on function public.classroom_join(text,text,text) to anon,authenticated;
grant execute on function public.classroom_student_state(uuid) to anon,authenticated;
grant execute on function public.classroom_student_workspace(uuid) to anon,authenticated;
grant execute on function public.classroom_student_board_event(uuid,jsonb) to anon,authenticated;
grant execute on function public.classroom_teacher_state(uuid,uuid) to anon,authenticated;
grant execute on function public.classroom_teacher_command(uuid,uuid,text,uuid,jsonb) to anon,authenticated;

commit;
notify pgrst,'reload schema';

select
  to_regprocedure('public.classroom_student_state(uuid)') is not null as student_state_ok,
  to_regprocedure('public.classroom_student_workspace(uuid)') is not null as workspace_sync_ok,
  to_regprocedure('public.classroom_teacher_command(uuid,uuid,text,uuid,jsonb)') is not null as teacher_control_ok,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='classroom_participants' and column_name='workspace_revision') as revision_column_ok,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='classroom_sessions' and column_name='class_can_write') as late_join_defaults_ok;
