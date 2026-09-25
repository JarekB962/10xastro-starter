<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Sprawdzenie listy zadań: proste kryteria (pełny plan)

- **Plan**: context/changes/task-check-problems/plan.md
- **Scope**: Full plan (faza 1)
- **Reviewed phases**: 1
- **Date**: 2026-09-25
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 1 observation

Review wykonany bez subagentów (7 plików, diff `master...HEAD`; `task-check.ts`, `check.astro`, zmiany w `index.astro`, `types.ts` i dodane kroki `smoke.mjs` przeczytane w całości).

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

- Faza 1: `astro check`, `lint`, `build`, `smoke` (nowe kroki sprawdzenia) — PASS; lint miał jeden błąd formatowania prettier w `task-check.ts`, naprawiony przed commitem; celowe zepsucie trzech reguł (wielkość liter w duplikacie, nakład 0, nieistniejący poprzednik) robi krok „check lists duplicates, effort 0 and the missing predecessor” czerwonym; ręczne 1.6–1.11 potwierdzone przez użytkownika
- Brak migracji (`db push --dry-run`: „Remote database is up to date”), więc nic nie wymaga zastosowania na produkcji
- CI na PR #18 zielone dla commita `e3c0f27`; dla commita epilogu `91b6a69` w toku w chwili przeglądu

## Plan vs implementacja

- Faza 1: MATCH. Jedyny dodatek to eksportowany typ `NoResponsibilityReason` (używany przez `TaskProblem`), zgodny z intencją planu. Zakres „NOT doing” zachowany: brak cykli, stanu projektu, zapisu wyniku, usuwania, nowego frameworka testowego.
- Guardrail z PRD zachowany: strona nigdy nie zawiera „wszystko w porządku”, a zdanie o niesprawdzanych cyklach jest zawsze widoczne (także przy wyniku z problemami).

## Findings

### F1 — Krok smoke „kilka powodów naraz” wycina tylko do pierwszego `</li>`, więc zależy od kolejności powodów

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: scripts/smoke.mjs (krok „A's check shows several reasons at once for a task without specialty and effort”)
- **Detail**: Krok wycina fragment strony od `<li` przed nazwą zadania do pierwszego `</li>` po niej, a to kończy się po pierwszej linii powodu (zagnieżdżone `<li>` z powodami). Dziś zadanie „bez specjalności i nakładu” ma jeden powód „Brak odpowiedzialności: brak specjalności, nakład pusty”, więc sprawdzenie działa, ale gdyby zadanie dostało też np. powód „Nieistniejący poprzednik” (wypisywany wcześniej), asercja o braku specjalności sprawdzałaby inną linię i nie chroniłaby wielu powodów naraz. To pokazuje też, że krok nie sprawdza wielu linii powodów, tylko wiele powodów w jednej linii.
- **Fix**: Wycinać do końca listy powodów (pierwsze `</ul>` po nazwie zadania) i dodać asercję na zadaniu z powodami w dwóch kategoriach (np. zadanie zero ze specjalnością i nakładem 0 plus poprzednik `999`), żeby wiele linii powodów było naprawdę pokryte.
- **Decision**: FIXED — krok wycina teraz do `</ul>` (cała lista powodów), a zadanie 12 ma dwie kategorie powodów (nakład 0 i nieistniejący poprzednik 998) sprawdzane nowym krokiem; lint, build i smoke przechodzą, a celowe wyłączenie wykrywania poprzednika robi nowy krok czerwonym
