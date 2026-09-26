# Usunięcie specjalności — Implementation Plan

## Overview

Wycinek S-09 z mapy drogowej (kamień milowy M-2), wymaganie FR-005 i US-01 z `context/foundation/prd.md`: kierownik usuwa specjalność, jeśli nie występuje w zadaniach tego projektu; użyta specjalność zostaje w projekcie z czytelnym komunikatem, które zadania jej używają. Usuwanie przechodzi przez stronę potwierdzenia `/specialties/[id]/delete` (spójnie z usuwaniem zadania z S-07), a link „Usuń” jest na liście specjalności i na stronie edycji. Blokadę pilnuje baza (istniejący klucz obcy `on delete restrict`), więc obejmuje każdą ścieżkę zapisu; usunięcie cofa stan projektu do „niezweryfikowany” dzięki wyzwalaczowi z S-06. Zmiana numeru zadania (S-08) jest poza wycinkiem.

## Current State Analysis

- **Brak usuwania specjalności:** tabela `specialties` nie ma polityki `delete` (`supabase/migrations/20260925120000_create_specialties.sql`: „Brak polityki delete: wiersz znika kaskadowo razem z projektem”), a aplikacja nie ma trasy ani strony usuwania specjalności.
- **Blokada użytej specjalności już jest w bazie:** `tasks_specialty_project_fkey (specialty_id, project_id) … on delete restrict` (`20260926120000_create_tasks.sql`) odrzuca usunięcie specjalności używanej przez zadanie kodem `23503`, bezwarunkowo (także przy wyścigach, inaczej niż numery poprzedników w S-07). Kaskada z usuwanego projektu działa dziś mimo `restrict` i nie zmienia się.
- **Stan projektu (S-06):** wyzwalacz `specialties_bump_revision` (`20260929120000_project_states.sql`) obsługuje `insert or update or delete`, więc usunięcie specjalności podnosi licznik zmian i cofa stan bez zmian w aplikacji.
- **Wzorzec usuwania:** `src/pages/tasks/[id]/delete.astro`, `src/pages/api/tasks/[id]/delete.ts`, `deleteTask` i `findDependents` z S-07 (`src/lib/services/tasks.ts`, `src/lib/task-dependents.ts`), wzorzec specjalności: `src/lib/services/specialties.ts`, `specialty-routes.ts`, `src/pages/specialties/index.astro`, `src/pages/specialties/[id]/edit.astro`, `src/pages/api/specialties/[id]/index.ts`. Usługi zwracają wyniki z kodami błędów w `src/types.ts`; komunikaty błędów idą przez `?error=`.
- **Middleware:** `PROTECTED_ROUTES` dopasowuje po prefiksie, więc `/specialties/[id]/delete` i `/api/specialties/[id]/delete` są chronione bez zmian.
- **Testy:** smoke (`scripts/smoke.mjs`) na prawdziwym Supabase z sesjami A i B; testy jednostkowe `node:test` (`npm run test:unit`) dla czystej logiki (`tests/`).

## Desired End State

Kierownik klika „Usuń” obok specjalności na liście albo na stronie edycji i trafia na stronę potwierdzenia z pytaniem „Usunąć specjalność?”. Jeśli żadne zadanie projektu jej nie używa, strona ma przycisk „Usuń specjalność”, a po kliknięciu specjalność znika i użytkownik wraca na listę specjalności. Jeśli używają jej zadania, strona zamiast przycisku pokazuje komunikat „Specjalność jest używana w zadaniach i nie można jej usunąć” oraz listę tych zadań (numer, nazwa, link „Edytuj”). Bezpośredni `POST` usuwający używaną specjalność kończy się tym samym komunikatem, a specjalność zostaje. Usunięcie cofa stan projektu do „niezweryfikowany”. Usunięcie całego projektu ze specjalnościami używanymi przez zadania działa jak dotąd. `npm run test:unit`, `astro check`, lint, build i smoke przechodzą, a migracja jest zastosowana na produkcji przed wdrożeniem kodu.

### Key Discoveries:

