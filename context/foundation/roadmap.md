---
project: "Plan projektu (WBS)"
version: 1
status: draft
created: 2026-09-25
updated: 2026-09-26
prd_version: 2
main_goal: speed
top_blocker: time
milestone_id: consistency-check-and-safe-delete
milestone_seq: 2
milestone_status: open
---

# Roadmap: Plan projektu (WBS)

> Derived from `context/foundation/prd.md` (v2) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-2: Sprawdzanie spójności i bezpieczne usuwanie** — Status: open

- **Intent:** Kierownik projektu uruchamia sprawdzenie listy zadań, widzi zadania z problemami i stan projektu (zweryfikowany lub nie), a przy tym może bezpiecznie usuwać specjalności i zadania oraz zmieniać numer zadania bez wiszących odwołań. Kamień milowy domyka pierwszy przepływ MVP z PRD (US-01) i główne kryterium sukcesu produktu.
- **Source materials:** `context/foundation/prd.md` (v2); zakres wybrany przez użytkownika: FR-005, FR-007, FR-008, FR-009, FR-011.
- **Done when:** every F-NN and S-NN below is `done`.
- **Scope anchors:** FR-005 (usunięcie specjalności), FR-007 (usunięcie zadania i zmiana numeru z poprawką poprzedników), FR-008 (sprawdzenie: cykle, nieistniejący poprzednik, brak odpowiedzialności, duplikaty), FR-009 (lista zadań z problemami), FR-011 (stan projektu); US-01 w pełni.

## Vision recap

Kierownik projektu na starcie dostaje listę zadań (specjalność wykonawcy, nakład, zadania poprzedzające) i musi sprawdzić, czy zależności między nimi nie są sprzeczne. Dziś robi to w arkuszu przez kilka godzin. Aplikacja ma to zastąpić: wymusić kompletne dane i automatycznie wykrywać sprzeczności.

## North star

**S-04: Kierownik uruchamia sprawdzenie i widzi zadania z problemami** — pierwsza historia, która pokazuje, że produkt robi to, do czego powstał, i stoi najwcześniej, jak pozwalają zależności; przy celu „szybkość” (`main_goal: speed`) daje najkrótszą ścieżkę do działającego sprawdzania.

> „Gwiazda przewodnia” to tu najmniejszy przepływ od początku do końca, którego dostarczenie dowodzi, że główna hipoteza produktu jest prawdziwa; stawiamy go możliwie najwcześniej, bo reszta ma sens tylko wtedy, gdy on działa.

## At a glance

| ID   | Change ID              | Outcome (user can …)                                                                                                       | Prerequisites | PRD refs               | Status   |
| ---- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------- | ---------------------- | -------- |
| S-04 | task-check-problems    | uruchomić sprawdzenie i zobaczyć zadania z nieistniejącym poprzednikiem, brakiem odpowiedzialności i duplikatem oraz powód | S-03 (done)   | FR-008, FR-009, US-01  | done |
| S-05 | task-check-cycles      | zobaczyć w sprawdzeniu zadania leżące na cyklu zależności i dostać komunikat „nie znaleziono problemów” tylko wtedy, gdy ich naprawdę nie ma | S-04          | FR-008, FR-009, US-01  | done |
| S-06 | project-verified-state | zobaczyć stan projektu (zweryfikowany lub niezweryfikowany), który cofa się po każdej zmianie danych                       | S-05          | FR-011, US-01          | done |
| S-07 | task-delete            | usunąć zadanie, o ile nie jest poprzednikiem innego zadania                                                                | S-06          | FR-007, US-01          | done |
| S-08 | task-renumber          | zmienić numer zadania, a aplikacja poprawi go automatycznie u zadań, które mają je jako poprzednika                        | S-06          | FR-007, US-01          | proposed |
| S-09 | specialty-delete       | usunąć specjalność, o ile nie występuje w zadaniach tego projektu                                                          | S-06          | FR-005, US-01          | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                  | Chain                    | Note                                                                                          |
| ------ | ---------------------- | ------------------------ | --------------------------------------------------------------------------------------------- |
| A      | Sprawdzanie i stan     | `S-04` → `S-05` → `S-06` | Ścieżka krytyczna produktu; przy celu „szybkość” idzie pierwsza i jako jedyna nie ma równoległej pary. |
| B      | Bezpieczna edycja zadań | `S-07` → `S-08`          | Dołącza do strumienia A w `S-06` (zapisy muszą cofać stan projektu).                          |
| C      | Bezpieczna edycja specjalności | `S-09`             | Dołącza do strumienia A w `S-06`; niezależny od B.                                            |

