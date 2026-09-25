# Sprawdzenie listy zadań: proste kryteria — Implementation Plan

## Overview

Wycinek S-04 z mapy drogowej (kamień milowy M-2, gwiazda przewodnia), wymagania FR-008 i FR-009 z `context/foundation/prd.md`: kierownik projektu z wybranym projektem otwiera stronę `/tasks/check` (przyciskiem „Sprawdź listę zadań” na `/tasks`) i widzi zadania z problemami trzech rodzajów: nieistniejący poprzednik, brak odpowiedzialności (brak specjalności albo nakład pusty lub równy 0) i duplikat nazwy. Przy każdym zadaniu jest powód. Wynik jest liczony na żądanie z aktualnej listy zadań, bez zapisu w bazie i bez zmian w schemacie. Cykle zależności (S-05), stan projektu (S-06) i usuwanie (S-07–S-09) są poza wycinkiem.

## Current State Analysis

- **Dane do sprawdzenia są gotowe.** `listTasks(db, projectId)` (`src/lib/services/tasks.ts`) zwraca `Task[]` z numerem, nazwą, specjalnością (nazwa lub `null`), nakładem (`number | null`) i poprzednikami jako numerami, posortowanymi po numerze (`toTask`).
- **Definicje z PRD** (Open Questions nr 5): „duplikat” to ta sama nazwa po obcięciu spacji, bez rozróżniania wielkości liter, a oznaczane są wszystkie zadania o tej nazwie; „nieistniejący poprzednik” to numer, którego nie ma w projekcie; „brak odpowiedzialności” to brak specjalności albo nakład pusty lub równy 0. Zadanie wskazujące samo siebie jest blokowane przy zapisie, więc nie trafia do sprawdzenia.
- **Wzorzec strony:** `src/pages/tasks/index.astro` (układ `bg-cosmic`, `getSelectedProject`, „Nie wybrano projektu” z linkiem do `/projects`, komunikat błędu wczytania), link „Edytuj” do `/tasks/[id]/edit`, ochrona logowania przez prefiks `/tasks` w `PROTECTED_ROUTES` (`src/middleware.ts`, dopasowanie `startsWith`).
- **Wzorzec czystej logiki:** wspólne reguły pól w `src/lib/validation/task-fields.ts` (moduł bez zależności od Astro), typy DTO w `src/types.ts`.
- **Smoke** (`scripts/smoke.mjs`): dwie sesje (A, B), kroki zadań i poprawki zadań z M-1; opcje kroków `locationIs`, `locationIncludes`, `bodyIncludes`, `bodyExcludes`.
- **Brak** funkcji sprawdzenia, typów wyniku, strony `/tasks/check` i przycisku na liście zadań.

## Desired End State

Na `/tasks` jest przycisk „Sprawdź listę zadań”. Prowadzi do `/tasks/check`, która dla wybranego projektu liczy sprawdzenie i pokazuje listę zadań z problemami posortowaną po numerze; każde zadanie ma numer, nazwę, listę powodów i link „Edytuj”. Powody: „Nieistniejący poprzednik: 99, 12”, „Brak odpowiedzialności: brak specjalności” / „nakład pusty” / „nakład równy 0” (ich kombinacje), „Duplikat nazwy: zadania 3, 7”. Jedno zadanie może mieć kilka powodów naraz. Gdy sprawdzenie nie znajdzie problemów, strona pokazuje neutralny komunikat, który wprost mówi, że cykle nie są jeszcze sprawdzane i że to nie potwierdza poprawności listy; nigdzie nie ma sformułowania „wszystko w porządku”. Bez wybranego projektu strona pokazuje „Nie wybrano projektu” z linkiem do listy projektów. Cudze zadania nie są widoczne. Weryfikacja: `npm run smoke` przechodzi z nowymi krokami, a `npm run lint`, `npx astro check` i `npm run build` są zielone.

### Key Discoveries:

