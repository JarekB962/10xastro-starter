# Zmiana numeru zadania — Implementation Plan

## Overview

Wycinek S-08 z mapy drogowej (kamień milowy M-2), wymaganie FR-007 (zmiana numeru zadania automatycznie poprawia numer u wszystkich zadań, dla których jest ono poprzednikiem) i US-01 z `context/foundation/prd.md`: kierownik zmienia numer zadania w formularzu edycji, a aplikacja przepisuje ten numer u zadań, które miały je jako poprzednika; zajęty numer jest odrzucany, a numer, który inne zadania już wpisały jako poprzednika (wiszące odwołanie, np. literówka), też jest odrzucany z listą tych zadań (decyzja użytkownika). Przepisywanie robi wyzwalacz w bazie, który zastępuje wyzwalacz niezmienności numeru z S-03, więc zmiana numeru i poprawa poprzedników zapisują się razem albo wcale, także przy zapisie prosto przez API. Usuwanie specjalności (S-09) jest poza wycinkiem.

## Current State Analysis

- **Numer jest dziś zablokowany w bazie:** wyzwalacz `tasks_prevent_number_change` (`supabase/migrations/20260927120000_update_task.sql`) odrzuca każdą zmianę `number` („Numer zadania jest niezmienny.”); komentarz w planie S-03: „FR-007 będzie musiał ten wyzwalacz zdjąć albo obejść”.
- **Poprzednik to numer, nie klucz obcy:** `task_predecessors (task_id, predecessor_number)` z kluczem głównym `(task_id, predecessor_number)`; polityki tylko `select`, `insert`, `delete` (bez `update`); wyzwalacz `prevent_self_predecessor` działa na `insert or update` (`20260926120000_create_tasks.sql`). Numer zadania jest unikalny w projekcie (`tasks_project_number_key`), więc zajęty numer daje `23505`.
- **`update_task`** (`20260927120000_update_task.sql`, `security invoker`) zmienia nazwę, specjalność, nakład i całą listę poprzedników w jednej transakcji, bez numeru; usługa `updateTask` (`src/lib/services/tasks.ts`) woła go przez RPC z nazwanymi argumentami `p_id`, `p_name`, `p_specialty_id`, `p_effort`, `p_predecessors`.
- **Formularz edycji:** `TaskForm` z `fixedNumber` pokazuje numer jako tekst, bez pola `task_number`; `POST /api/tasks/[id]` (`src/pages/api/tasks/[id]/index.ts`) bierze numer z zapisanego zadania (`getTask`), a `parseTaskUpdateInput(form, taskNumber)` (`src/lib/validation/task.ts`) ignoruje `task_number`; smoke ma krok, w którym poprawka z `task_number=99` zostawia numer 1.
- **Stan projektu (S-06):** wyzwalacze licznika na `tasks` i `task_predecessors` obsługują `update`, więc zmiana numeru i przepisanie poprzedników cofają stan bez zmian w aplikacji.
- **Wykrywanie zadań wskazujących na numer:** `findDependents(tasks, number)` (`src/lib/task-dependents.ts`, S-07) zwraca zadania z danym numerem wśród poprzedników.
- **Kolejność wdrożenia:** stary kod woła `update_task` z 5 nazwanymi argumentami; migracja musi to zachować do czasu wdrożenia nowego kodu.

## Desired End State

Na stronie edycji zadania pole „Numer zadania” jest edytowalne (wstępnie wypełnione bieżącym numerem). Zapis z nowym numerem zmienia numer zadania i przepisuje stary numer na nowy u wszystkich zadań projektu, które miały je jako poprzednika, w jednej transakcji; lista zadań i sprawdzenie pokazują już nowy numer. Zapis z zajętym numerem kończy się komunikatem „Zadanie o takim numerze już istnieje.”. Zapis z numerem, który inne zadania mają wpisany jako poprzednika (np. zadanie 3 ma poprzednika 7, a zadania 7 nie ma), kończy się komunikatem „Numer 7 jest już wpisany jako poprzednik w zadaniach: 3. Popraw ich poprzedników i spróbuj ponownie.”, a zadanie zostaje z dotychczasowym numerem. Numer równy któremuś z poprzedników edytowanego zadania jest odrzucony jako „własny poprzednik”. Bezpośrednia zmiana `number` przez API bazy też przepisuje poprzedników (albo jest odrzucana w tych samych przypadkach). Zmiana numeru cofa stan projektu do „niezweryfikowany”. `npm run test:unit`, `astro check`, lint, build i smoke przechodzą, a migracja jest zastosowana na produkcji przed wdrożeniem kodu, przy czym stary kod działa na nowej bazie.

