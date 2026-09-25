# Sprawdzenie listy zadań: cykle zależności — Implementation Plan

## Overview

Wycinek S-05 z mapy drogowej (kamień milowy M-2), wymagania FR-008 (czwarte kryterium: cykle zależności), FR-009 i US-01 z `context/foundation/prd.md`: sprawdzenie listy zadań (`/tasks/check`) oznacza zadania leżące na cyklu zależności, a wynik bez problemów mówi „nie znaleziono problemów”, bo od tego wycinka działają wszystkie cztery kryteria. Zadania na cyklu dostają powód „Cykl zależności: zadania 3, 5, 7” (lista wszystkich zadań tej grupy wzajemnie zależnych). Algorytm ma testy jednostkowe uruchamiane wbudowanym `node:test` (bez nowej zależności), a smoke sprawdza cykle od strony użytkownika. Stan projektu (S-06) i usuwanie (S-07–S-09) są poza wycinkiem.

## Current State Analysis

- **Miejsce zmiany istnieje (S-04):** `checkTasks(tasks: Task[])` w `src/lib/task-check.ts` to czysta funkcja bez bazy i bez zależności od Astro; zwraca `TaskCheckResult` z `TaskProblem[]` (`missingPredecessors`, `noResponsibility`, `duplicateOf`). Importuje tylko typy z `@/types` (`import type`), więc ładuje się w Node bez transpilacji (sprawdzone: `node --experimental-strip-types` na Node 22.14).
- **Strona** `src/pages/tasks/check.astro` składa powody w `reasons(problem)` i pokazuje neutralny komunikat pustego wyniku z zastrzeżeniem o cyklach oraz zdanie „Cykle zależności nie są jeszcze sprawdzane.” także przy wyniku z problemami.
- **Smoke** (`scripts/smoke.mjs`) sprawdza dziś obecność fragmentu „Cykle zale” w wyniku A i w wyniku B bez problemów; te asercje trzeba odwrócić.
- **Definicje z PRD** (Open Questions nr 5): cykl to co najmniej dwa zadania zależne od siebie bezpośrednio lub pośrednio; oznaczane są wszystkie zadania leżące na cyklu; zadanie wskazujące samo siebie jest blokowane przy zapisie i nie trafia do sprawdzenia. Poprzednik to numer zadania; numer spoza projektu to osobny powód („nieistniejący poprzednik”) i nie tworzy krawędzi grafu.
- **CI** (`.github/workflows/ci.yml`): job `ci` uruchamia `npm ci`, `astro sync`, lint, `astro check`, build (Node 22); `package.json` nie ma skryptu testów. **Brak** testów jednostkowych i frameworka testowego.

## Desired End State

`/tasks/check` pokazuje przy zadaniach leżących na cyklu powód „Cykl zależności: zadania …” z numerami wszystkich zadań danej grupy (rosnąco, razem z bieżącym zadaniem). Zadanie, które tylko zależy od cyklu (ale samo w nim nie leży), nie jest oznaczane z tego powodu. Cykle łączą się z pozostałymi powodami na tym samym zadaniu. Gdy żadne z czterech kryteriów nie znajdzie problemu, strona pokazuje „Nie znaleziono problemów w sprawdzanych kryteriach (nieistniejący poprzednik, brak odpowiedzialności, duplikat, cykl zależności).” i nigdzie nie ma zastrzeżenia o niesprawdzanych cyklach. `npm run test:unit` przechodzi lokalnie i w CI, a `npm run smoke`, lint, `astro check` i build są zielone.

### Key Discoveries:

- **„Zadania leżące na cyklu” to zadania w silnie spójnych składowych grafu zależności o rozmiarze co najmniej 2** (silnie spójna składowa to grupa zadań, z których każde jest osiągalne z każdego przez zależności). W takiej składowej każde zadanie leży na jakimś cyklu, a zadanie spoza składowej nie, więc definicja z PRD jest jednoznaczna i nie zależy od wyboru „jednej ścieżki”.
- **Kierunek krawędzi nie ma znaczenia dla wyniku** (cykl jest cyklem w obu kierunkach), więc krawędź to „zadanie → jego poprzednik” tylko dla istniejących numerów.
- **Nieistniejący poprzednik nie tworzy krawędzi**; zadanie z takim poprzednikiem może nadal leżeć na cyklu z innymi zadaniami (oba powody widoczne razem).
- **Guardrail „bez fałszywego OK”** przenosi się tu na testy: błąd algorytmu daje dokładnie fałszywe „nie znaleziono problemów”, więc przypadki brzegowe są pokryte testami jednostkowymi, a nie tylko smoke.
- **Testy bez zależności:** `task-check.ts` importuje tylko typy, więc wbudowany runner `node:test` z flagą `--experimental-strip-types` (Node 22) uruchamia moduł wprost; w Node 22.18+ flaga jest niepotrzebna, ale nadal akceptowana.

