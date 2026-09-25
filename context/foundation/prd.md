---
project: "Plan projektu (WBS)"
version: 2
status: draft
created: 2026-09-23
context_type: greenfield
product_type: web-app
target_scale:
  users: small
  qps: null            # TODO: target_scale.qps — see Open Questions
  data_volume: null    # TODO: target_scale.data_volume — see Open Questions
timeline_budget:
  mvp_weeks: 5
  hard_deadline: 2026-11-04
  after_hours_only: true
---

# Plan projektu (WBS)

## Vision & Problem Statement

Na starcie projektu kierownik projektu dostaje wstępną listę zadań: dla każdego jest specjalność wykonawcy, ocena nakładu i informacja, jakie prace muszą być wykonane wcześniej. Jego zadaniem jest sprawdzić, czy w zależnościach między definicjami zadań nie ma sprzeczności. Dziś robi to w arkuszu i zajmuje mu to kilka godzin. Dane wprowadzone niedbale nie odzwierciedlają realnego zakresu (pominięte zadania), wzajemnych zależności ani jednoznacznej odpowiedzialności: po stronie wykonawcy, jego poszczególnych specjalistów oraz zlecającego, który uczestniczy w niektórych zadaniach.

Wgląd (wg użytkownika): aplikacja ma zastąpić ręczne sprawdzanie, automatycznie wykrywając sprzeczności oraz wymuszając kompletność danych, czego arkusz sam nie robi.

## User & Persona

Kierownik projektu po stronie wykonawcy (firma realizująca projekt; zlecający jest zewnętrzny i ma udział w niektórych zadaniach). Sięga po aplikację na starcie projektu, gdy dostaje wstępną listę zadań i musi sprawdzić jej spójność.

Branża: dowolna.

## Success Criteria

### Primary
- Pierwszy przepływ MVP: kierownik loguje się i wybiera projekt; definiuje specjalności wykonawców; wpisuje zadania ręcznie (typowo kilkadziesiąt): numer, nazwa, specjalność, nakład, poprzednicy (numery zadań); uruchamia sprawdzenie i widzi listę zadań z problemami.
- Sprawdzenie listy kilkudziesięciu zadań trwa od kilku do kilkunastu sekund (dziś: kilka godzin w arkuszu).
- Sprawdzenie wykrywa wszystkie sprzeczności.

### Secondary
# TODO: secondary success criteria — see Open Questions

### Guardrails
- Wpisane dane nie mogą zginąć.
- Nie może być fałszywego „wszystko w porządku" przy istniejącej sprzeczności.

## User Stories

### US-01: Kierownik sprawdza spójność listy zadań

- **Given** zalogowany kierownik projektu z wybranym projektem, w którym zdefiniował specjalności i wpisał kilkadziesiąt zadań
- **When** uruchamia sprawdzenie
- **Then** w ciągu kilku do kilkunastu sekund widzi listę zadań z problemami; gdy problemów nie ma, widzi komunikat, że ich nie znaleziono

#### Acceptance Criteria
- Wykrywa wszystkie cykle zależności, nieistniejące poprzedniki, brak odpowiedzialności i duplikaty
- Gdy problem istnieje, wynik nigdy nie mówi „wszystko w porządku"
- Zadanie, które jest poprzednikiem innego, nie może zostać usunięte
- Zadanie nie może wskazywać samego siebie jako poprzednika (blokada przy zapisie)
- Numer zadania jest unikalny w projekcie; zmiana numeru poprawia go u zadań, które mają je jako poprzednika
- Specjalność użyta w zadaniach projektu nie może zostać usunięta
- Wynik bez problemów to sam komunikat (bez dodatkowego raportu)

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
- FR-006: Kierownik projektu can ręcznie dodać zadanie (numer zadania, nazwa zadania, specjalność, nakład, poprzednicy) i poprawić je. Numer zadania jest liczbą całkowitą, niepowtarzalną w projekcie; numer i nazwa są wymagane. Poprzednicy są wpisywani jako numery zadań; zadanie nie może wskazywać samego siebie jako poprzednika (blokada przy zapisie). Poprzednik może wskazywać numer zadania, którego jeszcze nie ma (kontroluje to sprawdzenie, FR-008). Priority: must-have
  > Socrates: Brak kontrargumentu; zostaje bez zmian. Ustalone 2026-09-25: dodano wymagane pola numer i nazwa; poprzednicy jako numery; blokada wskazania samego siebie.
