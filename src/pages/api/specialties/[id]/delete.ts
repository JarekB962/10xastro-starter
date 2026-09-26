import type { APIRoute } from "astro";
import { errorUrl } from "@/lib/forms";
import { requireSupabase } from "@/lib/services/project-routes";
import { SPECIALTY_ERROR_MESSAGES, SPECIALTY_IN_USE_MESSAGE, deleteSpecialty } from "@/lib/services/specialties";
import { requireSpecialtyId } from "@/lib/services/specialty-routes";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const supabase = requireSupabase(context, "/specialties");
  if (supabase instanceof Response) return supabase;
  const id = requireSpecialtyId(context);
  if (id instanceof Response) return id;

  const result = await deleteSpecialty(supabase, id);
  if (!result.ok) {
    if (result.error === "not_found") {
      return context.redirect(errorUrl("/specialties", SPECIALTY_ERROR_MESSAGES.not_found));
    }
    const message = result.error === "in_use" ? SPECIALTY_IN_USE_MESSAGE : SPECIALTY_ERROR_MESSAGES.unexpected;
    return context.redirect(errorUrl(`/specialties/${id}/delete`, message));
  }

  return context.redirect("/specialties");
};