## Baseline

What's already in place in the codebase as of `2026-09-25` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro + React + Tailwind + shadcn/ui; ekrany projektów, specjalności i zadań (lista, dodawanie, edycja) w `src/pages/` i `src/components/`.
- **Backend / API:** present — trasy `POST` dla projektów, specjalności i zadań, usługi w `src/lib/services/`, walidacja zod w `src/lib/validation/`.
- **Data:** present — Supabase; tabele `projects`, `specialties`, `tasks`, `task_predecessors` z regułami dostępu, funkcje `create_task` i `update_task`, wyzwalacze niezmienności numeru i projektu zadania.
- **Auth:** present — logowanie i rejestracja, middleware chroniący trasy (`src/middleware.ts`), sesja w ciasteczkach.
- **Deploy / infra:** present — CI (`ci`, `smoke`, `deploy`), Cloudflare Workers, krok sprawdzający po wdrożeniu, że produkcja łączy się z Supabase; migracje zastosowane na produkcji ręcznie (`supabase db push`).
- **Observability:** partial — `observability` włączone w `wrangler.jsonc` i logi błędów `console.error`; brak metryk i śledzenia błędów.

## Foundations

(none — Baseline covers every layer this milestone needs; wszystkie nowe elementy wchodzą w pionowych wycinkach poniżej.)

## Slices

### S-04: Sprawdzenie listy zadań: proste kryteria

- **Outcome:** kierownik uruchamia sprawdzenie listy zadań wybranego projektu i widzi zadania z problemami: nieistniejący poprzednik (numer, którego nie ma w projekcie), brak odpowiedzialności (brak specjalności albo nakład pusty lub równy 0) i duplikat (ta sama nazwa po obcięciu spacji, bez rozróżniania wielkości liter; oznaczane są wszystkie zadania o tej nazwie), każde z powodem.
- **Change ID:** task-check-problems
- **PRD refs:** FR-008, FR-009, US-01
- **Prerequisites:** S-03 (done)
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Czy wynik sprawdzenia jest liczony na żądanie przy każdym otwarciu, czy zapamiętywany (potrzebne później dla stanu projektu, S-06)? — Owner: user. Block: no.
- **Risk:** Bez wykrywania cykli (S-05) pusta lista nie może mówić „wszystko w porządku” (PRD zabrania fałszywego „OK”), więc ten wycinek tylko wypisuje znalezione problemy i nie pokazuje komunikatu o braku problemów; jest to świadome ograniczenie, nie wdrażamy go jako gotowej funkcji przed S-05.
- **Status:** done

### S-05: Sprawdzenie listy zadań: cykle zależności

- **Outcome:** kierownik widzi w sprawdzeniu wszystkie zadania leżące na cyklu zależności (co najmniej dwa zadania zależne od siebie bezpośrednio lub pośrednio) i dostaje komunikat „nie znaleziono problemów” wyłącznie wtedy, gdy żadne z czterech kryteriów nie znalazło problemu.
- **Change ID:** task-check-cycles
- **PRD refs:** FR-008, FR-009, US-01
- **Prerequisites:** S-04
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Najtrudniejsze kryterium (wykrywanie cykli w grafie, w którym poprzednik może wskazywać nieistniejący numer); błąd daje fałszywe „OK”, czyli dokładnie to, przed czym PRD chroni. Idzie zaraz po S-04, żeby komunikat o braku problemów pojawił się dopiero, gdy wszystkie cztery kryteria działają.
- **Status:** done

### S-06: Stan projektu