- **Blokada w bazie już istnieje:** klucz obcy `restrict` daje `23503` przy próbie usunięcia używanej specjalności, więc nie potrzeba własnego wyzwalacza; migracja dodaje tylko politykę `delete` dla właściciela.
- **Lista zadań używających specjalności liczona w aplikacji** z listy zadań projektu (`specialty_id` każdego zadania jest w `Task`), analogicznie do `findDependents`; klucz obcy jest zabezpieczeniem, a przy błędzie `23503` lista jest liczona ponownie.
- **Stan projektu cofa się sam:** wyzwalacz na `specialties` obsługuje `DELETE`; dodajemy tylko krok smoke.
- **Kaskada z projektu nie jest naruszona:** polityka `delete` nie zmienia zachowania `on delete cascade` z `projects`.

## What We're NOT Doing

- Zmiana numeru zadania i przepisywanie poprzedników (S-08).
- Przenoszenie zadań na inną specjalność jednym kliknięciem ani „wymuszone” usunięcie z odpięciem zadań (blokujemy, nie kaskadujemy).
- Usuwanie wielu specjalności naraz, kosz i przywracanie.
- Link „Usuń” na stronie sprawdzenia i na liście zadań.
- Zmiany w stanie projektu, w algorytmie sprawdzenia i w polityce usuwania projektu.

## Implementation Approach

Jedna faza od bazy do interfejsu. Migracja dodaje politykę `delete`; czysta funkcja `findTasksWithSpecialty` wskazuje zadania używające specjalności (z testami jednostkowymi `node:test`); usługa `deleteSpecialty` łączy ją z usunięciem i mapuje błąd `23503`; strona potwierdzenia i trasa `POST` wzorowane na usuwaniu zadania; dwa linki „Usuń”; kroki smoke sprawdzają usunięcie, blokadę, cofnięcie stanu, izolację użytkowników i kaskadę przy usuwaniu projektu.

## Phase 1: Usuwanie specjalności: baza, usługa, strony i smoke

### Overview

Dodaje możliwość usunięcia specjalności niewystępującej w zadaniach projektu, z blokadą w bazie, stroną potwierdzenia i komunikatem o zadaniach ją używających. Po tej fazie kierownik usuwa zbędne specjalności, a stan projektu cofa się po każdym usunięciu.

### Changes Required:

#### 1. Migracja: polityka usuwania

**File**: `supabase/migrations/20261002120000_specialty_delete.sql` (nowy)

**Intent**: Pozwolić właścicielowi usuwać specjalności swoich projektów, zostawiając blokadę użytej specjalności istniejącemu kluczowi obcemu.

**Contract**: Polityka `specialties_delete_own` dla `delete to authenticated` z tym samym warunkiem własności co pozostałe polityki `specialties` (`exists` po `projects.owner_id = (select auth.uid())`). Bez nowych wyzwalaczy i funkcji. Komentarze po polsku, jak w pozostałych migracjach (komentarz w `20260925120000_create_specialties.sql` o braku polityki delete zostaje bez zmian, migracja już zastosowana).

#### 2. Wyszukiwanie zadań używających specjalności

**File**: `src/lib/task-dependents.ts`, `tests/task-dependents.test.mjs`

**Intent**: Jedna czysta funkcja wskazująca zadania blokujące usunięcie specjalności, używana przez usługę i stronę potwierdzenia, z testami jednostkowymi.

**Contract**: `findTasksWithSpecialty(tasks: Task[], specialtyId: string): Task[]` zwraca zadania listy, których `specialty_id` równa się `specialtyId`, rosnąco po numerze. Moduł nadal importuje tylko typy (`import type` z `@/types`). Testy (`node:test`, `node:assert/strict`, w istniejącym pliku obok testów `findDependents`): brak zadań ze specjalnością, jedno, kilka posortowanych, zadania bez specjalności (`null`) pominięte, zadania innej specjalności pominięte, pusta lista.

#### 3. Typy i usługa

**File**: `src/types.ts`, `src/lib/services/specialties.ts`

**Intent**: Usunąć specjalność z uwzględnieniem blokady i zwrócić listę zadań ją używających, z tym samym wzorcem wyniku co `deleteTask`.

