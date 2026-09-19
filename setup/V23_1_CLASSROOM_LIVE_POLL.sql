-- ============================================================
-- Kathleens Classroom Board · V23.1 UNIFIED LIVE POLL
-- Run once AFTER V22.7 Classroom Live Poll.
-- Non-destructive: extends existing classroom poll tables.
-- Adds the same poll types used by the standalone Live Poll:
-- choice, multi, yesno, scale, rating, ranking, wordcloud, open.
-- ============================================================

begin;

alter table public.classroom_polls
  add column if not exists poll_type text not null default 'choice';

alter table public.classroom_polls
  add column if not exists reveal_results boolean not null default false;

alter table public.classroom_poll_votes
  add column if not exists answer_value text;

alter table public.classroom_poll_votes
  add column if not exists answer_text text;

alter table public.classroom_poll_votes
  alter column choice drop not null;

update public.classroom_poll_votes
set answer_value=choice::text
where answer_value is null and choice is not null;

alter table public.classroom_polls
  drop constraint if exists classroom_polls_poll_type_check;

alter table public.classroom_polls
  add constraint classroom_polls_poll_type_check
  check (poll_type in ('choice','multi','yesno','scale','rating','ranking','wordcloud','open'));

create or replace function public.classroom_poll_open_v2(
  p_session uuid,
  p_teacher_token uuid,
  p_poll_key text,
  p_type text,
  p_question text,
  p_options jsonb
)
returns boolean
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  v_poll_id bigint;
  v_key text:=left(trim(coalesce(p_poll_key,'')),120);
  v_question text:=left(trim(coalesce(p_question,'')),300);
  v_type text:=lower(trim(coalesce(p_type,'choice')));
  v_options jsonb:=coalesce(p_options,'[]'::jsonb);
begin
  if not exists(
    select 1 from public.classroom_sessions
    where id=p_session and teacher_token=p_teacher_token and status='open'
  ) then return false; end if;

  if v_type not in ('choice','multi','yesno','scale','rating','ranking','wordcloud','open')
     or length(v_key)<1 or length(v_question)<1
  then return false; end if;

  if v_type='yesno' then
    v_options:='["Ja","Nein"]'::jsonb;
  elsif v_type in ('scale','rating') then
    v_options:='["1","2","3","4","5"]'::jsonb;
  elsif v_type in ('open','wordcloud') then
    v_options:='[]'::jsonb;
  else
    if jsonb_typeof(v_options)<>'array'
       or jsonb_array_length(v_options)<2
       or jsonb_array_length(v_options)>6
       or octet_length(v_options::text)>8000
    then return false; end if;
  end if;

  insert into public.classroom_polls(
    session_id,poll_key,poll_type,question,options,is_open,reveal_results,updated_at
  )
  values(
    p_session,v_key,v_type,v_question,v_options,true,false,now()
  )
  on conflict(session_id,poll_key) do update
    set poll_type=excluded.poll_type,
        question=excluded.question,
        options=excluded.options,
        is_open=true,
        reveal_results=false,
        updated_at=now()
  returning id into v_poll_id;

  delete from public.classroom_poll_votes where poll_id=v_poll_id;
  return true;
end;
$$;

create or replace function public.classroom_poll_state_v2(
  p_session uuid,
  p_teacher_token uuid,
  p_poll_key text,
  p_action text
)
returns boolean
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  v_poll_id bigint;
  a text:=lower(trim(coalesce(p_action,'')));
begin
  if not exists(
    select 1 from public.classroom_sessions
    where id=p_session and teacher_token=p_teacher_token
  ) then return false; end if;

  select id into v_poll_id
  from public.classroom_polls
  where session_id=p_session
    and poll_key=left(trim(coalesce(p_poll_key,'')),120)
  limit 1;

  if v_poll_id is null then return false; end if;

  if a='close' then
    update public.classroom_polls set is_open=false,updated_at=now() where id=v_poll_id;
  elsif a='reveal' then
    update public.classroom_polls set reveal_results=true,updated_at=now() where id=v_poll_id;
  elsif a='hide' then
    update public.classroom_polls set reveal_results=false,updated_at=now() where id=v_poll_id;
  elsif a='reset' then
    delete from public.classroom_poll_votes where poll_id=v_poll_id;
    update public.classroom_polls
      set is_open=false,reveal_results=false,updated_at=now()
      where id=v_poll_id;
  else
    return false;
  end if;

  return true;
