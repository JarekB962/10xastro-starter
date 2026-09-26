# Usunięcie zadania — Implementation Plan

## Overview

Wycinek S-07 z mapy drogowej (kamień milowy M-2), wymaganie FR-007 (usunięcie zadania) i US-01 z `context/foundation/prd.md`: kierownik usuwa zadanie, jeśli nie jest ono poprzednikiem innego zadania; próba usunięcia takiego zadania kończy się komunikatem, które zadania na nie wskazują. Usuwanie przechodzi przez stronę potwierdzenia `/tasks/[id]/delete` (spójnie z usuwaniem projektu), a link „Usuń” jest na liście zadań i na stronie edycji. Blokadę pilnuje baza (wyzwalacz `before delete`), więc obejmuje każdą ścieżkę zapisu; usunięcie cofa stan projektu do „niezweryfikowany” dzięki wyzwalaczowi z S-06. Zmiana numeru zadania (S-08) i usuwanie specjalności (S-09) są poza wycinkiem.

## Current State Analysis

- **Brak usuwania zadań:** tabela `tasks` nie ma polityki `delete` (`supabase/migrations/20260926120000_create_tasks.sql`: „Brak polityki delete … usuwanie zadania dojdzie w S-04”), a aplikacja nie ma trasy ani strony usuwania zadania. Wiersze `task_predecessors` znikają kaskadowo razem z zadaniem (`on delete cascade`), a polityka `delete` dla nich już jest (`20260927120000_update_task.sql`).
- **Poprzednik to numer, nie klucz obcy:** `task_predecessors.predecessor_number` wskazuje numer zadania w projekcie, więc baza sama nie zablokuje usunięcia zadania, na które ktoś wskazuje; regułę trzeba dopisać wyzwalaczem.
- **Kaskada z projektu:** usunięcie projektu kasuje jego zadania kaskadowo (`tasks.project_id … on delete cascade`); zadania wskazują na siebie nawzajem (także cyklicznie, jak w smoke), więc wyzwalacz blokujący usunięcie nie może działać w kaskadzie. W S-06 sprawdziło się, że w kaskadzie wiersz projektu jest już niewidoczny (`bump_project_revision` opiera się na tym).
- **Stan projektu (S-06):** wyzwalacz `tasks_bump_revision` (`20260929120000_project_states.sql`) obsługuje `insert or update or delete` na `tasks`, więc usunięcie zadania podnosi licznik zmian i cofa stan bez zmian w aplikacji.
- **Wzorzec usuwania:** `src/pages/projects/[id]/delete.astro` (strona potwierdzenia, 404/503/500 jak przy edycji), `src/pages/api/projects/[id]/delete.ts` (POST, przekierowanie z `errorUrl`), `src/lib/services/projects.ts` (`deleteProject`), strażniki tras w `src/lib/services/task-routes.ts` i `project-routes.ts`. Usługi zwracają `ServiceResult<T, E>` z kodami błędów w `src/types.ts`; komunikaty błędów przez `?error=`.
- **Middleware:** `PROTECTED_ROUTES` dopasowuje po prefiksie, więc `/tasks/[id]/delete` i `/api/tasks/[id]/delete` są chronione bez zmian.
- **Testy:** smoke (`scripts/smoke.mjs`) na prawdziwym Supabase z sesjami A i B oraz testy jednostkowe `node:test` (`npm run test:unit`, wprowadzone w S-05) dla czystej logiki.

## Desired End State

