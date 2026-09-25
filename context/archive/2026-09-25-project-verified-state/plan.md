# Stan projektu (zweryfikowany / niezweryfikowany) — Implementation Plan

## Overview

Wycinek S-06 z mapy drogowej (kamień milowy M-2), wymaganie FR-011 i sekcja „Business Logic” PRD: kierownik widzi stan projektu. Projekt jest „zweryfikowany” wyłącznie wtedy, gdy ostatnie sprawdzenie nie znalazło problemów, a od tego czasu nie zmieniły się żadne dane (zadania, poprzednicy, specjalności); w przeciwnym razie jest „niezweryfikowany”. Kierownik nie ustawia stanu ręcznie. Stan pilnuje baza (licznik zmian podnoszony wyzwalaczami), więc każdy dotychczasowy i przyszły zapis (S-07 usuwanie zadania, S-08 zmiana numeru, S-09 usuwanie specjalności) cofa go bez dodatkowej pracy w kodzie aplikacji. Znacznik stanu jest widoczny na pulpicie, liście zadań i stronie sprawdzenia; stan zapisuje wejście na `/tasks/check`.

## Current State Analysis

- **Brak jakiegokolwiek stanu projektu:** `projects` ma tylko `id`, `owner_id`, `name`, `description`, znaczniki czasu (`supabase/migrations/20260924120000_create_projects_and_user_settings.sql`). `/tasks/check` (`src/pages/tasks/check.astro`) liczy wynik w locie (`listTasks` + `checkTasks`) i niczego nie zapisuje.
- **Zapisy, które muszą cofać stan, idą różnymi drogami:** RPC `create_task` i `update_task` (`20260926120000_create_tasks.sql`, `20260927120000_update_task.sql`, jedna transakcja, `security invoker`), zwykłe `insert`/`update` na `specialties` (`src/lib/services/specialties.ts`), a wkrótce usuwanie zadania, zmiana numeru i usuwanie specjalności (S-07–S-09). Zmiana w `task_predecessors` (kasowanie i wstawianie przy poprawce zadania) też jest zmianą danych.
- **RLS działa na własności projektu:** wszystkie tabele danych mają polityki „własne” przez `projects.owner_id = auth.uid()`; `task_predecessors` przez `tasks` do `projects`. Funkcje zapisu są `security invoker`.
- **Wyścig odczyt–zapis:** kierownik może zmienić dane między obliczeniem wyniku a zapisem „zweryfikowany”; zapis musi być warunkowy względem stanu danych z chwili odczytu.
- **Konwencje:** usługi zwracają `ServiceResult<T, E>` (`src/lib/services/db-errors.ts`: `fail`, `failWith`); typy bazy są pisane ręcznie w `src/types.ts` (`Database`); komponenty Astro dla treści statycznej; smoke (`scripts/smoke.mjs`) działa na prawdziwym lokalnym Supabase z dwiema sesjami (A, B).

## Desired End State

Na pulpicie wybranego projektu, na liście zadań i na stronie sprawdzenia widać „Stan projektu: zweryfikowany” albo „Stan projektu: niezweryfikowany”. Nowy projekt jest niezweryfikowany. Wejście na `/tasks/check` w projekcie bez problemów zapisuje stan „zweryfikowany”; przy problemach (albo błędzie odczytu stanu) projekt pozostaje niezweryfikowany. Każda zmiana danych po sprawdzeniu (dodanie i poprawa zadania, dodanie, zmiana nazwy i usunięcie specjalności, każda zmiana poprzedników) cofa stan do „niezweryfikowany”; ponowne sprawdzenie bez problemów przywraca „zweryfikowany”. Użytkownik nie ma sposobu, by ustawić stan bezpośrednio przez API. `npx astro check`, lint, build, testy jednostkowe i smoke przechodzą, a migracja jest zastosowana na produkcji przed wdrożeniem kodu.

### Key Discoveries:

