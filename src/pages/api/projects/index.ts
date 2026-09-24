import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import {
  PROJECT_ERROR_MESSAGES,
  SUPABASE_NOT_CONFIGURED,
  createProject,
  errorUrl,
  formValues,
} from "@/lib/services/projects";
import { parseProjectInput } from "@/lib/validation/project";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const back = "/projects/new";

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(errorUrl(back, SUPABASE_NOT_CONFIGURED));
  }
  if (!context.locals.user) {
    return context.redirect("/auth/signin");
  }

  const form = await context.request.formData();
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
