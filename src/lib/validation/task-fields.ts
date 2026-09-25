// Reguły pól zadania wspólne dla serwera (zod) i formularza w przeglądarce, żeby granice i komunikaty się nie rozjeżdżały.
// Moduł nie importuje nic z Astro ani z zod, więc może trafić do paczki przeglądarki.

export const MAX_NAME_LENGTH = 100;
export const MAX_NUMBER = 2147483647;
export const MAX_EFFORT = 99999999.99;
export const MAX_PREDECESSORS = 50;

export const TASK_FIELD_MESSAGES = {
  numberRequired: "Numer zadania jest wymagany.",
  numberInvalid: "Numer zadania musi być liczbą całkowitą od 1.",
  nameRequired: "Nazwa zadania jest wymagana.",
  nameTooLong: `Nazwa zadania może mieć najwyżej ${String(MAX_NAME_LENGTH)} znaków.`,
  effortInvalid: "Nakład musi być liczbą nie mniejszą niż 0.",
  predecessorsInvalid: "Poprzednicy to numery zadań rozdzielone przecinkami.",
  tooManyPredecessors: `Zadanie może mieć najwyżej ${String(MAX_PREDECESSORS)} poprzedników.`,
  selfPredecessor: "Zadanie nie może być własnym poprzednikiem.",
} as const;

/** Numer zadania: same cyfry, 1..2147483647 (bez znaku, spacji i notacji naukowej). */
export function toTaskNumber(text: string): number | null {
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  return value >= 1 && value <= MAX_NUMBER ? value : null;
}

/** Nakład: pusty daje `null`; liczba `>= 0` z najwyżej dwoma miejscami po przecinku (przecinek lub kropka). */
export function parseEffort(text: string): { ok: true; value: number | null } | { ok: false } {
  const trimmed = text.trim();
  if (trimmed === "") return { ok: true, value: null };
  const normalized = trimmed.replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return { ok: false };
  const value = Number(normalized);
  return value > MAX_EFFORT ? { ok: false } : { ok: true, value };
}

/** Poprzednicy: lista numerów po przecinku; powtórzenia są scalane, pusty tekst daje pustą listę. */
export function parsePredecessors(text: string): { ok: true; value: number[] } | { ok: false; message: string } {
  const trimmed = text.trim();
  if (trimmed === "") return { ok: true, value: [] };
  const seen = new Set<number>();
  for (const part of trimmed.split(",")) {
    const value = toTaskNumber(part.trim());
    if (value === null) return { ok: false, message: TASK_FIELD_MESSAGES.predecessorsInvalid };
    seen.add(value);
  }
  if (seen.size > MAX_PREDECESSORS) return { ok: false, message: TASK_FIELD_MESSAGES.tooManyPredecessors };
  return { ok: true, value: [...seen] };
}