- **Outcome:** kierownik widzi stan projektu: „zweryfikowany” wyłącznie wtedy, gdy ostatnie sprawdzenie nie znalazło problemów, w przeciwnym razie „niezweryfikowany”; każda zmiana danych po sprawdzeniu (dodanie lub poprawa zadania, zmiana specjalności) cofa projekt do „niezweryfikowany”.
- **Change ID:** project-verified-state
- **PRD refs:** FR-011, US-01
- **Prerequisites:** S-05
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Czy „zmiana specjalności” oznacza też edycję nazwy specjalności w projekcie, czy tylko przypisanie innej specjalności do zadania? — Owner: user. Block: no.
- **Risk:** Stan „zweryfikowany” po zmianie danych to fałszywe „OK” (guardrail z PRD); wycinek musi objąć zapisy z już wdrożonych wycinków (dodanie i poprawa zadania, specjalności), a każdy kolejny wycinek zapisujący dane (S-07, S-08, S-09) musi go respektować, dlatego stoją za nim.
- **Status:** done

### S-07: Usunięcie zadania

- **Outcome:** kierownik usuwa zadanie, jeśli nie jest ono poprzednikiem innego zadania; próba usunięcia takiego zadania kończy się komunikatem, które zadania na nie wskazują.
- **Change ID:** task-delete
- **PRD refs:** FR-007, US-01
- **Prerequisites:** S-06
- **Parallel with:** S-09
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Usunięcie zadania jest zmianą danych, więc musi cofać stan projektu (S-06); stąd kolejność. Wprowadza też pierwsze usuwanie zadań, którego dziś nie ma w regułach dostępu.
- **Status:** done

### S-08: Zmiana numeru zadania

- **Outcome:** kierownik zmienia numer zadania, a aplikacja automatycznie poprawia ten numer u wszystkich zadań, które mają je jako poprzednika; zajęty numer jest odrzucany.
- **Change ID:** task-renumber
- **PRD refs:** FR-007, US-01
- **Prerequisites:** S-06
- **Parallel with:** S-09
- **Blockers:** —
- **Unknowns:**
  - Co, gdy nowy numer jest wpisany jako „nieistniejący poprzednik” u innych zadań (literówka, która po zmianie numeru zaczęłaby wskazywać to zadanie)? Poprawiać tylko poprzedników, którzy wskazywali stary numer, czy też przepinać te? — Owner: user. Block: no.
- **Risk:** Zdejmuje zabezpieczenie z S-03 (wyzwalacz niezmienności numeru), więc zmiana numeru i poprawa poprzedników muszą zapisać się razem albo wcale, bez wiszących odwołań; błąd daje zadania wskazujące na niewłaściwe zadanie.
- **Status:** proposed

### S-09: Usunięcie specjalności

- **Outcome:** kierownik usuwa specjalność, jeśli nie występuje w zadaniach tego projektu; użyta specjalność zostaje w projekcie z czytelnym komunikatem.
- **Change ID:** specialty-delete
- **PRD refs:** FR-005, US-01
- **Prerequisites:** S-06
- **Parallel with:** S-07, S-08
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Najmniejszy wycinek; baza już blokuje usunięcie używanej specjalności, więc ryzykiem jest tylko brakująca polityka usuwania i cofnięcie stanu projektu (S-06).
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID              | Suggested issue title                                        | Ready for `/10x-plan` | Notes                        |
| ---------- | ---------------------- | ------------------------------------------------------------ | --------------------- | ---------------------------- |
| S-04       | task-check-problems    | Sprawdzenie zadań: nieistniejący poprzednik, brak odpowiedzialności, duplikaty | yes                   | Run `/10x-plan task-check-problems` |
| S-05       | task-check-cycles      | Sprawdzenie zadań: cykle zależności i komunikat „brak problemów” | no                    | Czeka na S-04                |
| S-06       | project-verified-state | Stan projektu (zweryfikowany / niezweryfikowany)             | no                    | Czeka na S-05                |
| S-07       | task-delete            | Usunięcie zadania, które nie jest poprzednikiem              | no                    | Czeka na S-06                |
| S-08       | task-renumber          | Zmiana numeru zadania z poprawką poprzedników                | no                    | Czeka na S-06                |
| S-09       | specialty-delete       | Usunięcie specjalności nieużywanej w zadaniach               | no                    | Czeka na S-06                |

## Open Roadmap Questions

