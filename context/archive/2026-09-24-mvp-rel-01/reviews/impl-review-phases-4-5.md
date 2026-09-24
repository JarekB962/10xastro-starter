<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Pierwsza wersja MVP: logowanie, projekty i wybór projektu (fazy 4–5)

- **Plan**: context/changes/mvp-rel-01/plan.md
- **Scope**: Phases 4–5 of 5 (uzupełnia `impl-review.md`, które obejmuje fazy 1–3; zmiany po planie z PR #4 i #5 uwzględnione w zakresie)
- **Reviewed phases**: 4, 5
- **Date**: 2026-09-24
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 2 observations

Review wykonany bez subagentów (diff 30 plików w `src/` i `scripts/`, przeczytany bezpośrednio).

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Success criteria (uruchomione na `master` 8dadb56)

- 4.1 / 5.1 `npm run lint` — PASS
- 4.2 `npx astro check` — PASS (0 errors, 0 warnings, 0 hints)
- 4.3 / 5.2 `npm run build` — PASS
- 5.3 `npm run smoke` na lokalnym Supabase i serwerze podglądu — PASS (wszystkie kroki)
- 5.4 CI (`ci`, `smoke`) — PASS na PR #4 (`053f7a4`) i PR #5; `deploy` zielony na `master`
- 4.4, 4.5, 5.5 (ręczne) — potwierdzone przez użytkownika; 5.6 — `npx supabase migration list` pokazuje migrację `20260924120000` lokalnie i zdalnie

## Findings

### F1 — Zmiany po planie nie są opisane w planie

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: context/changes/mvp-rel-01/plan.md (sekcje „What We're NOT Doing", Faza 3 pkt 4, Faza 2 pkt 3)
- **Detail**: Kilka zmian świadomie odbiega od tekstu planu (na prośbę użytkownika lub po `/code-review`), ale plan tego nie zapisuje, więc następny przegląd lub czytelnik odczyta go jako niezgodność: (a) przetłumaczono `Welcome.astro` i komunikaty błędów Supabase (`auth-errors.ts`), choć plan wykluczał oba; (b) z `dashboard.astro` usunięto przycisk „Wyloguj", choć Faza 3 pkt 4 mówi „przycisk wylogowania zostaje" (jest w Topbarze); (c) pola formularza projektu nazywają się `project_name` / `project_description`; (d) nowe moduły `lib/forms.ts`, `lib/services/project-routes.ts`, `lib/validation/auth.ts`, `getSelectedProjectId`, `autoFocus` i `autoComplete="off"` na formularzu projektu.
- **Fix**: Dopisać w `plan.md` krótką sekcję „Post-plan changes" (jedna lista, bez zmiany faz i Progress) z powyższymi punktami i powodem każdego.
- **Decision**: FIXED — sekcja "Post-plan changes" dopisana w plan.md

### F2 — CI nie sprawdza produkcji po wdrożeniu

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: .github/workflows/ci.yml (job `deploy`)
- **Detail**: Po pierwszym wdrożeniu rejestracja na produkcji nie działała z powodu błędnych sekretów `SUPABASE_URL` / `SUPABASE_KEY` w GitHubie. Job `smoke` testuje lokalny Supabase, a `deploy` kończył się sukcesem, więc awarię wykryło dopiero ręczne klikanie. Naprawiono sekrety i dodano logowanie nieznanych błędów, ale ta klasa usterek nadal przechodzi przez CI niezauważona.
- **Fix**: Dodać do jobu `deploy` krok po wdrożeniu: `POST /api/auth/signin` z nieistniejącymi danymi na adres produkcji, oczekiwane przekierowanie zawierające „Nieprawidłowy email lub hasło"; inny wynik oznacza zły kontakt z Supabase i czerwony job.
  - Strength: Wykrywa błędne sekrety i niedziałające połączenie z Supabase, czyli dokładnie dzisiejszą usterkę; nie tworzy kont ani danych.
  - Tradeoff: Wymaga znanego adresu produkcji w CI (zmienna repozytorium) i chwili na propagację wdrożenia.
  - Confidence: HIGH — to samo żądanie zadziałało jako diagnostyka ręcznie.
  - Blind spot: Nie wykrywa problemów z wysyłką maili ani limitami Auth.
- **Decision**: FIXED — krok "Verify production reaches Supabase" w jobie deploy (ci.yml); działa na obecnej produkcji, ale sam krok w CI jeszcze nie był uruchomiony

### F3 — Logowanie błędów Supabase może zawierać adres email

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/auth-errors.ts:22
- **Detail**: `console.error("auth: unmapped Supabase error", error.code, error.status, error.message)` zapisuje pełny komunikat, a niektóre komunikaty Supabase cytują adres email użytkownika (np. `Email address "…" is invalid`). Logi Cloudflare zawierałyby wtedy dane osobowe. Dziś dotyczy to tylko kodów spoza mapy.
- **Fix**: Logować `code` i `status`, a komunikat tylko po usunięciu adresów (np. zamiana wzorca email na `[email]`).
- **Decision**: FIXED — adresy email w logowanym komunikacie zamieniane na [email] (auth-errors.ts)

### F4 — Smoke nie pokrywa nowych ścieżek błędów

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: scripts/smoke.mjs
- **Detail**: Po poprawkach z przeglądu PR #4 działają ścieżki, których smoke nie sprawdza: ciało żądania niebędące formularzem na trasach logowania (przekierowanie z `Niepoprawne dane formularza.` zamiast 500) i niepoprawny uuid w adresie trasy projektu (przekierowanie „Nie znaleziono projektu"). Regres nie zostałby wykryty przez CI.
- **Fix**: Dodać dwa kroki do `smoke.mjs` (żądanie z `Content-Type: application/json` na `/api/auth/signin` oraz `POST /api/projects/nie-uuid/delete`).
- **Decision**: FIXED — dwa kroki dodane do smoke.mjs (ciało JSON na signin, niepoprawny uuid); smoke przechodzi
