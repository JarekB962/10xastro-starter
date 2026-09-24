# Pierwsza wersja MVP: logowanie, projekty i wybór projektu — Implementation Plan

## Overview

Pierwszy wycinek MVP „Plan projektu (WBS)" obejmuje wymagania FR-001, FR-002 i FR-003 z `context/foundation/prd.md`: zalogowany kierownik projektu prowadzi własną listę projektów (nazwa unikalna + opis), może je dodawać, edytować i usuwać (po wyraźnym potwierdzeniu na osobnej stronie) oraz wybierać projekt, w którym pracuje. Wybór jest zapisany w bazie, a dostęp do danych egzekwują reguły dostępu w bazie. Specjalności, zadania i sprawdzanie zależności (FR-004..FR-012) zostają na kolejne zmiany.

## Current State Analysis

- **Logowanie (FR-001) już działa.** Rejestracja, logowanie i wylogowanie to zwykłe formularze `POST` z przekierowaniem: `src/pages/api/auth/signin.ts`, `signup.ts`, `signout.ts`. Sesja siedzi w ciasteczkach przez `createServerClient` w `src/lib/supabase.ts:5`. Po zalogowaniu użytkownik trafia na `/` (`signin.ts:19`).
- **Ochrona tras** jest w `src/middleware.ts:4`; `PROTECTED_ROUTES` zawiera tylko `/dashboard`. `context.locals.user` jest ustawiany przy każdym żądaniu (`middleware.ts:10-15`).
- **`src/pages/dashboard.astro` to placeholder** z powitaniem i przyciskiem wylogowania.
- **Nie ma bazy danych aplikacji:** brak katalogu `supabase/migrations/`, brak `src/types.ts`, brak usług w `src/lib/services/`. `supabase/config.toml:53` przewiduje migracje, a `enable_confirmations = false` (`config.toml:209`) pozwala zalogować się zaraz po rejestracji na lokalnym Supabase.
- **Konwencje interfejsu:** formularze `POST` z przekierowaniem i błędem w `?error=` (`signin.astro:5`), komponenty React tylko do walidacji po stronie przeglądarki (`SignInForm.tsx`, `FormField.tsx`), wspólny wygląd `bg-cosmic` z kartą `bg-white/10`. Wszystkie teksty są po angielsku.
- **Testy:** jest tylko `scripts/smoke.mjs` (bez zależności, kroki przez HTTP), uruchamiany w CI na lokalnym Supabase (`.github/workflows/ci.yml:27-55`). Nie ma Vitest ani Playwright.
- **`zod` nie jest zależnością bezpośrednią** (`package.json`), choć CLAUDE.md wymaga walidacji zod. Wersja 4.x jest już w `package-lock.json` jako zależność pośrednia.
- **Rozjazd wdrożenia (poza zakresem):** `context/foundation/tech-stack.md` mówi `cloudflare-pages`, a `wrangler.jsonc` i job `deploy` w CI wdrażają na Cloudflare Workers.

## Desired End State

Po zalogowaniu kierownik trafia na `/projects` i widzi tylko swoje projekty. Może dodać projekt (nazwa unikalna w jego obrębie bez rozróżniania wielkości liter, opis opcjonalny), zmienić go, wybrać go jako bieżący (zapis w bazie, widoczny na `/dashboard`) i usunąć po potwierdzeniu na osobnej stronie. Drugi użytkownik nie widzi ani nie modyfikuje cudzych projektów: bezpośrednie wejście w cudzy adres kończy się 404. Ekrany są po polsku, także istniejące ekrany logowania. Weryfikacja: `npm run smoke` przechodzi z nowymi krokami, a `npm run lint`, `npx astro check` i `npm run build` są zielone.

### Key Discoveries:

