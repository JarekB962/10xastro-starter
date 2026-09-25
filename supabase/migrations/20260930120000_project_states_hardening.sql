-- Poprawki po przeglądzie project-verified-state.
-- Stan „zweryfikowany” zapisuje aplikacja po sprawdzeniu przez verify_project (właściciel może ją wywołać sam dla
-- własnego projektu); baza pilnuje natomiast, by każda zmiana danych cofała stan i by użytkownik nie zapisywał tabeli.

-- Obrona w głąb: domyślne uprawnienia Supabase dają anon i authenticated zapis do nowych tabel, a zapis blokował
-- wyłącznie brak polityk RLS. Użytkownik ma tylko odczyt własnego stanu; zapisują funkcje security definer.
revoke all on public.project_states from anon, authenticated;
grant select on public.project_states to authenticated;

-- Zmiana task_id poprzednika (przeniesienie do zadania z innego projektu) podnosi licznik obu projektów.
create or replace function public.bump_revision_from_predecessor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new_project_id uuid;
  v_old_project_id uuid;
begin
  if tg_op in ('INSERT', 'UPDATE') then
    select t.project_id into v_new_project_id from public.tasks t where t.id = new.task_id;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    select t.project_id into v_old_project_id from public.tasks t where t.id = old.task_id;
  end if;

  if v_new_project_id is not null then
    perform public.bump_project_revision(v_new_project_id);
  end if;
  if v_old_project_id is not null and v_old_project_id is distinct from v_new_project_id then
    perform public.bump_project_revision(v_old_project_id);
  end if;
  return null;
end;
$$;
