---
project: "Plan projektu (WBS)"
version: 1
status: draft
created: 2026-09-25
updated: 2026-09-25
prd_version: 2
main_goal: speed
top_blocker: time
milestone_id: task-data-entry
milestone_seq: 1
milestone_status: open
---

# Roadmap: Plan projektu (WBS)

> Derived from `context/foundation/prd.md` (v2) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-1: Wprowadzanie specjalności i zadań** — Status: open

- **Intent:** Kierownik projektu może w wybranym projekcie zdefiniować specjalności wykonawców i wpisać ręcznie zadania (numer, nazwa, specjalność, nakład, poprzednicy). Kamień milowy kończy się na wprowadzaniu i poprawianiu danych; sprawdzanie ich spójności jest świadomie odłożone (patrz `## Parked`).
- **Source materials:** `context/foundation/prd.md` (v2)
- **Done when:** every F-NN and S-NN below is `done`.
- **Scope anchors:** FR-004 (specjalności: dodanie i edycja), FR-006 (zadania: dodanie i poprawa); US-01 dotyczy tylko kroków „zdefiniował specjalności i wpisał zadania".

## Vision recap

Kierownik projektu na starcie dostaje listę zadań (specjalność wykonawcy, nakład, zadania poprzedzające) i musi sprawdzić, czy zależności między nimi nie są sprzeczne. Dziś robi to w arkuszu przez kilka godzin. Aplikacja ma to zastąpić: wymusić kompletne dane i automatycznie wykrywać sprzeczności.

## North star

**S-01: Kierownik dodaje i edytuje specjalności wykonawców w wybranym projekcie** — pierwszy i najmniejszy wycinek kamienia milowego, od którego zależą zadania; przy celu „szybkość" (`main_goal: speed`) daje najkrótszą ścieżkę do działającego wprowadzania danych.

> "North star" (gwiazda przewodnia) oznacza tu najmniejszy wycinek od początku do końca, którego ukończenie pokazuje, że kamień milowy jest wykonalny, i który stoi jak najwcześniej w kolejności, bo reszta ma sens tylko wtedy, gdy on działa.

## At a glance

| ID   | Change ID           | Outcome (user can …)                                                                                       | Prerequisites                      | PRD refs      | Status   |
| ---- | ------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------- | -------- |
| S-01 | project-specialties | dodać i edytować specjalności wykonawców w wybranym projekcie                                              | wybrany projekt (FR-003, wdrożone) | FR-004, US-01 | done |
| S-02 | task-add            | dodać zadanie (numer, nazwa, specjalność, nakład, poprzednicy jako numery) i zobaczyć listę zadań projektu | S-01                               | FR-006, US-01 | done |
| S-03 | task-edit           | poprawić zadanie (nazwa, specjalność, nakład, poprzednicy)                                                 | S-02                               | FR-006        | in-progress |

## Baseline

What's already in place in the codebase as of `2026-09-25` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro + React + Tailwind + shadcn/ui, strony `src/pages/projects/`, formularze w `src/components/projects/`.
- **Backend / API:** present — trasy `POST` w `src/pages/api/projects/`, usługi w `src/lib/services/`, walidacja zod w `src/lib/validation/`.
- **Data:** present — Supabase, migracja `20260924120000_create_projects_and_user_settings.sql`, reguły dostępu na tabelach `projects` i `user_settings`.
- **Auth:** present — logowanie i rejestracja, middleware chroniący trasy (`src/middleware.ts`), sesja w ciasteczkach.
- **Deploy / infra:** present — CI (`ci`, `smoke`, `deploy`), Cloudflare Workers, krok sprawdzający po wdrożeniu, że produkcja łączy się z Supabase.
- **Observability:** partial — `observability` włączone w `wrangler.jsonc` i logi błędów `console.error`; brak metryk i śledzenia błędów.

## Foundations

(none — Baseline covers every layer this milestone needs; wszystkie nowe elementy wchodzą w pionowych wycinkach poniżej.)

## Slices

### S-01: Specjalności wykonawców

- **Outcome:** kierownik dodaje i edytuje specjalności wykonawców w wybranym projekcie.
- **Change ID:** project-specialties
- **PRD refs:** FR-004, US-01
- **Prerequisites:** wybrany projekt (FR-003, wdrożone)
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Czy nazwa specjalności jest unikalna w projekcie (tak jak nazwa projektu)? — Owner: user. Block: no.
- **Risk:** Najmniejszy wycinek i jedyny bez zależności, więc idzie pierwszy (cel: szybkość). Ustala wzorzec danych podrzędnych względem projektu, który powtórzą zadania.
- **Status:** done

### S-02: Dodawanie zadania

- **Outcome:** kierownik dodaje zadanie (numer, nazwa, specjalność, nakład, poprzednicy jako numery) i widzi listę zadań projektu.
- **Change ID:** task-add
- **PRD refs:** FR-006, US-01
- **Prerequisites:** S-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Jaka jest jednostka nakładu (godziny, osobodni)? — Owner: user. Block: no.
  - Czy specjalność i nakład mogą pozostać puste przy zapisie (PRD: braki wykrywa dopiero sprawdzenie, FR-008, które jest odłożone)? — Owner: user. Block: no.
  - Zapis poprzednika o numerze, którego jeszcze nie ma, jest dozwolony (PRD v2), ale bez sprawdzania (FR-008) taki błąd pozostanie niewidoczny. Czy pokazywać go już na liście? — Owner: user. Block: no.