- **Wynik liczony na żądanie z aktualnej listy** nie wymaga zmian w bazie ani migracji i nigdy nie pokaże nieaktualnego wyniku; zapamiętywanie stanu (S-06) zdecyduje osobno, co przechowywać.
- **Guardrail „bez fałszywego OK”:** przed S-05 brak wykrywania cykli, więc pusta lista problemów nie może być prezentowana jako potwierdzenie poprawności. Komunikat pustego wyniku musi wprost nazwać ograniczenie; S-05 zamieni go na „nie znaleziono problemów”.
- **Kolejność i jednoznaczność:** oznaczane są wszystkie zadania o tej samej nazwie (nie „drugie i kolejne”), więc wynik nie zależy od kolejności wstawienia ani od numeru. Nazwa jest porównywana po `trim()` i `toLowerCase()`; normalizacja spacji wewnątrz nazwy jest poza zakresem (PRD mówi tylko o obcięciu spacji).
- **Nakład równy 0 i pusty to ten sam powód** („brak odpowiedzialności” z PRD), ale komunikat rozróżnia „pusty” i „równy 0”, żeby było jasne, co poprawić.
- **Numer własny nie jest sprawdzany:** wskazanie samego siebie blokuje zapis (S-02, S-03), więc funkcja nie musi go traktować (nie oznacza go jako „nieistniejący poprzednik”, bo numer zadania istnieje).
- Trasa `/tasks/check` nie koliduje z `/tasks/[id]/edit` (dynamiczny segment jest pod `[id]/`), a prefiks `/tasks` już chroni logowaniem.

## What We're NOT Doing

- Wykrywanie cykli zależności i komunikat „nie znaleziono problemów” (S-05).
- Stan projektu „zweryfikowany/niezweryfikowany” i cofanie go po zmianach danych (S-06); zapamiętywanie wyniku w bazie.
- Usuwanie zadań i specjalności, zmiana numeru zadania (S-07, S-08, S-09).
- Automatyczne poprawianie problemów, filtrowanie, sortowanie i eksport wyniku; stronicowanie (kilkadziesiąt zadań).
- Nowy framework testowy: sprawdzenie testuje rozszerzony `scripts/smoke.mjs` (decyzja użytkownika); Vitest może wrócić przy S-05.
- Wykrywanie pominiętych zadań w zakresie (PRD Non-Goals).

## Implementation Approach

Jedna faza od logiki do interfejsu. Czysta funkcja `checkTasks(tasks)` w module bez zależności od Astro liczy problemy z listy `Task[]` (bez dostępu do bazy), strona `/tasks/check` wczytuje zadania przez istniejące `listTasks` i wywołuje funkcję, a przycisk na `/tasks` prowadzi do strony. Autoryzację robią reguły w bazie i middleware, jak dotąd. Kroki smoke dodają zadania z każdym rodzajem problemu (w tym kilka powodów na jednym zadaniu i duplikat w innej wielkości liter) i sprawdzają wynik od strony użytkownika, a dla świeżego projektu bez problemów sprawdzają neutralny komunikat bez „wszystko w porządku”.

## Phase 1: Sprawdzenie zadań: logika, strona i smoke

### Overview

Dodaje typy wyniku, funkcję sprawdzenia, stronę `/tasks/check`, przycisk na liście zadań i kroki smoke. Po tej fazie kierownik uruchamia sprawdzenie i widzi zadania z problemami, a test z perspektywy użytkownika potwierdza wszystkie trzy kryteria na prawdziwej bazie w CI.

### Changes Required:

#### 1. Typy wyniku

**File**: `src/types.ts`

**Intent**: Dodać typy wyniku sprawdzenia obok typów zadania (konwencja „shared types” z CLAUDE.md).