- **Stan to porównanie dwóch liczników**, a nie znacznik czasu i nie flaga: `data_revision` rośnie przy każdej zmianie danych, `verified_revision` dostaje wartość licznika w chwili udanego sprawdzenia; „zweryfikowany” znaczy `verified_revision = data_revision`. Nie ma czego „cofać” po stronie aplikacji, a usunięcia (których znacznik czasu nie widzi) też podnoszą licznik.
- **Wyzwalacze na `tasks`, `task_predecessors` i `specialties`** obejmują wszystkie obecne i przyszłe ścieżki zapisu (RPC, zwykłe operacje, kaskady); wycinki S-07–S-09 nie muszą o nich pamiętać (wymaganie z roadmapy: „każdy kolejny wycinek zapisujący dane musi go respektować”).
- **Warunkowy zapis chroni przed wyścigiem:** `verify_project(projekt, licznik)` ustawia `verified_revision` tylko wtedy, gdy `data_revision` nadal równa się podanemu licznikowi. Strona odczytuje licznik przed odczytem zadań; zmiana w międzyczasie podnosi licznik i zapis nic nie robi (bez fałszywego „OK”).
- **Ochrona przed ustawieniem ręcznym:** osobna tabela `project_states` bez polityk zapisu dla ról użytkownika; zmieniają ją wyłącznie funkcje `security definer` (wyzwalacze i `verify_project`), a `verify_project` sprawdza właściciela projektu. `security definer` omija RLS, więc każda taka funkcja ma `set search_path = ''` i jawny warunek własności (`verify_project`) albo działa tylko z wiersza, który użytkownik już zmienił w ramach RLS (wyzwalacze).
- **Kaskadowe usuwanie projektu nie może się wysypać:** wyzwalacz wywołany kaskadą z usuwanego projektu nie może tworzyć wiersza `project_states` dla nieistniejącego projektu (naruszenie klucza obcego), więc podnoszenie licznika działa tylko dla istniejącego projektu; istniejący krok smoke usuwający projekt z zadaniami jest testem regresji.
- **Pusty wiersz stanu = niezweryfikowany:** brak wiersza (projekty sprzed migracji, nowe projekty) oznacza licznik 0 i brak weryfikacji; nie ma potrzeby wypełniania wstecz.

## What We're NOT Doing

- Zapamiętywanie powodów niezweryfikowania (nigdy nie sprawdzano / zmieniono dane / znaleziono problemy): stan ma dokładnie dwie wartości z PRD.
- Historia sprawdzeń, data ostatniego sprawdzenia, zapamiętany wynik sprawdzenia.
- Stan na liście wszystkich projektów (decyzja użytkownika: pulpit, lista zadań, strona sprawdzenia).
- Osobna trasa POST ani przycisk „Uruchom sprawdzenie” (decyzja użytkownika: wejście na `/tasks/check`).
- Ręczne ustawianie stanu przez kierownika (PRD zabrania).
- Przeliczanie sprawdzenia w bazie: funkcja `verify_project` ufa wynikowi sprawdzenia z aplikacji (kierownik może sam sobie ustawić stan przez bezpośrednie wywołanie funkcji, ale nie wpływa to na nikogo innego; guardrail dotyczy uczciwego przepływu aplikacji).
- Usuwanie zadań i specjalności, zmiana numeru zadania (S-07, S-08, S-09); ich wyzwalacze są już pokryte, ale same funkcje nie powstają tutaj.
- Zmiana stanu przy edycji nazwy lub opisu projektu (nie są to dane sprawdzane).

## Implementation Approach

Jedna faza od bazy do interfejsu. Migracja dodaje tabelę `project_states`, funkcje wyzwalaczy i funkcję `verify_project`; typy bazy i usługa stanu wystawiają odczyt i zapis; trzy strony pokazują znacznik, a `/tasks/check` zapisuje stan po pustym wyniku. Smoke na prawdziwej bazie sprawdza pełny cykl (nowy → sprawdzenie → zmiana → sprawdzenie → zmiana specjalności) i izolację użytkowników; celowe wyłączenie jednego wyzwalacza w lokalnej bazie musi czerwienić smoke.

