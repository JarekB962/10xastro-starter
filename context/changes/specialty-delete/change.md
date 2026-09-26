---
change_id: specialty-delete
title: Usunięcie specjalności
status: implemented
created: 2026-09-26
updated: 2026-09-26
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->
Wycinek S-09 z `context/foundation/roadmap.md` (kamień milowy M-2). Zakres: FR-005, US-01. Wzorzec z S-07 (`task-delete`): strona potwierdzenia `/specialties/[id]/delete` z listą zadań używających specjalności (przy specjalności w użyciu bez przycisku usunięcia), link „Usuń” na liście specjalności i na stronie edycji. Blokadę używanej specjalności pilnuje istniejący klucz obcy (`on delete restrict`); brakuje tylko polityki `delete`. Stan projektu (S-06) cofa się sam dzięki wyzwalaczowi licznika na `specialties`.
