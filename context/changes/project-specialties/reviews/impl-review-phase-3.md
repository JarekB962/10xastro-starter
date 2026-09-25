<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Specjalności wykonawców w projekcie (faza 3)

- **Plan**: context/changes/project-specialties/plan.md
- **Scope**: Phase 3 of 4
- **Reviewed phases**: 3
- **Date**: 2026-09-25
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 1 observation

Review wykonany bez subagentów (commit 84d605b, sześć plików przeczytanych w całości).

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Success criteria (faza 3)

- 3.1 `npx astro check` — PASS (0 errors, 0 warnings, 0 hints)
- 3.2 `npm run lint` — PASS
- 3.3 `npm run build` — PASS
- 3.4–3.9 (ręczne) — potwierdzone przez użytkownika; dowody w diffie: pusty stan i link w `src/pages/specialties/index.astro`, sortowanie `order("name")`, duplikat i zachowanie wartości przez `?specialty_name=`, `autoFocus` w `SpecialtyForm.tsx`, 404/500/503 w `edit.astro`

## Plan vs implementacja

- `SpecialtyForm.tsx`, `specialties/index.astro`, `specialties/[id]/edit.astro`, link na dashboardzie: MATCH.
- Link „Specjalności" w pasku u góry (Changes Required pkt 4): DRIFT na prośbę użytkownika, link przeniesiony na listę projektów.
- `src/pages/api/projects/[id]/select.ts` (pole `after_select`) i `src/pages/projects/index.astro`: EXTRA na prośbę użytkownika; nie ma ich w planie.

## Findings

### F1 — Zmiany po planie nie są opisane w planie

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: context/changes/project-specialties/plan.md (Faza 3, pkt 4; Faza 4, pkt 1)
- **Detail**: Link „Specjalności" nie jest w pasku, tylko przy każdym projekcie na liście, a trasa wyboru projektu przyjmuje pole `after_select=specialties`. Opisuje to wyłącznie notatka w `change.md`, więc plan (Faza 3 pkt 4, Faza 4) dalej mówi o pasku i nie przewiduje kroku smoke dla `after_select`. Następny przegląd odczyta to jako niezgodność, a regres w trasie wyboru nie zostałby wykryty przez CI.
- **Fix**: Dopisać w `plan.md` sekcję „Post-plan changes" (link na liście projektów, `after_select`) i dodać do kontraktu Fazy 4 dwa kroki smoke: wybór z `after_select=specialties` przekierowuje na `/specialties`, a nieznana wartość na `/dashboard`.
- **Decision**: FIXED — sekcja "Post-plan changes" w plan.md i dwa kroki smoke dopisane do kontraktu Fazy 4

### F2 — Po edycji cudzej-dla-wyboru specjalności lista pokazuje inny projekt

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/specialties/[id]/index.ts (przekierowanie po zapisie)
- **Detail**: Strona edycji otwiera się dla każdej specjalności użytkownika (reguły dostępu sprawdzają właściciela projektu), a po zapisie trasa odsyła na `/specialties`, które pokazuje specjalności **wybranego** projektu. Jeśli użytkownik wszedł bezpośrednim adresem w specjalność innego projektu, po zapisie zobaczy listę innego projektu i nie zobaczy zmiany. Z interfejsu (link „Edytuj" na liście) ta ścieżka jest nieosiągalna.
- **Fix**: Zostawić bez zmian i przyjąć jako ograniczenie (dostępne tylko przez ręcznie wpisany adres).
- **Decision**: SKIPPED — ograniczenie osiągalne tylko przez ręcznie wpisany adres
