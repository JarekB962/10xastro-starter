import type { APIRoute } from "astro";
import { errorUrl, readForm } from "@/lib/forms";
import { requireProjectId, requireSupabase } from "@/lib/services/project-routes";
import { PROJECT_ERROR_MESSAGES, selectProject } from "@/lib/services/projects";

export const prerender = false;

const AFTER_SELECT_TARGETS = new Map([
  ["specialties", "/specialties"],
  ["tasks", "/tasks"],
]);

export const POST: APIRoute = async (context) => {
  const supabase = requireSupabase(context, "/projects");
  if (supabase instanceof Response) return supabase;
  const id = requireProjectId(context);
  if (id instanceof Response) return id;

  const result = await selectProject(supabase, id);
  if (!result.ok) {
    return context.redirect(errorUrl("/projects", PROJECT_ERROR_MESSAGES[result.error]));
  }

  // Linki „Specjalności" i „Zadania" na liście projektów wybierają projekt i od razu otwierają jego ekran.
  // Cel pochodzi z whitelisty; każda inna wartość (też klucz z prototypu obiektu) daje /dashboard.
  const form = await readForm(context.request);
  const afterSelect = form?.get("after_select");
  const target = typeof afterSelect === "string" ? AFTER_SELECT_TARGETS.get(afterSelect) : undefined;
  return context.redirect(target ?? "/dashboard");
};