Kierownik klika „Usuń” obok zadania na liście albo na stronie edycji i trafia na stronę potwierdzenia z pytaniem „Usunąć zadanie?”. Jeśli żadne inne zadanie nie ma go jako poprzednika, strona ma przycisk „Usuń zadanie”, a po kliknięciu zadanie znika i użytkownik wraca na listę. Jeśli inne zadania na nie wskazują, strona zamiast przycisku pokazuje komunikat „Zadanie nie może zostać usunięte: jest poprzednikiem zadań 3, 5, 7” z listą tych zadań (z linkami „Edytuj”). Bezpośredni `POST` usuwający takie zadanie (także z wyścigu) kończy się tym samym komunikatem, a zadanie zostaje. Usunięcie zadania cofa projekt do „niezweryfikowany”. Usunięcie całego projektu z zadaniami wskazującymi na siebie działa jak dotąd. `npm run test:unit`, `astro check`, lint, build i smoke przechodzą, a migracja jest zastosowana na produkcji przed wdrożeniem kodu.

### Key Discoveries:

- **Blokada w bazie, nie tylko w aplikacji:** wyzwalacz `before delete` na `tasks` odrzuca usunięcie zadania, na które wskazuje inne zadanie tego samego projektu (kod `23001`, `restrict_violation`), więc reguła z PRD („zadanie, które jest poprzednikiem innego, nie może zostać usunięte”) obowiązuje także dla bezpośrednich wywołań API i przyszłych wycinków.
- **Wyzwalacz nie blokuje kaskady z projektu:** gdy projekt zadania już nie istnieje (usuwanie projektu), wyzwalacz przepuszcza usunięcie; inaczej usunięcie projektu z zadaniami wskazującymi na siebie by się nie udało.
- **Lista blokujących zadań liczona w aplikacji:** czysta funkcja znajdująca zadania wskazujące na dany numer (na liście zadań projektu) daje komunikat i listę na stronie potwierdzenia; wyzwalacz jest zabezpieczeniem na wypadek wyścigu i trafia do tego samego komunikatu.
- **Wyścig dodania poprzednika:** ponieważ poprzednik to numer, a nie klucz obcy, dodanie zadania wskazującego na usuwane zadanie w tej samej chwili może zostawić „nieistniejący poprzednik”; to zwykły problem wykrywany przez sprawdzenie (PRD dopuszcza takie odwołania), więc bez dodatkowej ochrony.
- **Stan projektu cofa się sam:** nic nie trzeba dodawać poza krokiem smoke.

## What We're NOT Doing

- Zmiana numeru zadania i automatyczna poprawa poprzedników (S-08); usuwanie specjalności (S-09).
- Link „Usuń” na stronie sprawdzenia (decyzja użytkownika: lista i edycja zadania).
- Usuwanie kilku zadań naraz, kosz i przywracanie usuniętych zadań.
- Automatyczne usuwanie zadania razem z odwołaniami do niego z innych zadań (blokujemy, nie kaskadujemy).
- Zmiany w stanie projektu, algorytmie sprawdzenia i polityce usuwania projektu.
- Blokada wyścigu przy dodawaniu poprzednika wskazującego na usuwane zadanie (patrz Key Discoveries).

## Implementation Approach

Jedna faza od bazy do interfejsu. Migracja dodaje politykę `delete` i wyzwalacz blokujący; czysta funkcja `findDependents` wskazuje zadania blokujące (z testami jednostkowymi `node:test`); usługa `deleteTask` łączy ją z usunięciem i mapuje błąd wyzwalacza; strona potwierdzenia i trasa `POST` wzorowane na usuwaniu projektu; dwa linki „Usuń”; kroki smoke na prawdziwej bazie sprawdzają usunięcie, blokadę, cofnięcie stanu, izolację użytkowników i kaskadę przy usuwaniu projektu.

## Phase 1: Usuwanie zadania: baza, usługa, strony i smoke

### Overview

Dodaje możliwość usunięcia zadania pod warunkiem, że nie jest poprzednikiem innego, z blokadą w bazie, stroną potwierdzenia i komunikatem o zadaniach blokujących. Po tej fazie kierownik usuwa zbędne zadania bez naruszania zależności, a stan projektu cofa się po każdym usunięciu.

### Changes Required:

#### 1. Migracja: polityka usuwania i blokada

**File**: `supabase/migrations/20261001120000_task_delete.sql` (nowy)

