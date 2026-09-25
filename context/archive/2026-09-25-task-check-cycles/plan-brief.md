# Sprawdzenie listy zadań: cykle zależności — Plan Brief

> Full plan: `context/changes/task-check-cycles/plan.md`

## What & Why

Sprawdzenie listy zadań ma wykrywać cykle zależności: zadania, które (bezpośrednio lub pośrednio) zależą od siebie nawzajem i przez to nie da się ich wykonać w żadnej kolejności (FR-008, FR-009). To czwarte i najtrudniejsze kryterium; od tego wycinka wynik bez problemów może uczciwie mówić „nie znaleziono problemów”, bo działają wszystkie cztery kryteria, a fałszywe „wszystko w porządku” przy niewykrytym cyklu jest dokładnie tym, przed czym PRD chroni.

## Starting Point

Po S-04 działa `/tasks/check` z trzema kryteriami (nieistniejący poprzednik, brak odpowiedzialności, duplikat) jako czysta funkcja `checkTasks`. Strona pokazuje neutralny komunikat i zdanie „Cykle zależności nie są jeszcze sprawdzane”, a smoke sprawdza jego obecność. Brak testów jednostkowych i skryptu testów w projekcie.

## Desired End State

Przy zadaniach leżących na cyklu strona pokazuje „Cykl zależności: zadania 3, 5, 7” (wszystkie zadania grupy, rosnąco). Zadanie tylko zależne od cyklu nie jest oznaczone, a cykle łączą się z innymi powodami na tym samym zadaniu. Bez problemów strona mówi „Nie znaleziono problemów w sprawdzanych kryteriach (…, cykl zależności).” i nie ma już zastrzeżenia o cyklach. Algorytm ma testy jednostkowe w CI.

## Key Decisions Made

| Decision                    | Choice                                                                    | Why (1 sentence)                                                                                          | Source  |
| --------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------- |
| Zadania „na cyklu”          | Zadania w silnie spójnych składowych o rozmiarze ≥ 2                      | Dokładnie definicja z PRD: w takiej składowej każde zadanie leży na cyklu, a zadanie tylko zależne od niej nie | PRD     |
| Prezentacja cyklu           | Lista wszystkich zadań grupy (nie jedna ścieżka)                          | Nie sugeruje „prawdziwej” ścieżki przy kilku cyklach i oznacza wszystkie zadania na cyklu                 | Plan    |
| Testy algorytmu             | `node:test` bez zależności, `npm run test:unit`, krok w jobie `ci`         | Szybkie testy brzegów bez nowej zależności; błąd algorytmu daje fałszywe „OK”, więc jest pokryty testami    | Plan    |
| Nieistniejący poprzednik    | Nie tworzy krawędzi grafu, zostaje osobnym powodem                        | Numer spoza projektu nie jest zadaniem, więc nie może zamykać cyklu                                       | PRD     |
| Komunikat bez problemów     | „Nie znaleziono problemów w sprawdzanych kryteriach (…, cykl zależności)” | Wszystkie cztery kryteria działają, więc zastrzeżenie z S-04 znika; treść dalej mówi o kryteriach, nie „wszystko OK” | Roadmap |
| Algorytm                    | Iteracyjne silnie spójne składowe, złożoność liniowa                      | Nie zależy od głębokości stosu i mieści się z zapasem w wymaganiu z PRD                                   | Plan    |
| Fazy                        | Jedna: algorytm, testy, strona i smoke                                    | Wycinek bez migracji; spójne z poprzednimi wycinkami M-2                                                  | Plan    |

## Scope

**In scope:** pole `cycleWith` w `TaskProblem`, algorytm cykli w `checkTasks`, testy jednostkowe (`tests/`, `npm run test:unit`, krok w CI), powód cyklu i nowy komunikat pustego wyniku na `/tasks/check`, odwrócone i nowe kroki smoke.

**Out of scope:** stan projektu (S-06), usuwanie i zmiana numeru (S-07–S-09), jedna konkretna ścieżka cyklu, Vitest, zmiany w bazie i migracje.

## Architecture / Approach

Algorytm silnie spójnych składowych dokłada czwarte kryterium do czystej funkcji `checkTasks` (bez bazy i Astro), strona składa powód z nowego pola, a wynik nadal jest liczony na żądanie. Testy jednostkowe uruchamia wbudowany runner Node z flagą typów, więc nie ma nowej zależności; smoke pokrywa przypadek od strony użytkownika.

## Phases at a Glance

| Phase                                     | What it delivers                                                          | Key risk                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1. Cykle: algorytm, testy, strona i smoke | `cycleWith`, algorytm, testy jednostkowe w CI, nowy komunikat, kroki smoke | Błąd algorytmu daje fałszywe „OK”; dlatego testy przypadków brzegowych    |

**Prerequisites:** S-04 wdrożone (`checkTasks` i `/tasks/check`), Docker do lokalnego Supabase, Node 22.
**Estimated effort:** ~1 sesja w 1 fazie.

## Open Risks & Assumptions

- Flaga `--experimental-strip-types` w Node 22 daje ostrzeżenie w logu (w 22.18+ jest niepotrzebna); jeśli CI kiedyś zmieni wersję Node, krok testów może wymagać dostosowania.
- Zakładamy, że własne wskazanie zadania jest już blokowane przy zapisie (S-02, S-03), więc graf nie ma pętli własnych; funkcja mimo to nie może się na nich zapętlić.
- S-06 użyje wyniku `checkTasks` jako źródła prawdy dla stanu „zweryfikowany”.

## Success Criteria (Summary)

- Zadania leżące na cyklu są oznaczone z listą całej grupy; zadanie tylko zależne od cyklu nie.
- „Nie znaleziono problemów” pojawia się wyłącznie wtedy, gdy żadne z czterech kryteriów nic nie znalazło.
- `npm run test:unit`, smoke, lint, `astro check` i build przechodzą, a wdrożenie nie wymaga migracji.
