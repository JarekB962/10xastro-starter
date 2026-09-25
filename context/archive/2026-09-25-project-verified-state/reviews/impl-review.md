<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Stan projektu (zweryfikowany / niezweryfikowany)

- **Plan**: context/changes/project-verified-state/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1
- **Date**: 2026-09-25
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

Automated criteria re-run: test:unit 20/20, astro check 0 errors, lint clean, build OK; CI (ci, smoke, deploy) green on master. Manual rows 1.9–1.13 confirmed by the user, 1.8 (db push) verified by dry-run, 1.14 confirmed on production by the user. Grants of `bump_*` and `verify_project` verified against the local DB (`pg_proc.proacl`).

## Findings

### F1 — Stan „zweryfikowany” jest zaufany klientowi, a komentarz migracji mówi „pilnowany przez bazę”

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260929120000_project_states.sql:1, 105-133
- **Detail**: Każdy zalogowany właściciel może wywołać `verify_project` z aktualnym licznikiem i oznaczyć własny projekt jako zweryfikowany bez sprawdzenia. Plan opisuje to jako świadomy kompromis („What We're NOT Doing”), ale nagłówek migracji sugeruje pełną gwarancję bazy.
- **Fix A ⭐ Recommended**: Zaakceptować kompromis i doprecyzować to w kolejnej migracji (F2) komentarzem, że weryfikację zapisuje aplikacja po sprawdzeniu.
  - Strength: Zgodne z planem i PRD (guardrail dotyczy przepływu aplikacji); bez nowej logiki.
  - Tradeoff: Właściciel może obejść sprawdzenie, ale tylko dla własnego projektu.
  - Confidence: HIGH — kompromis jest jawnie opisany w planie i briefie.
  - Blind spot: Przyszłe udostępnianie projektu (FR-010) może zmienić ocenę.
- **Fix B**: Liczyć sprawdzenie w SQL (funkcja bazy przeliczająca cztery kryteria).
  - Strength: Baza naprawdę gwarantuje stan.
  - Tradeoff: Duplikuje algorytm z `checkTasks` w SQL, osobne testy i ryzyko rozjazdu logiki.
  - Confidence: MEDIUM — duży koszt względem ryzyka własnego projektu.
  - Blind spot: Wydajność i utrzymanie dwóch implementacji.
- **Decision**: FIXED via Fix A (kompromis zaakceptowany, komentarz w migracji 20260930120000)

### F2 — Uprawnienia tabeli stanu i wyzwalacz poprzedników

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260929120000_project_states.sql:11-16, 53-71, 94-96
- **Detail**: (a) Domyślne uprawnienia Supabase dają `anon` i `authenticated` INSERT/UPDATE/DELETE/TRUNCATE na `project_states`; zapis blokuje wyłącznie brak polityk RLS. (b) Wyzwalacz poprzedników przy UPDATE podnosi licznik tylko dla `new.task_id`; zmiana `task_id` na zadanie z innego projektu nie podniosłaby licznika starego projektu (RLS to blokuje, ale migracja tego nie gwarantuje).
- **Fix**: Nowa migracja: `revoke all on public.project_states from anon, authenticated; grant select on public.project_states to authenticated;` oraz podnoszenie licznika także dla `old.task_id` przy UPDATE, gdy `task_id` się zmienił. Wymaga `supabase db push` na produkcji (migracja addytywna).
  - Strength: Obrona w głąb (uprawnienia + RLS) i szczelność wyzwalacza niezależna od polityk.
  - Tradeoff: Dodatkowa migracja i ręczny `db push`.
  - Confidence: HIGH — zmiana lokalna, funkcje bump nie zależą od uprawnień wywołującego.
  - Blind spot: Nie sprawdzono, czy `revoke` wpływa na kaskadę z usuwanego projektu (klucz obcy działa jako właściciel tabeli, więc nie powinien).
- **Decision**: FIXED (migracja 20260930120000_project_states_hardening.sql; wymaga db push)

### F3 — Usługa i typy: wynik RPC i typy zapisu

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/project-state.ts:24, src/types.ts (`project_states` Insert/Update)
- **Detail**: `verifyProject` zwraca `data` z RPC bez normalizacji (null zostałby `ok: true`), a typy `Insert`/`Update` tabeli sugerują możliwość zapisu przez klienta.
- **Fix**: `data === true` w usłudze; w typach `Insert: never` i `Update: never` dla `project_states`.
- **Decision**: FIXED partially (typy Insert/Update: Record<string, never>); `data === true` pominięte: typ RPC to boolean, a reguła lint zabrania porównania

### F4 — Smoke nie pokrywa ścieżek naruszeń

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: scripts/smoke.mjs
- **Detail**: Brak kroków dla nieaktualnego licznika (`verify_project` zwraca false), bezpośredniego zapisu `project_states`, weryfikacji cudzego projektu i wywołań przez anon. Smoke używa tylko sesji stron, więc te ścieżki sprawdzono ręcznie (SQL w transakcji przy implementacji, wiersz 1.12). Usuwanie zadań i specjalności nie istnieje jeszcze w aplikacji (S-07, S-09).
- **Fix**: Zaakceptować lukę i dodać kroki do planów S-07/S-09 (usuwanie cofa stan); ewentualnie osobny skrypt SQL dla ścieżek naruszeń poza zakresem tego wycinka.
- **Decision**: SKIPPED

### F5 — Zapis stanu przy GET i połknięty błąd weryfikacji

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/tasks/check.astro:18-22
- **Detail**: Zapis stanu przy żądaniu GET jest świadomą decyzją użytkownika. Błąd `verifyProject` jest przy `not_found` (42501) po cichu pokazywany jako „niezweryfikowany”, bez logu.
- **Fix**: Zostawić bez zmian; wynik jest bezpieczny (przy błędzie stan to „niezweryfikowany”).
- **Decision**: SKIPPED

### F6 — Koszt wyzwalacza poprzedników

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: supabase/migrations/20260929120000_project_states.sql:53-71
- **Detail**: Wyzwalacz wierszowy dla każdego poprzednika robi SELECT i upsert (N+1 upsertów w jednej transakcji na tym samym wierszu). Przy kilkudziesięciu zadaniach pomijalne.
- **Fix**: Zostawić; wyzwalacz poziomu instrukcji z tabelami przejściowymi dopiero, gdyby listy poprzedników urosły.
- **Decision**: SKIPPED