- FR-007: Kierownik projektu can usunąć zadanie, jeśli nie jest ono poprzednikiem dla innego zadania. Zmiana numeru zadania automatycznie aktualizuje numer u wszystkich zadań, dla których jest ono poprzednikiem. Priority: must-have
  > Socrates: Brak kontrargumentu; zostaje bez zmian. Ustalone 2026-09-25: zmiana numeru poprawia poprzedników automatycznie (zamiast blokady).

### Sprawdzanie
- FR-008: Kierownik projektu can uruchomić sprawdzenie listy zadań pod kątem: cykli zależności (co najmniej dwa zadania zależą od siebie nawzajem, pośrednio lub bezpośrednio; oznaczane są wszystkie zadania leżące na cyklu), nieistniejących poprzedników (numer, którego nie ma w projekcie), braku odpowiedzialności (brak specjalności wykonawcy albo nakład pusty lub równy 0) i duplikatów zadań (ta sama nazwa po obcięciu spacji, bez rozróżniania wielkości liter; oznaczane są wszystkie zadania o tej nazwie). Priority: must-have
  > Socrates: Brak kontrargumentu; zostaje bez zmian. Ustalone 2026-09-25: doprecyzowano definicje czterech kryteriów (patrz Open Questions 5).
- FR-009: Kierownik projektu can zobaczyć listę zadań z problemami. Priority: must-have
  > Socrates: Brak kontrargumentu; zostaje bez zmian.
- FR-011: Kierownik projektu can zobaczyć stan projektu (zweryfikowany lub niezweryfikowany). Priority: must-have
  > Socrates: Brak kontrargumentu; zostaje bez zmian.

### Udostępnianie i klonowanie
- FR-010: Kierownik projektu can udostępnić projekt innym użytkownikom tylko do podglądu (bez możliwości modyfikacji). Priority: nice-to-have
  > Socrates: Kontrargument: wystarczyłby eksport wyniku zamiast kont i uprawnień. Resolution: pozostaje nice-to-have, poza MVP; do potwierdzenia w planie, czy udostępnianie zostaje w produkcie.
- FR-012: Kierownik projektu can sklonować projekt pod nową nazwą (np. „nowa wersja”). Priority: nice-to-have
  > Socrates: Kontrargument: kopia dziedziczy błędy, więc kierownik poprawia te same zadania w dwóch miejscach. Resolution: pozostaje nice-to-have, poza MVP; nowa kopia zaczyna jako niezweryfikowana.

## Non-Functional Requirements

- Kierownik widzi i modyfikuje tylko swoje projekty. Inny użytkownik widzi projekt wyłącznie wtedy, gdy kierownik go mu udostępni, i tylko do odczytu.
- Usunięcie projektu następuje dopiero po wyraźnym potwierdzeniu przez kierownika, że jest pewien tej akcji.
- Sprawdzenie listy kilkudziesięciu zadań trwa od kilku do kilkunastu sekund.
- Zwykłe akcje (zapis i edycja zadania, przełączenie projektu) są odczuwalnie natychmiastowe: wynik widoczny w czasie poniżej 1 sekundy.
- Aplikacja działa na komputerze, w nowoczesnych przeglądarkach desktopowych; telefon i tablet nie są wymagane.
- Wpisane dane nie giną, a wynik sprawdzenia nigdy nie mówi „wszystko w porządku” przy istniejącej sprzeczności.

## Business Logic

Sprawdzenie listy zadań oznacza zadania z błędami jako problematyczne, a sam projekt jako niezweryfikowany.

Dane wejściowe: zadania projektu (numer, nazwa, specjalność, nakład, poprzednicy). Wynik: lista zadań oznaczonych jako problematyczne i stan projektu. Kryteria błędów: cykle zależności, nieistniejący poprzednik, brak odpowiedzialności, duplikaty (FR-008).