## What We're NOT Doing

- Stan projektu „zweryfikowany/niezweryfikowany” i zapamiętywanie wyniku (S-06).
- Usuwanie zadań i specjalności, zmiana numeru zadania (S-07, S-08, S-09).
- Pokazywanie jednej konkretnej ścieżki cyklu („3 → 5 → 7 → 3”); pokazujemy grupę zadań na cyklu (decyzja użytkownika).
- Framework testowy (Vitest) i testy komponentów; testujemy tylko czystą funkcję `checkTasks`.
- Zmiany w bazie i migracje (`db push` niepotrzebny).
- Filtrowanie, sortowanie i eksport wyniku sprawdzenia.

## Implementation Approach

Jedna faza od logiki do interfejsu. Algorytm silnie spójnych składowych (Tarjan lub Kosaraju, iteracyjny, żeby nie zależeć od głębokości stosu) dokłada pole `cycleWith` do `TaskProblem` i jest pokryty testami `node:test`; strona składa powód z tego pola i zmienia komunikat pustego wyniku; smoke odwraca asercje z S-04 i dodaje kroki z cyklem. Testy jednostkowe dochodzą do joba `ci` jako osobny krok, żeby błąd algorytmu zatrzymał zmianę przed wdrożeniem.

## Phase 1: Cykle: algorytm, testy, strona i smoke

### Overview

Dodaje wykrywanie cykli do `checkTasks`, testy jednostkowe algorytmu, powód cyklu i nowy komunikat pustego wyniku na stronie sprawdzenia oraz kroki smoke. Po tej fazie kierownik widzi zadania leżące na cyklach, a „nie znaleziono problemów” pojawia się tylko wtedy, gdy żadne z czterech kryteriów nic nie znalazło.

### Changes Required:

#### 1. Typ wyniku

**File**: `src/types.ts`

**Intent**: Dodać do `TaskProblem` dane o cyklu, obok istniejących powodów.

**Contract**: `TaskProblem` dostaje pole `cycleWith: number[]`: numery wszystkich zadań silnie spójnej składowej o rozmiarze ≥ 2, do której należy zadanie (razem z numerem tego zadania), rosnąco; pusta tablica oznacza brak cyklu. Warunek „zadanie ma problem” w `checkTasks` uwzględnia `cycleWith.length > 0`.

#### 2. Algorytm cykli

**File**: `src/lib/task-check.ts`

**Intent**: Wykryć zadania leżące na cyklu zależności jako czwarte kryterium sprawdzenia, jako część czystej funkcji `checkTasks`.

**Contract**: Graf: wierzchołki to numery zadań listy, krawędź z zadania do każdego jego poprzednika, który jest numerem zadania z tej listy (numery spoza listy są pomijane w grafie i zostają w `missingPredecessors`). Silnie spójne składowe liczone algorytmem iteracyjnym (bez rekurencji zależnej od liczby zadań); każde zadanie w składowej o rozmiarze ≥ 2 dostaje `cycleWith` z numerami składowej rosnąco. Zadanie w składowej jednoelementowej (w tym zadanie tylko zależne od cyklu) dostaje `[]`; własne wskazanie jest blokowane przy zapisie, więc nie tworzy pętli, ale funkcja nie może się na nim zapętlić ani błędnie oznaczyć zadania, gdyby taka krawędź wystąpiła w danych (składowa jednoelementowa z pętlą własną nie jest cyklem „co najmniej dwóch zadań”). Reszta kryteriów (poprzednik, odpowiedzialność, duplikat) i sortowanie wyniku po numerze bez zmian. Złożoność liniowa względem zadań i poprzedników.

#### 3. Testy jednostkowe

**File**: `tests/task-check.test.mjs` (nowy), `package.json`, `.github/workflows/ci.yml`

**Intent**: Pokryć testami jednostkowymi przypadki brzegowe algorytmu bez nowej zależności i uruchamiać je w CI przed budowaniem.

**Contract**: Plik testów używa wbudowanego `node:test` i `node:assert/strict`, importuje `checkTasks` z `src/lib/task-check.ts` i buduje obiekty zadań pomocnikiem (numer, nazwa, specjalność, nakład, poprzednicy). Przypadki: pusta lista; brak cykli (łańcuch i romb: zadania 1←2, 1←3, 2←4, 3←4 bez cyklu); cykl dwuelementowy; długi cykl (5 zadań); kilka niezależnych cykli (każde zadanie dostaje tylko swoją grupę); zadanie zależne od cyklu, ale nieleżące na nim (bez `cycleWith`); dwa cykle współdzielące zadanie (jedna składowa, wszystkie zadania oznaczone); poprzednik spoza projektu (`missingPredecessors`, bez krawędzi) obok cyklu na tym samym zadaniu; pozostałe kryteria z S-04 nadal działają (duplikat w innej wielkości liter i ze spacją, nakład 0 kontra pusty, kilka powodów naraz). `package.json`: skrypt `test:unit` uruchamia `node --experimental-strip-types --test tests/` (bez nowych zależności). `ci.yml`: krok `npm run test:unit` w jobie `ci` po lincie. Lint (`eslint .`) i `astro check` przechodzą z nowym katalogiem `tests/`; plik testów nie trafia do buildu.

