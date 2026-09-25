# Poprawa zadania — Plan Brief

> Full plan: `context/changes/task-edit/plan.md`

## What & Why

Kierownik projektu ma na stronie `/tasks/[id]/edit` poprawiać istniejące zadanie: nazwę, specjalność, nakład i poprzedników (FR-006, część „poprawa”). To ostatni wycinek kamienia milowego M-1; po nim wprowadzanie i poprawianie danych jest kompletne, a kolejny kamień milowy może dodać sprawdzanie spójności.

## Starting Point

Aplikacja ma logowanie, projekty, specjalności i dodawanie zadań (zmiany `mvp-rel-01`, `project-specialties`, `task-add`) oraz wzorzec pary lista → edycja ze specjalności. Baza ma `tasks` z regułami dostępu, ale `task_predecessors` nie pozwala usuwać wierszy, nie ma funkcji zapisu poprawki, a `Task` nie niesie `project_id` ani `specialty_id`.

## Desired End State

Na `/tasks` każde zadanie ma „Edytuj”. Strona edycji pokazuje numer tylko do odczytu i formularz z bieżącymi wartościami; zapis zmienia nazwę, specjalność (także na brak), nakład (także na pusty) i całą listę poprzedników w jednej transakcji. Błędy dają czytelny komunikat z zachowanymi wartościami, cudze zadanie daje 404, a zmiana numeru jest niemożliwa także wprost w bazie. `npm run smoke` to potwierdza.

## Key Decisions Made

| Decision                    | Choice                                                            | Why (1 sentence)                                                                                   | Source  |
| --------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------- |
| Numer zadania               | Niezmienny; na stronie edycji tylko do odczytu                    | Zmiana numeru bez przenumerowania poprzedników zostawia wiszące odwołania, a to FR-007 (zaparkowane) | Plan    |
| Egzekwowanie niezmienności  | Aplikacja + wyzwalacz w bazie                                     | Polityka `update` dopuszcza dowolne kolumny, więc sam kod aplikacji nie chroni przy zapisie przez API | Plan    |
| Zapis poprawki              | Funkcja bazy `update_task` w jednej transakcji (`security invoker`) | Zamiana poprzedników to usunięcie i wstawienie; błąd nie może zostawić zadania bez poprzedników    | Plan    |
| Polityki poprzedników       | Dodać tylko `delete` (bez `update`)                               | Wiersz to sam klucz `(zadanie, numer)`, więc zamiana jest usunięciem i wstawieniem                  | Plan    |
| Numer do „własnego poprzednika” | Z zadania w bazie, nie z formularza                          | Formularz edycji nie niesie numeru, a wczytanie zadania daje też 404 dla cudzego                    | Plan    |
| Specjalności na liście wyboru | Z projektu zadania, nie z wybranego projektu                    | Wybór projektu może się zmienić, a klucz złożony i tak odrzuciłby cudzą specjalność                  | Plan    |
| Puste pola                  | Specjalność i nakład puste → brak; poprzednicy puste → czyszczone | Spójne z dodawaniem (S-02) i z PRD (braki wychwyci FR-008)                                          | Plan    |
| Równoczesna edycja          | Ostatni zapis wygrywa                                             | Aplikacja jednoosobowa (udostępnianie to zaparkowane FR-010)                                         | Plan    |
| Fazy                        | Dwie: baza i typy; serwer, ekrany i smoke                         | Użytkownik uznał cztery za zbyt szczegółowe; migracja zostaje osobno                                | Plan    |

## Scope

**In scope:** migracja (wyzwalacz niezmienności numeru, polityka `delete` poprzedników, funkcja `update_task`), typy, walidacja poprawki, `getTask` i `updateTask`, `POST /api/tasks/[id]`, strona `/tasks/[id]/edit`, link „Edytuj”, kroki smoke.

**Out of scope:** zmiana numeru i przenumerowanie (FR-007), usuwanie zadania i specjalności, sprawdzanie spójności (FR-008, 009, 011), blokada optymistyczna, przenoszenie zadania do innego projektu.

## Architecture / Approach

Od bazy do ekranów, jak w `task-add`: migracja i typy, potem usługa z walidacją, trasa `POST` i strona Astro z formularzem React w trybie edycji (numer tylko do odczytu). Trasa wczytuje zadanie (404 dla obcego, numer do walidacji), potem woła `rpc("update_task")`. Autoryzację robi RLS przez właściciela projektu, wspólne reguły pól pochodzą z `task-fields.ts`.

## Phases at a Glance

| Phase                          | What it delivers                                                                 | Key risk                                                              |
| ------------------------------ | -------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1. Baza danych i typy          | Wyzwalacz niezmienności numeru, polityka `delete`, `update_task`, typy           | Funkcja i wyzwalacz muszą działać razem z RLS i istniejącym wyzwalaczem poprzedników |
| 2. Serwer, ekrany i smoke      | Walidacja, `getTask`/`updateTask`, trasa, strona edycji, link „Edytuj”, smoke    | Tryb edycji w `TaskForm` i numer brany z bazy, nie z formularza       |

**Prerequisites:** S-01 i S-02 wdrożone (zadania i specjalności), Docker do lokalnego Supabase.
**Estimated effort:** ~1–2 sesje w 2 fazach.

## Open Risks & Assumptions

- Niezmienny numer oznacza, że literówkę w numerze naprawi dopiero FR-007 (usunięcie i dodanie od nowa); to świadomy koszt tego kamienia.
- Wyzwalacz niezmienności numeru będzie musiał zostać zdjęty lub obejściem zastąpiony przez FR-007.
- Zakładamy, że dopasowanie tras chronionych w middleware działa po prefiksie (`/api/tasks`, `/tasks`), więc nowe adresy dziedziczą ochronę; potwierdzi to smoke.

## Success Criteria (Summary)

- Kierownik poprawia nazwę, specjalność, nakład i poprzedników zadania, a lista pokazuje nowe wartości; numer pozostaje bez zmian.
- Własny poprzednik, zły nakład i pusta nazwa są odrzucone z komunikatem; cudze zadanie daje 404; zmiana numeru wprost w bazie jest niemożliwa.
- `npm run smoke`, lint, `astro check` i build przechodzą, a migracja jest na produkcji przed wdrożeniem kodu.
