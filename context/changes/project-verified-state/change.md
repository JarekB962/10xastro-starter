---
change_id: project-verified-state
title: Stan projektu (zweryfikowany / niezweryfikowany)
status: implemented
created: 2026-09-25
updated: 2026-09-25
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->
Wycinek S-06 z `context/foundation/roadmap.md` (kamień milowy M-2). Zakres: FR-011, US-01 (Business Logic: stan projektu). Decyzje użytkownika: każda zmiana specjalności (dodanie, zmiana nazwy, usunięcie, zmiana w zadaniu) cofa stan; stan widoczny na pulpicie, liście zadań i stronie sprawdzenia; stan zapisuje wejście na `/tasks/check` (bez zmiany interfejsu). Stan pilnują wyzwalacze w bazie, więc S-07, S-08 i S-09 cofają go bez dodatkowej pracy.