**Intent**: Pozwolić właścicielowi usuwać zadania swoich projektów i zablokować w bazie usunięcie zadania, na które wskazuje inne zadanie, bez blokowania kaskady z usuwanego projektu.

**Contract**: Polityka `tasks_delete_own` dla `delete to authenticated` z tym samym warunkiem własności co pozostałe polityki `tasks` (`exists` po `projects.owner_id = (select auth.uid())`). Funkcja wyzwalacza `public.prevent_delete_task_with_dependents()` (`security invoker`, `set search_path = ''`): jeśli projekt `old.project_id` już nie istnieje (kaskada z usuwanego projektu), zwraca `old` bez sprawdzania; w przeciwnym razie zbiera numery zadań tego samego projektu, które mają `old.number` w `task_predecessors` (`string_agg` rosnąco) i gdy są, zgłasza wyjątek z komunikatem „Zadanie jest poprzednikiem zadań: 3, 5.” i kodem `restrict_violation` (`23001`); inaczej zwraca `old`. Wyzwalacz `tasks_prevent_delete_with_dependents` `before delete … for each row`. Komentarze po polsku, jak w pozostałych migracjach; komentarz w `20260926120000_create_tasks.sql` o braku polityki delete pozostaje bez zmian (migracja już zastosowana).

#### 2. Wyszukiwanie zadań blokujących

**File**: `src/lib/task-dependents.ts` (nowy), `tests/task-dependents.test.mjs` (nowy)

**Intent**: Jedna czysta funkcja wskazująca zadania blokujące usunięcie, używana przez usługę i stronę potwierdzenia, z testami jednostkowymi.

**Contract**: `findDependents(tasks: Task[], number: number): Task[]` zwraca zadania listy, które mają `number` w `predecessors`, rosnąco po numerze (zadanie o tym samym numerze pomijane). Moduł importuje tylko typy (`import type` z `@/types`), żeby ładował się w Node z `--experimental-strip-types`, jak `task-check.ts`. Testy (`node:test`, `node:assert/strict`): brak zależnych, jedno zależne, kilka zależnych posortowanych, zadanie bez poprzedników, zależne przez wiele poprzedników, brak wskazań na inne numery, pusta lista. `npm run test:unit` obejmuje nowy plik bez zmian w skrypcie (glob `tests/*.test.mjs`).

#### 3. Typy błędów i usługa

**File**: `src/types.ts`, `src/lib/services/tasks.ts`

**Intent**: Usunąć zadanie z uwzględnieniem blokady i zwrócić listę zadań blokujących, z tym samym wzorcem wyniku co pozostałe usługi.

**Contract**: `TaskServiceError` dostaje kod `has_dependents`. `deleteTask(db, id)` zwraca wynik: `{ ok: true, data: null }`, `{ ok: false, error: "not_found" | "unexpected" }` albo `{ ok: false, error: "has_dependents", dependents: Task[] }` (typ pomocniczy w `types.ts`). Kolejność: `getTask` (brak = `not_found`), `listTasks` projektu i `findDependents`; przy niepustej liście zwraca `has_dependents` bez próby usunięcia; inaczej `db.from("tasks").delete().eq("id", id).select("id")`, pusty wynik = `not_found`, błąd `23001` (wyścig) mapuje na `has_dependents` z listą ponownie wyliczoną z aktualnych zadań, pozostałe błędy przez `failWith`. Stała komunikatu i funkcja składająca tekst „Zadanie nie może zostać usunięte: jest poprzednikiem zadań 3, 5, 7.” (`TASK_HAS_DEPENDENTS_MESSAGE` lub funkcja przyjmująca numery); `TASK_ERROR_MESSAGES` uzupełnione o `has_dependents` tak, by rekord pozostał kompletny. Kod `23001` dopisany do `TASK_DB_ERRORS`.

#### 4. Trasa POST usuwania

**File**: `src/pages/api/tasks/[id]/delete.ts` (nowy)

