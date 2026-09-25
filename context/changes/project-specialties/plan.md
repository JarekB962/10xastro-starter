# Specjalności wykonawców w projekcie — Implementation Plan

## Overview

Wycinek S-01 z mapy drogowej (kamień milowy M-1), wymaganie FR-004 z `context/foundation/prd.md`: kierownik projektu na stronie `/specialties` dodaje i edytuje specjalności wykonawców w wybranym projekcie. Specjalność to sama nazwa (do 100 znaków), unikalna w projekcie bez rozróżniania wielkości liter. Dane trafiają do nowej tabeli powiązanej z projektem, a dostęp egzekwują reguły w bazie. Usuwanie specjalności (FR-005) jest zaparkowane; zadania (S-02, S-03) korzystają z tej tabeli później.

## Current State Analysis

- **Wzorzec do powtórzenia istnieje.** Migracja projektów z RLS i osobnymi politykami na operację (`supabase/migrations/20260924120000_create_projects_and_user_settings.sql:36-88`), usługa z wynikami `ok`/kod błędu (`src/lib/services/projects.ts:58-140`), walidacja zod (`src/lib/validation/project.ts`), trasy `POST` ze strażnikami (`src/lib/services/project-routes.ts`), formularz React (`src/components/projects/ProjectForm.tsx`), strony listy i edycji (`src/pages/projects/`), smoke z dwoma użytkownikami (`scripts/smoke.mjs`).
- **Unikalność nazwy** projektu to indeks `(owner_id, lower(btrim(name)))` (`…sql:14`); funkcja `public.set_updated_at()` (`…sql:16-25`) i wyzwalacz są gotowe do ponownego użycia.
- **Wybrany projekt** jest znany po stronie serwera: `getSelectedProjectId` (`src/lib/services/projects.ts:72-77`), `getSelectedProject` (`:79-87`).
- **Mapowanie błędów bazy** (`toError`, `fail`, `projects.ts:32-56`) jest prywatne dla projektów; specjalności potrzebują tego samego.
- **Ochrona tras** w `src/middleware.ts` (`PROTECTED_ROUTES`) obejmuje dziś `/dashboard`, `/projects`, `/api/projects`.
- **Nawigacja**: pasek `src/components/Topbar.astro:10` ma link „Projekty”; dashboard (`src/pages/dashboard.astro`) pokazuje wybrany projekt.
- **Brak** tabeli specjalności, typów, usługi, tras i stron.

## Desired End State

Zalogowany kierownik z wybranym projektem wchodzi na `/specialties` (link „Specjalności” w pasku u góry i na dashboardzie), widzi specjalności tego projektu, dodaje nową i poprawia istniejącą. Druga specjalność o tej samej nazwie (inna wielkość liter) w tym samym projekcie jest odrzucona czytelnym komunikatem, a wpisana wartość zostaje w formularzu. Bez wybranego projektu strona pokazuje pusty stan z odesłaniem do listy projektów. Inny użytkownik nie widzi ani nie modyfikuje cudzych specjalności (bezpośredni adres kończy się 404). Weryfikacja: `npm run smoke` przechodzi z nowymi krokami, a `npm run lint`, `npx astro check` i `npm run build` są zielone.

### Key Discoveries:

- Reguły dostępu muszą sprawdzać właściciela **projektu**, nie własne pole właściciela: `exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))` — wzorzec jak w politykach `user_settings` (`…sql:63-88`).
- Kaskadowe usuwanie przy skasowaniu projektu (FR-002) załatwia klucz obcy `on delete cascade`; akcje referencyjne pomijają RLS, więc nie jest potrzebna polityka `delete` (tak samo jak w `user_settings`, `…sql:57`).
- `createClient` zwraca `null` bez konfiguracji; `requireSupabase` (`project-routes.ts`) już to obsługuje dla tras `/api/*`.
- ESLint `strictTypeChecked` wymaga typowanych zapytań, więc `Database` w `src/types.ts` trzeba rozszerzyć ręcznie o nową tabelę (generowanie typów wymaga Dockera).
- Pola formularzy mają jednoznaczne nazwy (`project_name`), żeby przeglądarka nie podpowiadała danych osobowych; specjalność używa `specialty_name`.

