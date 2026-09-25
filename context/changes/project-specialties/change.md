---
change_id: project-specialties
title: Specjalności wykonawców w projekcie
status: implemented
created: 2026-09-25
updated: 2026-09-25
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->
Wycinek S-01 z `context/foundation/roadmap.md` (kamień milowy M-1). Zakres: FR-004.

**Zmiany po planie (Faza 3, na prośbę użytkownika):** link „Specjalności" jest przy każdym projekcie na liście projektów (obok „Edytuj" i „Usuń"), a nie w pasku u góry. Wybiera projekt i otwiera `/specialties` (trasa `POST /api/projects/[id]/select` przyjmuje pole `after_select=specialties`, każda inna wartość ignorowana). Link „Specjalności projektu" na dashboardzie zostaje.