- Wzorzec formularza: `POST` → przekierowanie z `?error=` (`src/pages/api/auth/signin.ts:13-19`). Nowe trasy naśladują go.
- `createClient` zwraca `null`, gdy brakuje konfiguracji (`src/lib/supabase.ts:6-8`); każda nowa trasa i strona musi to obsłużyć tak jak `signin.ts:10-12`.
- Middleware chroni trasy po prefiksie (`middleware.ts:18`), więc dodanie `/projects` i `/api/projects` do listy wystarcza.
- Smoke test dziś oczekuje przekierowania po logowaniu na `/` (`scripts/smoke.mjs:54`); zmiana celu na `/projects` wymaga aktualizacji tego kroku.
- ESLint `strictTypeChecked` (`eslint.config.js:17`) wymaga typów zapytań, więc `createServerClient` dostaje typ `Database`.
- Skrypty `scripts/**/*.mjs` mają wąską listę globali (`eslint.config.js:76`): tylko `console`, `process`, `fetch`, `URLSearchParams`.

## What We're NOT Doing

- Specjalności wykonawców, zadania, sprawdzanie zależności i stan „zweryfikowany" projektu (FR-004..FR-009, FR-011).
- Udostępnianie projektu (FR-010) i klonowanie (FR-012), a także wklejanie z arkusza i etapy.
- Playwright, Vitest ani żadnego nowego frameworka testowego; testem jest rozszerzony `smoke.mjs`.
- Tłumaczenie treści strony głównej `/` (`Welcome.astro`) ani komunikatów błędów zwracanych przez Supabase (`error.message`); zostają po angielsku.
- Zmiana obsługi rejestracji z potwierdzeniem email, konfiguracji produkcyjnego Supabase i rozjazdu Pages/Workers.
- Wersje robocze i historia zmian projektu, sortowanie i wyszukiwanie na liście projektów.

## Implementation Approach

Od dołu do góry: najpierw baza i typy (Faza 1), potem warstwa serwera z usługą i trasami (Faza 2), potem ekrany (Faza 3), tłumaczenie istniejących ekranów logowania (Faza 4), na końcu test smoke, który sprawdza cały przepływ na prawdziwej bazie z regułami dostępu (Faza 5). Cały dostęp do danych idzie przez jeden moduł `src/lib/services/projects.ts`, a autoryzację robią reguły w bazie, nie kod aplikacji. Formularze pozostają zwykłymi `POST` z przekierowaniem, walidacja zod działa po stronie serwera.

## Critical Implementation Details

- **Cudze projekty wyglądają jak nieistniejące.** Reguły dostępu ukrywają cudzy wiersz, więc zapytanie zwraca zero wierszy. Strony `edit` i `delete` oraz trasy zwracają w takim przypadku 404 lub komunikat „nie znaleziono", nigdy „brak dostępu", żeby nie ujawniać istnienia cudzego projektu.
- **Kolejność przy usuwaniu wybranego projektu.** Usunięcie kasuje wiersz `projects`, a klucz obcy `on delete set null` w `user_settings` czyści wybór. Kod aplikacji niczego nie czyści ręcznie; test smoke sprawdza efekt na `/dashboard`.
- **Ustawienia użytkownika przez `upsert`.** Wiersz `user_settings` powstaje przy pierwszym wyborze projektu (`insert ... on conflict (user_id) do update`), więc żadne inne miejsce nie zakłada, że wiersz już istnieje.
- **Automatyczny wybór pierwszego projektu (założenie).** Po dodaniu projektu, gdy użytkownik nie ma wybranego, nowy projekt staje się wybrany, żeby `/dashboard` nie zaczynał od pustego stanu po pierwszej akcji.

## Faza 1: Baza danych i typy

### Overview

Tworzy tabele `projects` i `user_settings` z regułami dostępu, typy w aplikacji oraz bezpośrednią zależność `zod`. Po tej fazie baza przyjmuje i chroni dane, a aplikacja jeszcze z niej nie korzysta.

### Changes Required:

#### 1. Migracja bazy

**File**: `supabase/migrations/20260924120000_create_projects_and_user_settings.sql`

**Intent**: Utworzyć tabelę projektów kierownika oraz tabelę ustawień użytkownika z zapisem wybranego projektu, z włączonymi regułami dostępu i osobną polityką dla każdej operacji i roli, zgodnie z konwencją z CLAUDE.md.

