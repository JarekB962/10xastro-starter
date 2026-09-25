# Poprawa zadania — Implementation Plan

## Overview

Wycinek S-03 z mapy drogowej (kamień milowy M-1), wymaganie FR-006 z `context/foundation/prd.md` (część „poprawa”): kierownik projektu na stronie `/tasks/[id]/edit` poprawia istniejące zadanie: nazwę, specjalność, nakład i poprzedników. Numer zadania jest niezmienny (pokazany tylko do odczytu) i to także w bazie. Usuwanie zadania i zmiana numeru z automatycznym poprawieniem poprzedników (FR-007) są poza wycinkiem i zaparkowane. Po tym wycinku kamień milowy M-1 jest ukończony.

## Current State Analysis

- **Wzorzec pary lista → edycja istnieje** (zmiana `project-specialties`): link „Edytuj” na liście (`src/pages/specialties/index.astro`), strona edycji z 404/500/503 (`src/pages/specialties/[id]/edit.astro`), trasa `POST` (`src/pages/api/specialties/[id]/index.ts`), strażnik id (`src/lib/services/specialty-routes.ts`), walidacja id (`src/lib/validation/specialty.ts`).
- **Zadania z S-02:** usługa `src/lib/services/tasks.ts` (`listTasks`, `createTask` przez `rpc("create_task")`, `TASK_DB_ERRORS`, `formValues`), walidacja `src/lib/validation/task.ts` i wspólne reguły pól `src/lib/validation/task-fields.ts`, formularz `src/components/tasks/TaskForm.tsx` (ma `initial`, `serverError`, `submitLabel`), strona `src/pages/tasks/index.astro`, trasa `src/pages/api/tasks/index.ts`.
- **Baza (`supabase/migrations/20260926120000_create_tasks.sql`):** `tasks` ma politykę `update` (własność projektu), złożony klucz obcy `(specialty_id, project_id)` pilnujący specjalności z tego samego projektu, unikalny `(project_id, number)`. `task_predecessors` ma polityki tylko `select` i `insert` (migracja mówi „update i delete dojdą w S-03”) i wyzwalacz blokujący własnego poprzednika przy `insert or update`.
- **Typy:** `Task` (`src/types.ts`) nie niesie `project_id` ani `specialty_id`; edycja potrzebuje obu (specjalności do listy wyboru z projektu zadania i wartość wybrana w polu).
- **Błędy:** `TaskServiceError` = `duplicate_number | invalid_specialty | not_found | unexpected`; komunikat `not_found` dla zadań to „Nie znaleziono projektu.” (z dodawania), więc edycja potrzebuje własnego „Nie znaleziono zadania.”.
- **Brak** wyzwalacza niezmienności numeru, polityki `delete` dla poprzedników, funkcji zapisu zmian, `getTask`/`updateTask`, trasy `POST /api/tasks/[id]`, strony edycji i linku „Edytuj” przy zadaniu.

## Desired End State

Na `/tasks` każde zadanie ma link „Edytuj”. Strona `/tasks/[id]/edit` pokazuje „Zadanie nr N” (numer tylko do odczytu) i formularz z aktualną nazwą, specjalnością, nakładem i poprzednikami; specjalności w liście wyboru pochodzą z projektu zadania. Zapis zmienia nazwę, specjalność (także na „Bez specjalności”), nakład (także na pusty) i całą listę poprzedników (także na pustą) w jednej transakcji i wraca na `/tasks`. Poprzednik równy numerowi zadania, zły nakład i pusta nazwa są odrzucone czytelnym komunikatem, a wpisane wartości zostają w formularzu. Próba przesłania innego numeru jest ignorowana, a zmiana `number` bezpośrednio w bazie jest odrzucana. Cudze lub nieistniejące zadanie daje 404. Weryfikacja: `npm run smoke` przechodzi z nowymi krokami, a `npm run lint`, `npx astro check` i `npm run build` są zielone.

### Key Discoveries:

