import type { APIRoute } from "astro";
import {
  INVALID_FORM_MESSAGE,
  PROJECT_ERROR_MESSAGES,
  SUPABASE_NOT_CONFIGURED,
  errorUrl,
  formValues,
  readForm,
  updateProject,
} from "@/lib/services/projects";
import { parseProjectId, parseProjectInput } from "@/lib/validation/project";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const supabase = context.locals.supabase;
  if (!supabase) {
    return context.redirect(errorUrl("/projects", SUPABASE_NOT_CONFIGURED));
  }
  if (!context.locals.user) {
    return context.redirect("/auth/signin");
  }

  const id = parseProjectId(context.params.id);
  if (!id) {
    return context.redirect(errorUrl("/projects", PROJECT_ERROR_MESSAGES.not_found));
  }

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