### Key Discoveries:

- **Wyzwalacz `after update` na `tasks` (przy zmianie `number`) zastępuje wyzwalacz niezmienności:** najpierw odrzuca zmianę na numer własnego poprzednika (`23514`, „Zadanie nie może być własnym poprzednikiem.”) i na numer, który inne zadania projektu mają wpisany jako poprzednika (`23001`, z listą numerów tych zadań w komunikacie), a potem przepisuje `predecessor_number` ze starego numeru na nowy u zadań tego samego projektu. Ponieważ odrzucamy wiszące odwołania do nowego numeru, przepisanie nigdy nie tworzy duplikatu klucza `(task_id, predecessor_number)`, więc scalanie duplikatów jest zbędne.
- **Wyzwalacz musi być `security definer`:** `task_predecessors` nie ma polityki `update`, a zmiana numeru to `update` wiersza poprzednika; funkcja działa tylko na zadaniach projektu zmienianego zadania, do którego użytkownik już ma prawo zapisu (przeszedł RLS na `tasks`), a `set search_path = ''` i brak uprawnień wykonania dla ról użytkownika są jak w wyzwalaczach z S-06.
- **`update_task` z numerem jako nowa przeciążona wersja:** 6 nazwanych argumentów z `p_number` (bez wartości domyślnej), obok dotychczasowej 5-argumentowej, którą zostawiamy do czasu wdrożenia nowego kodu (PostgREST wybiera funkcję po nazwach argumentów, więc stary kod nadal działa na nowej bazie); starą usuniemy w osobnej migracji po wdrożeniu.
- **Kolejność w nowej funkcji ma znaczenie:** najpierw usunięcie własnych poprzedników zadania, potem zmiana numeru (i pól), potem wstawienie nowej listy poprzedników. Inaczej stary wpis poprzednika równy nowemu numerowi zablokowałby zapis, choć użytkownik go usuwa w tym samym formularzu; wyjątek w środku cofa całość.
- **Guardrail „bez wiszących odwołań”:** brak zmiany po cichu na zadanie wskazywane jako „nieistniejący poprzednik” chroni przed fałszywym „OK” (nowa zależność, której kierownik nie chciał).
- **Stan projektu cofa się sam:** wystarczy krok smoke.

## What We're NOT Doing

- Osobna strona „Zmień numer” (decyzja użytkownika: pole w formularzu edycji).
- Przepinanie wiszących odwołań na nowy numer (decyzja użytkownika: odrzucamy).
- Zmiana numeru w formularzu dodawania (numer i tak wpisuje się przy dodawaniu), masowa renumeracja i przesuwanie numerów.
- Usunięcie starej, 5-argumentowej wersji `update_task` (osobna migracja po wdrożeniu).
- Zmiany w stanie projektu, w sprawdzeniu listy zadań i w usuwaniu zadań i specjalności.
- Osobny komunikat po zapisie o liczbie przepisanych poprzedników.

## Implementation Approach

Jedna faza od bazy do interfejsu. Migracja zdejmuje wyzwalacz niezmienności, dodaje wyzwalacz przepisujący poprzedników (z odrzuceniami) i przeciążoną `update_task` z numerem; typy, walidacja i usługa przyjmują numer, usługa mapuje `23505` i `23001` na czytelne błędy z listą zadań; formularz i trasa edycji traktują numer jak zwykłe pole; smoke sprawdza przepisanie poprzedników, zajęty numer, wiszące odwołanie i cofnięcie stanu, a celowe wyłączenie wyzwalacza musi czerwienić smoke.

## Critical Implementation Details

