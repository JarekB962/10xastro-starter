-- Specjalności należące do projektu.
-- Dostęp do danych egzekwują polityki RLS: użytkownik widzi i zmienia wyłącznie specjalności swoich projektów.

create table public.specialties (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null constraint specialties_name_length check (char_length(btrim(name)) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Nazwa specjalności jest unikalna w obrębie projektu, bez rozróżniania wielkości liter.
-- Pierwsza kolumna indeksu pokrywa też zapytania po project_id.
create unique index specialties_project_name_key on public.specialties (project_id, lower(btrim(name)));

create trigger specialties_set_updated_at
  before update on public.specialties
  for each row execute function public.set_updated_at();

alter table public.specialties enable row level security;

-- specialties: osobna polityka dla każdej operacji; rola anon nie ma dostępu.
-- Brak polityki delete: wiersz znika kaskadowo razem z projektem.
-- Warunek własności: projekt specjalności musi należeć do użytkownika (with check blokuje przeniesienie do cudzego projektu).
create policy "specialties_select_own" on public.specialties
  for select to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = (select auth.uid())
    )
  );

create policy "specialties_insert_own" on public.specialties
  for insert to authenticated
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = (select auth.uid())
    )
  );

create policy "specialties_update_own" on public.specialties
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
