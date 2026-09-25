# Sprawdzenie listy zadań: proste kryteria — Plan Brief

> Full plan: `context/changes/task-check-problems/plan.md`

## What & Why

Kierownik projektu ma otworzyć stronę `/tasks/check` i zobaczyć zadania z problemami: nieistniejący poprzednik, brak odpowiedzialności (brak specjalności albo nakład pusty lub równy 0) i duplikat nazwy, każdy z powodem (FR-008 częściowo, FR-009). To gwiazda przewodnia kamienia milowego M-2: pierwsza historia, która pokazuje, że produkt robi to, do czego powstał, czyli zastępuje kilkugodzinne sprawdzanie w arkuszu.

## Starting Point

Po M-1 aplikacja ma projekty, specjalności i zadania (lista, dodawanie, edycja), a `listTasks` zwraca zadania z numerem, nazwą, specjalnością, nakładem i poprzednikami. Brak funkcji sprawdzenia, strony wyniku i przycisku uruchamiającego.

## Desired End State

Na `/tasks` jest przycisk „Sprawdź listę zadań”. `/tasks/check` liczy wynik na żądanie i pokazuje zadania z problemami, posortowane po numerze, z powodami i linkiem „Edytuj”; jedno zadanie może mieć kilka powodów. Gdy problemów nie ma, strona pokazuje neutralny komunikat z zastrzeżeniem, że cykle nie są jeszcze sprawdzane, i nigdzie nie mówi „wszystko w porządku”. `npm run smoke` to potwierdza.

## Key Decisions Made

| Decision                    | Choice                                                                | Why (1 sentence)                                                                                       | Source  |
| --------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------- |
| Wynik                       | Liczony na żądanie z aktualnej listy, bez zapisu w bazie              | Nigdy nie pokaże nieaktualnego wyniku i nie wymaga migracji; stan projektu (S-06) zdecyduje osobno      | Plan    |
| Miejsce w interfejsie       | Osobna strona `/tasks/check` otwierana przyciskiem z `/tasks`         | Lista zadań zostaje prosta, a ta sama strona pomieści cykle (S-05) i stan projektu (S-06)              | Plan    |
| Testy                       | Tylko rozszerzony smoke, bez nowego frameworka                        | Zgodne z M-1 i celem „szybkość”; cykle (S-05) mogą uzasadnić testy jednostkowe                          | Plan    |
| Bez fałszywego „OK”         | Komunikat pustego wyniku zastrzega, że cykle nie są sprawdzane         | PRD zabrania „wszystko w porządku” przy niewykrytej sprzeczności, a cykle dochodzą dopiero w S-05       | Roadmap |
| Duplikat                    | Nazwa po `trim()` i `toLowerCase()`; oznaczane wszystkie zadania grupy | Definicja z PRD (Open Questions nr 5); wynik nie zależy od kolejności ani numerów                       | PRD     |
| Nakład 0 i pusty            | Jeden powód „brak odpowiedzialności”, ale komunikat rozróżnia oba      | PRD traktuje oba tak samo, a użytkownik powinien wiedzieć, co poprawić                                  | Plan    |
| Logika sprawdzenia          | Czysta funkcja `checkTasks(Task[])` w `src/lib/task-check.ts`          | Bez bazy i Astro; S-05 dokłada czwarte kryterium bez zmian reszty                                       | Plan    |
| Fazy                        | Jedna: logika, strona i smoke                                         | Użytkownik uznał podział na dwie za zbyt szczegółowy; wycinek nie ma migracji                           | Plan    |

## Scope

**In scope:** typy wyniku, funkcja `checkTasks`, strona `/tasks/check`, przycisk „Sprawdź listę zadań” na `/tasks`, kroki smoke (w tym przypadek bez problemów i kilka powodów na jednym zadaniu).

**Out of scope:** cykle zależności i komunikat „nie znaleziono problemów” (S-05), stan projektu i zapamiętywanie wyniku (S-06), usuwanie i zmiana numeru (S-07–S-09), filtrowanie i eksport wyniku, nowy framework testowy.

## Architecture / Approach

Strona `/tasks/check` wczytuje zadania wybranego projektu przez istniejące `listTasks`, przekazuje je do czystej funkcji `checkTasks` i wyświetla wynik; brak zmian w bazie i migracji. Autoryzację robią reguły w bazie i middleware (prefiks `/tasks`). Kroki smoke dodają zadania z każdym rodzajem problemu i sprawdzają wynik od strony użytkownika.

## Phases at a Glance

| Phase                                        | What it delivers                                                        | Key risk                                                                 |
| -------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1. Sprawdzenie zadań: logika, strona i smoke | Typy, `checkTasks`, `/tasks/check`, przycisk na liście, kroki smoke      | Brzegi definicji (kilka powodów, wielkość liter, nakład 0) i wording bez „OK” |

**Prerequisites:** S-03 wdrożone (zadania i ich edycja), Docker do lokalnego Supabase.
**Estimated effort:** ~1 sesja w 1 fazie.

## Open Risks & Assumptions

- Zastrzeżenie o cyklach w wyniku musi zniknąć dokładnie w S-05; do tego czasu wycinek nie jest wdrażany jako gotowa funkcja „wszystko sprawdzone”.
- Zakładamy porównywanie nazw przez `toLowerCase()` (bez normalizacji spacji wewnątrz nazwy), zgodnie z brzmieniem PRD.
- Wynik liczony na żądanie: stan „zweryfikowany” (S-06) będzie musiał przeliczyć wynik albo go zapamiętać.

## Success Criteria (Summary)

- Kierownik widzi zadania z nieistniejącym poprzednikiem, brakiem odpowiedzialności i duplikatem, każde z powodem, także kilka powodów naraz.
- Wynik bez problemów nigdy nie mówi „wszystko w porządku” i zastrzega, że cykle nie są sprawdzane.
- `npm run smoke`, lint, `astro check` i build przechodzą, a wdrożenie nie wymaga migracji.
