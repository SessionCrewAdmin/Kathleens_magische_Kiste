-- ============================================================
-- Kathleens Live Poll · V21.5 MULTI POLL TYPES
-- Run once AFTER V21.3 Live Poll.
-- Non-destructive: preserves existing sessions and responses.
-- Adds: multi, rating, ranking, wordcloud.
-- ============================================================

begin;

alter table public.live_poll_questions
  drop constraint if exists live_poll_questions_question_type_check;

alter table public.live_poll_questions
  add constraint live_poll_questions_question_type_check
  check (question_type in ('choice','multi','yesno','scale','rating','ranking','wordcloud','open'));

create or replace function public.poll_normalize_options(
  p_type text,
  p_options jsonb
)
returns jsonb
language plpgsql
immutable
set search_path=public,pg_catalog
as $$
declare
  opts jsonb := coalesce(p_options,'[]'::jsonb);
  n integer;
begin
  if p_type not in ('choice','multi','yesno','scale','rating','ranking','wordcloud','open') then
    raise exception 'invalid_poll_type';
  end if;

  if p_type='yesno' then
    return '["Ja","Nein"]'::jsonb;
  elsif p_type in ('scale','rating') then
    return '["1","2","3","4","5"]'::jsonb;
  elsif p_type in ('open','wordcloud') then
    return '[]'::jsonb;
  end if;

  if jsonb_typeof(opts) <> 'array' then
    raise exception 'options_must_be_array';
  end if;

  n := jsonb_array_length(opts);
  if n < 2 or n > 6 then
    raise exception 'poll_requires_2_to_6_options';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(opts) x(value)
    where nullif(trim(value),'') is null
  ) then
    raise exception 'empty_option';
  end if;

  return (
    select jsonb_agg(trim(value))
    from jsonb_array_elements_text(opts) x(value)
  );
end;
$$;

