import type { APIRoute } from "astro";
import {
  INVALID_FORM_MESSAGE,
  PROJECT_ERROR_MESSAGES,
  SUPABASE_NOT_CONFIGURED,
  createProject,
  errorUrl,
  formValues,
  readForm,
} from "@/lib/services/projects";
import { parseProjectInput } from "@/lib/validation/project";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const back = "/projects/new";

  const supabase = context.locals.supabase;
  if (!supabase) {
    return context.redirect(errorUrl(back, SUPABASE_NOT_CONFIGURED));
  }
  if (!context.locals.user) {
    return context.redirect("/auth/signin");
  }

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