#### 4. Strona sprawdzenia

**File**: `src/pages/tasks/check.astro`

**Intent**: Pokazać powód cyklu i, gdy wszystkie cztery kryteria nic nie znalazły, komunikat „nie znaleziono problemów”, bez zastrzeżenia o niesprawdzanych cyklach.

**Contract**: `reasons(problem)` dokłada powód „Cykl zależności: zadania 3, 5, 7” z `cycleWith` (numery po przecinku, razem z bieżącym zadaniem), w kolejności: nieistniejący poprzednik, brak odpowiedzialności, duplikat nazwy, cykl. Wynik bez problemów: „Nie znaleziono problemów w sprawdzanych kryteriach (nieistniejący poprzednik, brak odpowiedzialności, duplikat, cykl zależności).” Zdanie „Cykle zależności nie są jeszcze sprawdzane.” znika zarówno z wyniku z problemami, jak i z pustego. Brak sformułowania „wszystko w porządku” nadal obowiązuje jako reguła treści (komunikat mówi o sprawdzanych kryteriach, nie o poprawności listy w ogóle).

#### 5. Kroki smoke

**File**: `scripts/smoke.mjs`

**Intent**: Odwrócić asercje z S-04 i pokryć cykle z perspektywy użytkownika na prawdziwej bazie.

**Contract**: Istniejące kroki sprawdzenia: asercja obecności „Cykle zale” w wyniku A i w wyniku B bez problemów zamienia się na jej brak (`bodyExcludes` „nie są jeszcze sprawdzane”), a krok dla projektu B bez problemów oczekuje „Nie znaleziono problemów” i dodatkowo fragmentu „cykl zale”. Nowe kroki: A dodaje zadania kontrolne (numery od 20, ze specjalnością i nakładem, unikalne nazwy z `stamp`): zadanie 20 z poprzednikiem `22`, zadanie 21 z poprzednikiem `20`, zadanie 22 z poprzednikiem `21` (cykl trójki, w kolejności, w której poprzednik może jeszcze nie istnieć), oraz zadanie 23 zależne od 20 (leży poza cyklem); `GET /tasks/check` A zawiera „Cykl zależności: zadania 20, 21, 22” przy trzech zadaniach cyklu i nie zawiera nazwy zadania 23; zadanie na cyklu z dodatkowym powodem (np. z nakładem `0`) pokazuje oba powody w jednym bloku zadania; B (projekt bez problemów) nadal widzi „Nie znaleziono problemów” i nie widzi cykli A. Kroki A wstaw przed usunięciem projektu. Asercje na fragmentach bez polskich znaków, jak w istniejących krokach.

### Success Criteria:

#### Automated Verification:

- Testy jednostkowe algorytmu przechodzą: `npm run test:unit`
- Sprawdzenie typów przechodzi: `npx astro check`
- Lint przechodzi (w tym `scripts/` i `tests/`): `npm run lint`
- Build przechodzi: `npm run build`
- Smoke przechodzi na lokalnym Supabase i serwerze podglądu: `npm run smoke`
- CI (`ci` z krokiem testów jednostkowych i `smoke`) zielone na gałęzi z tą zmianą

#### Manual Verification:

- Projekt z cyklem trzech zadań pokazuje przy każdym z nich „Cykl zależności: zadania …” z numerami wszystkich trzech; zadanie tylko zależne od cyklu nie jest oznaczone
- Zadanie na cyklu z dodatkowym problemem (np. nakład 0 albo nieistniejący poprzednik) pokazuje wszystkie powody
- Projekt bez problemów pokazuje „Nie znaleziono problemów…” i nigdzie nie mówi „wszystko w porządku” ani o niesprawdzanych cyklach
- Po usunięciu zależności zamykającej cykl (przez „Edytuj” zadania) ponowne otwarcie `/tasks/check` nie oznacza już tych zadań jako cykl
- Sprawdzenie kilkudziesięciu zadań z kilkoma cyklami kończy się widocznym wynikiem w czasie poniżej 1 sekundy

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- `tests/task-check.test.mjs` uruchamiany przez `npm run test:unit` (`node:test`, bez zależności): cykl dwuelementowy, długi cykl, kilka niezależnych cykli, dwa cykle w jednej składowej, zadanie zależne od cyklu (nieoznaczone), romb bez cyklu, poprzednik spoza projektu obok cyklu, pusta lista, oraz regresja kryteriów z S-04 (duplikat w innej wielkości liter i ze spacją, nakład 0 kontra pusty, kilka powodów).

