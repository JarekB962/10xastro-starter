# Usunięcie specjalności — Plan Brief

> Full plan: `context/changes/specialty-delete/plan.md`

## What & Why

Kierownik ma móc usunąć specjalność, o ile nie występuje w zadaniach projektu; użyta specjalność zostaje w projekcie z czytelnym komunikatem, które zadania jej używają (FR-005, US-01). Bez tego zbędne specjalności zostają w projekcie na zawsze (dziś znikają tylko z całym projektem).

## Starting Point

Aplikacja nie umie usuwać specjalności: tabela `specialties` nie ma polityki `delete`, nie ma trasy ani strony. Baza już blokuje usunięcie używanej specjalności (klucz obcy z `on delete restrict`), stan projektu (S-06) już cofa się po usunięciu specjalności dzięki wyzwalaczowi licznika, a usuwanie zadania (S-07) jest gotowym wzorcem.

## Desired End State

Link „Usuń” na liście specjalności i na stronie edycji prowadzi na stronę potwierdzenia. Specjalność nieużywana da się usunąć, a przy używanej strona pokazuje listę zadań, które jej używają, z linkami „Edytuj” i bez przycisku usunięcia. Bezpośredni `POST` też jest blokowany, usunięcie cofa stan projektu do „niezweryfikowany”, a usuwanie całego projektu działa jak dotąd.

## Key Decisions Made

| Decision                    | Choice                                                                        | Why (1 sentence)                                                                                         | Source  |
| --------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------- |
| Wzorzec interfejsu          | Jak w S-07: strona potwierdzenia z listą blokujących zadań, linki „Usuń” na liście i w edycji | Spójne z usuwaniem zadania i projektu, bez JavaScriptu, blokadę widać zanim cokolwiek się kliknie         | Plan    |
| Blokada                     | Istniejący klucz obcy `restrict` (`23503`), bez własnego wyzwalacza            | Baza już pilnuje reguły bezwarunkowo, także przy wyścigach; brakuje tylko polityki `delete`               | Roadmap |
| Lista zadań używających     | Liczona w aplikacji (`findTasksWithSpecialty`), klucz obcy to zabezpieczenie   | Prosty komunikat i strona potwierdzenia z listą; czysta funkcja łatwa do przetestowania                   | Plan    |
| Stan projektu               | Bez zmian w kodzie; wyzwalacz licznika z S-06 obsługuje `DELETE` na `specialties` | Usunięcie cofa stan automatycznie; dodajemy tylko krok smoke                                             | Roadmap |
| Fazy                        | Jedna: baza, usługa, strony i smoke                                           | Najmniejszy wycinek M-2, spójny z poprzednimi                                                            | Plan    |

## Scope

**In scope:** migracja (polityka `delete`), `findTasksWithSpecialty` z testami jednostkowymi, usługa `deleteSpecialty`, trasa `POST /api/specialties/[id]/delete`, strona potwierdzenia, dwa linki „Usuń”, kroki smoke, `db push` na produkcji.

**Out of scope:** zmiana numeru zadania (S-08), przenoszenie zadań na inną specjalność jednym kliknięciem, usuwanie wielu naraz, kosz, zmiany w stanie projektu i sprawdzeniu.

## Architecture / Approach

Baza pilnuje reguły (polityka `delete` dla właściciela i istniejący klucz obcy), aplikacja liczy listę zadań używających specjalności z listy zadań projektu i pokazuje ją na stronie potwierdzenia oraz w komunikacie po nieudanym `POST`. Trasa `POST` i strona potwierdzenia wzorowane są na usuwaniu zadania.

## Phases at a Glance

| Phase                                                 | What it delivers                                                                       | Key risk                                                                     |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1. Usuwanie specjalności: baza, usługa, strony i smoke | Migracja, `findTasksWithSpecialty` z testami, `deleteSpecialty`, trasa POST, strona potwierdzenia, linki, smoke | Kaskada przy usuwaniu projektu ze specjalnościami użytymi w zadaniach nie może się zepsuć |

**Prerequisites:** S-06 wdrożone (stan projektu), S-07 jako wzorzec, Docker do lokalnego Supabase, dostęp do `npx supabase db push` na produkcji.
**Estimated effort:** ~1 sesja w 1 fazie.

## Open Risks & Assumptions

- Migracja musi trafić na produkcję (`db push`, ręcznie) przed wdrożeniem kodu; nowy kod na starej bazie nie usunie specjalności (brak polityki `delete`).
- Nowa polityka `delete` nie może zmienić zachowania kaskady z usuwanego projektu; pilnuje tego istniejący krok smoke usuwania projektu ze specjalnościami użytymi w zadaniach.
- S-08 dotyka tego samego `smoke.mjs`, więc wycinki idą po kolei, nie równolegle.

## Success Criteria (Summary)

- Nieużywana specjalność da się usunąć i to cofa stan projektu; używana nie, a komunikat wskazuje zadania, które jej używają.
- Blokada działa także dla bezpośredniego `POST`, a użytkownik nie usunie cudzej specjalności.
- `db reset`, testy jednostkowe, `astro check`, lint, build i smoke przechodzą, migracja jest na produkcji przed wdrożeniem, a usuwanie projektu działa jak dotąd.
