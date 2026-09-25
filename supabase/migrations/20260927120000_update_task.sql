-- Poprawa zadania: numer jest niezmienny, właściciel może usuwać poprzedników swoich zadań,
-- a zmiany zapisuje jedna funkcja w jednej transakcji.

-- Numer zadania nie może się zmienić (inne zadania odwołują się do niego jako do poprzednika).
create function public.prevent_task_number_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Numer zadania jest niezmienny.' using errcode = 'check_violation';
end;
$$;

create trigger tasks_prevent_number_change
  before update on public.tasks
  for each row
  when (old.number is distinct from new.number)
  execute function public.prevent_task_number_change();

-- task_predecessors: usuwanie z tym samym warunkiem własności co select i insert; rola anon nie ma dostępu.
create policy "task_predecessors_delete_own" on public.task_predecessors
  for delete to authenticated
  using (
    exists (
      select 1 from public.tasks t
      join public.projects p on p.id = t.project_id
      where t.id = task_id and p.owner_id = (select auth.uid())
    )
  );

-- Zapis poprawki zadania wraz z poprzednikami w jednej transakcji; security invoker, więc RLS działa jak zwykle.
create function public.update_task(
  p_id uuid,
  p_name text,
  p_specialty_id uuid,
  p_effort numeric,
  p_predecessors integer[]
)
returns public.tasks
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_task public.tasks;
begin
  update public.tasks
  set name = p_name, specialty_id = p_specialty_id, effort = p_effort
  where id = p_id
  returning * into v_task;

  if not found then
    raise exception 'Nie znaleziono zadania.' using errcode = 'P0002';
  end if;

  delete from public.task_predecessors where task_id = v_task.id;

  insert into public.task_predecessors (task_id, predecessor_number)
  select distinct v_task.id, n from unnest(coalesce(p_predecessors, '{}'::integer[])) as n;

  return v_task;
end;
$$;

revoke execute on function public.update_task(uuid, text, uuid, numeric, integer[]) from public, anon;
grant execute on function public.update_task(uuid, text, uuid, numeric, integer[]) to authenticated;
