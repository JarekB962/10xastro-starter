---
starter_id: 10x-astro-starter
package_manager: npm
project_name: plan-projektu-wbs
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---

## Why this stack

Jedna osoba buduje w około pięć tygodni pracy po godzinach aplikację webową dla kierownika projektu: logowanie, projekty, specjalności, zadania oraz sprawdzanie spójności zależności między zadaniami. Potrzebuje więc sprawdzonego, przyjaznego agentom startera, który ma logowanie, bazę danych i wdrożenie od ręki. Astro z Supabase i Cloudflare jest rekomendowanym wyborem dla typu web w JavaScript/TypeScript i przechodzi wszystkie cztery bramki jakości, a jawne typy ułatwiają weryfikację pracy agenta. Znacznik logowania jest ustawiony; płatności, czas rzeczywisty, AI i zadania w tle nie występują w PRD. Sprawdzenie kilkudziesięciu zadań mieści się w środowisku brzegowym, ale reguły dostępu do danych trzeba skonfigurować od początku, bo wymóg „kierownik widzi tylko swoje projekty" od nich zależy. CI działa na GitHub Actions z automatycznym wdrożeniem po scaleniu, czyli tak, jak dostarcza go starter.
