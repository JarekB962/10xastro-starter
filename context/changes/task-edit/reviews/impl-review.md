<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Poprawa zadania (pełny plan)

- **Plan**: context/changes/task-edit/plan.md
- **Scope**: Full plan (fazy 1–2)
- **Reviewed phases**: 1, 2
- **Date**: 2026-09-25
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 1 observation

Review wykonany bez subagentów (14 plików, diff `master...HEAD`; migracja, walidacja, usługa, trasa, strona edycji, formularz, lista i typy przeczytane w całości; faza 1 dodatkowo sprawdzona w `psql`, faza 2 przez `npm run smoke` i celowe zepsucie).

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Success criteria

- Faza 1: `db reset`, `astro check`, `lint`, `build` — PASS; polityki, wyzwalacz niezmienności numeru, `update_task` (zamiana poprzedników, czyszczenie, wycofanie przy własnym poprzedniku, `P0002` dla cudzego i nieistniejącego, błąd klucza dla obcej specjalności), brak prawa `anon` sprawdzone w `psql` i potwierdzone przez użytkownika
- Faza 2: `astro check`, `lint`, `build`, `smoke` (nowe kroki poprawy zadania) — PASS; celowe wyłączenie kontroli własnego poprzednika robi dwa kroki czerwone; ręczne 2.6–2.10 potwierdzone przez użytkownika
- Migracja `20260927120000` zastosowana na produkcji przed wdrożeniem kodu (`migration list`: lokalna i zdalna zgodne)
- CI na PR #15 zielone dla commita `9455983`; dla commita epilogu `be140d6` w toku w chwili przeglądu

## Plan vs implementacja

- Faza 1 i 2: MATCH. Odstępstwa opisane przez subagentów (`when` w wyzwalaczu, komunikat `P0002`, `editFormValues`, wspólny mapper `toTask`, błąd wczytania specjalności daje 500, kroki błędów w smoke sprawdzane po fragmentach adresu) są zgodne z intencją i nie łamią „What We're NOT Doing".
- Zakres „NOT doing" zachowany: brak zmiany numeru, usuwania, sprawdzania spójności, blokady optymistycznej.

## Findings

### F1 — Wyzwalacz nie blokuje zmiany `project_id`, choć plan wyklucza przenoszenie zadania między projektami

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260927120000_update_task.sql:5-17
- **Detail**: Plan zapisuje „Przenoszenie zadania do innego projektu i zmiana `project_id`" jako poza zakresem, a wyzwalacz `tasks_prevent_number_change` odrzuca tylko zmianę `number`. Polityka `update` na `tasks` dopuszcza dowolne kolumny własnego projektu, więc zapis prosto przez API Supabase z własnym tokenem może przenieść zadanie do innego projektu tego samego użytkownika (poprzednicy pójdą razem z nim, a numer może zderzyć się z unikalnym indeksem albo z poprzednikami zadań w projekcie docelowym). Aplikacja tego nie robi, a dane należą do tego samego użytkownika, więc ryzyko jest niskie.
- **Fix**: Rozszerzyć wyzwalacz (i klauzulę `when`) o `old.project_id is distinct from new.project_id` w nowej migracji, z komunikatem „Zadania nie można przenieść do innego projektu."
- **Decision**: FIXED — nowa migracja `20260928120000_lock_task_project.sql` (osobny wyzwalacz `tasks_prevent_project_change`, komunikat „Zadania nie można przenieść do innego projektu.”); w `psql` zmiana `project_id` odrzucona, zmiana nazwy przechodzi; db reset, astro check, lint, build i smoke przechodzą; migracja czeka na `db push` na produkcję
