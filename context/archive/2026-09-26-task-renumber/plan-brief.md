# Zmiana numeru zadania — Plan Brief

> Full plan: `context/changes/task-renumber/plan.md`

## What & Why

Kierownik ma móc zmienić numer zadania, a aplikacja automatycznie poprawia ten numer u wszystkich zadań, które mają je jako poprzednika (FR-007, US-01). Zajęty numer jest odrzucany, a numer, który inne zadania już wpisały jako poprzednika (np. literówka), też, żeby po cichu nie powstała zależność, której kierownik nie chciał (guardrail PRD przed fałszywym „OK”).

## Starting Point

Numer zadania jest dziś niezmienny: wyzwalacz z S-03 odrzuca każdą jego zmianę, a formularz edycji pokazuje go tylko jako tekst. Poprzednik to numer (nie klucz obcy), więc zmiana numeru wymaga jednoczesnego przepisania poprzedników. Zapis poprawki idzie funkcją `update_task` w jednej transakcji, a stan projektu (S-06) cofa się po każdej zmianie zadań i poprzedników.

## Desired End State

Pole „Numer zadania” w formularzu edycji jest edytowalne. Zapis z nowym numerem zmienia numer i przepisuje stary numer na nowy u zadań, które miały je jako poprzednika, w jednej transakcji. Zajęty numer, numer równy własnemu poprzednikowi i numer z wiszącymi odwołaniami u innych zadań są odrzucane czytelnym komunikatem, a numer zostaje. Zmiana numeru cofa stan projektu do „niezweryfikowany”, a reguła obowiązuje także dla zapisu prosto przez API bazy.

## Key Decisions Made

| Decision                    | Choice                                                                          | Why (1 sentence)                                                                                             | Source  |
| --------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------- |
| Gdzie zmieniać numer        | W formularzu edycji zadania (pole staje się edytowalne)                         | Jedno miejsce i jeden zapis w jednej transakcji, bez nowej strony                                            | User    |
| Wiszący numer               | Zmiana na numer, który inne zadania mają jako poprzednika, jest odrzucana z listą tych zadań | Nigdy nie powstaje po cichu nowa zależność (fałszywe „OK”)                                                | User    |
| Kto przepisuje poprzedników | Wyzwalacz `after update` na `tasks` w bazie (zastępuje wyzwalacz niezmienności) | Atomowo i dla każdej ścieżki zapisu; brak duplikatów klucza, bo wiszące odwołania są odrzucane               | Plan    |
| Numer równy własnemu poprzednikowi | Odrzucony („własny poprzednik”)                                           | Zgodne z PRD (blokada własnego poprzednika przy zapisie)                                                     | PRD     |
| Zgodność wdrożenia          | Nowa, przeciążona `update_task` z `p_number`; stara 5-argumentowa zostaje do sprzątania | Stary kod działa na nowej bazie w czasie między `db push` a wdrożeniem                                  | Plan    |
| Stan projektu               | Bez zmian w kodzie; wyzwalacze licznika z S-06 obsługują `update`               | Zmiana numeru cofa stan automatycznie; dodajemy tylko krok smoke                                             | Roadmap |
| Fazy                        | Jedna: baza, usługa, formularz i smoke                                          | Spójne z poprzednimi wycinkami                                                                               | Plan    |

## Scope

**In scope:** migracja (wyzwalacz przepisujący poprzedników, `update_task` z numerem), typy, walidacja, usługa z mapowaniem błędów i listą zadań z wiszącym numerem, edytowalny numer w formularzu i trasie edycji, kroki smoke, `db push` na produkcji.

**Out of scope:** osobna strona „Zmień numer”, przepinanie wiszących odwołań, zmiany w formularzu dodawania, usunięcie starej `update_task` (osobna migracja po wdrożeniu), zmiany w sprawdzeniu, usuwaniu i stanie projektu.

## Architecture / Approach

Baza przepisuje poprzedników: wyzwalacz przy zmianie `number` najpierw odrzuca własnego poprzednika i wiszące odwołania, potem zamienia stary numer na nowy u zadań projektu. Funkcja `update_task` z numerem czyści własnych poprzedników, zmienia numer i pola, wstawia nową listę (w tej kolejności). Aplikacja waliduje numer jak przy dodawaniu, mapuje błędy bazy na komunikaty (z listą zadań przy wiszącym numerze) i przekierowuje jak dotąd.

## Phases at a Glance

| Phase                                              | What it delivers                                                                                | Key risk                                                                                  |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1. Zmiana numeru: baza, usługa, formularz i smoke | Migracja, typy, walidacja, usługa, edytowalny numer w formularzu i trasie, kroki smoke          | Błąd w przepisywaniu daje zadania wskazujące na niewłaściwe zadanie; stąd testy w smoke i test zepsucia wyzwalacza |

**Prerequisites:** S-06 wdrożone (stan projektu), S-07 wdrożone (`findDependents`), najlepiej po S-09 (wspólny `smoke.mjs`), Docker do lokalnego Supabase, dostęp do `npx supabase db push` na produkcji.
**Estimated effort:** ~1 sesja w 1 fazie.

## Open Risks & Assumptions

- Migracja musi trafić na produkcję (`db push`, ręcznie) przed wdrożeniem kodu; nowy kod na starej bazie nie zmieni numeru (brak nowej funkcji).
- Przepisanie poprzedników działa w całym projekcie zadania; zakładamy, że numer jednoznacznie identyfikuje zadanie w projekcie (unikalny indeks).
- Stara 5-argumentowa `update_task` zostaje w bazie do osobnego sprzątania po wdrożeniu.
- Istniejący krok smoke o „niezmienności numeru” (przesłanie `task_number=99`) jest świadomie zmieniany, bo po S-08 numer się zmienia.

## Success Criteria (Summary)

- Zmiana numeru przepisuje poprzedników u zadań, które go miały, a sprawdzenie nie zgłasza z tego powodu problemu.
- Zajęty numer, numer własnego poprzednika i numer z wiszącymi odwołaniami są odrzucane komunikatem, a numer zostaje.
- Zmiana numeru cofa stan projektu, a użytkownik nie przenumeruje cudzego zadania.
- `db reset`, testy jednostkowe, `astro check`, lint, build i smoke przechodzą, migracja jest na produkcji przed wdrożeniem, a zwykła poprawka zadania działa jak dotąd.