## Critical Implementation Details

- **State sequencing:** na stronie sprawdzenia licznik projektu trzeba odczytać przed odczytem zadań, nigdy po; odwrotna kolejność pozwalałaby zapisać „zweryfikowany” dla danych, które zmieniły się po odczycie zadań, ale przed odczytem licznika.

## Phase 1: Stan projektu: baza, usługa, widoki i smoke

### Overview

Dodaje trwały stan projektu pilnowany przez bazę, usługę do jego odczytu i warunkowego zapisu, znacznik stanu na trzech stronach oraz kroki smoke. Po tej fazie kierownik widzi, czy lista zadań jest zweryfikowana, a każda zmiana danych cofa stan.

### Changes Required:

#### 1. Migracja: tabela stanu, wyzwalacze, funkcja weryfikacji

**File**: `supabase/migrations/20260929120000_project_states.sql` (nowy)

**Intent**: Przechowywać licznik zmian danych i licznik ostatniej udanej weryfikacji na projekt, podnosić pierwszy wyzwalaczami na każdej tabeli danych, a drugi ustawiać wyłącznie funkcją sprawdzającą właściciela i aktualność licznika.

**Contract**: Tabela `public.project_states (project_id uuid primary key references public.projects (id) on delete cascade, data_revision bigint not null default 0, verified_revision bigint)`; RLS włączone, jedna polityka `select` dla `authenticated` (własność przez `projects.owner_id = (select auth.uid())`), brak polityk insert/update/delete. Funkcja pomocnicza podnosząca licznik: dla podanego `project_id` wykonuje `insert … on conflict (project_id) do update set data_revision = project_states.data_revision + 1`, ale tylko gdy projekt istnieje (wstawienie z `select … where exists (select 1 from public.projects where id = …)`, żeby kaskada z usuwanego projektu nie naruszała klucza obcego). Trzy funkcje wyzwalaczy `security definer`, `set search_path = ''`: dla `tasks` (`project_id` z `new` lub `old`), dla `task_predecessors` (projekt z `tasks` po `task_id` z `new` lub `old`; brak wiersza zadania przy kaskadzie = pomiń), dla `specialties` (`project_id` z `new` lub `old`); wyzwalacze `after insert or update or delete … for each row` na trzech tabelach. `revoke execute … from public, anon, authenticated` na funkcjach wyzwalaczy i pomocniczej. Funkcja `public.verify_project(p_project_id uuid, p_revision bigint) returns boolean`, `security definer`, `set search_path = ''`: gdy wywołujący nie jest właścicielem projektu (`projects.owner_id = auth.uid()` z jawnym warunkiem, bo definer omija RLS), zgłasza błąd `42501`; zapewnia istnienie wiersza stanu (`insert … on conflict do nothing`), następnie `update project_states set verified_revision = data_revision where project_id = p_project_id and data_revision = p_revision` i zwraca, czy coś zaktualizowano; `revoke execute … from public, anon`, `grant execute … to authenticated`. Komentarze migracji po polsku, jak w pozostałych plikach; nazwa i format zgodne z `YYYYMMDDHHmmss_short_description.sql`.

#### 2. Typy bazy i typ stanu

**File**: `src/types.ts`

**Intent**: Opisać nową tabelę i funkcję w ręcznie pisanym typie `Database` i dodać typ stanu widoczny w interfejsie.

**Contract**: W `Database["public"]["Tables"]` tabela `project_states` (`Row`: `project_id: string`, `data_revision: number`, `verified_revision: number | null`; `Insert`/`Update` analogiczne, opcjonalne; `Relationships` do `projects`), w `Functions` funkcja `verify_project` (`Args`: `p_project_id: string`, `p_revision: number`; `Returns: boolean`). Typ `ProjectState { revision: number; verified: boolean }` (`revision` to `data_revision` z chwili odczytu, `verified` to `verified_revision === data_revision`).

#### 3. Usługa stanu projektu

**File**: `src/lib/services/project-state.ts` (nowy)

