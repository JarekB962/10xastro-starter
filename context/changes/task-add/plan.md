# Dodawanie zadania — Implementation Plan

## Overview

Wycinek S-02 z mapy drogowej (kamień milowy M-1), wymaganie FR-006 z `context/foundation/prd.md` (część „dodawanie"): kierownik projektu na stronie `/tasks` dodaje zadanie do wybranego projektu i widzi listę zadań projektu. Zadanie ma numer (liczba całkowita od 1, unikalna w projekcie), nazwę (do 100 znaków), opcjonalną specjalność z listy projektu, opcjonalny nakład (liczba, bez jednostki) oraz poprzedników wpisywanych jako numery zadań. Poprawa zadania (S-03), usuwanie (S-04) i sprawdzanie spójności (FR-008, 009, 011) są poza tym wycinkiem.

## Current State Analysis

- **Wzorzec do powtórzenia istnieje** (zmiana `project-specialties`): migracja z RLS przez właściciela projektu (`supabase/migrations/20260925120000_create_specialties.sql`), usługa `{ok,data}|{ok,error}` (`src/lib/services/specialties.ts`), walidacja zod (`src/lib/validation/specialty.ts`), trasa `POST` z przekierowaniem i `?error=` (`src/pages/api/specialties/index.ts`), formularz React (`src/components/specialties/SpecialtyForm.tsx`), strona listy (`src/pages/specialties/index.astro`), smoke z dwoma użytkownikami (`scripts/smoke.mjs`).
- **Wybrany projekt** jest znany po stronie serwera: `getSelectedProjectId` / `getSelectedProject` (`src/lib/services/projects.ts`). Formularz nie niesie identyfikatora projektu.
- **Mapowanie błędów bazy**: `fail` i `toError` w `src/lib/services/db-errors.ts` (23505 → `duplicate_name`, 23503/42501 → `not_found`, przy `creating` → `unexpected`). Zadania potrzebują dwóch nowych kodów (`duplicate_number`, `invalid_specialty`).
- **Kod przekierowania po wyborze projektu**: `src/pages/api/projects/[id]/select.ts:21` zna tylko `after_select=specialties`.
- **Ochrona tras**: `PROTECTED_ROUTES` w `src/middleware.ts`.
- **Brak** tabel zadań i poprzedników, typów, usługi, tras, stron oraz elementu `<select>` w formularzach (`FormField` obsługuje `type`, więc pola tekstowe i liczbowe nie wymagają zmian).
- Tabela `specialties` istnieje; nie ma usuwania specjalności (FR-005, zaparkowane), więc `on delete restrict` z zadań przygotowuje ten wycinek na przyszłość.

## Desired End State

Zalogowany kierownik z wybranym projektem wchodzi na `/tasks` (z dashboardu lub z listy projektów przez „Zadania"), widzi zadania projektu posortowane po numerze (numer, nazwa, specjalność, nakład, poprzednicy) i dodaje nowe. Zadanie z zajętym numerem, z samym sobą jako poprzednikiem albo z niepoprawnym nakładem jest odrzucone czytelnym komunikatem, a wpisane wartości zostają w formularzu. Zadanie można zapisać bez specjalności i bez nakładu. Poprzednik o numerze, którego nie ma w projekcie, zapisuje się i jest wypisany na liście bez ostrzeżenia. Inny użytkownik nie widzi cudzych zadań. Weryfikacja: `npm run smoke` przechodzi z nowymi krokami, a `npm run lint`, `npx astro check` i `npm run build` są zielone.

### Key Discoveries:

- **Specjalność zadania musi należeć do tego samego projektu.** RLS sam tego nie zapewni (użytkownik widzi specjalności wszystkich swoich projektów), więc potrzebny jest złożony klucz obcy `(specialty_id, project_id)` → `specialties (id, project_id)`, a do niego unikalne ograniczenie `specialties (id, project_id)`. Przy `specialty_id is null` klucz się nie sprawdza (MATCH SIMPLE), więc pole opcjonalne działa.
- **Zadanie i jego poprzednicy muszą zapisać się razem.** Dwa osobne wywołania mogłyby zostawić zadanie bez poprzedników po błędzie, a nie ma polityki `delete` do sprzątania. Dlatego dodanie idzie przez jedną funkcję bazy w jednej transakcji (`security invoker`, więc RLS działa jak zwykle).
- **Poprzednik to numer, nie klucz obcy** (PRD: numer może jeszcze nie istnieć), więc `task_predecessors.predecessor_number` nie ma klucza do `tasks`. Blokada „samego siebie" wymaga porównania z numerem zadania, dlatego robi ją wyzwalacz w bazie oprócz walidacji w aplikacji.
- Wzorzec RLS: `exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))`; dla `task_predecessors` własność przechodzi przez `tasks` do `projects`.
- `Database` w `src/types.ts` trzeba rozszerzyć ręcznie (tabele, relacje potrzebne do zagnieżdżonego `select` i `Functions` dla funkcji `create_task`).
- Pola formularzy mają jednoznaczne nazwy, żeby przeglądarka nie podpowiadała danych osobowych: `task_number`, `task_name`, `task_specialty`, `task_effort`, `task_predecessors`.

## What We're NOT Doing

- Poprawa zadania (S-03), w tym przenumerowanie z automatyczną aktualizacją poprzedników (FR-007).
- Usuwanie zadania (S-04) i specjalności (FR-005).
- Sprawdzanie spójności: cykle, nieistniejący poprzednik, brak odpowiedzialności, duplikaty nazw (FR-008, 009, 011). Lista pokazuje dane tak, jak wpisano, bez oznaczania braków.
- Jednostka nakładu (godziny/osobodni) i jakiekolwiek jej etykiety; nakład to liczba bez jednostki.
- Osobne pole opisu zadania, kolejność ręczna, sortowanie i wyszukiwanie (lista rosnąco po numerze), stronicowanie.
- Import zadań z pliku, dodawanie wielu zadań naraz.
- Nowy framework testowy (testem jest rozszerzony `scripts/smoke.mjs`).

## Implementation Approach

Od dołu do góry, jak w `project-specialties`: baza i typy (Faza 1), serwer i ekrany razem (Faza 2), smoke i weryfikacja (Faza 3). Cały dostęp do danych idzie przez jeden moduł `src/lib/services/tasks.ts`, autoryzację robią reguły w bazie. Formularz to zwykłe `POST` z przekierowaniem; walidacja zod działa po stronie serwera, błędy wracają w `?error=` z zachowaniem wpisanych wartości. Dodanie zadania woła funkcję bazy `create_task` przez `rpc`.

## Critical Implementation Details

- **Dodanie zadania to jedna transakcja.** Funkcja `public.create_task(...)` wstawia wiersz `tasks` i wiersze `task_predecessors`; błąd któregokolwiek wycofuje całość. Musi być `security invoker` (nie `definer`), żeby RLS nadal decydował o dostępie.
- **Kody błędów bazy dla zadań mają inne znaczenie niż dla specjalności.** `23505` przy dodaniu zadania oznacza zajęty numer w projekcie (`duplicate_number`), a `23503` oznacza specjalność spoza projektu lub nieistniejącą (`invalid_specialty`); wyzwalacz blokady samego siebie rzuca `23514` (`check_violation`), który aplikacja traktuje jak błąd walidacji tej samej treści co zod. Zwykłe mapowanie z `db-errors.ts` (`duplicate_name`, `not_found`) do tego nie pasuje.
- **Numer zadania i nakład wchodzą jako tekst.** Przecinek dziesiętny w nakładzie („2,5") jest akceptowany i zamieniany na kropkę przed zapisem; numer musi być cyframi (bez znaku, spacji wewnątrz, notacji naukowej).

## Phase 1: Baza danych i typy

### Overview

Tworzy tabele `tasks` i `task_predecessors` z regułami dostępu, funkcję `create_task`, wyzwalacz blokujący wskazanie samego siebie oraz typy w aplikacji. Po tej fazie baza przyjmuje i chroni dane, a aplikacja jeszcze z nich nie korzysta.

### Changes Required:

#### 1. Migracja bazy

**File**: `supabase/migrations/20260926120000_create_tasks.sql`

**Intent**: Utworzyć zadania należące do projektu z unikalnym numerem w projekcie, opcjonalną specjalnością z tego samego projektu, opcjonalnym nakładem i osobną tabelę poprzedników, z regułami dostępu zależnymi od właściciela projektu (konwencja „RLS z osobną polityką na operację i rolę" z CLAUDE.md).

**Contract**:
- `alter table public.specialties add constraint specialties_id_project_key unique (id, project_id)` (cel złożonego klucza obcego).
- `tasks`: `id uuid` klucz główny z `gen_random_uuid()`; `project_id uuid not null` → `projects(id) on delete cascade`; `number integer not null` z `check (number >= 1)`; `name text not null` z `check (char_length(btrim(name)) between 1 and 100)`; `specialty_id uuid null`; `effort numeric(10,2) null` z `check (effort >= 0)`; `created_at`, `updated_at` z `now()`. Złożony klucz obcy `(specialty_id, project_id)` → `specialties (id, project_id)` z `on delete restrict`. Unikalny indeks `(project_id, number)` (pierwsza kolumna pokrywa też zapytania po `project_id`). Wyzwalacz `updated_at` przez istniejącą `public.set_updated_at()`.
- `task_predecessors`: `task_id uuid not null` → `tasks(id) on delete cascade`; `predecessor_number integer not null` z `check (predecessor_number >= 1)`; klucz główny `(task_id, predecessor_number)`. Bez klucza do `tasks` po numerze.
- Wyzwalacz `before insert or update` na `task_predecessors`: jeśli `predecessor_number` równa się `number` zadania `task_id`, rzuć wyjątek z kodem `check_violation` i komunikatem „Zadanie nie może być własnym poprzednikiem.".
- Funkcja `public.create_task(p_project_id uuid, p_number integer, p_name text, p_specialty_id uuid, p_effort numeric, p_predecessors integer[])` zwracająca wiersz `tasks`, `language plpgsql`, `security invoker`, ustawione `search_path`: wstawia zadanie, potem po jednym wierszu `task_predecessors` na element tablicy (`p_predecessors` może być pusta lub `null`).
- RLS włączone na obu tabelach. `tasks`: osobne polityki `select`, `insert`, `update` dla `authenticated` z warunkiem własności projektu (`using`/`with check`, jak w `specialties`); brak `delete` (kaskada z projektu; usuwanie zadania to S-04) i brak polityk dla `anon`. `task_predecessors`: polityki `select` i `insert` dla `authenticated`, z warunkiem `exists (select 1 from public.tasks t join public.projects p on p.id = t.project_id where t.id = task_id and p.owner_id = (select auth.uid()))`; `update` i `delete` dochodzą w S-03. `grant execute` na funkcji tylko dla `authenticated`.

#### 2. Typy współdzielone

**File**: `src/types.ts`

**Intent**: Dodać tabele i funkcję do `Database` oraz typy DTO zadania obok typów projektu i specjalności (konwencja „shared types" z CLAUDE.md); rozszerzyć kody błędów usług.

**Contract**: `Database["public"]["Tables"]["tasks"]` i `["task_predecessors"]` z `Row`/`Insert`/`Update` i `Relationships` (klucz do `projects`, złożony do `specialties`, `task_predecessors` → `tasks`); `Functions["create_task"]` z argumentami i wynikiem. Eksportowane: `Task` (`id`, `number`, `name`, `effort`, `specialty` (nazwa lub `null`), `predecessors` jako `number[]`, `created_at`, `updated_at`), `TaskInput` (`number`, `name`, `specialtyId: string | null`, `effort: number | null`, `predecessors: number[]`), `ParsedTaskInput` (jak `ParsedSpecialtyInput`). `ServiceError` rozszerzone o `"duplicate_number"` i `"invalid_specialty"`; istniejące mapy komunikatów projektów i specjalności (`Record<ServiceError, string>`) uzupełnione o te klucze albo zawężone do swoich podzbiorów, tak by `astro check` przechodziło.

### Success Criteria:

#### Automated Verification:

- Migracja stosuje się na czystej bazie lokalnej: `npx supabase db reset`
- Generowanie typów Astro i sprawdzenie typów przechodzi: `npx astro sync && npx astro check`
- Lint przechodzi: `npm run lint`
- Build przechodzi: `npm run build`

#### Manual Verification:

- W lokalnym Supabase (przez `psql`) obie tabele mają włączone RLS i polityki tylko dla `authenticated`, a `tasks` nie ma polityki `delete`
- Dwa zadania z tym samym numerem w jednym projekcie kończą się błędem unikalności, a w dwóch różnych projektach są dozwolone
- Zadanie ze specjalnością z innego projektu kończy się błędem klucza obcego; zadanie bez specjalności zapisuje się
- Poprzednik równy numerowi zadania jest odrzucony przez wyzwalacz; `create_task` z błędnym poprzednikiem nie zostawia zadania w tabeli
- Usunięcie projektu usuwa jego zadania i poprzedników (kaskada)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Warstwa serwera i ekrany

### Overview

Dodaje walidację, usługę zadań, trasę `POST /api/tasks`, stronę `/tasks` z formularzem i listą oraz linki w nawigacji. Po tej fazie kierownik przechodzi cały przepływ dodawania zadania w przeglądarce.

### Changes Required:

#### 1. Walidacja

**File**: `src/lib/validation/task.ts` (nowy)

**Intent**: Jedno miejsce ze schematami zod dla danych formularza zadania z polskimi komunikatami.

**Contract**: `parseTaskInput(form)` czyta pola `task_number`, `task_name`, `task_specialty`, `task_effort`, `task_predecessors` i zwraca `ParsedTaskInput` (pierwszy komunikat błędu jako tekst do `?error=`). Reguły: numer — wymagany, cyfry, `1..2147483647` („Numer zadania jest wymagany." / „Numer zadania musi być liczbą całkowitą od 1."); nazwa — obcięta, 1..100 znaków („Nazwa zadania jest wymagana." / „Nazwa zadania może mieć najwyżej 100 znaków."); specjalność — pusta → `null`, w przeciwnym razie uuid; nakład — pusty → `null`, w przeciwnym razie liczba `>= 0` z najwyżej dwoma miejscami po przecinku i wartością do `99999999.99`, przecinek zamieniany na kropkę („Nakład musi być liczbą nie mniejszą niż 0."); poprzednicy — lista rozdzielona przecinkami, elementy obcięte, każdy jak numer zadania, powtórzenia scalane, najwyżej 50 („Poprzednicy to numery zadań rozdzielone przecinkami." / „Zadanie nie może być własnym poprzednikiem."). Testowy przypadek graniczny: „3, 3, 5" daje `[3, 5]`, a „2," daje błąd elementu pustego.

#### 2. Usługa zadań

**File**: `src/lib/services/tasks.ts` (nowy), `src/lib/services/db-errors.ts`

**Intent**: Zebrać cały dostęp do danych zadań w jednym module i przełożyć błędy bazy na małe, jednoznaczne wyniki, jak w usłudze specjalności.

**Contract**: `listTasks(db, projectId)` — zadania projektu rosnąco po `number`, z nazwą specjalności i listą poprzedników rosnąco (zagnieżdżony `select`); `createTask(db, projectId, input)` — woła `rpc("create_task", ...)`. Wynik `{ ok: true, data }` albo `{ ok: false, error }`, gdzie `23505` → `duplicate_number`, `23503` → `invalid_specialty`, `23514` → `unexpected` z komunikatem walidacji „Zadanie nie może być własnym poprzednikiem." (normalnie przechwyci go zod; wyzwalacz to druga linia obrony), `42501` → `not_found`; pozostałe → `unexpected` z logiem przez `fail`. `db-errors.ts` dostaje wariant `fail` (lub parametr) pozwalający usłudze zadań podać własne mapowanie kodów. Eksportuje `TASK_ERROR_MESSAGES` („Zadanie o takim numerze już istnieje.", „Wybrana specjalność nie istnieje w tym projekcie.", „Nie znaleziono projektu.", „Coś poszło nie tak. Spróbuj ponownie."), `NO_PROJECT_SELECTED_MESSAGE` (jak w specjalnościach) i `formValues(form)` odsyłające pięć pól (każde do 200 znaków) razem z błędem.

#### 3. Trasa API i ochrona tras

**File**: `src/pages/api/tasks/index.ts` (nowy), `src/middleware.ts`

**Intent**: Trasa `POST` w stylu trasy specjalności: `requireSupabase`, `readForm`, walidacja zod, projekt z `getSelectedProjectId`, wywołanie usługi, przekierowanie; `export const prerender = false` zgodnie z CLAUDE.md.

**Contract**: `POST /api/tasks` → sukces `/tasks`; błąd walidacji, `duplicate_number`, `invalid_specialty` lub brak wybranego projektu → `/tasks?error=<komunikat>` z pięcioma polami w adresie (`task_number`, `task_name`, `task_specialty`, `task_effort`, `task_predecessors`). `PROTECTED_ROUTES` uzupełnione o `"/tasks"` i `"/api/tasks"`.

#### 4. Formularz i strona zadań

**File**: `src/components/tasks/TaskForm.tsx` (nowy), `src/pages/tasks/index.astro` (nowy)

**Intent**: Formularz React z walidacją po stronie przeglądarki w stylu `SpecialtyForm.tsx` i lista zadań wybranego projektu z pustymi stanami.

**Contract**: `TaskForm` przyjmuje `action`, `specialties` (`{ id, name }[]`), `initial?` (pięć wartości), `serverError?`, `submitLabel`. Pola: numer (`FormField`, `type="text"`, `inputMode="numeric"`, `autoFocus`), nazwa, specjalność (natywny `<select name="task_specialty">` z pierwszą opcją „Bez specjalności", stylowany jak `FormField`), nakład (tekst, podpowiedź „np. 2,5"), poprzednicy (tekst, podpowiedź „numery zadań po przecinku, np. 1, 2"); wszystkie `autoComplete="off"`; komunikaty walidacji zgodne z zod. `src/pages/tasks/index.astro` (układ `bg-cosmic` jak `src/pages/specialties/index.astro`): bez wybranego projektu „Nie wybrano projektu" z linkiem do `/projects`; wybrany projekt — formularz, a pod nim lista wierszy z numerem, nazwą, specjalnością (lub „—"), nakładem (lub „—") i poprzednikami (numery po przecinku lub „—"); pusty projekt: „Ten projekt nie ma jeszcze zadań. Dodaj pierwsze."; gdy projekt nie ma specjalności, przy polu specjalności link „Dodaj specjalności" do `/specialties`. Błąd wczytania: „Nie udało się wczytać zadań.". Wartości z `?task_*=` wracają do pól po błędzie.

#### 5. Nawigacja

**File**: `src/pages/dashboard.astro`, `src/pages/projects/index.astro`, `src/pages/api/projects/[id]/select.ts`

**Intent**: Umożliwić dojście do zadań z dashboardu i z listy projektów, tak jak dla specjalności.

**Contract**: dashboard: przy wybranym projekcie link „Zadania projektu" do `/tasks`; lista projektów: przy każdym projekcie przycisk „Zadania" z ukrytym `after_select=tasks` (obok „Specjalności", „Edytuj", „Usuń"); trasa wyboru mapuje `after_select` przez whitelistę `{ specialties: "/specialties", tasks: "/tasks" }`, a każda inna wartość lub brak pola daje `/dashboard`.

### Success Criteria:

#### Automated Verification:

- Sprawdzenie typów przechodzi: `npx astro check`
- Lint przechodzi: `npm run lint`
- Build przechodzi: `npm run build`

#### Manual Verification:

- Bez logowania `curl -i -X POST http://localhost:4321/api/tasks` odsyła 302 na `/auth/signin`
- Bez wybranego projektu `/tasks` pokazuje „Nie wybrano projektu" z linkiem do listy projektów
- Po wyborze projektu (przycisk „Zadania" przy projekcie) dodanie zadania z numerem, nazwą, specjalnością, nakładem i poprzednikami działa, a wiersz jest na liście w kolejności numerów
- Zadanie tylko z numerem i nazwą zapisuje się (specjalność i nakład puste), a lista pokazuje „—"
- Zajęty numer, poprzednik równy własnemu numerowi i nakład „abc" pokazują czytelne komunikaty, a wpisane wartości zostają w formularzu
- Poprzednik o nieistniejącym numerze (np. 99) zapisuje się i jest widoczny na liście
- Kursor jest od razu w polu numeru, a zwykłe akcje (zapis) kończą się widocznym wynikiem w czasie poniżej 1 sekundy

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Test smoke i weryfikacja

### Overview

Rozszerza `scripts/smoke.mjs` o przepływ dodawania zadań z dwoma użytkownikami, żeby test z perspektywy użytkownika sprawdzał także reguły dostępu i zapis poprzedników na prawdziwej bazie w CI.

### Changes Required:

#### 1. Kroki przepływu zadań

**File**: `scripts/smoke.mjs`

**Intent**: Dodać kroki pokrywające FR-006 (dodawanie) z perspektywy użytkownika, wkomponowane w istniejący przepływ (użytkownik A z wybranym projektem i specjalnością, użytkownik B bez wyboru).

**Contract**: Nowe kroki: niezalogowany `GET /tasks` i `POST /api/tasks` przekierowują na `/auth/signin`; A po wyborze projektu dodaje zadanie z numerem, nazwą, specjalnością, nakładem „2,5" i poprzednikami „2, 2, 99" (przekierowanie `/tasks`); lista zawiera nazwę zadania i poprzedników „2, 99" oraz nakład; dodanie tego samego numeru daje przekierowanie z `?error=` i zachowanym `task_name`; poprzednik równy własnemu numerowi i nakład „abc" dają przekierowanie z `?error=`; zadanie tylko z numerem i nazwą zapisuje się; B (bez wybranego projektu) widzi na `/tasks` „Nie wybrano projektu" i dostaje przekierowanie z `?error=` przy `POST /api/tasks`, a nazwy zadań A nie występują w jego odpowiedzi; `POST /api/projects/<id>/select` z `after_select=tasks` przekierowuje na `/tasks`, a z nieznaną wartością na `/dashboard`. Kroki A wstaw po dodaniu specjalności i przed usunięciem projektu. Tylko globale dozwolone w konfiguracji ESLint dla skryptów.

### Success Criteria:

#### Automated Verification:

- Lint przechodzi (w tym `scripts/`): `npm run lint`
- Build przechodzi: `npm run build`
- Smoke przechodzi na lokalnym Supabase i serwerze podglądu: `npm run smoke`
- CI (`ci` i `smoke`) zielone na gałęzi z tą zmianą

#### Manual Verification:

- Ręczny przebieg z przeglądarki zgadza się z krokami smoke (dodanie, zajęty numer, poprzednicy, izolacja między kontami)
- Po usunięciu projektu jego zadania i poprzednicy znikają z bazy: `select count(*) from tasks where project_id = '<usunięty projekt>'` daje 0
- Migracja jest zastosowana w docelowej bazie Supabase przed wdrożeniem kodu (`npx supabase db push`)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- Brak nowego frameworka testowego (decyzja jak w `mvp-rel-01` i `project-specialties`: rozszerzony smoke). Logika zod (przypadki: „3, 3, 5", „2,", „1,5" w nakładzie, numer „0" i „1e3") i mapowanie błędów usługi są objęte krokami smoke i ręcznymi sprawdzeniami w `psql`.

### Integration Tests:

- `npm run smoke` na lokalnym Supabase: dodanie zadania z poprzednikami, zajęty numer, blokada samego siebie, pola opcjonalne, izolacja danych między użytkownikami, pusty stan bez wybranego projektu, przekierowanie `after_select=tasks`.

### Manual Testing Steps:

1. Zaloguj się, wybierz projekt przez „Zadania" i dodaj specjalność w `/specialties`.
2. Na `/tasks` dodaj zadanie ze wszystkimi polami, potem zadanie tylko z numerem i nazwą.
3. Spróbuj zapisać zajęty numer, poprzednika równego numerowi zadania i nakład „abc".
4. Dodaj poprzednika o nieistniejącym numerze i sprawdź, że widać go na liście.
5. Na drugim koncie sprawdź pusty stan i brak cudzych zadań.
6. Usuń projekt i sprawdź w bazie, że jego zadania zniknęły.

## Performance Considerations

Zwykłe akcje mają kończyć się widocznym wynikiem poniżej 1 sekundy (NFR z PRD). Lista zadań to jedno zapytanie po `project_id` z zagnieżdżonymi poprzednikami i nazwą specjalności, pokryte indeksem `(project_id, number)`; przy kilkudziesięciu zadaniach nie potrzeba stronicowania. Dodanie zadania to jedno wywołanie `rpc`.

## Migration Notes

- Migracja jest nowa i zależna od `projects`, `specialties` oraz `public.set_updated_at()`; dodaje unikalne ograniczenie do istniejącej tabeli `specialties` (dane nie wymagają zmian, bo `id` jest już unikalne). `supabase start` i `supabase db reset` stosują ją lokalnie, a job `smoke` w CI startuje bazę z migracjami.
- Produkcyjną bazę trzeba zaktualizować ręcznie (`npx supabase db push`) **przed** wdrożeniem kodu; job `deploy` tego nie robi, a kod bez migracji zepsuje tylko nowe strony `/tasks`.
- S-03 (poprawa zadania) musi dodać polityki `update`/`delete` dla `task_predecessors` oraz sprawdzenie, że zmiana numeru zadania nie zrówna go z jednym z jego poprzedników (wyzwalacz z Fazy 1 pilnuje tylko zapisu poprzednika).
- Istniejące dane nie wymagają zmian.

## References

- Roadmap: `context/foundation/roadmap.md` (S-02, `task-add`)
- PRD: `context/foundation/prd.md` (FR-006, FR-008 jako poza zakresem, US-01, NFR)
- Poprzedni wycinek: `context/archive/2026-09-25-project-specialties/plan.md`
- Wzorzec migracji: `supabase/migrations/20260925120000_create_specialties.sql`
- Wzorzec usługi i błędów: `src/lib/services/specialties.ts`, `src/lib/services/db-errors.ts`
- Wzorzec trasy: `src/pages/api/specialties/index.ts`
- Wzorzec formularza i strony: `src/components/specialties/SpecialtyForm.tsx`, `src/pages/specialties/index.astro`
- Trasa wyboru projektu: `src/pages/api/projects/[id]/select.ts`
- Smoke test: `scripts/smoke.mjs`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Baza danych i typy

#### Automated

- [x] 1.1 Migracja stosuje się na czystej bazie lokalnej: `npx supabase db reset` — 60c9565
- [x] 1.2 Generowanie typów Astro i sprawdzenie typów przechodzi: `npx astro sync && npx astro check` — 60c9565
- [x] 1.3 Lint przechodzi: `npm run lint` — 60c9565
- [x] 1.4 Build przechodzi: `npm run build` — 60c9565

#### Manual

- [x] 1.5 W lokalnym Supabase (przez `psql`) obie tabele mają włączone RLS i polityki tylko dla `authenticated`, a `tasks` nie ma polityki `delete` — 60c9565
- [x] 1.6 Dwa zadania z tym samym numerem w jednym projekcie kończą się błędem unikalności, a w dwóch różnych projektach są dozwolone — 60c9565
- [x] 1.7 Zadanie ze specjalnością z innego projektu kończy się błędem klucza obcego; zadanie bez specjalności zapisuje się — 60c9565
- [x] 1.8 Poprzednik równy numerowi zadania jest odrzucony przez wyzwalacz; `create_task` z błędnym poprzednikiem nie zostawia zadania w tabeli — 60c9565
- [x] 1.9 Usunięcie projektu usuwa jego zadania i poprzedników (kaskada) — 60c9565

### Phase 2: Warstwa serwera i ekrany

#### Automated

- [x] 2.1 Sprawdzenie typów przechodzi: `npx astro check`
- [x] 2.2 Lint przechodzi: `npm run lint`
- [x] 2.3 Build przechodzi: `npm run build`

#### Manual

- [x] 2.4 Bez logowania `curl -i -X POST http://localhost:4321/api/tasks` odsyła 302 na `/auth/signin`
- [x] 2.5 Bez wybranego projektu `/tasks` pokazuje „Nie wybrano projektu" z linkiem do listy projektów
- [x] 2.6 Po wyborze projektu (przycisk „Zadania" przy projekcie) dodanie zadania z numerem, nazwą, specjalnością, nakładem i poprzednikami działa, a wiersz jest na liście w kolejności numerów
- [x] 2.7 Zadanie tylko z numerem i nazwą zapisuje się (specjalność i nakład puste), a lista pokazuje „—"
- [x] 2.8 Zajęty numer, poprzednik równy własnemu numerowi i nakład „abc" pokazują czytelne komunikaty, a wpisane wartości zostają w formularzu
- [x] 2.9 Poprzednik o nieistniejącym numerze (np. 99) zapisuje się i jest widoczny na liście
- [x] 2.10 Kursor jest od razu w polu numeru, a zwykłe akcje (zapis) kończą się widocznym wynikiem w czasie poniżej 1 sekundy

### Phase 3: Test smoke i weryfikacja

#### Automated

- [ ] 3.1 Lint przechodzi (w tym `scripts/`): `npm run lint`
- [ ] 3.2 Build przechodzi: `npm run build`
- [ ] 3.3 Smoke przechodzi na lokalnym Supabase i serwerze podglądu: `npm run smoke`
- [ ] 3.4 CI (`ci` i `smoke`) zielone na gałęzi z tą zmianą

#### Manual

- [ ] 3.5 Ręczny przebieg z przeglądarki zgadza się z krokami smoke (dodanie, zajęty numer, poprzednicy, izolacja między kontami)
- [ ] 3.6 Po usunięciu projektu jego zadania i poprzednicy znikają z bazy: `select count(*) from tasks where project_id = '<usunięty projekt>'` daje 0
- [ ] 3.7 Migracja jest zastosowana w docelowej bazie Supabase przed wdrożeniem kodu (`npx supabase db push`)