**Contract**:
- `projects`: `id uuid` klucz główny z `gen_random_uuid()`; `owner_id uuid not null default auth.uid()` z kluczem obcym do `auth.users(id) on delete cascade`; `name text not null` z ograniczeniem długości po obcięciu białych znaków 1..100; `description text null` do 1000 znaków; `created_at`, `updated_at` typu `timestamptz` z `now()`. Unikalny indeks na `(owner_id, lower(btrim(name)))`. Wyzwalacz aktualizujący `updated_at` (funkcja z ustawionym `search_path`).
- `user_settings`: `user_id uuid` klucz główny z `default auth.uid()` i kluczem obcym do `auth.users(id) on delete cascade`; `selected_project_id uuid null` z kluczem obcym do `projects(id) on delete set null`.
- RLS włączone na obu tabelach. `projects`: osobne polityki `select`, `insert`, `update`, `delete` dla roli `authenticated` z warunkiem `owner_id = (select auth.uid())` (przy `insert` i `update` także `with check`). Dla roli `anon` brak polityk.
- `user_settings`: polityki `select`, `insert`, `update` dla `authenticated` z warunkiem `user_id = (select auth.uid())`; brak polityki `delete` (wiersz znika kaskadowo z użytkownikiem). Przy `insert` i `update` dodatkowe `with check`, że wybrany projekt należy do użytkownika:

```sql
with check (
  user_id = (select auth.uid())
  and (
    selected_project_id is null
    or exists (
      select 1 from public.projects p
      where p.id = selected_project_id and p.owner_id = (select auth.uid())
    )
  )
)
```

#### 2. Typy współdzielone

**File**: `src/types.ts` (nowy)

**Intent**: Dodać wspólne typy bazy i DTO projektu w jednym miejscu, zgodnie z konwencją „shared types" z CLAUDE.md, bo ESLint w trybie ścisłym wymaga typowanych zapytań.

**Contract**: Typ `Database` opisujący `public.Tables.projects` i `public.Tables.user_settings` (`Row`, `Insert`, `Update`, `Relationships`) w postaci wymaganej przez `@supabase/supabase-js`; eksportowane `Project` (`id`, `name`, `description`, `created_at`, `updated_at`) i `ProjectInput` (`name`, `description`). Typy są pisane ręcznie, bo generowanie wymaga uruchomionego Dockera.

#### 3. Typowany klient

**File**: `src/lib/supabase.ts`

**Intent**: Przekazać typ `Database` do `createServerClient`, żeby zapytania w usłudze projektów były typowane.

**Contract**: `createServerClient<Database>(SUPABASE_URL, SUPABASE_KEY, ...)`; sygnatura `createClient(requestHeaders, cookies)` i zachowanie `null` przy braku konfiguracji bez zmian.

#### 4. Zależność zod

**File**: `package.json`, `package-lock.json`

**Intent**: Dodać `zod` jako zależność bezpośrednią (wersja 4.x, już obecna w lockfile jako zależność pośrednia), bo CLAUDE.md wymaga walidacji zod, a bez wpisu w `package.json` import zależałby od przypadkowej zależności.

**Contract**: Wpis `dependencies.zod` z zakresem `^4`; instalacja przez `npm install zod`.

### Success Criteria:

#### Automated Verification:

- Migracja stosuje się na czystej bazie lokalnej: `npx supabase db reset`
- Generowanie typów Astro i sprawdzenie typów przechodzi: `npx astro sync && npx astro check`
- Lint przechodzi: `npm run lint`
- Build przechodzi: `npm run build`

#### Manual Verification:

- W lokalnym Supabase Studio (lub przez `psql`) obie tabele mają włączone RLS, a `projects` ma cztery polityki dla `authenticated`
- Dwie próby wstawienia projektu o tej samej nazwie (różna wielkość liter) tego samego użytkownika kończą się błędem unikalności

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Faza 2: Warstwa serwera

### Overview