**Intent**: Odczytać stan projektu i warunkowo zapisać weryfikację, z tym samym wzorcem błędów co pozostałe usługi.

**Contract**: `getProjectState(db, projectId)` zwraca `ServiceResult<ProjectState>` (`select` `data_revision, verified_revision` z `project_states` po `project_id`, `maybeSingle`; brak wiersza to `{ revision: 0, verified: false }`; błąd bazy przez `fail("project-state", error)`). `verifyProject(db, projectId, revision)` wywołuje RPC `verify_project` i zwraca `ServiceResult<boolean>` (`true` = stan zapisany jako zweryfikowany, `false` = dane zmieniły się od odczytu; kod `42501` mapuje się na `not_found`). Stan „nieznany” (błąd odczytu) nigdy nie jest raportowany jako zweryfikowany.

#### 4. Znacznik stanu

**File**: `src/components/projects/ProjectStateBadge.astro` (nowy)

**Intent**: Jeden komponent pokazujący stan w trzech miejscach, tak żeby teksty i wygląd były spójne.

**Contract**: Właściwość `verified: boolean`; tekst „Stan projektu: zweryfikowany” (zielony akcent) albo „Stan projektu: niezweryfikowany” (bursztynowy akcent), styl zgodny z pozostałymi elementami stron (Tailwind, `cn()` przy warunkowych klasach). Komponent nie używa sformułowań „wszystko w porządku” ani „brak problemów”. Przy błędzie odczytu stanu strony pokazują komunikat „Nie udało się wczytać stanu projektu.” zamiast znacznika.

#### 5. Pulpit i lista zadań

**File**: `src/pages/dashboard.astro`, `src/pages/tasks/index.astro`

**Intent**: Pokazać stan wybranego projektu tam, gdzie kierownik pracuje.

**Contract**: Po wczytaniu wybranego projektu strony wywołują `getProjectState(supabase, project.id)` i pokazują `ProjectStateBadge` (pulpit: pod opisem projektu; lista zadań: pod nagłówkiem „Projekt: …”, nad przyciskiem „Sprawdź listę zadań”). Błąd odczytu stanu nie blokuje reszty strony.

#### 6. Strona sprawdzenia zapisuje stan

**File**: `src/pages/tasks/check.astro`

**Intent**: Uruchomienie sprawdzenia (wejście na stronę) zapisuje „zweryfikowany” tylko wtedy, gdy wynik jest pusty i dane nie zmieniły się od odczytu, oraz pokazuje stan po sprawdzeniu.

**Contract**: Kolejność: wybrany projekt → `getProjectState` (licznik) → `listTasks` → `checkTasks`. Gdy wynik nie ma problemów i stan został odczytany poprawnie, wywołanie `verifyProject(supabase, project.id, state.revision)`; wynik `true` daje stan „zweryfikowany” na stronie, `false` lub błąd — „niezweryfikowany”. Przy problemach albo błędzie odczytu zadań nic nie zapisuje, a strona pokazuje „niezweryfikowany”. Znacznik stanu pod nagłówkiem. Reguły treści z S-05 bez zmian (wynik nie mówi „wszystko w porządku”; komunikat pustego wyniku zostaje).

#### 7. Kroki smoke

**File**: `scripts/smoke.mjs`

**Intent**: Pokryć pełny cykl stanu na prawdziwej bazie i izolację użytkowników.