- **Zamiana poprzedników jest usunięciem i wstawieniem, więc `task_predecessors` potrzebuje polityki `delete`** (polityki `update` nie potrzeba: wiersz to sam klucz `(task_id, predecessor_number)`). Zapis idzie przez funkcję `update_task` w jednej transakcji (`security invoker`, jak `create_task`), żeby błąd przy wstawianiu nie zostawił zadania bez poprzedników.
- **Niezmienność numeru w bazie:** polityka `update` na `tasks` dopuszcza dowolne kolumny, więc wyzwalacz `before update` odrzucający zmianę `number` chroni przed wiszącymi poprzednikami także przy zapisie prosto przez API Supabase. FR-007 będzie musiał ten wyzwalacz zdjąć albo obejść.
- **Numer do sprawdzenia „własnego poprzednika” pochodzi z zadania w bazie, nie z formularza.** Formularz edycji nie niesie `task_number`, więc trasa najpierw wczytuje zadanie (co daje też 404 dla cudzego), a dopiero potem waliduje poprzedników.
- **Specjalności na liście wyboru pochodzą z `project_id` zadania**, nie z wybranego projektu; wybór projektu może się zmienić, a złożony klucz obcy i tak odrzuciłby specjalność z innego projektu.
- **Wspólne reguły pól** (`task-fields.ts`) obsługują już nazwę, nakład i poprzedników; edycja ich używa bez kopiowania (wniosek z przeglądu `task-add`, F1).
- Pola formularza zachowują nazwy z S-02 (`task_name`, `task_specialty`, `task_effort`, `task_predecessors`), żeby przeglądarka nie podpowiadała danych osobowych.

## What We're NOT Doing

- Zmiana numeru zadania i przenumerowanie poprzedników (FR-007, zaparkowane); numer jest niezmienny.
- Usuwanie zadania i specjalności (FR-007, FR-005).
- Sprawdzanie spójności: cykle, nieistniejący poprzednik, brak odpowiedzialności, duplikaty (FR-008, 009, 011).
- Wykrywanie równoczesnej edycji (blokada optymistyczna): zapis nadpisuje, ostatni wygrywa; aplikacja jest jednoosobowa (udostępnianie to zaparkowane FR-010).
- Przenoszenie zadania do innego projektu i zmiana `project_id`.
- Nowy framework testowy (testem jest rozszerzony `scripts/smoke.mjs`).

## Implementation Approach

Od dołu do góry, jak w `task-add`: baza i typy (Faza 1), potem serwer, ekrany i smoke razem (Faza 2). Zapis zmian idzie jedną funkcją bazy `update_task` (wywołaną przez `rpc`), autoryzację robią reguły w bazie. Trasa `POST /api/tasks/[id]` wczytuje zadanie, waliduje pola (numer bierze z zadania), woła `updateTask` i przekierowuje. Formularz `TaskForm` dostaje tryb edycji (numer tylko do odczytu, bez pola `task_number`), a walidacja pól korzysta ze wspólnych reguł.

## Critical Implementation Details

- **Kody błędów bazy przy edycji:** funkcja `update_task` rzuca `P0002` (`no_data_found`), gdy zadanie nie istnieje albo RLS je ukrywa; usługa mapuje to na `not_found`. `23503` (złożony klucz specjalności) mapuje się na `invalid_specialty`, a `23514` (wyzwalacz niezmienności numeru) to błąd niespodziewany, bo aplikacja numeru nie wysyła.
- **Wymiana poprzedników bez zmiany zadania też przechodzi przez funkcję:** nawet gdy zmienia się tylko lista poprzedników, `update_task` aktualizuje `tasks` (odświeża `updated_at`), potem usuwa i wstawia poprzedników (`select distinct`, jak w `create_task`).
- **Komunikat „Nie znaleziono zadania.”** dla edycji i osobny od „Nie znaleziono projektu.” z dodawania, więc usługa eksportuje oba.

## Phase 1: Baza danych i typy

### Overview

Dodaje regułę niezmienności numeru, polityki i funkcję zapisu poprawki oraz rozszerza typy zadania. Po tej fazie baza przyjmuje i chroni poprawki, a aplikacja jeszcze z nich nie korzysta.

### Changes Required:

#### 1. Migracja bazy

**File**: `supabase/migrations/20260927120000_update_task.sql`