- **Timing & lifecycle:** kolejność w `update_task` (usunięcie własnych poprzedników → zmiana numeru i pól → wstawienie nowej listy) jest wymagana; wyzwalacz przy zmianie numeru sprawdza własnych poprzedników zapisanego zadania, więc stara lista musi już zniknąć.
- **Migracja addytywna:** stara 5-argumentowa `update_task` zostaje w bazie; nowy kod woła wersję 6-argumentową, a stary kod (do wdrożenia) nadal działa.

## Phase 1: Zmiana numeru: baza, usługa, formularz i smoke

### Overview

Dodaje zmianę numeru zadania w formularzu edycji z automatycznym przepisaniem poprzedników w bazie, odrzucaniem zajętego numeru, numeru własnego poprzednika i numeru z wiszącymi odwołaniami. Po tej fazie kierownik przenumerowuje zadania bez wiszących odwołań, a stan projektu cofa się po każdej zmianie numeru.

### Changes Required:

#### 1. Migracja: wyzwalacz przepisujący poprzedników i `update_task` z numerem

**File**: `supabase/migrations/20261003120000_task_renumber.sql` (nowy)

**Intent**: Zdjąć niezmienność numeru tak, by zmiana numeru zawsze przepisywała poprzedników w tej samej transakcji, i dodać zapis zadania z numerem.

**Contract**: (a) `drop trigger tasks_prevent_number_change on public.tasks` i `drop function public.prevent_task_number_change()`. (b) Funkcja wyzwalacza `public.handle_task_number_change()` (`security definer`, `set search_path = ''`, `revoke execute … from public, anon, authenticated`) i wyzwalacz `tasks_handle_number_change` `after update on public.tasks for each row when (old.number is distinct from new.number)`. Kolejność w funkcji: (1) jeśli `task_predecessors` zadania `new.id` zawiera `new.number`: wyjątek „Zadanie nie może być własnym poprzednikiem.” z kodem `check_violation`; (2) jeśli inne zadania tego samego projektu (`t.id <> new.id`, `t.project_id = new.project_id`) mają `new.number` w `task_predecessors`: wyjątek „Numer N jest już wpisany jako poprzednik w zadaniach: 3, 5.” (numery zadań rosnąco przez `string_agg`) z kodem `restrict_violation` (`23001`); (3) `update public.task_predecessors p set predecessor_number = new.number from public.tasks t where p.task_id = t.id and t.project_id = new.project_id and p.predecessor_number = old.number`. (c) Przeciążona `public.update_task(p_id uuid, p_number integer, p_name text, p_specialty_id uuid, p_effort numeric, p_predecessors integer[]) returns public.tasks` (`security invoker`, `set search_path = ''`, bez wartości domyślnych): `delete from public.task_predecessors where task_id = p_id`; `update public.tasks set number = p_number, name = …, specialty_id = …, effort = … where id = p_id returning * into v_task`; brak wiersza = wyjątek `P0002` „Nie znaleziono zadania.”; wstawienie `select distinct` z `p_predecessors`; `revoke execute … from public, anon`, `grant execute … to authenticated`. Stara 5-argumentowa `update_task` pozostaje bez zmian. Komentarze po polsku, jak w pozostałych migracjach.

#### 2. Typy bazy i dane poprawki

**File**: `src/types.ts`

**Intent**: Opisać nową sygnaturę i przenieść numer do danych poprawki.

**Contract**: `Database["public"]["Functions"]["update_task"]` dostaje argumenty `p_id`, `p_number`, `p_name`, `p_specialty_id`, `p_effort`, `p_predecessors` (stara 5-argumentowa wersja zostaje tylko w bazie, nie w typach). `TaskUpdateInput` dostaje `number: number`. `TaskServiceError` dostaje kod `number_referenced`. Typ wyniku `UpdateTaskResult`: `{ ok: true; data: { id: string } }`, `{ ok: false; error: <pozostałe kody> }` albo `{ ok: false; error: "number_referenced"; dependents: Task[] }`.

#### 3. Walidacja

**File**: `src/lib/validation/task.ts`

**Intent**: Poprawka zadania czyta numer z formularza jak dodawanie.