**Intent**: Wykonać usunięcie po potwierdzeniu i odesłać użytkownika z jednoznacznym wynikiem.

**Contract**: `POST` z `export const prerender = false`, strażnikami `requireSupabase(context, "/tasks")` i `requireTaskId`. Sukces: przekierowanie na `/tasks`. `not_found`: `/tasks?error=` z `TASK_NOT_FOUND_MESSAGE`. `has_dependents`: `/tasks/{id}/delete?error=` z komunikatem o zadaniach blokujących. `unexpected`: `/tasks/{id}/delete?error=` z ogólnym komunikatem z `TASK_ERROR_MESSAGES`.

#### 5. Strona potwierdzenia

**File**: `src/pages/tasks/[id]/delete.astro` (nowy)

**Intent**: Pokazać pytanie o potwierdzenie albo powód, dla którego usunięcie jest niemożliwe, wzorem strony usuwania projektu.

**Contract**: Odczyt zadania przez `getTask` (nieistniejące i cudze zadanie: 404, brak Supabase: 503, błąd bazy: 500, jak w `projects/[id]/delete.astro` i `tasks/[id]/edit.astro`); lista zadań projektu (`listTasks`) i `findDependents`. Bez zadań blokujących: nagłówek „Usunąć zadanie?”, nazwa i numer zadania, informacja, że zadanie zostanie usunięte na stałe (razem z jego poprzednikami) i że operacji nie można cofnąć, formularz `POST` do `/api/tasks/{id}/delete` z przyciskiem „Usuń zadanie” (styl czerwony jak przy projekcie) i linkiem „Anuluj” do `/tasks`. Z zadaniami blokującymi: komunikat „Zadanie nie może zostać usunięte: jest poprzednikiem zadań …” i lista tych zadań (numer, nazwa, link „Edytuj” do `/tasks/{id}/edit`), bez przycisku usunięcia, z linkiem powrotu do listy. Parametr `?error=` (przekierowanie z trasy) pokazany nad treścią. Stan „nie znaleziono” z linkiem do listy zadań.

#### 6. Linki „Usuń”

**File**: `src/pages/tasks/index.astro`, `src/pages/tasks/[id]/edit.astro`

**Intent**: Dodać wejście do usuwania tam, gdzie kierownik pracuje z zadaniem.

**Contract**: Na liście zadań link „Usuń” obok „Edytuj” (`/tasks/{id}/delete`, styl spójny z „Edytuj”, akcent ostrzegawczy zamiast fioletowego, bez zmiany układu karty); na stronie edycji zadania link „Usuń zadanie” pod formularzem, obok „Wróć do listy zadań”. Strona sprawdzenia bez zmian.

#### 7. Kroki smoke

**File**: `scripts/smoke.mjs`

**Intent**: Pokryć usunięcie, blokadę, cofnięcie stanu projektu, izolację użytkowników i kaskadę na prawdziwej bazie.

**Contract**: Asercje na fragmentach bez polskich znaków, jak w istniejących krokach (np. „poprzednikiem zada” z komunikatu blokady i „Usuń zadanie” tylko tam, gdzie da się je zapisać bez znaków diakrytycznych, np. „Usu” + „ zadanie”); dokładne fragmenty ustal na faktycznym HTML. Sesja A (zadania kontrolne z cyklu 20–22 i zadanie 23 zależne od 20): strona potwierdzenia zadania 20 pokazuje blokadę, wymienia zadania 21 i 23 i nie ma przycisku „Usuń zadanie”; `POST` usunięcia zadania 20 przekierowuje na stronę potwierdzenia z komunikatem o blokadzie, a zadanie 20 zostaje na liście; usunięcie zadania 23 (bez zależnych) przekierowuje na `/tasks`, a lista nie zawiera już jego nazwy; strona potwierdzenia usuniętego zadania to 404. Sesja B: stan „zweryfikowany” cofa się do „niezweryfikowany” po usunięciu zadania (pulpit), a kolejne sprawdzenie przywraca „zweryfikowany”; B nie widzi strony potwierdzenia zadania A (404) i `POST` usunięcia zadania A przekierowuje z komunikatem „nie znaleziono”, a zadanie A zostaje. Istniejący krok usunięcia projektu A z zadaniami wskazującymi na siebie (cykl 20–22 i pozostałe) pozostaje i testuje kaskadę; nowe kroki wstaw przed usunięciem projektów, w kolejności zależnej od danych w scenariuszu; istniejących asercji nie zmieniaj.

