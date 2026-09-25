-- Zadania należące do projektu oraz ich poprzednicy (numery zadań).
-- Dostęp do danych egzekwują polityki RLS: użytkownik widzi i zmienia wyłącznie zadania swoich projektów.

-- Cel złożonego klucza obcego z zadań: specjalność zadania musi należeć do tego samego projektu.
alter table public.specialties add constraint specialties_id_project_key unique (id, project_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  number integer not null constraint tasks_number_positive check (number >= 1),
  name text not null constraint tasks_name_length check (char_length(btrim(name)) between 1 and 100),
  specialty_id uuid,
  effort numeric(10, 2) constraint tasks_effort_non_negative check (effort >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- MATCH SIMPLE: przy specialty_id null klucz nie jest sprawdzany, więc specjalność jest opcjonalna.
  constraint tasks_specialty_project_fkey foreign key (specialty_id, project_id)
    references public.specialties (id, project_id) on delete restrict
);

-- Numer zadania jest unikalny w obrębie projektu.
-- Pierwsza kolumna indeksu pokrywa też zapytania po project_id.
create unique index tasks_project_number_key on public.tasks (project_id, number);

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- Poprzednik to numer zadania, a nie klucz obcy: zadanie o tym numerze może jeszcze nie istnieć.
create table public.task_predecessors (
  task_id uuid not null references public.tasks (id) on delete cascade,
  predecessor_number integer not null constraint task_predecessors_number_positive check (predecessor_number >= 1),
  primary key (task_id, predecessor_number)
);

-- Zadanie nie może być własnym poprzednikiem.
create function public.prevent_self_predecessor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.tasks t
    where t.id = new.task_id and t.number = new.predecessor_number
  ) then
    raise exception 'Zadanie nie może być własnym poprzednikiem.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger task_predecessors_prevent_self
  before insert or update on public.task_predecessors
  for each row execute function public.prevent_self_predecessor();

-- Dodanie zadania z poprzednikami w jednej transakcji; security invoker, więc RLS działa jak zwykle.
create function public.create_task(
  p_project_id uuid,
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
  insert into public.tasks (project_id, number, name, specialty_id, effort)
  values (p_project_id, p_number, p_name, p_specialty_id, p_effort)
  returning * into v_task;

  insert into public.task_predecessors (task_id, predecessor_number)
  select distinct v_task.id, n from unnest(coalesce(p_predecessors, '{}'::integer[])) as n;

  return v_task;
end;
$$;

revoke execute on function public.create_task(uuid, integer, text, uuid, numeric, integer[]) from public, anon;
grant execute on function public.create_task(uuid, integer, text, uuid, numeric, integer[]) to authenticated;

alter table public.tasks enable row level security;
alter table public.task_predecessors enable row level security;

-- tasks: osobna polityka dla każdej operacji; rola anon nie ma dostępu.
-- Brak polityki delete: wiersz znika kaskadowo razem z projektem (usuwanie zadania dojdzie w S-04).
create policy "tasks_select_own" on public.tasks
  for select to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = (select auth.uid())
    )
  );

create policy "tasks_insert_own" on public.tasks
  for insert to authenticated
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = (select auth.uid())
    )
  );

create policy "tasks_update_own" on public.tasks
  for update to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = (select auth.uid())
    )
  );

-- task_predecessors: własność przechodzi przez zadanie do projektu; update i delete dojdą w S-03.
create policy "task_predecessors_select_own" on public.task_predecessors
  for select to authenticated
  using (
    exists (
      select 1 from public.tasks t
      join public.projects p on p.id = t.project_id
      where t.id = task_id and p.owner_id = (select auth.uid())
    )
  );

create policy "task_predecessors_insert_own" on public.task_predecessors
  for insert to authenticated
  with check (
    exists (
      select 1 from public.tasks t
      join public.projects p on p.id = t.project_id
      where t.id = task_id and p.owner_id = (select auth.uid())
    )
  );