Dodaje usługę projektów, walidację i trasy `POST` dla dodania, edycji, usunięcia i wyboru projektu, rozszerza ochronę tras i przekierowanie po logowaniu. Po tej fazie cały przepływ działa przez HTTP, jeszcze bez nowych ekranów.

### Changes Required:

#### 1. Usługa projektów

**File**: `src/lib/services/projects.ts` (nowy)

**Intent**: Zebrać cały dostęp do danych projektów i wyboru w jednym module, żeby trasy i strony nie zawierały zapytań, oraz przełożyć błędy bazy na małe, jednoznaczne wyniki.

**Contract**: Funkcje przyjmujące typowanego klienta Supabase: `listProjects`, `getProject(id)`, `createProject(input)`, `updateProject(id, input)`, `deleteProject(id)`, `getSelectedProject`, `selectProject(id)`. Wynik mutacji: `{ ok: true, data }` albo `{ ok: false, error: "duplicate_name" | "not_found" | "unexpected" }`. Kod błędu Postgres `23505` na indeksie unikalnym daje `duplicate_name`; zero wierszy zmienionych lub odczytanych (ukryte przez reguły dostępu) daje `not_found`. `createProject` po sukcesie wybiera nowy projekt, jeśli użytkownik nie ma wybranego. `selectProject` zapisuje przez `upsert` na `user_id`.

#### 2. Walidacja

**File**: `src/lib/validation/project.ts` (nowy)

**Intent**: Jedno miejsce z schematami zod dla danych formularza i identyfikatora, z polskimi komunikatami.

**Contract**: `projectInputSchema`: `name` obcięte z białych znaków, 1..100 znaków; `description` obcięte, maks. 1000, pusty ciąg zamieniany na `null`. `projectIdSchema`: `z.uuid()`. Eksportowana funkcja zwracająca pierwszy komunikat błędu jako tekst do `?error=`.

#### 3. Trasy API

**File**: `src/pages/api/projects/index.ts`, `src/pages/api/projects/[id]/index.ts`, `src/pages/api/projects/[id]/delete.ts`, `src/pages/api/projects/[id]/select.ts` (nowe)

**Intent**: Cztery trasy `POST` w stylu tras logowania: czytają `formData`, walidują zod, wołają usługę i przekierowują; każda obsługuje brak konfiguracji Supabase jak `signin.ts:10-12` i eksportuje `const prerender = false` zgodnie z CLAUDE.md.

**Contract**:
- `POST /api/projects` tworzy; sukces → `/projects`; błąd walidacji lub `duplicate_name` → `/projects/new?error=<komunikat>`.
- `POST /api/projects/[id]` edytuje; sukces → `/projects`; błąd → `/projects/[id]/edit?error=<komunikat>`; `not_found` → `/projects?error=<komunikat>`.
- `POST /api/projects/[id]/delete` usuwa; sukces → `/projects`; `not_found` → `/projects?error=<komunikat>`.
- `POST /api/projects/[id]/select` wybiera; sukces → `/dashboard`; `not_found` → `/projects?error=<komunikat>`.
- Niepoprawny `id` (nie uuid) traktowany jak `not_found`. Użytkownik pochodzi z `context.locals.user`; brak → przekierowanie na `/auth/signin`.

#### 4. Ochrona tras

**File**: `src/middleware.ts`

**Intent**: Objąć nowe adresy ochroną logowania.

**Contract**: `PROTECTED_ROUTES` = `["/dashboard", "/projects", "/api/projects"]`; reszta logiki bez zmian.

#### 5. Przekierowanie po logowaniu

**File**: `src/pages/api/auth/signin.ts`

**Intent**: Kierować zalogowanego kierownika prosto na listę projektów zamiast na stronę główną.

**Contract**: `context.redirect("/projects")` w miejscu `signin.ts:19`; komunikaty błędów bez zmian (tłumaczy je Faza 4).

### Success Criteria:

#### Automated Verification:

- Sprawdzenie typów przechodzi: `npx astro check`
- Lint przechodzi: `npm run lint`
- Build przechodzi: `npm run build`

#### Manual Verification:

- Bez logowania `curl -i -X POST http://localhost:4321/api/projects` odsyła 302 na `/auth/signin`
- Po zalogowaniu (ciasteczko z przeglądarki) `POST /api/projects` z poprawnymi danymi tworzy wiersz widoczny w Studio z właściwym `owner_id`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Faza 3: Ekrany projektów po polsku

### Overview

Dodaje strony listy, dodania, edycji i potwierdzenia usunięcia oraz przerabia `/dashboard` na szkielet roboczy pokazujący wybrany projekt. Po tej fazie kierownik przechodzi cały przepływ w przeglądarce.

### Changes Required:

#### 1. Lista projektów

**File**: `src/pages/projects/index.astro` (nowy)

**Intent**: Pokazać projekty zalogowanego kierownika z oznaczeniem wybranego oraz akcjami wyboru, edycji i usunięcia, z pustym stanem i komunikatem z `?error=`.

**Contract**: Strona w układzie `bg-cosmic` jak `dashboard.astro`. Dane z `listProjects` i `getSelectedProject`; wybór to formularz `POST /api/projects/[id]/select`, edycja i usunięcie to linki do `/projects/[id]/edit` i `/projects/[id]/delete`, link „Nowy projekt" do `/projects/new`.

#### 2. Formularz projektu

**File**: `src/components/projects/ProjectForm.tsx` (nowy), `src/pages/projects/new.astro` (nowy), `src/pages/projects/[id]/edit.astro` (nowy)

**Intent**: Jeden formularz React używany do dodania i edycji, z walidacją po stronie przeglądarki w stylu `SignInForm.tsx` i pełnym `POST` do trasy serwera; strona edycji zwraca 404, gdy projekt nie istnieje lub nie należy do użytkownika.

**Contract**: Właściwości `action`, `initial?` (`name`, `description`), `serverError?`, `submitLabel`. Pole nazwy przez istniejący `FormField`; opis jako `textarea` w tym samym stylu. Komunikaty walidacji zgodne z zod (nazwa wymagana, maks. 100; opis maks. 1000).

#### 3. Strona potwierdzenia usunięcia

**File**: `src/pages/projects/[id]/delete.astro` (nowy)

**Intent**: Wymusić wyraźne potwierdzenie usunięcia: strona z nazwą projektu i informacją o skutkach, przycisk „Usuń projekt" jako `POST /api/projects/[id]/delete` oraz link „Anuluj" do `/projects`.

**Contract**: Treść informuje, że razem z projektem zostaną usunięte jego specjalności i zadania (dotyczy przyszłych danych). 404 dla nieistniejącego lub cudzego projektu.

#### 4. Szkielet roboczy

**File**: `src/pages/dashboard.astro`

**Intent**: Pokazać nazwę i opis wybranego projektu oraz link do listy projektów; bez wybranego projektu wyświetlić stan pusty z zachętą do wyboru.

**Contract**: Dane z `getSelectedProject`; teksty po polsku; przycisk wylogowania zostaje.

#### 5. Nawigacja i układ

**File**: `src/components/Topbar.astro`, `src/layouts/Layout.astro`

**Intent**: Dodać do paska link „Projekty" i przetłumaczyć jego etykiety, ustawić `lang="pl"` i domyślny tytuł strony na „Plan projektu (WBS)".

**Contract**: Topbar: „Projekty", „Wyloguj", „Zaloguj się", „Zarejestruj się", „Niezalogowany"; link „Dashboard" zastąpiony linkiem do `/projects`. Layout: `<html lang="pl">`, `title = "Plan projektu (WBS)"`.

### Success Criteria:

#### Automated Verification:

- Sprawdzenie typów przechodzi: `npx astro check`
- Lint przechodzi: `npm run lint`
- Build przechodzi: `npm run build`

#### Manual Verification:

- Po zalogowaniu widać `/projects`; dodanie projektu, zmiana nazwy i opisu oraz wybór projektu działają, a `/dashboard` pokazuje wybrany projekt
- Dodanie drugiego projektu o tej samej nazwie (inna wielkość liter) pokazuje czytelny komunikat, dane w formularzu nie znikają
- Usunięcie przechodzi przez stronę potwierdzenia; po usunięciu wybranego projektu `/dashboard` pokazuje stan pusty
- Drugi użytkownik wpisujący adres cudzego `/projects/[id]/edit` dostaje 404
- Zwykłe akcje (zapis, wybór, usunięcie) kończą się widocznym wynikiem w czasie poniżej 1 sekundy

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Faza 4: Polskie ekrany logowania

### Overview

Tłumaczy istniejące ekrany rejestracji, logowania i potwierdzenia email na polski, żeby cały interfejs był spójny. Zmiana dotyczy tekstów, nie zachowania.

### Changes Required:

#### 1. Formularze logowania i rejestracji

**File**: `src/components/auth/SignInForm.tsx`, `src/components/auth/SignUpForm.tsx`, `src/components/auth/PasswordToggle.tsx`

**Intent**: Przetłumaczyć etykiety, teksty zastępcze, komunikaty walidacji, tekst przycisków w stanie oczekiwania i etykiety dostępności (`aria-label`) na polski, bez zmiany logiki walidacji.

**Contract**: Podpowiedź o brakujących znakach hasła w `SignUpForm.tsx:57-63` ma poprawną polską odmianę liczebnika (1 znak, 2–4 znaki, 5 i więcej znaków); stała `MIN_PASSWORD_LENGTH` bez zmian. Etykiety przełącznika hasła: „Ukryj hasło" / „Pokaż hasło".

#### 2. Strony logowania

**File**: `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`, `src/pages/auth/confirm-email.astro`

**Intent**: Przetłumaczyć nagłówki, tytuły stron, linki i komunikaty o rejestracji na polski.

**Contract**: Tytuły „Logowanie", „Rejestracja"; dwa warianty treści potwierdzenia (`import.meta.env.DEV` w `confirm-email.astro:4`) zachowują logikę, zmienia się tylko tekst.

#### 3. Komunikaty tras logowania

**File**: `src/pages/api/auth/signin.ts`, `src/pages/api/auth/signup.ts`

**Intent**: Przetłumaczyć lokalny komunikat „Supabase is not configured"; komunikaty zwracane przez Supabase (`error.message`) zostają bez zmian.

**Contract**: „Supabase nie jest skonfigurowany" w obu trasach.

### Success Criteria:

#### Automated Verification:

- Lint przechodzi: `npm run lint`
- Sprawdzenie typów przechodzi: `npx astro check`
- Build przechodzi: `npm run build`

#### Manual Verification:

- Ekrany logowania, rejestracji i potwierdzenia wyświetlają się po polsku, a walidacja pokazuje polskie komunikaty
- Podpowiedź o brakujących znakach hasła ma poprawną odmianę dla 1, 2 i 5 brakujących znaków

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Faza 5: Test smoke i weryfikacja

### Overview

Rozszerza `scripts/smoke.mjs` o cały przepływ projektów z dwoma użytkownikami, żeby test z perspektywy użytkownika sprawdzał także reguły dostępu na prawdziwej bazie w CI.

### Changes Required:

#### 1. Sesje i asercje na treści

**File**: `scripts/smoke.mjs`

**Intent**: Umożliwić dwóch niezależnych użytkowników w jednym przebiegu i sprawdzanie treści odpowiedzi, bo dziś skrypt ma jedną wspólną sesję i patrzy tylko na status i nagłówek `Location`.

**Contract**: Fabryka sesji z własnym słownikiem ciasteczek; `request` zwraca też `body` (tekst); kroki mogą deklarować `bodyIncludes` i `bodyExcludes`. Tylko globale dozwolone w konfiguracji ESLint dla skryptów (`console`, `process`, `fetch`, `URLSearchParams`).

#### 2. Kroki przepływu projektów

**File**: `scripts/smoke.mjs`

**Intent**: Dodać kroki pokrywające FR-001..003 z perspektywy użytkownika, a istniejący krok logowania dostosować do nowego celu przekierowania.