### Integration Tests:

- `npm run smoke` na lokalnym Supabase: cykl trójki widoczny na stronie, zadanie tylko zależne od cyklu nieoznaczone, cykl z dodatkowym powodem, komunikat „Nie znaleziono problemów” dla czystego projektu, brak zastrzeżenia o niesprawdzanych cyklach, izolacja użytkowników.

### Manual Testing Steps:

1. Zaloguj się, wybierz projekt i dodaj zadania tworzące cykl (np. 20 z poprzednikiem 22, 21 z 20, 22 z 21) oraz zadanie 23 zależne od 20.
2. Otwórz `/tasks/check` i sprawdź, że 20, 21 i 22 mają „Cykl zależności: zadania 20, 21, 22”, a 23 nie.
3. Dodaj do jednego z nich nakład 0 albo nieistniejącego poprzednika i sprawdź kilka powodów.
4. Przez „Edytuj” usuń zależność zamykającą cykl i otwórz sprawdzenie ponownie.
5. W projekcie bez problemów sprawdź komunikat „Nie znaleziono problemów…”.

## Performance Considerations

Wymaganie z PRD: sprawdzenie kilkudziesięciu zadań w kilka do kilkunastu sekund. Wynik to jedno zapytanie o zadania i przejście po grafie w pamięci w czasie liniowym względem zadań i poprzedników; iteracyjny algorytm nie zależy od głębokości stosu. Bez stronicowania i bez zapisu w bazie.

## Migration Notes

- Brak migracji i zmian w bazie; wdrożenie samego kodu (`deploy` w CI) wystarcza, a `supabase db push` nie jest potrzebny.
- Nowy krok `npm run test:unit` w jobie `ci` wymaga Node 22 (już używany w CI); flaga `--experimental-strip-types` jest w Node 22.6+ i nadal akceptowana po ustabilizowaniu się w 22.18+.
- S-06 (stan projektu) użyje `checkTasks` jako źródła prawdy dla „zweryfikowany”: projekt jest zweryfikowany wyłącznie wtedy, gdy lista problemów jest pusta.

## References

- Roadmap: `context/foundation/roadmap.md` (S-05, `task-check-cycles`)
- PRD: `context/foundation/prd.md` (FR-008, FR-009, US-01, Business Logic, Open Questions nr 5)
- Poprzedni wycinek: `context/archive/2026-09-25-task-check-problems/plan.md`
- Logika sprawdzenia i typy: `src/lib/task-check.ts`, `src/types.ts` (`TaskProblem`, `TaskCheckResult`)
- Strona sprawdzenia: `src/pages/tasks/check.astro`
- Smoke: `scripts/smoke.mjs` (kroki `task check` z S-04)
- CI: `.github/workflows/ci.yml`, skrypty w `package.json`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Cykle: algorytm, testy, strona i smoke

#### Automated

- [x] 1.1 Testy jednostkowe algorytmu przechodzą: `npm run test:unit` — 2e20a67
- [x] 1.2 Sprawdzenie typów przechodzi: `npx astro check` — 2e20a67
- [x] 1.3 Lint przechodzi (w tym `scripts/` i `tests/`): `npm run lint` — 2e20a67
- [x] 1.4 Build przechodzi: `npm run build` — 2e20a67
- [x] 1.5 Smoke przechodzi na lokalnym Supabase i serwerze podglądu: `npm run smoke` — 2e20a67
- [x] 1.6 CI (`ci` z krokiem testów jednostkowych i `smoke`) zielone na gałęzi z tą zmianą — 2e20a67

#### Manual

- [x] 1.7 Projekt z cyklem trzech zadań pokazuje przy każdym z nich „Cykl zależności: zadania …” z numerami wszystkich trzech; zadanie tylko zależne od cyklu nie jest oznaczone — 2e20a67
- [x] 1.8 Zadanie na cyklu z dodatkowym problemem (np. nakład 0 albo nieistniejący poprzednik) pokazuje wszystkie powody — 2e20a67
- [x] 1.9 Projekt bez problemów pokazuje „Nie znaleziono problemów…” i nigdzie nie mówi „wszystko w porządku” ani o niesprawdzanych cyklach — 2e20a67
- [x] 1.10 Po usunięciu zależności zamykającej cykl (przez „Edytuj” zadania) ponowne otwarcie `/tasks/check` nie oznacza już tych zadań jako cykl — 2e20a67
- [x] 1.11 Sprawdzenie kilkudziesięciu zadań z kilkoma cyklami kończy się widocznym wynikiem w czasie poniżej 1 sekundy — 2e20a67
