-- ============================================================
-- Kathleens Kiste · V23.6 TIMETABLE PUSH
-- Adds weekly teacher reminders for the timetable tool.
-- Run AFTER V23_4_TEACHER_PUSH.sql.
-- NON-DESTRUCTIVE.
-- ============================================================

begin;

alter table public.teacher_push_reminders
  add column if not exists source text,
  add column if not exists source_key text;

alter table public.teacher_push_reminders
  drop constraint if exists teacher_push_reminders_recurrence_check;

alter table public.teacher_push_reminders
  add constraint teacher_push_reminders_recurrence_check
  check (recurrence in ('none','daily','weekdays','weekly'));

create index if not exists teacher_push_reminders_source_idx
  on public.teacher_push_reminders(source,source_key)
  where source is not null;

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

  local_next := r.scheduled_for at time zone r.timezone_name;

  if r.recurrence='weekly' then
    local_next := local_next + interval '7 days';
  else
    local_next := local_next + interval '1 day';
    if r.recurrence='weekdays' then
      while extract(isodow from local_next) in (6,7) loop
        local_next := local_next + interval '1 day';
      end loop;
    end if;
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

revoke all on function public.teacher_push_finish_reminder(uuid,boolean) from public;
grant execute on function public.teacher_push_finish_reminder(uuid,boolean) to service_role;

commit;

select
  exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='teacher_push_reminders' and column_name='source'
  ) as source_column_ok,
  exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='teacher_push_reminders' and column_name='source_key'
  ) as source_key_column_ok;