**Contract**: Istniejący krok „signin accepts correct password" oczekuje `Location` `/projects` (dziś `/`, `smoke.mjs:54`). Nowe kroki: niezalogowany `GET /projects` i `POST /api/projects` przekierowują na `/auth/signin`; użytkownik A dodaje projekt; dodanie projektu o tej samej nazwie w innej wielkości liter daje przekierowanie z `?error=`; lista zawiera nazwę; identyfikator projektu wyciągnięty z linku `/projects/<uuid>/edit` w treści listy; edycja zmienia nazwę; wybór przekierowuje na `/dashboard`, a dashboard zawiera nazwę; użytkownik B (nowe konto) dostaje 404 na `/projects/<id>/edit` i `/projects/<id>/delete` oraz przekierowanie z `?error=` przy próbie `POST /api/projects/<id>/delete`, a lista B nie zawiera projektu A; A widzi stronę potwierdzenia usunięcia (200), usuwa projekt, lista A go nie zawiera, a dashboard A pokazuje stan pusty.

### Success Criteria:

#### Automated Verification:

- Lint przechodzi (w tym `scripts/`): `npm run lint`
- Build przechodzi: `npm run build`
- Smoke przechodzi na lokalnym Supabase i serwerze podglądu: `npm run smoke`
- CI (`ci` i `smoke`) zielone na gałęzi z tą zmianą

#### Manual Verification:

- Ręczny przebieg z przeglądarki zgadza się z krokami smoke (dodanie, edycja, wybór, usunięcie po potwierdzeniu)
- Migracja jest zastosowana w docelowej bazie Supabase przed wdrożeniem kodu (`npx supabase db push`)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- Brak nowego frameworka testowego w tej zmianie (decyzja: rozszerzony smoke). Logika zod i mapowanie błędów usługi są objęte krokami smoke.

### Integration Tests:

- `npm run smoke` na lokalnym Supabase: pełny przepływ dwóch użytkowników (dodanie, unikalność nazwy, edycja, wybór, izolacja danych, usunięcie po potwierdzeniu, czyszczenie wyboru).

### Manual Testing Steps:

1. Zarejestruj konto i zaloguj się; sprawdź przekierowanie na `/projects`.
2. Dodaj projekt z opisem i bez opisu; spróbuj dodać projekt o tej samej nazwie inną wielkością liter.
3. Edytuj projekt, wybierz go i sprawdź `/dashboard`.
4. Usuń wybrany projekt przez stronę potwierdzenia; sprawdź stan pusty na `/dashboard`.
5. Na drugim koncie wejdź w adres cudzego projektu i sprawdź 404.

## Performance Considerations

Zwykłe akcje muszą kończyć się widocznym wynikiem poniżej 1 sekundy (NFR z PRD). Lista i szkielet roboczy używają pojedynczych zapytań na żądanie; przy garstce użytkowników i kilkudziesięciu projektach nie potrzeba stronicowania ani indeksów poza kluczami i indeksem unikalności.

## Migration Notes

- Migracja jest nowa (`supabase/migrations/` dotąd nie istniało); `supabase start` i `supabase db reset` stosują ją lokalnie, a job `smoke` w CI startuje bazę z migracjami.
- Produkcyjną bazę trzeba zaktualizować ręcznie (`npx supabase db push`) **przed** wdrożeniem kodu; job `deploy` w CI tego nie robi, a wdrożenie kodu bez migracji zepsuje `/projects`.
- Istniejące konta użytkowników pozostają bez zmian; wiersze `user_settings` powstają przy pierwszym wyborze projektu.

## References

- PRD: `context/foundation/prd.md` (FR-001, FR-002, FR-003, sekcje Access Control i Non-Functional Requirements)
- Stos: `context/foundation/tech-stack.md`
- Wzorzec tras: `src/pages/api/auth/signin.ts:13-19`
- Wzorzec formularza: `src/components/auth/SignInForm.tsx:43-85`
- Middleware: `src/middleware.ts:4-25`
- Smoke test: `scripts/smoke.mjs:38-59`
- CI: `.github/workflows/ci.yml:27-55`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Baza danych i typy

