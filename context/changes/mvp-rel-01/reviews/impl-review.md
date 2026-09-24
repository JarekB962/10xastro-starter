<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Pierwsza wersja MVP: logowanie, projekty i wybór projektu

- **Plan**: context/changes/mvp-rel-01/plan.md
- **Scope**: Phases 1–3 of 5
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-09-24
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Success Criteria: `npx astro check` (0 errors), `npm run lint` and `npm run build` pass; RLS enabled on both tables with 4 + 3 policies confirmed in the local DB. `npx supabase db reset` (1.1) was not re-run (would wipe local accounts); it passed at phase 1 (e144395).

Dismissed after verification: a reviewer claim that encoded paths (`/%70rojects`) bypass the middleware prefix check. Tested on the production build: `/%70rojects`, `/%64ashboard`, `/api/%70rojects`, `/projects/` all redirect to `/auth/signin`; `/Projects` is 404.

## Findings

### F1 — Osobne klienty Supabase w middleware i w trasach/stronach

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/middleware.ts:6-12, src/lib/supabase.ts, wszystkie trasy `api/projects/*` i strony `projects/*`
- **Detail**: Middleware i każda trasa/strona tworzą własnego klienta z tego samego nagłówka `Cookie`. Przy wygasłym tokenie dostępu `getUser()` w middleware odświeża sesję i rotuje refresh token, a klient w trasie widzi jeszcze stare ciasteczka. Może wtedy zapytać jako sesja wygasła/anonimowa, RLS zwróci puste wyniki lub 42501, a `toError()` zamieni to na „Nie znaleziono projektu” zamiast odesłać do logowania. Wzorzec istniał przed zmianą (dashboard), ale nowe trasy go wzmacniają. Nie zweryfikowane na żywo (wymaga wygasłego tokenu).
- **Fix**: Tworzyć klienta raz w middleware, zapisać w `context.locals.supabase` i używać go w trasach i stronach.
  - Strength: Jedna sesja na żądanie, odświeżone ciasteczka widoczne dla całego żądania.
  - Tradeoff: Zmiana sygnatur w ~9 plikach i typu `App.Locals`.
  - Confidence: MED — standardowy wzorzec `@supabase/ssr`, ale objaw nie został odtworzony.
  - Blind spot: Nie sprawdzono, jak Supabase JS 2.x zachowuje się w oknie ponownego użycia tokenu.
- **Decision**: FIXED — klient tworzony raz w middleware (`context.locals.supabase`), użyty w 4 trasach i 4 stronach

### F2 — Wpisane wartości formularza w adresie przekierowania bez limitu długości

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/projects.ts:26-31 (formValues), src/pages/api/projects/index.ts, src/pages/api/projects/[id]/index.ts
- **Detail**: Po błędzie serwera `formValues` wkłada surową nazwę i opis do `Location`. Bezpośredni POST z opisem o dziesiątkach KB daje zbyt długi nagłówek i błąd 4xx/5xx zamiast formularza (przeglądarka blokuje to tylko po stronie klienta).
- **Fix**: Obciąć wartości w `formValues` (np. nazwa do 200, opis do 1100 znaków).
- **Decision**: FIXED — `formValues` obcina nazwę do 200 i opis do 1100 znaków; 60 000 znaków daje Location ok. 1,2 KB

### F3 — Strona edycji nadpisuje zapisane dane wartościami z adresu

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/pages/projects/[id]/edit.astro:22-25
- **Detail**: `?name=` i `?description=` mają pierwszeństwo przed danymi projektu przy każdym żądaniu, nie tylko po błędzie serwera. Nieszkodliwe (React escapuje), ale odbiega od „edycja pokazuje zapisane dane, chyba że serwer zwrócił błąd”.
- **Fix**: Używać wartości z adresu tylko gdy jest `?error=`.
- **Decision**: FIXED — dane z adresu używane tylko przy `?error=`

### F4 — Z dashboardu zniknął przycisk wylogowania

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/pages/dashboard.astro
- **Detail**: Plan (faza 3, pkt 4) mówił „przycisk wylogowania zostaje”. Wylogowanie jest dostępne w pasku (Topbar: „Wyloguj”), więc funkcja jest zachowana, ale sam przycisk na stronie zniknął.
- **Fix**: Zostawić (Topbar pokrywa funkcję) i odnotować w planie, albo przywrócić przycisk.
- **Decision**: FIXED — przycisk „Wyloguj” przywrócony na dashboardzie

### F5 — Strony rzucają wyjątek przy braku konfiguracji Supabase

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/pages/projects/index.astro:9, src/pages/projects/[id]/edit.astro:11, src/pages/projects/[id]/delete.astro:11
- **Detail**: Plan wymaga obsługi `null` klienta „jak signin.ts”. Trasy API to robią (przekierowanie z komunikatem). Strony rzucają `Error` (500); `dashboard.astro` po cichu pokazuje stan pusty. Rzut wynika z tego, że top-level `return` w `.astro` wywala regułę ESLint `no-misused-promises`. Ścieżka praktycznie nieosiągalna (bez klienta nie ma zalogowanego użytkownika, middleware przekierowuje).
- **Fix**: Zostawić i odnotować w planie jako świadome odstępstwo.
- **Decision**: FIXED — strony bez klienta Supabase pokazują komunikat o konfiguracji (503) zamiast wyjątku

### F6 — Błędy 23503/42501 przy dodawaniu pokazują „Nie znaleziono projektu”

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/projects.ts:36-47
- **Detail**: Mapowanie kodów na `not_found` jest wspólne dla wszystkich operacji. Przy `createProject` naruszenie klucza obcego lub RLS (np. usunięty użytkownik z ważnym JWT) pokaże w formularzu „Nowy projekt” mylący komunikat. Surowy błąd nie jest nigdzie logowany.
- **Fix**: W `createProject` mapować 23503/42501 na `unexpected` i zalogować surowy błąd po stronie serwera.
- **Decision**: FIXED — przy dodawaniu 23503/42501 to błąd niespodziewany; surowy błąd logowany po stronie serwera

### F7 — `formData()` w trasach może rzucić 500 dla nieformularzowego POST

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/projects/index.ts, src/pages/api/projects/[id]/index.ts
- **Detail**: POST z innym typem treści lub uszkodzonym ciałem rzuca `TypeError` i daje 500. Tak samo zachowuje się istniejący `signin.ts`; brak wycieku danych.
- **Fix**: Owinąć w try/catch i przekierować z komunikatem błędu.
- **Decision**: FIXED — `readForm` zwraca null zamiast wyjątku, trasy przekierowują z komunikatem „Niepoprawne dane formularza.”

### F8 — Automatyczny wybór pierwszego projektu nie jest atomowy

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/projects.ts:94-98
- **Detail**: Odczyt wyboru, potem `upsert`. Dwa równoległe pierwsze dodania: wygrywa ostatni; skutek nieszkodliwy, niepowodzenie celowo ignorowane.
- **Fix**: Zostawić (świadomy kompromis z planu).
- **Decision**: FIXED — dwa atomowe kroki: wstaw wiersz ustawień (ignoreDuplicates) i ustaw wybór tam, gdzie pusty