**Contract**: Typ `DeleteSpecialtyResult`: `{ ok: true; data: null }`, `{ ok: false; error: "not_found" | "unexpected" }` albo `{ ok: false; error: "in_use"; tasks: Task[] }`. `deleteSpecialty(db, id)`: `getSpecialty` (brak = `not_found`), `listTasks` projektu specjalności (potrzebny `project_id`: `getSpecialty`/kolumny specjalności rozszerzone o `project_id` albo osobny odczyt; wybór należy do implementującego, bez zmiany typu `Specialty` widocznego w interfejsie ponad konieczność) i `findTasksWithSpecialty`; przy niepustej liście zwraca `in_use` bez próby usunięcia; inaczej `db.from("specialties").delete().eq("id", id).select("id")`, pusty wynik = `not_found`, błąd `23503` (wyścig: zadanie dostało specjalność w międzyczasie) mapuje na `in_use` z listą ponownie wyliczoną z aktualnych zadań (przy pustej liście `unexpected`), pozostałe błędy przez `fail`. Stała komunikatu `SPECIALTY_IN_USE_MESSAGE` („Specjalność jest używana w zadaniach i nie można jej usunąć.”) dopisana obok `SPECIALTY_ERROR_MESSAGES`.

#### 4. Trasa POST usuwania

**File**: `src/pages/api/specialties/[id]/delete.ts` (nowy)

**Intent**: Wykonać usunięcie po potwierdzeniu i odesłać użytkownika z jednoznacznym wynikiem.

**Contract**: `POST` z `export const prerender = false`, strażnikami `requireSupabase(context, "/specialties")` i `requireSpecialtyId`. Sukces: przekierowanie na `/specialties`. `not_found`: `/specialties?error=` z `SPECIALTY_ERROR_MESSAGES.not_found`. `in_use`: `/specialties/{id}/delete?error=` z `SPECIALTY_IN_USE_MESSAGE`. `unexpected`: `/specialties/{id}/delete?error=` z ogólnym komunikatem z `SPECIALTY_ERROR_MESSAGES`.

#### 5. Strona potwierdzenia

**File**: `src/pages/specialties/[id]/delete.astro` (nowy)

**Intent**: Pokazać pytanie o potwierdzenie albo powód, dla którego usunięcie jest niemożliwe, wzorem strony usuwania zadania.

**Contract**: Odczyt specjalności przez `getSpecialty` (nieistniejąca i cudza: 404, brak Supabase: 503, błąd bazy: 500, jak w `specialties/[id]/edit.astro`); lista zadań projektu (`listTasks`) i `findTasksWithSpecialty`. Bez zadań używających: nagłówek „Usunąć specjalność?”, nazwa specjalności, informacja, że zostanie usunięta na stałe i operacji nie można cofnąć, formularz `POST` do `/api/specialties/{id}/delete` z przyciskiem „Usuń specjalność” (styl czerwony jak przy zadaniu) i linkiem „Anuluj” do `/specialties`. Z zadaniami używającymi: nagłówek „Nie można usunąć specjalności”, zdanie „Aby było to możliwe, zmień specjalność poniższych zadań:” i lista tych zadań (numer, nazwa, link „Edytuj” do `/tasks/{id}/edit`), bez przycisku usunięcia, z linkiem powrotu do listy specjalności. Parametr `?error=` (przekierowanie z trasy) pokazany nad treścią. Stan „nie znaleziono” z linkiem do listy specjalności.

#### 6. Linki „Usuń”

**File**: `src/pages/specialties/index.astro`, `src/pages/specialties/[id]/edit.astro`

**Intent**: Dodać wejście do usuwania tam, gdzie kierownik pracuje ze specjalnością.

**Contract**: Na liście specjalności link „Usuń” obok „Edytuj” (`/specialties/{id}/delete`, akcent ostrzegawczy jak przy zadaniach, bez zmiany układu karty); na stronie edycji specjalności link „Usuń specjalność” pod formularzem, obok „Wróć do listy specjalności”. Pozostałe strony bez zmian.

#### 7. Kroki smoke

**File**: `scripts/smoke.mjs`

**Intent**: Pokryć usunięcie, blokadę, cofnięcie stanu projektu, izolację użytkowników i kaskadę na prawdziwej bazie.

