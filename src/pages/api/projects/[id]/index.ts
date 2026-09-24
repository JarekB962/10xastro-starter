import type { APIRoute } from "astro";
import { INVALID_FORM_MESSAGE, errorUrl, readForm } from "@/lib/forms";
import { requireProjectId, requireSupabase } from "@/lib/services/project-routes";
import { PROJECT_ERROR_MESSAGES, formValues, updateProject } from "@/lib/services/projects";
import { parseProjectInput } from "@/lib/validation/project";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const supabase = requireSupabase(context, "/projects");
  if (supabase instanceof Response) return supabase;
  const id = requireProjectId(context);
  if (id instanceof Response) return id;

  const back = `/projects/${id}/edit`;
  const form = await readForm(context.request);
  if (!form) {
    return context.redirect(errorUrl(back, INVALID_FORM_MESSAGE));
  }
  const parsed = parseProjectInput(form);
  if (!parsed.ok) {
    return context.redirect(errorUrl(back, parsed.message, formValues(form)));
  }

  const result = await updateProject(supabase, id, parsed.data);
  if (!result.ok) {
    if (result.error === "not_found") {
      return context.redirect(errorUrl("/projects", PROJECT_ERROR_MESSAGES.not_found));
    }
    return context.redirect(errorUrl(back, PROJECT_ERROR_MESSAGES[result.error], formValues(form)));
  }

  return context.redirect("/projects");
};