- **Risk:** Łączy najwięcej reguł z PRD v2 naraz: unikalny numer w projekcie, poprzednik jako numer, blokada wskazania samego siebie. Błąd w modelu danych tutaj kosztuje każdy późniejszy wycinek.
- **Status:** done

### S-03: Poprawa zadania

- **Outcome:** kierownik poprawia zadanie (nazwa, specjalność, nakład, poprzednicy).
- **Change ID:** task-edit
- **PRD refs:** FR-006
- **Prerequisites:** S-02
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Numer zadania po utworzeniu: niezmienny do czasu FR-007 (automatyczna zmiana numeru u poprzedników jest odłożona), czy edytowalny mimo to? — Owner: user. Block: no.
- **Risk:** Zmiana numeru zadania bez aktualizacji poprzedników zostawia wiszące odwołania. Stąd propozycja, by w tym kamieniu numer był niezmienny (do potwierdzenia przy planowaniu).
- **Status:** in-progress

## Backlog Handoff

| Roadmap ID | Change ID           | Suggested issue title                               | Ready for `/10x-plan` | Notes                               |
| ---------- | ------------------- | --------------------------------------------------- | --------------------- | ----------------------------------- |
| S-01       | project-specialties | Specjalności wykonawców w projekcie (dodaj, edytuj) | yes                   | Run `/10x-plan project-specialties` |
| S-02       | task-add            | Dodawanie zadania z numerem i poprzednikami         | no                    | Czeka na S-01                       |
| S-03       | task-edit           | Poprawa zadania                                     | no                    | Czeka na S-02                       |

## Open Roadmap Questions

1. **Jakie są drugorzędne kryteria sukcesu (Secondary)?** — Owner: user. Block: no.
2. **Jakie są `target_scale.qps` i `target_scale.data_volume`?** — Owner: user. Block: no.
3. **Zakres kontra czas.** — `mvp_weeks: 5` to własny szacunek, do `hard_deadline` 2026-11-04 zostaje około 6 tygodni pracy po godzinach. Owner: user. Block: roadmap-wide.
4. **Kim są odbiorcy udostępnionego projektu (FR-010) i czy udostępnianie zostaje w produkcie?** — Owner: user. Block: no.
5. **Jaka jest rola oszacowań nakładu i specjalności poza kontrolą kompletności?** — Owner: user. Block: no (dotyczy S-02).
6. **Kiedy otwieramy kolejny kamień milowy: sprawdzanie (FR-008, 009, 011) czy bezpieczna edycja (FR-005, 007)?** — Sprawdzanie jest głównym kryterium sukcesu z PRD i po M-1 nadal nie działa; jeśli termin 2026-11-04 się zbliża, ten wybór jest ważniejszy niż kolejność wycinków w M-1. Owner: user. Block: roadmap-wide.

## Parked

- **FR-005: usunięcie specjalności, jeśli nie występuje w zadaniach** — Why parked: poza pierwszym kamieniem milowym (decyzja użytkownika 2026-09-25); ma sens po zadaniach.
- **FR-007: usunięcie zadania i automatyczna zmiana numeru u poprzedników** — Why parked: jak wyżej; w M-1 numer zadania proponowany jako niezmienny (S-03).
- **FR-008: sprawdzenie listy zadań (cykle, nieistniejący poprzednik, brak odpowiedzialności, duplikaty)** — Why parked: jak wyżej. To główne kryterium sukcesu PRD, więc do niego wraca kolejny kamień milowy.
- **FR-009: lista zadań z problemami** — Why parked: zależy od FR-008.
- **FR-011: stan projektu (zweryfikowany lub niezweryfikowany)** — Why parked: zależy od FR-008.
- **FR-010: udostępnianie projektu do podglądu** — Why parked: nice-to-have, poza pierwszym przepływem (PRD Non-Goals).
- **FR-012: klonowanie projektu** — Why parked: nice-to-have, poza pierwszym przepływem (PRD Non-Goals).
- **Wykrywanie pominiętych zadań w zakresie** — Why parked: PRD Non-Goals.
- **Wklejanie zadań z arkusza** — Why parked: PRD Non-Goals (wersja 2).
- **Grupowanie zadań w etapy** — Why parked: PRD Non-Goals (wersja 2).
- **Aplikacja na telefon i tablet** — Why parked: PRD Non-Goals.

## Milestone History

(Append-only. Carried forward verbatim into each successor milestone's roadmap; empty on the very first milestone.)

## Done

- **S-01: Kierownik dodaje i edytuje specjalności wykonawców w wybranym projekcie** — Archived 2026-09-25 → `context/archive/2026-09-25-project-specialties/`. Lesson: —.
- **S-02: kierownik dodaje zadanie (numer, nazwa, specjalność, nakład, poprzednicy jako numery) i widzi listę zadań projektu** — Archived 2026-09-25 → `context/archive/2026-09-25-task-add/`. Lesson: —.