**Contract**: Asercje na fragmentach bez polskich znaków, jak w istniejących krokach; dokładne fragmenty ustal na faktycznym HTML (np. obecność lub brak adresu `/api/specialties/{id}/delete` w formularzu, fragment „je z poprzednik” nie dotyczy tej strony, użyj fragmentów z nowego tekstu). Oczekiwania z identyfikatorami znalezionymi w trakcie scenariusza podawaj jako funkcje (runner smoke już je obsługuje). Sesja A (specjalność użyta przez zadania): strona potwierdzenia specjalności używanej przez zadania wymienia je i nie ma przycisku usunięcia; `POST` usunięcia takiej specjalności przekierowuje na stronę potwierdzenia z komunikatem, a specjalność zostaje na liście; dodanie nowej, nieużywanej specjalności i jej usunięcie przekierowuje na `/specialties`, lista nie zawiera już jej nazwy, a strona potwierdzenia usuniętej specjalności to 404. Sesja B: stan „zweryfikowany” cofa się do „niezweryfikowany” po usunięciu nieużywanej specjalności (pulpit i lista zadań), a kolejne sprawdzenie przywraca „zweryfikowany”; B nie widzi strony potwierdzenia specjalności A (404), a `POST` usunięcia specjalności A przekierowuje z komunikatem „nie znaleziono”, a specjalność A zostaje. Istniejący krok usunięcia projektu z zadaniami i specjalnościami pozostaje i testuje kaskadę; nowe kroki wstaw przed usunięciem projektów, w kolejności zależnej od danych w scenariuszu; istniejących asercji nie zmieniaj.

### Success Criteria:

#### Automated Verification:

- Migracja stosuje się na czystej lokalnej bazie: `npx supabase db reset`
- Testy jednostkowe (w tym `findTasksWithSpecialty`) przechodzą: `npm run test:unit`
- Sprawdzenie typów przechodzi: `npx astro check`
- Lint przechodzi: `npm run lint`
- Build przechodzi: `npm run build`
- Smoke przechodzi na lokalnym Supabase i serwerze podglądu: `npm run smoke`
- CI (`ci` i `smoke`) zielone na gałęzi z tą zmianą

#### Manual Verification:

- Migracja zastosowana na produkcji przed wdrożeniem kodu: `npx supabase db push`
- Usunięcie specjalności, której nie używa żadne zadanie, działa (link „Usuń” na liście i na edycji, strona potwierdzenia, powrót na listę) i cofa stan projektu do „niezweryfikowany”
- Próba usunięcia specjalności używanej w zadaniach pokazuje komunikat z listą tych zadań i linkami „Edytuj”, bez przycisku usunięcia
- Po zmianie specjalności tych zadań (przez „Edytuj”) ta sama specjalność da się usunąć
- Bezpośredni `POST` usunięcia używanej specjalności nie usuwa jej (specjalność zostaje na liście)
- Zalogowany użytkownik nie usunie cudzej specjalności (404 na stronie, „nie znaleziono” przy POST)
- Usunięcie projektu z zadaniami i specjalnościami działa jak dotąd
- Po wdrożeniu na produkcji ten sam cykl działa na prawdziwych danych

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- `tests/task-dependents.test.mjs` (`node:test`, bez zależności): `findTasksWithSpecialty` dla braku zadań ze specjalnością, jednego i kilku (posortowane), zadań bez specjalności, zadań innej specjalności i pustej listy.

### Integration Tests:

- `npm run smoke` na lokalnym Supabase: blokada usunięcia używanej specjalności (strona i POST), usunięcie nieużywanej, cofnięcie stanu projektu po usunięciu i przywrócenie po sprawdzeniu, izolacja użytkowników A i B, kaskada przy usuwaniu projektu.
- **Celowy test zepsucia (wykonuje implementujący):** zepsuć `findTasksWithSpecialty` (zawsze pusta lista) i sprawdzić, że testy jednostkowe i kroki smoke o blokadzie czerwienią się (klucz obcy w bazie nadal blokuje, więc czerwienią się asercje treści i przycisku); potem przywrócić.

### Manual Testing Steps:

1. Dodaj specjalność „A” i „B”; przypisz „A” do zadania; na liście specjalności kliknij „Usuń” przy „B”: potwierdź usunięcie, „B” znika, stan projektu wraca do „niezweryfikowany”.
2. Kliknij „Usuń” przy „A”: strona pokazuje zadanie ją używające i nie ma przycisku usunięcia.
3. Przez „Edytuj” zadania zmień jego specjalność na „Bez specjalności” i spróbuj ponownie usunąć „A”: teraz się udaje.
4. Usuń projekt ze specjalnościami użytymi w zadaniach: usunięcie działa.
5. W konsoli bazy (rola `authenticated`) spróbuj usunąć używaną specjalność oraz cudzą: odmowa.

## Performance Considerations

Usunięcie to jedno zapytanie o zadania projektu (kilkadziesiąt wierszy), jedno usunięcie i sprawdzenie klucza obcego; koszt pomijalny. Wymaganie „zwykłe akcje poniżej 1 sekundy” pozostaje spełnione.

## Migration Notes

- Migracja jest addytywna (polityka); istniejące dane nie są zmieniane.
- **Kolejność wdrożenia:** najpierw `npx supabase db push` (ręcznie, po potwierdzeniu użytkownika), potem wdrożenie kodu przez merge. Stary kod na nowej bazie działa (nie usuwa specjalności); nowy kod na starej bazie pokazywałby błąd przy próbie usunięcia (brak polityki `delete`).
- S-08 (zmiana numeru) jest niezależne; oba wycinki dotykają `scripts/smoke.mjs`, więc implementujemy je po kolei.

## References

- Roadmap: `context/foundation/roadmap.md` (S-09, `specialty-delete`)
- PRD: `context/foundation/prd.md` (FR-005, US-01)
- Poprzedni wycinek (wzorzec): `context/archive/2026-09-26-task-delete/plan.md`
- Wzorce: `src/pages/tasks/[id]/delete.astro`, `src/pages/api/tasks/[id]/delete.ts`, `src/lib/services/tasks.ts` (`deleteTask`), `src/lib/task-dependents.ts`, `src/lib/services/specialties.ts`, `src/lib/services/specialty-routes.ts`
- Migracje: `supabase/migrations/20260925120000_create_specialties.sql`, `20260926120000_create_tasks.sql`, `20260929120000_project_states.sql`
- Testy: `tests/task-dependents.test.mjs`, `scripts/smoke.mjs`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Usuwanie specjalności: baza, usługa, strony i smoke

#### Automated

- [x] 1.1 Migracja stosuje się na czystej lokalnej bazie: `npx supabase db reset`
- [x] 1.2 Testy jednostkowe (w tym `findTasksWithSpecialty`) przechodzą: `npm run test:unit`
- [x] 1.3 Sprawdzenie typów przechodzi: `npx astro check`
- [x] 1.4 Lint przechodzi: `npm run lint`
- [x] 1.5 Build przechodzi: `npm run build`
- [x] 1.6 Smoke przechodzi na lokalnym Supabase i serwerze podglądu: `npm run smoke`
- [ ] 1.7 CI (`ci` i `smoke`) zielone na gałęzi z tą zmianą

#### Manual

- [x] 1.8 Migracja zastosowana na produkcji przed wdrożeniem kodu: `npx supabase db push`
- [x] 1.9 Usunięcie specjalności, której nie używa żadne zadanie, działa (link „Usuń” na liście i na edycji, strona potwierdzenia, powrót na listę) i cofa stan projektu do „niezweryfikowany”
- [x] 1.10 Próba usunięcia specjalności używanej w zadaniach pokazuje komunikat z listą tych zadań i linkami „Edytuj”, bez przycisku usunięcia
- [x] 1.11 Po zmianie specjalności tych zadań (przez „Edytuj”) ta sama specjalność da się usunąć
- [x] 1.12 Bezpośredni `POST` usunięcia używanej specjalności nie usuwa jej (specjalność zostaje na liście)
- [x] 1.13 Zalogowany użytkownik nie usunie cudzej specjalności (404 na stronie, „nie znaleziono” przy POST)
- [x] 1.14 Usunięcie projektu z zadaniami i specjalnościami działa jak dotąd
- [ ] 1.15 Po wdrożeniu na produkcji ten sam cykl działa na prawdziwych danych