1. **Jakie są drugorzędne kryteria sukcesu (Secondary)?** — Owner: user. Block: no.
2. **Jakie są `target_scale.qps` i `target_scale.data_volume`?** — Owner: user. Block: no.
3. **Zakres kontra czas.** — `mvp_weeks: 5` to własny szacunek, do `hard_deadline` 2026-11-04 zostaje około 6 tygodni pracy po godzinach; M-2 ma sześć wycinków, z czego trzy ostatnie (bezpieczna edycja) są rozszerzeniem ponad główne kryterium sukcesu. Owner: user. Block: roadmap-wide.
4. **Kim są odbiorcy udostępnionego projektu (FR-010) i czy udostępnianie zostaje w produkcie?** — Owner: user. Block: no.
5. **Jaka jest rola oszacowań nakładu i specjalności poza kontrolą kompletności?** — Owner: user. Block: no.
6. **Co po M-2: nice-to-have (FR-010 udostępnianie, FR-012 klonowanie), czy uznajemy MVP za domknięte?** — Owner: user. Block: no.

## Parked

- **FR-010: udostępnianie projektu do podglądu** — Why parked: nice-to-have, poza pierwszym przepływem (PRD Non-Goals).
- **FR-012: klonowanie projektu** — Why parked: nice-to-have, poza pierwszym przepływem (PRD Non-Goals).
- **Wykrywanie pominiętych zadań w zakresie** — Why parked: PRD Non-Goals.
- **Wklejanie zadań z arkusza** — Why parked: PRD Non-Goals (wersja 2).
- **Grupowanie zadań w etapy** — Why parked: PRD Non-Goals (wersja 2).
- **Aplikacja na telefon i tablet** — Why parked: PRD Non-Goals.

## Milestone History

(Append-only. Carried forward verbatim into each successor milestone's roadmap; empty on the very first milestone.)

- **M-1: Wprowadzanie specjalności i zadań** (`task-data-entry`) — closed 2026-09-25. Kierownik dodaje i edytuje specjalności oraz dodaje i poprawia zadania w wybranym projekcie (S-01, S-02, S-03; FR-004, FR-006); wdrożone na produkcji.

## Done

- **S-01: Kierownik dodaje i edytuje specjalności wykonawców w wybranym projekcie** — Archived 2026-09-25 → `context/archive/2026-09-25-project-specialties/`. Lesson: —.
- **S-02: kierownik dodaje zadanie (numer, nazwa, specjalność, nakład, poprzednicy jako numery) i widzi listę zadań projektu** — Archived 2026-09-25 → `context/archive/2026-09-25-task-add/`. Lesson: —.
- **S-03: kierownik poprawia zadanie (nazwa, specjalność, nakład, poprzednicy)** — Archived 2026-09-25 → `context/archive/2026-09-25-task-edit/`. Lesson: —.
- **S-04: kierownik uruchamia sprawdzenie listy zadań i widzi zadania z nieistniejącym poprzednikiem, brakiem odpowiedzialności i duplikatem nazwy wraz z powodem** — Archived 2026-09-25 → `context/archive/2026-09-25-task-check-problems/`. Lesson: —.
- **S-05: kierownik widzi w sprawdzeniu wszystkie zadania leżące na cyklu zależności (co najmniej dwa zadania zależne od siebie bezpośrednio lub pośrednio) i dostaje komunikat „nie znaleziono problemów” wyłącznie wtedy, gdy żadne z czterech kryteriów nie znalazło problemu.** — Archived 2026-09-25 → `context/archive/2026-09-25-task-check-cycles/`. Lesson: —.
- **S-06: kierownik widzi stan projektu: „zweryfikowany” wyłącznie wtedy, gdy ostatnie sprawdzenie nie znalazło problemów, w przeciwnym razie „niezweryfikowany”; każda zmiana danych po sprawdzeniu (dodanie lub poprawa zadania, zmiana specjalności) cofa projekt do „niezweryfikowany”.** — Archived 2026-09-25 → `context/archive/2026-09-25-project-verified-state/`. Lesson: —.
- **S-07: kierownik usuwa zadanie, jeśli nie jest ono poprzednikiem innego zadania; próba usunięcia takiego zadania kończy się komunikatem, które zadania na nie wskazują.** — Archived 2026-09-26 → `context/archive/2026-09-26-task-delete/`. Lesson: —.