**Contract**: `TaskProblem`: `{ task: Task; missingPredecessors: number[]; noResponsibility: ("no_specialty" | "effort_empty" | "effort_zero")[]; duplicateOf: number[] }` (puste tablice oznaczają brak danego powodu; `duplicateOf` to numery pozostałych zadań o tej samej nazwie); `TaskCheckResult`: `{ problems: TaskProblem[] }`, tylko zadania z co najmniej jednym powodem, posortowane rosnąco po numerze zadania.

#### 2. Funkcja sprawdzenia

**File**: `src/lib/task-check.ts` (nowy)

**Intent**: Policzyć trzy kryteria z PRD na liście zadań jednego projektu, jako czystą funkcję (bez bazy i bez zależności od Astro), żeby S-05 mógł dołożyć czwarte kryterium bez zmiany reszty.

**Contract**: `checkTasks(tasks: Task[]): TaskCheckResult`. Reguły: (a) nieistniejący poprzednik: każdy numer z `predecessors`, którego nie ma wśród numerów zadań listy, trafia do `missingPredecessors`; (b) brak odpowiedzialności: `specialty === null` daje `no_specialty`, `effort === null` daje `effort_empty`, `effort === 0` daje `effort_zero`; (c) duplikat: klucz to `name.trim().toLowerCase()`; zadania o tym samym kluczu (co najmniej dwa) dostają `duplicateOf` z numerami pozostałych zadań tej grupy, rosnąco. Wynik zawiera tylko zadania z niepustym którymkolwiek powodem. Przypadki graniczne do pokrycia w smoke: jedno zadanie z trzema powodami naraz; „Kable” i „kable ” (spacja na końcu, inna wielkość liter) to duplikat; nakład „0” i nakład pusty to dwa różne powody tej samej kategorii; poprzednik wskazujący numer spoza projektu.

#### 3. Strona sprawdzenia

**File**: `src/pages/tasks/check.astro` (nowy)

**Intent**: Pokazać wynik sprawdzenia dla wybranego projektu, w stylu strony listy zadań (`src/pages/tasks/index.astro`).

**Contract**: Układ `bg-cosmic`, tytuł „Sprawdzenie zadań — Plan projektu (WBS)”, nagłówek „Sprawdzenie zadań”, nazwa projektu. Dane z `getSelectedProject` i `listTasks`, wynik z `checkTasks`. Bez wybranego projektu: „Nie wybrano projektu” z linkiem „Przejdź do listy projektów” (jak `/tasks`). Błąd wczytania: „Nie udało się wczytać zadań.” (i „Nie udało się wczytać wybranego projektu.”), bez wyniku. Wynik z problemami: nagłówek z liczbą zadań z problemami i lista wierszy (numer, nazwa, powody jako osobne linie, link „Edytuj” do `/tasks/<id>/edit`); powody: „Nieistniejący poprzednik: 99, 12”, „Brak odpowiedzialności: brak specjalności, nakład pusty” (kombinacje: brak specjalności / nakład pusty / nakład równy 0), „Duplikat nazwy: zadania 3, 7”. Wynik bez problemów: komunikat „Nie znaleziono zadań z problemami w sprawdzanych kryteriach (nieistniejący poprzednik, brak odpowiedzialności, duplikat). Cykle zależności nie są jeszcze sprawdzane, więc to nie potwierdza poprawności listy.”; nigdzie nie występuje „wszystko w porządku” ani „OK”. Link „Wróć do listy zadań” do `/tasks`. Zawsze zawiera zdanie o niesprawdzanych cyklach (także przy wyniku z problemami), żeby ograniczenie było widoczne do S-05.

#### 4. Przycisk na liście zadań

**File**: `src/pages/tasks/index.astro`

**Intent**: Umożliwić uruchomienie sprawdzenia z listy zadań.

**Contract**: Przy wybranym projekcie link stylizowany na przycisk „Sprawdź listę zadań” do `/tasks/check`, w nagłówku strony lub nad listą; niewidoczny bez wybranego projektu.

#### 5. Kroki smoke

**File**: `scripts/smoke.mjs`

