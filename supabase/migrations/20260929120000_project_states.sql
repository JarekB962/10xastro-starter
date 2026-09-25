-- Stan projektu (zweryfikowany / niezweryfikowany) pilnowany przez bazę.
-- Stan to porównanie dwóch liczników: data_revision rośnie przy każdej zmianie danych projektu (zadania, poprzednicy,
-- specjalności), a verified_revision dostaje wartość data_revision w chwili udanego sprawdzenia.
-- Projekt jest zweryfikowany, gdy verified_revision = data_revision; brak wiersza to licznik 0 i brak weryfikacji.

create table public.project_states (
  project_id uuid primary key references public.projects (id) on delete cascade,
  data_revision bigint not null default 0,
  verified_revision bigint
);

alter table public.project_states enable row level security;

-- Tylko odczyt własnego stanu; brak polityk insert/update/delete, więc użytkownik nie ustawi stanu bezpośrednio.
-- Zmieniają go wyłącznie funkcje security definer poniżej (wyzwalacze i verify_project). Rola anon nie ma dostępu.
create policy "project_states_select_own" on public.project_states
  for select to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = (select auth.uid())
    )
  );

-- Podnosi licznik zmian projektu; tylko dla istniejącego projektu, żeby kaskada z usuwanego projektu
-- nie tworzyła wiersza stanu z kluczem obcym do nieistniejącego projektu.
create function public.bump_project_revision(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.project_states (project_id, data_revision)
  select p.id, 1 from public.projects p where p.id = p_project_id
  on conflict (project_id) do update set data_revision = public.project_states.data_revision + 1;
end;
$$;

create function public.bump_revision_from_task()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.bump_project_revision(case when tg_op = 'DELETE' then old.project_id else new.project_id end);
  return null;
end;
$$;

-- Poprzednik należy do projektu przez zadanie; brak wiersza zadania (kaskada z usuwanego zadania lub projektu) = pomiń.
create function public.bump_revision_from_predecessor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
begin
  select t.project_id into v_project_id
  from public.tasks t
  where t.id = case when tg_op = 'DELETE' then old.task_id else new.task_id end;

  if v_project_id is not null then
    perform public.bump_project_revision(v_project_id);
  end if;
  return null;
end;
$$;

create function public.bump_revision_from_specialty()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.bump_project_revision(case when tg_op = 'DELETE' then old.project_id else new.project_id end);
  return null;
end;
$$;

revoke execute on function public.bump_project_revision(uuid) from public, anon, authenticated;
revoke execute on function public.bump_revision_from_task() from public, anon, authenticated;
revoke execute on function public.bump_revision_from_predecessor() from public, anon, authenticated;
revoke execute on function public.bump_revision_from_specialty() from public, anon, authenticated;

create trigger tasks_bump_revision
  after insert or update or delete on public.tasks
  for each row execute function public.bump_revision_from_task();

create trigger task_predecessors_bump_revision
  after insert or update or delete on public.task_predecessors
  for each row execute function public.bump_revision_from_predecessor();

create trigger specialties_bump_revision
  after insert or update or delete on public.specialties
  for each row execute function public.bump_revision_from_specialty();

-- Zapisuje weryfikację tylko wtedy, gdy dane nie zmieniły się od odczytu licznika (p_revision).
-- Zwraca true, gdy stan został zapisany, false, gdy licznik zdążył wzrosnąć.
-- security definer omija RLS, więc właściciela sprawdza jawny warunek.
create function public.verify_project(p_project_id uuid, p_revision bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if not exists (
    select 1 from public.projects p
    where p.id = p_project_id and p.owner_id = (select auth.uid())
  ) then
    raise exception 'Brak dostępu do projektu.' using errcode = '42501';
  end if;

  insert into public.project_states (project_id) values (p_project_id) on conflict (project_id) do nothing;

  update public.project_states
  set verified_revision = data_revision
  where project_id = p_project_id and data_revision = p_revision;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke execute on function public.verify_project(uuid, bigint) from public, anon;
grant execute on function public.verify_project(uuid, bigint) to authenticated;