**Contract**: `parseTaskUpdateInput(form)` (bez drugiego argumentu) waliduje `task_number` tym samym schematem co `parseTaskInput` (wymagany, liczba całkowita od 1) i pozostałe pola przez `parseSharedFields(form, number)`, więc numer równy któremuś z poprzedników daje „Zadanie nie może być własnym poprzednikiem.”; wynik `ParsedTaskUpdateInput` zawiera `number`. Reguły pól bez zmian.

#### 4. Usługa

**File**: `src/lib/services/tasks.ts`

**Intent**: Zapisać poprawkę z numerem i przełożyć błędy bazy na czytelne wyniki.

**Contract**: `updateTask(db, id, input)` woła RPC `update_task` z `p_number` (pozostałe argumenty jak dotąd) i zwraca `UpdateTaskResult`. Mapowanie błędów: `23505` → `duplicate_number` (komunikat „Zadanie o takim numerze już istnieje.” już istnieje), `23001` → `number_referenced` z listą zadań z `listTasks` projektu i `findDependents(tasks, input.number)` bez edytowanego zadania (przy pustej liście `unexpected`), `23514` → komunikat „własny poprzednik” zamiast `unexpected`. Nowa funkcja składająca komunikat „Numer 7 jest już wpisany jako poprzednik w zadaniach: 3, 5. Popraw ich poprzedników i spróbuj ponownie.”; `TASK_ERROR_MESSAGES` uzupełnione, by rekord pozostał kompletny.

#### 5. Trasa i strona edycji, formularz

**File**: `src/pages/api/tasks/[id]/index.ts`, `src/pages/tasks/[id]/edit.astro`, `src/components/tasks/TaskForm.tsx`

**Intent**: Numer staje się zwykłym, edytowalnym polem formularza edycji.

**Contract**: `TaskForm` traci właściwość `fixedNumber`: pole „Numer zadania” jest zawsze pokazane i walidowane w przeglądarce (wymagane, liczba całkowita od 1, różne od poprzedników jak dotąd); fokus w trybie edycji zostaje w polu nazwy (jak dziś), a przy dodawaniu na numerze. Strona edycji przekazuje `initial.number` z `?task_number=` po błędzie albo z zapisanego numeru. Trasa `POST /api/tasks/[id]`: `getTask` nadal daje 404 dla cudzego i nieistniejącego zadania; `parseTaskUpdateInput(form)` bierze numer z formularza; błędy walidacji i usługi odsyłają na stronę edycji z `?error=` i wpisanymi wartościami razem z `task_number` (funkcja odsyłająca wartości formularza nie usuwa już numeru); `number_referenced` używa komunikatu z listą numerów. Po sukcesie przekierowanie na `/tasks` jak dotąd.

#### 6. Kroki smoke

**File**: `scripts/smoke.mjs`

**Intent**: Pokryć zmianę numeru, przepisanie poprzedników, odrzucenia i cofnięcie stanu na prawdziwej bazie oraz dostosować krok, który zakładał niezmienność numeru.

