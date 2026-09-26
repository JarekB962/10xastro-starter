---
change_id: task-delete
title: Usunięcie zadania
status: impl_reviewed
created: 2026-09-26
updated: 2026-09-26
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->
Wycinek S-07 z `context/foundation/roadmap.md` (kamień milowy M-2). Zakres: FR-007 (część „usuń zadanie, jeśli nie jest poprzednikiem innego”), US-01. Decyzje użytkownika: osobna strona potwierdzenia `/tasks/[id]/delete` (z listą zadań blokujących), link „Usuń” na liście zadań i na stronie edycji zadania. Blokadę pilnuje wyzwalacz w bazie (przy kaskadzie z usuwanego projektu nie blokuje). Stan projektu (S-06) cofa się sam dzięki istniejącemu wyzwalaczowi licznika.
