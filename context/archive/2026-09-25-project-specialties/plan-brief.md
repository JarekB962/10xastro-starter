# Specjalności wykonawców w projekcie — Plan Brief

> Full plan: `context/changes/project-specialties/plan.md`

## What & Why

Kierownik projektu ma na stronie `/specialties` dodawać i edytować specjalności wykonawców w wybranym projekcie (FR-004). To pierwszy wycinek kamienia milowego M-1 i warunek dla zadań (S-02, S-03), bo zadanie wybiera specjalność z tej listy.

## Starting Point

Aplikacja ma już logowanie, projekty z wyborem projektu, reguły dostępu w bazie, wzorce migracji, usług, tras, formularzy i smoke z dwoma użytkownikami (zmiana `mvp-rel-01`). Brak tabeli, usługi i ekranów specjalności.

## Desired End State

Zalogowany kierownik z wybranym projektem wchodzi z paska u góry na `/specialties`, dodaje i poprawia specjalności, a próba dodania tej samej nazwy (inna wielkość liter) daje czytelny komunikat. Bez wybranego projektu widzi pusty stan. Cudze specjalności są niewidoczne (404), a `npm run smoke` to potwierdza.

## Key Decisions Made

| Decision                    | Choice                                                | Why (1 sentence)                                                        | Source |
| --------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------- | ------ |
| Unikalność nazwy            | Unikalna w projekcie, bez rozróżniania wielkości liter | Zadania wybierają specjalność z listy, więc duplikaty byłyby niejednoznaczne | Plan   |
| Miejsce zarządzania         | Strona `/specialties` dla wybranego projektu          | Zgodne z ideą FR-003 (praca w wybranym projekcie), adres bez id         | Plan   |
| Pola specjalności           | Tylko nazwa (do 100 znaków)                           | Wystarcza dla FR-004; cel mapy to szybkość                              | Plan   |
| Dostęp do danych            | RLS przez właściciela projektu, polityki select/insert/update | Specjalność należy do projektu, więc własność sprawdza się przez `projects` | Plan   |
| Usuwanie                    | Tylko kaskadowo z projektem (FR-005 zaparkowane)      | Brak polityki `delete`, akcje referencyjne pomijają RLS                 | Plan   |
| Projekt przy dodawaniu      | Z wyboru po stronie serwera, nie z formularza         | Formularz nie niesie identyfikatora, RLS i tak chroni przed cudzym      | Plan   |
| Wspólny kod błędów bazy     | Wyciągnięty z `projects.ts` do `db-errors.ts`         | Bez kopiowania logiki, zachowanie projektów bez zmian                   | Plan   |
| Testy                       | Rozszerzony `scripts/smoke.mjs`                       | Jak w `mvp-rel-01`, bez nowego frameworka                               | Plan   |

## Scope

**In scope:**
- Tabela `specialties` z RLS, unikalnością i kaskadą; typy; wspólne pomocniki błędów
- Usługa, walidacja zod, trasy `POST` dodania i edycji, ochrona w middleware
- Strony listy z formularzem i edycji po polsku, linki w pasku i na dashboardzie
- Kroki smoke dla dodania, duplikatu, edycji, izolacji i kaskady

**Out of scope:**
- Usuwanie specjalności i blokada użycia (FR-005), zadania (S-02, S-03), opis i inne pola
- Własna kolejność, wyszukiwanie, zmiana wyboru projektu ze strony specjalności
- Sprawdzanie spójności (FR-008, 009, 011), nowy framework testowy

## Architecture / Approach

Od dołu do góry, jak w `mvp-rel-01`: migracja i typy, potem usługa `specialties.ts` z trasami `POST` i przekierowaniami z `?error=`, potem strony Astro z formularzem React, na końcu smoke. Cały dostęp do danych przez jedną usługę, autoryzacja w bazie. Błędy bazy mapowane na `duplicate_name` / `not_found` / `unexpected`; brak projektu lub cudzy projekt to `not_found`.

## Phases at a Glance

| Phase                              | What it delivers                                              | Key risk                                                     |
| ---------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------ |
| 1. Baza, typy, pomocniki błędów    | Tabela z RLS i unikalnością, typy, wspólny moduł `db-errors`  | Reguły dostępu przez projekt; regres w zachowaniu projektów  |
| 2. Warstwa serwera                 | Usługa, walidacja, trasy dodania i edycji, middleware         | Poprawne mapowanie błędów (brak projektu = `not_found`)      |
| 3. Ekrany po polsku                | Strona listy z formularzem, strona edycji, linki              | Stany brzegowe: brak wyboru projektu, puste listy            |
| 4. Smoke i weryfikacja             | Kroki smoke, kaskada w bazie, migracja na produkcji           | Migracja musi trafić na produkcję przed wdrożeniem           |

**Prerequisites:** wybrany projekt i tabela `projects` (wdrożone w `mvp-rel-01`), lokalny Supabase (Docker).
**Estimated effort:** ~4 sesje, po jednej na fazę (podobny wzorzec do `mvp-rel-01`, ale mniejszy zakres).

## Open Risks & Assumptions

- Zmiana wyboru projektu między otwarciem strony a wysłaniem formularza doda specjalność do nowo wybranego projektu (akceptowalne, RLS chroni cudze dane).
- Bez polityki `delete` FR-005 będzie wymagał nowej migracji (zaparkowane świadomie).
- Migrację trzeba ręcznie wypchnąć na produkcję (`npx supabase db push`) przed wdrożeniem; job `deploy` tego nie robi.

## Success Criteria (Summary)

- Kierownik dodaje i edytuje specjalności w wybranym projekcie, a duplikat nazwy jest czytelnie odrzucony.
- Inny użytkownik nie widzi ani nie zmienia cudzych specjalności; usunięcie projektu usuwa jego specjalności.
- `npm run smoke`, `npm run lint`, `npx astro check` i `npm run build` przechodzą, CI zielone.
