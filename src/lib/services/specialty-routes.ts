import type { APIContext } from "astro";
import { errorUrl } from "@/lib/forms";
import { SPECIALTY_ERROR_MESSAGES } from "@/lib/services/specialties";
import { parseSpecialtyId } from "@/lib/validation/specialty";

/** Identyfikator specjalności z adresu albo przekierowanie na listę; niepoprawny uuid to "nie znaleziono". */
export function requireSpecialtyId(context: APIContext): string | Response {
  return (
    parseSpecialtyId(context.params.id) ??
    context.redirect(errorUrl("/specialties", SPECIALTY_ERROR_MESSAGES.not_found))
  );
}