**Intent**: Dodać kroki pokrywające FR-008 (trzy kryteria) i FR-009 z perspektywy użytkownika, wkomponowane w istniejący przepływ (A z zadaniami, B bez wyboru).

**Contract**: Nowe kroki: niezalogowany `GET /tasks/check` przekierowuje na `/auth/signin`; A po krokach zadań dodaje zadania kontrolne z unikalnymi nazwami (numery spoza używanych dotąd w smoke, np. od 10): dwa zadania o nazwach różniących się tylko wielkością liter i spacją na końcu (oba ze specjalnością i nakładem), zadanie ze specjalnością i nakładem `0`, zadanie z poprzednikiem `999` (ze specjalnością i nakładem), oraz zadanie poprawne (specjalność, nakład `1`, poprzednik jedno z dodanych); `GET /tasks/check` A zwraca 200 i zawiera: powód duplikatu przy obu zadaniach z nazwą, „nakład równy 0”, „Nieistniejący poprzednik” z numerem `999`, zdanie o niesprawdzanych cyklach, a nie zawiera nazwy zadania poprawnego ani „wszystko w porządku”; jedno z wcześniejszych zadań smoke z kilkoma brakami pokazuje kilka powodów (specjalność i nakład) jednocześnie. Przypadek bez problemów: B tworzy własny projekt, wybiera go, dodaje jedno zadanie poprawne (ze specjalnością i nakładem), a `GET /tasks/check` B zwraca 200 z komunikatem „Nie znaleziono zadań z problemami”, zdaniem o niesprawdzanych cyklach i bez „wszystko w porządku” (kroki B wstaw tak, żeby nie psuły istniejących kroków „B bez wybranego projektu”); B bez wybranego projektu widzi na `/tasks/check` „Nie wybrano projektu”, a wynik B nie zawiera zadań A. Kroki A wstaw przed usunięciem projektu. Używaj `bodyIncludes`/`bodyExcludes` na fragmentach bez polskich znaków, jak w istniejących krokach.

### Success Criteria:

#### Automated Verification:

- Sprawdzenie typów przechodzi: `npx astro check`
- Lint przechodzi (w tym `scripts/`): `npm run lint`
- Build przechodzi: `npm run build`
- Smoke przechodzi na lokalnym Supabase i serwerze podglądu: `npm run smoke`
- CI (`ci` i `smoke`) zielone na gałęzi z tą zmianą

#### Manual Verification:

- Na `/tasks` przy wybranym projekcie jest przycisk „Sprawdź listę zadań”, a bez wybranego projektu go nie ma
- `/tasks/check` bez wybranego projektu pokazuje „Nie wybrano projektu” z linkiem do listy projektów
- Dla projektu z zadaniami: nieistniejący poprzednik, brak specjalności, nakład pusty i równy 0 oraz duplikat nazwy w innej wielkości liter są widoczne z powodami; jedno zadanie z kilkoma problemami pokazuje wszystkie powody
- Dla projektu bez problemów strona pokazuje neutralny komunikat z zastrzeżeniem o cyklach i nigdzie nie mówi „wszystko w porządku”
- Link „Edytuj” przy zadaniu z problemem prowadzi do jego edycji, a po poprawce ponowne otwarcie `/tasks/check` nie pokazuje już tego problemu
- Sprawdzenie kilkudziesięciu zadań kończy się widocznym wynikiem w czasie poniżej 1 sekundy

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- Brak nowego frameworka testowego (decyzja użytkownika: tylko smoke, jak w M-1). Logika `checkTasks` jest czystą funkcją, więc przy S-05 (cykle) można rozważyć testy jednostkowe. Przypadki brzegowe (kilka powodów, wielkość liter i spacja w nazwie, nakład 0 kontra pusty, poprzednik spoza projektu) są objęte krokami smoke.

### Integration Tests:

- `npm run smoke` na lokalnym Supabase: trzy kryteria z powodami, kilka powodów na jednym zadaniu, duplikat w innej wielkości liter, neutralny komunikat dla projektu bez problemów, „Nie wybrano projektu”, izolacja użytkowników, ochrona logowaniem.

