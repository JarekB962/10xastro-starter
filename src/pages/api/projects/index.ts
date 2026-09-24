import type { APIRoute } from "astro";
import { INVALID_FORM_MESSAGE, errorUrl, readForm } from "@/lib/forms";
import { requireSupabase } from "@/lib/services/project-routes";
import { PROJECT_ERROR_MESSAGES, createProject, formValues } from "@/lib/services/projects";
import { parseProjectInput } from "@/lib/validation/project";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const back = "/projects/new";

  const supabase = requireSupabase(context, back);
  if (supabase instanceof Response) return supabase;

  const form = await readForm(context.request);
  if (!form) {
    return context.redirect(errorUrl(back, INVALID_FORM_MESSAGE));
  }
  const parsed = parseProjectInput(form);
  if (!parsed.ok) {
    return context.redirect(errorUrl(back, parsed.message, formValues(form)));
  }

  const result = await createProject(supabase, parsed.data);
  if (!result.ok) {
    return context.redirect(errorUrl(back, PROJECT_ERROR_MESSAGES[result.error], formValues(form)));
  }

  return context.redirect("/projects");
};
