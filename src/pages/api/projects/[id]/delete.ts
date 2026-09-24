import type { APIRoute } from "astro";
import { errorUrl } from "@/lib/forms";
import { requireProjectId, requireSupabase } from "@/lib/services/project-routes";
import { PROJECT_ERROR_MESSAGES, deleteProject } from "@/lib/services/projects";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const supabase = requireSupabase(context, "/projects");
  if (supabase instanceof Response) return supabase;
  const id = requireProjectId(context);
  if (id instanceof Response) return id;

  const result = await deleteProject(supabase, id);
  if (!result.ok) {
    return context.redirect(errorUrl("/projects", PROJECT_ERROR_MESSAGES[result.error]));
  }

  return context.redirect("/projects");
};