### Success Criteria:

#### Automated Verification:

- Migracja stosuje się na czystej lokalnej bazie: `npx supabase db reset`
- Testy jednostkowe (w tym `findDependents`) przechodzą: `npm run test:unit`
- Sprawdzenie typów przechodzi: `npx astro check`
- Lint przechodzi: `npm run lint`
- Build przechodzi: `npm run build`
- Smoke przechodzi na lokalnym Supabase i serwerze podglądu: `npm run smoke`
- CI (`ci` i `smoke`) zielone na gałęzi z tą zmianą

#### Manual Verification:

- Migracja zastosowana na produkcji przed wdrożeniem kodu: `npx supabase db push`
- Usunięcie zadania, które nie jest niczyim poprzednikiem, działa (link „Usuń” na liście i na edycji, strona potwierdzenia, powrót na listę) i cofa stan projektu do „niezweryfikowany”
- Próba usunięcia zadania, na które wskazują inne, pokazuje komunikat z numerami tych zadań i listę z linkami „Edytuj”, bez przycisku usunięcia
- Po usunięciu zależności (przez „Edytuj” zadań blokujących) to samo zadanie da się usunąć
- Bezpośredni `POST` usunięcia zadania blokowanego nie usuwa go (zadanie zostaje na liście)
- Zalogowany użytkownik nie usunie cudzego zadania (404 na stronie, „nie znaleziono” przy POST)
- Usunięcie projektu z zadaniami wskazującymi na siebie działa jak dotąd (kaskada nie jest blokowana)
- Po wdrożeniu na produkcji ten sam cykl działa na prawdziwych danych

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- `tests/task-dependents.test.mjs` (`node:test`, bez zależności): `findDependents` dla braku zależnych, jednego i kilku zależnych (posortowane), zadania bez poprzedników, zależności przez wiele poprzedników i pustej listy.

### Integration Tests:

- `npm run smoke` na lokalnym Supabase: blokada usunięcia zadania-poprzednika (strona i POST), usunięcie zadania bez zależnych, cofnięcie stanu projektu po usunięciu i przywrócenie po sprawdzeniu, izolacja użytkowników A i B, kaskada przy usuwaniu projektu z zadaniami wskazującymi na siebie.
- **Celowy test zepsucia (wykonuje implementujący):** wyłączyć w lokalnej bazie wyzwalacz `tasks_prevent_delete_with_dependents` i sprawdzić, że kroki smoke o blokadzie POST czerwienią się (a przy zepsuciu `findDependents` w aplikacji czerwienią się testy jednostkowe); potem przywrócić.

### Manual Testing Steps:

1. Dodaj zadania 1, 2 (poprzednik 1) i 3; na liście kliknij „Usuń” przy 3: potwierdź usunięcie, zadanie znika, stan projektu wraca do „niezweryfikowany”.
2. Kliknij „Usuń” przy zadaniu 1: strona pokazuje, że jest poprzednikiem zadania 2, i nie ma przycisku usunięcia.
3. Przez „Edytuj” usuń poprzednika z zadania 2 i spróbuj ponownie usunąć zadanie 1: teraz się udaje.
4. Usuń projekt, w którym zadania wskazują na siebie: usunięcie działa.
5. W konsoli bazy (rola `authenticated`) spróbuj usunąć zadanie blokowane oraz cudze zadanie: odmowa.

## Performance Considerations

