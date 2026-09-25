import type { APIRoute } from "astro";
import { INVALID_FORM_MESSAGE, errorUrl, readForm } from "@/lib/forms";
import { requireSupabase } from "@/lib/services/project-routes";
import { SPECIALTY_ERROR_MESSAGES, formValues, updateSpecialty } from "@/lib/services/specialties";
import { requireSpecialtyId } from "@/lib/services/specialty-routes";
import { parseSpecialtyInput } from "@/lib/validation/specialty";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const supabase = requireSupabase(context, "/specialties");
  if (supabase instanceof Response) return supabase;
  const id = requireSpecialtyId(context);
  if (id instanceof Response) return id;

  const back = `/specialties/${id}/edit`;
  const form = await readForm(context.request);
  if (!form) {
    return context.redirect(errorUrl(back, INVALID_FORM_MESSAGE));
  }
  const parsed = parseSpecialtyInput(form);
  if (!parsed.ok) {
    return context.redirect(errorUrl(back, parsed.message, formValues(form)));
  }

  const result = await updateSpecialty(supabase, id, parsed.data);
  if (!result.ok) {
    if (result.error === "not_found") {
      return context.redirect(errorUrl("/specialties", SPECIALTY_ERROR_MESSAGES.not_found));
    }
    return context.redirect(errorUrl(back, SPECIALTY_ERROR_MESSAGES[result.error], formValues(form)));
  }

  return context.redirect("/specialties");
};