end;
$$;

create or replace function public.classroom_poll_results_v2(
  p_session uuid,
  p_teacher_token uuid,
  p_poll_key text
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  v_poll public.classroom_polls;
  v_counts jsonb:='[]'::jsonb;
  v_answers jsonb:='[]'::jsonb;
  v_ranking jsonb:='[]'::jsonb;
  v_total integer:=0;
begin
  if not exists(
    select 1 from public.classroom_sessions
    where id=p_session and teacher_token=p_teacher_token
  ) then return jsonb_build_object('ok',false); end if;

  select * into v_poll
  from public.classroom_polls
  where session_id=p_session
    and poll_key=left(trim(coalesce(p_poll_key,'')),120)
  limit 1;

  if v_poll.id is null then
    return jsonb_build_object('ok',false,'error','poll_not_found');
  end if;

  select count(*)::integer into v_total
  from public.classroom_poll_votes
  where poll_id=v_poll.id;

  if v_poll.poll_type in ('open','wordcloud') then
    select coalesce(jsonb_agg(answer_text order by updated_at),'[]'::jsonb)
    into v_answers
    from public.classroom_poll_votes
    where poll_id=v_poll.id
      and nullif(trim(answer_text),'') is not null;

  elsif v_poll.poll_type='multi' then
    select coalesce(jsonb_agg(
      (
        select count(*)::integer
        from public.classroom_poll_votes r
        where r.poll_id=v_poll.id
          and exists(
            select 1
            from jsonb_array_elements_text(coalesce(nullif(r.answer_value,''),'[]')::jsonb) x(value)
            where x.value=g.i::text
          )
      )
      order by g.i
    ),'[]'::jsonb)
    into v_counts
    from generate_series(0,greatest(jsonb_array_length(v_poll.options)-1,-1)) g(i);

  elsif v_poll.poll_type='ranking' then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'label',v_poll.options->>g.i,
        'average',coalesce((
          select avg(x.pos)::numeric(10,2)
          from public.classroom_poll_votes r
          cross join lateral jsonb_array_elements_text(coalesce(nullif(r.answer_value,''),'[]')::jsonb)
            with ordinality x(value,pos)
          where r.poll_id=v_poll.id
            and x.value=g.i::text
        ),0)
      )
      order by coalesce((
        select avg(x.pos)
        from public.classroom_poll_votes r
        cross join lateral jsonb_array_elements_text(coalesce(nullif(r.answer_value,''),'[]')::jsonb)
          with ordinality x(value,pos)
        where r.poll_id=v_poll.id
          and x.value=g.i::text
      ),999),g.i
    ),'[]'::jsonb)
    into v_ranking
    from generate_series(0,greatest(jsonb_array_length(v_poll.options)-1,-1)) g(i);

  else
    select coalesce(jsonb_agg(
      (
        select count(*)::integer
        from public.classroom_poll_votes r
        where r.poll_id=v_poll.id
          and r.answer_value=g.i::text
      )
      order by g.i
    ),'[]'::jsonb)
    into v_counts
    from generate_series(0,greatest(jsonb_array_length(v_poll.options)-1,-1)) g(i);
  end if;

  return jsonb_build_object(
    'ok',true,
    'open',v_poll.is_open,
    'reveal_results',v_poll.reveal_results,
    'poll_type',v_poll.poll_type,
    'question',v_poll.question,
    'options',v_poll.options,
    'counts',v_counts,
    'answers',v_answers,
    'ranking',v_ranking,
    'total',v_total
  );
end;
$$;

create or replace function public.classroom_student_poll_vote_v2(
  p_student_token uuid,
  p_poll_key text,
  p_answer_value text default null,
  p_answer_text text default null
)
returns boolean
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  v_participant public.classroom_participants;
  v_poll public.classroom_polls;
  idx integer;
  vals jsonb;
  val jsonb;
  seen integer[]:='{}';