**Intent**: Umożliwić bezpieczną poprawę zadania: zablokować zmianę numeru, pozwolić właścicielowi usuwać poprzedników swoich zadań i dać funkcję zapisującą zmiany w jednej transakcji (konwencja „RLS z osobną polityką na operację i rolę” z CLAUDE.md).

**Contract**:
- Wyzwalacz `before update` na `public.tasks` (dla wierszy, gdzie `old.number is distinct from new.number`): rzuca wyjątek z kodem `check_violation` i komunikatem „Numer zadania jest niezmienny.”; funkcja wyzwalacza z pustym `search_path`, `security invoker`.
- Polityka `delete` na `public.task_predecessors` dla roli `authenticated` z tym samym warunkiem własności co `select`/`insert` (`exists` przez `tasks` do `projects`); bez polityk dla `anon`.
- Funkcja `public.update_task(p_id uuid, p_name text, p_specialty_id uuid, p_effort numeric, p_predecessors integer[])` zwracająca wiersz `tasks`, `language plpgsql`, `security invoker`, ustawiony `search_path`: aktualizuje `name`, `specialty_id`, `effort` zadania `p_id` (`returning * into`); gdy zadania nie ma (`not found`), rzuca wyjątek z kodem `P0002`; potem usuwa wszystkich poprzedników zadania i wstawia `distinct` elementy `p_predecessors` (tablica pusta lub `null` daje zero wierszy). `revoke execute … from public, anon`, `grant execute … to authenticated`.

#### 2. Typy współdzielone

**File**: `src/types.ts`

**Intent**: Dodać funkcję do `Database` i rozszerzyć DTO zadania o pola potrzebne edycji.

**Contract**: `Database["public"]["Functions"]["update_task"]` z argumentami (`p_id`, `p_name`, `p_specialty_id`, `p_effort`, `p_predecessors`) i wynikiem wiersza `tasks`. `Task` dostaje `project_id: string` i `specialty_id: string | null` (obok istniejącej nazwy specjalności `specialty`). Nowe typy `TaskUpdateInput` (`name`, `specialtyId: string | null`, `effort: number | null`, `predecessors: number[]`) i `ParsedTaskUpdateInput` (jak `ParsedTaskInput`).

### Success Criteria:

#### Automated Verification:

- Migracja stosuje się na czystej bazie lokalnej: `npx supabase db reset`
- Generowanie typów Astro i sprawdzenie typów przechodzi: `npx astro sync && npx astro check`
- Lint przechodzi: `npm run lint`
- Build przechodzi: `npm run build`

#### Manual Verification:

- W lokalnym Supabase (przez `psql`) `task_predecessors` ma politykę `delete` dla `authenticated`, a `tasks` nadal nie ma polityki `delete`
- `update tasks set number = number + 1` na istniejącym zadaniu kończy się błędem „Numer zadania jest niezmienny.”, a zmiana samej nazwy przechodzi
- `update_task` zmienia nazwę, specjalność, nakład i zastępuje poprzedników jedną transakcją; z pustą tablicą czyści poprzedników; z poprzednikiem równym numerowi zadania kończy się błędem i nie zmienia ani zadania, ani poprzedników
- `update_task` dla cudzego lub nieistniejącego zadania kończy się błędem `P0002`; specjalność z innego projektu kończy się błędem klucza obcego

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Serwer, ekrany i smoke

### Overview

Dodaje walidację poprawki, `getTask` i `updateTask`, trasę `POST /api/tasks/[id]`, stronę edycji, link „Edytuj” na liście zadań i kroki smoke. Po tej fazie kierownik poprawia zadanie w przeglądarce, a test z perspektywy użytkownika sprawdza to na prawdziwej bazie w CI.

### Changes Required:

#### 1. Walidacja

**File**: `src/lib/validation/task.ts`

**Intent**: Dodać walidację pól poprawki bez numeru oraz identyfikatora zadania, ponownie używając wspólnych reguł z `task-fields.ts`.

**Contract**: `parseTaskUpdateInput(form, taskNumber)` czyta `task_name`, `task_specialty`, `task_effort`, `task_predecessors` (kolejność sprawdzania i komunikaty jak w `parseTaskInput`; pole `task_number`, jeśli jest w formularzu, jest ignorowane) i zwraca `ParsedTaskUpdateInput`; `taskNumber` służy do odrzucenia „Zadanie nie może być własnym poprzednikiem.”. `parseTaskInput` i `parseTaskUpdateInput` dzielą kod schematów pól (bez powielania). `parseTaskId(value)` zwraca uuid albo `null` (traktowany jak „nie znaleziono”).

