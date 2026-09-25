import type { APIRoute } from "astro";
import { INVALID_FORM_MESSAGE, errorUrl, readForm } from "@/lib/forms";
import { requireSupabase } from "@/lib/services/project-routes";
import { getSelectedProjectId } from "@/lib/services/projects";
import { NO_PROJECT_SELECTED_MESSAGE, TASK_ERROR_MESSAGES, createTask, formValues } from "@/lib/services/tasks";
import { parseTaskInput } from "@/lib/validation/task";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const back = "/tasks";

  const supabase = requireSupabase(context, back);
  if (supabase instanceof Response) return supabase;

  const form = await readForm(context.request);
  if (!form) {
    return context.redirect(errorUrl(back, INVALID_FORM_MESSAGE));
  }
  const parsed = parseTaskInput(form);
  if (!parsed.ok) {
    return context.redirect(errorUrl(back, parsed.message, formValues(form)));
  }

  // Projekt pochodzi z wyboru po stronie serwera, nie z formularza.
  const selected = await getSelectedProjectId(supabase);
  if (!selected.ok) {
    return context.redirect(errorUrl(back, TASK_ERROR_MESSAGES[selected.error], formValues(form)));
  }
  if (!selected.data) {
    return context.redirect(errorUrl(back, NO_PROJECT_SELECTED_MESSAGE, formValues(form)));
  }

  const result = await createTask(supabase, selected.data, parsed.data);
  if (!result.ok) {
    return context.redirect(errorUrl(back, TASK_ERROR_MESSAGES[result.error], formValues(form)));
  }

  return context.redirect(back);
};
