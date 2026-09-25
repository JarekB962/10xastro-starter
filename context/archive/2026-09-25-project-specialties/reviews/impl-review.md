<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Specjalności wykonawców w projekcie (pełny plan)

- **Plan**: context/changes/project-specialties/plan.md
- **Scope**: Full plan (fazy 1–4; faza 3 miała też osobny przegląd, `impl-review-phase-3.md`)
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-09-25
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 1 observation

Review wykonany bez subagentów (22 pliki, diff `origin/master...HEAD`, kod faz 1, 2 i 4 przeczytany w trakcie implementacji, faza 3 według własnego raportu).

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

## Success criteria

- Faza 1: `db reset`, `astro check`, `lint`, `build` — PASS; RLS/polityki, unikalność i kaskada sprawdzone w `psql` i potwierdzone przez użytkownika
- Faza 2: `astro check`, `lint`, `build` — PASS; ręczne 2.4 i 2.5 potwierdzone
- Faza 3: patrz `impl-review-phase-3.md` (APPROVED, F1 naprawione, F2 pominięte)
- Faza 4: `lint`, `build`, `smoke` (w tym 16 nowych kroków) — PASS; celowe zepsucie whitelisty `after_select` robi dwa kroki czerwone
- Migracja `20260925120000` zastosowana lokalnie i na produkcji (`migration list`, REST `/rest/v1/specialties` daje 200 i `[]`)
- CI na PR #11: `ci` i `smoke` zielone dla commita `ce788c4`; dla commita epilogu `583786f` `smoke` czerwony z powodu limitu zapytań GitHub API w kroku `supabase/setup-cli@v1` (nie kodu; patrz F1)

## Plan vs implementacja

- Faza 1 (migracja, typy, `db-errors.ts`, `projects.ts`), Faza 2 (walidacja, usługa, trasy, middleware), Faza 4 (kroki smoke): MATCH.
- Faza 3: DRIFT na prośbę użytkownika (link „Specjalności" na liście projektów zamiast w pasku, `after_select`), opisany w „Post-plan changes".
- Sortowanie po nazwie (`order("name")`) sprawdzone dla polskich znaków: baza używa `en_US.UTF-8`, kolejność poprawna.

## Findings

### F1 — Smoke w CI zależy od rozwiązywania wersji `latest` przez GitHub API

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: .github/workflows/ci.yml (job `smoke`, krok `supabase/setup-cli@v1` z `version: latest`)
- **Detail**: Dla commita epilogu `583786f` job `smoke` padł po 11 s z „Failed to resolve latest Supabase CLI release: rate limit exceeded", zanim uruchomił jakikolwiek test. Ten sam kod był wcześniej zielony (`smoke` 2 min 16 s). Wersja `latest` wymaga zapytania do GitHub API, więc bywa niestabilna, a dodatkowo pozwala CLI zmienić się bez zmiany w repo. Czerwony `smoke` na najnowszym commicie PR-a blokuje pewność przed merge'em.
- **Fix**: Przypiąć wersję CLI w `ci.yml` (`version: 2.117.0`, taka jak lokalna) i ponowić padnięty job (`gh run rerun --failed`).
- **Decision**: FIXED — wersja CLI przypięta do 2.117.0 w ci.yml; padły job do ponowienia po wypchnięciu

### F2 — Typy `ProjectResult` i `ProjectError` obsługują też specjalności

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/types.ts, src/lib/services/specialties.ts:1-2
- **Detail**: Plan świadomie ponownie używa `ProjectResult` i `ProjectError` (ten sam zestaw kodów), ale usługa specjalności zwraca dziś `ProjectResult<Specialty[]>`. Zadania (S-02, S-03) dorzucą trzecią encję z tym samym typem, więc nazwa „Project…" będzie coraz bardziej myląca.
- **Fix**: Zmienić nazwy na `ServiceResult` i `ServiceError` (mechaniczna zmiana w `types.ts`, `db-errors.ts`, `projects.ts`, `specialties.ts`) przed dodaniem zadań.
- **Decision**: FIXED — ProjectResult/ProjectError zmienione na ServiceResult/ServiceError (types.ts, db-errors.ts, projects.ts, specialties.ts); astro check, lint, build i smoke przechodzą