#### 2. Usługa zadań

**File**: `src/lib/services/tasks.ts`, `src/lib/services/task-routes.ts` (nowy)

**Intent**: Dodać odczyt jednego zadania i zapis poprawki oraz strażnik id trasy, jak dla specjalności.

**Contract**: `TASK_SELECT` i `listTasks` niosą `project_id` i `specialty_id` w `Task`. `getTask(db, id)` zwraca `Task` z poprzednikami i nazwą specjalności albo `not_found` (jak `getSpecialty`, `maybeSingle`). `updateTask(db, id, input)` woła `rpc("update_task", …)` i zwraca `{ ok: true, data: { id } }` albo błąd: `P0002` → `not_found`, `23503` → `invalid_specialty`, `42501` → `not_found`, reszta → `unexpected` z logiem. Nowe eksporty: `TASK_NOT_FOUND_MESSAGE` („Nie znaleziono zadania.”). `task-routes.ts` daje `requireTaskId(context)` (analogicznie do `requireSpecialtyId`; niepoprawny uuid przekierowuje na `/tasks?error=…`).

#### 3. Trasa API

**File**: `src/pages/api/tasks/[id]/index.ts` (nowy)

**Intent**: Trasa `POST` w stylu trasy edycji specjalności: `requireSupabase`, `requireTaskId`, `readForm`, wczytanie zadania, walidacja z numerem z zadania, `updateTask`, przekierowanie; `export const prerender = false`.

**Contract**: `POST /api/tasks/[id]` → sukces `/tasks`; zadanie nieznalezione lub cudze (`getTask`/`updateTask` zwraca `not_found`) → `/tasks?error=Nie znaleziono zadania.`; błąd walidacji lub `invalid_specialty` → `/tasks/[id]/edit?error=<komunikat>` z czterema polami w adresie (`task_name`, `task_specialty`, `task_effort`, `task_predecessors`). Numer z formularza nie jest używany. Ochrona logowania działa przez istniejący prefiks `/api/tasks` w `PROTECTED_ROUTES` (do potwierdzenia w kodzie middleware: dopasowanie po prefiksie).

#### 4. Formularz i strona edycji

**File**: `src/components/tasks/TaskForm.tsx`, `src/pages/tasks/[id]/edit.astro` (nowy)

**Intent**: Użyć jednego formularza do dodania i poprawki; strona edycji jak `src/pages/specialties/[id]/edit.astro` (404 dla nieznanego lub cudzego, 500 przy błędzie odczytu, 503 bez konfiguracji).

**Contract**: `TaskForm` dostaje opcjonalny `fixedNumber?: number`: gdy jest ustawiony, zamiast pola numeru pokazuje wiersz „Numer zadania: N” (bez `task_number` w formularzu, bez `autoFocus` na numerze), a fokus trafia w pole nazwy; walidacja „własnego poprzednika” używa `fixedNumber`. Strona edycji: tytuł „Edycja zadania”, przycisk „Zapisz zmiany”, link „Wróć do listy zadań”; specjalności do listy wyboru z `listSpecialties(db, task.project_id)`; `initial` z `?task_*=` po błędzie, a bez błędu z zapisanych wartości zadania (poprzednicy jako „1, 2”, nakład jako tekst lub pusty).

#### 5. Link „Edytuj” na liście

**File**: `src/pages/tasks/index.astro`

**Intent**: Umożliwić dojście do edycji z listy, w stylu linku „Edytuj” ze specjalności.

**Contract**: w każdym wierszu zadania link „Edytuj” do `/tasks/<id>/edit`.

#### 6. Kroki smoke

**File**: `scripts/smoke.mjs`

**Intent**: Dodać kroki pokrywające poprawę zadania z perspektywy użytkownika, wkomponowane w istniejący przepływ (A z zadaniami, B bez wyboru).

