import type { APIRoute } from "astro";
import { PROJECT_ERROR_MESSAGES, SUPABASE_NOT_CONFIGURED, errorUrl, selectProject } from "@/lib/services/projects";
import { parseProjectId } from "@/lib/validation/project";

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

  const result = await selectProject(supabase, id);
  if (!result.ok) {
    return context.redirect(errorUrl("/projects", PROJECT_ERROR_MESSAGES[result.error]));
  }

  return context.redirect("/dashboard");
};
