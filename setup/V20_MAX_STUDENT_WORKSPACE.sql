-- ============================================================
-- Kathleens Classroom Board · V20 MAX STUDENT WORKSPACE
-- Run once AFTER V19.
-- Adds compact snapshot persistence for the full student workspace.
-- Existing sessions and contributions remain intact.
-- ============================================================

begin;

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
  select *
    into v_participant
    from public.classroom_participants
   where student_token = p_student_token
   limit 1;

  if v_participant.id is null
     or not v_participant.can_write
     or v_participant.locked then
    return false;
  end if;

  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or coalesce(p_payload->>'type','') not in ('stroke','text','undo','clear','snapshot')
     or octet_length(p_payload::text) > 1500000 then
    return false;
  end if;

  if p_payload->>'type' = 'snapshot' then
    if jsonb_typeof(p_payload->'workspace') <> 'object'
       or jsonb_typeof(coalesce(p_payload->'workspace'->'strokes','[]'::jsonb)) <> 'array'
       or jsonb_typeof(coalesce(p_payload->'workspace'->'items','[]'::jsonb)) <> 'array' then
      return false;
    end if;

    delete from public.classroom_student_events
     where participant_id = v_participant.id
       and payload->>'type' = 'snapshot';
  end if;

  insert into public.classroom_student_events(session_id,participant_id,payload)
  values(v_participant.session_id,v_participant.id,p_payload);

  update public.classroom_participants
     set last_seen = now()
   where id = v_participant.id;

  return true;
end
$$;

revoke execute on function public.classroom_student_board_event(uuid,jsonb) from public;
grant execute on function public.classroom_student_board_event(uuid,jsonb) to anon,authenticated;

commit;

notify pgrst, 'reload schema';

select
  to_regprocedure('public.classroom_student_board_event(uuid,jsonb)') is not null as snapshot_event_rpc_ok;
