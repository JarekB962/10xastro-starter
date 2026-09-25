# Stan projektu (zweryfikowany / niezweryfikowany) — Plan Brief

> Full plan: `context/changes/project-verified-state/plan.md`

## What & Why

Kierownik ma widzieć stan projektu: „zweryfikowany” wyłącznie wtedy, gdy ostatnie sprawdzenie nie znalazło problemów, a od tego czasu nie zmieniły się dane; w przeciwnym razie „niezweryfikowany” (FR-011, Business Logic PRD). Stan nie jest ustawiany ręcznie i musi cofać się po każdej zmianie danych, bo inaczej pojawia się fałszywe „OK”, przed którym chroni guardrail PRD.

## Starting Point

Projekt nie ma żadnego stanu. `/tasks/check` liczy wynik w locie i niczego nie zapisuje, a zapisy danych idą różnymi drogami (funkcje `create_task` i `update_task`, zwykłe operacje na specjalnościach), do których wkrótce dojdą usuwanie zadania, zmiana numeru i usuwanie specjalności (S-07–S-09).

## Desired End State

Na pulpicie, liście zadań i stronie sprawdzenia widać „Stan projektu: zweryfikowany” lub „niezweryfikowany”. Wejście na `/tasks/check` w projekcie bez problemów zapisuje „zweryfikowany”, a każda zmiana zadania, poprzedników lub specjalności cofa stan do „niezweryfikowany”. Stanu nie da się ustawić bezpośrednio przez API, a przyszłe wycinki zapisujące dane cofają go automatycznie.

## Key Decisions Made

| Decision                    | Choice                                                                          | Why (1 sentence)                                                                                          | Source  |
| --------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------- |
| Zmiana specjalności         | Każda zmiana (dodanie, nazwa, usunięcie, zmiana w zadaniu) cofa stan             | Zgodne z literą PRD i guardrailem; jeden wyzwalacz na tabeli specjalności, więc S-09 działa automatycznie | User    |
| Gdzie widać stan            | Pulpit, lista zadań, strona sprawdzenia                                         | Stan jest tam, gdzie kierownik pracuje i gdzie go zmienia                                                 | User    |
| Uruchomienie sprawdzenia    | Wejście na `/tasks/check` zapisuje stan (bez nowego przycisku i trasy)          | Bez zmiany interfejsu; zapis jest warunkowy i wynika tylko z faktycznego wyniku                           | User    |
| Model stanu                 | Dwa liczniki: `data_revision` (zmiany) i `verified_revision` (ostatnia weryfikacja) | Usunięcia i przyszłe zapisy też podnoszą licznik; „zweryfikowany” = liczniki równe                         | Plan    |
| Kto cofa stan               | Wyzwalacze w bazie na `tasks`, `task_predecessors`, `specialties`               | Obejmują wszystkie obecne i przyszłe ścieżki zapisu bez pracy w aplikacji                                 | Roadmap |
| Ochrona przed ręcznym ustawieniem | Osobna tabela bez polityk zapisu, zapis tylko funkcją `security definer`    | Użytkownik nie ustawi stanu przez API; funkcja sprawdza właściciela                                       | PRD     |
| Wyścig odczyt–zapis         | `verify_project(projekt, licznik)` zapisuje tylko przy niezmienionym liczniku; licznik czytany przed zadaniami | Zmiana w trakcie sprawdzenia nie może dać fałszywego „zweryfikowany”              | Plan    |
| Fazy                        | Jedna: baza, usługa, widoki i smoke                                             | Spójne z poprzednimi wycinkami; baza i interfejs sprawdzane razem                                         | Plan    |

## Scope

**In scope:** tabela `project_states`, wyzwalacze, funkcja `verify_project`, typy bazy, usługa stanu, znacznik stanu na trzech stronach, zapis stanu w `/tasks/check`, kroki smoke, `db push` na produkcji.

**Out of scope:** powody niezweryfikowania, historia sprawdzeń, stan na liście projektów, przycisk POST „Uruchom sprawdzenie”, ręczne ustawianie stanu, usuwanie zadań i specjalności oraz zmiana numeru (S-07–S-09).

## Architecture / Approach

Baza trzyma dwa liczniki na projekt; wyzwalacze podnoszą `data_revision` przy każdej zmianie danych, a `verify_project` przepisuje go do `verified_revision` tylko wtedy, gdy nic się nie zmieniło od odczytu. Aplikacja czyta stan przed zadaniami, po pustym wyniku sprawdzenia wywołuje funkcję, a strony pokazują znacznik z jednego komponentu.

## Phases at a Glance

| Phase                                         | What it delivers                                                             | Key risk                                                                          |
| --------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1. Stan projektu: baza, usługa, widoki i smoke | Migracja, typy, usługa stanu, znacznik na trzech stronach, zapis w sprawdzeniu, smoke | Szczelność cofania (każdy zapis musi podnosić licznik) i kaskada przy usuwaniu projektu |

**Prerequisites:** S-05 wdrożone (`checkTasks`, `/tasks/check`), Docker do lokalnego Supabase, dostęp do `npx supabase db push` na produkcji.
**Estimated effort:** ~1 sesja w 1 fazie.

## Open Risks & Assumptions

- Migracja musi trafić na produkcję (`db push`, ręcznie) przed wdrożeniem kodu; nowy kod na starej bazie pokazuje „Nie udało się wczytać stanu projektu.” i nie weryfikuje.
- Funkcja `verify_project` ufa wynikowi sprawdzenia z aplikacji: kierownik mógłby ją wywołać bezpośrednio dla własnego projektu. Uznajemy to za akceptowalne (nie wpływa na innych; guardrail dotyczy przepływu aplikacji).
- Wyzwalacz wywołany kaskadą z usuwanego projektu nie może naruszyć klucza obcego; pilnuje tego warunek istnienia projektu i istniejący krok smoke usuwania projektu.
- Każda zmiana specjalności (także samej nazwy) cofa stan, choć nazwa nie wpływa na wynik sprawdzenia; to świadoma decyzja zgodna z PRD.

## Success Criteria (Summary)

- Każda zmiana zadania, poprzedników i specjalności cofa stan do „niezweryfikowany”; sprawdzenie bez problemów przywraca „zweryfikowany”, a z problemami nie.
- Stan jest widoczny na pulpicie, liście zadań i stronie sprawdzenia; nie da się go ustawić bezpośrednio.
- `db reset`, testy jednostkowe, `astro check`, lint, build i smoke przechodzą, a migracja jest zastosowana na produkcji przed wdrożeniem.