Stan projektu:
- Projekt jest „zweryfikowany" wyłącznie wtedy, gdy sprawdzenie nie znalazło problemów; kierownik nie ustawia go ręcznie. W przeciwnym razie jest „niezweryfikowany".
- Każda zmiana danych po sprawdzeniu (dodanie lub edycja zadania, zmiana specjalności) cofa projekt do „niezweryfikowany" (chroni guardrail przed fałszywym „wszystko w porządku").
- Kontrola „nieistniejący poprzednik" jest pełnoprawna: poprzednika wpisuje się numerem, więc literówka lub odwołanie do zadania, którego jeszcze nie wpisano, jest zwykłym błędem wykrywanym przez sprawdzenie. Zapis takiego odwołania nie jest blokowany (blokowane jest tylko wskazanie samego siebie).

Stan projektu jest widoczny dla kierownika (FR-011).

## Access Control

- Logowanie: email + hasło. Każdy kierownik projektu ma konto i widzi tylko swoje projekty oraz listy zadań.
- Role: kierownik projektu (pełne prawa: tworzenie, edycja, usuwanie, uruchamianie sprawdzenia). Udostępnienie projektu innym użytkownikom tylko do podglądu jest nice-to-have (FR-010), poza pierwszym przepływem.
- Niezalogowany użytkownik nie ma dostępu do danych projektu i jest kierowany do logowania.
- Kierownik może udostępnić projekt innym użytkownikom tylko do podglądu. # TODO: recipients of a shared project and how the manager selects them — see Open Questions

## Non-Goals

- Wykrywanie pominiętych zadań w zakresie: aplikacja sprawdza spójność wpisanych zadań, nie ocenia, czy czegoś brakuje w zakresie (wybór użytkownika).
- Wklejanie zadań z arkusza: pierwsza wersja ma tylko ręczne wpisywanie (wersja 2).
- Grupowanie zadań w etapy z etapowym rozliczeniem prac (wersja 2).
- Aplikacja na telefon lub tablet: pierwsza wersja działa na komputerze.
- Nice-to-have, poza pierwszym przepływem: udostępnianie projektu do podglądu (FR-010) i klonowanie projektu (FR-012).

## Open Questions

1. **Jakie są drugorzędne kryteria sukcesu (Secondary)?** — Nie podano. Owner: użytkownik. Block: no.
2. **Jakie są `target_scale.qps` i `target_scale.data_volume`?** — Nie podano; znana jest tylko liczba użytkowników (garstka osób). Owner: użytkownik. Block: no.
3. **Zakres kontra czas.** — `mvp_weeks: 5` to własny szacunek użytkownika, a do `hard_deadline` 2026-11-04 zostaje około 6 tygodni pracy po godzinach. Użytkownik odmówił jawnego potwierdzenia kosztu stałego wysiłku i zdecydował zostawić 9 wymagań must-have bez zmian. Zakres i termin są w napięciu. Owner: użytkownik. By: przed planowaniem implementacji. Block: no.
4. **Kim są odbiorcy udostępnionego projektu (FR-010) i jak kierownik ich wskazuje?** — Nie ustalono; niepewne też, czy udostępnianie zostaje w produkcie (alternatywa: eksport wyniku). Owner: użytkownik. Block: no (nice-to-have).
5. **Jaka jest dokładna definicja „sprzeczności" i „duplikatu zadania"?** — Rozstrzygnięte 2026-09-25. „Sprzeczność" to dokładnie cztery kryteria z FR-008: cykl zależności (co najmniej dwa zadania; zadanie wskazujące samo siebie jest blokowane przy zapisie, więc nie trafia do sprawdzenia), nieistniejący poprzednik, brak odpowiedzialności (brak specjalności albo nakład pusty lub równy 0; zleceniodawca jest zwykłą specjalnością) i duplikat (ta sama nazwa po obcięciu spacji, bez rozróżniania wielkości liter). Numer zadania jest liczbą całkowitą, niepowtarzalną w projekcie, więc nie bywa duplikatem do wykrycia. Owner: użytkownik. Block: no.
6. **Jaka jest rola oszacowań nakładu i specjalności poza kontrolą kompletności?** — W notatkach wskazane jako nierozstrzygnięte. Owner: użytkownik. Block: no.
7. **Jak dokładnie przebiega usunięcie projektu (FR-002)?** — Notatki odsyłają szczegóły do planu (potwierdzenie przed skasowaniem, skasowanie specjalności i zadań razem z projektem). Owner: użytkownik. Block: no.