**Contract**: niezalogowany `GET /tasks/<uuid>/edit` i `POST /api/tasks/<uuid>` przekierowują na `/auth/signin`; A wyciąga id zadania z linku „Edytuj” na `/tasks`, otwiera stronę edycji (200, zawiera aktualną nazwę i „Zadanie nr 1”), poprawia zadanie (nowa nazwa, „Bez specjalności”, nakład „7”, poprzednicy „3”, przy okazji przesyła `task_number=99`) i dostaje przekierowanie na `/tasks`; lista pokazuje nową nazwę, brak specjalności i poprzednika „3”, nadal numer 1 i nie zawiera `99.`; poprawka z poprzednikiem równym numerowi zadania, ze złym nakładem i z pustą nazwą dają przekierowanie na stronę edycji z `?error=` i zachowanym `task_name`; B dostaje 404 na stronie edycji zadania A, a `POST /api/tasks/<id>` B kończy się przekierowaniem z `?error=`; po usunięciu projektu przez A strona edycji tego zadania zwraca 404. Kroki A wstaw po krokach zadań, przed usunięciem projektu; kroki B po krokach B dla zadań. Użyj opcji `locationIncludes` do sprawdzania komunikatów (jak w krokach `task-add`).

### Success Criteria:

#### Automated Verification:

- Sprawdzenie typów przechodzi: `npx astro check`
- Lint przechodzi (w tym `scripts/`): `npm run lint`
- Build przechodzi: `npm run build`
- Smoke przechodzi na lokalnym Supabase i serwerze podglądu: `npm run smoke`
- CI (`ci` i `smoke`) zielone na gałęzi z tą zmianą

#### Manual Verification:

- Na `/tasks` każde zadanie ma link „Edytuj”, a strona edycji pokazuje numer tylko do odczytu i aktualne wartości pól
- Zmiana nazwy, specjalności (także na „Bez specjalności”), nakładu (także na pusty) i poprzedników (także na pustych) działa, a lista pokazuje nowe wartości po powrocie
- Poprzednik równy numerowi zadania, nakład „abc” i pusta nazwa pokazują czytelne komunikaty, a wpisane wartości zostają w formularzu
- Inny użytkownik wpisujący adres cudzej edycji zadania dostaje 404
- Kursor jest od razu w polu nazwy, a zapis kończy się widocznym wynikiem w czasie poniżej 1 sekundy
- Migracja jest zastosowana w docelowej bazie Supabase przed wdrożeniem kodu (`npx supabase db push`)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- Brak nowego frameworka testowego (decyzja jak w poprzednich zmianach: rozszerzony smoke). Logika walidacji (numer z zadania, „własny poprzednik”, puste pola jako `null`/`[]`) i mapowanie błędów usługi są objęte krokami smoke i sprawdzeniami w `psql`.

### Integration Tests:

- `npm run smoke` na lokalnym Supabase: poprawa zadania (nazwa, specjalność, nakład, poprzednicy), zignorowanie próby zmiany numeru, błędy walidacji z zachowaniem wartości, izolacja użytkowników, 404 po usunięciu projektu.

### Manual Testing Steps:

1. Zaloguj się, wybierz projekt i wejdź na `/tasks`; kliknij „Edytuj” przy zadaniu.
2. Zmień nazwę, specjalność na „Bez specjalności”, nakład na pusty i poprzedników na inny zestaw; zapisz i sprawdź listę.
3. Spróbuj zapisać poprzednika równego numerowi zadania, nakład „abc” i pustą nazwę.
4. Na drugim koncie wejdź w adres cudzej edycji zadania i sprawdź 404.
5. W `psql` spróbuj `update tasks set number = number + 1` i sprawdź błąd niezmienności.

## Performance Considerations

Zwykłe akcje mają kończyć się widocznym wynikiem poniżej 1 sekundy (NFR z PRD). Poprawa to jedno wywołanie `rpc`, a strona edycji to dwa zapytania (zadanie i specjalności projektu), oba po kluczach z indeksami.

## Migration Notes