## What We're NOT Doing

- Usuwanie specjalności i blokada usunięcia, gdy jest używana w zadaniach (FR-005, zaparkowane).
- Zadania i pole „specjalność” w zadaniu (S-02, S-03).
- Opis specjalności i inne pola poza nazwą; własna kolejność, sortowanie i wyszukiwanie (lista alfabetycznie).
- Osobne traktowanie „zleceniodawcy” (to zwykła specjalność).
- Zmiana wyboru projektu z poziomu strony specjalności (wybór zostaje na liście projektów).
- Nowy framework testowy (testem jest rozszerzony `scripts/smoke.mjs`).
- Zmiany w sprawdzaniu spójności (FR-008, 009, 011).

## Implementation Approach

Od dołu do góry, jak w `mvp-rel-01`: baza i typy (Faza 1), warstwa serwera (Faza 2), ekrany (Faza 3), smoke i weryfikacja (Faza 4). Cały dostęp do danych idzie przez jeden moduł `src/lib/services/specialties.ts`, autoryzację robią reguły w bazie. Formularze to zwykłe `POST` z przekierowaniem, walidacja zod działa po stronie serwera, a błędy wracają w `?error=` z zachowaniem wpisanej wartości. Wspólne pomocniki błędów bazy wyciągamy z `projects.ts`, żeby nie kopiować logiki.

## Critical Implementation Details

- **Projekt pochodzi z wyboru po stronie serwera, nie z formularza.** Trasa dodawania czyta `getSelectedProjectId`; formularz nie niesie identyfikatora projektu. Jeśli wybór się zmieni między otwarciem strony a wysłaniem formularza, specjalność trafi do aktualnie wybranego projektu (akceptowalne; nie ujawnia cudzych danych, bo i tak działa RLS).
- **Błąd klucza obcego lub RLS przy dodawaniu to „nie znaleziono", nie „niespodziewany".** Dla projektów `creating` mapuje 23503/42501 na błąd niespodziewany, bo nie ma czego szukać. Dla specjalności ten sam kod oznacza, że wybrany projekt zniknął lub nie należy do użytkownika, więc mapujemy go na `not_found` (wywołanie bez flagi `creating`).

## Phase 1: Baza danych, typy i wspólne pomocniki błędów

### Overview

Tworzy tabelę `specialties` z regułami dostępu, typy w aplikacji oraz wspólny moduł błędów bazy. Po tej fazie baza przyjmuje i chroni dane, a aplikacja jeszcze z nich nie korzysta.

### Changes Required:

#### 1. Migracja bazy

**File**: `supabase/migrations/20260925120000_create_specialties.sql`

**Intent**: Utworzyć tabelę specjalności należących do projektu, z unikalną nazwą w projekcie, kaskadowym usuwaniem z projektem i regułami dostępu zależnymi od właściciela projektu, zgodnie z konwencją „RLS z osobną polityką na operację i rolę” z CLAUDE.md.

**Contract**:
- `specialties`: `id uuid` klucz główny z `gen_random_uuid()`; `project_id uuid not null` z kluczem obcym do `public.projects(id) on delete cascade`; `name text not null` z ograniczeniem długości po obcięciu białych znaków 1..100; `created_at`, `updated_at` typu `timestamptz` z `now()`. Wyzwalacz `updated_at` przez istniejącą funkcję `public.set_updated_at()`.
- Unikalny indeks `(project_id, lower(btrim(name)))`; jego pierwsza kolumna pokrywa też zapytania po `project_id`.
- RLS włączone. Osobne polityki `select`, `insert`, `update` dla roli `authenticated`; brak polityki `delete` (usuwanie tylko kaskadowo, FR-005 zaparkowane) i brak polityk dla `anon`. Wspólny warunek własności:

```sql
exists (
  select 1 from public.projects p
  where p.id = project_id and p.owner_id = (select auth.uid())
)
```

  użyty jako `using` w `select` i `update` oraz `with check` w `insert` i `update` (żeby nie dało się przenieść wiersza do cudzego projektu).

#### 2. Typy współdzielone

**File**: `src/types.ts`

**Intent**: Dodać tabelę `specialties` do typu `Database` oraz typy DTO specjalności obok typów projektu (konwencja „shared types” z CLAUDE.md).

**Contract**: `Database["public"]["Tables"]["specialties"]` z `Row` (`id`, `project_id`, `name`, `created_at`, `updated_at`), `Insert` (`project_id`, `name` wymagane), `Update`, `Relationships` (klucz obcy do `projects`). Eksportowane: `Specialty` (`id`, `name`, `created_at`, `updated_at`), `SpecialtyInput` (`name`), `ParsedSpecialtyInput` (jak `ParsedProjectInput`). Wyniki usługi ponownie używają `ProjectResult` i `ProjectError` (ten sam zestaw kodów).

#### 3. Wspólne pomocniki błędów bazy

**File**: `src/lib/services/db-errors.ts` (nowy), `src/lib/services/projects.ts`

**Intent**: Wyciągnąć z `projects.ts` mapowanie kodów Postgres na `ProjectError` i logowanie nieoczekiwanych błędów oraz typ klienta bazy, żeby usługa specjalności nie kopiowała kodu, a zachowanie projektów pozostało bez zmian.

**Contract**: `db-errors.ts` eksportuje typ `Db` (typowany klient Supabase, dziś lokalny w `projects.ts:4`) oraz `fail(scope, error, creating?)` zwracające `{ ok: false, error }`; `scope` to prefiks komunikatu w logu (`"projects"`, `"specialties"`). `projects.ts` importuje oba i nadal wystawia te same funkcje; zachowanie i komunikaty bez zmian.

### Success Criteria:

#### Automated Verification:

- Migracja stosuje się na czystej bazie lokalnej: `npx supabase db reset`
- Generowanie typów Astro i sprawdzenie typów przechodzi: `npx astro sync && npx astro check`
- Lint przechodzi: `npm run lint`
- Build przechodzi: `npm run build`

#### Manual Verification:

- W lokalnym Supabase Studio (lub przez `psql`) `specialties` ma włączone RLS oraz polityki `select`, `insert`, `update` dla `authenticated` (bez `delete`)
- Dwie specjalności o tej samej nazwie (różna wielkość liter) w jednym projekcie kończą się błędem unikalności, a w dwóch różnych projektach są dozwolone
- Usunięcie projektu usuwa jego specjalności (kaskada)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Warstwa serwera

### Overview

Dodaje walidację, usługę specjalności i trasy `POST` dodania i edycji oraz rozszerza ochronę tras. Po tej fazie cały przepływ działa przez HTTP, jeszcze bez nowych ekranów.

### Changes Required:

#### 1. Walidacja

**File**: `src/lib/validation/specialty.ts` (nowy)

**Intent**: Jedno miejsce ze schematami zod dla danych formularza specjalności i identyfikatora, z polskimi komunikatami.

