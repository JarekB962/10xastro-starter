import type { createClient } from "@/lib/supabase";
import type { ServiceError } from "@/types";

export type Db = NonNullable<ReturnType<typeof createClient>>;

// Kody Postgres/PostgREST: 23505 unikalność, 23503 klucz obcy, 42501 naruszenie RLS, PGRST116 brak wiersza.
// Cudzy lub nieistniejący projekt wygląda tak samo: baza ukrywa cudze wiersze, więc to "nie znaleziono".
// Wyjątek: przy dodawaniu nie ma czego szukać, więc 23503/42501 (np. usunięty użytkownik z ważnym tokenem) to błąd niespodziewany.
function toError(error: { code?: string }, creating: boolean): ServiceError {
  switch (error.code) {
    case "23505":
      return "duplicate_name";
    case "23503":
    case "42501":
      return creating ? "unexpected" : "not_found";
    case "PGRST116":
      return "not_found";
    default:
      return "unexpected";
  }
}

/** Mapuje błąd bazy na wynik usługi; `scope` to prefiks komunikatu w logu serwera (np. "projects"). */
export function fail(
  scope: string,
  error: { code?: string; message?: string },
  creating = false,
): { ok: false; error: ServiceError } {
  const result = toError(error, creating);
  if (result === "unexpected") {
    // eslint-disable-next-line no-console -- surowy błąd bazy trafia do logów serwera, użytkownik dostaje ogólny komunikat
    console.error(`${scope}: unexpected database error`, error.code, error.message);
  }
  return { ok: false, error: result };
}