**Contract**: Istniejący krok poprawki zadania z przesłanym `task_number=99` zakłada, że numer się nie zmienia; ta asercja jest jedyną świadomą zmianą istniejącego kroku: po S-08 krok wysyła aktualny numer zadania (bez zmiany numeru) i sprawdza, że numer zostaje. Nowe kroki (asercje na fragmentach bez polskich znaków, dokładne fragmenty ustal na faktycznym HTML, oczekiwania z identyfikatorami podawaj jako funkcje): sesja A (użyj zadań spoza cyklu 20–22 i spoza zadania 23, żeby nie ruszać istniejących asercji): zmiana numeru zadania, na które wskazuje inne zadanie, przekierowuje na `/tasks`; lista pokazuje nowy numer, brak starego, a zadanie zależne ma teraz nowy numer w poprzednikach; sprawdzenie (`/tasks/check`) nie zgłasza „nieistniejącego poprzednika” dla przepisanego zadania; zmiana na numer zajęty przez inne zadanie przekierowuje na stronę edycji z komunikatem o zajętym numerze i numer zostaje; zmiana na numer, który inne zadanie ma wpisany jako poprzednika (istniejące zadanie z wiszącym poprzednikiem 998), przekierowuje na stronę edycji z komunikatem o zadaniach z tym poprzednikiem i numer zostaje; zmiana na numer równy własnemu poprzednikowi daje komunikat „własny poprzednik”. Sesja B: po zmianie numeru zadania stan „zweryfikowany” cofa się do „niezweryfikowany” (pulpit i lista zadań), a kolejne sprawdzenie przywraca „zweryfikowany”; B nie zmieni numeru zadania A (`POST` z komunikatem „nie znaleziono”, numer A bez zmian). Istniejące kroki usuwania projektu z zadaniami (kaskada) pozostają; nowe kroki wstaw przed usunięciem projektów.

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
- Zmiana numeru zadania w formularzu edycji działa: zadania, które miały je jako poprzednika, mają nowy numer w poprzednikach, a sprawdzenie nie zgłasza z tego powodu problemu
- Zmiana na numer zajęty przez inne zadanie jest odrzucona komunikatem, a numer zostaje
- Zmiana na numer, który inne zadanie ma wpisany jako poprzednika (np. literówka), jest odrzucona komunikatem z numerami tych zadań; po poprawie ich poprzedników zmiana się udaje
- Zmiana numeru na numer własnego poprzednika jest odrzucona („własny poprzednik”)
- Zmiana numeru cofa stan projektu do „niezweryfikowany”, a sprawdzenie bez problemów przywraca „zweryfikowany”
- Cudzego zadania nie da się przenumerować (404 na stronie, „nie znaleziono” przy POST)
- Zwykła poprawka zadania bez zmiany numeru działa jak dotąd, a usuwanie zadania i projektu działa jak dotąd
- Po wdrożeniu na produkcji ten sam cykl działa na prawdziwych danych

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- Bez nowych testów jednostkowych: logika przepisywania jest w bazie, a `findDependents` (użyte do komunikatu) ma testy z S-07; istniejące testy (`npm run test:unit`) pilnują regresji. Walidacja `parseTaskUpdateInput` importuje zod i alias `@/`, więc nie jest ładowana w Node bez transpilacji; pokrywa ją smoke.

### Integration Tests:

- `npm run smoke` na lokalnym Supabase: przepisanie poprzedników po zmianie numeru, zajęty numer, wiszące odwołanie, numer równy własnemu poprzednikowi, cofnięcie stanu i przywrócenie po sprawdzeniu, izolacja użytkowników A i B, zwykła poprawka bez zmiany numeru.
- **Celowy test zepsucia (wykonuje implementujący):** wyłączyć w lokalnej bazie wyzwalacz `tasks_handle_number_change` (`alter table public.tasks disable trigger tasks_handle_number_change`) i sprawdzić, że krok smoke o przepisaniu poprzedników czerwieni się (zadanie zależne zostaje ze starym numerem); potem włączyć wyzwalacz z powrotem.

### Manual Testing Steps:

1. Dodaj zadania 1, 2 (poprzednik 1) i 3 (poprzednik 1); w edycji zadania 1 zmień numer na 10: zadania 2 i 3 mają teraz poprzednika 10, sprawdzenie nie zgłasza „nieistniejącego poprzednika”, stan projektu wraca do „niezweryfikowany”.
2. Spróbuj zmienić numer zadania 2 na 3 (zajęty): komunikat, numer zostaje.
3. Dodaj zadanie 4 z poprzednikiem 99 (nieistniejący) i spróbuj zmienić numer zadania 3 na 99: komunikat z numerem zadania 4; popraw poprzednika zadania 4 i spróbuj ponownie: udaje się.
4. Zmień numer zadania na numer jego własnego poprzednika: komunikat „własny poprzednik”.
5. W konsoli bazy (rola `authenticated`) zmień `number` zadania bezpośrednio: poprzednicy są przepisani (albo zmiana odrzucona w tych samych przypadkach).

## Performance Considerations

Zmiana numeru to jedna transakcja: usunięcie i wstawienie poprzedników edytowanego zadania oraz jeden `update` wierszy poprzedników w projekcie; przy kilkudziesięciu zadaniach pomijalne. Wymaganie „zwykłe akcje poniżej 1 sekundy” pozostaje spełnione.

