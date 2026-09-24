---
project: "Plan projektu (WBS)"
context_type: greenfield
created: 2026-09-21
updated: 2026-09-23
product_type: web-app
target_scale:
  users: small
timeline_budget:
  mvp_weeks: 5          # własny szacunek użytkownika (Faza 7)
  hard_deadline: 2026-11-04
  after_hours_only: true
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "zakres bólu w MVP"
      decision: "sprzeczności w zależnościach + brak jednoznacznej odpowiedzialności (pominięte zadania w zakresie poza MVP, do potwierdzenia)"
    - topic: "główna persona"
      decision: "kierownik projektu po stronie wykonawcy"
    - topic: "wgląd względem arkusza"
      decision: "automatyczne wykrywanie sprzeczności + wymuszanie kompletności danych"
  frs_drafted: 12
  quality_check_status: warned
---

# Shape notes

## Seed idea

Nowy produkt dla kierownika projektu. Na starcie projektu jest lista zadań z: specjalnością wykonawcy, oszacowaniem nakładu i zadaniami, które muszą być wykonane wcześniej. Aplikacja ma sprawdzać, czy w zależnościach między zadaniami nie ma sprzeczności.

Nierozstrzygnięte: definicja sprzeczności (cykle, nieistniejący poprzednik, zależność od samego siebie, duplikaty), sposób wprowadzania danych (ręcznie/import), rola oszacowań i specjalności, termin zgłoszenia i czas tygodniowo.

## Vision & Problem Statement

Na starcie projektu kierownik projektu dostaje wstępną listę zadań: dla każdego jest specjalność wykonawcy, ocena nakładu i informacja, jakie prace muszą być wykonane wcześniej. Jego zadaniem jest sprawdzić, czy w zależnościach między definicjami zadań nie ma sprzeczności. Dziś robi to w arkuszu i zajmuje mu to kilka godzin. Dane wprowadzone niedbale nie odzwierciedlają realnego zakresu (pominięte zadania), wzajemnych zależności ani jednoznacznej odpowiedzialności: po stronie wykonawcy, jego poszczególnych specjalistów oraz zlecającego, który uczestniczy w niektórych zadaniach.

Wgląd (wg użytkownika): aplikacja ma zastąpić ręczne sprawdzanie, automatycznie wykrywając sprzeczności oraz wymuszając kompletność danych, czego arkusz sam nie robi.

## User & Persona

Kierownik projektu po stronie wykonawcy (firma realizująca projekt; zlecający jest zewnętrzny i ma udział w niektórych zadaniach). Sięga po aplikację na starcie projektu, gdy dostaje wstępną listę zadań i musi sprawdzić jej spójność.

Branża: dowolna.

## Phase 1 — gray areas i otwarte punkty

- W MVP: sprzeczności w zależnościach oraz brak jednoznacznej odpowiedzialności (w tym zadania po stronie zlecającego).
- Poza MVP (do potwierdzenia w Non-Goals): wykrywanie pominiętych zadań w zakresie. Użytkownik go nie wybrał, a aplikacja sama nie wie, czego brakuje.
- Otwarte: nazwa projektu, dokładna definicja „sprzeczności", sposób wprowadzania danych (ręcznie/import), rola oszacowań i specjalności.

## Access Control

- Logowanie: email + hasło. Każdy kierownik projektu ma konto i widzi tylko swoje projekty oraz listy zadań.
- Role: kierownik projektu (pełne prawa: tworzenie, edycja, usuwanie, uruchamianie sprawdzenia). Udostępnienie projektu innym użytkownikom tylko do podglądu jest nice-to-have (FR-010), poza pierwszym przepływem.
- Niezalogowany użytkownik nie ma dostępu do danych projektu i jest kierowany do logowania.

Kierownik może udostępnić projekt innym użytkownikom tylko do podglądu (słowa użytkownika). Otwarte: kim są odbiorcy i jak kierownik ich wskazuje; nie ustalono (wcześniejsze wzmianki o zlecającym i specjalistach jako odbiorcach były propozycją asystenta, nie decyzją użytkownika).

## Success Criteria

Pierwszy przepływ MVP (zakres zmniejszony):
1. Kierownik loguje się i wybiera projekt.
2. Definiuje specjalności wykonawców.
3. Wpisuje zadania ręcznie (typowo kilkadziesiąt): specjalność, nakład, poprzednicy.
4. Uruchamia sprawdzenie i widzi listę zadań z problemami.

