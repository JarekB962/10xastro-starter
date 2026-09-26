-- Usuwanie zadania: właściciel usuwa zadania swoich projektów, ale baza nie pozwala usunąć zadania,
-- które jest poprzednikiem innego zadania tego samego projektu.

-- tasks: usuwanie z tym samym warunkiem własności co pozostałe polityki; rola anon nie ma dostępu.
-- Wiersze task_predecessors znikają razem z zadaniem (on delete cascade).
create policy "tasks_delete_own" on public.tasks
  for delete to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = (select auth.uid())
    )
  );

-- Poprzednik to numer zadania, a nie klucz obcy, więc reguły „zadanie-poprzednik nie znika” pilnuje wyzwalacz.
-- Kaskada z usuwanego projektu nie jest blokowana: zadania mogą wskazywać na siebie (także cyklicznie), a wiersz
-- projektu jest wtedy już niewidoczny, więc brak projektu oznacza „przepuść”.
create function public.prevent_delete_task_with_dependents()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_dependents text;
begin
  if not exists (select 1 from public.projects p where p.id = old.project_id) then
    return old;
  end if;

  select string_agg(t.number::text, ', ' order by t.number)
  into v_dependents
  from public.tasks t
  where t.project_id = old.project_id
    and t.id <> old.id
    and exists (
      select 1 from public.task_predecessors tp
      where tp.task_id = t.id and tp.predecessor_number = old.number
    );

  if v_dependents is not null then
    raise exception 'Zadanie jest poprzednikiem zadań: %.', v_dependents using errcode = 'restrict_violation';
  end if;

  return old;
end;
$$;

create trigger tasks_prevent_delete_with_dependents
  before delete on public.tasks
  for each row execute function public.prevent_delete_task_with_dependents();
