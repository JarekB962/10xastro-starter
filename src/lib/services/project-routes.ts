import type { APIContext } from "astro";
import { errorUrl } from "@/lib/forms";
import { PROJECT_ERROR_MESSAGES, SUPABASE_NOT_CONFIGURED } from "@/lib/services/projects";
import { parseProjectId } from "@/lib/validation/project";

// Wspólne strażniki tras `/api/projects*`. Zalogowanie egzekwuje middleware (`PROTECTED_ROUTES`), a dostęp do wierszy reguły w bazie.

/** Klient Supabase z żądania albo przekierowanie z komunikatem o braku konfiguracji. */
export function requireSupabase(context: APIContext, backPath: string) {
  return context.locals.supabase ?? context.redirect(errorUrl(backPath, SUPABASE_NOT_CONFIGURED));
}

/** Identyfikator projektu z adresu albo przekierowanie na listę; niepoprawny uuid to "nie znaleziono". */
export function requireProjectId(context: APIContext): string | Response {
  return parseProjectId(context.params.id) ?? context.redirect(errorUrl("/projects", PROJECT_ERROR_MESSAGES.not_found));
}