### Primary
- Sprawdzenie listy kilkudziesięciu zadań trwa od kilku do kilkunastu sekund (dziś: kilka godzin w arkuszu).
- Sprawdzenie wykrywa wszystkie sprzeczności.

### Secondary
- (nie podano)

### Guardrails
- Wpisane dane nie mogą zginąć.
- Nie może być fałszywego „wszystko w porządku" przy istniejącej sprzeczności.

## Poza pierwszą wersją (z Fazy 3)

- Wklejanie zadań z arkusza (parsowanie, obsługa błędnych danych).
- Grupowanie zadań w etapy z etapowym rozliczeniem prac.

## Functional Requirements

### Konto i projekty
- FR-001: Kierownik projektu can zalogować się do aplikacji. Priority: must-have
  > Socrates: Brak kontrargumentu; zostaje bez zmian.
- FR-002: Kierownik projektu can dodać projekt, edytować projekt i usunąć projekt (wraz z jego specjalnościami i zadaniami). Priority: must-have
  > Socrates: Kontrargument: bez usuwania projektu kierownik nie pozbędzie się testowych lub pomyłkowych projektów. Resolution: dodano usuwanie projektu do FR (wymaga potwierdzenia przed skasowaniem; szczegóły w planie).
- FR-003: Kierownik projektu can wybrać projekt, w którym pracuje. Priority: must-have
  > Socrates: Brak kontrargumentu; zostaje bez zmian.

### Specjalności wykonawców
- FR-004: Kierownik projektu can dodać i edytować specjalność wykonawców. Priority: must-have
  > Socrates: Brak kontrargumentu; zostaje bez zmian.
- FR-005: Kierownik projektu can usunąć specjalność, jeśli nie występuje w zadaniach tego projektu. Priority: must-have
  > Socrates: Brak kontrargumentu; zostaje bez zmian.

### Zadania
- FR-006: Kierownik projektu can ręcznie dodać zadanie (specjalność, nakład, poprzednicy) i poprawić je. Priority: must-have
  > Socrates: Brak kontrargumentu; zostaje bez zmian.
- FR-007: Kierownik projektu can usunąć zadanie, jeśli nie jest ono poprzednikiem dla innego zadania. Priority: must-have
  > Socrates: Brak kontrargumentu; zostaje bez zmian.

### Sprawdzanie
- FR-008: Kierownik projektu can uruchomić sprawdzenie listy zadań pod kątem: cykli zależności, nieistniejących poprzedników, braku odpowiedzialności (brak specjalności wykonawcy lub nakładu) i duplikatów zadań. Priority: must-have
  > Socrates: Brak kontrargumentu; zostaje bez zmian.
- FR-009: Kierownik projektu can zobaczyć listę zadań z problemami. Priority: must-have
  > Socrates: Brak kontrargumentu; zostaje bez zmian.
- FR-011: Kierownik projektu can zobaczyć stan projektu (zweryfikowany lub niezweryfikowany). Priority: must-have
  > Socrates: Brak kontrargumentu; zostaje bez zmian.

### Udostępnianie i klonowanie
- FR-010: Kierownik projektu can udostępnić projekt innym użytkownikom tylko do podglądu (bez możliwości modyfikacji). Priority: nice-to-have
  > Socrates: Kontrargument: wystarczyłby eksport wyniku zamiast kont i uprawnień. Resolution: pozostaje nice-to-have, poza MVP; do potwierdzenia w planie, czy udostępnianie zostaje w produkcie.
- FR-012: Kierownik projektu can sklonować projekt pod nową nazwą (np. „nowa wersja”). Priority: nice-to-have
  > Socrates: Kontrargument: kopia dziedziczy błędy, więc kierownik poprawia te same zadania w dwóch miejscach. Resolution: pozostaje nice-to-have, poza MVP; nowa kopia zaczyna jako niezweryfikowana.

## User Stories

### US-01: Kierownik sprawdza spójność listy zadań

- **Given** zalogowany kierownik projektu z wybranym projektem, w którym zdefiniował specjalności i wpisał kilkadziesiąt zadań
- **When** uruchamia sprawdzenie
- **Then** w ciągu kilku do kilkunastu sekund widzi listę zadań z problemami; gdy problemów nie ma, widzi komunikat, że ich nie znaleziono