- Migracja jest nowa i zależna od `tasks`, `task_predecessors` z migracji `20260926120000`. `supabase start` i `supabase db reset` stosują ją lokalnie, a job `smoke` w CI startuje bazę z migracjami.
- Produkcyjną bazę trzeba zaktualizować ręcznie (`npx supabase db push`) **przed** wdrożeniem kodu; job `deploy` tego nie robi, a kod bez migracji zepsuje tylko edycję zadań.
- Wyzwalacz niezmienności numeru będzie musiał zostać zdjęty lub obejściem zastąpiony przez FR-007 (zmiana numeru z przenumerowaniem poprzedników).
- Istniejące dane nie wymagają zmian.

## References

- Roadmap: `context/foundation/roadmap.md` (S-03, `task-edit`)
- PRD: `context/foundation/prd.md` (FR-006, FR-007 jako poza zakresem, NFR)
- Poprzednie wycinki: `context/archive/2026-09-25-task-add/plan.md`, `context/archive/2026-09-25-project-specialties/plan.md`
- Wzorzec migracji funkcji i polityk: `supabase/migrations/20260926120000_create_tasks.sql`
- Wzorzec strony i trasy edycji: `src/pages/specialties/[id]/edit.astro`, `src/pages/api/specialties/[id]/index.ts`, `src/lib/services/specialty-routes.ts`
- Usługa i walidacja zadań: `src/lib/services/tasks.ts`, `src/lib/validation/task.ts`, `src/lib/validation/task-fields.ts`
- Formularz i strona listy: `src/components/tasks/TaskForm.tsx`, `src/pages/tasks/index.astro`
- Smoke test: `scripts/smoke.mjs`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Baza danych i typy

#### Automated

- [x] 1.1 Migracja stosuje się na czystej bazie lokalnej: `npx supabase db reset`
- [x] 1.2 Generowanie typów Astro i sprawdzenie typów przechodzi: `npx astro sync && npx astro check`
- [x] 1.3 Lint przechodzi: `npm run lint`
- [x] 1.4 Build przechodzi: `npm run build`

#### Manual

- [x] 1.5 W lokalnym Supabase (przez `psql`) `task_predecessors` ma politykę `delete` dla `authenticated`, a `tasks` nadal nie ma polityki `delete`
- [x] 1.6 `update tasks set number = number + 1` na istniejącym zadaniu kończy się błędem „Numer zadania jest niezmienny.”, a zmiana samej nazwy przechodzi
- [x] 1.7 `update_task` zmienia nazwę, specjalność, nakład i zastępuje poprzedników jedną transakcją; z pustą tablicą czyści poprzedników; z poprzednikiem równym numerowi zadania kończy się błędem i nie zmienia ani zadania, ani poprzedników
- [x] 1.8 `update_task` dla cudzego lub nieistniejącego zadania kończy się błędem `P0002`; specjalność z innego projektu kończy się błędem klucza obcego

### Phase 2: Serwer, ekrany i smoke

#### Automated

- [ ] 2.1 Sprawdzenie typów przechodzi: `npx astro check`
- [ ] 2.2 Lint przechodzi (w tym `scripts/`): `npm run lint`
- [ ] 2.3 Build przechodzi: `npm run build`
- [ ] 2.4 Smoke przechodzi na lokalnym Supabase i serwerze podglądu: `npm run smoke`
- [ ] 2.5 CI (`ci` i `smoke`) zielone na gałęzi z tą zmianą

#### Manual

- [ ] 2.6 Na `/tasks` każde zadanie ma link „Edytuj”, a strona edycji pokazuje numer tylko do odczytu i aktualne wartości pól
- [ ] 2.7 Zmiana nazwy, specjalności (także na „Bez specjalności”), nakładu (także na pusty) i poprzedników (także na pustych) działa, a lista pokazuje nowe wartości po powrocie
- [ ] 2.8 Poprzednik równy numerowi zadania, nakład „abc” i pusta nazwa pokazują czytelne komunikaty, a wpisane wartości zostają w formularzu
- [ ] 2.9 Inny użytkownik wpisujący adres cudzej edycji zadania dostaje 404
- [ ] 2.10 Kursor jest od razu w polu nazwy, a zapis kończy się widocznym wynikiem w czasie poniżej 1 sekundy
- [ ] 2.11 Migracja jest zastosowana w docelowej bazie Supabase przed wdrożeniem kodu (`npx supabase db push`)