**Contract**: Asercje na fragmentach z prefiksem „Stan projektu: ” (fragment „Stan projektu: zweryfikowany” nie jest podciągiem „Stan projektu: niezweryfikowany”, więc rozróżnia stany). Projekt B (czysty, jedno zadanie z pełną odpowiedzialnością): pulpit pokazuje „niezweryfikowany”; wejście na `/tasks/check` daje „Nie znaleziono problem” i „zweryfikowany”; pulpit i `/tasks` pokazują „zweryfikowany”; dodanie zadania, poprawa zadania i dodanie specjalności cofają stan do „niezweryfikowany” (po każdej zmianie pulpit), a kolejne sprawdzenie przywraca „zweryfikowany”; zmiana nazwy specjalności też cofa stan. Projekt A (z problemami z wcześniejszych kroków): `/tasks/check` pokazuje „niezweryfikowany”, a pulpit A po sprawdzeniu również; stan B nie wpływa na A i odwrotnie. Istniejący krok usuwania projektu z zadaniami pozostaje i testuje, że kaskada nie wysypuje wyzwalaczy. Nowe kroki wstaw przed usunięciem projektów, w kolejności zależnej od tego, gdzie w istniejącym scenariuszu projekty B i A mają swoje dane; nie zmieniaj istniejących asercji.

### Success Criteria:

#### Automated Verification:

- Migracja stosuje się na czystej lokalnej bazie: `npx supabase db reset`
- Testy jednostkowe (regresja): `npm run test:unit`
- Sprawdzenie typów przechodzi: `npx astro check`
- Lint przechodzi: `npm run lint`
- Build przechodzi: `npm run build`
- Smoke przechodzi na lokalnym Supabase i serwerze podglądu: `npm run smoke`
- CI (`ci` i `smoke`) zielone na gałęzi z tą zmianą

#### Manual Verification:

- Migracja zastosowana na produkcji przed wdrożeniem kodu: `npx supabase db push`
- Nowy projekt jest „niezweryfikowany”; po wejściu na `/tasks/check` w projekcie bez problemów stan przechodzi na „zweryfikowany” (pulpit i lista zadań)
- Dodanie zadania, poprawa zadania (także tylko poprzedników) i każda zmiana specjalności (dodanie, nazwa) cofają stan do „niezweryfikowany”; kolejne sprawdzenie bez problemów przywraca „zweryfikowany”
- Sprawdzenie projektu z problemami nie ustawia „zweryfikowany”
- Użytkownik zalogowany nie może zapisać ani zmienić stanu bezpośrednio (tabela `project_states` odrzuca zapis; próba `verify_project` na cudzym projekcie kończy się błędem)
- Usunięcie projektu z zadaniami i specjalnościami działa jak dotąd (kaskada nie wysypuje wyzwalaczy)
- Po wdrożeniu na produkcji ten sam cykl działa na prawdziwych danych

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- Bez nowych testów jednostkowych: logika stanu jest w bazie (wyzwalacze, funkcja), a `checkTasks` nie zmienia się. Istniejące testy (`npm run test:unit`) pilnują regresji.

### Integration Tests:

- `npm run smoke` na lokalnym Supabase: cykl stanu (niezweryfikowany → sprawdzenie → zweryfikowany → zmiana zadania → niezweryfikowany → sprawdzenie → zmiana specjalności → niezweryfikowany), sprawdzenie z problemami nie weryfikuje, izolacja użytkowników A i B, kaskadowe usunięcie projektu z danymi.
- **Celowy test zepsucia (wykonuje implementujący):** w lokalnej bazie wyłączyć jeden wyzwalacz (np. `alter table public.tasks disable trigger …`), uruchomić smoke i potwierdzić, że krok „zmiana zadania cofa stan” robi się czerwony; potem włączyć wyzwalacz z powrotem.

### Manual Testing Steps:

1. Dodaj projekt, specjalność i zadanie; sprawdź, że pulpit pokazuje „niezweryfikowany”.
2. Otwórz „Sprawdź listę zadań”; wróć na pulpit i listę zadań: „zweryfikowany”.
3. Dodaj zadanie, potem popraw je (tylko poprzedników), potem zmień nazwę specjalności; po każdej zmianie stan wraca do „niezweryfikowany”; sprawdzenie przywraca „zweryfikowany”.
4. Dodaj problem (zadanie bez nakładu), otwórz sprawdzenie: stan „niezweryfikowany”.
5. W konsoli bazy zaloguj się jako użytkownik (rola `authenticated`) i spróbuj zapisać `project_states` bezpośrednio: odmowa.

## Performance Considerations