Usunięcie to jedno zapytanie o zadania projektu (lista zadań, kilkadziesiąt wierszy), jedno usunięcie i jeden wyzwalacz na wiersz; kaskadowe usuwanie projektu dokłada do każdego zadania jedno tanie sprawdzenie istnienia projektu. Wymaganie „zwykłe akcje poniżej 1 sekundy” pozostaje spełnione.

## Migration Notes

- Migracja jest addytywna (polityka i wyzwalacz); istniejące dane nie są zmieniane. Wyzwalacz działa tylko przy usuwaniu, więc nie wpływa na obecne zapisy.
- **Kolejność wdrożenia:** najpierw `npx supabase db push` (ręcznie, po potwierdzeniu użytkownika), potem wdrożenie kodu przez merge. Stary kod na nowej bazie działa (nie usuwa zadań); nowy kod na starej bazie pokazywałby błąd przy próbie usunięcia (brak polityki `delete`).
- S-08 (zmiana numeru) i S-09 (usuwanie specjalności) zmieniają dane, więc cofają stan projektu tym samym wyzwalaczem; S-08 zdejmie wyzwalacz niezmienności numeru i musi zachować regułę blokady usuwania.

## References

- Roadmap: `context/foundation/roadmap.md` (S-07, `task-delete`)
- PRD: `context/foundation/prd.md` (FR-007, US-01, Business Logic)
- Poprzedni wycinek: `context/archive/2026-09-25-project-verified-state/plan.md`
- Wzorce: `src/pages/projects/[id]/delete.astro`, `src/pages/api/projects/[id]/delete.ts`, `src/lib/services/projects.ts` (`deleteProject`), `src/lib/services/tasks.ts`, `src/lib/services/task-routes.ts`, `src/pages/tasks/[id]/edit.astro`
- Migracje: `supabase/migrations/20260926120000_create_tasks.sql`, `20260927120000_update_task.sql`, `20260929120000_project_states.sql`
- Testy: `tests/task-check.test.mjs`, `scripts/smoke.mjs`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Usuwanie zadania: baza, usługa, strony i smoke

#### Automated

- [x] 1.1 Migracja stosuje się na czystej lokalnej bazie: `npx supabase db reset`
- [x] 1.2 Testy jednostkowe (w tym `findDependents`) przechodzą: `npm run test:unit`
- [x] 1.3 Sprawdzenie typów przechodzi: `npx astro check`
- [x] 1.4 Lint przechodzi: `npm run lint`
- [x] 1.5 Build przechodzi: `npm run build`
- [x] 1.6 Smoke przechodzi na lokalnym Supabase i serwerze podglądu: `npm run smoke`
- [ ] 1.7 CI (`ci` i `smoke`) zielone na gałęzi z tą zmianą

#### Manual

- [x] 1.8 Migracja zastosowana na produkcji przed wdrożeniem kodu: `npx supabase db push`
- [x] 1.9 Usunięcie zadania, które nie jest niczyim poprzednikiem, działa (link „Usuń” na liście i na edycji, strona potwierdzenia, powrót na listę) i cofa stan projektu do „niezweryfikowany”
- [x] 1.10 Próba usunięcia zadania, na które wskazują inne, pokazuje komunikat z numerami tych zadań i listę z linkami „Edytuj”, bez przycisku usunięcia
- [x] 1.11 Po usunięciu zależności (przez „Edytuj” zadań blokujących) to samo zadanie da się usunąć
- [x] 1.12 Bezpośredni `POST` usunięcia zadania blokowanego nie usuwa go (zadanie zostaje na liście)
- [x] 1.13 Zalogowany użytkownik nie usunie cudzego zadania (404 na stronie, „nie znaleziono” przy POST)
- [x] 1.14 Usunięcie projektu z zadaniami wskazującymi na siebie działa jak dotąd (kaskada nie jest blokowana)
- [ ] 1.15 Po wdrożeniu na produkcji ten sam cykl działa na prawdziwych danych
