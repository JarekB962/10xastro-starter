<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Dodawanie zadania (pełny plan)

- **Plan**: context/changes/task-add/plan.md
- **Scope**: Full plan (fazy 1–3)
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-09-25
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 2 observations

Review wykonany bez subagentów (20 plików, diff `origin/master...HEAD`; migracja, walidacja, usługa, trasa, formularz, strona i małe diffy przeczytane w całości; fazy 1 i 3 dodatkowo sprawdzone w `psql` i przez `npm run smoke`).

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Success criteria

- Faza 1: `db reset`, `astro check`, `lint`, `build` — PASS; RLS/polityki, unikalność numeru, złożony klucz specjalności, wyzwalacz własnego poprzednika, atomowość `create_task`, izolacja użytkowników i kaskada sprawdzone w `psql`, potwierdzone przez użytkownika
- Faza 2: `astro check`, `lint`, `build` — PASS; zagnieżdżony `select` po złożonym kluczu obcym sprawdzony na lokalnym PostgREST; ręczne 2.4–2.10 potwierdzone
- Faza 3: `lint`, `build`, `smoke` (12 nowych kroków) — PASS; celowe zepsucie mapowania `23505` i whitelisty `after_select` robi kroki czerwone
- Migracja `20260926120000` zastosowana na produkcji przed wdrożeniem kodu (`migration list`: lokalna i zdalna zgodne)
- CI na PR #13 zielone dla commita `952ccc0`; dla commita epilogu `53c464e` w toku w chwili przeglądu

## Plan vs implementacja

- Faza 1, 2 i 3: MATCH. Odstępstwa opisane przez subagentów (pomocnicza funkcja wyzwalacza, `failWith` w `db-errors.ts`, `createTask` zwraca `{ id }`, link „Dodaj specjalności" w formularzu React, dodatkowe komunikaty dla złego uuid i limitu 50 poprzedników, `select distinct` w `create_task`) są zgodne z intencją planu i nie łamią „What We're NOT Doing".
- Zakres „NOT doing" zachowany: brak edycji, usuwania, sprawdzania spójności, jednostki nakładu.

## Findings

### F1 — Reguły walidacji zadania są zduplikowane w formularzu React i w zod

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/tasks/TaskForm.tsx:8-40, src/lib/validation/task.ts:4-60
- **Detail**: `toTaskNumber`, limity (`MAX_NUMBER`, `MAX_EFFORT`, `MAX_PREDECESSORS`) i wyrażenia regularne nakładu są napisane dwa razy. S-03 (edycja) doda trzeci ekran z tymi samymi regułami, więc rozjazd komunikatów lub granic między przeglądarką a serwerem jest realny (serwer i tak jest źródłem prawdy).
- **Fix**: Wyciągnąć czyste funkcje i stałe (`toTaskNumber`, `parseEffort`, `parsePredecessors`) do modułu bez zależności od Astro i używać ich w obu miejscach przed S-03.
- **Decision**: FIXED — wspólne reguły pól zadania w `src/lib/validation/task-fields.ts` (stałe, komunikaty, `toTaskNumber`, `parseEffort`, `parsePredecessors`), używane przez zod (`task.ts`) i `TaskForm.tsx`; astro check, lint, build i smoke przechodzą

### F2 — Wspólny `ServiceError` zmusza mapy komunikatów do wpisów, których usługa nie zwraca

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/projects.ts:12-14, src/lib/services/specialties.ts, src/lib/services/tasks.ts:10-12, src/types.ts
- **Detail**: Po dodaniu `duplicate_number` i `invalid_specialty` każda z map `Record<ServiceError, string>` ma wpisy zastępcze („Coś poszło nie tak"), np. `duplicate_name` w zadaniach i oba kody zadań w projektach. To ten sam kierunek, który poprzedni przegląd (project-specialties F2) ocenił jako nazewnictwo; S-03 i S-04 dodadzą kolejne kody.
- **Fix**: Zawęzić typ mapy w każdej usłudze do jej podzbioru (`Record<Extract<ServiceError, ...>, string>` lub osobne unie na encję) i usunąć wpisy zastępcze.
- **Decision**: FIXED — `ServiceResult<T, E>` z wąskimi unijnymi kodami (`CommonServiceError`, `TaskServiceError`), mapy komunikatów zawężone, wpisy zastępcze usunięte, `failWith` generyczne; trasa zadań używa `PROJECT_ERROR_MESSAGES` dla błędu wyboru projektu; astro check, lint, build i smoke przechodzą
