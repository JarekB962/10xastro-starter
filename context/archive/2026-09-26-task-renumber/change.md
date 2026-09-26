---
change_id: task-renumber
title: Zmiana numeru zadania
status: archived
created: 2026-09-26
updated: 2026-09-26
archived_at: 2026-09-26T17:31:35Z
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->
Wycinek S-08 z `context/foundation/roadmap.md` (kamień milowy M-2). Zakres: FR-007 (część „zmiana numeru zadania automatycznie aktualizuje numer u zadań, dla których jest ono poprzednikiem”), US-01. Decyzje użytkownika: numer zmienia się w formularzu edycji zadania (pole staje się edytowalne, zapis razem z resztą pól w jednej transakcji); zmiana numeru na numer, który inne zadania już wpisały jako poprzednika (wiszące odwołanie), jest odrzucana z listą tych zadań. Przepisywanie poprzedników robi wyzwalacz w bazie (zastępuje wyzwalacz niezmienności numeru z S-03), więc działa dla każdej ścieżki zapisu. Plan należy wdrożyć po `specialty-delete` (S-09): oba dotykają `scripts/smoke.mjs`.
