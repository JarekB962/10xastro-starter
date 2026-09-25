# Dodawanie zadania — Plan Brief

> Full plan: `context/changes/task-add/plan.md`

## What & Why

Kierownik projektu ma na stronie `/tasks` dodawać zadania do wybranego projektu i widzieć ich listę (FR-006, część „dodawanie"). To drugi wycinek kamienia milowego M-1 i pierwszy, który wprowadza dane, na których działa późniejsze sprawdzenie spójności (numer, nazwa, specjalność, nakład, poprzednicy).

## Starting Point

Aplikacja ma logowanie, projekty z wyborem projektu i specjalności projektu (zmiany `mvp-rel-01` i `project-specialties`), wzorce migracji z RLS, usług, tras, formularzy i smoke z dwoma użytkownikami. Brak tabel, usługi i ekranów zadań.

## Desired End State

Zalogowany kierownik z wybranym projektem wchodzi na `/tasks`, dodaje zadania (numer i nazwa wymagane; specjalność, nakład i poprzednicy opcjonalne) i widzi je posortowane po numerze. Zajęty numer, poprzednik równy własnemu numerowi i błędny nakład dają czytelny komunikat, a wpisane wartości zostają. Cudzych zadań nie widać, a `npm run smoke` to potwierdza.

## Key Decisions Made

| Decision                        | Choice                                                              | Why (1 sentence)                                                                   | Source |
| ------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------ |
| Nakład                          | Liczba dziesiętna `>= 0`, bez jednostki, opcjonalna                 | PRD nie ustala jednostki, a FR-008 ocenia tylko pusty lub 0                        | Plan   |
| Specjalność i nakład            | Mogą być puste przy zapisie                                         | PRD v2 wymaga tylko numeru i nazwy; braki wychwyci sprawdzenie (FR-008)            | Plan   |
| Poprzednicy                     | Osobna tabela `task_predecessors` (zadanie, numer poprzednika)      | Decyzja użytkownika; ułatwia późniejsze zapytania grafowe                          | Plan   |
| Klucz poprzednika               | Numer bez klucza obcego do `tasks`                                  | PRD dopuszcza numer zadania, którego jeszcze nie ma                                | Plan   |
| Blokada samego siebie           | Walidacja zod + wyzwalacz w bazie                                   | Reguła działa także przy zapisie z S-03 i przenumerowaniu                          | Plan   |
| Nieistniejący poprzednik        | Zapis dozwolony, na liście bez ostrzeżenia                          | Wykrywanie braków to FR-008 (odłożone), bez dublowania kontroli                    | Plan   |
| Powtórzony poprzednik           | Scalany po cichu („3, 3, 5" → 3, 5)                                 | Pomyłka nie blokuje wpisywania kilkudziesięciu zadań                               | Plan   |
| Specjalność z tego samego projektu | Złożony klucz obcy `(specialty_id, project_id)`                  | RLS sam nie odróżni specjalności z innego projektu tego samego użytkownika         | Plan   |
| Zapis zadania z poprzednikami   | Funkcja bazy `create_task` w jednej transakcji (`security invoker`) | Uniknięcie zadania bez poprzedników po częściowym błędzie, bez polityki `delete`   | Plan   |
| Numer zadania                   | Liczba całkowita od 1, unikalna w projekcie                         | Zgodne z FR-006 i PRD v2                                                           | Plan   |
| Fazy                            | Trzy: baza i typy, serwer i ekrany, smoke                           | Użytkownik uznał czwórkę za zbyt szczegółową; migracja zostaje osobno               | Plan   |

## Scope

**In scope:** tabele `tasks` i `task_predecessors` z RLS, funkcja `create_task`, walidacja, usługa, `POST /api/tasks`, strona `/tasks` (formularz i lista), linki z dashboardu i listy projektów, kroki smoke.

**Out of scope:** poprawa zadania i przenumerowanie (S-03), usuwanie zadania i specjalności (S-04, FR-005), sprawdzanie spójności (FR-008, 009, 011), jednostka nakładu, stronicowanie i sortowanie.

## Architecture / Approach

Od bazy do ekranów, jak w `project-specialties`: migracja i typy, potem moduł `tasks.ts` z walidacją, trasą `POST` z przekierowaniem i stroną Astro z formularzem React. Projekt pochodzi z wyboru po stronie serwera, autoryzację robi RLS (własność przez `projects`), a dodanie idzie przez `rpc("create_task")`.

## Phases at a Glance

| Phase                          | What it delivers                                                          | Key risk                                                           |
| ------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1. Baza danych i typy          | Tabele, RLS, wyzwalacz, `create_task`, typy                               | Błąd w modelu danych kosztuje każdy późniejszy wycinek             |
| 2. Serwer i ekrany             | Walidacja, usługa, `POST /api/tasks`, strona `/tasks`, nawigacja          | Mapowanie kodów błędów zadań i parsowanie liczb oraz poprzedników  |
| 3. Smoke i weryfikacja         | Kroki smoke, `db push` na produkcję                                       | Migracja na produkcji przed kodem                                  |

**Prerequisites:** S-01 wdrożone (specjalności), Docker do lokalnego Supabase.
**Estimated effort:** ~2–3 sesje w 3 fazach.

## Open Risks & Assumptions

- Zakładamy numer od 1 wzwyż (zero i liczby ujemne odrzucone); PRD mówi tylko „liczba całkowita".
- S-03 musi dodać polityki `update`/`delete` dla poprzedników i pilnować zmiany numeru na jeden z poprzedników (wyzwalacz z tego wycinka chroni tylko zapis poprzednika).
- Bez FR-008 literówka w numerze poprzednika pozostaje niewidoczna do czasu sprawdzenia.

## Success Criteria (Summary)

- Kierownik dodaje zadanie z poprzednikami i widzi je na liście posortowanej po numerze.
- Zajęty numer i blokada samego siebie działają w aplikacji i w bazie; cudze zadania są niewidoczne.
- `npm run smoke`, lint, `astro check` i build przechodzą, a migracja jest zastosowana na produkcji przed wdrożeniem kodu.
