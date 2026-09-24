# Pierwsza wersja MVP: logowanie, projekty i wybór projektu — Plan Brief

> Full plan: `context/changes/mvp-rel-01/plan.md`

## What & Why

Pierwszy wycinek aplikacji „Plan projektu (WBS)": zalogowany kierownik prowadzi własną listę projektów, wybiera ten, w którym pracuje, i może go usunąć po potwierdzeniu. To fundament pod specjalności, zadania i sprawdzanie zależności, a zarazem najwcześniej zamyka największe ryzyko: wymóg „kierownik widzi tylko swoje projekty".

## Starting Point

Starter ma działające logowanie, rejestrację i wylogowanie (zwykłe formularze `POST`), ochronę tras w middleware i jeden test smoke logowania. Nie ma bazy danych aplikacji, migracji, typów ani usług, a wszystkie ekrany są po angielsku.

## Desired End State

Po zalogowaniu kierownik trafia na `/projects`, dodaje, edytuje, wybiera i usuwa projekty (usunięcie przez osobną stronę potwierdzenia), a `/dashboard` pokazuje wybrany projekt. Cudzych projektów nie widać ani nie da się otworzyć (404). Ekrany, także logowania, są po polsku, a `npm run smoke` sprawdza cały przepływ dwóch użytkowników.

## Key Decisions Made

| Decision            | Choice                                    | Why (1 sentence)                                              | Source |
| ------------------- | ----------------------------------------- | ------------------------------------------------------------- | ------ |
| Zakres zmiany       | FR-001..003 (konto, projekty, wybór)      | Mały wycinek zamyka fundament i ryzyko dostępu do danych      | Plan   |
| Dane projektu       | Nazwa unikalna (bez wielkości liter) + opis | Unikalność daje sens późniejszemu klonowaniu pod nową nazwą | Plan   |
| Wybór projektu      | Zapis w bazie (`user_settings`)           | Pamięta wybór między urządzeniami                             | Plan   |
| Potwierdzenie usunięcia | Osobna strona                         | Jasno opisuje skutki i działa bez JavaScriptu                 | Plan   |
| Język interfejsu    | Polski, w tym istniejące ekrany logowania | Spójne z PRD i z użytkownikiem                                | Plan   |
| Formularze          | Zwykłe `POST` z przekierowaniem i zod     | Ten sam wzorzec co logowanie, prosty test przez HTTP         | Plan   |
| Testy               | Rozszerzony `smoke.mjs`                   | Bez nowych zależności, działa w CI na prawdziwej bazie        | Plan   |
| Autoryzacja         | Reguły w bazie (`auth.uid()`)             | Dostęp nie zależy od kodu aplikacji                           | Plan   |

## Scope

**In scope:** migracja z `projects` i `user_settings` oraz regułami dostępu; typy i zod; usługa i cztery trasy `POST`; strony listy, dodania, edycji, potwierdzenia usunięcia i dashboard; tłumaczenie ekranów logowania; nowe kroki smoke.

**Out of scope:** specjalności, zadania, sprawdzanie i stan „zweryfikowany"; udostępnianie i klonowanie; import z arkusza i etapy; Playwright/Vitest; strona główna `/` i komunikaty Supabase po polsku; rozjazd Pages/Workers.

## Architecture / Approach

Baza (`projects`, `user_settings` z RLS) → typowany klient → jedna usługa `src/lib/services/projects.ts` → cztery trasy `POST` z przekierowaniem → strony Astro z jednym formularzem React → smoke z dwoma sesjami. Autoryzację robią reguły w bazie; cudzy projekt wygląda jak nieistniejący (404).

## Phases at a Glance

| Phase                          | What it delivers                                   | Key risk                                             |
| ------------------------------ | -------------------------------------------------- | ---------------------------------------------------- |
| 1. Baza danych i typy          | Migracja z RLS, typy, zod                          | Błędna reguła dostępu ujawni cudze dane              |
| 2. Warstwa serwera             | Usługa, walidacja, trasy, ochrona tras             | Rozjazd typów ręcznych z rzeczywistym schematem      |
| 3. Ekrany projektów po polsku  | Lista, dodanie, edycja, potwierdzenie, dashboard   | Zapomniana obsługa 404 dla cudzego projektu          |
| 4. Polskie ekrany logowania    | Przetłumaczone logowanie i rejestracja             | Błędna odmiana liczebnika, niespójne teksty          |
| 5. Test smoke i weryfikacja    | Przepływ dwóch użytkowników w CI                   | Kruche wyciąganie identyfikatora z HTML              |

**Prerequisites:** Docker do lokalnego Supabase (`npx supabase start`); dostęp do produkcyjnego projektu Supabase do `db push`.
**Estimated effort:** ok. 5 faz, około 5–6 sesji pracy; mieści się w oknie jednego wycinka z pięciotygodniowego szacunku MVP.

## Open Risks & Assumptions

- Założenie: po dodaniu pierwszego projektu staje się on wybrany automatycznie (nie było w wymaganiach).
- Migrację trzeba zastosować w produkcyjnej bazie przed wdrożeniem kodu; job `deploy` w CI tego nie robi.
- Typy bazy są pisane ręcznie i mogą się rozjechać ze schematem; generowanie wymaga Dockera.
- Komunikaty błędów z Supabase i strona główna zostają po angielsku, więc interfejs bywa mieszany.
- Rozjazd `cloudflare-pages` (tech-stack.md) i Workers (repozytorium) pozostaje nierozstrzygnięty.

## Success Criteria (Summary)

- Kierownik loguje się, prowadzi projekty i wybiera bieżący, a usunięcie wymaga potwierdzenia.
- Drugi użytkownik nie widzi ani nie otworzy cudzego projektu.
- `npm run lint`, `npx astro check`, `npm run build` i `npm run smoke` przechodzą, a CI jest zielone.