create or replace function public.poll_submit(
  p_code text,
  p_voter_token text,
  p_answer_value text default null,
  p_answer_text text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  s public.live_poll_sessions%rowtype;
  q public.live_poll_questions%rowtype;
  idx integer;
  vals jsonb;
  val jsonb;
  seen integer[] := '{}';
begin
  if length(trim(coalesce(p_voter_token,''))) < 8
     or length(trim(coalesce(p_voter_token,''))) > 120 then
    raise exception 'invalid_voter_token';
  end if;

  select * into s from public.live_poll_sessions where code=upper(trim(p_code));
  if not found then raise exception 'poll_not_found'; end if;

  select * into q from public.live_poll_questions
  where session_id=s.id order by seq desc limit 1;

  if s.status <> 'open' or q.status <> 'open' then
    raise exception 'poll_not_open';
  end if;

  if q.question_type in ('open','wordcloud') then
    if nullif(trim(coalesce(p_answer_text,'')),'') is null then raise exception 'answer_required'; end if;
    if q.question_type='wordcloud' and length(trim(p_answer_text)) > 60 then raise exception 'answer_too_long'; end if;
    if q.question_type='open' and length(trim(p_answer_text)) > 300 then raise exception 'answer_too_long'; end if;
    insert into public.live_poll_responses(question_id,voter_token,answer_value,answer_text)
    values(q.id,trim(p_voter_token),null,trim(p_answer_text))
    on conflict(question_id,voter_token) do update
      set answer_value=null,answer_text=excluded.answer_text,updated_at=now();

  elsif q.question_type='multi' then
    begin vals := p_answer_value::jsonb; exception when others then raise exception 'invalid_answer'; end;
    if jsonb_typeof(vals)<>'array' or jsonb_array_length(vals)<1 or jsonb_array_length(vals)>jsonb_array_length(q.options) then raise exception 'invalid_answer'; end if;
    for val in select * from jsonb_array_elements(vals) loop
      begin idx := trim(both '"' from val::text)::integer; exception when others then raise exception 'invalid_answer'; end;
      if idx<0 or idx>=jsonb_array_length(q.options) or idx=any(seen) then raise exception 'invalid_answer'; end if;
      seen := array_append(seen,idx);
    end loop;
    insert into public.live_poll_responses(question_id,voter_token,answer_value,answer_text)
    values(q.id,trim(p_voter_token),vals::text,null)
    on conflict(question_id,voter_token) do update
      set answer_value=excluded.answer_value,answer_text=null,updated_at=now();

  elsif q.question_type='ranking' then
    begin vals := p_answer_value::jsonb; exception when others then raise exception 'invalid_answer'; end;
    if jsonb_typeof(vals)<>'array' or jsonb_array_length(vals)<>jsonb_array_length(q.options) then raise exception 'invalid_answer'; end if;
    for val in select * from jsonb_array_elements(vals) loop
      begin idx := trim(both '"' from val::text)::integer; exception when others then raise exception 'invalid_answer'; end;
      if idx<0 or idx>=jsonb_array_length(q.options) or idx=any(seen) then raise exception 'invalid_answer'; end if;
      seen := array_append(seen,idx);
    end loop;
    insert into public.live_poll_responses(question_id,voter_token,answer_value,answer_text)
    values(q.id,trim(p_voter_token),vals::text,null)
    on conflict(question_id,voter_token) do update
      set answer_value=excluded.answer_value,answer_text=null,updated_at=now();

  else
    begin idx := p_answer_value::integer; exception when others then raise exception 'invalid_answer'; end;
    if idx < 0 or idx >= jsonb_array_length(q.options) then raise exception 'invalid_answer'; end if;
    insert into public.live_poll_responses(question_id,voter_token,answer_value,answer_text)
    values(q.id,trim(p_voter_token),idx::text,null)
    on conflict(question_id,voter_token) do update
      set answer_value=excluded.answer_value,answer_text=null,updated_at=now();
  end if;

  return jsonb_build_object('ok',true,'question_id',q.id);
end;
$$;

create or replace function public.poll_public_state(
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  s public.live_poll_sessions%rowtype;
  q public.live_poll_questions%rowtype;
  cnt integer := 0;
  counts jsonb := '[]'::jsonb;
  answers jsonb := '[]'::jsonb;
  ranking jsonb := '[]'::jsonb;
  result_obj jsonb := '{}'::jsonb;
begin
  select * into s from public.live_poll_sessions where code=upper(trim(p_code));
  if not found then return jsonb_build_object('exists',false); end if;

  select * into q from public.live_poll_questions
  where session_id=s.id order by seq desc limit 1;

  select count(*)::integer into cnt from public.live_poll_responses where question_id=q.id;

  if q.reveal_results then
    if q.question_type in ('open','wordcloud') then
      select coalesce(jsonb_agg(answer_text order by updated_at),'[]'::jsonb)
      into answers from public.live_poll_responses
      where question_id=q.id and nullif(trim(answer_text),'') is not null;
      result_obj := jsonb_build_object('answers',answers);

    elsif q.question_type='multi' then
      select coalesce(jsonb_agg(
        (select count(*)::integer
           from public.live_poll_responses r
          where r.question_id=q.id
            and exists(
              select 1 from jsonb_array_elements_text(coalesce(nullif(r.answer_value,''),'[]')::jsonb) v(value)
              where v.value=g.i::text
            ))
        order by g.i),'[]'::jsonb)
      into counts
      from generate_series(0,greatest(jsonb_array_length(q.options)-1,-1)) g(i);
      result_obj := jsonb_build_object('counts',counts);

    elsif q.question_type='ranking' then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'label', q.options->>g.i,
          'average',
          coalesce((
            select avg(pos)::numeric(10,2)
            from public.live_poll_responses r
            cross join lateral jsonb_array_elements_text(coalesce(nullif(r.answer_value,''),'[]')::jsonb) with ordinality x(value,pos)
            where r.question_id=q.id and x.value=g.i::text
          ),0)
        )
        order by coalesce((
          select avg(pos)
          from public.live_poll_responses r
          cross join lateral jsonb_array_elements_text(coalesce(nullif(r.answer_value,''),'[]')::jsonb) with ordinality x(value,pos)
          where r.question_id=q.id and x.value=g.i::text
        ),999), g.i
      ),'[]'::jsonb)
      into ranking
      from generate_series(0,greatest(jsonb_array_length(q.options)-1,-1)) g(i);
      result_obj := jsonb_build_object('ranking',ranking);

    else
      select coalesce(jsonb_agg(
        (select count(*)::integer from public.live_poll_responses r
          where r.question_id=q.id and r.answer_value=g.i::text)
        order by g.i),'[]'::jsonb)
      into counts
      from generate_series(0,greatest(jsonb_array_length(q.options)-1,-1)) g(i);
      result_obj := jsonb_build_object('counts',counts);
    end if;
  end if;

  return jsonb_build_object(
    'exists',true,
    'session',jsonb_build_object('code',s.code,'status',s.status),
    'question',jsonb_build_object(
      'id',q.id,'seq',q.seq,'prompt',q.prompt,'question_type',q.question_type,
      'options',q.options,'status',q.status,'reveal_results',q.reveal_results
    ),
    'response_count',cnt,
    'results',result_obj
  );
end;
$$;

revoke all on function public.poll_normalize_options(text,jsonb) from public;
revoke execute on function public.poll_submit(text,text,text,text) from public;
revoke execute on function public.poll_public_state(text) from public;

grant execute on function public.poll_submit(text,text,text,text) to anon,authenticated;
grant execute on function public.poll_public_state(text) to anon,authenticated;

commit;
notify pgrst,'reload schema';

select
  exists(
    select 1 from pg_constraint
    where conrelid='public.live_poll_questions'::regclass
      and conname='live_poll_questions_question_type_check'
  ) as question_types_ok,
  to_regprocedure('public.poll_submit(text,text,text,text)') is not null as submit_rpc_ok,
  to_regprocedure('public.poll_public_state(text)') is not null as public_state_ok;
