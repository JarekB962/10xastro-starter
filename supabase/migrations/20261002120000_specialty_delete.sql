-- Usuwanie specjalności: właściciel usuwa specjalności swoich projektów.
-- Blokadę specjalności użytej w zadaniu pilnuje istniejący klucz obcy tasks_specialty_project_fkey
-- (on delete restrict, błąd 23503), więc nie potrzeba osobnego wyzwalacza.

-- specialties: usuwanie z tym samym warunkiem własności co pozostałe polityki; rola anon nie ma dostępu.
-- Kaskada z usuwanego projektu działa jak dotąd (klucz obcy do projects ma on delete cascade).
create policy "specialties_delete_own" on public.specialties
  for delete to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = (select auth.uid())
    )
  );
