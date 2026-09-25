<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Sprawdzenie listy zadań: cykle zależności

- **Plan**: context/changes/task-check-cycles/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1
- **Date**: 2026-09-25
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Automated criteria re-run: test:unit 19/19, astro check 0 errors, lint clean, build OK; CI (ci, smoke) green on PR #20. Manual rows 1.7–1.11 confirmed by the user.

## Findings

### F1 — Smoke nie liczy oznaczeń cyklu

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/smoke.mjs (krok sprawdzenia z cyklem 20, 21, 22)
- **Detail**: Asercja to podciąg całej strony ("ci: zadania 20, 21, 22"), więc przechodzi, nawet gdy etykietę ma tylko jedno z trzech zadań.
- **Fix**: Policz wystąpienia „Cykl zależności: zadania 20, 21, 22” i wymagaj dokładnie 3.
- **Decision**: FIXED

### F2 — Wspólna tablica cycleWith między zadaniami

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/types.ts:265, src/lib/task-check.ts:75
- **Detail**: Wszystkie zadania składowej dzielą jedną tablicę (świadomie, by uniknąć kwadratowej pamięci). Konsument, który ją posortuje lub zmodyfikuje, zmieni wynik pozostałych zadań.
- **Fix**: Typ `readonly number[]` w `TaskProblem.cycleWith`.
- **Decision**: FIXED

### F3 — Luki w testach algorytmu

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: tests/task-check.test.mjs:103
- **Detail**: Brak testu dwóch cykli połączonych jedną krawędzią jednokierunkową (mają dać dwie osobne grupy). Test 50 000 zadań sprawdza tylko liczności, nie zawartość `cycleWith`.
- **Fix**: Dodać test „dwa cykle połączone krawędzią” i asercję `cycleWith` = 1..n w teście dużego cyklu.
- **Decision**: FIXED

### F4 — Pętla własna nie jest oznaczana

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/task-check.ts:73
- **Detail**: Zgodnie z planem pętla własna nie jest cyklem, a walidacja (validation/task.ts) blokuje ją przy zapisie; dane wprowadzone poza aplikacją dałyby brak oznaczenia.
- **Fix**: Krótki komentarz, że gwarancję daje warstwa walidacji.
- **Decision**: FIXED