### Manual Testing Steps:

1. Zaloguj się, wybierz projekt i dodaj zadania z każdym rodzajem problemu (poprzednik `999`, brak specjalności, nakład puste i `0`, dwie takie same nazwy).
2. Kliknij „Sprawdź listę zadań” na `/tasks` i sprawdź powody.
3. Użyj „Edytuj”, popraw problem, wróć i otwórz sprawdzenie ponownie.
4. Dla projektu bez problemów sprawdź komunikat i brak sformułowania „wszystko w porządku”.
5. Na drugim koncie sprawdź „Nie wybrano projektu” i brak cudzych zadań.

## Performance Considerations

Wymaganie z PRD: sprawdzenie kilkudziesięciu zadań w kilka do kilkunastu sekund; tu wynik to jedno zapytanie o zadania i przejście po liście w pamięci (złożoność liniowa względem zadań i poprzedników), więc kończy się w ułamku sekundy. Bez stronicowania i bez zapisu w bazie.

## Migration Notes

- Brak migracji i zmian w bazie; wdrożenie samego kodu (`deploy` w CI) wystarcza, a produkcyjny `supabase db push` nie jest potrzebny.
- S-05 doda czwarte kryterium (cykle) do `checkTasks` i zamieni neutralny komunikat na „nie znaleziono problemów”; S-06 zdecyduje, czy i jak zapamiętać wynik.

## References

- Roadmap: `context/foundation/roadmap.md` (S-04, `task-check-problems`)
- PRD: `context/foundation/prd.md` (FR-008, FR-009, US-01, Business Logic, Open Questions nr 5)
- Poprzednie wycinki: `context/archive/2026-09-25-task-add/plan.md`, `context/archive/2026-09-25-task-edit/plan.md`
- Dane zadań: `src/lib/services/tasks.ts` (`listTasks`, `toTask`), typ `Task` w `src/types.ts`
- Wzorzec strony i stanów: `src/pages/tasks/index.astro`
- Wzorzec czystej logiki: `src/lib/validation/task-fields.ts`
- Ochrona tras: `src/middleware.ts`
- Smoke test: `scripts/smoke.mjs`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Sprawdzenie zadań: logika, strona i smoke

#### Automated

- [x] 1.1 Sprawdzenie typów przechodzi: `npx astro check`
- [x] 1.2 Lint przechodzi (w tym `scripts/`): `npm run lint`
- [x] 1.3 Build przechodzi: `npm run build`
- [x] 1.4 Smoke przechodzi na lokalnym Supabase i serwerze podglądu: `npm run smoke`
- [ ] 1.5 CI (`ci` i `smoke`) zielone na gałęzi z tą zmianą

#### Manual

- [x] 1.6 Na `/tasks` przy wybranym projekcie jest przycisk „Sprawdź listę zadań”, a bez wybranego projektu go nie ma
- [x] 1.7 `/tasks/check` bez wybranego projektu pokazuje „Nie wybrano projektu” z linkiem do listy projektów
- [x] 1.8 Dla projektu z zadaniami: nieistniejący poprzednik, brak specjalności, nakład pusty i równy 0 oraz duplikat nazwy w innej wielkości liter są widoczne z powodami; jedno zadanie z kilkoma problemami pokazuje wszystkie powody
- [x] 1.9 Dla projektu bez problemów strona pokazuje neutralny komunikat z zastrzeżeniem o cyklach i nigdzie nie mówi „wszystko w porządku”
- [x] 1.10 Link „Edytuj” przy zadaniu z problemem prowadzi do jego edycji, a po poprawce ponowne otwarcie `/tasks/check` nie pokazuje już tego problemu
- [x] 1.11 Sprawdzenie kilkudziesięciu zadań kończy się widocznym wynikiem w czasie poniżej 1 sekundy