#### Automated

- [x] 1.1 Migracja stosuje się na czystej bazie lokalnej: `npx supabase db reset` — e144395
- [x] 1.2 Generowanie typów Astro i sprawdzenie typów przechodzi: `npx astro sync && npx astro check` — e144395
- [x] 1.3 Lint przechodzi: `npm run lint` — e144395
- [x] 1.4 Build przechodzi: `npm run build` — e144395

#### Manual

- [x] 1.5 W lokalnym Supabase Studio (lub przez `psql`) obie tabele mają włączone RLS, a `projects` ma cztery polityki dla `authenticated` — e144395
- [x] 1.6 Dwie próby wstawienia projektu o tej samej nazwie (różna wielkość liter) tego samego użytkownika kończą się błędem unikalności — e144395

### Phase 2: Warstwa serwera

#### Automated

- [x] 2.1 Sprawdzenie typów przechodzi: `npx astro check` — c7a163d
- [x] 2.2 Lint przechodzi: `npm run lint` — c7a163d
- [x] 2.3 Build przechodzi: `npm run build` — c7a163d

#### Manual

- [x] 2.4 Bez logowania `curl -i -X POST http://localhost:4321/api/projects` odsyła 302 na `/auth/signin` — c7a163d
- [x] 2.5 Po zalogowaniu (ciasteczko z przeglądarki) `POST /api/projects` z poprawnymi danymi tworzy wiersz widoczny w Studio z właściwym `owner_id` — c7a163d

### Phase 3: Ekrany projektów po polsku

#### Automated

- [x] 3.1 Sprawdzenie typów przechodzi: `npx astro check` — 19d400d
- [x] 3.2 Lint przechodzi: `npm run lint` — 19d400d
- [x] 3.3 Build przechodzi: `npm run build` — 19d400d

#### Manual

- [x] 3.4 Po zalogowaniu widać `/projects`; dodanie projektu, zmiana nazwy i opisu oraz wybór projektu działają, a `/dashboard` pokazuje wybrany projekt — 19d400d
- [x] 3.5 Dodanie drugiego projektu o tej samej nazwie (inna wielkość liter) pokazuje czytelny komunikat, dane w formularzu nie znikają — 19d400d
- [x] 3.6 Usunięcie przechodzi przez stronę potwierdzenia; po usunięciu wybranego projektu `/dashboard` pokazuje stan pusty — 19d400d
- [x] 3.7 Drugi użytkownik wpisujący adres cudzego `/projects/[id]/edit` dostaje 404 — 19d400d
- [x] 3.8 Zwykłe akcje (zapis, wybór, usunięcie) kończą się widocznym wynikiem w czasie poniżej 1 sekundy — 19d400d

### Phase 4: Polskie ekrany logowania

#### Automated

- [x] 4.1 Lint przechodzi: `npm run lint`
- [x] 4.2 Sprawdzenie typów przechodzi: `npx astro check`
- [x] 4.3 Build przechodzi: `npm run build`

#### Manual

- [x] 4.4 Ekrany logowania, rejestracji i potwierdzenia wyświetlają się po polsku, a walidacja pokazuje polskie komunikaty
- [x] 4.5 Podpowiedź o brakujących znakach hasła ma poprawną odmianę dla 1, 2 i 5 brakujących znaków

### Phase 5: Test smoke i weryfikacja

#### Automated

- [ ] 5.1 Lint przechodzi (w tym `scripts/`): `npm run lint`
- [ ] 5.2 Build przechodzi: `npm run build`
- [ ] 5.3 Smoke przechodzi na lokalnym Supabase i serwerze podglądu: `npm run smoke`
- [ ] 5.4 CI (`ci` i `smoke`) zielone na gałęzi z tą zmianą

#### Manual

- [ ] 5.5 Ręczny przebieg z przeglądarki zgadza się z krokami smoke (dodanie, edycja, wybór, usunięcie po potwierdzeniu)
- [ ] 5.6 Migracja jest zastosowana w docelowej bazie Supabase przed wdrożeniem kodu (`npx supabase db push`)
