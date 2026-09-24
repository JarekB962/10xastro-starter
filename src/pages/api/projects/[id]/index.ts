import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import {
  PROJECT_ERROR_MESSAGES,
  SUPABASE_NOT_CONFIGURED,
  errorUrl,
  formValues,
  updateProject,
} from "@/lib/services/projects";
import { parseProjectId, parseProjectInput } from "@/lib/validation/project";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
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
  const form = await context.request.formData();
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