**Contract**: `name` obcięte z białych znaków, 1..100 znaków, komunikaty „Nazwa specjalności jest wymagana." i „Nazwa specjalności może mieć najwyżej 100 znaków."; `parseSpecialtyInput(form)` czyta pole `specialty_name` i zwraca `ParsedSpecialtyInput` (pierwszy komunikat błędu jako tekst do `?error=`); `parseSpecialtyId(value)` zwraca uuid albo `null` (traktowany jak „nie znaleziono").

#### 2. Usługa specjalności

**File**: `src/lib/services/specialties.ts` (nowy)

**Intent**: Zebrać cały dostęp do danych specjalności w jednym module i przełożyć błędy bazy na małe, jednoznaczne wyniki, jak w usłudze projektów.

**Contract**: Funkcje przyjmujące typowanego klienta: `listSpecialties(db, projectId)` (alfabetycznie po nazwie), `getSpecialty(db, id)`, `createSpecialty(db, projectId, input)`, `updateSpecialty(db, id, input)`. Wynik: `{ ok: true, data }` albo `{ ok: false, error: "duplicate_name" | "not_found" | "unexpected" }`; `23505` daje `duplicate_name`, zero wierszy lub kody 23503/42501 daje `not_found` (wywołanie `fail` bez flagi `creating`, zob. Critical Implementation Details). Eksportuje `SPECIALTY_ERROR_MESSAGES` („Specjalność o takiej nazwie już istnieje.", „Nie znaleziono specjalności.", „Coś poszło nie tak. Spróbuj ponownie.") oraz `formValues(form)` zwracające `specialty_name` (do 200 znaków) do odesłania z błędem.

#### 3. Trasy API

**File**: `src/pages/api/specialties/index.ts`, `src/pages/api/specialties/[id]/index.ts` (nowe), `src/lib/services/specialty-routes.ts` (nowy)

**Intent**: Dwie trasy `POST` w stylu tras projektów: czytają `formData`, walidują zod, wołają usługę i przekierowują; każda obsługuje brak konfiguracji Supabase przez `requireSupabase` i eksportuje `const prerender = false` zgodnie z CLAUDE.md.

**Contract**:
- `POST /api/specialties` dodaje specjalność do **wybranego projektu** (`getSelectedProjectId`); brak wyboru → `/specialties?error=<komunikat>`; sukces → `/specialties`; błąd walidacji lub `duplicate_name` → `/specialties?error=<komunikat>&specialty_name=<wpisane>`.
- `POST /api/specialties/[id]` edytuje nazwę; sukces → `/specialties`; błąd walidacji lub `duplicate_name` → `/specialties/[id]/edit?error=<komunikat>&specialty_name=<wpisane>`; `not_found` → `/specialties?error=<komunikat>`.
- Niepoprawny `id` traktowany jak `not_found`. `specialty-routes.ts` daje `requireSpecialtyId(context)` (analogicznie do `requireProjectId`); zalogowanie egzekwuje middleware.

#### 4. Ochrona tras

**File**: `src/middleware.ts`

**Intent**: Objąć nowe adresy ochroną logowania.

**Contract**: `PROTECTED_ROUTES` = `["/dashboard", "/projects", "/api/projects", "/specialties", "/api/specialties"]`; reszta logiki bez zmian.

### Success Criteria:

#### Automated Verification:

- Sprawdzenie typów przechodzi: `npx astro check`
- Lint przechodzi: `npm run lint`
- Build przechodzi: `npm run build`

#### Manual Verification:

- Bez logowania `curl -i -X POST http://localhost:4321/api/specialties` odsyła 302 na `/auth/signin`
- Po zalogowaniu (ciasteczko z przeglądarki) `POST /api/specialties` z poprawną nazwą tworzy wiersz widoczny w Studio z `project_id` wybranego projektu

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Ekrany specjalności po polsku

### Overview

Dodaje stronę listy z formularzem dodawania, stronę edycji i linki w nawigacji. Po tej fazie kierownik przechodzi cały przepływ w przeglądarce.

### Changes Required:

#### 1. Formularz specjalności

**File**: `src/components/specialties/SpecialtyForm.tsx` (nowy)

**Intent**: Jeden formularz React używany do dodania i edycji, z walidacją po stronie przeglądarki w stylu `ProjectForm.tsx` i pełnym `POST` do trasy serwera.

**Contract**: Właściwości `action`, `initial?` (`name`), `serverError?`, `submitLabel`. Pole nazwy przez istniejący `FormField` (`id="specialty_name"`, `autoComplete="off"`, `autoFocus`); komunikaty walidacji zgodne z zod (nazwa wymagana, maks. 100 znaków).

#### 2. Lista i dodawanie

**File**: `src/pages/specialties/index.astro` (nowy)

**Intent**: Pokazać specjalności wybranego projektu wraz z formularzem dodawania, z pustymi stanami i komunikatem z `?error=`.

**Contract**: Układ `bg-cosmic` jak `src/pages/projects/index.astro`. Dane z `getSelectedProject` i `listSpecialties`. Bez wybranego projektu: komunikat „Nie wybrano projektu" z linkiem do `/projects` zamiast formularza. Wybrany projekt bez specjalności: „Ten projekt nie ma jeszcze specjalności. Dodaj pierwszą." Każdy wiersz ma link „Edytuj" do `/specialties/[id]/edit`. Wartość z `?specialty_name=` wraca do pola dodawania po błędzie. Błąd wczytania: „Nie udało się wczytać specjalności."

#### 3. Edycja

**File**: `src/pages/specialties/[id]/edit.astro` (nowy)

**Intent**: Formularz zmiany nazwy; strona zwraca 404, gdy specjalność nie istnieje lub nie należy do użytkownika (500 przy błędzie odczytu, 503 bez konfiguracji), jak strona edycji projektu.

**Contract**: Tytuł „Edycja specjalności", przycisk „Zapisz zmiany", link „Wróć do listy specjalności". Po błędzie serwera formularz wraca z wpisaną wartością z `?specialty_name=`; bez błędu z zapisaną nazwą.

#### 4. Nawigacja

**File**: `src/components/Topbar.astro`, `src/pages/dashboard.astro`

**Intent**: Umożliwić dojście do specjalności z paska i z dashboardu.

**Contract**: Topbar: link „Specjalności" do `/specialties` obok „Projekty" (dla zalogowanego). Dashboard: przy wybranym projekcie link „Specjalności projektu" do `/specialties`.

### Success Criteria:

#### Automated Verification:

- Sprawdzenie typów przechodzi: `npx astro check`
- Lint przechodzi: `npm run lint`
- Build przechodzi: `npm run build`

#### Manual Verification:

- Bez wybranego projektu `/specialties` pokazuje pusty stan z linkiem do listy projektów
- Po wyborze projektu dodanie specjalności działa, a nowa pozycja jest na liście (alfabetycznie)
- Dodanie drugiej specjalności o tej samej nazwie (inna wielkość liter) pokazuje czytelny komunikat, a wpisana wartość zostaje w formularzu
- Zmiana nazwy przez „Edytuj" działa, a kursor jest od razu w polu nazwy na stronach dodawania i edycji
- Inny użytkownik wpisujący adres cudzego `/specialties/[id]/edit` dostaje 404
- Zwykłe akcje (zapis) kończą się widocznym wynikiem w czasie poniżej 1 sekundy

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 4: Test smoke i weryfikacja

### Overview

Rozszerza `scripts/smoke.mjs` o przepływ specjalności z dwoma użytkownikami, żeby test z perspektywy użytkownika sprawdzał także reguły dostępu na prawdziwej bazie w CI.

### Changes Required:

#### 1. Kroki przepływu specjalności

**File**: `scripts/smoke.mjs`

**Intent**: Dodać kroki pokrywające FR-004 z perspektywy użytkownika, wkomponowane w istniejący przepływ (użytkownik A z wybranym projektem, użytkownik B bez wyboru).

**Contract**: Nowe kroki: niezalogowany `GET /specialties` i `POST /api/specialties` przekierowują na `/auth/signin`; użytkownik A po wyborze projektu dodaje specjalność (przekierowanie `/specialties`); dodanie tej samej nazwy w innej wielkości liter daje przekierowanie z `?error=`; lista zawiera nazwę; identyfikator wyciągnięty z linku `/specialties/<uuid>/edit`; edycja zmienia nazwę, a lista pokazuje nową; użytkownik B (bez wybranego projektu) widzi na `/specialties` „Nie wybrano projektu", dostaje przekierowanie z `?error=` przy `POST /api/specialties` i 404 na `/specialties/<id>/edit` A, a `POST /api/specialties/<id>` B kończy się przekierowaniem z `?error=`; po usunięciu projektu przez A strona edycji tej specjalności zwraca 404. Kroki A wstaw po wyborze projektu i przed jego usunięciem; kroki B po logowaniu B. Tylko globale dozwolone w konfiguracji ESLint dla skryptów.

### Success Criteria:

#### Automated Verification:

- Lint przechodzi (w tym `scripts/`): `npm run lint`
- Build przechodzi: `npm run build`
- Smoke przechodzi na lokalnym Supabase i serwerze podglądu: `npm run smoke`
- CI (`ci` i `smoke`) zielone na gałęzi z tą zmianą

#### Manual Verification:

- Ręczny przebieg z przeglądarki zgadza się z krokami smoke (dodanie, duplikat, edycja, izolacja między kontami)
- Po usunięciu projektu jego specjalności znikają z bazy: `select count(*) from specialties where project_id = '<usunięty projekt>'` daje 0
- Migracja jest zastosowana w docelowej bazie Supabase przed wdrożeniem kodu (`npx supabase db push`)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- Brak nowego frameworka testowego (decyzja jak w `mvp-rel-01`: rozszerzony smoke). Logika zod i mapowanie błędów usługi są objęte krokami smoke.

### Integration Tests:

- `npm run smoke` na lokalnym Supabase: dodanie, unikalność nazwy (inna wielkość liter), edycja, izolacja danych między użytkownikami, pusty stan bez wybranego projektu, znikanie po usunięciu projektu.

### Manual Testing Steps:

1. Zaloguj się, wybierz projekt i wejdź na `/specialties` (link w pasku).
2. Dodaj specjalność; spróbuj dodać tę samą nazwę inną wielkością liter.
3. Zmień nazwę przez „Edytuj".
4. Na drugim koncie wejdź w adres cudzej edycji i sprawdź 404; bez wybranego projektu sprawdź pusty stan.
5. Usuń projekt i sprawdź w bazie, że jego specjalności zniknęły.

## Performance Considerations

Zwykłe akcje mają kończyć się widocznym wynikiem poniżej 1 sekundy (NFR z PRD). Lista specjalności to jedno zapytanie po `project_id`, pokryte indeksem unikalności; przy kilkudziesięciu specjalnościach nie potrzeba stronicowania.

## Migration Notes

- Migracja jest nowa i zależna od tabeli `projects` oraz funkcji `set_updated_at()` z poprzedniej migracji; `supabase start` i `supabase db reset` stosują ją lokalnie, a job `smoke` w CI startuje bazę z migracjami.
- Produkcyjną bazę trzeba zaktualizować ręcznie (`npx supabase db push`) **przed** wdrożeniem kodu; job `deploy` tego nie robi, a kod bez migracji zepsuje tylko nowe strony `/specialties` (istniejące przepływy nie zależą od nowej tabeli).
- Istniejące dane nie wymagają zmian.

## References

- Roadmap: `context/foundation/roadmap.md` (S-01, `project-specialties`)
- PRD: `context/foundation/prd.md` (FR-004, FR-002, US-01, NFR)
- Wzorzec migracji: `supabase/migrations/20260924120000_create_projects_and_user_settings.sql:14-88`
- Wzorzec usługi: `src/lib/services/projects.ts:58-140`
- Wzorzec tras i strażników: `src/lib/services/project-routes.ts`, `src/pages/api/projects/index.ts`
- Wzorzec formularza: `src/components/projects/ProjectForm.tsx`
- Smoke test: `scripts/smoke.mjs`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Baza danych, typy i wspólne pomocniki błędów

#### Automated

- [x] 1.1 Migracja stosuje się na czystej bazie lokalnej: `npx supabase db reset`
- [x] 1.2 Generowanie typów Astro i sprawdzenie typów przechodzi: `npx astro sync && npx astro check`
- [x] 1.3 Lint przechodzi: `npm run lint`
- [x] 1.4 Build przechodzi: `npm run build`

#### Manual

- [x] 1.5 W lokalnym Supabase Studio (lub przez `psql`) `specialties` ma włączone RLS oraz polityki `select`, `insert`, `update` dla `authenticated` (bez `delete`)
- [x] 1.6 Dwie specjalności o tej samej nazwie (różna wielkość liter) w jednym projekcie kończą się błędem unikalności, a w dwóch różnych projektach są dozwolone
- [x] 1.7 Usunięcie projektu usuwa jego specjalności (kaskada)

### Phase 2: Warstwa serwera

#### Automated

- [ ] 2.1 Sprawdzenie typów przechodzi: `npx astro check`
- [ ] 2.2 Lint przechodzi: `npm run lint`
- [ ] 2.3 Build przechodzi: `npm run build`

#### Manual

- [ ] 2.4 Bez logowania `curl -i -X POST http://localhost:4321/api/specialties` odsyła 302 na `/auth/signin`
- [ ] 2.5 Po zalogowaniu (ciasteczko z przeglądarki) `POST /api/specialties` z poprawną nazwą tworzy wiersz widoczny w Studio z `project_id` wybranego projektu

### Phase 3: Ekrany specjalności po polsku

#### Automated

- [ ] 3.1 Sprawdzenie typów przechodzi: `npx astro check`
- [ ] 3.2 Lint przechodzi: `npm run lint`
- [ ] 3.3 Build przechodzi: `npm run build`

#### Manual

- [ ] 3.4 Bez wybranego projektu `/specialties` pokazuje pusty stan z linkiem do listy projektów
- [ ] 3.5 Po wyborze projektu dodanie specjalności działa, a nowa pozycja jest na liście (alfabetycznie)
- [ ] 3.6 Dodanie drugiej specjalności o tej samej nazwie (inna wielkość liter) pokazuje czytelny komunikat, a wpisana wartość zostaje w formularzu
- [ ] 3.7 Zmiana nazwy przez „Edytuj" działa, a kursor jest od razu w polu nazwy na stronach dodawania i edycji
- [ ] 3.8 Inny użytkownik wpisujący adres cudzego `/specialties/[id]/edit` dostaje 404
- [ ] 3.9 Zwykłe akcje (zapis) kończą się widocznym wynikiem w czasie poniżej 1 sekundy

### Phase 4: Test smoke i weryfikacja

#### Automated

- [ ] 4.1 Lint przechodzi (w tym `scripts/`): `npm run lint`
- [ ] 4.2 Build przechodzi: `npm run build`
- [ ] 4.3 Smoke przechodzi na lokalnym Supabase i serwerze podglądu: `npm run smoke`
- [ ] 4.4 CI (`ci` i `smoke`) zielone na gałęzi z tą zmianą

#### Manual

- [ ] 4.5 Ręczny przebieg z przeglądarki zgadza się z krokami smoke (dodanie, duplikat, edycja, izolacja między kontami)
- [ ] 4.6 Po usunięciu projektu jego specjalności znikają z bazy: `select count(*) from specialties where project_id = '<usunięty projekt>'` daje 0
- [ ] 4.7 Migracja jest zastosowana w docelowej bazie Supabase przed wdrożeniem kodu (`npx supabase db push`)