Każdy zapis zadania, poprzednika lub specjalności dokłada jedno upsertowe podniesienie licznika w tej samej transakcji (kilka wierszy na `create_task`/`update_task`, bo poprzednicy są osobnymi wierszami); przy kilkudziesięciu zadaniach to pomijalne. Odczyt stanu to jedno zapytanie po kluczu głównym. Wymaganie „zwykłe akcje poniżej 1 sekundy” pozostaje spełnione.

## Migration Notes

- Migracja jest addytywna (nowa tabela, funkcje, wyzwalacze); istniejące projekty nie mają wiersza stanu i są „niezweryfikowane”, więc wypełnianie wsteczne nie jest potrzebne.
- **Kolejność wdrożenia:** najpierw `npx supabase db push` (ręcznie, po potwierdzeniu użytkownika), potem wdrożenie kodu przez merge. Stary kod działa na nowej bazie (wyzwalacze tylko podnoszą licznik); nowy kod na starej bazie pokazywałby „Nie udało się wczytać stanu projektu.” i nie weryfikował.
- Wycinki S-07, S-08 i S-09 dziedziczą cofanie stanu z wyzwalaczy; ich plany powinny tylko dodać własny krok smoke (zapis cofa stan).

## References

- Roadmap: `context/foundation/roadmap.md` (S-06, `project-verified-state`)
- PRD: `context/foundation/prd.md` (FR-011, Business Logic, Guardrails, Access Control)
- Poprzedni wycinek: `context/archive/2026-09-25-task-check-cycles/plan.md`
- Wzorce migracji i funkcji: `supabase/migrations/20260926120000_create_tasks.sql`, `20260927120000_update_task.sql`
- Usługi i błędy: `src/lib/services/db-errors.ts`, `src/lib/services/tasks.ts`
- Strony: `src/pages/dashboard.astro`, `src/pages/tasks/index.astro`, `src/pages/tasks/check.astro`
- Smoke: `scripts/smoke.mjs`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Stan projektu: baza, usługa, widoki i smoke

#### Automated

- [x] 1.1 Migracja stosuje się na czystej lokalnej bazie: `npx supabase db reset` — 8a81018
- [x] 1.2 Testy jednostkowe (regresja): `npm run test:unit` — 8a81018
- [x] 1.3 Sprawdzenie typów przechodzi: `npx astro check` — 8a81018
- [x] 1.4 Lint przechodzi: `npm run lint` — 8a81018
- [x] 1.5 Build przechodzi: `npm run build` — 8a81018
- [x] 1.6 Smoke przechodzi na lokalnym Supabase i serwerze podglądu: `npm run smoke` — 8a81018
- [x] 1.7 CI (`ci` i `smoke`) zielone na gałęzi z tą zmianą — 8a81018

#### Manual

- [x] 1.8 Migracja zastosowana na produkcji przed wdrożeniem kodu: `npx supabase db push` — 8a81018
- [x] 1.9 Nowy projekt jest „niezweryfikowany”; po wejściu na `/tasks/check` w projekcie bez problemów stan przechodzi na „zweryfikowany” (pulpit i lista zadań) — 8a81018
- [x] 1.10 Dodanie zadania, poprawa zadania (także tylko poprzedników) i każda zmiana specjalności (dodanie, nazwa) cofają stan do „niezweryfikowany”; kolejne sprawdzenie bez problemów przywraca „zweryfikowany” — 8a81018
- [x] 1.11 Sprawdzenie projektu z problemami nie ustawia „zweryfikowany” — 8a81018
- [x] 1.12 Użytkownik zalogowany nie może zapisać ani zmienić stanu bezpośrednio (tabela `project_states` odrzuca zapis; próba `verify_project` na cudzym projekcie kończy się błędem) — 8a81018
- [x] 1.13 Usunięcie projektu z zadaniami i specjalnościami działa jak dotąd (kaskada nie wysypuje wyzwalaczy) — 8a81018
- [x] 1.14 Po wdrożeniu na produkcji ten sam cykl działa na prawdziwych danych — 8a81018
