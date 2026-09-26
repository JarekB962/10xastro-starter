# Usunięcie zadania — Plan Brief

> Full plan: `context/changes/task-delete/plan.md`

## What & Why

Kierownik ma móc usunąć zadanie, o ile nie jest ono poprzednikiem innego zadania; próba usunięcia takiego zadania kończy się komunikatem, które zadania na nie wskazują (FR-007, US-01). Bez tej blokady usunięcie zostawiałoby w liście „nieistniejących poprzedników”, a wpisane dane mogłyby zginąć bez ostrzeżenia.

## Starting Point

Aplikacja nie umie usuwać zadań: tabela `tasks` nie ma polityki `delete`, nie ma trasy ani strony. Poprzednik to numer (nie klucz obcy), więc baza sama nie pilnuje zależności. Stan projektu (S-06) już cofa się po usunięciu zadania dzięki wyzwalaczowi licznika, a usuwanie projektu (ze strony potwierdzenia) jest gotowym wzorcem.

## Desired End State

Link „Usuń” na liście zadań i na stronie edycji prowadzi na stronę potwierdzenia. Zadanie niczyje jako poprzednik da się usunąć, a przy zadaniu-poprzedniku strona pokazuje „Zadanie nie może zostać usunięte: jest poprzednikiem zadań 3, 5, 7” z listą tych zadań i bez przycisku usunięcia. Bezpośredni `POST` też jest blokowany, usunięcie cofa stan projektu do „niezweryfikowany”, a usuwanie całego projektu działa jak dotąd.

## Key Decisions Made

| Decision                    | Choice                                                                        | Why (1 sentence)                                                                                             | Source  |
| --------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------- |
| Potwierdzenie               | Osobna strona `/tasks/[id]/delete` z listą blokujących zadań                   | Spójne z usuwaniem projektu, bez JavaScriptu, blokadę widać zanim cokolwiek się kliknie                       | User    |
| Miejsca z linkiem „Usuń”    | Lista zadań i strona edycji zadania                                           | Dwa naturalne miejsca pracy z zadaniem, bez zmian w sprawdzeniu                                              | User    |
| Blokada                     | Wyzwalacz `before delete` w bazie (`23001`); przy kaskadzie z projektu przepuszcza | Reguła obowiązuje każdą ścieżkę zapisu, a usuwanie projektu z wzajemnie zależnymi zadaniami nie może się wysypać | PRD     |
| Lista blokujących zadań     | Liczona w aplikacji (`findDependents`), wyzwalacz to zabezpieczenie przed wyścigiem | Prosty komunikat i strona potwierdzenia z listą; czysta funkcja łatwa do przetestowania                       | Plan    |
| Stan projektu               | Bez zmian w kodzie; wyzwalacz licznika z S-06 obsługuje `DELETE`               | Usunięcie cofa stan automatycznie; dodajemy tylko krok smoke                                                 | Roadmap |
| Wyścig przy dodawaniu poprzednika | Nie chronimy: powstaje zwykły „nieistniejący poprzednik” wykrywany przez sprawdzenie | Poprzednik to numer, PRD dopuszcza takie odwołania                                                          | Plan    |
| Fazy                        | Jedna: baza, usługa, strony i smoke                                           | Spójne z poprzednimi wycinkami                                                                               | Plan    |

## Scope

**In scope:** migracja (polityka `delete` i wyzwalacz), `findDependents` z testami jednostkowymi, usługa `deleteTask`, trasa `POST /api/tasks/[id]/delete`, strona potwierdzenia, dwa linki „Usuń”, kroki smoke, `db push` na produkcji.

**Out of scope:** zmiana numeru (S-08), usuwanie specjalności (S-09), link „Usuń” na stronie sprawdzenia, usuwanie wielu zadań, kosz, kaskadowe usuwanie odwołań, ochrona przed wyścigiem przy dodawaniu poprzednika.

## Architecture / Approach

Baza pilnuje reguły (polityka `delete` dla właściciela i wyzwalacz blokujący), aplikacja liczy listę zadań blokujących z listy zadań projektu i pokazuje ją na stronie potwierdzenia oraz w komunikacie po nieudanym `POST`. Trasa `POST` i strona potwierdzenia wzorowane są na usuwaniu projektu.

## Phases at a Glance

| Phase                                              | What it delivers                                                                | Key risk                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1. Usuwanie zadania: baza, usługa, strony i smoke | Migracja, `findDependents` z testami, `deleteTask`, trasa POST, strona potwierdzenia, linki, smoke | Szczelność blokady i kaskada przy usuwaniu projektu z wzajemnie zależnymi zadaniami |

**Prerequisites:** S-06 wdrożone (stan projektu i wyzwalacz licznika), Docker do lokalnego Supabase, dostęp do `npx supabase db push` na produkcji.
**Estimated effort:** ~1 sesja w 1 fazie.

## Open Risks & Assumptions

- Migracja musi trafić na produkcję (`db push`, ręcznie) przed wdrożeniem kodu; nowy kod na starej bazie nie usunie zadania (brak polityki `delete`).
- Wyzwalacz nie może blokować kaskady z usuwanego projektu; opiera się na tym, że w kaskadzie wiersz projektu jest już niewidoczny (jak w S-06), a pilnuje tego istniejący krok smoke usuwania projektu z cyklem zadań.
- Dodanie zadania wskazującego na usuwane zadanie w tej samej chwili może zostawić „nieistniejący poprzednik”; to zwykły problem wykrywany przez sprawdzenie.
- S-08 (zmiana numeru) zdejmie wyzwalacz niezmienności numeru; musi zachować regułę blokady usuwania.

## Success Criteria (Summary)

- Zadanie nieużywane jako poprzednik da się usunąć i to cofa stan projektu; zadanie-poprzednik nie, a komunikat wskazuje zadania blokujące.
- Blokada działa także dla bezpośredniego `POST`, a użytkownik nie usunie cudzego zadania.
- `db reset`, testy jednostkowe, `astro check`, lint, build i smoke przechodzą, migracja jest na produkcji przed wdrożeniem, a usuwanie projektu z zadaniami działa jak dotąd.