#### Acceptance Criteria
- Wykrywa wszystkie cykle zależności, nieistniejące poprzedniki, brak odpowiedzialności i duplikaty
- Gdy problem istnieje, wynik nigdy nie mówi „wszystko w porządku"
- Zadanie, które jest poprzednikiem innego, nie może zostać usunięte
- Specjalność użyta w zadaniach projektu nie może zostać usunięta
- Wynik bez problemów to sam komunikat (bez dodatkowego raportu)

## Business Logic

Sprawdzenie listy zadań oznacza zadania z błędami jako problematyczne, a sam projekt jako niezweryfikowany.

Dane wejściowe: zadania projektu (specjalność, nakład, poprzednicy). Wynik: lista zadań oznaczonych jako problematyczne i stan projektu. Kryteria błędów: cykle zależności, nieistniejący poprzednik, brak odpowiedzialności, duplikaty (FR-008).

Stan projektu:
- Projekt jest „zweryfikowany" wyłącznie wtedy, gdy sprawdzenie nie znalazło problemów; kierownik nie ustawia go ręcznie. W przeciwnym razie jest „niezweryfikowany".
- Każda zmiana danych po sprawdzeniu (dodanie lub edycja zadania, zmiana specjalności) cofa projekt do „niezweryfikowany" (chroni guardrail przed fałszywym „wszystko w porządku").
- Kontrola „nieistniejący poprzednik" zostaje w MVP jako kontrola obronna, mimo że FR-007 blokuje usuwanie zadań będących poprzednikami.

Stan projektu jest widoczny dla kierownika (FR-011).

## Non-Functional Requirements

- Kierownik widzi i modyfikuje tylko swoje projekty. Inny użytkownik widzi projekt wyłącznie wtedy, gdy kierownik go mu udostępni, i tylko do odczytu.
- Usunięcie projektu następuje dopiero po wyraźnym potwierdzeniu przez kierownika, że jest pewien tej akcji.
- Sprawdzenie listy kilkudziesięciu zadań trwa od kilku do kilkunastu sekund.
- Zwykłe akcje (zapis i edycja zadania, przełączenie projektu) są odczuwalnie natychmiastowe: wynik widoczny w czasie poniżej 1 sekundy.
- Aplikacja działa na komputerze, w nowoczesnych przeglądarkach desktopowych; telefon i tablet nie są wymagane.
- Wpisane dane nie giną, a wynik sprawdzenia nigdy nie mówi „wszystko w porządku” przy istniejącej sprzeczności.

## Non-Goals

- Wykrywanie pominiętych zadań w zakresie: aplikacja sprawdza spójność wpisanych zadań, nie ocenia, czy czegoś brakuje w zakresie (wybór użytkownika, Faza 6).
- Wklejanie zadań z arkusza: pierwsza wersja ma tylko ręczne wpisywanie (decyzja z Fazy 3, wersja 2).
- Grupowanie zadań w etapy z etapowym rozliczeniem prac (decyzja z Fazy 3, wersja 2).
- Aplikacja na telefon lub tablet: pierwsza wersja działa na komputerze (NFR).
- Nice-to-have, poza pierwszym przepływem: udostępnianie projektu do podglądu (FR-010) i klonowanie projektu (FR-012).

## Quality cross-check

Wynik: access control, logika biznesowa, artefakty i Non-Goals — present. Pozostają dwa ostrzeżenia (użytkownik zaakceptował zakończenie z lukami):

- Timeline-cost ack: mvp_weeks: 5 (własny szacunek), a użytkownik odmówił jawnego potwierdzenia kosztu stałego wysiłku i jednocześnie zdecydował zostawić zakres bez zmian (9 wymagań must-have). Konsekwencja: zakres i termin są w napięciu (około 6 tygodni do 2026-11-04, praca po godzinach); PRD ujawni to w Open Questions.
- Access Control / FR-010: nie ustalono, kim są odbiorcy udostępnionego projektu ani jak kierownik ich wskazuje; niepewne, czy udostępnianie zostaje w produkcie. Konsekwencja: nice-to-have bez zdefiniowanych ról do podglądu.
