-- Projekty kierownika oraz ustawienia użytkownika (ostatnio wybrany projekt).
-- Dostęp do danych egzekwują polityki RLS: każdy użytkownik widzi wyłącznie własne wiersze.

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null constraint projects_name_length check (char_length(btrim(name)) between 1 and 100),
  description text constraint projects_description_length check (char_length(description) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Nazwa projektu jest unikalna w obrębie właściciela, bez rozróżniania wielkości liter.
create unique index projects_owner_name_key on public.projects (owner_id, lower(btrim(name)));

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  selected_project_id uuid references public.projects (id) on delete set null
);

alter table public.projects enable row level security;
alter table public.user_settings enable row level security;

-- projects: osobna polityka dla każdej operacji; rola anon nie ma dostępu.
create policy "projects_select_own" on public.projects
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "projects_insert_own" on public.projects
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "projects_update_own" on public.projects
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "projects_delete_own" on public.projects
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- user_settings: brak polityki delete, wiersz znika kaskadowo razem z użytkownikiem.
-- Wybrany projekt musi należeć do użytkownika.
create policy "user_settings_select_own" on public.user_settings
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "user_settings_insert_own" on public.user_settings
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      selected_project_id is null
      or exists (
        select 1 from public.projects p
        where p.id = selected_project_id and p.owner_id = (select auth.uid())
      )
    )
  );

create policy "user_settings_update_own" on public.user_settings
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (
      selected_project_id is null
      or exists (
        select 1 from public.projects p
        where p.id = selected_project_id and p.owner_id = (select auth.uid())
      )
    )
  );