## Migration Notes

- Migracja jest addytywna dla aplikacji: usuwa tylko wyzwalacz niezmienności numeru, dodaje wyzwalacz i przeciążoną funkcję. Stary kod (5-argumentowa `update_task`, brak zmiany numeru) działa na nowej bazie; nowy kod na starej bazie nie zmieniłby numeru (brak 6-argumentowej funkcji), więc kolejność to `npx supabase db push` (ręcznie, po potwierdzeniu użytkownika), potem wdrożenie kodu przez merge.
- **Do posprzątania po wdrożeniu:** usunąć starą 5-argumentową `update_task` osobną migracją (poza zakresem tego wycinka).
- Obie zmiany numeru (formularz i bezpośrednie API) przechodzą przez ten sam wyzwalacz, więc reguła obowiązuje także dla przyszłych ścieżek zapisu.
- S-09 (usuwanie specjalności) dotyka tego samego `smoke.mjs`; wycinki idą po kolei.

## References

- Roadmap: `context/foundation/roadmap.md` (S-08, `task-renumber`)
- PRD: `context/foundation/prd.md` (FR-007, US-01, Open Questions)
- Poprzedni wycinek edycji: `context/archive/2026-09-25-task-edit/plan.md` (niezmienność numeru, `update_task`)
- Wzorce: `supabase/migrations/20260927120000_update_task.sql`, `20260929120000_project_states.sql`, `20261001120000_task_delete.sql`
- Kod: `src/lib/services/tasks.ts`, `src/lib/validation/task.ts`, `src/lib/task-dependents.ts`, `src/pages/api/tasks/[id]/index.ts`, `src/pages/tasks/[id]/edit.astro`, `src/components/tasks/TaskForm.tsx`
- Smoke: `scripts/smoke.mjs`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Zmiana numeru: baza, usługa, formularz i smoke

#### Automated

- [x] 1.1 Migracja stosuje się na czystej lokalnej bazie: `npx supabase db reset` — ecde3ba
- [x] 1.2 Testy jednostkowe (regresja): `npm run test:unit` — ecde3ba
- [x] 1.3 Sprawdzenie typów przechodzi: `npx astro check` — ecde3ba
- [x] 1.4 Lint przechodzi: `npm run lint` — ecde3ba
- [x] 1.5 Build przechodzi: `npm run build` — ecde3ba
- [x] 1.6 Smoke przechodzi na lokalnym Supabase i serwerze podglądu: `npm run smoke` — ecde3ba
- [ ] 1.7 CI (`ci` i `smoke`) zielone na gałęzi z tą zmianą

#### Manual

- [x] 1.8 Migracja zastosowana na produkcji przed wdrożeniem kodu: `npx supabase db push` — ecde3ba
- [x] 1.9 Zmiana numeru zadania w formularzu edycji działa: zadania, które miały je jako poprzednika, mają nowy numer w poprzednikach, a sprawdzenie nie zgłasza z tego powodu problemu — ecde3ba
- [x] 1.10 Zmiana na numer zajęty przez inne zadanie jest odrzucona komunikatem, a numer zostaje — ecde3ba
- [x] 1.11 Zmiana na numer, który inne zadanie ma wpisany jako poprzednika (np. literówka), jest odrzucona komunikatem z numerami tych zadań; po poprawie ich poprzedników zmiana się udaje — ecde3ba
- [x] 1.12 Zmiana numeru na numer własnego poprzednika jest odrzucona („własny poprzednik”) — ecde3ba
- [x] 1.13 Zmiana numeru cofa stan projektu do „niezweryfikowany”, a sprawdzenie bez problemów przywraca „zweryfikowany” — ecde3ba
- [x] 1.14 Cudzego zadania nie da się przenumerować (404 na stronie, „nie znaleziono” przy POST) — ecde3ba
- [x] 1.15 Zwykła poprawka zadania bez zmiany numeru działa jak dotąd, a usuwanie zadania i projektu działa jak dotąd — ecde3ba
- [ ] 1.16 Po wdrożeniu na produkcji ten sam cykl działa na prawdziwych danych