begin
  select * into v_participant
  from public.classroom_participants
  where student_token=p_student_token
  limit 1;

  if v_participant.id is null then return false; end if;

  select * into v_poll
  from public.classroom_polls
  where session_id=v_participant.session_id
    and poll_key=left(trim(coalesce(p_poll_key,'')),120)
    and is_open=true
  limit 1;

  if v_poll.id is null then return false; end if;

  if v_poll.poll_type in ('open','wordcloud') then
    if nullif(trim(coalesce(p_answer_text,'')),'') is null then return false; end if;
    if v_poll.poll_type='wordcloud' and length(trim(p_answer_text))>60 then return false; end if;
    if v_poll.poll_type='open' and length(trim(p_answer_text))>300 then return false; end if;

    insert into public.classroom_poll_votes(
      poll_id,participant_id,choice,answer_value,answer_text,updated_at
    )
    values(v_poll.id,v_participant.id,null,null,trim(p_answer_text),now())
    on conflict(poll_id,participant_id) do update
      set choice=null,answer_value=null,answer_text=excluded.answer_text,updated_at=now();

  elsif v_poll.poll_type='multi' then
    begin vals:=p_answer_value::jsonb; exception when others then return false; end;
    if jsonb_typeof(vals)<>'array'
       or jsonb_array_length(vals)<1
       or jsonb_array_length(vals)>jsonb_array_length(v_poll.options)
    then return false; end if;

    for val in select * from jsonb_array_elements(vals) loop
      begin idx:=trim(both '"' from val::text)::integer; exception when others then return false; end;
      if idx<0 or idx>=jsonb_array_length(v_poll.options) or idx=any(seen) then return false; end if;
      seen:=array_append(seen,idx);
    end loop;

    insert into public.classroom_poll_votes(
      poll_id,participant_id,choice,answer_value,answer_text,updated_at
    )
    values(v_poll.id,v_participant.id,null,vals::text,null,now())
    on conflict(poll_id,participant_id) do update
      set choice=null,answer_value=excluded.answer_value,answer_text=null,updated_at=now();

  elsif v_poll.poll_type='ranking' then
    begin vals:=p_answer_value::jsonb; exception when others then return false; end;
    if jsonb_typeof(vals)<>'array'
       or jsonb_array_length(vals)<>jsonb_array_length(v_poll.options)
    then return false; end if;

    for val in select * from jsonb_array_elements(vals) loop
      begin idx:=trim(both '"' from val::text)::integer; exception when others then return false; end;
      if idx<0 or idx>=jsonb_array_length(v_poll.options) or idx=any(seen) then return false; end if;
      seen:=array_append(seen,idx);
    end loop;

    insert into public.classroom_poll_votes(
      poll_id,participant_id,choice,answer_value,answer_text,updated_at
    )
    values(v_poll.id,v_participant.id,null,vals::text,null,now())
    on conflict(poll_id,participant_id) do update
      set choice=null,answer_value=excluded.answer_value,answer_text=null,updated_at=now();

  else
    begin idx:=p_answer_value::integer; exception when others then return false; end;
    if idx<0 or idx>=jsonb_array_length(v_poll.options) then return false; end if;

    insert into public.classroom_poll_votes(
      poll_id,participant_id,choice,answer_value,answer_text,updated_at
    )
    values(v_poll.id,v_participant.id,idx,idx::text,null,now())
    on conflict(poll_id,participant_id) do update
      set choice=excluded.choice,answer_value=excluded.answer_value,answer_text=null,updated_at=now();
  end if;

  update public.classroom_participants set last_seen=now() where id=v_participant.id;
  return true;
end;
$$;

revoke execute on function public.classroom_poll_open_v2(uuid,uuid,text,text,text,jsonb) from public;
revoke execute on function public.classroom_poll_state_v2(uuid,uuid,text,text) from public;
revoke execute on function public.classroom_poll_results_v2(uuid,uuid,text) from public;
revoke execute on function public.classroom_student_poll_vote_v2(uuid,text,text,text) from public;

grant execute on function public.classroom_poll_open_v2(uuid,uuid,text,text,text,jsonb) to anon,authenticated;
grant execute on function public.classroom_poll_state_v2(uuid,uuid,text,text) to anon,authenticated;
grant execute on function public.classroom_poll_results_v2(uuid,uuid,text) to anon,authenticated;
grant execute on function public.classroom_student_poll_vote_v2(uuid,text,text,text) to anon,authenticated;

commit;
notify pgrst,'reload schema';

select
  to_regprocedure('public.classroom_poll_open_v2(uuid,uuid,text,text,text,jsonb)') is not null as poll_open_v2_ok,
  to_regprocedure('public.classroom_poll_results_v2(uuid,uuid,text)') is not null as poll_results_v2_ok,
  to_regprocedure('public.classroom_student_poll_vote_v2(uuid,text,text,text)') is not null as poll_vote_v2_ok;
