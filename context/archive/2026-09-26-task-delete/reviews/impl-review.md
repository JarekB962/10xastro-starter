<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Usunięcie zadania

- **Plan**: context/changes/task-delete/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1
- **Date**: 2026-09-26
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Automated criteria re-run: test:unit 29/29, astro check 0 errors, lint clean, build OK; CI (ci, smoke, deploy) green on master. Manual rows 1.9–1.14 confirmed by the user, 1.8 (db push) verified by dry-run, 1.15 confirmed on production by the user. Trigger, cascade and RLS checked in rolled-back transactions as `authenticated`.

Plan Adherence note: dwa odstępstwa od tekstów planu wynikają z poleceń użytkownika: strona blokady pokazuje „Aby było to możliwe, usuń je z poprzedników poniższych zadań:” zamiast zdania z numerami blokujących zadań (numery są na liście i w komunikacie po nieudanym POST), a zdanie o poprzednikach usuwanego zadania pokazuje się tylko wtedy, gdy zadanie ma poprzedników. Runner smoke przyjmujący oczekiwania jako funkcję jest zaakceptowanym dodatkiem.

## Findings

### F1 — Komentarz przecenia wyzwalacz: wyścig nie jest łapany

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/tasks.ts:99, supabase/migrations/20261001120000_task_delete.sql:20-41
- **Detail**: Wyzwalacz nie zakłada blokady, więc równoległe dodanie poprzednika wskazującego na usuwane zadanie może zatwierdzić się po jego sprawdzeniu, a usunięcie się uda i zostawi „nieistniejącego poprzednika”. Plan uznaje to za akceptowalne (wykrywa je sprawdzenie), ale komentarz w usłudze twierdzi, że wyzwalacz „łapie wyścig”.
- **Fix**: Poprawić komentarz w `deleteTask`: wyzwalacz jest zabezpieczeniem dla bezpośrednich wywołań API, a wyścig z dodaniem poprzednika jest znanym, akceptowanym przypadkiem.
- **Decision**: FIXED

### F2 — Ścieżka 23001 bez zależnych zwraca mylący komunikat

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/tasks.ts (gałąź `23001`)
- **Detail**: Jeśli po błędzie wyzwalacza ponowny odczyt nie znajdzie zależnych (zależne zadanie usunięto w międzyczasie), `deleteTask` zwraca `has_dependents` z pustą listą, a użytkownik dostaje ogólny komunikat „jest poprzednikiem innych zadań” i stronę oferującą usunięcie.
- **Fix**: Przy pustej liście zwrócić `unexpected` („Coś poszło nie tak. Spróbuj ponownie.”), bo to rzadki wyścig.
- **Decision**: FIXED

### F3 — Smoke nie dochodzi do wyzwalacza ani polityki `delete`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: scripts/smoke.mjs
- **Detail**: Sprawdzenie w usłudze zawsze blokuje pierwsze, więc wyzwalacz nie jest ćwiczony przez smoke, a „B nie usunie zadania A” przechodzi już na `getTask` (RLS na `delete` nie jest testowane). Wyzwalacz, kaskadę projektu i RLS sprawdzono ręcznie w SQL (transakcje z rollbackiem).
- **Fix**: Zaakceptować; ewentualny osobny skrypt SQL dla ścieżek bazy poza zakresem tego wycinka.
- **Decision**: SKIPPED

### F4 — Uprawnienie TRUNCATE i kolejność przy masowym usuwaniu

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261001120000_task_delete.sql
- **Detail**: Domyślne granty dają `authenticated` TRUNCATE na `tasks`, którego nie łapią wyzwalacze wierszowe (PostgREST go nie wystawia, więc nie do wykorzystania). Masowe usuwanie kilku zadań jednym poleceniem zależy od kolejności wierszy (błąd, gdy poprzednik jest usuwany przed zależnymi); aplikacja usuwa pojedynczo.
- **Fix**: Bez zmian.
- **Decision**: SKIPPED

### F5 — Limit wierszy PostgREST i pierwsza lista zależnych

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/lib/services/tasks.ts (`listTasks`)
- **Detail**: `max_rows = 1000` mógłby obciąć listę w ogromnym projekcie i pominąć zależne w sprawdzeniu wstępnym; wyzwalacz nadal zablokuje, ale komunikat byłby ogólny. Realny projekt to kilkadziesiąt zadań.
- **Fix**: Bez zmian.
- **Decision**: SKIPPED

### F6 — Literówka w komentarzu `ProjectState`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/types.ts:316
- **Detail**: „Stan projektu:`revision` to …” bez spacji po dwukropku.
- **Fix**: Dodać spację.
- **Decision**: FIXED
