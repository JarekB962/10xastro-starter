<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Zmiana numeru zadania

- **Plan**: context/changes/task-renumber/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1
- **Date**: 2026-09-26
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

Automated criteria re-run: test:unit 36/36, astro check 0 errors, lint clean, build OK; CI (ci, smoke) green on PR #30. Manual rows 1.9–1.15 confirmed by the user, 1.8 (db push) verified by dry-run. Grants (`handle_task_number_change` niedostępna dla ról użytkownika), zakres po `project_id`, klucz główny i przeciążenia `update_task` sprawdzone w lokalnej bazie i przez lekturę migracji.

Plan Adherence note: znane adaptacje (kod `self_predecessor` w `TaskServiceError`, właściwość `focusName` w `TaskForm`, usunięte `editFormValues`, dopisany `task_number` w istniejących krokach edycji smoke) są zgodne z intencją planu.

## Findings

### F1 — Wyścig w wyzwalaczu zmiany numeru

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261003120000_task_renumber.sql:45 (`handle_task_number_change`)
- **Detail**: Sprawdzenie odwołań do nowego numeru i przepisanie poprzedników nie są serializowane względem równoległych wstawień do `task_predecessors` (READ COMMITTED, bez blokad). Równoległe wstawienie poprzednika o nowym numerze do zadania, które ma też stary numer, może trafić w klucz główny (`23505`, mylnie mapowane na „zajęty numer”), a wstawienie poprzednika o starym numerze po przepisaniu zostawia wiszące odwołanie (wykrywa je sprawdzenie listy).
- **Fix A ⭐ Recommended**: Zaakceptować wąski wyścig (aplikacja dla garstki użytkowników) i opisać go w komentarzu w usłudze `updateTask`.
  - Strength: Zgodne z podejściem z S-07 (wiszące odwołania wykrywa sprawdzenie); bez nowej migracji i drugiego `db push`.
  - Tradeoff: Rzadki wyścig może dać mylny komunikat albo wiszące odwołanie.
  - Confidence: HIGH — dwie równoczesne edycje tego samego projektu w tej samej chwili są mało prawdopodobne.
  - Blind spot: Przyszłe udostępnianie projektu (FR-010) zwiększy szansę równoległych zapisów.
- **Fix B**: Zakładać w wyzwalaczu `pg_advisory_xact_lock(hashtext(new.project_id::text))`.
  - Strength: Serializuje zmiany numerów w projekcie.
  - Tradeoff: Nowa migracja i `db push`; nie chroni przed wstawieniem poprzednika przez `create_task`/`update_task`, dopóki i one nie zakładają blokady.
  - Confidence: MEDIUM — pełna ochrona wymaga blokady we wszystkich ścieżkach zapisu.
  - Blind spot: Wpływ blokady na wydajność zapisów.
- **Decision**: FIXED via Fix A (komentarz w updateTask, bez migracji)

### F2 — Smoke nie pokrywa kolejności w `update_task` ani gałęzi bazy dla własnego poprzednika

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: scripts/smoke.mjs (krok „A cannot renumber a task to the number of its own predecessor”)
- **Detail**: Walidacja po stronie aplikacji odrzuca ten przypadek wcześniej, więc gałąź bazy (`23514`) nie jest ćwiczona; niesprawdzona jest też kolejność w `update_task` (usunięcie własnych poprzedników przed zmianą numeru): zmiana numeru na numer, który był poprzednikiem, przy usunięciu go w tym samym formularzu powinna się udać.
- **Fix**: Dodać krok smoke: zadanie z wiszącym poprzednikiem (np. zadanie 12 z poprzednikiem 998) przenumerować na ten numer, czyszcząc poprzedników w tym samym zapisie; oczekiwane przekierowanie na `/tasks` i nowy numer na liście.
- **Decision**: FIXED

### F3 — Zamiana numerów dwóch zadań jest niemożliwa w jednym kroku

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: supabase/migrations/20261003120000_task_renumber.sql
- **Detail**: Unikalny indeks `(project_id, number)` nie jest odraczalny, więc zamiana numerów (A:1→2 przy zajętym 2) zawsze kończy się „zajęty numer”; trzeba użyć numeru tymczasowego w trzech zapisach. Akceptowalne dla MVP.
- **Fix**: Bez zmian.
- **Decision**: SKIPPED

### F4 — Sprzężenie mapowania `23001` z jednym wyzwalaczem

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/tasks.ts (`updateTask`)
- **Detail**: Każdy `23001` na ścieżce edycji jest mapowany na `number_referenced`; dziś zgłasza go tylko ten wyzwalacz, więc jest poprawne, ale kruche przy dodaniu kolejnych reguł `restrict_violation`.
- **Fix**: Bez zmian.
- **Decision**: SKIPPED

### F5 — Drobne uwagi w komentarzu i smoke

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/tasks/[id]/index.ts:30, scripts/smoke.mjs
- **Detail**: Komentarz w trasie mówi „404”, a kod przekierowuje na `/tasks?error=`; asercja „zadaniach%3A+12” pasowałaby też do listy zaczynającej się od „120” (użyć „zadaniach%3A+12.” z kropką kończącą komunikat).
- **Fix**: Poprawić komentarz i dodać kropkę do fragmentu asercji.
- **Decision**: FIXED
