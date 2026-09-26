-- Zmiana numeru zadania: numer przestaje być niezmienny, a każda jego zmiana przepisuje poprzedników w tej samej
-- transakcji. Zmiana jest odrzucana, gdy nowy numer jest numerem własnego poprzednika albo gdy inne zadania projektu
-- mają go już wpisanego jako poprzednika (wiszące odwołanie, np. literówka).

-- Zdjęcie blokady niezmienności numeru (S-03).
drop trigger tasks_prevent_number_change on public.tasks;
drop function public.prevent_task_number_change();

-- Po zmianie numeru: odrzuca kolizje z poprzednikami, a potem przepisuje stary numer na nowy u zadań tego projektu.
-- security definer, bo task_predecessors nie ma polityki update; funkcja rusza wyłącznie zadania projektu zmienianego
-- zadania, do którego użytkownik już przeszedł RLS na tasks. Odrzucenie wiszących odwołań do nowego numeru sprawia,
-- że przepisanie nigdy nie tworzy duplikatu klucza (task_id, predecessor_number).
create function public.handle_task_number_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_referencing text;
begin
  if exists (
    select 1 from public.task_predecessors tp
    where tp.task_id = new.id and tp.predecessor_number = new.number
  ) then
    raise exception 'Zadanie nie może być własnym poprzednikiem.' using errcode = 'check_violation';
  end if;

  select string_agg(t.number::text, ', ' order by t.number)
  into v_referencing
  from public.tasks t
  where t.project_id = new.project_id
    and t.id <> new.id
    and exists (
      select 1 from public.task_predecessors tp
      where tp.task_id = t.id and tp.predecessor_number = new.number
    );

  if v_referencing is not null then
    raise exception 'Numer % jest już wpisany jako poprzednik w zadaniach: %.', new.number, v_referencing
      using errcode = 'restrict_violation';
  end if;

  update public.task_predecessors p
  set predecessor_number = new.number
  from public.tasks t
  where p.task_id = t.id
    and t.project_id = new.project_id
    and p.predecessor_number = old.number;

  return null;
end;
$$;

revoke execute on function public.handle_task_number_change() from public, anon, authenticated;

create trigger tasks_handle_number_change
  after update on public.tasks
  for each row
  when (old.number is distinct from new.number)
  execute function public.handle_task_number_change();

-- Zapis poprawki zadania z numerem i poprzednikami w jednej transakcji; security invoker, więc RLS działa jak zwykle.
-- Przeciążenie obok 5-argumentowej wersji z S-03, która zostaje do czasu wdrożenia nowego kodu (usunie ją osobna migracja).
-- Kolejność ma znaczenie: najpierw znikają własni poprzednicy zadania, żeby stary wpis równy nowemu numerowi nie
-- blokował zapisu, gdy użytkownik usuwa go w tym samym formularzu; wyjątek w środku cofa całość.
create function public.update_task(
  p_id uuid,
  p_number integer,
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
  delete from public.task_predecessors where task_id = p_id;

  update public.tasks
  set number = p_number, name = p_name, specialty_id = p_specialty_id, effort = p_effort
  where id = p_id
  returning * into v_task;

  if not found then
    raise exception 'Nie znaleziono zadania.' using errcode = 'P0002';
  end if;

  insert into public.task_predecessors (task_id, predecessor_number)
  select distinct v_task.id, n from unnest(coalesce(p_predecessors, '{}'::integer[])) as n;

  return v_task;
end;
$$;

revoke execute on function public.update_task(uuid, integer, text, uuid, numeric, integer[]) from public, anon;
grant execute on function public.update_task(uuid, integer, text, uuid, numeric, integer[]) to authenticated;
